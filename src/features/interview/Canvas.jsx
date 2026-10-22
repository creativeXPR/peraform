import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  DEVICES,
  MIN_SIZE,
  frameOf,
  inheritedRotation,
  rotateVector,
  setFrame,
  snapFrame,
  stageHeight,
} from '../../lib/interview.js'
import Stage from './Stage.jsx'

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

// The design surface: the screen at a zoom that fits, with selection,
// dragging (snapping to the parent's left/centre/right and top/middle/
// bottom — hold Alt to place freely), resize handles (Shift keeps the shape)
// and a rotate handle (Shift steps by 15°). Changes are previewed live and
// saved once, when the pointer is released.
export default function Canvas({
  design,
  device,
  questions,
  renderQuestion,
  selectedId,
  onSelect,
  onFrame, // (id, patch) — commit a frame change for this device
  onKey, // keyboard shortcuts the editor handles (delete, duplicate…)
  preview, // { nodeId, anim, nonce }: play an animation on the canvas
}) {
  const viewportRef = useRef(null)
  const [width, setWidth] = useState(0)
  // While dragging: { id, frame, guides, parentId } — previewed, not saved.
  const [live, setLive] = useState(null)

  useLayoutEffect(() => {
    const el = viewportRef.current
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const W = DEVICES[device].width
  const zoom = width ? Math.min(1, (width - 32) / W) : 0
  const shown = useMemo(
    () => (live ? setFrame(design, live.id, device, live.frame) : design),
    [design, live, device],
  )
  const H = stageHeight(shown, device)

  function parentBox(node) {
    const parent = node.parentId ? design.nodes[node.parentId] : null
    return parent ? frameOf(parent, device) : { w: W, h: stageHeight(design, device) }
  }

  // Follows the pointer until release; `step(ev)` returns the frame to show.
  function track(node, step) {
    let latest = null
    const move = (ev) => {
      const next = step(ev)
      if (!next) return
      latest = next
      setLive({ id: node.id, parentId: node.parentId ?? null, ...next })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setLive(null)
      if (latest) onFrame(node.id, latest.frame)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function startMove(e, node) {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    viewportRef.current.focus({ preventScroll: true })
    onSelect(node.id)
    const start = { x: e.clientX, y: e.clientY }
    const f0 = frameOf(node, device)
    const box = parentBox(node)
    const rot = inheritedRotation(design.nodes, node.id, device)
    let moving = false
    track(node, (ev) => {
      const d = rotateVector((ev.clientX - start.x) / zoom, (ev.clientY - start.y) / zoom, -rot)
      if (!moving && Math.hypot(d.x, d.y) < 3) return null // a click, not a drag
      moving = true
      let frame = { ...f0, x: Math.round(f0.x + d.x), y: Math.round(f0.y + d.y) }
      let guides = []
      if (!ev.altKey) {
        const snapped = snapFrame(frame, box)
        frame = { ...frame, x: snapped.x, y: snapped.y }
        guides = snapped.guides
      }
      return { frame, guides }
    })
  }

  function startResize(e, node, dir) {
    e.stopPropagation()
    e.preventDefault()
    const start = { x: e.clientX, y: e.clientY }
    const f0 = frameOf(node, device)
    const rot = inheritedRotation(design.nodes, node.id, device) + (f0.r || 0)
    const ratio = f0.w / f0.h
    track(node, (ev) => {
      const d = rotateVector((ev.clientX - start.x) / zoom, (ev.clientY - start.y) / zoom, -rot)
      let { x, y, w, h } = f0
      if (dir.includes('e')) w = f0.w + d.x
      if (dir.includes('s')) h = f0.h + d.y
      if (dir.includes('w')) w = f0.w - d.x
      if (dir.includes('n')) h = f0.h - d.y
      if (ev.shiftKey && dir.length === 2) {
        // Keep the shape: follow whichever side moved further.
        if (Math.abs(w - f0.w) > Math.abs(h - f0.h) * ratio) h = w / ratio
        else w = h * ratio
      }
      w = Math.max(MIN_SIZE, Math.round(w))
      h = Math.max(MIN_SIZE, Math.round(h))
      if (dir.includes('w')) x = f0.x + f0.w - w
      if (dir.includes('n')) y = f0.y + f0.h - h
      return { frame: { ...f0, x, y, w, h }, guides: [] }
    })
  }

  function startRotate(e, node) {
    e.stopPropagation()
    e.preventDefault()
    const el = viewportRef.current.querySelector(`[data-node-id="${node.id}"]`)
    const rect = el.getBoundingClientRect()
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    const f0 = frameOf(node, device)
    const inherited = inheritedRotation(design.nodes, node.id, device)
    track(node, (ev) => {
      let r = (Math.atan2(ev.clientY - center.y, ev.clientX - center.x) * 180) / Math.PI + 90
      r -= inherited
      if (ev.shiftKey) r = Math.round(r / 15) * 15
      r = Math.round(((((r + 180) % 360) + 360) % 360) - 180)
      return { frame: { ...f0, r }, guides: [] }
    })
  }

  function handleKey(e) {
    if (e.target !== viewportRef.current) return // typing in a field
    const node = selectedId && design.nodes[selectedId]
    if (e.key === 'Escape') return onSelect(null)
    if (!node) return
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    if (arrows[e.key]) {
      e.preventDefault()
      const step = e.shiftKey ? 10 : 1
      const f = frameOf(node, device)
      onFrame(node.id, { x: f.x + arrows[e.key][0] * step, y: f.y + arrows[e.key][1] * step })
      return
    }
    onKey?.(e, node)
  }

  const renderHandles = (node) => (
    <div className="canvas-handles" aria-hidden="true">
      {HANDLES.map((dir) => (
        <span
          key={dir}
          className={`canvas-handle canvas-handle-${dir}`}
          onPointerDown={(e) => startResize(e, node, dir)}
        />
      ))}
      <span className="canvas-rotate" onPointerDown={(e) => startRotate(e, node)} />
    </div>
  )

  const renderGuides = (parentId) =>
    live && live.parentId === parentId && live.guides.length > 0 ? (
      <div className="canvas-guides" aria-hidden="true">
        {live.guides.map((g) => (
          <span
            key={`${g.axis}${g.at}`}
            className={`canvas-guide canvas-guide-${g.axis}`}
            style={g.axis === 'x' ? { left: g.at } : { top: g.at }}
          />
        ))}
      </div>
    ) : null

  return (
    <div
      ref={viewportRef}
      className="canvas-viewport"
      tabIndex={0}
      aria-label="Screen design. Arrow keys move the selected block; Delete removes it."
      onKeyDown={handleKey}
      onPointerDown={() => onSelect(null)}
      style={{ '--inv': zoom ? 1 / zoom : 1 }}
    >
      {zoom > 0 && (
        <div className="canvas-frame" style={{ width: W * zoom, height: H * zoom }}>
          <div className="canvas-stage" style={{ transform: `scale(${zoom})` }}>
            <Stage
              design={shown}
              device={device}
              mode="edit"
              questions={questions}
              renderQuestion={renderQuestion}
              selectedId={selectedId}
              onNodePointerDown={startMove}
              renderHandles={renderHandles}
              renderGuides={renderGuides}
              preview={preview}
            />
          </div>
        </div>
      )}
    </div>
  )
}
