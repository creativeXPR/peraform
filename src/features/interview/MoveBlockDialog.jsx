import { useEffect, useRef, useState } from 'react'
import { Move, X } from 'lucide-react'

// "Move to…": pick a card on any screen (or, for cards, a screen's top
// level). targets: from moveTargets() in lib/interview.js.
export default function MoveBlockDialog({ open, blockLabel, targets, currentKey, currentParent, onMove, onClose }) {
  const ref = useRef(null)
  const [choice, setChoice] = useState(null) // 'screenKey|cardId' ('' = top level)

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const current = `${currentKey}|${currentParent ?? ''}`
  const picked = choice ?? current
  const [toKey, toParent] = picked.split('|')

  return (
    <dialog
      ref={ref}
      className="confirm move-block"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="confirm-body">
        <div className="collab-head">
          <h2>
            <Move size={18} aria-hidden="true" />
            Move “{blockLabel}”</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p>Choose where it goes. Questions inside move to that screen’s section too.</p>
        <div className="move-list" role="radiogroup" aria-label="Destination">
          {targets.map(({ screen, top, cards }) => (
            <div key={screen.key} className="move-screen">
              <strong>
                {screen.index + 1}. {screen.title}
              </strong>
              {top && (
                <label className="move-option">
                  <input
                    type="radio"
                    name="move-to"
                    checked={picked === `${screen.key}|`}
                    onChange={() => setChoice(`${screen.key}|`)}
                  />
                  On the screen itself
                </label>
              )}
              {cards.map((card) => (
                <label key={card.id} className="move-option" style={{ paddingLeft: 8 + card.depth * 16 }}>
                  <input
                    type="radio"
                    name="move-to"
                    checked={picked === `${screen.key}|${card.id}`}
                    onChange={() => setChoice(`${screen.key}|${card.id}`)}
                  />
                  Inside {card.label}
                  {card.depth > 0 ? ` (level ${card.depth + 1})` : ''}
                </label>
              ))}
              {!top && !cards.length && <span className="move-none">No cards on this screen yet.</span>}
            </div>
          ))}
        </div>
        <div className="confirm-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={picked === current}
            onClick={() => onMove(toKey, toParent || null)}
          >
            Move
          </button>
        </div>
      </div>
    </dialog>
  )
}
