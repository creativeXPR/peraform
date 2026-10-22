import { isQuestion, splitPages } from './formLogic.js'

// Interview mode: each section of the form is one designed screen, like an
// onboarding flow. Questions are shared with the normal form (same ids, same
// answers); the interview only stores how each screen looks.
//
// form.mode      = 'normal' | 'interview'
// form.interview = { screens: { [screenKey]: Screen } }
//   screenKey: 'start' for the first page, otherwise the section's id
//   Screen = { bg: colour | null, nodes: { [id]: Node } }
//   Node = {
//     id, type, parentId (null = on the screen itself), seq (creation order),
//     frames: { phone: Frame, desktop: Frame }   — each device laid out on its own
//     style:  { bg, radius, padding, opacity, clip, color, font, size, weight, align }
//     …content: text | image | videoId | url | questionId | label + action
//   }
//   Frame = { x, y, w, h, r (degrees), z (level), hidden }
//   Positions are relative to the parent card, in design pixels.

export const DEVICES = {
  phone: { label: 'Phone', width: 390, height: 844 },
  desktop: { label: 'Desktop', width: 1280, height: 800 },
}

// Below this viewport width respondents get the phone design.
export const PHONE_MAX_WIDTH = 767

export const NODE_TYPES = {
  card: { label: 'Card' },
  text: { label: 'Text' },
  image: { label: 'Image' },
  video: { label: 'Video' },
  embed: { label: 'Web page' },
  question: { label: 'Question' },
  button: { label: 'Button' },
}

// Only cards sit directly on the screen; everything else (buttons included)
// goes inside a card. Cards can hold cards.
export const canHoldChildren = (node) => node?.type === 'card'
export const canBeRoot = (type) => type === 'card'

export const BUTTON_ACTIONS = {
  next: 'Next screen',
  back: 'Previous screen',
  submit: 'Submit',
  goto: 'Go to screen…',
}

export const SNAP_DISTANCE = 10
export const MIN_SIZE = 16

export function screenKey(page) {
  return page.section?.id ?? 'start'
}

// The screens in order, one per page (section) of the form.
export function screensOf(form) {
  return splitPages(form.questions ?? []).map((page, index) => ({
    key: screenKey(page),
    index,
    page,
    title: index === 0 ? form.title || 'Untitled form' : page.section.title || `Section ${index + 1}`,
  }))
}

export function interviewOf(form) {
  return form.interview ?? { screens: {} }
}

export function frameOf(node, device) {
  return node.frames?.[device] ?? node.frames?.phone ?? { x: 0, y: 0, w: 100, h: 40, r: 0, z: 0 }
}

// Children of a parent (null = the screen), bottom to top: by level, then
// by creation order.
export function childrenOf(nodes, parentId, device) {
  return Object.values(nodes)
    .filter((n) => (n.parentId ?? null) === parentId)
    .sort((a, b) => frameOf(a, device).z - frameOf(b, device).z || a.seq - b.seq)
}

export function descendantIds(nodes, id) {
  const out = [id]
  for (let i = 0; i < out.length; i++) {
    for (const n of Object.values(nodes)) if (n.parentId === out[i]) out.push(n.id)
  }
  return out
}

export function removeNode(nodes, id) {
  const gone = new Set(descendantIds(nodes, id))
  return Object.fromEntries(Object.entries(nodes).filter(([key]) => !gone.has(key)))
}

// Ancestors from the parent up to the root card.
export function ancestorsOf(nodes, id) {
  const out = []
  let parent = nodes[id]?.parentId
  while (parent && nodes[parent]) {
    out.push(nodes[parent])
    parent = nodes[parent].parentId
  }
  return out
}

// Rotation of everything around a node (its ancestors), in degrees — used
// to turn on-screen drag movement into the parent's own coordinates.
export function inheritedRotation(nodes, id, device) {
  return ancestorsOf(nodes, id).reduce((sum, n) => sum + (frameOf(n, device).r || 0), 0)
}

