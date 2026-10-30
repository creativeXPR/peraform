import { useEffect, useRef } from 'react'
import { Keyboard, X } from 'lucide-react'

const GROUPS = [
  {
    title: 'Editing',
    keys: [
      ['Ctrl + Z', 'Undo'],
      ['Ctrl + Shift + Z', 'Redo'],
      ['Enter (in an option)', 'Add the next option'],
      ['Ctrl + /', 'Show these shortcuts'],
    ],
  },
  {
    title: 'Interview canvas: blocks',
    keys: [
      ['Click', 'Select a block'],
      ['Drag', 'Move (snaps to edges and centre)'],
      ['Alt + drag', 'Move without snapping'],
      ['Shift + drag a corner', 'Resize keeping the shape'],
      ['Shift + drag the knob', 'Rotate in 15° steps'],
      ['Arrow keys', 'Nudge 1 px (Shift: 10 px)'],
      ['Ctrl + D', 'Duplicate'],
      ['Delete', 'Delete (asks first)'],
      ['Esc', 'Deselect'],
    ],
  },
  {
    title: 'Interview canvas: view',
    keys: [
      ['V', 'Move tool'],
      ['H, or hold Space', 'Hand: drag to move around'],
      ['Ctrl + scroll', 'Zoom at the pointer'],
      ['Ctrl + +  /  Ctrl + −', 'Zoom in / out'],
      ['Ctrl + 0', 'Zoom to 100%'],
      ['Shift + 1', 'Fit the screen'],
    ],
  },
]

// The editor's keyboard shortcuts (⋯ → Keyboard shortcuts, or Ctrl + /).
export default function ShortcutsDialog({ open, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="confirm shortcuts-dialog"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="confirm-body">
        <div className="collab-head">
          <h2>
            <Keyboard size={18} aria-hidden="true" />
            Keyboard shortcuts</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p>On a Mac, use ⌘ where it says Ctrl, and ⌥ for Alt.</p>
        {GROUPS.map((g) => (
          <section key={g.title} className="shortcuts-group">
            <h3>{g.title}</h3>
            <dl>
              {g.keys.map(([key, what]) => (
                <div key={key}>
                  <dt>
                    <kbd>{key}</kbd>
                  </dt>
                  <dd>{what}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </dialog>
  )
}
