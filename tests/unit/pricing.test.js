import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { AI_FEATURES, holdRange, tierFor } from '../../functions/ai/catalog.js'
import { FEATURES, InputError } from '../../functions/ai/features.js'
import { refundReference, validSignature } from '../../functions/billing/paystack.js'
import {
  DEFAULT_BILLING as B,
  affordableOutputTokens,
  chargeFor,
  costUsd,
  formatCredits,
  holdFor,
  typicalCharge,
} from '../../functions/billing/pricing.js'

describe('pricing', () => {
  it('charges the minimum for a free run', () => {
    expect(chargeFor(B, 0)).toBe(B.minChargeMillicredits)
  })

  it('caps a huge run at the maximum', () => {
    expect(chargeFor(B, costUsd(B, 'claude-opus-5-5', 1e6, 1e6))).toBe(B.maxChargeMillicredits)
  })

  it('follows the formula and always rounds up', () => {
    // Sonnet, 2k in + 3k out = $0.034 → ×1700 ×100 ×2.5 = 14,450 kobo → /2000 = 7.225 credits
    const usd = costUsd(B, 'claude-sonnet-5-5', 2000, 3000)
    expect(usd).toBeCloseTo(0.034, 10)
    expect(chargeFor(B, usd)).toBe(7225)
    // A hair over a whole millicredit rounds up to the next one.
    expect(chargeFor(B, (7225.4 / 1000) * 2000 / (1700 * 100 * 2.5))).toBe(7226)
  })

  it('moves with the exchange rate and the markup', () => {
    const usd = costUsd(B, 'claude-sonnet-5-5', 2000, 3000)
    expect(chargeFor({ ...B, fxNgnPerUsd: 3400 }, usd)).toBe(14450)
    expect(chargeFor({ ...B, markup: 5 }, usd)).toBe(14450)
  })

  it('prices thinking as output (it is inside output tokens)', () => {
    expect(costUsd(B, 'claude-haiku-5-5', 0, 1e6)).toBe(0.5)
  })

  it('refuses a model with no price', () => {
    expect(() => costUsd(B, 'nope', 1, 1)).toThrow()
  })

  it('lets the starter credits make a standard form, then keep going on Quick', () => {
    const f = AI_FEATURES['generate-form']
    const range = holdRange(B, 'generate-form', 'standard', 'describe', f.maxChars.describe)
    expect(range.max).toBeLessThanOrEqual(B.starterMillicredits)
    const typical = typicalCharge(B, B.tiers.standard, f.typical.inputTokens, f.typical.outputTokens)
    expect(typical).toBeLessThan(range.min)
    // After one typical standard run, Quick still fits.
    const quick = holdRange(B, 'generate-form', 'quick', 'describe', f.maxChars.describe)
    expect(B.starterMillicredits - typical).toBeGreaterThanOrEqual(quick.max)
  })

  it('cuts the output budget to what a reservation pays for, never over', () => {
    for (const model of Object.keys(B.models)) {
      // Every real reservation covers its input (it is at least the minimum hold).
      for (const reserved of [3333, 7000, B.maxChargeMillicredits]) {
        const tokens = affordableOutputTokens(B, model, 1500, reserved)
        expect(chargeFor(B, costUsd(B, model, 1500, tokens))).toBeLessThanOrEqual(Math.max(reserved, B.minChargeMillicredits))
        // …and one more token's worth would be over (or it's the whole range).
        expect(holdFor(B, model, 1500, tokens + 50)).toBeGreaterThan(reserved - 1)
      }
    }
    // Nothing left after the input: no output.
    expect(affordableOutputTokens(B, 'claude-opus-5-5', 1e6, 100)).toBe(0)
  })

  it('formats credits without ever rounding up', () => {
    expect(formatCredits(10000)).toBe('10')
    expect(formatCredits(12399)).toBe('12.3')
    expect(formatCredits(400)).toBe('0.4')
    expect(formatCredits(99)).toBe('0')
    expect(formatCredits(-1500)).toBe('−1.5')
  })
})

describe('AI features', () => {
  const generate = FEATURES['generate-form']

  it('falls back to the default quality level', () => {
    expect(tierFor('generate-form', 'best')).toBe('best')
    expect(tierFor('generate-form', 'gpt-9')).toBe('standard')
  })

  it('checks and sizes the input', () => {
    expect(() => generate.prepare({ text: '' })).toThrow(InputError)
    expect(() => generate.prepare({ text: 'x'.repeat(2001) })).toThrow(InputError)
    expect(generate.prepare({ mode: 'text', text: 'x'.repeat(2001) }).mode).toBe('text')
    const p = generate.prepare({ text: '  Feedback on our bakery  ' })
    expect(p.prompt).toContain('Feedback on our bakery')
    expect(p).toMatchObject({ mode: 'describe', chars: 22 })
  })

  it('rejects an empty form', () => {
    expect(generate.result({ title: 'x', questions: [] })).toBeNull()
  })
})

describe('Paystack webhook', () => {
  const secret = 'sk_test_x'
  const body = Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: 'tp_1' } }))
  const sign = (b, key = secret) => createHmac('sha512', key).update(b).digest('hex')

  it('accepts a correct signature only', () => {
    expect(validSignature(secret, body, sign(body))).toBe(true)
    expect(validSignature(secret, body, sign(body, 'sk_test_other'))).toBe(false)
    expect(validSignature(secret, Buffer.from(`${body} `), sign(body))).toBe(false)
    expect(validSignature(secret, body, undefined)).toBe(false)
    expect(validSignature(secret, body, 'zz')).toBe(false)
  })

  it('finds the refunded payment under either field name', () => {
    expect(refundReference({ transaction_reference: 'tp_a' })).toBe('tp_a')
    expect(refundReference({ transaction: { reference: 'tp_b' } })).toBe('tp_b')
    expect(refundReference({})).toBeNull()
  })
})
