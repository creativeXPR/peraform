import { FieldValue } from 'firebase-admin/firestore'

// Every change to a balance happens here, inside one transaction, with a
// ledger entry written alongside it. `bdb` is the suite-wide billing
// database (one wallet per Quality Tools account, whichever app spends it).
//
//   wallets/{uid}     { balance, held, lifetimeTopupKobo }      (millicredits)
//   ledger/{id}       { uid, type, millicredits (signed), balanceAfter, ref, … }
//   holds/{id}        { uid, app, feature, model, heldMillicredits, status }
//   payments/{ref}    { uid, packId, amountKobo, millicredits, status, credited }

export class BillingError extends Error {
  constructor(code, message, details) {
    super(message)
    this.code = code
    this.details = details
  }
}

function ledgerEntry(tx, bdb, entry) {
  tx.create(bdb.collection('ledger').doc(), { ...entry, createdAt: FieldValue.serverTimestamp() })
}

// Creates the wallet (with the starter credits) the first time; returns it.
// Safe to call any number of times.
export async function ensureWallet(bdb, uid, billing) {
  const ref = bdb.doc(`wallets/${uid}`)
  return bdb.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (snap.exists) return snap.data()
    const starter = billing.starterMillicredits
    const wallet = { balance: starter, held: 0, lifetimeTopupKobo: 0 }
    tx.create(ref, {
      ...wallet,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    if (starter > 0) {
      ledgerEntry(tx, bdb, {
        uid,
        type: 'starter',
        millicredits: starter,
        balanceAfter: starter,
        ref: 'starter',
        note: 'Welcome credits',
      })
    }
    return wallet
  })
}

// Reserves up to `amount` before an AI run: all of it, or whatever is
// spendable if that's less but still at least `minAmount`. Returns the
// hold id and how much was reserved. Throws insufficient-credits (with how
// much is needed) below the minimum.
export async function placeHold(bdb, uid, { app, feature, model, amount, minAmount = amount }) {
  const walletRef = bdb.doc(`wallets/${uid}`)
  const holdRef = bdb.collection('holds').doc()
  const reserved = await bdb.runTransaction(async (tx) => {
    const wallet = (await tx.get(walletRef)).data()
    const spendable = wallet ? wallet.balance - wallet.held : 0
    if (!wallet || wallet.balance < 0 || spendable < minAmount) {
      throw new BillingError('insufficient-credits', 'Not enough credits.', {
        needed: minAmount,
        spendable: Math.max(spendable, 0),
      })
    }
    const hold = Math.min(amount, spendable)
    tx.update(walletRef, {
      held: FieldValue.increment(hold),
      updatedAt: FieldValue.serverTimestamp(),
    })
    tx.create(holdRef, {
      uid,
      app,
      feature,
      model,
      heldMillicredits: hold,
      status: 'held',
      createdAt: FieldValue.serverTimestamp(),
    })
    return hold
  })
  return { holdId: holdRef.id, reserved }
}

// Charges the real cost (never more than the hold) and frees the rest.
// If the stale-hold sweeper already released it, the reservation is gone
// but the work was done, so the charge still applies to the balance.
export async function settleHold(bdb, holdId, charge, usage) {
  const holdRef = bdb.doc(`holds/${holdId}`)
  return bdb.runTransaction(async (tx) => {
    const hold = (await tx.get(holdRef)).data()
    if (!hold || hold.status === 'settled') return null
    const walletRef = bdb.doc(`wallets/${hold.uid}`)
    const wallet = (await tx.get(walletRef)).data()
    const amount = Math.min(charge, hold.heldMillicredits)
    const stillHeld = hold.status === 'held'
    const balanceAfter = wallet.balance - amount
    const heldAfter = stillHeld ? wallet.held - hold.heldMillicredits : wallet.held
    tx.update(walletRef, {
      balance: balanceAfter,
      held: heldAfter,
      updatedAt: FieldValue.serverTimestamp(),
    })
    tx.update(holdRef, { status: 'settled', chargedMillicredits: amount, settledAt: FieldValue.serverTimestamp() })
    ledgerEntry(tx, bdb, {
      uid: hold.uid,
      type: 'charge',
      millicredits: -amount,
      balanceAfter,
      ref: holdId,
      app: hold.app,
      feature: hold.feature,
      model: hold.model,
      ...usage,
    })
    return { charged: amount, spendable: balanceAfter - heldAfter }
  })
}

// Gives the whole reservation back (the run failed, or was abandoned).
export async function releaseHold(bdb, holdId, reason = 'failed') {
  const holdRef = bdb.doc(`holds/${holdId}`)
  return bdb.runTransaction(async (tx) => {
    const hold = (await tx.get(holdRef)).data()
    if (!hold || hold.status !== 'held') return false
    tx.update(bdb.doc(`wallets/${hold.uid}`), {
      held: FieldValue.increment(-hold.heldMillicredits),
      updatedAt: FieldValue.serverTimestamp(),
    })
    tx.update(holdRef, { status: 'released', reason, settledAt: FieldValue.serverTimestamp() })
    return true
  })
}

