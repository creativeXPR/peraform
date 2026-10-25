import { isQuestion, isSection, splitPages } from './formLogic.js'

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
  embed: { label: 'Web page or embed' },
  question: { label: 'Question' },
  button: { label: 'Button' },
}

// Only cards sit directly on the screen; everything else (buttons included)
// goes inside a card. Cards can hold cards.
export const canHoldChildren = (node) => node?.type === 'card'
export const canBeRoot = (type) => type === 'card'

export const BUTTON_ACTIONS = {
  next: 'Next screen',
  none: 'Stay on this screen (effects only)',
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
// Snaps a moving frame to its parent's left/centre/right and top/middle/
// bottom, and to the edges and centres of the other blocks beside it
// (`others`: their frames in the same parent). Returns the snapped x/y and
// the guide lines to draw. Cheap enough to run on every pointer move: a
// few comparisons per sibling.
export function snapFrame(frame, parent, distance = SNAP_DISTANCE, others = []) {
  const guides = []
  const pick = (pos, size, total, axis, starts, ends) => {
    // Lines the frame can line up with, and where that puts it.
    const options = [
      { at: 0, value: 0 },
      { at: total / 2, value: (total - size) / 2 },
      { at: total, value: total - size },
    ]
    for (let i = 0; i < starts.length; i++) {
      const a = starts[i]
      const b = ends[i]
      const mid = (a + b) / 2
      options.push(
        { at: a, value: a }, // start to start
        { at: b, value: b - size }, // end to end
        { at: b, value: b }, // start to end (next to it)
        { at: a, value: a - size }, // end to start
        { at: mid, value: mid - size / 2 }, // centres
      )
    }
    let best = null
    for (const o of options) {
      const gap = Math.abs(pos - o.value)
      if (gap <= distance && (!best || gap < best.gap)) best = { ...o, gap }
    }
    if (!best) return pos
    guides.push({ axis, at: best.at })
    return best.value
  }
  const x = pick(frame.x, frame.w, parent.w, 'x', others.map((o) => o.x), others.map((o) => o.x + o.w))
  const y = pick(frame.y, frame.h, parent.h, 'y', others.map((o) => o.y), others.map((o) => o.y + o.h))
  return { x: Math.round(x), y: Math.round(y), guides }
}

// Hidden blocks give their space back, live: blocks below a hidden one (in
// the same column) move up by its height plus the gap after it, and a card
// shrinks by what its contents gave up, which moves blocks below the card
// in turn. isHidden(node) → boolean (design + actions). Returns the frames
// that changed: { [id]: frame }. Showing the block again puts everything
// back, since this is worked out fresh from the design each time.
export function collapseHidden(design, device, isHidden) {
  const out = {}
  const frame = (n) => out[n.id] ?? frameOf(n, device)
  const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w

  function layout(parentId) {
    const kids = childrenOf(design.nodes, parentId, device)
    // Inside first, so a card's own shrink is known before its siblings move.
    for (const k of kids) if (k.type === 'card') layout(k.id)

    // Space given back: by hidden blocks, and at the bottom of shrunk cards.
    const gaps = []
    for (const k of kids) {
      const f = frameOf(k, device)
      if (isHidden(k)) {
        const below = kids
          .filter((o) => o !== k && !isHidden(o) && overlaps(frameOf(o, device), f) && frameOf(o, device).y >= f.y + f.h)
          .map((o) => frameOf(o, device).y - (f.y + f.h))
        gaps.push({ at: f.y, size: f.h + (below.length ? Math.min(...below) : 0), x: f.x, w: f.w })
      } else if (out[k.id] && out[k.id].h < f.h) {
        gaps.push({ at: f.y + out[k.id].h, size: f.h - out[k.id].h, x: f.x, w: f.w })
      }
    }
    if (!gaps.length) return

    let lowest = 0
    let lowestBefore = 0
    for (const k of kids) {
      const f = frameOf(k, device)
      lowestBefore = Math.max(lowestBefore, f.y + f.h)
      if (isHidden(k)) continue
      const shift = gaps.filter((g) => g.at < f.y && overlaps(g, f)).reduce((sum, g) => sum + g.size, 0)
      const current = frame(k)
      if (shift) out[k.id] = { ...current, y: f.y - shift }
      lowest = Math.max(lowest, f.y - shift + current.h)
    }
    // The card holding them shrinks by what its contents gave back.
    if (parentId) {
      const card = design.nodes[parentId]
      const cf = frameOf(card, device)
      const shrink = Math.max(0, lowestBefore - lowest)
      if (shrink) out[card.id] = { ...frame(card), h: Math.max(MIN_SIZE, cf.h - shrink) }
    }
  }

  layout(null)
  return out
}

// How tall a text block's words need to be at its font size and width, in
// px: a word-wrap estimate (average glyph ≈ 0.56 × the font size, lines at
// 1.35 as on the stage). Errs a little generous.
export function textHeight(text, size = 16, width = 200) {
  const perLine = Math.max(1, Math.floor(width / (size * 0.56)))
  let lines = 0
  for (const para of String(text ?? '').split('\n')) {
    lines += 1
    let used = 0
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (used === 0) used = word.length
      else if (used + 1 + word.length <= perLine) used += 1 + word.length
      else {
        lines += 1
        used = word.length
      }
      while (used > perLine) {
        lines += 1
        used -= perLine
      }
    }
  }
  return Math.ceil(lines * size * 1.35)
}

