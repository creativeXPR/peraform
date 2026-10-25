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
  pop.style.top = `${Math.round(Math.max(EDGE, top))}px`
  pop.style.left = `${Math.round(Math.min(Math.max(EDGE, left), vw - w - EDGE))}px`
}
