import { QUESTION_TYPES, newContent, newQuestion } from '../../lib/formModel.js'
import { parseFormContent } from '../../lib/formImport.js'

// Turns "Edit with AI"'s answer (the whole form, items keeping their ids)
// into the new draft. Existing items keep everything the AI never saw:
// their id (so collected answers and quiz keys still match), images,
// validation, branching, upload settings. New items are cleaned like an
// imported file. Items the AI left out are removed (that's the change it was
// asked for); Undo brings them back.
export function applyAiEdit(draft, result) {
  const existing = new Map((draft.questions ?? []).map((q) => [q.id, q]))
  const used = new Set()
  const items = []

  // If the AI dropped an item's id, the same type and title still find it,
  // so its collected answers stay matched.
  const sameItem = (raw) =>
    [...existing.values()].find(
      (q) => !used.has(q.id) && q.type === raw?.type && norm(q.title) && norm(q.title) === norm(raw?.title),
    )
  for (const raw of result.questions ?? []) {
    const old = (raw?.id && !used.has(raw.id) ? existing.get(raw.id) : null) ?? sameItem(raw)
    if (old) {
      used.add(old.id)
      items.push(mergeItem(old, raw))
    } else {
      const fresh = newItem(raw)
      if (fresh) items.push(fresh)
    }
  }

  // Skip logic can only point at sections that are still there.
  const sections = new Set(items.filter((i) => i.type === 'section').map((i) => i.id))
  const target = (t) => (t === 'submit' || t === 'next' || sections.has(t) ? t : 'next')
  const questions = items.map((item) => {
    if (item.type === 'section') return { ...item, next: target(item.next ?? 'next') }
    if (item.goTo) return { ...item, goTo: item.goTo.map(target) }
    return item
  })

  const text = (v, max) => (typeof v === 'string' ? v.slice(0, max) : null)
  return {
    ...draft,
    title: text(result.title, 200) || draft.title,
    description: text(result.description, 2000) ?? draft.description,
    questions,
  }
}

const norm = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '')

// A question, section or content item the AI changed (or left alone).
function mergeItem(old, raw) {
  const text = (v, max, fallback) => (typeof v === 'string' ? v.slice(0, max) : fallback)
  const title = text(raw.title, 500, old.title)
  const description = text(raw.description, 2000, old.description)

  if (!QUESTION_TYPES.includes(old.type)) {
    // Sections and content blocks: only their words change.
    return { ...old, title, description }
  }
  if (!QUESTION_TYPES.includes(raw.type)) return old

  // Cleaned the way an import is (options trimmed, scales in range…).
  const clean = parseFormContent({ questions: [{ ...raw, id: undefined }] }).questions[0]
  if (raw.type !== old.type) {
    // A new type: its own fields, keeping what belongs to any question.
    const { id, image, points } = old
    return { ...clean, id, ...(image ? { image } : {}), ...(points !== undefined ? { points } : {}) }
  }
  const out = { ...old, title, description, required: raw.required === true }
  if (clean.options) {
    out.options = clean.options
    // Branching follows each option by its text.
    if (old.goTo && old.options) {
      out.goTo = clean.options.map((o) => old.goTo[old.options.indexOf(o)] ?? 'next')
    }
  }
  for (const key of ['min', 'max', 'minLabel', 'maxLabel', 'rows', 'columns']) {
    if (clean[key] !== undefined && raw[key] !== undefined) out[key] = clean[key]
  }
  return out
}

// An item the AI added. Images and videos can't be made up; text blocks can.
function newItem(raw) {
  if (!raw || typeof raw.type !== 'string') return null
  if (raw.type === 'text') {
    return { ...newContent('text'), title: String(raw.title ?? '').slice(0, 500), description: String(raw.description ?? '').slice(0, 2000) }
  }
  if (raw.type !== 'section' && !QUESTION_TYPES.includes(raw.type)) return null
  try {
    return parseFormContent({ questions: [{ ...raw, id: undefined }] }).questions[0]
  } catch {
    return raw.type === 'section' ? null : { ...newQuestion(raw.type), title: String(raw.title ?? '') }
  }
}
