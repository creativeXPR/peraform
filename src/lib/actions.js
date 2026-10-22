// Actions: something the respondent does changes another block.
//
// Action = {
//   id,
//   trigger: { type: 'click' }                     — a button (interview mode)
//          | { type: 'select', option }            — an option is chosen
//          | { type: 'match', pattern }            — the typed answer matches
//   target:  id of the block to change (interview: a node; normal: an item)
//   effect:  { type: 'show' | 'hide' | 'toggle' | 'set', props? }
//            props (interview 'set'): opacity, bg, color, size, radius,
//            rotate, scale, moveX, moveY
//   transition: { duration (ms), easing, display (fade show/hide) }
// }
//
// Where they live: interview — node.actions on buttons and question blocks;
// normal forms — question.actions on questions (show/hide/toggle only).
//
// Clicks build up (every click applies its effect). Answer conditions are
// states: their effect holds while the answer matches and undoes itself when
// it no longer does.

export const SELECT_TYPES = ['multipleChoice', 'checkboxes', 'dropdown']
export const MATCH_TYPES = ['shortText', 'longText', 'linearScale', 'rating', 'date', 'time']

export const EFFECTS = {
  show: 'Show',
  hide: 'Hide',
  toggle: 'Toggle (show ↔ hide)',
  set: 'Change how it looks',
}

export const EASINGS = {
  ease: 'Smooth',
  linear: 'Linear',
  'ease-in': 'Speed up',
  'ease-out': 'Slow down',
  'cubic-bezier(0.34, 1.56, 0.64, 1)': 'Bounce',
}

export const TRANSITION_DEFAULTS = { duration: 300, easing: 'ease', display: true }

// Properties 'set' can change, with their input ranges.
export const SET_PROPS = {
  opacity: { label: 'Opacity', unit: '%', min: 0, max: 100 },
  size: { label: 'Font size', unit: 'px', min: 8, max: 200 },
  radius: { label: 'Radius', unit: 'px', min: 0, max: 999 },
  rotate: { label: 'Rotate', unit: '°', min: -360, max: 360 },
  scale: { label: 'Scale', unit: '%', min: 10, max: 400 },
  moveX: { label: 'Move right', unit: 'px', min: -2000, max: 2000 },
  moveY: { label: 'Move down', unit: 'px', min: -2000, max: 2000 },
  bg: { label: 'Background', color: true },
  color: { label: 'Text colour', color: true },
}

export function triggerKindFor(question) {
  if (!question) return null
  if (SELECT_TYPES.includes(question.type)) return 'select'
  if (MATCH_TYPES.includes(question.type)) return 'match'
  return null
}

// "If included": a regular expression (case-insensitive); anything that
// isn't valid regex is matched as plain text instead.
export function matches(pattern, value) {
  if (value === undefined || value === null || value === '') return false
  const text = String(value)
  if (!pattern) return text.trim() !== ''
  try {
    return new RegExp(pattern, 'i').test(text)
  } catch {
    return text.toLowerCase().includes(String(pattern).toLowerCase())
  }
}

export function conditionMet(trigger, value) {
  if (trigger.type === 'select') {
    return Array.isArray(value) ? value.includes(trigger.option) : value === trigger.option
  }
  if (trigger.type === 'match') return matches(trigger.pattern, value)
  return false
}

// One effect on a target's current state { hidden, props, transition }.
export function applyEffect(state, action, baseHidden) {
  const hidden = state.hidden ?? baseHidden
  const next = { ...state, transition: { ...TRANSITION_DEFAULTS, ...action.transition } }
  const { effect } = action
  if (effect.type === 'show') next.hidden = false
  else if (effect.type === 'hide') next.hidden = true
  else if (effect.type === 'toggle') next.hidden = !hidden
  else if (effect.type === 'set') next.props = { ...state.props, ...effect.props }
  return next
}

// Applies a click's actions on top of the clicks so far.
export function applyClick(clickState, actions, baseHidden) {
  const next = { ...clickState }
  for (const action of actions) {
    if (action.trigger?.type !== 'click' || !action.target) continue
    next[action.target] = applyEffect(next[action.target] ?? {}, action, baseHidden(action.target))
  }
  return next
}

// Every block's state right now: clicks so far, then the answer conditions
// that currently hold. `sources` = [{ actions, questionId? }] — each block
// that has actions and, for answer triggers, the question it reads.
// Returns { [targetId]: { hidden?, props?, transition? } }.
export function resolveActions({ sources, answers, clickState = {}, baseHidden }) {
  const out = { ...clickState }
  for (const source of sources) {
    for (const action of source.actions ?? []) {
      if (!action.target || action.trigger?.type === 'click') continue
      if (!conditionMet(action.trigger, answers[source.questionId])) continue
      out[action.target] = applyEffect(out[action.target] ?? {}, action, baseHidden(action.target))
    }
  }
  return out
}

// Normal forms: an item that some action can "show" starts hidden (like a
// conditional question); everything else starts visible.
export function shownByActions(items) {
  const ids = new Set()
  for (const item of items) {
    for (const action of item.actions ?? []) {
      if (action.effect?.type === 'show' && action.target) ids.add(action.target)
    }
  }
  return ids
}

export function isHiddenNow(id, resolved, baseHidden) {
  return resolved[id]?.hidden ?? baseHidden(id)
}

export function newAction(trigger, target = null) {
  return {
    id: Math.random().toString(36).slice(2, 10),
    trigger,
    target,
    effect: { type: 'show' },
    transition: { ...TRANSITION_DEFAULTS },
  }
}
