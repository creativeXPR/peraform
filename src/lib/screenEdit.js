import { gradient } from './gradient.js'
import {
  COLOR_TOKENS,
  DEVICES,
  MIN_SIZE,
  SHADOWS,
  addNode,
  deleteNode,
  descendantIds,
  frameOf,
  placeNew,
  resolveNode,
  setContentOn,
  setFrame,
  setStyleOn,
} from './interview.js'
import { THEME_FONTS } from './theme.js'

// "Change this screen with AI": the screen as the AI reads it, and its
// answer (a list of changes) applied to the design. Pure, so the dialog and
// the tests share it. The AI never sees or returns whole nodes: only these
// fields, each checked here, so a bad answer can't break a screen.
//
// Changes (functions/ai/features.js → SCREEN_SCHEMA):
//   { op: 'update', id, x?, y?, w?, h?, text?, label?, action?, hidden?, style? }
//   { op: 'add', id: 'new-1', type: card|text|button|image, parent, x, y, w, h, text?, label?, action?, style? }
//   { op: 'remove', id }
// Frames (x, y, w, h) are for the device being edited; the other device's
// layout is left alone (new blocks get a sensible place there).

const STYLE_FIELDS = ['bg', 'color', 'size', 'weight', 'align', 'valign', 'radius', 'font', 'shadow', 'opacity', 'padding', 'borderWidth', 'borderColor']
const ADDABLE = ['card', 'text', 'button', 'image']
const BUTTON_TYPES = ['next', 'back', 'submit', 'none']

// The screen as compact JSON for the prompt.
export function screenForAi(design, device, questions = []) {
  const blocks = Object.values(design.nodes)
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
    .map((raw) => {
      const n = resolveNode(raw, device)
      const f = frameOf(n, device)
      const block = { id: n.id, type: n.type, parent: n.parentId ?? null, x: f.x, y: f.y, w: f.w, h: f.h }
      if (f.hidden) block.hidden = true
      if (n.type === 'text') block.text = n.text ?? ''
      if (n.type === 'button') {
        block.label = n.label ?? ''
        block.action = n.action?.type ?? 'next'
      }
      if (n.type === 'question') block.question = questions.find((q) => q.id === n.questionId)?.title ?? ''
      if (n.type === 'image') block.hasImage = Boolean(n.image)
      const style = Object.fromEntries(STYLE_FIELDS.filter((k) => n.style?.[k] !== undefined).map((k) => [k, n.style[k]]))
      if (Object.keys(style).length) block.style = style
      return block
    })
  return { width: DEVICES[device].width, height: DEVICES[device].height, background: design.bg ?? null, blocks }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(v)))
const num = (v) => typeof v === 'number' && Number.isFinite(v)

function cleanColour(v) {
  if (typeof v !== 'string') return undefined
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase()
  if (v === 'transparent' || COLOR_TOKENS[v]) return v
  return undefined
}

// Only known style fields, with values the stage can draw.
export function cleanStyle(style) {
  if (!style || typeof style !== 'object') return {}
  const out = {}
  const set = (k, v) => v !== undefined && (out[k] = v)
  set('bg', cleanColour(style.bg))
  set('color', cleanColour(style.color))
  set('borderColor', cleanColour(style.borderColor))
  if (num(style.size)) out.size = clamp(style.size, 8, 120)
  if (num(style.weight)) out.weight = clamp(style.weight / 100, 3, 9) * 100
  if (['left', 'center', 'right'].includes(style.align)) out.align = style.align
  if (['top', 'middle', 'bottom'].includes(style.valign)) out.valign = style.valign
  if (num(style.radius)) out.radius = clamp(style.radius, 0, 999)
  if (num(style.padding)) out.padding = clamp(style.padding, 0, 64)
  if (num(style.borderWidth)) out.borderWidth = clamp(style.borderWidth, 0, 12)
  if (num(style.opacity)) out.opacity = Math.min(1, Math.max(0.05, style.opacity))
  if (THEME_FONTS[style.font]) out.font = style.font
  if (SHADOWS[style.shadow]) out.shadow = style.shadow
  return out
}

