import { getAuth } from 'firebase-admin/auth'
import { FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { logger } from 'firebase-functions'
import { defineSecret, defineString } from 'firebase-functions/params'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { onObjectFinalized } from 'firebase-functions/v2/storage'
import { isAllowedResponder } from './access.js'
import { REGION, billingDb, db, lagosDay, requireApp } from './app.js'
import { MARK, compressBuffer, compressionFor } from './compress.js'
import { gradeResponse } from './grade.js'
import { responseTable } from './responseTable.js'
import { accessToken, appendRow, createSpreadsheet, exchangeCode, revoke, writeAll } from './sheets.js'
import { APP_URL, SMTP_PASS, emailHtml, sendMail } from './mail.js'
import { allow, clientIp } from './rateLimit.js'
import { checkSubmission, sanitizeAnswers } from './submit.js'

// Credits and AI (billing/, ai/).
export * from './billing/functions.js'

// PeraForm's storage bucket; file-upload answers must point into it.
const UPLOAD_BUCKET = defineString('UPLOAD_BUCKET', { default: 'quality-toolsx-peraform' })
// Real Cloud Storage, plus the Storage emulator only when running under it.
const STORAGE_ORIGINS = [
  'https://firebasestorage.googleapis.com',
  ...(process.env.FIREBASE_STORAGE_EMULATOR_HOST
    ? [`http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`]
    : []),
]

// Per-form limits on submissions: generous per IP (a classroom shares one),
// tight per respondent session.
const PER_IP = { limit: 60, windowMs: 60_000 }
const PER_USER = { limit: 5, windowMs: 60_000 }

// ── Submissions ─────────────────────────────────────────────
// The only way a response gets written: Firestore rules refuse direct
// writes, so every submission passes App Check (when on), rate limits,
// answer cleaning and the form's own rules here.
export const submitResponse = onCall({ region: REGION }, async (request) => {
  requireApp(request)
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to respond.')
  const uid = request.auth.uid
  const { formId, answers } = request.data ?? {}
  if (typeof formId !== 'string' || !formId) throw new HttpsError('invalid-argument', 'No form.')

  const ip = clientIp(request.rawRequest)
  const [ipOk, userOk] = await Promise.all([
    allow(db, `ip:${ip}:${formId}`, PER_IP.limit, PER_IP.windowMs),
    allow(db, `uid:${uid}:${formId}`, PER_USER.limit, PER_USER.windowMs),
  ])
  if (!ipOk || !userOk) {
    throw new HttpsError('resource-exhausted', 'Too many submissions. Wait a minute and try again.')
  }

  const form = (await db.doc(`forms/${formId}`).get()).data()
  const timed = form?.settings?.quiz?.enabled && form.settings.quiz.timeLimit > 0
  const restricted = Boolean(form?.settings?.restricted)
  const [start, access] = await Promise.all([
    timed ? db.doc(`forms/${formId}/starts/${uid}`).get().then((s) => s.data()) : null,
    restricted ? db.doc(`forms/${formId}/private/access`).get().then((s) => s.data()) : null,
  ])
  const clean = form
    ? sanitizeAnswers(form, answers, {
        formId,
        uid,
        bucket: UPLOAD_BUCKET.value(),
        storageOrigins: STORAGE_ORIGINS,
      })
    : {}
  const problem = checkSubmission({
    form,
    signInProvider: request.auth.token.firebase?.sign_in_provider,
    startedAt: start?.startedAt?.toMillis(),
    now: Date.now(),
    answersBytes: JSON.stringify(answers ?? {}).length,
    email: request.auth.token.email,
    emailVerified: request.auth.token.email_verified === true,
    access,
    isMember: Boolean(form?.memberIds?.includes(uid)),
  })
  if (problem) throw new HttpsError(problem.code, problem.message)

  const responses = db.collection(`forms/${formId}/responses`)
  // One-per-person: the response id is the respondent's uid, so create()
  // fails if they've already answered.
  const ref = form.settings?.limitOneResponse ? responses.doc(uid) : responses.doc()
  try {
    await ref.create({
      respondentId: uid,
      answers: clean,
      submittedAt: FieldValue.serverTimestamp(),
      // From the sign-in token, so respondents can't type someone else's,
      // and only when they agreed to share it (the switch at the top of
      // the form): their consent, even when the form asks for emails.
      ...((form.settings?.collectEmails || restricted) &&
        request.data?.shareEmail === true && {
        respondentEmail: request.auth.token.email ?? '',
      }),
    })
  } catch (err) {
    if (err.code === 6) throw new HttpsError('already-exists', 'You’ve already responded.')
    throw err
  }
  return { responseId: ref.id }
})

// ── Invited-only forms: why can't I open it? ─────────────────
// Firestore rules hide an invited-only form from everyone not on its list,
// so a respondent's direct read just fails. This says why, without
// revealing the list: sign in, verify your email, or you're not invited.
// state: 'missing' | 'signin' | 'verify' | 'denied' | 'allowed'
export const formGate = onCall({ region: REGION }, async (request) => {
  requireApp(request)
  const { formId } = request.data ?? {}
  if (typeof formId !== 'string' || !formId) throw new HttpsError('invalid-argument', 'No form.')
  const form = (await db.doc(`forms/${formId}`).get()).data()
  if (!form || !['published', 'closed'].includes(form.status) || !form.settings?.restricted) {
    return { state: 'missing' }
  }
  const title = form.title || 'Untitled form'
  const token = request.auth?.token
  if (!token?.email || token.firebase?.sign_in_provider === 'anonymous') {
    return { state: 'signin', title }
  }
  if (token.email_verified !== true) return { state: 'verify', title, email: token.email }
  const access = (await db.doc(`forms/${formId}/private/access`).get()).data()
  return { state: isAllowedResponder(access, token.email) ? 'allowed' : 'denied', title, email: token.email }
})

// ── Google Sheets ───────────────────────────────────────────
// The OAuth client (Google Cloud console → Credentials). The id is public;
// the secret lives in Secret Manager.
const GOOGLE_OAUTH_CLIENT_ID = defineString('GOOGLE_OAUTH_CLIENT_ID', { default: '' })
const GOOGLE_OAUTH_CLIENT_SECRET = defineSecret('GOOGLE_OAUTH_CLIENT_SECRET')
const oauth = () => ({ clientId: GOOGLE_OAUTH_CLIENT_ID.value(), clientSecret: GOOGLE_OAUTH_CLIENT_SECRET.value() })

// sheetLinks/{formId} = { refreshToken, spreadsheetId, uid, header } — the
// Google key; no Firestore rule opens it, so only functions can read it.
// forms/{formId}/private/sheets = { spreadsheetId, url, email, linkedAt,
// syncedAt, error } — what the form's members see in Settings.
const linkRef = (formId) => db.doc(`sheetLinks/${formId}`)
const statusRef = (formId) => db.doc(`forms/${formId}/private/sheets`)

async function allResponses(formId) {
  const snap = await db.collection(`forms/${formId}/responses`).orderBy('submittedAt', 'desc').get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

const wantsEmail = (form, link) =>
  Boolean(form.settings?.collectEmails || form.settings?.restricted || link?.header?.includes('Email address'))

// Rewrites the whole sheet from the responses (link, re-sync).
async function syncSheet(formId, form, link, token) {
  const responses = await allResponses(formId)
  const table = responseTable(form.questions ?? [], responses, { withEmail: wantsEmail(form, link) || undefined })
  await writeAll(fetch, token, link.spreadsheetId, table)
  return table
}

async function appendToSheet(formId, form, response) {
  const snap = await linkRef(formId).get()
  if (!snap.exists) return
  const link = snap.data()
  try {
    const token = await accessToken(fetch, { refreshToken: link.refreshToken, ...oauth() })
    const { header, rowFor } = responseTable(form.questions ?? [], [response], { withEmail: wantsEmail(form, link) })
    await appendRow(fetch, token, link.spreadsheetId, { header, row: rowFor(response), previousHeader: link.header })
    await Promise.all([
      linkRef(formId).update({ header }),
      statusRef(formId).set({ syncedAt: FieldValue.serverTimestamp(), error: null }, { merge: true }),
    ])
  } catch (err) {
    const error = err.revoked
      ? 'Google access was removed. Link the sheet again to keep it updated.'
      : 'The last response couldn’t be added to the sheet. Use Re-sync to catch up.'
    await statusRef(formId).set({ error }, { merge: true })
    throw err
  }
}

// action: 'link' (with the popup's code) | 'resync' | 'unlink'
export const sheetsLink = onCall({ region: REGION, secrets: [GOOGLE_OAUTH_CLIENT_SECRET] }, async (request) => {
  requireApp(request)
  if (!request.auth || request.auth.token.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('unauthenticated', 'Sign in first.')
  }
  const { action, formId, code } = request.data ?? {}
  if (typeof formId !== 'string') throw new HttpsError('invalid-argument', 'No form.')
  if (!GOOGLE_OAUTH_CLIENT_ID.value()) {
    throw new HttpsError('failed-precondition', 'Google Sheets isn’t set up for PeraForm yet.')
  }
  const { form } = await memberForm(formId, request.auth.uid)
  const title = form.title || 'Untitled form'

  try {
    if (action === 'link') {
      if (typeof code !== 'string' || !code) throw new HttpsError('invalid-argument', 'No approval code.')
      const tokens = await exchangeCode(fetch, { code, ...oauth() })
      if (!tokens.refresh_token) {
        throw new HttpsError('failed-precondition', 'Google didn’t grant lasting access. Please try again.')
      }
      const sheet = await createSpreadsheet(fetch, tokens.access_token, `${title} (Responses)`)
      const link = { refreshToken: tokens.refresh_token, spreadsheetId: sheet.spreadsheetId, uid: request.auth.uid }
      const table = await syncSheet(formId, form, link, tokens.access_token)
      // Replacing an earlier link: let go of its key.
      const old = (await linkRef(formId).get()).data()
      if (old?.refreshToken) await revoke(fetch, old.refreshToken)
      await linkRef(formId).set({ ...link, header: table.header })
      await statusRef(formId).set({
        spreadsheetId: sheet.spreadsheetId,
        url: sheet.url,
        email: request.auth.token.email ?? '',
        linkedAt: FieldValue.serverTimestamp(),
        syncedAt: FieldValue.serverTimestamp(),
        error: null,
      })
      return { url: sheet.url, rows: table.rows.length }
    }

    const link = (await linkRef(formId).get()).data()
    if (action === 'resync') {
      if (!link) throw new HttpsError('failed-precondition', 'This form isn’t linked to a sheet.')
      const token = await accessToken(fetch, { refreshToken: link.refreshToken, ...oauth() })
      const table = await syncSheet(formId, form, link, token)
      await linkRef(formId).update({ header: table.header })
      await statusRef(formId).set({ syncedAt: FieldValue.serverTimestamp(), error: null }, { merge: true })
      return { rows: table.rows.length }
    }

    if (action === 'unlink') {
      if (link?.refreshToken) await revoke(fetch, link.refreshToken)
      await Promise.all([linkRef(formId).delete(), statusRef(formId).delete()])
      return { status: 'unlinked' }
    }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    logger.error('Sheets link failed', { formId, action, err: err.message })
    if (err.revoked) {
      await statusRef(formId).set({ error: 'Google access was removed. Link the sheet again.' }, { merge: true })
      throw new HttpsError('failed-precondition', 'Google access was removed. Link the sheet again.')
    }
    throw new HttpsError('unavailable', 'Google Sheets didn’t respond. Please try again.')
  }
  throw new HttpsError('invalid-argument', 'Unknown action.')
})

// activity/{day}.responses and activity/{day}/owners/{ownerUid}.responses
// (billing DB, read by the admin page), once per trigger event.
async function countResponse(eventId, ownerId) {
  const day = lagosDay()
  const inc = { responses: FieldValue.increment(1) }
  await billingDb.runTransaction(async (tx) => {
    const seen = billingDb.doc(`activity/${day}/events/${eventId}`)
    if ((await tx.get(seen)).exists) return
    tx.create(seen, { at: FieldValue.serverTimestamp() })
    tx.set(billingDb.doc(`activity/${day}`), inc, { merge: true })
    if (ownerId) tx.set(billingDb.doc(`activity/${day}/owners/${ownerId}`), inc, { merge: true })
  })
}

// ── After each response: grade quizzes, notify subscribers ─────
export const onResponseCreated = onDocumentCreated(
  {
    document: 'forms/{formId}/responses/{responseId}',
    database: 'peraform',
    region: REGION,
    secrets: [SMTP_PASS, GOOGLE_OAUTH_CLIENT_SECRET],
  },
  async (event) => {
    const { formId } = event.params
    const form = (await db.doc(`forms/${formId}`).get()).data()
    if (!form) return

    // Admin page: responses per day, and per form owner. Event ids make a
    // retried event count once.
    await countResponse(event.id, form.ownerId).catch((err) =>
      logger.warn('Response count failed', { formId, err: err.message }),
    )

    // Linked Google Sheet: add this response as a row (never blocks grading
    // or emails — problems are shown to the owner in Settings instead).
    await appendToSheet(formId, form, { id: event.params.responseId, ...event.data.data() }).catch((err) =>
      logger.error('Sheets append failed', { formId, err: err.message }),
    )

    if (form.settings?.quiz?.enabled) {
      const key = (await db.doc(`forms/${formId}/private/answerKey`).get()).data()
      const graded = gradeResponse(form, key, event.data.data().answers)
      await event.data.ref.update({
        ...graded,
        released: form.settings.quiz.release !== 'manual',
        gradedAt: FieldValue.serverTimestamp(),
      })
    }

    // Only members still on the form get emails.
    const uids = (form.notify ?? []).filter((uid) => form.memberIds.includes(uid))
    if (!uids.length) return
    const [{ users }, countSnap] = await Promise.all([
      getAuth().getUsers(uids.map((uid) => ({ uid }))),
      db.collection(`forms/${formId}/responses`).count().get(),
    ])
    const to = users.map((u) => u.email).filter(Boolean)
    if (!to.length) return
    const title = form.title || 'Untitled form'
    const count = countSnap.data().count
    const href = `${APP_URL.value()}/forms/${formId}/responses`
    const body = `Someone just responded to “${title}”. It now has ${count} ${count === 1 ? 'response' : 'responses'}.`
    try {
      await sendMail({
        to: to.join(','),
        subject: `New response: ${title}`,
        text: `${body}\n\nView responses: ${href}`,
        html: emailHtml({
          heading: 'New response',
          body,
          cta: 'View responses',
          href,
          footer: 'You get these because notifications are on for this form. Turn them off in its Responses tab.',
        }),
      })
    } catch (err) {
      logger.error('Notification email failed', { formId, err: err.message })
    }
  },
)

// ── Compress respondents' uploads ───────────────────────────
// Rewrites the object in place, keeping its metadata (including the download
// token, so stored URLs keep working). The generation precondition means a
// file the respondent removed meanwhile isn't brought back.
export const compressUpload = onObjectFinalized(
  { bucket: UPLOAD_BUCKET, region: REGION, memory: '1GiB', timeoutSeconds: 300 },
  async (event) => {
    const object = event.data
    const kind = compressionFor(object)
    if (!kind) return
    const file = getStorage().bucket(object.bucket).file(object.name)
    const [input] = await file.download()
    const result = await compressBuffer(input, kind, object.contentType)
    if (!result) return
    try {
      await file.save(result.data, {
        resumable: false,
        preconditionOpts: { ifGenerationMatch: object.generation },
        metadata: {
          contentType: object.contentType,
          ...(result.contentEncoding && { contentEncoding: result.contentEncoding }),
          ...(object.contentDisposition && { contentDisposition: object.contentDisposition }),
          ...(object.cacheControl && { cacheControl: object.cacheControl }),
          metadata: { ...object.metadata, [MARK]: kind, originalSize: String(input.length) },
        },
      })
      logger.info('Compressed upload', { name: object.name, kind, from: input.length, to: result.data.length })
    } catch (err) {
      if (err.code === 412) return // Replaced or removed while we worked.
      throw err
    }
  },
)

// ── Collaborators ───────────────────────────────────────────
async function memberForm(formId, uid, { ownerOnly = false } = {}) {
  const ref = db.doc(`forms/${formId}`)
  const form = (await ref.get()).data()
  if (!form || !form.memberIds.includes(uid)) throw new HttpsError('not-found', 'Form not found.')
  if (ownerOnly && form.ownerId !== uid) {
    throw new HttpsError('permission-denied', 'Only the form’s owner can change who has access.')
  }
  return { ref, form }
}

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '')

// action: 'list' | 'add' | 'remove' | 'cancelInvite'
export const manageCollaborators = onCall(
  { region: REGION, secrets: [SMTP_PASS] },
  async (request) => {
    requireApp(request)
    if (!request.auth || request.auth.token.firebase?.sign_in_provider === 'anonymous') {
      throw new HttpsError('unauthenticated', 'Sign in first.')
    }
    const caller = request.auth.uid
    const { action, formId } = request.data ?? {}
    if (typeof formId !== 'string') throw new HttpsError('invalid-argument', 'No form.')

    if (action === 'list') {
      const { form } = await memberForm(formId, caller)
      const { users } = await getAuth().getUsers(form.memberIds.map((uid) => ({ uid })))
      const byUid = new Map(users.map((u) => [u.uid, u]))
      return {
        isOwner: form.ownerId === caller,
        members: form.memberIds.map((uid) => ({
          uid,
          email: byUid.get(uid)?.email ?? '',
          name: byUid.get(uid)?.displayName ?? '',
          photo: byUid.get(uid)?.photoURL ?? '',
          role: uid === form.ownerId ? 'owner' : 'editor',
        })),
        invites: form.invitedEmails ?? [],
      }
    }

    const { ref, form } = await memberForm(formId, caller, { ownerOnly: true })
    const title = form.title || 'Untitled form'

    if (action === 'add') {
      const email = normalizeEmail(request.data.email)
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new HttpsError('invalid-argument', 'That doesn’t look like an email address.')
      }
      let user = null
      try {
        user = await getAuth().getUserByEmail(email)
      } catch {
        // No account yet — becomes an invite below.
      }
      if (user && form.memberIds.includes(user.uid)) return { status: 'already' }
      if (user) await ref.update({ memberIds: FieldValue.arrayUnion(user.uid) })
      else await ref.update({ invitedEmails: FieldValue.arrayUnion(email) })

      const inviter = request.auth.token.name || request.auth.token.email || 'Someone'
      const href = user ? `${APP_URL.value()}/forms/${formId}/edit` : `${APP_URL.value()}/signin`
      const body = user
        ? `${inviter} added you as an editor of “${title}” on PeraForm.`
        : `${inviter} invited you to edit “${title}” on PeraForm. Sign in or create an account with this email address (${email}) to get access.`
      try {
        await sendMail({
          to: email,
          subject: `${inviter} shared “${title}” with you`,
          text: `${body}\n\n${href}`,
          html: emailHtml({ heading: 'A form was shared with you', body, cta: user ? 'Open form' : 'Get started', href }),
        })
      } catch (err) {
        logger.error('Invite email failed', { formId, err: err.message })
      }
      return { status: user ? 'added' : 'invited' }
    }

    if (action === 'remove') {
      const { uid } = request.data
      if (uid === form.ownerId) throw new HttpsError('invalid-argument', 'The owner can’t be removed.')
      await ref.update({
        memberIds: FieldValue.arrayRemove(uid),
        notify: FieldValue.arrayRemove(uid),
      })
      return { status: 'removed' }
    }

    if (action === 'cancelInvite') {
      await ref.update({ invitedEmails: FieldValue.arrayRemove(normalizeEmail(request.data.email)) })
      return { status: 'cancelled' }
    }

    throw new HttpsError('invalid-argument', 'Unknown action.')
  },
)

// Called after sign-in: turns pending invites for this (verified) email into
// membership. Unverified addresses can't claim invites — otherwise anyone
// could sign up with someone else's email.
export const acceptInvites = onCall({ region: REGION }, async (request) => {
  requireApp(request)
  const token = request.auth?.token
  if (!token?.email || !token.email_verified) return { joined: 0 }
  const email = normalizeEmail(token.email)
  const snap = await db.collection('forms').where('invitedEmails', 'array-contains', email).get()
  await Promise.all(
    snap.docs.map((d) =>
      d.ref.update({
        memberIds: FieldValue.arrayUnion(request.auth.uid),
        invitedEmails: FieldValue.arrayRemove(email),
      }),
    ),
  )
  return { joined: snap.size }
})
