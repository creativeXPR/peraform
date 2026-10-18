import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase.js'

// Each person's own stars and folders (private — see firestore.rules):
//   users/{uid}/formMeta/{formId}  { starred?, folderId? }
//   users/{uid}/folders/{folderId} { name, createdAt }

// { meta: { [formId]: { starred, folderId } }, folders: [{ id, name }] }
export function useOrganize(uid) {
  const [meta, setMeta] = useState({})
  const [folders, setFolders] = useState([])

  useEffect(() => {
    if (!uid) return
    const stopMeta = onSnapshot(collection(db, 'users', uid, 'formMeta'), (snap) =>
      setMeta(Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))),
    )
    const stopFolders = onSnapshot(collection(db, 'users', uid, 'folders'), (snap) =>
      setFolders(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
      ),
    )
    return () => {
      stopMeta()
      stopFolders()
    }
  }, [uid])

  return { meta, folders }
}

const metaRef = (uid, formId) => doc(db, 'users', uid, 'formMeta', formId)

export function setStarred(uid, formId, starred) {
  return setDoc(metaRef(uid, formId), { starred }, { merge: true })
}

// folderId null = back to "My forms" (no folder).
export function moveToFolder(uid, formId, folderId) {
  return setDoc(metaRef(uid, formId), { folderId: folderId ?? deleteField() }, { merge: true })
}

export async function createFolder(uid, name) {
  const ref = await addDoc(collection(db, 'users', uid, 'folders'), {
    name: name.trim().slice(0, 80),
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export function renameFolder(uid, folderId, name) {
  return updateDoc(doc(db, 'users', uid, 'folders', folderId), { name: name.trim().slice(0, 80) })
}

// Deleting a folder never deletes forms — they just go back to no folder.
export async function deleteFolder(uid, folderId) {
  const inside = await getDocs(
    query(collection(db, 'users', uid, 'formMeta'), where('folderId', '==', folderId)),
  )
  const batch = writeBatch(db)
  inside.docs.forEach((d) => batch.update(d.ref, { folderId: deleteField() }))
  batch.delete(doc(db, 'users', uid, 'folders', folderId))
  await batch.commit()
}
