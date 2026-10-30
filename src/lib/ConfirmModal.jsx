import { useEffect, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import IdeaArt from '../features/ai/IdeaArt.jsx'
import './ConfirmModal.css'

// The red illustration for anything that deletes or removes.
const DANGER_ART = { sky: '#ffeceb', sky2: '#ffcdca', ground: '#f59c95', accent: '#d64541' }

// "Are you sure?" dialog — every delete/remove action goes through this.
// Built on <dialog> so focus trapping and Escape-to-close come for free.
//   tone: 'danger' (default: red illustration and button) or 'neutral'
//         for confirmations that don't delete anything (e.g. Give, Share)
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const ref = useRef(null)
  const danger = tone === 'danger'

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="confirm"
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onCancel()
      }}
      onClick={(e) => e.target === ref.current && !busy && onCancel()}
    >
      <div className="confirm-body">
        {danger && (
          <div className="confirm-art">
            <IdeaArt art={DANGER_ART} icon={Trash2} />
          </div>
        )}
        <h2>{title}</h2>
        {message && <p>{message}</p>}
        <div className="confirm-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
