// Credit pricing: shared by the functions (holds and charges) and the app
// (the "≈ X credits" hints), so both always use the same math.
// No imports, no I/O: keep it that way so the browser can load it.
//
// Units (never floats for money):
//   millicredits: 1 credit = 1000   ·   kobo: ₦1 = 100

// Model prices in USD per 1M tokens (text, prompts ≤ 200k tokens):
//   Gemini on Vertex AI (global endpoint): cloud.google.com/vertex-ai/
//     generative-ai/pricing, read 2026-10-24. gemini-3.6/3.8-flash are at
//     an introductory price until 2026-12-31; from 2027-01-01 they are
//     $1.50 / $7.50. Update config/billing then.
//   Tiers were picked on speed (2026-10-24, same prompt, 3 runs): 3.5
//     Flash-Lite 2.5 s, 3.6 Flash 4–6 s, 3.1 Pro 13–15 s. 3.8 Flash swung
//     from 7 s to over 90 s, and 3.1 Flash-Lite once looped until its limit. (A regional VERTEX_LOCATION costs
//     10% more for Gemini 3.x.) The 2.5 models aren't open to this project
//     on Vertex (404), so the tiers use 3.x; their prices stay for reference.
//   Claude: Anthropic's pricing, read 2026-10-06 (kept so a tier can be
//     pointed back at Claude from config/billing).
// The billing db's config/billing doc overrides these. Thinking tokens
// are billed as output by both providers.
export const DEFAULT_BILLING = {
  creditValueKobo: 2000, // 1 credit = ₦20
  fxNgnPerUsd: 1700, // buffered above market
  markup: 2.5, // covers Paystack fees and VAT too
  minChargeMillicredits: 100, // 0.1 credit
  maxChargeMillicredits: 40000, // 40 credits per run, at most
  starterMillicredits: 10000, // 10 free credits for a new account
  lowBalanceMillicredits: 5000,
  // Who the invoices are from (config/billing → invoice overrides it).
  invoice: {
    name: 'Quality Tools',
    email: 'qualitytoolsx@gmail.com',
    website: 'quality-toolsx.web.app',
    address: '',
    note: 'Payment processed by Paystack. Credits never expire and work in every Quality Tools app.',
  },
  models: {
    'gemini-3.5-flash-lite': { inUsdPerM: 0.3, outUsdPerM: 2.5 },
    'gemini-3.6-flash': { inUsdPerM: 0.75, outUsdPerM: 3.75 },
    'gemini-3.1-flash-lite': { inUsdPerM: 0.25, outUsdPerM: 1.5 },
    'gemini-3.8-flash': { inUsdPerM: 0.75, outUsdPerM: 3.75 },
    'gemini-3.1-pro-preview': { inUsdPerM: 2, outUsdPerM: 12 },
    'gemini-2.5-flash-lite': { inUsdPerM: 0.1, outUsdPerM: 0.4 },
    'gemini-2.5-pro': { inUsdPerM: 1.25, outUsdPerM: 10 },
    'claude-haiku-5-5': { inUsdPerM: 0.1, outUsdPerM: 0.5 },
    'claude-sonnet-5-5': { inUsdPerM: 2, outUsdPerM: 10 },
    'claude-opus-5-5': { inUsdPerM: 4, outUsdPerM: 20 },
  },
  // What each quality level runs on.
  tiers: {
    quick: 'gemini-3.5-flash-lite',
    standard: 'gemini-3.6-flash',
    best: 'gemini-3.1-pro-preview',
  },
}

export const TIERS = ['quick', 'standard', 'best']

// The stored config/billing doc over the defaults (models and tiers merge
// key by key, so adding one model doesn't drop the others).
export function mergeBilling(stored = {}) {
  return {
    ...DEFAULT_BILLING,
    ...stored,
    models: { ...DEFAULT_BILLING.models, ...stored.models },
    tiers: { ...DEFAULT_BILLING.tiers, ...stored.tiers },
    invoice: { ...DEFAULT_BILLING.invoice, ...stored.invoice },
  }
}

export const DEFAULT_PACKS = [
  { id: 'starter', name: 'Starter', priceKobo: 100000, millicredits: 40000, active: true },
  { id: 'standard', name: 'Standard', priceKobo: 250000, millicredits: 110000, active: true },
  { id: 'pro', name: 'Pro', priceKobo: 500000, millicredits: 240000, active: true },
]

export function costUsd(billing, model, tokensIn, tokensOut) {
  const price = billing.models[model]
  if (!price) throw new Error(`No price for ${model}`)
  return (tokensIn / 1e6) * price.inUsdPerM + (tokensOut / 1e6) * price.outUsdPerM
}

// USD cost → millicredits, rounded up, then held inside the min/max.
export function chargeFor(billing, usd) {
  const priceKobo = usd * billing.fxNgnPerUsd * 100 * billing.markup
  // The tiny epsilon stops float noise (e.g. 2.0000000001) adding a whole unit.
  const millicredits = Math.ceil((priceKobo / billing.creditValueKobo) * 1000 - 1e-9)
  return Math.min(Math.max(millicredits, billing.minChargeMillicredits), billing.maxChargeMillicredits)
}

// Rough token count for text we haven't sent yet. Deliberately generous
// (≈3 characters a token; real English is closer to 4), since it sizes holds.
export function estimateTokens(chars) {
  return Math.ceil(chars / 3)
}

// The most a run could cost: all of its input, plus every output token it's
// allowed (thinking included). This is what gets reserved before calling.
export function holdFor(billing, model, inputTokens, maxTokens) {
  return chargeFor(billing, costUsd(billing, model, inputTokens, maxTokens))
}

// The reverse: how many output tokens `millicredits` pays for, after the
// input. A run reserves what the user can spare and its max_tokens is cut
// to fit, so it can never cost more than it reserved.
export function affordableOutputTokens(billing, model, inputTokens, millicredits) {
  const price = billing.models[model]
  const usd = ((millicredits / 1000) * billing.creditValueKobo) / (billing.fxNgnPerUsd * 100 * billing.markup)
  const left = usd - (inputTokens / 1e6) * price.inUsdPerM
  return Math.max(0, Math.floor((left / price.outUsdPerM) * 1e6))
}

// What a run will probably cost, for the hint on the button.
export function typicalCharge(billing, model, inputTokens, outputTokens) {
  return chargeFor(billing, costUsd(billing, model, inputTokens, outputTokens))
}

// 12345 → "12.3", 400 → "0.4", 10000 → "10". Rounds toward zero, so we never
// show more than is there.
export function formatCredits(millicredits) {
  const tenths = Math.trunc(millicredits / 100)
  const sign = tenths < 0 ? '−' : ''
  const abs = Math.abs(tenths)
  return `${sign}${Math.floor(abs / 10)}${abs % 10 ? `.${abs % 10}` : ''}`
}

export function formatNaira(kobo) {
  return `₦${(kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`
}
