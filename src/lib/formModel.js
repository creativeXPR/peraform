import { serverTimestamp } from 'firebase/firestore'

// Firestore layout (database "peraform"):
//
//   forms/{formId}                       — auto-ID; also the public /f/:formId link
//     title, description
//     ownerId                            — creator; only they delete or manage access
//     memberIds: [ownerId, ...editorIds] — who can edit and read responses;
//                                          dashboard queries array-contains on this
//     status: 'draft' | 'published' | 'closed'
//     settings: { requireSignIn, limitOneResponse, quiz: QuizSettings }
//
//   forms/{formId}/private/answerKey     — members only, so respondents can't
//     questions: { [questionId]: { correct: string[],     read the answers
//                                  feedbackCorrect, feedbackIncorrect } }
//
//   forms/{formId}/starts/{uid}          — timed quizzes: when this respondent
//     startedAt                            started (server time, set once)
//     questions: [Question | Section]    — array, so one read loads the whole form.
//                                          A Section item starts a new page; see
//                                          lib/formLogic.js for paging + skip logic.
//     createdAt, updatedAt
//
//   forms/{formId}/responses/{responseId} — auto-ID, or the respondent's uid
//                                           when limitOneResponse is on
//     respondentId                       — anonymous or real uid
//     answers: { [questionId]: value }   — string, string[] (checkboxes), number
//                                          (scale/rating), or { [rowIndex]: value }
//                                          for grids
//     submittedAt
//     points, score, maxScore, result,    — quizzes: written by the gradeResponse
//     released, gradedAt                    Cloud Function; creators may adjust
//                                           points/score and set released
//
// firestore.rules enforces these shapes — keep the two in sync.

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
]

// Type-specific fields each new question starts with.
//   choice types: options (+ optional branching/goTo — see formLogic.js)
//   linearScale:  min (0|1), max (2–10), minLabel, maxLabel
//   rating:       max (3–10)
//   grids:        rows, columns
export const TYPE_DEFAULTS = {
  multipleChoice: () => ({ options: ['Option 1'] }),
  checkboxes: () => ({ options: ['Option 1'] }),
  dropdown: () => ({ options: ['Option 1'] }),
  linearScale: () => ({ min: 1, max: 5, minLabel: '', maxLabel: '' }),
  rating: () => ({ max: 5 }),
  mcGrid: () => ({ rows: ['Row 1'], columns: ['Column 1'] }),
  checkboxGrid: () => ({ rows: ['Row 1'], columns: ['Column 1'] }),
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

// A page break. `next` is where respondents go after this section:
// 'next' (the following section), 'submit', or another section's id.
export function newSection() {
  return { id: crypto.randomUUID(), type: 'section', title: '', description: '', next: 'next' }
}

export function newResponse(respondentId, answers) {
  return {
    respondentId,
    answers,
    submittedAt: serverTimestamp(),
  }
}
