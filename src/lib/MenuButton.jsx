import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import './MenuButton.css'

// Icon button that opens a small popover list.
// items: [{ label, onSelect, checked?, danger?, icon? }]
export default function MenuButton({ icon, label, items, align = 'right', className = '' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e) => !rootRef.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const hasChecks = items.some((item) => 'checked' in item)

  return (
    <div className={`menu-btn ${className}`} ref={rootRef}>
      <button
        type="button"
        className="icon-btn"
        onClick={(e) => {
          // Cards are links/clickable — keep the click from reaching them.
          e.preventDefault()
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {icon}
      </button>
      {open && (
        <div className={`menu-pop menu-pop-${align}`} role="menu">
          {items.map(({ label: itemLabel, onSelect, checked, danger, icon: ItemIcon }) => (
            <button
              key={itemLabel}
              type="button"
              role={hasChecks ? 'menuitemradio' : 'menuitem'}
              aria-checked={hasChecks ? Boolean(checked) : undefined}
              className={`menu-item${danger ? ' menu-item-danger' : ''}`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setOpen(false)
                onSelect()
              }}
            >
              {hasChecks && <Check size={15} className={checked ? '' : 'menu-check-off'} />}
              {ItemIcon && <ItemIcon size={15} />}
              {itemLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