// Grows text blocks whose words no longer fit (a bigger font, a longer
// heading) and moves what's below them in the same column down by as much,
// growing the card. Returns the same design when everything fits.
export function fitText(design) {
  let d = design
  for (const device of Object.keys(DEVICES)) {
    for (const node of Object.values(design.nodes)) {
      if (node.type !== 'text') continue
      const current = d.nodes[node.id]
      const f = frameOf(current, device)
      const pad = (current.style?.padding ?? 0) * 2
      const needed = textHeight(current.text, current.style?.size ?? 16, f.w - pad) + pad
      if (needed <= f.h) continue
      const grow = needed - f.h
      const bottom = f.y + f.h
      d = setFrame(d, node.id, device, { h: needed })
      for (const sib of childrenOf(d.nodes, current.parentId ?? null, device)) {
        if (sib.id === node.id) continue
        const sf = frameOf(sib, device)
        const sameColumn = sf.x < f.x + f.w && f.x < sf.x + sf.w
        if (sameColumn && sf.y >= bottom - 1) d = setFrame(d, sib.id, device, { y: sf.y + grow })
      }
    }
  }
  return d
}

// A live screen's layout: frames moved by hidden blocks (design + action
// overrides), and the stage height that results.
export function liveLayout(design, device, overrides = {}) {
  const layout = collapseHidden(design, device, (n) => overrides[n.id]?.hidden ?? frameOf(n, device).hidden ?? false)
  const nodes = { ...design.nodes }
  for (const [id, frame] of Object.entries(layout)) {
    nodes[id] = { ...nodes[id], frames: { ...nodes[id].frames, [device]: frame } }
  }
  return { layout, height: stageHeight({ ...design, nodes }, device) }
}

// Lines up several blocks (same parent) on their shared edge or centre:
// how = left | center | right | top | middle | bottom. Returns frame
// patches: { [id]: { x } | { y } }.
export function alignFrames(frames, how) {
  const list = Object.entries(frames)
  if (list.length < 2) return {}
  const left = Math.min(...list.map(([, f]) => f.x))
  const right = Math.max(...list.map(([, f]) => f.x + f.w))
  const top = Math.min(...list.map(([, f]) => f.y))
  const bottom = Math.max(...list.map(([, f]) => f.y + f.h))
  const at = {
    left: () => ({ x: left }),
    center: (f) => ({ x: Math.round((left + right) / 2 - f.w / 2) }),
    right: (f) => ({ x: right - f.w }),
    top: () => ({ y: top }),
    middle: (f) => ({ y: Math.round((top + bottom) / 2 - f.h / 2) }),
    bottom: (f) => ({ y: bottom - f.h }),
  }[how]
  return Object.fromEntries(list.map(([id, f]) => [id, at(f)]))
}

// What a block does with content that doesn't fit (style.overflow), for
// every kind of block. Before this setting: cards used style.clip, text and
// questions scrolled, the rest showed it.
export const OVERFLOW = {
  scroll: 'Scroll',
  hidden: 'Hidden',
  visible: 'Visible',
}
export function overflowOf(node) {
  const o = node.style?.overflow
  if (OVERFLOW[o]) return o
  if (node.type === 'card') return node.style?.clip ? 'hidden' : 'visible'
  return node.type === 'text' || node.type === 'question' ? 'scroll' : 'visible'
}
// The CSS value: "scroll" only shows a scrollbar when it's needed.
export const overflowCss = (value) => (value === 'scroll' ? 'auto' : value)

