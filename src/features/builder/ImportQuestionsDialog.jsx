import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronLeft, X } from 'lucide-react'
import { isQuestion, isSection } from '../../lib/formLogic.js'
import { useAuth } from '../auth/useAuth.js'
import { useMyForms } from '../dashboard/useMyForms.js'
import Spinner from '../../lib/Spinner.jsx'

// "Import questions": pick one of your other forms, tick its questions,
// and they're copied in with fresh ids. Skip logic inside the copies is
// reset (it pointed at the other form's sections).
export default function ImportQuestionsDialog({ open, onClose, onImport }) {
  const ref = useRef(null)
  const { formId } = useParams()
  const { user } = useAuth()
  const { forms, loading } = useMyForms(user.uid)
  const [source, setSource] = useState(null)
  const [picked, setPicked] = useState(new Set())

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const others = forms.filter((f) => f.id !== formId)
  // Copyable items: questions plus title/image/video blocks (not sections).
  const items = source ? source.questions.filter((q) => !isSection(q)) : []

  function close() {
    setSource(null)
    setPicked(new Set())
    onClose()
  }

  function toggle(id) {
    setPicked((p) => {
      const next = new Set(p)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function importPicked() {
    const copies = items
      .filter((q) => picked.has(q.id))
      .map((q) => {
        const copy = { ...q, id: crypto.randomUUID() }
        delete copy.branching
        delete copy.goTo
        return copy
      })
    setSource(null)
    setPicked(new Set())
    onImport(copies)
  }

  return (
    <dialog
      ref={ref}
      className="confirm collab import-dialog"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => e.target === ref.current && close()}
    >
      <div className="confirm-body">
        <div className="collab-head">
          <h2>
            {source && (
              <button
                type="button"
                className="icon-btn import-back"
                onClick={() => {
                  setSource(null)
                  setPicked(new Set())
                }}
                aria-label="Back to forms"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            {source ? source.title || 'Untitled form' : 'Import questions'}
          </h2>
          <button type="button" className="icon-btn" onClick={close} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {!source ? (
          <>
            <p className="collab-sub">Choose a form to copy questions from.</p>
            {loading ? (
              <Spinner fill="box" />
            ) : others.length === 0 ? (
              <p className="key-note">You don’t have any other forms yet.</p>
            ) : (
              <ul className="import-list">
                {others.map((f) => (
                  <li key={f.id}>
                    <button type="button" className="import-form" onClick={() => setSource(f)}>
                      <strong>{f.title || 'Untitled form'}</strong>
                      <span>
                        {f.questions.filter(isQuestion).length} questions
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <label className="setting-check import-all">
              <input
                type="checkbox"
                checked={items.length > 0 && picked.size === items.length}
                onChange={(e) => setPicked(e.target.checked ? new Set(items.map((q) => q.id)) : new Set())}
              />
              Select all
            </label>
            <ul className="import-list">
              {items.map((q) => (
                <li key={q.id}>
                  <label className="setting-check import-item">
                    <input type="checkbox" checked={picked.has(q.id)} onChange={() => toggle(q.id)} />
                    <span>{q.title || (isQuestion(q) ? 'Untitled question' : 'Untitled block')}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="share-foot">
              <span />
              <button
                type="button"
                className="btn btn-primary"
                disabled={picked.size === 0}
                onClick={importPicked}
              >
                Import {picked.size || ''} {picked.size === 1 ? 'item' : 'items'}
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  )
}
