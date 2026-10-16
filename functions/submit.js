// Pure checks for submitResponse — no Firebase, unit tested in
// tests/unit/submit.test.js.

export const MAX_ANSWERS_BYTES = 100_000
const MAX_TEXT = 5000
const MAX_CHOICES = 100

const GRID = ['mcGrid', 'checkboxGrid']
const SINGLE_CHOICE = ['multipleChoice', 'dropdown']

const isText = (v) => typeof v === 'string'
const clip = (v) => v.trim().slice(0, MAX_TEXT)

// Keeps only answers to questions that exist on the form, in the shape that
// question type expects; anything else is dropped. Returns the clean map.
export function sanitizeAnswers(form, answers) {
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
  if (form.settings?.requireSignIn && signInProvider === 'anonymous') {
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
