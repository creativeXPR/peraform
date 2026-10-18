import { serverTimestamp } from 'firebase/firestore'
import { THEME_DEFAULTS } from './theme.js'

// Firestore layout (database "peraform"):
//
//   forms/{formId}                       — auto-ID; also the public /f/:formId link
//     title, description
//     ownerId                            — creator; only they delete or manage access
//     memberIds: [ownerId, ...editorIds] — who can edit and read responses;
//                                          dashboard queries array-contains on this
//     status: 'draft' | 'published' | 'closed'
//     settings: { requireSignIn, limitOneResponse, quiz: QuizSettings }
//     invitedEmails: [email]             — collaborators without an account yet;
//                                          written by the manageCollaborators function
//     notify: [uid]                      — members who get an email per new response
//     theme: { color, background, font, headerImage } — see lib/theme.js
//     questions: [Question | Section]    — array, so one read loads the whole form.
//                                          A Section item starts a new page; see
//                                          lib/formLogic.js for paging + skip logic.
//     createdAt, updatedAt
//
//   forms/{formId}/private/answerKey     — members only, so respondents can't
//     questions: { [questionId]: { correct: string[],     read the answers
//                                  feedbackCorrect, feedbackIncorrect } }
//
//   forms/{formId}/starts/{uid}          — timed quizzes: when this respondent
//     startedAt                            started (server time, set once)
//
//   forms/{formId}/responses/{responseId} — auto-ID, or the respondent's uid
//                                           when limitOneResponse is on. Written
//                                           only by the submitResponse function
//     respondentId                       — anonymous or real uid
//     answers: { [questionId]: value }   — string, string[] (checkboxes), number
//                                          (scale/rating), or { [rowIndex]: value }
//                                          for grids
//     submittedAt
//     points, score, maxScore, result,    — quizzes: written by the onResponseCreated
//     released, gradedAt                    Cloud Function; creators may adjust
//                                           points/score and set released
//
// firestore.rules and functions/submit.js enforce these shapes — keep them in sync.

export const QUESTION_TYPES = [
  'shortText',
  'longText',
  'multipleChoice',
  'checkboxes',
  'dropdown',
  'linearScale',
  'rating',
  'mcGrid',
  'checkboxGrid',
  'date',
  'time',
  'fileUpload',
]

// Type-specific fields each new question starts with.
//   choice types: options (+ optional branching/goTo — see formLogic.js)
//   linearScale:  min (0|1), max (2–10), minLabel, maxLabel
//   rating:       max (3–10)
//   grids:        rows, columns
//   fileUpload:   accept (FILE_KINDS keys; empty = any), maxFiles, maxSizeMb
// Any question may also carry image: { url, path } shown under its title.
export const TYPE_DEFAULTS = {
  multipleChoice: () => ({ options: ['Option 1'] }),
  checkboxes: () => ({ options: ['Option 1'] }),
  dropdown: () => ({ options: ['Option 1'] }),
  linearScale: () => ({ min: 1, max: 5, minLabel: '', maxLabel: '' }),
  rating: () => ({ max: 5 }),
  mcGrid: () => ({ rows: ['Row 1'], columns: ['Column 1'] }),
  checkboxGrid: () => ({ rows: ['Row 1'], columns: ['Column 1'] }),
  fileUpload: () => ({ accept: [], maxFiles: 1, maxSizeMb: 10 }),
}

// File kinds a file-upload question can be limited to. accept is used for
// the file picker; the respondent page also checks it.
export const FILE_KINDS = {
  document: { label: 'Document', accept: '.doc,.docx,.odt,.rtf,.txt' },
  spreadsheet: { label: 'Spreadsheet', accept: '.xls,.xlsx,.ods,.csv' },
  presentation: { label: 'Presentation', accept: '.ppt,.pptx,.odp' },
  pdf: { label: 'PDF', accept: '.pdf,application/pdf' },
  image: { label: 'Image', accept: 'image/*' },
  video: { label: 'Video', accept: 'video/*' },
  audio: { label: 'Audio', accept: 'audio/*' },
}
export const MAX_FILES_CHOICES = [1, 5, 10]
export const MAX_SIZE_CHOICES = [1, 10, 100] // MB

// Respondents must sign in for forms with file uploads (like Google Forms).
export function needsSignIn(form) {
  return Boolean(form.settings?.requireSignIn) || (form.questions ?? []).some((q) => q.type === 'fileUpload')
}

export function newForm(ownerId) {
  return {
    title: '', // shown as "Untitled form" until named
    description: '',
    ownerId,
    memberIds: [ownerId],
    status: 'draft',
    settings: { requireSignIn: false, limitOneResponse: false, quiz: { ...QUIZ_DEFAULTS } },
    questions: [],
    theme: { ...THEME_DEFAULTS },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
}

// Quiz settings. release: 'immediate' (after each submission) or 'manual'
// (after the creator reviews). show*: what respondents see in their results.
// timeLimit: minutes, 0 = untimed.
export const QUIZ_DEFAULTS = {
  enabled: false,
  release: 'immediate',
  showMissed: true,
  showCorrect: true,
  showPoints: true,
  timeLimit: 0,
}

// Forms made before quizzes existed have no settings.quiz.
export function quizSettings(form) {
  return { ...QUIZ_DEFAULTS, ...form.settings?.quiz }
}

// Types the grader can mark automatically from an answer key.
export const GRADABLE_TYPES = ['multipleChoice', 'dropdown', 'checkboxes', 'shortText']

export function newQuestion(type = 'shortText') {
  return {
    // Stable id so answers stay matched to a question across reorders/edits.
    id: crypto.randomUUID(),
    type,
    title: '',
    description: '',
    required: false,
    ...TYPE_DEFAULTS[type]?.(),
  }
}

// Non-question blocks: a title-and-description, an image, a YouTube video.
export function newContent(type) {
  const base = { id: crypto.randomUUID(), type, title: '', description: '' }
  if (type === 'image') return { ...base, image: null }
  if (type === 'video') return { ...base, videoId: '' }
  return base
}

// "https://youtu.be/ID", "…watch?v=ID", "…/shorts/ID", "…/embed/ID" or a bare ID.
export function youtubeId(input) {
  const text = String(input).trim()
  if (/^[\w-]{11}$/.test(text)) return text
  const m = text.match(/(?:youtu\.be\/|[?&]v=|\/(?:embed|shorts|live)\/)([\w-]{11})/)
  return m ? m[1] : ''
}

// A page break. `next` is where respondents go after this section:
// 'next' (the following section), 'submit', or another section's id.
export function newSection() {
  return { id: crypto.randomUUID(), type: 'section', title: '', description: '', next: 'next' }
}
