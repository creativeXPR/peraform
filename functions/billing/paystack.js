import { createHmac, timingSafeEqual } from 'node:crypto'

// The few Paystack API calls we need. The secret key never leaves the
// server; checkout happens on Paystack's own page (authorization_url), so
// the app needs no Paystack key at all.
const API = 'https://api.paystack.co'

async function call(secret, path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.status === false) {
    throw new Error(`Paystack ${path}: ${res.status} ${json.message ?? ''}`.trim())
  }
  return json.data
}

// → { authorization_url, access_code, reference }
export function initializeTransaction(secret, { email, amountKobo, reference, callbackUrl, metadata }) {
  return call(secret, '/transaction/initialize', {
    method: 'POST',
    body: { email, amount: amountKobo, currency: 'NGN', reference, callback_url: callbackUrl, metadata },
  })
}

// → { status: 'success' | 'failed' | 'abandoned' | …, amount, currency, id, channel, paid_at, metadata }
export function verifyTransaction(secret, reference) {
  return call(secret, `/transaction/verify/${encodeURIComponent(reference)}`)
}

export function refundTransaction(secret, reference) {
  return call(secret, '/refund', { method: 'POST', body: { transaction: reference } })
}

// Paystack signs each webhook: HMAC-SHA512 of the raw body, keyed with the
// secret key, hex, in the x-paystack-signature header.
export function validSignature(secret, rawBody, signature) {
  if (!rawBody || typeof signature !== 'string') return false
  const expected = createHmac('sha512', secret).update(rawBody).digest()
  let given
  try {
    given = Buffer.from(signature, 'hex')
  } catch {
    return false
  }
  return given.length === expected.length && timingSafeEqual(given, expected)
}

// Refund events have carried the original payment's reference under more
// than one name; accept any of them.
export function refundReference(data) {
  return (
    data?.transaction_reference ??
    data?.transaction?.reference ??
    (typeof data?.transaction === 'string' ? data.transaction : null)
  )
}
