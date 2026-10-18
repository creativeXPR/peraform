import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { logger } from 'firebase-functions'
import { defineBoolean, defineString } from 'firebase-functions/params'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { onObjectFinalized } from 'firebase-functions/v2/storage'
import { MARK, compressBuffer, compressionFor } from './compress.js'
import { gradeResponse } from './grade.js'
import { APP_URL, SMTP_PASS, emailHtml, sendMail } from './mail.js'
import { allow, clientIp } from './rateLimit.js'
import { checkSubmission, sanitizeAnswers } from './submit.js'

initializeApp()
// PeraForm's named database (the project's default one belongs to other apps).
const db = getFirestore('peraform')
const REGION = 'europe-west1'

// Off until the reCAPTCHA key is set up (see README); then set
// ENFORCE_APP_CHECK=true in functions/.env and redeploy.
const ENFORCE_APP_CHECK = defineBoolean('ENFORCE_APP_CHECK', { default: false })

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
  if (ENFORCE_APP_CHECK.value() && !request.app) {
    throw new HttpsError('failed-precondition', 'This request didn’t come from PeraForm.')
  }
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
  const start = timed ? (await db.doc(`forms/${formId}/starts/${uid}`).get()).data() : null
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
      // From the sign-in token, so respondents can't type someone else's.
      ...(form.settings?.collectEmails && { respondentEmail: request.auth.token.email ?? '' }),
    })
  } catch (err) {
    if (err.code === 6) throw new HttpsError('already-exists', 'You’ve already responded.')
    throw err
  }
  return { responseId: ref.id }
})

// ── After each response: grade quizzes, notify subscribers ─────
export const onResponseCreated = onDocumentCreated(
  {
    document: 'forms/{formId}/responses/{responseId}',
    database: 'peraform',
    region: REGION,
    secrets: [SMTP_PASS],
  },
  async (event) => {
    const { formId } = event.params
    const form = (await db.doc(`forms/${formId}`).get()).data()
    if (!form) return

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
