import { randomBytes } from 'node:crypto'
import { getAuth } from 'firebase-admin/auth'
import { logger } from 'firebase-functions'
import { defineSecret, defineString } from 'firebase-functions/params'
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { EMULATED, REGION, billingDb as bdb, db, requireApp } from '../app.js'
import { holdRange, inputTokensFor, tierFor } from '../ai/catalog.js'
import { AiError } from '../ai/errors.js'
import { runModel } from '../ai/run.js'
import { FAKE_OUTPUT, FEATURES, InputError } from '../ai/features.js'
import { APP_URL } from '../mail.js'
import { allow } from '../rateLimit.js'
import * as paystack from './paystack.js'
import { DEFAULT_PACKS, affordableOutputTokens, chargeFor, costUsd, mergeBilling } from './pricing.js'
import {
  BillingError,
  adminAdjust,
  creditPayment,
  ensureWallet as ensureWalletDoc,
  placeHold,
  releaseHold,
  reversePayment,
  settleHold,
  sweepStaleHolds,
} from './wallet.js'

// Credits: wallets, Paystack top-ups and metered AI runs. Data lives in
// the suite-wide billing database; only these functions write to it.
//   firebase functions:secrets:set PAYSTACK_SECRET_KEY   (sk_test_… first)
//   firebase functions:secrets:set GEMINI_API_KEY        (Google AI Studio)
const PAYSTACK_SECRET_KEY = defineSecret('PAYSTACK_SECRET_KEY')
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY')
// Comma-separated emails that may grant, adjust and refund credits.
const ADMIN_EMAILS = defineString('ADMIN_EMAILS', { default: '' })

// Emulator stand-ins (functions/.env.local), so local tests never call
// the AI or Paystack: AI_FAKE=1, PAYSTACK_FAKE=1.
const AI_FAKE = EMULATED && process.env.AI_FAKE === '1'
const PAYSTACK_FAKE = EMULATED && process.env.PAYSTACK_FAKE === '1'

const AI_PER_MINUTE = 10

// config/billing and config/packs override the defaults in pricing.js.
// Cached for a minute so a run doesn't wait on two extra reads.
let config = { at: 0 }
async function loadConfig() {
  if (Date.now() - config.at < 60_000) return config
  const [b, p] = await Promise.all([bdb.doc('config/billing').get(), bdb.doc('config/packs').get()])
  config = { at: Date.now(), billing: mergeBilling(b.data()), packs: p.data()?.packs ?? DEFAULT_PACKS }
  return config
}

// Credits belong to real accounts, not the anonymous ones respondents get.
function requireAccount(request) {
  requireApp(request)
  if (!request.auth || request.auth.token.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('unauthenticated', 'Sign in to use credits.')
  }
  return request.auth.uid
}

function isAdmin(token) {
  const admins = ADMIN_EMAILS.value()
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  // Verified addresses only (the emulator's test accounts never are).
  return Boolean(token?.email && (token.email_verified || EMULATED) && admins.includes(token.email.toLowerCase()))
}

// ── Wallet ──────────────────────────────────────────────────
// Called once the app knows who's signed in: makes the wallet (with the
// starter credits) the first time. The balance itself streams to the app.
export const ensureWallet = onCall({ region: REGION }, async (request) => {
  const uid = requireAccount(request)
  const { billing } = await loadConfig()
  await ensureWalletDoc(bdb, uid, billing)
  return { isAdmin: isAdmin(request.auth.token) }
})

