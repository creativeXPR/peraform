import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Hand, Maximize, Minimize, Minus, MousePointer2, Plus } from 'lucide-react'
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
  const [size, setSize] = useState({ w: 0, h: 0 })
  // While dragging: { id, frame, guides, parentId } — previewed, not saved.
  const [live, setLive] = useState(null)
  // The view: { zoom, x, y } (x/y: where the screen's top-left sits in the
  // viewport), or null to keep fitting the screen in the space available.
  const [view, setView] = useState(null)
  const [tool, setTool] = useState('move') // 'move' | 'hand'
  const [spaceDown, setSpaceDown] = useState(false) // Space = hand, while held
  const [panning, setPanning] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  useLayoutEffect(() => {
    const el = viewportRef.current
    const observer = new ResizeObserver(([entry]) =>
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height }),
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const W = DEVICES[device].width
  const shown = useMemo(
    () => (live ? setFrame(design, live.id, device, live.frame) : design),
    [design, live, device],
  )
  const H = stageHeight(shown, device)
  const fit = fitView(size, W, H)
  const current = view ?? fit
  const zoom = current.zoom
  const handMode = tool === 'hand' || spaceDown

  // Zoom keeping the point under `at` (viewport coordinates) still.
  function zoomTo(nextZoom, at = { x: size.w / 2, y: size.h / 2 }) {
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom))
    setView({
      zoom: z,
      x: at.x - ((at.x - current.x) * z) / current.zoom,
      y: at.y - ((at.y - current.y) * z) / current.zoom,
    })
  }

  // Wheel: Ctrl/⌘ (or a pinch on a trackpad) zooms at the cursor; otherwise
  // it moves the view. A native listener, so the page itself doesn't scroll.
  const wheelRef = useRef(null)
  useEffect(() => {
    wheelRef.current = (e) => {
      e.preventDefault()
      const rect = viewportRef.current.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        zoomTo(current.zoom * Math.exp(-e.deltaY * 0.002), {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        })
      } else {
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX
        const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY
        setView({ ...current, x: current.x - dx, y: current.y - dy })
      }
    }
  })
  useEffect(() => {
    const el = viewportRef.current
    const onWheel = (e) => wheelRef.current?.(e)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Hand tool, Space held, or the middle mouse button: drag the view.
  function startPan(e) {
    e.preventDefault()
    const start = { x: e.clientX, y: e.clientY, vx: current.x, vy: current.y }
    setPanning(true)
    const move = (ev) =>
      setView({ zoom: current.zoom, x: start.vx + ev.clientX - start.x, y: start.vy + ev.clientY - start.y })
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setPanning(false)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function toggleFullscreen() {
    const editor = viewportRef.current.closest('.interview-editor')
    if (document.fullscreenElement) document.exitFullscreen()
    else editor?.requestFullscreen?.()
  }

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
    // With the hand (or the middle button) the viewport pans instead.
    if (e.button !== 0 || handMode) return
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
    const mod = e.ctrlKey || e.metaKey
    if (e.key === ' ') {
      e.preventDefault()
      if (!spaceDown) setSpaceDown(true)
      return
    }
    // View shortcuts (as in Figma).
    const viewKeys = mod
      ? {
          '=': () => zoomTo(current.zoom * 1.25),
          '+': () => zoomTo(current.zoom * 1.25),
          '-': () => zoomTo(current.zoom / 1.25),
          0: () => zoomTo(1),
        }
      : {
          '!': () => setView(null), // Shift+1: fit
          h: () => setTool('hand'),
          H: () => setTool('hand'),
          v: () => setTool('move'),
          V: () => setTool('move'),
        }
    if (viewKeys[e.key]) {
      e.preventDefault()
      viewKeys[e.key]()
      return
    }
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

  const cursor = panning ? 'grabbing' : handMode ? 'grab' : undefined

  return (
    <div
      ref={viewportRef}
      className={`canvas-viewport${handMode ? ' is-hand' : ''}`}
      tabIndex={0}
      aria-label="Screen design. Arrow keys move the selected block; Delete removes it; H for the hand tool, V to move blocks; Ctrl plus or minus to zoom."
      onKeyDown={handleKey}
      onKeyUp={(e) => e.key === ' ' && setSpaceDown(false)}
      onBlur={() => setSpaceDown(false)}
      onPointerDown={(e) => {
        if (handMode || e.button === 1) startPan(e)
        else if (e.button === 0) onSelect(null)
      }}
      style={{
        '--inv': zoom ? 1 / zoom : 1,
        cursor,
        // The dotted grid moves and scales with the view.
        backgroundPosition: `${current.x}px ${current.y}px`,
        backgroundSize: `${GRID * zoom}px ${GRID * zoom}px`,
      }}
    >
      {size.w > 0 && (
        <div
          className="canvas-stage"
          style={{ transform: `translate(${current.x}px, ${current.y}px) scale(${zoom})` }}
        >
          <div className="canvas-frame" style={{ width: W, height: H }}>
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

      <div className="canvas-tools" onPointerDown={(e) => e.stopPropagation()}>
        <div className="canvas-tool-group" role="radiogroup" aria-label="Tool">
          <button
            type="button"
            role="radio"
            aria-checked={tool === 'move'}
            className={tool === 'move' ? 'active' : ''}
            onClick={() => setTool('move')}
            title="Move blocks (V)"
            aria-label="Move tool"
          >
            <MousePointer2 size={16} />
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={tool === 'hand'}
            className={tool === 'hand' ? 'active' : ''}
            onClick={() => setTool('hand')}
            title="Hand: drag to move around (H, or hold Space)"
            aria-label="Hand tool"
          >
            <Hand size={16} />
          </button>
        </div>
        <span className="canvas-tool-sep" />
        <button type="button" onClick={() => zoomTo(zoom / 1.25)} title="Zoom out (Ctrl −)" aria-label="Zoom out">
          <Minus size={16} />
        </button>
        <button type="button" className="canvas-zoom" onClick={() => zoomTo(1)} title="Zoom to 100% (Ctrl 0)">
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" onClick={() => zoomTo(zoom * 1.25)} title="Zoom in (Ctrl +)" aria-label="Zoom in">
          <Plus size={16} />
        </button>
        <button type="button" onClick={() => setView(null)} title="Fit the screen (Shift 1)" aria-label="Fit the screen">
          Fit
        </button>
        <span className="canvas-tool-sep" />
        <button
          type="button"
          onClick={toggleFullscreen}
          title={fullscreen ? 'Exit full screen (Esc)' : 'Full screen'}
          aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
        >
          {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>
      </div>
    </div>
  )
}

const GRID = 24 // dot spacing at 100%
const MIN_ZOOM = 0.1
const MAX_ZOOM = 4

// The whole screen in view (never above 100%), centred, its top in sight.
function fitView(size, W, H) {
  if (!size.w) return { zoom: 1, x: 0, y: 0 }
  const zoom = Math.max(MIN_ZOOM, Math.min(1, (size.w - 64) / W, (size.h - 64) / H))
  return {
    zoom,
    x: (size.w - W * zoom) / 2,
    y: Math.max(32, (size.h - H * zoom) / 2),
  }
}
