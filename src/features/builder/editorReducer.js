// Editor state for one form: the editable draft (title, description,
// questions, settings — plus answerKey, which is saved to a separate private
// document) and undo/redo history.
//
// `notice` says what an edit also did by itself (designed screens following
// a question-list change: lib/interview.js → syncScreens).
//
// `version` bumps on every local change; autosave records which version it
// sent, so a save only marks the draft clean if nothing changed meanwhile.
import { syncScreens } from '../../lib/interview.js'

const HISTORY_LIMIT = 100
// Edits to the same field within this window merge into one undo step,
// so undo removes a typed word or sentence, not a single letter.
const COALESCE_MS = 1000

export const EDITABLE_FIELDS = ['title', 'description', 'questions', 'settings', 'theme', 'mode', 'interview']

// Fields a form doesn't have yet (e.g. theme on forms made before themes)
// are left out: Firestore rejects undefined values on save.
export function pickDraft(form) {
  const draft = Object.fromEntries(
    EDITABLE_FIELDS.filter((key) => form[key] !== undefined).map((key) => [key, form[key]]),
  )
  // Designs aren't changed on load: screens out of step with the question
  // list (from before syncScreens) are flagged in the design editor.
  return draft
}

export const initialEditorState = {
  draft: null,
  past: [],
  future: [],
  version: 0,
  savedVersion: 0,
  lastKey: null,
  lastAt: 0,
  notice: null,
}

export function editorReducer(state, action) {
  switch (action.type) {
    // A server snapshot. Ignored while local edits are unsaved so it can't
    // clobber what the user is typing; autosave will send those shortly.
    // Merges, because the form and its private answer key arrive separately.
    case 'load': {
      if (state.draft && state.version !== state.savedVersion) return state
      return { ...state, draft: { ...state.draft, ...action.draft } }
    }

    case 'edit': {
      let draft = action.update(state.draft)
      if (draft === state.draft) return state
      // Designed screens follow the question list, in this same undo step.
      let notice = null
      if (draft.questions !== state.draft.questions) {
        const synced = syncScreens(draft)
        draft = synced.form
        if (synced.placed.length) notice = { placed: synced.placed, at: action.at }
      }
      const merge = action.key === state.lastKey && action.at - state.lastAt < COALESCE_MS
      return {
        ...state,
        draft,
        past: merge ? state.past : [...state.past, state.draft].slice(-HISTORY_LIMIT),
        future: [],
        version: state.version + 1,
        lastKey: action.key,
        lastAt: action.at,
        notice: notice ?? state.notice,
      }
    }

    case 'undo': {
      if (!state.past.length) return state
      return {
        ...state,
        draft: state.past[state.past.length - 1],
        past: state.past.slice(0, -1),
        future: [state.draft, ...state.future],
        version: state.version + 1,
        lastKey: null,
      }
    }

    case 'redo': {
      if (!state.future.length) return state
      return {
        ...state,
        draft: state.future[0],
        past: [...state.past, state.draft],
        future: state.future.slice(1),
        version: state.version + 1,
        lastKey: null,
      }
    }

    case 'saved':
      return { ...state, savedVersion: Math.max(state.savedVersion, action.version) }

    default:
      return state
  }
}
