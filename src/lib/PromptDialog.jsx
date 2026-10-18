import { useEffect, useRef, useState } from 'react'
import './ConfirmModal.css'

// Small "name this" dialog (new folder, rename folder).
export default function PromptDialog({ open, title, label, initial = '', confirmLabel = 'Save', onSubmit, onCancel }) {
  const ref = useRef(null)
  const [value, setValue] = useState(initial)

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) {
      setValue(initial)
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open, initial])

  return (
    <dialog
      ref={ref}
      className="confirm"
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      onClick={(e) => e.target === ref.current && onCancel()}
    >
      <form
        className="confirm-body"
        onSubmit={(e) => {
          e.preventDefault()
          if (value.trim()) onSubmit(value.trim())
        }}
      >
        <h2>{title}</h2>
        <label className="field">
          <span>{label}</span>
          <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={80} autoFocus />
        </label>
        <div className="confirm-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!value.trim()}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  )
}