export function rotateVector(dx, dy, degrees) {
  const t = (degrees * Math.PI) / 180
  return { x: dx * Math.cos(t) - dy * Math.sin(t), y: dx * Math.sin(t) + dy * Math.cos(t) }
}

// Snaps a frame to the parent's left/centre/right and top/middle/bottom
// when it comes within SNAP_DISTANCE. Returns the snapped x/y and the guide
// lines to draw ({ axis: 'x' | 'y', at }).
export function snapFrame(frame, parent, distance = SNAP_DISTANCE) {
  const guides = []
  const pick = (pos, size, total, axis) => {
    const options = [
      { at: 0, value: 0 },
      { at: total / 2, value: (total - size) / 2 },
      { at: total, value: total - size },
    ]
    let best = null
    for (const o of options) {
      const gap = Math.abs(pos - o.value)
      if (gap <= distance && (!best || gap < best.gap)) best = { ...o, gap }
    }
    if (!best) return pos
    guides.push({ axis, at: best.at })
    return best.value
  }
  const x = pick(frame.x, frame.w, parent.w, 'x')
  const y = pick(frame.y, frame.h, parent.h, 'y')
  return { x: Math.round(x), y: Math.round(y), guides }
}

export function newId() {
  return Math.random().toString(36).slice(2, 10)
}

const STYLE_DEFAULTS = {
  card: { bg: 'surface', radius: 20, padding: 0, opacity: 1, clip: false },
  text: { size: 16, weight: 400, align: 'left' },
  button: { bg: 'accent', color: 'on-accent', radius: 999, size: 16, weight: 600, align: 'center' },
}

export function newNode(type, { parentId = null, frames, seq, ...content } = {}) {
  return {
    id: newId(),
    type,
    parentId,
    seq: seq ?? Date.now(),
    frames,
    style: { ...(STYLE_DEFAULTS[type] ?? {}) },
    ...content,
  }
}

// Rough height a question needs, so starter layouts don't overlap.
export function questionHeight(q) {
  const options = (q.options?.length ?? 0) + (q.allowOther ? 1 : 0)
  switch (q.type) {
    case 'paragraph':
      return 150
    case 'multipleChoice':
    case 'checkboxes':
      return 80 + options * 44
    case 'linearScale':
      return 150
    case 'mcGrid':
    case 'checkboxGrid':
      return 90 + (q.rows?.length ?? 1) * 52
    case 'fileUpload':
      return 150
    default:
      return 120
  }
}

// A sensible first design for a screen: one card holding the screen's title,
// its questions stacked, and a Next (or Submit) button. Laid out for both
// devices; the creator rearranges from there.
export function starterScreen(form, screen, isLast) {
  const nodes = {}
  let seq = 1
  // Same ids every time, so an unsaved starter design can be edited: the
  // editor and each edit rebuild it independently and must agree.
  const add = (node) => {
    node.id = `${screen.key}-${node.seq}`
    nodes[node.id] = node
    return node
  }
  const layouts = {
    phone: { cardX: 16, cardW: DEVICES.phone.width - 32, top: 48, pad: 20, titleSize: 26 },
    desktop: { cardX: 320, cardW: 640, top: 64, pad: 32, titleSize: 32 },
  }
  const items = [
    { kind: 'title', h: 44 },
    ...(screen.index === 0 && form.description ? [{ kind: 'desc', h: 60 }] : []),
    ...(screen.index > 0 && screen.page.section?.description ? [{ kind: 'desc', h: 60 }] : []),
    ...screen.page.items.filter(isQuestion).map((q) => ({ kind: 'question', q, h: questionHeight(q) })),
    { kind: 'button', h: 52 },
  ]

  const frames = {}
  for (const [device, L] of Object.entries(layouts)) {
    let y = L.pad
    frames[device] = items.map((item) => {
      const frame = { x: L.pad, y, w: L.cardW - L.pad * 2, h: item.h, r: 0, z: 0 }
      y += item.h + 16
      return frame
    })
    frames[device].card = { x: L.cardX, y: L.top, w: L.cardW, h: y - 16 + L.pad, r: 0, z: 0 }
  }

  const card = add(
    newNode('card', {
      seq: seq++,
      frames: { phone: frames.phone.card, desktop: frames.desktop.card },
    }),
  )
  items.forEach((item, i) => {
    const f = { phone: frames.phone[i], desktop: frames.desktop[i] }
    const common = { parentId: card.id, seq: seq++, frames: f }
    if (item.kind === 'title') {
      const node = add(newNode('text', { ...common, text: screen.title }))
      node.style = { ...node.style, size: layouts.phone.titleSize, weight: 700 }
    } else if (item.kind === 'desc') {
      const text = screen.index === 0 ? form.description : screen.page.section.description
      const node = add(newNode('text', { ...common, text }))
      node.style = { ...node.style, color: 'muted' }
    } else if (item.kind === 'question') {
      add(newNode('question', { ...common, questionId: item.q.id }))
    } else {
      const node = add(
        newNode('button', {
          ...common,
          label: isLast ? 'Submit' : 'Next',
          action: { type: isLast ? 'submit' : 'next' },
        }),
      )
      // Buttons hug their label on wide screens.
      node.frames.desktop = { ...node.frames.desktop, w: 200 }
    }
  })
  return { bg: null, nodes }
}

