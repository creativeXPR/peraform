import { useEffect, useRef, useState } from 'react'
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase.js'
import { ensureSignedIn } from '../auth/authActions.js'

const SAVE_MS = 800
const RESTORE_WAIT_MS = 1500

// Answers in progress, kept on the respondent's own account at
// forms/{formId}/progress/{uid} (only they can read or write it), so a
// refresh, a closed tab or (signed in) another device doesn't lose them.
// Respondents without an account get an anonymous one on their first
// answer, which the browser keeps across refreshes.
//   progress: { answers, pageIndex, history } — what to save
//   onRestore(saved) — called once, if there's something saved; return
//     false to keep the current answers instead
// Returns { ready, restored, clear }: hold the form until ready (so saved
// answers don't flash in), show a note when restored, clear() on submit or
// "Clear form".
export function useSavedProgress({ formId, uid, enabled, progress, onRestore }) {
  const [ready, setReady] = useState(!enabled || !uid)
  const [restored, setRestored] = useState(false)
  const restoreRef = useRef(onRestore)
  useEffect(() => {
    restoreRef.current = onRestore
  })
  // Nothing is saved until the respondent has actually answered something.
  const touched = useRef(false)

  // Restore once, when we know who's answering.
  useEffect(() => {
    if (!enabled || !uid) return
    let done = false
    const finish = () => {
      if (!done) {
        done = true
        setReady(true)
      }
    }
    // Don't keep anyone waiting on a slow connection: show the form anyway.
    const timer = setTimeout(finish, RESTORE_WAIT_MS)
    getDoc(doc(db, 'forms', formId, 'progress', uid))
      .then((snap) => {
        const saved = snap.data()
        // onRestore may decline (return false), e.g. for a pre-filled link.
        if (!done && saved?.answers && Object.keys(saved.answers).length && restoreRef.current?.(saved) !== false) {
          setRestored(true)
        }
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(timer)
        finish()
      })
    return () => clearTimeout(timer)
  }, [enabled, uid, formId])

  // Save a moment after each change.
  const { answers, pageIndex, history } = progress
  useEffect(() => {
    if (!enabled || !ready) return
    if (!touched.current) {
      touched.current = Object.keys(answers).length > 0
      if (!touched.current) return
    }
    const timer = setTimeout(async () => {
      try {
        const who = await ensureSignedIn()
        await setDoc(doc(db, 'forms', formId, 'progress', who.uid), {
          answers,
          pageIndex,
          history,
          updatedAt: serverTimestamp(),
        })
      } catch {
        // Saving progress is a convenience: never get in the way of answering.
      }
    }, SAVE_MS)
    return () => clearTimeout(timer)
  }, [enabled, ready, formId, answers, pageIndex, history])

  async function clear() {
    touched.current = false
    setRestored(false)
    if (!uid) return
    await deleteDoc(doc(db, 'forms', formId, 'progress', uid)).catch(() => {})
  }

  return { ready, restored, clear }
}
