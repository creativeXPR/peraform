import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../../lib/firebase.js'

// Live list of a form's responses, newest first. Only members can read
// these (firestore.rules), which is everyone who can reach this tab.
export function useResponses(formId) {
  const [state, setState] = useState({ responses: [], loading: true, error: null })

  useEffect(() => {
    if (!formId) return // form still loading
    return onSnapshot(
      query(collection(db, 'forms', formId, 'responses'), orderBy('submittedAt', 'desc')),
      (snap) => {
        const responses = snap.docs.map((d) => {
          const data = d.data({ serverTimestamps: 'estimate' })
          return { id: d.id, ...data, submittedAt: data.submittedAt?.toDate() ?? null }
        })
        setState({ responses, loading: false, error: null })
      },
      (error) => setState({ responses: [], loading: false, error }),
    )
  }, [formId])

  return state
}