// Frees holds older than 10 minutes (a run that crashed mid-way never
// settled or released them). Returns what it released.
export async function sweepStaleHolds(bdb, maxAgeMs = 10 * 60_000) {
  const cutoff = Date.now() - maxAgeMs
  // Only a handful are ever "held" at once; filter by age here (no index).
  const held = await bdb.collection('holds').where('status', '==', 'held').limit(500).get()
  const released = []
  for (const doc of held.docs.filter((d) => d.data().createdAt?.toMillis() < cutoff)) {
    if (await releaseHold(bdb, doc.id, 'stale')) released.push({ holdId: doc.id, uid: doc.data().uid })
  }
  return released
}

// Credits a successful payment exactly once, however many times it's
// called (webhook retries, the return page racing the webhook). `paid` is
// Paystack's verified transaction.
export async function creditPayment(bdb, reference, paid) {
  const payRef = bdb.doc(`payments/${reference}`)
  return bdb.runTransaction(async (tx) => {
    const payment = (await tx.get(payRef)).data()
    if (!payment) return { status: 'unknown' }
    if (payment.credited) return { status: 'success', credited: false, payment }
    const walletRef = bdb.doc(`wallets/${payment.uid}`)
    const wallet = (await tx.get(walletRef)).data()

    if (paid.status !== 'success') {
      const status = ['failed', 'abandoned', 'reversed'].includes(paid.status) ? 'failed' : payment.status
      if (status !== payment.status) tx.update(payRef, { status, updatedAt: FieldValue.serverTimestamp() })
      return { status, credited: false, payment }
    }
    const matches =
      paid.currency === 'NGN' &&
      Number(paid.amount) === payment.amountKobo &&
      (!paid.metadata?.uid || paid.metadata.uid === payment.uid)
    if (!matches) {
      tx.update(payRef, { status: 'failed', mismatch: true, updatedAt: FieldValue.serverTimestamp() })
      return { status: 'mismatch', credited: false, payment }
    }

    const balanceAfter = (wallet?.balance ?? 0) + payment.millicredits
    tx.set(
      walletRef,
      {
        balance: balanceAfter,
        held: wallet?.held ?? 0,
        lifetimeTopupKobo: (wallet?.lifetimeTopupKobo ?? 0) + payment.amountKobo,
        updatedAt: FieldValue.serverTimestamp(),
        ...(wallet ? {} : { createdAt: FieldValue.serverTimestamp() }),
      },
      { merge: true },
    )
    tx.update(payRef, {
      status: 'success',
      credited: true,
      paystackId: paid.id ?? null,
      channel: paid.channel ?? null,
      paidAt: paid.paid_at ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    })
    ledgerEntry(tx, bdb, {
      uid: payment.uid,
      type: 'topup',
      millicredits: payment.millicredits,
      balanceAfter,
      ref: reference,
      amountKobo: payment.amountKobo,
      note: `${payment.packName ?? payment.packId} pack`,
    })
    return { status: 'success', credited: true, payment, balance: balanceAfter }
  })
}

// A refunded or charged-back payment takes its credits back, even if that
// makes the balance negative (AI use is blocked until it's positive again).
export async function reversePayment(bdb, reference, type = 'refund') {
  const payRef = bdb.doc(`payments/${reference}`)
  return bdb.runTransaction(async (tx) => {
    const payment = (await tx.get(payRef)).data()
    if (!payment || !payment.credited || payment.reversed) return false
    const walletRef = bdb.doc(`wallets/${payment.uid}`)
    const wallet = (await tx.get(walletRef)).data()
    const balanceAfter = (wallet?.balance ?? 0) - payment.millicredits
    tx.update(walletRef, { balance: balanceAfter, updatedAt: FieldValue.serverTimestamp() })
    tx.update(payRef, { reversed: type, status: 'refunded', updatedAt: FieldValue.serverTimestamp() })
    ledgerEntry(tx, bdb, {
      uid: payment.uid,
      type,
      millicredits: -payment.millicredits,
      balanceAfter,
      ref: reference,
      amountKobo: payment.amountKobo,
    })
    return true
  })
}

// Admin grant (+) or adjustment (±). The admin's uid goes in the ledger.
export async function adminAdjust(bdb, { uid, millicredits, type, note, adminUid }) {
  const walletRef = bdb.doc(`wallets/${uid}`)
  return bdb.runTransaction(async (tx) => {
    const wallet = (await tx.get(walletRef)).data()
    if (!wallet) throw new BillingError('not-found', 'That account has no wallet yet.')
    const balanceAfter = wallet.balance + millicredits
    tx.update(walletRef, { balance: balanceAfter, updatedAt: FieldValue.serverTimestamp() })
    ledgerEntry(tx, bdb, {
      uid,
      type,
      millicredits,
      balanceAfter,
      ref: `admin:${adminUid}`,
      note: note || null,
    })
    return balanceAfter
  })
}
