const GAP = 6
const EDGE = 8 // keep this far from the window's edges

// Puts a fixed-position popover beside the box `b` (a button's rect),
// inside the visible part of the window.
export function placeMenu(pop, b, align = 'right') {
  const vh = window.visualViewport?.height ?? window.innerHeight
  const vw = window.visualViewport?.width ?? window.innerWidth
  pop.style.maxHeight = ''
  const w = pop.offsetWidth
  const h = pop.offsetHeight
  const roomBelow = vh - EDGE - (b.bottom + GAP)
  const roomAbove = b.top - GAP - EDGE
  const below = h <= roomBelow || roomBelow >= roomAbove
  const fit = Math.min(h, below ? roomBelow : roomAbove)
  // Too long for that side: it scrolls, at least 120px tall.
  const used = fit < h ? Math.max(120, Math.floor(fit)) : h
  if (used < h) pop.style.maxHeight = `${used}px`
  const top = below ? b.bottom + GAP : b.top - GAP - used
  const left = align === 'left' ? b.left : b.right - w
  const wantTop = Math.round(Math.max(EDGE, top))
  const wantLeft = Math.round(Math.min(Math.max(EDGE, left), vw - w - EDGE))
  pop.style.top = `${wantTop}px`
  pop.style.left = `${wantLeft}px`
  // Inside a dialog that's moved or animated (a transform), "fixed" is
  // measured from the dialog, not the window: correct by the difference.
  const r = pop.getBoundingClientRect()
  if (Math.abs(r.top - wantTop) > 1 || Math.abs(r.left - wantLeft) > 1) {
    pop.style.top = `${Math.round(2 * wantTop - r.top)}px`
    pop.style.left = `${Math.round(2 * wantLeft - r.left)}px`
  }
}

// Where an open menu or list is drawn: inside an open dialog when the
// button is in one (a modal dialog covers everything outside it), else in
// the full-screen element, or the app frame (so it keeps the form's theme
// colours), outside any scrolling panel so it's never clipped.
export function portalTarget(el) {
  const dialog = el.closest('dialog[open]')
  if (dialog) return dialog
  const full = document.fullscreenElement
  if (full?.contains(el)) return full
  return el.closest('.shell, .respond') ?? document.body
}
