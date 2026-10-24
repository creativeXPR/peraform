// Credits, end to end on the emulators (the AI and Paystack faked by
// functions/.env.local). Run from peraform/:
//   firebase emulators:exec --only auth,firestore,functions --project quality-toolsx \
//     "node --test functions/test/billing.emulator.test.mjs"
// Ports follow firebase.json; set PORT_OFFSET when running on shifted ports.
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { after, before, describe, it } from 'node:test'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { holdRange } from '../ai/catalog.js'
import { DEFAULT_BILLING } from '../billing/pricing.js'
import { placeHold, releaseHold, settleHold, sweepStaleHolds } from '../billing/wallet.js'

const OFFSET = Number(process.env.PORT_OFFSET || 0)
const PROJECT = 'quality-toolsx'
const FIRESTORE = `127.0.0.1:${8080 + OFFSET}`
const AUTH = `http://127.0.0.1:${9099 + OFFSET}`
const FUNCTIONS = `http://127.0.0.1:${5001 + OFFSET}/${PROJECT}/europe-west1`
const SECRET = 'sk_test_emulator' // functions/.secret.local

process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE
initializeApp({ projectId: PROJECT })
const bdb = getFirestore('billing')

async function signUp(email) {
  const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'secret123', returnSecureToken: true }),
  })
  const json = await res.json()
  return { uid: json.localId, token: json.idToken }
}

async function call(name, user, data = {}) {
  const res = await fetch(`${FUNCTIONS}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
    body: JSON.stringify({ data }),
  })
  const json = await res.json()
  if (json.error) {
    const err = new Error(json.error.message)
    err.status = json.error.status
    err.details = json.error.details
    throw err
  }
  return json.result
}

// Reads straight from the emulator's REST API with the user's token, so
// the billing database's security rules apply.
async function readAs(user, path) {
  const res = await fetch(`http://${FIRESTORE}/v1/projects/${PROJECT}/databases/billing/documents/${path}`, {
    headers: { Authorization: `Bearer ${user.token}` },
  })
  return res.status
}
async function writeAs(user, path) {
  const res = await fetch(`http://${FIRESTORE}/v1/projects/${PROJECT}/databases/billing/documents/${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { balance: { integerValue: '999999' } } }),
  })
  return res.status
}

const wallet = async (uid) => (await bdb.doc(`wallets/${uid}`).get()).data()
const ledger = async (uid) => (await bdb.collection('ledger').where('uid', '==', uid).get()).docs.map((d) => d.data())

function webhook(body, signature) {
  const raw = JSON.stringify(body)
  return fetch(`${FUNCTIONS}/paystackWebhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-paystack-signature': signature ?? createHmac('sha512', SECRET).update(raw).digest('hex'),
    },
    body: raw,
  })
}

let alice
let bob
before(async () => {
  const stamp = Date.now()
  ;[alice, bob] = await Promise.all([signUp(`alice${stamp}@example.com`), signUp(`bob${stamp}@example.com`)])
  // Warm the functions up first: on a slow machine, several calls landing
  // on a cold emulator at once can get "socket hang up".
  const warm = await signUp(`warm${stamp}@example.com`)
  await call('ensureWallet', warm)
  await call('verifyTopup', warm, { reference: 'none' }).catch(() => {})
  await webhook({ event: 'warm-up' }, 'bad')
})
after(() => setTimeout(() => process.exit(0), 100))

