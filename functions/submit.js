// Pure checks for submitResponse — no Firebase, unit tested in
// tests/unit/submit.test.js.

export const MAX_ANSWERS_BYTES = 100_000
const MAX_TEXT = 5000
const MAX_CHOICES = 100

const GRID = ['mcGrid', 'checkboxGrid']
const SINGLE_CHOICE = ['multipleChoice', 'dropdown']

const isText = (v) => typeof v === 'string'
const clip = (v) => v.trim().slice(0, MAX_TEXT)

// File answers must be the respondent's own uploads in this form's folder:
// [{ name, path, url, size, type }], at most the question's maxFiles.
function cleanFiles(q, value, ctx) {
  if (!Array.isArray(value) || !ctx?.uid || !ctx?.formId || !ctx?.bucket) return null
  const folder = `uploads/${ctx.formId}/${ctx.uid}/`
  // Download links come from Cloud Storage (or its emulator, in local tests).
  const origins = ctx.storageOrigins ?? ['https://firebasestorage.googleapis.com']
  const prefixes = origins.map((o) => `${o}/v0/b/${ctx.bucket}/o/`)
  const maxBytes = (q.maxSizeMb ?? 10) * 1024 * 1024
  const files = value
    .filter(
      (f) =>
        f &&
        isText(f.path) &&
        f.path.startsWith(folder) &&
        !f.path.includes('..') &&
        isText(f.url) &&
        prefixes.some((p) => f.url.startsWith(p + encodeURIComponent(f.path))) &&
        Number.isFinite(f.size) &&
        f.size > 0 &&
        f.size <= maxBytes,
    )
    .slice(0, q.maxFiles ?? 1)
    .map((f) => ({
      name: isText(f.name) ? f.name.slice(0, 200) : 'file',
      path: f.path,
      url: f.url,
      size: f.size,
      type: isText(f.type) ? f.type.slice(0, 100) : '',
    }))
  return files.length ? files : null
}

// Keeps only answers to questions that exist on the form, in the shape that
// question type expects; anything else is dropped. Returns the clean map.
// ctx: { formId, uid, bucket, storageOrigins? } — needed to check file answers.
export function sanitizeAnswers(form, answers, ctx) {
  const clean = {}
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return clean

  for (const q of form.questions ?? []) {
    if (q.type === 'section' || !(q.id in answers)) continue
    const v = answers[q.id]

    if (SINGLE_CHOICE.includes(q.type) || ['shortText', 'longText', 'date', 'time'].includes(q.type)) {
      if (isText(v) && v.trim()) clean[q.id] = clip(v)
    } else if (q.type === 'checkboxes') {
      if (Array.isArray(v)) {
        const picked = [...new Set(v.filter(isText).map(clip))].slice(0, MAX_CHOICES)
        if (picked.length) clean[q.id] = picked
      }
    } else if (q.type === 'linearScale' || q.type === 'rating') {
      const min = q.type === 'rating' ? 1 : (q.min ?? 1)
      if (Number.isInteger(v) && v >= min && v <= (q.max ?? 5)) clean[q.id] = v
    } else if (q.type === 'fileUpload') {
      const files = cleanFiles(q, v, ctx)
      if (files) clean[q.id] = files
    } else if (GRID.includes(q.type)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const rows = {}
        ;(q.rows ?? []).forEach((_, i) => {
          const cell = v[i]
          if (q.type === 'mcGrid' && isText(cell) && cell) rows[i] = clip(cell)
          if (q.type === 'checkboxGrid' && Array.isArray(cell)) {
            const picked = [...new Set(cell.filter(isText).map(clip))].slice(0, MAX_CHOICES)
            if (picked.length) rows[i] = picked
          }
        })
        if (Object.keys(rows).length) clean[q.id] = rows
      }
    }
  }
  return clean
}

// Why a submission isn't allowed, as an HttpsError code + message, or null.
//   signInProvider: request.auth.token.firebase.sign_in_provider
//   startedAt:      ms of the respondent's recorded quiz start, if any
export function checkSubmission({ form, signInProvider, startedAt, now, answersBytes }) {
  if (!form) return { code: 'not-found', message: 'This form doesn’t exist.' }
  if (form.status !== 'published') {
    return { code: 'failed-precondition', message: 'This form isn’t accepting responses.' }
  }
  const uploads = (form.questions ?? []).some((q) => q.type === 'fileUpload')
  if ((form.settings?.requireSignIn || uploads) && signInProvider === 'anonymous') {
    return { code: 'unauthenticated', message: 'Sign in to fill out this form.' }
  }
  if (answersBytes > MAX_ANSWERS_BYTES) {
    return { code: 'invalid-argument', message: 'Your answers are too long.' }
  }
  const quiz = form.settings?.quiz
  const limit = quiz?.enabled ? quiz.timeLimit || 0 : 0
  if (limit > 0) {
    // Same 30-second grace as the old Firestore rule, for slow networks.
    if (!startedAt || now > startedAt + limit * 60_000 + 30_000) {
      return { code: 'deadline-exceeded', message: 'The time limit for this quiz has passed.' }
    }
  }
  return null
}
