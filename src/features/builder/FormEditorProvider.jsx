import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase.js'
import { EditorContext } from './editorContext.js'
import { editorReducer, initialEditorState, pickDraft } from './editorReducer.js'

const AUTOSAVE_MS = 800
const RETRY_MS = 5000

// Loads one form live and owns its editing session: draft, undo/redo,
// debounced autosave. Everything under /forms/:formId reads it through
// useFormEditor().
export default function FormEditorProvider({ formId, children }) {
  const [form, setForm] = useState(null) // server copy, incl. status/ownerId/memberIds
  const [loadError, setLoadError] = useState(null)
  const [state, dispatch] = useReducer(editorReducer, initialEditorState)
  const [saveError, setSaveError] = useState(false)
  const ref = useMemo(() => doc(db, 'forms', formId), [formId])

  useEffect(
    () =>
      onSnapshot(
        ref,
        (snap) => {
          if (!snap.exists()) {
            setLoadError('not-found')
            return
          }
          const data = { id: snap.id, ...snap.data() }
          setForm(data)
          dispatch({ type: 'load', draft: pickDraft(data) })
        },
        (error) => setLoadError(error.code === 'permission-denied' ? 'not-found' : 'failed'),
      ),
    [ref],
  )

  // Debounced autosave: each change restarts the timer; the save carries the
  // version it was taken at so later edits stay marked unsaved. A failed save
  // flips saveError, which re-runs this effect as a slower retry.
  const latest = useRef(state)
  useEffect(() => {
    latest.current = state
  })

  useEffect(() => {
    if (!state.draft || state.version === state.savedVersion) return
    const version = state.version
    const timer = setTimeout(
      async () => {
        try {
          await updateDoc(ref, { ...latest.current.draft, updatedAt: serverTimestamp() })
          setSaveError(false)
          dispatch({ type: 'saved', version })
        } catch {
          setSaveError(true)
        }
      },
      saveError ? RETRY_MS : AUTOSAVE_MS,
    )
    return () => clearTimeout(timer)
  }, [ref, state.draft, state.version, state.savedVersion, saveError])

  // Leaving the form (e.g. back to the dashboard) inside the debounce window:
  // send the last edits instead of dropping them.
  useEffect(
    () => () => {
      const { draft, version, savedVersion } = latest.current
      if (draft && version !== savedVersion) {
        updateDoc(ref, { ...draft, updatedAt: serverTimestamp() }).catch(() => {})
      }
    },
    [ref],
  )

  // Warn before closing the tab with unsaved changes.
  const dirty = state.version !== state.savedVersion
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  // key: which field is being edited, so typing coalesces into one undo step.
  const edit = useCallback(
    (key, update) => dispatch({ type: 'edit', key, update, at: Date.now() }),
    [],
  )
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])

  // Publishing isn't part of undo history — it's an explicit action.
  const setStatus = useCallback(
    (status) => updateDoc(ref, { status, updatedAt: serverTimestamp() }),
    [ref],
  )

  const saveState = saveError ? 'error' : dirty ? 'saving' : 'saved'

  const value = useMemo(
    () => ({
      form,
      draft: state.draft,
      loadError,
      edit,
      undo,
      redo,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      saveState,
      setStatus,
    }),
    [
      form,
      state.draft,
      state.past.length,
      state.future.length,
      loadError,
      edit,
      undo,
      redo,
      saveState,
      setStatus,
    ],
  )

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}
