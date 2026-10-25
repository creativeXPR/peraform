import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { suiteDb } from '../../lib/firebase.js'

// Keep items live in the suite-wide "suite" database, so every Quality
// Tools app sees the same ones (lib/keep.js describes them).
const items = (uid) => collection(suiteDb, 'keeps', uid, 'items')

export function saveKeep(uid, item) {
  return addDoc(items(uid), { ...item, createdAt: serverTimestamp() })
}

export function renameKeep(uid, id, label) {
  return updateDoc(doc(items(uid), id), { label: String(label).slice(0, 200) })
}

export function deleteKeep(uid, id) {
  return deleteDoc(doc(items(uid), id))
}

// Newest first. onChange(list), onError(error); returns the unsubscribe.
export function watchKeeps(uid, onChange, onError) {
  return onSnapshot(
    query(items(uid), orderBy('createdAt', 'desc')),
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  )
}