// ── Top-ups (Paystack) ──────────────────────────────────────
// Starts a payment for a pack. The price comes from config, never the app.
// Checkout happens on Paystack's page; it returns to /credits/return.
export const createTopup = onCall({ region: REGION, secrets: [PAYSTACK_SECRET_KEY] }, async (request) => {
  const uid = requireAccount(request)
  const email = request.auth.token.email
  if (!email) throw new HttpsError('failed-precondition', 'Your account needs an email address to pay.')
  const { packs } = await loadConfig()
  const pack = packs.find((p) => p.id === request.data?.packId && p.active)
  if (!pack) throw new HttpsError('invalid-argument', 'That pack isn’t available.')

  const reference = `tp_${uid.slice(0, 6)}_${Date.now()}_${randomBytes(3).toString('hex')}`
  await bdb.doc(`payments/${reference}`).create({
    uid,
    packId: pack.id,
    packName: pack.name,
    amountKobo: pack.priceKobo,
    millicredits: pack.millicredits,
    currency: 'NGN',
    status: 'initialized',
    credited: false,
    createdAt: new Date(),
  })

  if (PAYSTACK_FAKE) {
    const origin = request.rawRequest?.headers?.origin ?? APP_URL.value()
    return { url: `${origin}/credits/return?reference=${reference}`, reference }
  }
  try {
    const tx = await paystack.initializeTransaction(PAYSTACK_SECRET_KEY.value(), {
      email,
      amountKobo: pack.priceKobo,
      reference,
      callbackUrl: `${APP_URL.value()}/credits/return`,
      metadata: { uid, packId: pack.id },
    })
    return { url: tx.authorization_url, reference }
  } catch (err) {
    logger.error('Paystack initialize failed', { reference, err: err.message })
    await bdb.doc(`payments/${reference}`).update({ status: 'failed' })
    throw new HttpsError('unavailable', 'Couldn’t start the payment. Please try again.')
  }
})

// Paystack's verified view of a payment (the emulator pretends it's paid).
async function verified(reference, payment) {
  if (PAYSTACK_FAKE) {
    return { status: 'success', amount: payment.amountKobo, currency: 'NGN', metadata: { uid: payment.uid } }
  }
  return paystack.verifyTransaction(PAYSTACK_SECRET_KEY.value(), reference)
}

// The return page asks right away, so credits show up even if the webhook
// is slow. Crediting happens once, whichever of the two gets there first.
export const verifyTopup = onCall({ region: REGION, secrets: [PAYSTACK_SECRET_KEY] }, async (request) => {
  const uid = requireAccount(request)
  const reference = String(request.data?.reference ?? '')
  const payment = reference && (await bdb.doc(`payments/${reference}`).get()).data()
  if (!payment || payment.uid !== uid) throw new HttpsError('not-found', 'Payment not found.')
  if (payment.credited) return { status: 'success', millicredits: payment.millicredits }
  let paid
  try {
    paid = await verified(reference, payment)
  } catch (err) {
    logger.warn('Paystack verify failed', { reference, err: err.message })
    return { status: 'pending' }
  }
  const result = await creditPayment(bdb, reference, paid)
  if (result.status === 'mismatch') logger.error('Payment mismatch', { reference, paid })
  return {
    status: result.status === 'success' ? 'success' : paid.status === 'success' ? 'failed' : (paid.status ?? 'pending'),
    millicredits: payment.millicredits,
  }
})

// Paystack → us: the source of truth for payments. Set this function's URL
// as the webhook URL in the Paystack dashboard (Settings → API Keys & Webhooks).
export const paystackWebhook = onRequest(
  { region: REGION, secrets: [PAYSTACK_SECRET_KEY], invoker: 'public' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).end()
      return
    }
    if (!paystack.validSignature(PAYSTACK_SECRET_KEY.value(), req.rawBody, req.get('x-paystack-signature'))) {
      res.status(401).end()
      return
    }
    const { event, data } = req.body ?? {}
    try {
      if (event === 'charge.success') {
        const reference = data?.reference
        const payment = reference && (await bdb.doc(`payments/${reference}`).get()).data()
        if (!payment) {
          // Not one of ours (the Paystack account is shared with other apps).
          logger.info('Webhook for an unknown payment', { reference })
        } else if (!payment.credited) {
          const result = await creditPayment(bdb, reference, await verified(reference, payment))
          if (result.status === 'mismatch') logger.error('Payment mismatch', { reference })
        }
      } else if (event === 'refund.processed') {
        const reference = paystack.refundReference(data)
        if (reference && (await reversePayment(bdb, reference, 'refund'))) {
          logger.info('Payment refunded', { reference })
        }
      } else {
        logger.info('Webhook ignored', { event })
      }
      res.status(200).end()
    } catch (err) {
      // Paystack retries on non-200, and crediting is idempotent.
      logger.error('Webhook failed', { event, err: err.message })
      res.status(500).end()
    }
  },
)

