import { addDoc, collection, deleteDoc, doc, getDocs, writeBatch } from 'firebase/firestore'
import { db } from '../../lib/firebase.js'
import { BRANCHING_TYPES, GRID_TYPES } from '../../lib/formLogic.js'
import { QUESTION_TYPES, newForm, newQuestion, newSection } from '../../lib/formModel.js'
import { VALIDATION, VALIDATION_KINDS } from '../../lib/validation.js'

// Creates a draft owned by uid, optionally pre-filled ({ title, description,
// questions }), and returns its id.
export async function createForm(uid, content = {}) {
  const ref = await addDoc(collection(db, 'forms'), { ...newForm(uid), ...content })
  return ref.id
}

// Batched in 500s, Firestore's per-batch write limit.
export async function deleteAllResponses(formId) {
  const responses = await getDocs(collection(db, 'forms', formId, 'responses'))
  for (let i = 0; i < responses.docs.length; i += 500) {
    const batch = writeBatch(db)
    responses.docs.slice(i, i + 500).forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
}

// Responses live in a subcollection, which Firestore doesn't delete along
// with the parent — clear them first so nothing is left orphaned.
export async function deleteForm(formId) {
  await deleteAllResponses(formId)
  await deleteDoc(doc(db, 'forms', formId))
}

const MAX_IMPORT_BYTES = 1024 * 1024
const OPTION_TYPES = ['multipleChoice', 'checkboxes', 'dropdown']

// Reads a PeraForm JSON file ({ title, description, questions: [...] }), sections
// included, into
// form content. Only known fields survive, and every question gets a fresh
// id, so an imported file can't smuggle in ownership or status fields.
export async function parseImportFile(file) {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('That file is too large (1 MB max).')

  let data
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new Error('That file isn’t valid JSON.')
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.questions)) {
    throw new Error('That file doesn’t look like a PeraForm form.')
  }

  const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '')
  const list = (value, max) =>
    Array.isArray(value) && value.length ? value.slice(0, 200).map((v) => text(v, max)) : null
  const int = (value, allowed, fallback) =>
    Number.isInteger(value) && allowed.includes(value) ? value : fallback

  // Items get fresh ids; skip-logic targets are remapped after the loop.
  const newIds = new Map()
  const items = data.questions.map((raw, i) => {
    if (raw?.type === 'section') {
      const section = {
        ...newSection(),
        title: text(raw.title, 500),
        description: text(raw.description, 2000),
        next: raw.next,
      }
      newIds.set(raw.id, section.id)
      return section
    }
    if (!raw || !QUESTION_TYPES.includes(raw.type)) {
      throw new Error(`Question ${i + 1} has an unknown type.`)
    }
    const question = {
      ...newQuestion(raw.type),
      title: text(raw.title, 500),
      description: text(raw.description, 2000),
      required: raw.required === true,
    }
    if (OPTION_TYPES.includes(raw.type)) {
      question.options = list(raw.options, 300) ?? question.options
      if (BRANCHING_TYPES.includes(raw.type) && raw.branching === true) {
        question.branching = true
        question.goTo = question.options.map((_, j) => raw.goTo?.[j])
      }
    }
    if (raw.type === 'linearScale') {
      question.min = int(raw.min, [0, 1], 1)
      question.max = int(raw.max, [2, 3, 4, 5, 6, 7, 8, 9, 10], 5)
      question.minLabel = text(raw.minLabel, 60)
      question.maxLabel = text(raw.maxLabel, 60)
    }
    if (raw.type === 'rating') question.max = int(raw.max, [3, 4, 5, 6, 7, 8, 9, 10], 5)
    const rule = raw.validation
    if (VALIDATION_KINDS[raw.type]?.includes(rule?.kind) && rule.op in VALIDATION[rule.kind].ops) {
      question.validation = {
        kind: rule.kind,
        op: rule.op,
        value: text(rule.value, 200),
        value2: text(rule.value2, 200),
        message: text(rule.message, 200),
      }
    }
    if (GRID_TYPES.includes(raw.type)) {
      question.rows = list(raw.rows, 300) ?? question.rows
      question.columns = list(raw.columns, 300) ?? question.columns
    }
    return question
  })

  // Anything that isn't 'submit' or a section in this file becomes 'next'.
  const target = (t) => (t === 'submit' ? 'submit' : (newIds.get(t) ?? 'next'))
  const questions = items.map((item) => {
    if (item.type === 'section') return { ...item, next: target(item.next) }
    if (item.goTo) return { ...item, goTo: item.goTo.map(target) }
    return item
  })

  return {
    title: text(data.title, 200) || 'Imported form',
    description: text(data.description, 2000),
    questions,
  }
}
