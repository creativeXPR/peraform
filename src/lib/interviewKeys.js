import { frameOf } from './interview.js'
import { isHiddenNow } from './actions.js'

// Determines if an element is a text entry field where typing numbers/text occurs.
// Number shortcuts 1-9 must never trigger while typing in these fields.
export function isTextInput(el) {
  if (!el) return false
  const tag = (el.tagName || '').toLowerCase()
  if (tag === 'textarea' || el.isContentEditable) return true
  if (tag === 'input') {
    const type = (el.type || 'text').toLowerCase()
    return !['radio', 'checkbox', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(type)
  }
  return false
}

// Determines if Enter key navigation should be blocked for the given focused element.
// Blocked inside a paragraph (multi-line) field, a dropdown, or when a button/link has focus.
export function isEnterBlocked(el) {
  if (!el) return false
  const tag = (el.tagName || '').toLowerCase()
  // Inside a paragraph (multi-line) field
  if (tag === 'textarea' || el.isContentEditable) return true
  // A dropdown
  if (tag === 'select') return true
  if (el.getAttribute?.('role') === 'combobox' || el.getAttribute?.('role') === 'listbox') return true
  if (el.closest?.('select, [role="combobox"], [role="listbox"], .menu-list, .select-menu, .respond-select')) {
    return true
  }
  // When a button or link has focus
  if (tag === 'button' || tag === 'a') return true
  if (el.getAttribute?.('role') === 'button' || el.getAttribute?.('role') === 'link') return true
  if (el.closest?.('button, a, [role="button"], [role="link"]')) return true
  return false
}

// Finds which multiple-choice or checkbox question should receive a 1-9 key shortcut.
// Returns the question if focus is on/inside that question block, or if it is the only
// choice question on the screen.
export function findChoiceQuestion({ target, choiceQuestions }) {
  if (!choiceQuestions || choiceQuestions.length === 0) return null

  if (target) {
    const qEl = target.closest?.('[data-question-id], .stage-question, .respond-q, [id^="q-"]')
    if (qEl) {
      const qId =
        qEl.dataset?.questionId ||
        (qEl.id && qEl.id.startsWith('q-') ? qEl.id.slice(2) : null) ||
        choiceQuestions.find((q) => qEl.id === `q-${q.id}`)?.id
      if (qId) {
        const found = choiceQuestions.find((q) => q.id === qId)
        if (found) return found
      }
    }
  }

  // If it's the only choice question on the screen
  if (choiceQuestions.length === 1) {
    return choiceQuestions[0]
  }

  return null
}

// Pure function to pick/toggle an option for multiple-choice or checkbox questions.
export function toggleChoiceOption(question, option, currentValue) {
  if (!question) return currentValue
  if (question.type === 'multipleChoice') {
    return option
  }
  if (question.type === 'checkboxes') {
    const list = Array.isArray(currentValue) ? currentValue : []
    if (list.includes(option)) {
      return list.filter((item) => item !== option)
    }
    return [...list, option]
  }
  return currentValue
}

// Reading order for siblings on a device: top to bottom (y), then left to right (x).
// Layer order (z) still decides what's drawn on top via CSS z-index.
export function readingOrder(nodes, parentId = null, device = 'phone') {
  return Object.values(nodes)
    .filter((n) => (n.parentId ?? null) === parentId)
    .sort((a, b) => {
      const fa = frameOf(a, device)
      const fb = frameOf(b, device)
      if (fa.y !== fb.y) return fa.y - fb.y
      if (fa.x !== fb.x) return fa.x - fb.x
      return (fa.z ?? 0) - (fb.z ?? 0) || a.seq - b.seq
    })
}

// Flattened reading order traversal: card comes before what's inside it.
export function flatReadingOrder(nodes, parentId = null, device = 'phone') {
  const siblings = readingOrder(nodes, parentId, device)
  const result = []
  for (const node of siblings) {
    result.push(node)
    if (node.type === 'card') {
      result.push(...flatReadingOrder(nodes, node.id, device))
    }
  }
  return result
}

// Screens visible to respondents (excluding hidden screens).
export function visibleInterviewScreens(screens, overrides, startsHidden) {
  if (!screens) return []
  return screens.filter((s) => !isHiddenNow(s.key, overrides, startsHidden))
}

// Progress metrics for interview screens (1-based current screen / total visible screens).
export function interviewProgress(screens, currentKey, overrides, startsHidden) {
  const visible = visibleInterviewScreens(screens, overrides, startsHidden)
  const idx = visible.findIndex((s) => s.key === currentKey)
  return {
    current: idx >= 0 ? idx + 1 : 1,
    total: visible.length,
  }
}