// ── AI runs ─────────────────────────────────────────────────
// Reserve the most it could cost → run the model → charge what it really
// used (and free the rest). Any failure frees it all: no charge.
export const aiRun = onCall(
  { region: REGION, secrets: [GEMINI_API_KEY], timeoutSeconds: 120, memory: '512MiB' },
  async (request) => {
    const uid = requireAccount(request)
    const featureId = request.data?.feature
    const feature = FEATURES[featureId]
    if (!feature) throw new HttpsError('invalid-argument', 'Unknown AI feature.')
    const tier = tierFor(featureId, request.data?.tier)

    let prepared
    try {
      prepared = feature.prepare(request.data?.input)
    } catch (err) {
      if (err instanceof InputError) throw new HttpsError('invalid-argument', err.message)
      throw err
    }

    const [{ billing }, withinLimit] = await Promise.all([
      loadConfig(),
      allow(db, `ai:${uid}`, AI_PER_MINUTE, 60_000),
    ])
    if (!withinLimit) throw new HttpsError('resource-exhausted', 'That’s a lot of AI at once. Wait a minute and try again.')
    const model = billing.tiers[tier]
    // Same estimate as the app shows (catalog.js → overheadTokens).
    const inputTokens = inputTokensFor(featureId, prepared.chars)
    const range = holdRange(billing, featureId, tier, prepared.mode, prepared.chars)

    let holdId, reserved
    try {
      ;({ holdId, reserved } = await placeHold(bdb, uid, {
        app: 'peraform',
        feature: featureId,
        model,
        amount: range.max,
        minAmount: range.min,
      }))
    } catch (err) {
      if (err instanceof BillingError) {
        throw new HttpsError('failed-precondition', 'insufficient-credits', err.details)
      }
      throw err
    }

    try {
      const run = AI_FAKE
        ? await fakeRun(featureId, request.data?.input, inputTokens)
        : await runModel({ gemini: GEMINI_API_KEY.value() }, {
            model,
            system: feature.system,
            prompt: prepared.prompt,
            schema: feature.schema,
            // Whatever the reservation pays for, up to the feature's budget.
            maxTokens: Math.min(feature.maxTokens[prepared.mode], affordableOutputTokens(billing, model, inputTokens, reserved)),
            effort: feature.effort,
          })
      const result = feature.result(run.json)
      if (!result) throw new AiError('empty')

      const usd = costUsd(billing, model, run.usage.tokensIn, run.usage.tokensOut)
      const charge = chargeFor(billing, usd)
      if (charge > reserved) logger.warn('AI run cost more than its hold', { featureId, model, charge, reserved, ...run.usage })
      const settled = await settleHold(bdb, holdId, charge, { ...run.usage, costUsd: usd, tier })
      return { result, charged: settled?.charged ?? 0, spendable: settled?.spendable ?? null }
    } catch (err) {
      await releaseHold(bdb, holdId).catch((e) => logger.error('Release failed', { holdId, err: e.message }))
      logger.warn('AI run failed, no charge', { featureId, model, err: err.message })
      const message =
        err.message === 'refused'
          ? 'The AI can’t help with that request. You weren’t charged.'
          : err.message === 'too-long'
            ? 'That was too big to finish in one go. Try something shorter. You weren’t charged.'
            : 'The AI didn’t come back with a usable answer. You weren’t charged; please try again.'
      throw new HttpsError('unavailable', message)
    }
  },
)

// Emulator stand-in for the AI. Test inputs: "FAIL" fails; "SLOW…" takes
// 2 s (so tests can overlap runs).
async function fakeRun(featureId, input, inputTokens) {
  if (input?.text === 'FAIL') throw new AiError('fake failure')
  if (input?.text?.startsWith('SLOW')) await new Promise((r) => setTimeout(r, 2000))
  return { json: FAKE_OUTPUT[featureId], usage: { tokensIn: inputTokens, tokensOut: 800 } }
}

// Frees holds left behind by a run that crashed mid-way (every 15 min).
export const releaseStaleHolds = onSchedule({ region: REGION, schedule: 'every 15 minutes' }, async () => {
  for (const hold of await sweepStaleHolds(bdb)) logger.warn('Released a stale hold', hold)
})

