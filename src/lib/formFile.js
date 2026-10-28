import { CONTENT_TYPES } from './formLogic.js'
import { QUESTION_TYPES } from './formModel.js'
import { parseFormContent } from './formImport.js'
import { embedSrc } from './interview.js'

// A whole form saved to the computer ("Download as PeraForm file") and
// opened again ("Import"): questions and sections, title/image/video
// blocks, actions, quiz answer keys, theme, settings and interview screens.
//
// File = { format: 'peraform-form', version: 1, exportedAt, form, answerKey }
// Older/simpler files ({ title, description, questions }) still import,
// through parseFormContent.
//
// Pure: no Firebase. The caller creates the form (and its answer key).

export const FILE_FORMAT = 'peraform-form'
const MAX_ITEMS = 1000
const MAX_TEXT = 20000

// Everything about a form that belongs in its file. Never responses,
// owners, collaborators, status or access lists.
export function formToFile(draft) {
  const pick = ({ title, description, questions, settings, theme, mode, interview }) => ({
    title,
    description,
    questions,
    settings,
    theme,
    mode,
    interview,
  })
  return {
    format: FILE_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    form: JSON.parse(JSON.stringify(pick(draft))),
    answerKey: draft.answerKey && Object.keys(draft.answerKey).length ? draft.answerKey : undefined,
  }
}

export function fileName(title) {
  const safe = String(title || 'Untitled form')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return `${safe || 'Untitled form'}.peraform.json`
}

const newId = () => crypto.randomUUID()

// Settings that would lock the new form or point at other people: left out.
const DROP_SETTINGS = ['restricted', 'sheets']

// Web addresses in the file must be https (an "javascript:" address in an
// embed or image would be a security hole), embeds go through embedSrc,
// and video ids must look like YouTube ids. Storage paths are dropped, so
// the imported form never deletes the original's files.
function clean(value, key, parent) {
  if (typeof value === 'string') {
    if (key === 'url' || key === 'src' || key === 'href') {
      if (parent?.type === 'embed') return embedSrc(value) ?? undefined
      return /^https:\/\/[^\s"'<>]+$/i.test(value) ? value : undefined
    }
    if (key === 'videoId') return /^[\w-]{6,20}$/.test(value) ? value : ''
    return value.slice(0, MAX_TEXT)
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'boolean' || value === null) return value
  if (Array.isArray(value)) return value.slice(0, MAX_ITEMS).map((v) => clean(v, null, parent)).filter((v) => v !== undefined)
  if (typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      if (k === 'path' || k === '__proto__' || k === 'constructor') continue
      const c = clean(v, k, value)
      if (c !== undefined) out[k] = c
    }
    return out
  }
  return undefined
}

// A file's content → { content: form fields for createForm, answerKey }.
// Every question/section gets a fresh id, and every reference to it
// (actions, section jumps, screen designs, answer keys) follows.
export function fileToForm(data) {
  if (data?.format !== FILE_FORMAT) {
    return { content: parseFormContent(data), answerKey: null }
  }
  const form = data.form
  if (!form || !Array.isArray(form.questions)) throw new Error('That file doesn’t look like a PeraForm form.')
  if (form.questions.length > MAX_ITEMS) throw new Error('That form is too large to import.')
  const allowed = new Set([...QUESTION_TYPES, ...CONTENT_TYPES, 'section'])
  form.questions.forEach((q, i) => {
    if (!q || typeof q.id !== 'string' || !allowed.has(q.type)) throw new Error(`Item ${i + 1} isn’t something PeraForm knows.`)
  })

  // Old id → new id, swapped wherever the old id appears as a whole value
  // or key (ids are random, so they can't clash with other text).
  let json = JSON.stringify({ form, answerKey: data.answerKey ?? null })
  for (const q of form.questions) {
    json = json.split(`"${q.id}"`).join(`"${newId()}"`)
  }
  const swapped = JSON.parse(json)
  const f = clean(swapped.form)

  const settings = { ...(f.settings ?? {}) }
  for (const k of DROP_SETTINGS) delete settings[k]
  const content = {
    title: String(f.title || 'Imported form').slice(0, 200),
    description: String(f.description ?? '').slice(0, 2000),
    questions: f.questions,
    settings,
    ...(f.theme && { theme: f.theme }),
    mode: f.mode === 'interview' ? 'interview' : 'normal',
    ...(f.interview && { interview: f.interview }),
  }
  const answerKey = swapped.answerKey ? clean(swapped.answerKey) : null
  return { content, answerKey }
}