// The address for an embed block from what the creator pasted: a web
// address, or an <iframe> embed code (its src). Only https; null otherwise.
export function embedSrc(input) {
  const text = String(input ?? '').trim()
  const fromIframe = text.match(/<iframe\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/i)?.[2]
  const url = (fromIframe ?? text).replace(/&amp;/g, '&').trim()
  return /^https:\/\/[^\s"'<>]+$/i.test(url) ? url : null
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
    case 'longText':
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
    } else if (screen.index === 0) {
      const node = add(
        newNode('button', {
          ...common,
          label: isLast ? 'Submit' : 'Next',
          action: { type: isLast ? 'submit' : 'next' },
        }),
      )
      // Buttons hug their label on wide screens.
      node.frames.desktop = { ...node.frames.desktop, w: 200 }
    } else {
      // Later screens: Back, then Next/Submit, side by side (as in normal mode).
      const { phone, desktop } = f
      const half = Math.floor((phone.w - 12) / 2)
      const back = add(
        newNode('button', {
          parentId: card.id,
          seq: seq++,
          frames: { phone: { ...phone, w: half }, desktop: { ...desktop, w: 140 } },
          label: 'Back',
          action: { type: 'back' },
        }),
      )
      // Quieter than the main button.
      back.style = { ...back.style, bg: 'accent-soft', color: 'accent' }
      add(
        newNode('button', {
          ...common,
          frames: {
            phone: { ...phone, x: phone.x + half + 12, w: phone.w - half - 12 },
            desktop: { ...desktop, x: desktop.x + 152, w: 200 },
          },
          label: isLast ? 'Submit' : 'Next',
          action: { type: isLast ? 'submit' : 'next' },
        }),
      )
    }
  })
  // A long title may need more lines than planned.
  return fitText({ bg: null, nodes })
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

// ── Shared or per-device look ─────────────────────────────────────────
// Position and size are always per device (frames). A block's look (style)
// and words (text, button label) are shared by phone and desktop unless
// the creator turns sharing off: then node.split = true and each device
// has its own copy in node.byDevice[device] = { style, text?, label? }.
export const DEVICE_CONTENT = ['text', 'label']

// The block as a device shows it.
export function resolveNode(node, device) {
  if (!node?.split) return node
  const own = node.byDevice?.[device]
  if (!own) return node
  const out = { ...node, style: { ...node.style, ...own.style } }
  for (const k of DEVICE_CONTENT) if (own[k] !== undefined) out[k] = own[k]
  return out
}

// Turns sharing off (each device starts from the shared values) or on
// (the device being edited wins; the other's differences go).
export function setSplit(design, id, split, device) {
  return updateNode(design, id, (n) => {
    if (split) {
      const copy = () => ({
        style: { ...n.style },
        ...Object.fromEntries(DEVICE_CONTENT.filter((k) => n[k] !== undefined).map((k) => [k, n[k]])),
      })
      return { ...n, split: true, byDevice: Object.fromEntries(Object.keys(DEVICES).map((d) => [d, copy()])) }
    }
    // eslint-disable-next-line no-unused-vars -- dropping the per-device copies
    const { split: _s, byDevice, ...rest } = resolveNode(n, device)
    return rest
  })
}

// Do phone and desktop differ? (Turning sharing back on would lose that.)
export function differsByDevice(node) {
  if (!node?.split) return false
  const looks = Object.keys(DEVICES).map((d) => {
    const r = resolveNode(node, d)
    const style = Object.fromEntries(Object.entries(r.style ?? {}).sort(([a], [b]) => a.localeCompare(b)))
    return JSON.stringify([style, ...DEVICE_CONTENT.map((k) => r[k])])
  })
  return looks[0] !== looks[1]
}

// A style change: on the device being edited when the block has its own
// per device, otherwise shared.
export function setStyleOn(design, id, device, patch) {
  const n = design.nodes[id]
  if (!n?.split) return setStyle(design, id, patch)
  return updateNode(design, id, (x) => {
    const own = x.byDevice?.[device] ?? {}
    return { ...x, byDevice: { ...x.byDevice, [device]: { ...own, style: { ...own.style, ...patch } } } }
  })
}

// A content change: text and labels go to the device being edited when
// the block is split; everything else (actions, images…) is shared.
export function setContentOn(design, id, device, patch) {
  const n = design.nodes[id]
  if (!n?.split) return setContent(design, id, patch)
  const own = Object.fromEntries(Object.entries(patch).filter(([k]) => DEVICE_CONTENT.includes(k)))
  const shared = Object.fromEntries(Object.entries(patch).filter(([k]) => !DEVICE_CONTENT.includes(k)))
  return updateNode(design, id, (x) => ({
    ...x,
    ...shared,
    ...(Object.keys(own).length && { byDevice: { ...x.byDevice, [device]: { ...x.byDevice?.[device], ...own } } }),
  }))
}

