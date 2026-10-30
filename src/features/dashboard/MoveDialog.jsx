import { useEffect, useRef } from 'react'
import { Check, Folder, FolderInput, FolderPlus, Inbox, X } from 'lucide-react'

// "Move to folder" picker for a dashboard card.
export default function MoveDialog({ form, folders, currentId, onMove, onNewFolder, onClose }) {
  const ref = useRef(null)
  const open = Boolean(form)

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const choices = [{ id: null, name: 'My forms (no folder)', icon: Inbox }, ...folders.map((f) => ({ ...f, icon: Folder }))]

  return (
    <dialog
      ref={ref}
      className="confirm move-dialog"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="confirm-body">
        <div className="collab-head">
          <h2>
            <FolderInput size={18} aria-hidden="true" />
            Move “{form?.title || 'Untitled form'}”</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <ul className="move-list">
          {choices.map(({ id, name, icon: Icon }) => (
            <li key={id ?? 'none'}>
              <button
                type="button"
                className={`move-choice${(currentId ?? null) === id ? ' on' : ''}`}
                onClick={() => onMove(id, name)}
              >
                <Icon size={18} />
                <span>{name}</span>
                {(currentId ?? null) === id && <Check size={16} />}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="link-btn move-new" onClick={onNewFolder}>
          <FolderPlus size={16} />
          New folder
        </button>
      </div>
    </dialog>
  )
}
