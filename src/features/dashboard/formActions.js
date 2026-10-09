import { addDoc, collection, deleteDoc, doc, getDocs, writeBatch } from 'firebase/firestore'
import { db } from '../../lib/firebase.js'
import { QUESTION_TYPES, newForm, newQuestion } from '../../lib/formModel.js'

// Creates a draft owned by uid, optionally pre-filled ({ title, description,
// questions }), and returns its id.
export async function createForm(uid, content = {}) {
  const ref = await addDoc(collection(db, 'forms'), { ...newForm(uid), ...content })
  return ref.id
}

// Responses live in a subcollection, which Firestore doesn't delete along
// with the parent — clear them first so nothing is left orphaned.
export async function deleteForm(formId) {
  const responses = await getDocs(collection(db, 'forms', formId, 'responses'))
  for (let i = 0; i < responses.docs.length; i += 500) {
    const batch = writeBatch(db)
    responses.docs.slice(i, i + 500).forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
  await deleteDoc(doc(db, 'forms', formId))
}

const MAX_IMPORT_BYTES = 1024 * 1024
const OPTION_TYPES = ['multipleChoice', 'checkboxes', 'dropdown']

// Reads a PeraForm JSON file ({ title, description, questions: [...] }) into
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

  const questions = data.questions.map((raw, i) => {
    if (!raw || !QUESTION_TYPES.includes(raw.type)) {
      throw new Error(`Question ${i + 1} has an unknown type.`)
    }
    const question = {
      ...newQuestion(raw.type),
      title: text(raw.title, 500),
      description: text(raw.description, 2000),
      required: raw.required === true,
    }
    if (OPTION_TYPES.includes(raw.type) && Array.isArray(raw.options) && raw.options.length) {
      question.options = raw.options.map((o) => text(o, 300))
    }
    return question
  })

  return {
    title: text(data.title, 200) || 'Imported form',
    description: text(data.description, 2000),
    questions,
  }
}