// fn(style) → style applied everywhere a block keeps a style (shared and
// each device's own): design styles, dark mode.
export function mapStyle(node, fn) {
  const next = { ...node, style: fn(node.style ?? {}) }
  if (node.byDevice) {
    next.byDevice = Object.fromEntries(
      Object.entries(node.byDevice).map(([d, own]) => [d, { ...own, style: fn(own.style ?? {}) }]),
    )
  }
  return next
}

// The last screen a respondent will see (actions hid the ones after it):
// its "Next" buttons read "Submit", as they now submit. Custom labels stay.
export function nextAsSubmit(design) {
  let nodes = null
  for (const n of Object.values(design.nodes)) {
    if (n.type !== 'button' || (n.action?.type ?? 'next') !== 'next') continue
    const labels = [n.label, ...Object.values(n.byDevice ?? {}).map((o) => o.label)]
    if (!labels.some((l) => /^\s*next\b/i.test(l ?? 'Next'))) continue
    nodes ??= { ...design.nodes }
    const relabel = (l) => (/^\s*next\b/i.test(l ?? 'Next') ? 'Submit' : l)
    nodes[n.id] = {
      ...n,
      label: relabel(n.label),
      ...(n.byDevice && {
        byDevice: Object.fromEntries(Object.entries(n.byDevice).map(([d, o]) => [d, o.label === undefined ? o : { ...o, label: relabel(o.label) }])),
      }),
    }
  }
  return nodes ? { ...design, nodes } : design
}