// The saved design for a screen, or a starter one when there isn't any yet.
export function screenDesign(form, screen, screens = screensOf(form)) {
  return (
    interviewOf(form).screens?.[screen.key] ??
    starterScreen(form, screen, screen.index === screens.length - 1)
  )
}

export function placedQuestionIds(design) {
  return new Set(
    Object.values(design.nodes)
      .filter((n) => n.type === 'question')
      .map((n) => n.questionId),
  )
}

// How tall the stage must be on a device to show everything (at least the
// device's own height).
export function stageHeight(design, device) {
  const roots = childrenOf(design.nodes, null, device)
  const bottom = roots.reduce((max, n) => {
    const f = frameOf(n, device)
    return f.hidden ? max : Math.max(max, f.y + f.h)
  }, 0)
  return Math.max(DEVICES[device].height, bottom + 40)
}

// ── Editing (pure: each returns a new design) ──────────────────

export function updateNode(design, id, fn) {
  if (!design.nodes[id]) return design
  return { ...design, nodes: { ...design.nodes, [id]: fn(design.nodes[id]) } }
}

export function setFrame(design, id, device, patch) {
  return updateNode(design, id, (n) => ({
    ...n,
    frames: { ...n.frames, [device]: { ...frameOf(n, device), ...patch } },
  }))
}

// The same change on both devices (e.g. hiding a card everywhere).
export function setFrameEverywhere(design, id, patch) {
  return Object.keys(DEVICES).reduce((d, device) => setFrame(d, id, device, patch), design)
}

export function setStyle(design, id, patch) {
  return updateNode(design, id, (n) => ({ ...n, style: { ...n.style, ...patch } }))
}

export function setContent(design, id, patch) {
  return updateNode(design, id, (n) => ({ ...n, ...patch }))
}

export function addNode(design, node) {
  return { ...design, nodes: { ...design.nodes, [node.id]: node } }
}

// Default size for a new node inside a parent of the given size.
const NEW_SIZE = {
  card: [240, 160],
  text: [240, 40],
  image: [240, 160],
  video: [320, 180],
  embed: [320, 240],
  question: [320, 120],
  button: [200, 48],
}

