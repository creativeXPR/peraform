import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '../../lib/firebase.js'

// Live list of forms the user owns or edits, newest edit first.
// Needs the memberIds + updatedAt composite index (firestore.indexes.json).
export function useMyForms(uid) {
  const [state, setState] = useState({ forms: [], loading: true, error: null })

  useEffect(() => {
    const q = query(
      collection(db, 'forms'),
      where('memberIds', 'array-contains', uid),
      orderBy('updatedAt', 'desc'),
    )
    return onSnapshot(
      q,
      (snap) => {
        const forms = snap.docs.map((d) => {
          // 'estimate' fills just-written serverTimestamps with local time
          // instead of null, so a new form sorts and dates correctly at once.
          const data = d.data({ serverTimestamps: 'estimate' })
          return { id: d.id, ...data, updatedAt: data.updatedAt?.toDate() ?? null }
        })
        setState({ forms, loading: false, error: null })
      },
      (error) => setState({ forms: [], loading: false, error }),
    )
  }, [uid])

  return state
}
