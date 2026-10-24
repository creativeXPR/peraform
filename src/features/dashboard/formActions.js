import { addDoc, collection, deleteDoc, doc, getDocs, writeBatch } from 'firebase/firestore'
import { db } from '../../lib/firebase.js'
import { newForm } from '../../lib/formModel.js'

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

// Import parsing lives in lib/formImport.js (pure); re-exported for callers here.
export { parseFormContent, parseImportFile } from '../../lib/formImport.js'