// A new node of `type` placed inside `parent` (null = the screen) on every
// device: cards on the screen are centred, everything else sits at the
// parent's top-left with a small margin, clamped to fit.
export function placeNew(design, type, parent, extra = {}) {
  // extra.height: a planned height (questions); the rest is node content.
  const { height, ...content } = extra
  const frames = {}
  for (const device of Object.keys(DEVICES)) {
    const box = parent
      ? frameOf(parent, device)
      : { w: DEVICES[device].width, h: DEVICES[device].height }
    const [w0, h0] = NEW_SIZE[type]
    const w = Math.min(w0, Math.max(MIN_SIZE, box.w - 32))
    const h = height ?? h0
    const siblings = childrenOf(design.nodes, parent?.id ?? null, device)
    const z = siblings.reduce((max, n) => Math.max(max, frameOf(n, device).z || 0), 0)
    // Inside a card: below what's already there (the editor then grows the
    // card to fit, see growToFit).
    const y = siblings.reduce((max, n) => {
      const f = frameOf(n, device)
      return Math.max(max, f.y + f.h + 16)
    }, 16)
    frames[device] = parent
      ? { x: 16, y, w, h, r: 0, z }
      : { x: Math.round((box.w - w) / 2), y: Math.round((box.h - h) / 2), w, h, r: 0, z }
  }
  return newNode(type, { parentId: parent?.id ?? null, frames, ...content })
}

// Copies a node and everything inside it, offset a little so it's visible.
export function duplicateNode(design, id) {
  const ids = descendantIds(design.nodes, id)
  const map = Object.fromEntries(ids.map((old) => [old, newId()]))
  const nodes = { ...design.nodes }
  let seq = Date.now()
  for (const old of ids) {
    const n = design.nodes[old]
    const copy = { ...n, id: map[old], seq: seq++, parentId: n.parentId && map[n.parentId] ? map[n.parentId] : n.parentId }
    if (old === id) {
      copy.frames = Object.fromEntries(
        Object.keys(DEVICES).map((d) => {
          const f = frameOf(n, d)
          return [d, { ...f, x: f.x + 16, y: f.y + 16 }]
        }),
      )
    }
    nodes[copy.id] = copy
  }
  return { design: { ...design, nodes }, id: map[id] }
}

// Makes a card (and the cards around it) tall enough for a child that now
// reaches past its bottom edge, on every device.
export function growToFit(design, childId) {
  let d = design
  for (const device of Object.keys(DEVICES)) {
    let child = d.nodes[childId]
    while (child?.parentId) {
      const parent = d.nodes[child.parentId]
      const cf = frameOf(child, device)
      const pf = frameOf(parent, device)
      const needed = cf.y + cf.h + 16
      if (needed <= pf.h) break
      d = setFrame(d, parent.id, device, { h: needed })
      child = d.nodes[parent.id]
    }
  }
  return d
}

export function deleteNode(design, id) {
  return { ...design, nodes: removeNode(design.nodes, id) }
}

// Colours in a design are either fixed ('#rrggbb', 'transparent') or follow
// the form's theme (these tokens), so a design keeps up with theme changes.
export const COLOR_TOKENS = {
  surface: { label: 'Card', css: 'var(--surface)' },
  bg: { label: 'Page', css: 'var(--bg)' },
  accent: { label: 'Theme colour', css: 'var(--accent)' },
  'accent-soft': { label: 'Soft theme colour', css: 'var(--accent-soft)' },
  'on-accent': { label: 'Text on theme colour', css: 'var(--on-accent)' },
  text: { label: 'Text', css: 'var(--text)' },
  muted: { label: 'Muted text', css: 'var(--text-muted)' },
}

export const colorCss = (value) => (value ? (COLOR_TOKENS[value]?.css ?? value) : undefined)

// Questions a respondent actually sees on a screen: placed, and neither the
// block nor any card around it hidden on this device. Only these are
// required before moving on.
export function visibleQuestionIds(design, device) {
  const ids = new Set()
  for (const node of Object.values(design.nodes)) {
    if (node.type !== 'question') continue
    let shown = true
    for (let n = node; n; n = n.parentId ? design.nodes[n.parentId] : null) {
      if (frameOf(n, device).hidden) {
        shown = false
        break
      }
    }
    if (shown) ids.add(node.questionId)
  }
  return ids
}