describe('wallet', () => {
  it('gives the starter credits exactly once', async () => {
    await Promise.all([call('ensureWallet', alice), call('ensureWallet', alice), call('ensureWallet', alice)])
    assert.equal((await wallet(alice.uid)).balance, 10000)
    assert.equal((await ledger(alice.uid)).filter((e) => e.type === 'starter').length, 1)
  })

  it('lets people read only their own wallet, and write none', async () => {
    // The emulator takes one rules file, and firebase.json gives it
    // PeraForm's, so load the billing rules here.
    const content = readFileSync(new URL('../../firestore.billing.rules', import.meta.url), 'utf8')
    const loaded = await fetch(`http://${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/billing:securityRules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: { files: [{ name: 'firestore.billing.rules', content }] } }),
    })
    assert.equal(loaded.status, 200, await loaded.text())
    await call('ensureWallet', bob)
    assert.equal(await readAs(alice, `wallets/${alice.uid}`), 200)
    assert.equal(await readAs(alice, `wallets/${bob.uid}`), 403)
    assert.equal(await writeAs(alice, `wallets/${alice.uid}`), 403)
    assert.equal(await readAs(alice, 'holds/anything'), 403)
  })
})

describe('top-ups', () => {
  it('credits a payment once, with the webhook and the return page racing', async () => {
    const { reference } = await call('createTopup', alice, { packId: 'standard' })
    const before = (await wallet(alice.uid)).balance
    const event = { event: 'charge.success', data: { reference } }
    const results = await Promise.all([
      webhook(event),
      webhook(event),
      call('verifyTopup', alice, { reference }),
      call('verifyTopup', alice, { reference }),
    ])
    assert.equal(results[0].status, 200)
    assert.equal((await wallet(alice.uid)).balance, before + 110000)
    assert.equal((await ledger(alice.uid)).filter((e) => e.type === 'topup' && e.ref === reference).length, 1)
    const payment = (await bdb.doc(`payments/${reference}`).get()).data()
    assert.equal(payment.credited, true)
    assert.equal(payment.amountKobo, 250000)
  })

  it('refuses a wrongly signed webhook', async () => {
    const res = await webhook({ event: 'charge.success', data: { reference: 'tp_x' } }, 'bad')
    assert.equal(res.status, 401)
  })

  it('ignores payments that aren’t ours', async () => {
    const res = await webhook({ event: 'charge.success', data: { reference: 'someone-else' } })
    assert.equal(res.status, 200)
  })

  it('won’t let anyone verify someone else’s payment, or pick a price', async () => {
    const { reference } = await call('createTopup', alice, { packId: 'starter' })
    await assert.rejects(call('verifyTopup', bob, { reference }), /not found/i)
    await assert.rejects(call('createTopup', alice, { packId: 'free' }), /isn’t available/)
  })
})

describe('AI runs', () => {
  const input = { mode: 'describe', text: 'A feedback form for a bakery' }
  // The fake AI takes 2 s over this one, so parallel runs really overlap.
  const slow = { mode: 'describe', text: 'SLOW: a feedback form for a bakery' }

  it('reserves, then charges only what was used', async () => {
    const before = await wallet(bob.uid)
    const res = await call('aiRun', bob, { feature: 'generate-form', tier: 'standard', input })
    assert.equal(res.result.form.title, 'Team lunch')
    const after = await wallet(bob.uid)
    assert.equal(after.held, 0)
    assert.equal(before.balance - after.balance, res.charged)
    const charge = (await ledger(bob.uid)).find((e) => e.type === 'charge')
    assert.equal(charge.millicredits, -res.charged)
    assert.equal(charge.model, DEFAULT_BILLING.tiers.standard)
    assert.equal(charge.tokensOut, 800)
    // tokensIn × in-price + 800 × out-price, ×1700 ×100 ×2.5 / 2000 ×1000, rounded up.
    const price = DEFAULT_BILLING.models[DEFAULT_BILLING.tiers.standard]
    const usd = (charge.tokensIn / 1e6) * price.inUsdPerM + (800 / 1e6) * price.outUsdPerM
    assert.equal(res.charged, Math.ceil(usd * 1700 * 100 * 2.5 / 2000 * 1000 - 1e-9))
  })

  it('charges nothing when the AI fails', async () => {
    const before = await wallet(bob.uid)
    await assert.rejects(
      call('aiRun', bob, { feature: 'generate-form', tier: 'quick', input: { text: 'FAIL' } }),
      /weren’t charged/,
    )
    const after = await wallet(bob.uid)
    assert.equal(after.balance, before.balance)
    assert.equal(after.held, 0)
  })

  it('refuses when the balance can’t cover the most it could cost', async () => {
    await bdb.doc(`wallets/${bob.uid}`).update({ balance: 500 })
    await assert.rejects(
      call('aiRun', bob, { feature: 'generate-form', tier: 'best', input }),
      (err) => err.message === 'insufficient-credits' && err.details.needed > 500,
    )
  })

  it('reserves what’s spare (down to the minimum) when that’s less than the full budget', async () => {
    const range = holdRange(DEFAULT_BILLING, 'generate-form', 'standard', 'describe', input.text.length)
    await bdb.doc(`wallets/${bob.uid}`).update({ balance: range.min + 100, held: 0 })
    const res = await call('aiRun', bob, { feature: 'generate-form', tier: 'standard', input })
    assert.ok(res.charged <= range.min + 100)
    assert.equal((await wallet(bob.uid)).held, 0)
  })

  it('never overspends with runs in parallel', async () => {
    // The functions emulator queues requests, so overlap the reservations
    // themselves: room for exactly two of five.
    await bdb.doc(`wallets/${bob.uid}`).update({ balance: 5000, held: 0 })
    const tries = await Promise.allSettled(
      [1, 2, 3, 4, 5].map(() =>
        placeHold(bdb, bob.uid, { app: 'test', feature: 'generate-form', model: DEFAULT_BILLING.tiers.quick, amount: 2000 }),
      ),
    )
    const held = tries.filter((t) => t.status === 'fulfilled').map((t) => t.value)
    assert.equal(held.length, 2)
    assert.equal((await wallet(bob.uid)).held, 4000)
    await Promise.all(held.map((h) => releaseHold(bdb, h.holdId)))
    assert.equal((await wallet(bob.uid)).held, 0)
  })

  it('a slow run still settles cleanly', async () => {
    await bdb.doc(`wallets/${bob.uid}`).update({ balance: 20000, held: 0 })
    const res = await call('aiRun', bob, { feature: 'generate-form', tier: 'standard', input: slow })
    assert.ok(res.charged > 0)
    assert.equal((await wallet(bob.uid)).held, 0)
  })

  it('releases holds left behind by a crashed run', async () => {
    await bdb.doc(`wallets/${bob.uid}`).update({ balance: 5000, held: 0 })
    const { holdId } = await placeHold(bdb, bob.uid, { app: 'test', feature: 'generate-form', model: DEFAULT_BILLING.tiers.quick, amount: 1000 })
    await bdb.doc(`holds/${holdId}`).update({ createdAt: new Date(Date.now() - 11 * 60_000) })
    await sweepStaleHolds(bdb)
    assert.equal((await bdb.doc(`holds/${holdId}`).get()).data().status, 'released')
    assert.equal((await wallet(bob.uid)).held, 0)
    // Settling after the sweep still charges (the work was done), once.
    await settleHold(bdb, holdId, 300, {})
    await settleHold(bdb, holdId, 300, {})
    assert.equal((await wallet(bob.uid)).balance, 4700)
  })

  it('refuses anonymous accounts and unknown features', async () => {
    const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
    })
    const anon = { token: (await res.json()).idToken }
    await assert.rejects(call('aiRun', anon, { feature: 'generate-form', input }), /Sign in/)
    await assert.rejects(call('aiRun', alice, { feature: 'write-my-essay', input }), /Unknown/)
  })
})

describe('admin', () => {
  it('is for admins only', async () => {
    await assert.rejects(call('billingAdmin', alice, { action: 'report' }), /Admins only/)
  })

  it('grants, adjusts and refunds, all in the ledger', async () => {
    const admin = await signUp(`qualitytoolsx+${Date.now()}@gmail.com`)
    // Not on the list (exact match only).
    await assert.rejects(call('billingAdmin', admin, { action: 'report' }), /Admins only/)

    // The real admin address, in the emulator's own user list.
    const real = await signUp('qualitytoolsx@gmail.com').catch(() => null)
    const me = real?.token
      ? real
      : await (async () => {
          const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'qualitytoolsx@gmail.com', password: 'secret123', returnSecureToken: true }),
          })
          const j = await r.json()
          return { uid: j.localId, token: j.idToken }
        })()
    assert.equal((await call('ensureWallet', me)).isAdmin, true)

    const before = (await wallet(alice.uid)).balance
    await call('billingAdmin', me, { action: 'grant', uid: alice.uid, credits: 5, note: 'Sorry for the wait' })
    await call('billingAdmin', me, { action: 'adjust', uid: alice.uid, credits: -2 })
    assert.equal((await wallet(alice.uid)).balance, before + 3000)

    const found = await call('billingAdmin', me, { action: 'lookup', email: (await getEmail(alice.uid)) })
    const paid = found.payments.find((p) => p.credited)
    await call('billingAdmin', me, { action: 'refund', reference: paid.id })
    assert.equal((await wallet(alice.uid)).balance, before + 3000 - paid.millicredits)
    const types = (await ledger(alice.uid)).map((e) => e.type)
    for (const t of ['grant', 'adjustment', 'refund']) assert.ok(types.includes(t), t)
    // A second refund of the same payment is refused.
    await assert.rejects(call('billingAdmin', me, { action: 'refund', reference: paid.id }), /can’t be refunded/)

    const report = await call('billingAdmin', me, { action: 'report' })
    assert.ok(report.totals.aiRuns >= 1)
    assert.ok(report.totals.topupKobo >= 250000)
  })
})

async function getEmail(uid) {
  const { getAuth } = await import('firebase-admin/auth')
  process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH.replace('http://', '')
  return (await getAuth().getUser(uid)).email
}
