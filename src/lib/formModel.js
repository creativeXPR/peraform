import { serverTimestamp } from 'firebase/firestore'

// Firestore layout (database "peraform"):
//
//   forms/{formId}                       — auto-ID; also the public /f/:formId link
//     title, description
//     ownerId                            — creator; only they delete or manage access
//     memberIds: [ownerId, ...editorIds] — who can edit and read responses;
//                                          dashboard queries array-contains on this
//     status: 'draft' | 'published' | 'closed'
//     settings: { requireSignIn, limitOneResponse }
//     questions: [Question]              — array, so one read loads the whole form
//     createdAt, updatedAt
//
//   forms/{formId}/responses/{responseId} — auto-ID, or the respondent's uid
//                                           when limitOneResponse is on
//     respondentId                       — anonymous or real uid
//     answers: { [questionId]: value }
//     submittedAt
//
// firestore.rules enforces these shapes — keep the two in sync.

export const QUESTION_TYPES = [
  'shortText',
  'longText',
  'multipleChoice',
  'checkboxes',
  'dropdown',
  'date',
]

export function newForm(ownerId) {
  return {
    title: '', // shown as "Untitled form" until named
    description: '',
    ownerId,
    memberIds: [ownerId],
    status: 'draft',
    settings: { requireSignIn: false, limitOneResponse: false },
    questions: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
}

export function newQuestion(type = 'shortText') {
  const hasOptions = ['multipleChoice', 'checkboxes', 'dropdown'].includes(type)
  return {
    // Stable id so answers stay matched to a question across reorders/edits.
    id: crypto.randomUUID(),
    type,
    title: '',
    description: '',
    required: false,
    ...(hasOptions && { options: ['Option 1'] }),
  }
}

export function newResponse(respondentId, answers) {
  return {
    respondentId,
    answers,
    submittedAt: serverTimestamp(),
  }
}