function framePatch(c) {
  const patch = {}
  if (num(c.x)) patch.x = Math.round(c.x)
  if (num(c.y)) patch.y = Math.round(c.y)
  if (num(c.w)) patch.w = Math.max(MIN_SIZE, Math.round(c.w))
  if (num(c.h)) patch.h = Math.max(MIN_SIZE, Math.round(c.h))
  return patch
}

// Text, button label/action and style changes shared by update and add.
function contentPatch(node, c) {
  const patch = {}
  if (node.type === 'text' && typeof c.text === 'string' && c.text.trim()) patch.text = c.text.slice(0, 2000)
  if (node.type === 'button') {
    if (typeof c.label === 'string' && c.label.trim()) patch.label = c.label.slice(0, 60)
    // "Go to screen…" buttons keep their target; the AI only switches between the simple kinds.
    if (BUTTON_TYPES.includes(c.action)) patch.action = { type: c.action }
  }
  const style = cleanStyle(c.style)
  if (Object.keys(style).length) patch.style = { ...node.style, ...style }
  return patch
}

const holdsQuestions = (design, id) => descendantIds(design.nodes, id).some((x) => design.nodes[x]?.type === 'question')

// Applies the AI's changes to a screen design. Unknown blocks, question
// removals and invalid values are skipped. Returns { design, applied }.
export function applyScreenEdit(design, { changes = [], background } = {}, device) {
  let d = design
  const ids = {} // the AI's "new-1" → the real id
  const real = (id) => ids[id] ?? id
  const touched = []
  let applied = 0

  if (background && typeof background === 'object') {
    const from = cleanColour(background.color)
    const to = cleanColour(background.to)
    if (from) {
      d = { ...d, bg: to && to !== 'transparent' ? gradient(from, to, clamp(num(background.angle) ? background.angle : 135, 0, 360)) : from }
      applied++
    }
  }

  for (const c of Array.isArray(changes) ? changes : []) {
    if (!c || typeof c !== 'object') continue
    if (c.op === 'add') {
      if (!ADDABLE.includes(c.type)) continue
      const parent = c.parent ? d.nodes[real(c.parent)] : null
      if (c.type !== 'card' && parent?.type !== 'card') continue
      if (parent && parent.type !== 'card') continue
      const node = placeNew(d, c.type, parent)
      if (c.type === 'text') node.text = 'Text'
      if (c.type === 'button') {
        node.label = 'Next'
        node.action = { type: 'next' }
      }
      Object.assign(node, contentPatch(node, c))
      node.frames = { ...node.frames, [device]: { ...node.frames[device], ...framePatch(c) } }
      d = addNode(d, node)
      if (typeof c.id === 'string') ids[c.id] = node.id
      touched.push(node.id)
      applied++
    } else if (c.op === 'remove') {
      const id = real(c.id)
      if (!d.nodes[id] || holdsQuestions(d, id)) continue
      d = deleteNode(d, id)
      applied++
    } else if (c.op === 'update') {
      const id = real(c.id)
      const node = d.nodes[id]
      if (!node) continue
      const { style, ...patch } = contentPatch(resolveNode(node, device), c)
      if (style) d = setStyleOn(d, id, device, style)
      if (Object.keys(patch).length) d = setContentOn(d, id, device, patch)
      const frame = framePatch(c)
      // Questions always stay visible (hidden ones can't be answered).
      if (typeof c.hidden === 'boolean' && node.type !== 'question') {
        d = Object.keys(DEVICES).reduce((dd, dev) => setFrame(dd, id, dev, { hidden: c.hidden }), d)
      }
      if (Object.keys(frame).length) d = setFrame(d, id, device, frame)
      touched.push(id)
      applied++
    }
  }

  return { design: d, applied }
}
