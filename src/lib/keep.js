import { isSection } from './formLogic.js'

// Keep: a person's saved items, shared by every Quality Tools app (stored
// in the suite-wide "billing" database: keeps/{uid}/items/{id}, see
// firestore.billing.rules). Text and links work everywhere; some kinds
// belong to one app and only show there (fields and design blocks are
// PeraForm's; Docs will have headers and footers).
//
// Item = { kind, app (null = every app), label, payload (JSON string of
// the kind's data), createdAt }
//   text   { text }
//   link   { url }
//   field  { items: [form item], answerKey? } — PeraForm, Edit questions
//          (answerKey: a quiz question's correct answers, by item id)
//   block  { rootId, nodes, questions }      — PeraForm, Design screens

export const APP = 'peraform'

export const KEEP_KINDS = {
  field: { label: 'Form fields', app: APP, where: 'Paste in “Edit questions”, below the selected question.' },
  block: { label: 'Design blocks', app: APP, where: 'Paste in “Design screens”, into the selected card.' },
  text: { label: 'Text', app: null, where: 'Paste as a text block (design) or a title and description (questions), or copy it.' },
  link: { label: 'Links', app: null, where: 'Paste as a text block or a title and description, or copy it.' },
}

// Items this app can show: its own kinds and the suite-wide ones.
export const visibleHere = (item) => !item.app || item.app === APP

export function readPayload(item) {
  try {
    return JSON.parse(item.payload)
  } catch {
    return null
  }
}

const LINK = /^https?:\/\/\S+$/i

// A new item for the store. JSON keeps undefined values and nested
// arrays out of Firestore's way.
export function makeKeep(kind, data, label) {
  return { kind, app: KEEP_KINDS[kind]?.app ?? null, label: String(label || 'Untitled').slice(0, 200), payload: JSON.stringify(data) }
}

// Text typed or pasted into the Keep: a link when it's just an address.
export function keepText(text) {
  const t = String(text ?? '').trim()
  if (!t) return null
  if (LINK.test(t)) return makeKeep('link', { url: t }, t)
  return makeKeep('text', { text: t.slice(0, 20000) }, t.split('\n')[0].slice(0, 80))
}

// A form item (question, section, text/image/video) as a kept field, with
// its quiz answer key when it has one.
export function keepField(item, keyEntry) {
  const label = item.title?.trim() || (isSection(item) ? 'Untitled section' : 'Untitled question')
  return makeKeep('field', { items: [item], ...(keyEntry && { answerKey: { [item.id]: keyEntry } }) }, label)
}

// A short line under an item's label in the Keep list.
export function keepSummary(item, typeLabel = (t) => t) {
  const data = readPayload(item)
  if (!data) return ''
  if (item.kind === 'text') return data.text.length > 80 ? `${data.text.slice(0, 80)}…` : data.text
  if (item.kind === 'link') return data.url
  if (item.kind === 'field') {
    const q = data.items?.[0]
    if (!q) return ''
    const opts = q.options?.length ? ` · ${q.options.length} options` : ''
    return `${typeLabel(q.type)}${opts}${q.required ? ' · required' : ''}`
  }
  if (item.kind === 'block') {
    const root = data.nodes?.[data.rootId]
    const count = Object.keys(data.nodes ?? {}).length
    return `${root?.type ?? 'block'}${count > 1 ? ` with ${count - 1} inside` : ''}${data.questions?.length ? ` · ${data.questions.length} question${data.questions.length > 1 ? 's' : ''}` : ''}`
  }
  return ''
}

const newId = () => Math.random().toString(36).slice(2, 10)

// Kept fields pasted into a form's question list, after `afterId` (or at
// the end). Each gets a new id; show/hide actions only keep targets that
// exist in this form. Returns { questions, ids, answerKey } (answer key
// entries under the new ids).
export function pasteFields(questions, data, afterId) {
  const existing = new Set(questions.map((q) => q.id))
  const ids = []
  const answerKey = {}
  const copies = (data?.items ?? []).map((item) => {
    const id = newId()
    ids.push(id)
    if (data.answerKey?.[item.id]) answerKey[id] = data.answerKey[item.id]
    const copy = { ...structuredClone(item), id }
    if (copy.actions) copy.actions = copy.actions.filter((a) => existing.has(a.target)).map((a) => ({ ...a, id: newId() }))
    // "Go to section" choices point at sections of the form it came from.
    if (copy.goTo) copy.goTo = copy.goTo.map((g) => (g === 'next' || g === 'submit' || existing.has(g) ? g : 'next'))
    return copy
  })
  const at = afterId ? questions.findIndex((q) => q.id === afterId) : -1
  const index = at < 0 ? questions.length : at + 1
  return { questions: [...questions.slice(0, index), ...copies, ...questions.slice(index)], ids, answerKey }
}

// Text or a link pasted into the question list: a text item (title and
// description).
export function textAsField(data) {
  const text = data.url ?? data.text ?? ''
  const [first, ...rest] = text.split('\n')
  return { items: [{ type: 'text', title: first.slice(0, 200), description: rest.join('\n').trim() }] }
}