// Words set everywhere (AI headings): shared and each device's own.
export function setContentEverywhere(node, patch) {
  const next = { ...node, ...patch }
  if (node.byDevice) {
    next.byDevice = Object.fromEntries(Object.entries(node.byDevice).map(([d, own]) => [d, { ...own, ...patch }]))
  }
  return next
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
    // Inside a card: below what’s already there (the card keeps its size;
    // "Fit to blocks" makes room, see fitCard).
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

// "Fit height" (only when clicked): a block becomes `h` px tall on one
// device, and the blocks below it in the same column move by as much, so
// nothing overlaps; the card around it makes room.
export function fitBlockHeight(design, id, device, h) {
  const node = design.nodes[id]
  if (!node) return design
  const f = frameOf(node, device)
  const delta = Math.max(MIN_SIZE, Math.round(h)) - f.h
  if (!delta) return design
  let d = setFrame(design, id, device, { h: f.h + delta })
  for (const sib of childrenOf(d.nodes, node.parentId ?? null, device)) {
    if (sib.id === id) continue
    const sf = frameOf(sib, device)
    const sameColumn = sf.x < f.x + f.w && f.x < sf.x + sf.w
    if (sameColumn && sf.y >= f.y + f.h - 1) d = setFrame(d, sib.id, device, { y: sf.y + delta })
  }
  for (const sib of childrenOf(d.nodes, node.parentId ?? null, device)) d = growToFit(d, sib.id)
  return d
}

// "Fit to blocks": a card hugs what's inside it, with `pad` px between the
// blocks and every edge, on one device. Extra space goes (or missing space
// is added); the blocks stay where they are on the screen and the card
// moves to meet them. A card with nothing in it is left as it is.
export function fitCard(design, id, device, pad = 16) {
  const card = design.nodes[id]
  const kids = card?.type === 'card' ? childrenOf(design.nodes, id, device) : []
  if (!kids.length) return design
  const frames = kids.map((k) => frameOf(k, device))
  const minX = Math.min(...frames.map((f) => f.x))
  const minY = Math.min(...frames.map((f) => f.y))
  const maxX = Math.max(...frames.map((f) => f.x + f.w))
  const maxY = Math.max(...frames.map((f) => f.y + f.h))
  const dx = minX - pad
  const dy = minY - pad
  let d = design
  kids.forEach((k, i) => {
    d = setFrame(d, k.id, device, { x: frames[i].x - dx, y: frames[i].y - dy })
  })
  const cf = frameOf(card, device)
  d = setFrame(d, id, device, {
    x: cf.x + dx,
    y: cf.y + dy,
    w: Math.max(MIN_SIZE, maxX - minX + pad * 2),
    h: Math.max(MIN_SIZE, maxY - minY + pad * 2),
  })
  // A card inside a card: the outer one still holds it.
  return growToFit(d, id)
}

export function deleteNode(design, id) {
  return { ...design, nodes: removeNode(design.nodes, id) }
}

// The creator took blocks off this screen: like deleteNode, and the
// questions they showed are remembered as removed (design.removed), so
// keeping in step with the question list never puts them back.
export function removeBlocks(design, ids) {
  const gone = new Set()
  let d = design
  for (const id of ids) {
    if (!d.nodes[id]) continue
    for (const x of descendantIds(d.nodes, id)) if (d.nodes[x]?.type === 'question') gone.add(d.nodes[x].questionId)
    d = deleteNode(d, id)
  }
  // Still shown by another block on this screen: not removed.
  for (const q of placedQuestionIds(d)) gone.delete(q)
  return gone.size ? { ...d, removed: [...new Set([...(d.removed ?? []), ...gone])] } : d
}

// A question block put (back) on the screen: no longer "removed".
export function unremove(design, questionId) {
  if (!design.removed?.includes(questionId)) return design
  return { ...design, removed: design.removed.filter((q) => q !== questionId) }
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
// block nor any card around it hidden on this device (or by an action:
// overrides from lib/actions.js). Only these are required before moving on.
export function visibleQuestionIds(design, device, overrides = {}) {
  const ids = new Set()
  for (const node of Object.values(design.nodes)) {
    if (node.type !== 'question') continue
    let shown = true
    for (let n = node; n; n = n.parentId ? design.nodes[n.parentId] : null) {
      if (overrides[n.id]?.hidden ?? frameOf(n, device).hidden) {
        shown = false
        break
      }
    }
    if (shown) ids.add(node.questionId)
  }
  return ids
}

// A short, human name for a block (layers list, action targets).
export function nodeLabel(node, questions = []) {
  if (node.type === 'text') return node.text?.split('\n')[0] || 'Text'
  if (node.type === 'button') return `Button: ${node.label || 'Button'}`
  if (node.type === 'question') {
    return questions.find((q) => q.id === node.questionId)?.title || 'Question'
  }
  return NODE_TYPES[node.type].label
}

// Block shadows (style.shadow). Glow follows the theme colour.
export const SHADOWS = {
  none: { label: 'None', css: 'none' },
  soft: { label: 'Soft', css: '0 2px 10px rgb(0 0 0 / 0.08)' },
  medium: { label: 'Medium', css: '0 10px 30px rgb(0 0 0 / 0.14)' },
  strong: { label: 'Strong', css: '0 22px 56px rgb(0 0 0 / 0.26)' },
  glow: { label: 'Glow', css: '0 0 28px color-mix(in srgb, var(--accent) 55%, transparent)' },
}

// One-click glassmorphism: see-through background, blur behind, a thin
// light edge and a soft shadow.
export const GLASS = { bgAlpha: 35, blur: 16, borderWidth: 1, borderColor: '#ffffff', shadow: 'medium' }

// A background colour at an opacity (style.bgAlpha, %), for see-through
// blocks without fading their content.
export function backgroundCss(bg, alpha = 100) {
  const css = colorCss(bg)
  // Gradients are used as they are (see lib/designStyles.js).
  if (!css || alpha >= 100 || css.includes('gradient(')) return css
  return `color-mix(in srgb, ${css} ${Math.max(0, alpha)}%, transparent)`
}

// ── Duplicating and moving blocks (whole-form operations) ─────────────
// These work on the form draft, because blocks can carry questions, and
// questions belong to sections of the (shared) question list.

function withDesign(form, key, design) {
  const iv = interviewOf(form)
  return { ...form, interview: { ...iv, screens: { ...iv.screens, [key]: design } } }
}

function designFor(form, key) {
  const screens = screensOf(form)
  const screen = screens.find((s) => s.key === key)
  return screen ? screenDesign(form, screen, screens) : null
}

// Where a moved/new top-level card or child goes on each device: inside a
// card, below what's there; on a screen, centred below the other cards.
function placeIn(design, parent, node) {
  const frames = {}
  for (const device of Object.keys(DEVICES)) {
    const f = frameOf(node, device)
    const siblings = childrenOf(design.nodes, parent?.id ?? null, device).filter((n) => n.id !== node.id)
    const below = siblings.reduce((max, n) => {
      const sf = frameOf(n, device)
      return Math.max(max, sf.y + sf.h + 16)
    }, parent ? 16 : 48)
    const box = parent ? frameOf(parent, device) : { w: DEVICES[device].width }
    const w = Math.min(f.w, Math.max(MIN_SIZE, box.w - 32))
    frames[device] = { ...f, w, x: parent ? Math.min(f.x, Math.max(0, box.w - w)) : Math.round((box.w - w) / 2), y: below }
  }
  return frames
}

// Copies a block (and what's inside it) on its screen. Question blocks get
// their own new question — a copy placed right after the original — so the
// copy isn't a second input for the same answer.
// Returns { form, id } (the copy's id).
export function duplicateBlock(form, key, id) {
  const design = designFor(form, key)
  if (!design?.nodes[id]) return { form, id: null }
  const { design: copied, id: copyId } = duplicateNode(design, id)
  let questions = [...(form.questions ?? [])]
  const nodes = { ...copied.nodes }
  for (const nid of descendantIds(copied.nodes, copyId)) {
    const n = nodes[nid]
    if (n.type !== 'question') continue
    const at = questions.findIndex((q) => q.id === n.questionId)
    if (at < 0) continue
    const q = { ...structuredClone(questions[at]), id: newId() }
    questions = [...questions.slice(0, at + 1), q, ...questions.slice(at + 1)]
    nodes[nid] = { ...n, questionId: q.id }
  }
  const next = { ...copied, nodes }
  return { form: withDesign({ ...form, questions }, key, next), id: copyId }
}

// A card named by the first text inside it ("Card · Welcome"), so cards
// can be told apart in lists.
function cardName(design, card) {
  const text = descendantIds(design.nodes, card.id)
    .map((id) => design.nodes[id])
    .find((n) => n.type === 'text' && n.text?.trim())
  return text ? `Card · ${text.text.trim().split(/\s*\n/)[0].slice(0, 40)}` : 'Card'
}

// ── Screens out of step with the question list ──────────────────────
// The question list (Edit questions) says which screen each question is
// on. When it changes, nothing in a design changes by itself: the design
// editor lists what's out of step on a screen, each with a button.
//   unplaced — this page's questions with no block here (not ones the
//              creator took off on purpose: design.removed) → placeQuestions
//   moved    — a block showing a question that's now on another page
//              → moveStrayBlock, or remove it
//   button   — a Next/Submit button PeraForm made that no longer fits the
//              screen's place (never one whose action the creator chose)
// Respondents meanwhile only see this page's questions (withoutStrays).
export function screenIssues(form, screen, design, screens = screensOf(form)) {
  const issues = []
  const onPage = new Set(screen.page.items.filter(isQuestion).map((q) => q.id))
  const placed = placedQuestionIds(design)
  const unplaced = screen.page.items.filter(isQuestion).filter((q) => !placed.has(q.id) && !design.removed?.includes(q.id))
  if (unplaced.length) issues.push({ kind: 'unplaced', questions: unplaced })
  const home = new Map()
  for (const s of screens) for (const q of s.page.items) if (isQuestion(q)) home.set(q.id, s)
  for (const n of Object.values(design.nodes)) {
    if (n.type !== 'question' || onPage.has(n.questionId)) continue
    const to = home.get(n.questionId)
    if (to) issues.push({ kind: 'moved', nodeId: n.id, questionId: n.questionId, to })
  }
  const isLast = screen.index === screens.length - 1
  for (const n of Object.values(design.nodes)) {
    if (n.type !== 'button' || n.action?.chosen) continue
    const type = n.action?.type ?? 'next'
    if (isLast && type === 'next') issues.push({ kind: 'button', nodeId: n.id, want: 'submit' })
    else if (!isLast && type === 'submit') issues.push({ kind: 'button', nodeId: n.id, want: 'next' })
  }
  return issues
}

// "Place them": each question gets a block in the screen's main card,
// above its buttons.
export function placeQuestions(design, questions) {
  return questions.reduce((d, q) => addQuestionBlock(unremove(d, q.id), q), design)
}

// "Fix" for a button: Next ↔ Submit (a default label follows; a custom one
// stays). Marked chosen, so it's settled.
export function fixButton(design, id, want) {
  const n = design.nodes[id]
  if (!n) return design
  const relabel = (l) => (want === 'submit' ? (l === 'Next' ? 'Submit' : l) : l === 'Submit' ? 'Next' : l)
  const fixed = { ...n, action: { type: want, chosen: true }, label: relabel(n.label) }
  if (n.byDevice) {
    fixed.byDevice = Object.fromEntries(
      Object.entries(n.byDevice).map(([d, own]) => [d, own.label === undefined ? own : { ...own, label: relabel(own.label) }]),
    )
  }
  return { ...design, nodes: { ...design.nodes, [id]: fixed } }
}

// "Move it there": the block goes to its question's screen (into its main
// card); the question list is left exactly as it is.
export function moveStrayBlock(form, fromKey, id, toKey) {
  const from = designFor(form, fromKey)
  const to = designFor(form, toKey)
  if (!from?.nodes[id] || !to) return form
  const card = Object.values(to.nodes)
    .filter((n) => n.type === 'card' && !n.parentId)
    .sort((a, b) => a.seq - b.seq)[0]
  if (!card) return form
  const ids = descendantIds(from.nodes, id)
  const moving = Object.fromEntries(ids.map((nid) => [nid, from.nodes[nid]]))
  const root = { ...moving[id], parentId: card.id }
  root.frames = placeIn(to, card, root)
  const target = unremove({ ...to, nodes: { ...to.nodes, ...moving, [id]: root } }, root.questionId)
  return withDesign(withDesign(form, fromKey, deleteNode(from, id)), toKey, target)
}

// Respondents: a block whose question is now on another page isn't shown
// here (the creator hasn't moved or removed it yet). Display only.
export function withoutStrays(design, page) {
  const onPage = new Set(page.items.filter(isQuestion).map((q) => q.id))
  const strays = Object.values(design.nodes).filter((n) => n.type === 'question' && !onPage.has(n.questionId))
  return strays.length ? strays.reduce((d, n) => (d.nodes[n.id] ? deleteNode(d, n.id) : d), design) : design
}

// Adds a question's block to a design's main card (the first card), just
// above its buttons, pushing the buttons down. `reuse`: a block that held
// this question on another screen; its look is kept.
function addQuestionBlock(design, question, reuse) {
  const cards = Object.values(design.nodes)
    .filter((n) => n.type === 'card' && !n.parentId)
    .sort((a, b) => a.seq - b.seq)
  const card = cards[0]
  if (!card) return design
  const node = reuse
    ? { ...reuse, parentId: card.id }
    : newNode('question', { parentId: card.id, seq: nextSeq(design), questionId: question.id })
  const h = questionHeight(question)
  const frames = {}
  const nodes = { ...design.nodes }
  for (const device of Object.keys(DEVICES)) {
    const kids = childrenOf(design.nodes, card.id, device)
    const box = frameOf(card, device)
    const pad = kids.length ? Math.min(...kids.map((k) => frameOf(k, device).x)) : 20
    const buttons = kids.filter((k) => k.type === 'button').map((k) => frameOf(k, device).y)
    const bottom = kids.reduce((max, k) => Math.max(max, frameOf(k, device).y + frameOf(k, device).h + 16), pad)
    const y = buttons.length ? Math.min(...buttons) : bottom
    // Everything at or below the insertion point moves down to make room.
    for (const k of kids) {
      const f = frameOf(k, device)
      if (f.y >= y) nodes[k.id] = { ...nodes[k.id], frames: { ...nodes[k.id].frames, [device]: { ...f, y: f.y + h + 16 } } }
    }
    frames[device] = { x: pad, y, w: Math.max(MIN_SIZE, box.w - pad * 2), h, r: 0, z: 0 }
  }
  nodes[node.id] = { ...node, frames }
  // The card keeps its size ("Fit to blocks" makes room when wanted).
  return { ...design, nodes }
}

function nextSeq(design) {
  return Object.values(design.nodes).reduce((max, n) => Math.max(max, n.seq ?? 0), 0) + 1
}

// ── Keep (lib/keep.js): design blocks ────────────────────────────────
// What a kept block carries: it, everything inside it, and the questions
// its question blocks show (so it can be pasted into another form).
export function keepBlockData(design, id, questions = []) {
  const ids = descendantIds(design.nodes, id)
  const nodes = Object.fromEntries(ids.map((nid) => [nid, design.nodes[nid]]))
  const shown = new Set(ids.map((nid) => nodes[nid]).filter((n) => n.type === 'question').map((n) => n.questionId))
  return { rootId: id, nodes, questions: questions.filter((q) => shown.has(q.id)) }
}

// Where a screen's questions end in the form's list (new ones go there).
function pageEnd(questions, key) {
  const start = key === 'start' ? 0 : questions.findIndex((q) => q.id === key) + 1
  if (key !== 'start' && start === 0) return questions.length
  const next = questions.findIndex((q, i) => i >= start && isSection(q))
  return next < 0 ? questions.length : next
}

// A kept block pasted onto a screen: into the card `parentId` (or the card
// around that block), or — for a card — onto the screen when none is
// picked; anything else with no card picked goes into the screen's first
// card. Everything gets new ids; its questions are copied into this
// screen's section. Actions only keep targets that come along or exist
// here. Returns { form, id } (the pasted block's id, or null).
export function pasteBlock(form, key, data, parentId = null) {
  const design = designFor(form, key)
  const root = data?.nodes?.[data.rootId]
  if (!design || !root) return { form, id: null }
  let parent = parentId ? design.nodes[parentId] : null
  if (parent && parent.type !== 'card') parent = parent.parentId ? design.nodes[parent.parentId] : null
  if (!parent && root.type !== 'card') {
    parent = Object.values(design.nodes)
      .filter((n) => n.type === 'card' && !n.parentId)
      .sort((a, b) => a.seq - b.seq)[0]
    if (!parent) return { form, id: null }
  }

  const map = Object.fromEntries(Object.keys(data.nodes).map((old) => [old, newId()]))
  const qmap = {}
  const existing = new Set((form.questions ?? []).map((q) => q.id))
  const copies = (data.questions ?? []).map((q) => {
    const id = newId()
    qmap[q.id] = id
    const copy = { ...structuredClone(q), id }
    if (copy.actions) copy.actions = copy.actions.filter((a) => existing.has(a.target))
    return copy
  })
  const keepTarget = (t) => map[t] ?? (design.nodes[t] || screensOf(form).some((s) => s.key === t) ? t : null)
  let seq = nextSeq(design)
  const nodes = { ...design.nodes }
  for (const [old, n] of Object.entries(data.nodes)) {
    const copy = structuredClone(n)
    copy.id = map[old]
    copy.seq = seq++
    copy.parentId = old === data.rootId ? (parent?.id ?? null) : (map[n.parentId] ?? null)
    if (copy.questionId) copy.questionId = qmap[copy.questionId] ?? copy.questionId
    if (copy.actions) {
      copy.actions = copy.actions
        .map((a) => ({ ...a, target: keepTarget(a.target) }))
        .filter((a) => a.target)
    }
    nodes[copy.id] = copy
  }
  const rootCopy = nodes[map[data.rootId]]
  nodes[rootCopy.id] = { ...rootCopy, frames: placeIn({ ...design, nodes }, parent, rootCopy) }

  const qs = [...(form.questions ?? [])]
  const at = pageEnd(qs, key)
  const questions = [...qs.slice(0, at), ...copies, ...qs.slice(at)]
  return { form: withDesign({ ...form, questions }, key, { ...design, nodes }), id: rootCopy.id }
}

// Where a block may go: { key (screen), parentId (card id, or null for the
// screen itself — cards only) }. Not into itself or its own contents.
export function moveTargets(form, key, id) {
  const fromDesign = designFor(form, key)
  const node = fromDesign?.nodes[id]
  if (!node) return []
  const inside = new Set(descendantIds(fromDesign.nodes, id))
  return screensOf(form).map((screen) => {
    const design = screen.key === key ? fromDesign : designFor(form, screen.key)
    const cards = Object.values(design.nodes)
      .filter((n) => n.type === 'card' && !(screen.key === key && inside.has(n.id)))
      .map((n) => ({ id: n.id, depth: ancestorsOf(design.nodes, n.id).length, label: cardName(design, n) }))
    return { screen, top: node.type === 'card', cards }
  })
}

// Moves a block (with its contents) into a card — on this screen or
// another — or, for cards, onto a screen's top level. Questions inside move
// with it: to the end of the target screen's section in the question list.
export function moveBlock(form, fromKey, id, toKey, parentId) {
  const from = designFor(form, fromKey)
  const node = from?.nodes[id]
  if (!node || (!parentId && node.type !== 'card')) return form
  const ids = descendantIds(from.nodes, id)
  if (fromKey === toKey && ids.includes(parentId)) return form

  const moving = Object.fromEntries(ids.map((nid) => [nid, from.nodes[nid]]))
  let source = deleteNode(from, id)
  let target = fromKey === toKey ? source : designFor(form, toKey)
  const parent = parentId ? target.nodes[parentId] : null
  if (parentId && !parent) return form
  const root = { ...moving[id], parentId: parentId ?? null }
  root.frames = placeIn(target, parent, root)
  target = { ...target, nodes: { ...target.nodes, ...moving, [id]: root } }
  if (fromKey === toKey) source = target

  let next = withDesign(form, toKey, target)
  if (fromKey !== toKey) next = withDesign(next, fromKey, source)

  // Questions follow their blocks into the target screen's section.
  if (fromKey !== toKey) {
    const qids = new Set(ids.map((nid) => moving[nid]).filter((n) => n.type === 'question').map((n) => n.questionId))
    if (qids.size) {
      const items = next.questions.filter((q) => !qids.has(q.id))
      const moved = next.questions.filter((q) => qids.has(q.id))
      const pages = splitPages(items)
      const targetIndex = screensOf({ ...next, questions: items }).findIndex((s) => s.key === toKey)
      // Insert at the end of the target section (before the next section).
      const nextSection = pages[targetIndex + 1]?.section
      const at = nextSection ? items.findIndex((q) => q.id === nextSection.id) : items.length
      next = { ...next, questions: [...items.slice(0, at), ...moved, ...items.slice(at)] }
    }
  }
  return next
}
