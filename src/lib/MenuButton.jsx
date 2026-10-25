import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import './MenuButton.css'

const GAP = 6
const EDGE = 8 // keep this far from the window's edges

// Where the open list is drawn: outside any scrolling panel (so it's never
// clipped), inside the app frame (so it keeps the form's theme colours), or
// inside the full-screen element when one is showing.
function portalTarget(button) {
  const full = document.fullscreenElement
  if (full?.contains(button)) return full
  return button.closest('.shell, .respond') ?? document.body
}

// Puts a fixed-position popover beside the box `b` (a button's rect),
// inside the visible part of the window.
function placeMenu(pop, b, align = 'right') {
  const vh = window.visualViewport?.height ?? window.innerHeight
  const vw = window.visualViewport?.width ?? window.innerWidth
  pop.style.maxHeight = ''
  const w = pop.offsetWidth
  const h = pop.offsetHeight
  const roomBelow = vh - EDGE - (b.bottom + GAP)
  const roomAbove = b.top - GAP - EDGE
  const below = h <= roomBelow || roomBelow >= roomAbove
  const fit = Math.min(h, below ? roomBelow : roomAbove)
  if (fit < h) pop.style.maxHeight = `${Math.max(120, Math.floor(fit))}px`
  const top = below ? b.bottom + GAP : b.top - GAP - Math.max(120, fit)
  const left = align === 'left' ? b.left : b.right - w
  pop.style.top = `${Math.round(Math.max(EDGE, top))}px`
  pop.style.left = `${Math.round(Math.min(Math.max(EDGE, left), vw - w - EDGE))}px`
}

// Icon button that opens a small popover list.
// items: [{ label, onSelect, checked?, danger?, icon? }]
export default function MenuButton({ icon, label, items, align = 'right', className = '' }) {
  const [target, setTarget] = useState(null) // the portal target while open
  const open = Boolean(target)
  const rootRef = useRef(null)
  const popRef = useRef(null)

  // Placed next to the button: below it (above when there's more room
  // there), lined up with its right or left edge, and nudged to stay on
  // screen. Too long for either side: it scrolls (phones' browser bars
  // included — the visible viewport, not the layout one).
  useLayoutEffect(() => {
    const pop = popRef.current
    const button = rootRef.current
    if (!pop || !button) return
    placeMenu(pop, button.getBoundingClientRect(), align)
  }, [open, align])

  useEffect(() => {
    if (!open) return
    const inside = (node) => rootRef.current?.contains(node) || popRef.current?.contains(node)
    const onPointer = (e) => !inside(e.target) && setTarget(null)
    const onKey = (e) => e.key === 'Escape' && setTarget(null)
    // It's positioned once, so close rather than drift when things move.
    const onMove = (e) => !popRef.current?.contains(e.target) && setTarget(null)
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
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
          // Read now: the event's currentTarget is gone by the time a state
          // updater runs.
          const where = portalTarget(e.currentTarget)
          setTarget((t) => (t ? null : where))
        }}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {icon}
      </button>
      {open &&
        createPortal(
          <div ref={popRef} className="menu-pop" role="menu" aria-label={label}>
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
                  setTarget(null)
                  onSelect()
                }}
              >
                {hasChecks && <Check size={15} className={checked ? '' : 'menu-check-off'} />}
                {ItemIcon && <ItemIcon size={15} />}
                {itemLabel}
              </button>
            ))}
          </div>,
          target,
        )}
    </div>
  )
}