// ── Admin ───────────────────────────────────────────────────
// One callable for the admin page. Every change is in the ledger with the
// admin's uid.
export const billingAdmin = onCall({ region: REGION, secrets: [PAYSTACK_SECRET_KEY] }, async (request) => {
  requireAccount(request)
  if (!isAdmin(request.auth.token)) throw new HttpsError('permission-denied', 'Admins only.')
  const { action } = request.data ?? {}
  const adminUid = request.auth.uid

  if (action === 'lookup') {
    let user
    try {
      user = await getAuth().getUserByEmail(String(request.data.email ?? '').trim())
    } catch {
      throw new HttpsError('not-found', 'No account with that email.')
    }
    const [wallet, ledger, payments] = await Promise.all([
      bdb.doc(`wallets/${user.uid}`).get(),
      bdb.collection('ledger').where('uid', '==', user.uid).orderBy('createdAt', 'desc').limit(30).get(),
      bdb.collection('payments').where('uid', '==', user.uid).orderBy('createdAt', 'desc').limit(30).get(),
    ])
    return {
      uid: user.uid,
      email: user.email,
      wallet: wallet.data() ? plain(wallet.data()) : null,
      ledger: ledger.docs.map((d) => ({ id: d.id, ...plain(d.data()) })),
      payments: payments.docs.map((d) => ({ id: d.id, ...plain(d.data()) })),
    }
  }

  if (action === 'grant' || action === 'adjust') {
    const millicredits = Math.round(Number(request.data.credits) * 1000)
    const ok = Number.isFinite(millicredits) && millicredits !== 0 && Math.abs(millicredits) <= 1_000_000
    if (!ok || (action === 'grant' && millicredits < 0)) {
      throw new HttpsError('invalid-argument', 'Enter an amount between 0.001 and 1000 credits.')
    }
    try {
      const balance = await adminAdjust(bdb, {
        uid: String(request.data.uid),
        millicredits,
        type: action === 'grant' ? 'grant' : 'adjustment',
        note: String(request.data.note ?? '').slice(0, 200),
        adminUid,
      })
      logger.info('Admin credit change', { adminUid, uid: request.data.uid, millicredits })
      return { balance }
    } catch (err) {
      if (err instanceof BillingError) throw new HttpsError('not-found', err.message)
      throw err
    }
  }

  if (action === 'refund') {
    const reference = String(request.data.reference ?? '')
    const payment = (await bdb.doc(`payments/${reference}`).get()).data()
    if (!payment?.credited || payment.reversed) throw new HttpsError('failed-precondition', 'That payment can’t be refunded.')
    logger.info('Admin refund', { adminUid, reference })
    if (PAYSTACK_FAKE) {
      await reversePayment(bdb, reference, 'refund')
      return { status: 'refunded' }
    }
    try {
      await paystack.refundTransaction(PAYSTACK_SECRET_KEY.value(), reference)
    } catch (err) {
      logger.error('Paystack refund failed', { reference, err: err.message })
      throw new HttpsError('unavailable', 'Paystack refused the refund. Check the Paystack dashboard.')
    }
    // The refund.processed webhook takes the credits back once it's done.
    return { status: 'pending' }
  }

  if (action === 'report') {
    // Today (UTC): what AI cost us vs. what top-ups brought in.
    const since = new Date()
    since.setUTCHours(0, 0, 0, 0)
    const [entries, failed] = await Promise.all([
      bdb.collection('ledger').where('createdAt', '>=', since).get(),
      bdb.collection('payments').where('status', '==', 'failed').orderBy('createdAt', 'desc').limit(20).get(),
    ])
    const totals = { aiCostUsd: 0, aiRuns: 0, creditsCharged: 0, topupKobo: 0, topups: 0 }
    for (const d of entries.docs) {
      const e = d.data()
      if (e.type === 'charge') {
        totals.aiRuns += 1
        totals.aiCostUsd += e.costUsd ?? 0
        totals.creditsCharged += -e.millicredits
      } else if (e.type === 'topup') {
        totals.topups += 1
        totals.topupKobo += e.amountKobo ?? 0
      }
    }
    const { billing } = await loadConfig()
    return {
      totals,
      fxNgnPerUsd: billing.fxNgnPerUsd,
      failed: failed.docs.map((d) => ({ id: d.id, ...plain(d.data()) })),
    }
  }

  throw new HttpsError('invalid-argument', 'Unknown action.')
})

// Timestamps → milliseconds, so they survive the trip to the browser.
function plain(data) {
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, typeof v?.toMillis === 'function' ? v.toMillis() : v]),
  )
}
