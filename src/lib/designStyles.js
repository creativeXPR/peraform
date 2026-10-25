import { newAnimation } from './animations.js'
import { gradient } from './gradient.js'
import { frameOf } from './interview.js'

// Design styles for interview screens: a look applied in one go (by the
// creator, or chosen by "Design with AI"). A style restyles what's there:
// the screen background, cards, headings, text, questions and buttons. It
// never moves or removes blocks, and keeps their content and actions.
//
// Each style is a function of a palette { from, to, accent }, so the AI (or
// a later "colours" option) can tint it without inventing a whole look.

// Text colours for a dark card: answer fields and labels read light.
const DARK = { scheme: 'dark' }
const LIGHT = { scheme: 'light' }

export const DESIGN_STYLES = {
  playful: {
    label: 'Playful',
    blurb: 'Bright gradient, round shapes and a bouncy entrance. Fun, friendly forms.',
    palette: { from: '#ff9a8b', to: '#a18cd1', accent: '#7c3aed' },
    build: (p) => ({
      bg: gradient(p.from, p.to),
      card: { ...LIGHT, bg: '#ffffff', bgAlpha: 94, radius: 28, shadow: 'strong', blur: 0, borderWidth: 0 },
      title: { font: 'rounded', size: 30, weight: 700, color: p.accent },
      text: { font: 'rounded', color: '#4b5060' },
      question: { font: 'rounded' },
      button: { bg: p.accent, color: '#ffffff', radius: 999, font: 'rounded', weight: 700 },
      back: { bg: '#f1ecff', color: p.accent, radius: 999, font: 'rounded', weight: 700 },
      media: { radius: 20 },
      entrance: 'pop',
    }),
  },
  classroom: {
    label: 'Classroom',
    blurb: 'Calm and clear, with a classic heading. Quizzes, lessons and school forms.',
    palette: { from: '#e0f2fe', to: '#fef9c3', accent: '#2563eb' },
    build: (p) => ({
      bg: gradient(p.from, p.to, 180),
      card: { ...LIGHT, bg: '#ffffff', bgAlpha: 100, radius: 16, shadow: 'medium', blur: 0, borderWidth: 0 },
      title: { font: 'serif', size: 28, weight: 700, color: '#1e3a8a' },
      text: { font: 'inter', color: '#334155' },
      question: { font: 'inter' },
      button: { bg: p.accent, color: '#ffffff', radius: 12, font: 'inter', weight: 600 },
      back: { bg: '#dbeafe', color: '#1e40af', radius: 12, font: 'inter', weight: 600 },
      media: { radius: 12 },
      entrance: 'slideUp',
    }),
  },
  official: {
    label: 'Official',
    blurb: 'Formal and restrained: square corners, thin borders, no effects. Government, legal, HR.',
    palette: { from: '#f8fafc', to: '#e2e8f0', accent: '#0f172a' },
    build: (p) => ({
      bg: gradient(p.from, p.to, 180),
      card: { ...LIGHT, bg: '#ffffff', bgAlpha: 100, radius: 6, shadow: 'none', blur: 0, borderWidth: 1, borderColor: '#cbd5e1' },
      title: { font: 'serif', size: 26, weight: 700, color: '#0f172a' },
      text: { font: 'inter', color: '#334155' },
      question: { font: 'inter' },
      button: { bg: p.accent, color: '#ffffff', radius: 6, font: 'inter', weight: 600 },
      back: { bg: '#e2e8f0', color: '#0f172a', radius: 6, font: 'inter', weight: 600 },
      media: { radius: 4 },
      entrance: null,
    }),
  },
  flow: {
    label: 'Flow',
    blurb: 'Minimal onboarding: lots of white, big heading, no card edges. Sign-ups and onboarding.',
    palette: { from: '#ffffff', to: '#f5f7ff', accent: '#111827' },
    build: (p) => ({
      bg: gradient(p.from, p.to, 180),
      card: { ...LIGHT, bg: 'transparent', bgAlpha: 100, radius: 0, shadow: 'none', blur: 0, borderWidth: 0 },
      title: { font: 'inter', size: 32, weight: 700, color: '#111827' },
      text: { font: 'inter', color: '#6b7280' },
      question: { font: 'inter' },
      button: { bg: p.accent, color: '#ffffff', radius: 999, font: 'inter', weight: 600 },
      back: { bg: '#f3f4f6', color: '#111827', radius: 999, font: 'inter', weight: 600 },
      media: { radius: 16 },
      entrance: 'fadeIn',
    }),
  },
  glass: {
    label: 'Glass',
    blurb: 'Frosted glass over a vivid gradient. Modern and eye-catching: launches, events, sign-ups.',
    palette: { from: '#667eea', to: '#f093fb', accent: '#ffffff' },
    build: (p) => ({
      bg: gradient(p.from, p.to),
      card: { ...DARK, bg: '#ffffff', bgAlpha: 22, radius: 24, shadow: 'medium', blur: 18, borderWidth: 1, borderColor: '#ffffff' },
      title: { font: 'inter', size: 30, weight: 700, color: '#ffffff' },
      text: { font: 'inter', color: '#f5f3ff' },
      question: { font: 'inter' },
      button: { bg: p.accent, color: '#4c1d95', radius: 999, font: 'inter', weight: 700, bgAlpha: 100 },
      back: { bg: '#ffffff', bgAlpha: 22, color: '#ffffff', radius: 999, font: 'inter', weight: 600 },
      media: { radius: 18 },
      entrance: 'slideUp',
    }),
  },
  midnight: {
    label: 'Midnight',
    blurb: 'Dark and bold, with a glowing accent. Tech, gaming and night-time events.',
    palette: { from: '#0f172a', to: '#1e1b4b', accent: '#a78bfa' },
    build: (p) => ({
      bg: gradient(p.from, p.to, 160),
      card: { ...DARK, bg: '#111827', bgAlpha: 100, radius: 20, shadow: 'strong', blur: 0, borderWidth: 1, borderColor: '#334155' },
      title: { font: 'inter', size: 30, weight: 700, color: '#f8fafc' },
      text: { font: 'inter', color: '#cbd5e1' },
      question: { font: 'inter' },
      button: { bg: p.accent, color: '#0f172a', radius: 12, font: 'inter', weight: 700 },
      back: { bg: '#1f2937', color: '#e5e7eb', radius: 12, font: 'inter', weight: 600 },
      media: { radius: 14 },
      entrance: 'fadeIn',
    }),
  },
}

const HEX = /^#[0-9a-f]{6}$/i

// The palette to use: the style's own, with any valid colours given.
export function paletteFor(styleKey, overrides = {}) {
  const base = DESIGN_STYLES[styleKey].palette
  const pick = (k) => (HEX.test(overrides[k] ?? '') ? overrides[k].toLowerCase() : base[k])
  return { from: pick('from'), to: pick('to'), accent: pick('accent') }
}

// Which text in a card is its heading: the biggest (ties: the highest up).
function headingIds(design) {
  const ids = new Set()
  const byCard = {}
  for (const n of Object.values(design.nodes)) {
    if (n.type !== 'text' || !n.parentId) continue
    ;(byCard[n.parentId] ??= []).push(n)
  }
  for (const texts of Object.values(byCard)) {
    const top = texts
      .slice()
      .sort((a, b) => (b.style?.size ?? 16) - (a.style?.size ?? 16) || frameOf(a, 'phone').y - frameOf(b, 'phone').y)[0]
    if ((top.style?.size ?? 16) >= 20) ids.add(top.id)
  }
  return ids
}

const isBack = (n) => n.action?.type === 'back'

// The screen restyled. Style-added entrances replace earlier style-added
// ones; animations the creator added are kept.
export function applyStyle(design, styleKey, palette) {
  const s = DESIGN_STYLES[styleKey].build(palette ?? paletteFor(styleKey))
  const headings = headingIds(design)
  const nodes = {}
  for (const n of Object.values(design.nodes)) {
    let patch = null
    if (n.type === 'card') patch = n.parentId ? { ...s.card, shadow: 'none' } : s.card
    else if (n.type === 'text') patch = headings.has(n.id) ? s.title : s.text
    else if (n.type === 'question') patch = s.question
    else if (n.type === 'button') patch = isBack(n) ? s.back : s.button
    else if (n.type === 'image' || n.type === 'video' || n.type === 'embed') patch = s.media
    let next = patch ? { ...n, style: { ...n.style, ...patch } } : n
    if (n.type === 'card' && !n.parentId) {
      const own = (n.animations ?? []).filter((a) => !a.fromStyle)
      const added = s.entrance ? [{ ...newAnimation(s.entrance), fromStyle: true }] : []
      next = { ...next, animations: [...own, ...added] }
    }
    nodes[n.id] = next
  }
  // The look before any style, kept the first time one is applied, so
  // "Back to original look" can bring it back (restoreOriginal).
  const original = design.original ?? snapshot(design)
  // Sizes stay as set (the Inspector says when text needs more room).
  return { ...design, bg: s.bg, style: styleKey, original, nodes }
}

function snapshot(design) {
  const looks = {}
  for (const n of Object.values(design.nodes)) looks[n.id] = { style: n.style ?? {}, animations: n.animations ?? [] }
  return { bg: design.bg ?? null, looks }
}

// The screen as it looked before any style was applied: each block's own
// colours, fonts and animations come back (blocks added since keep theirs,
// minus style entrances); content, layout and actions stay as they are now.
export function restoreOriginal(design) {
  if (!design.original) return design
  const { bg, looks } = design.original
  const nodes = {}
  for (const n of Object.values(design.nodes)) {
    const before = looks[n.id]
    nodes[n.id] = before
      ? { ...n, style: before.style, animations: before.animations }
      : { ...n, animations: (n.animations ?? []).filter((a) => !a.fromStyle) }
  }
  // eslint-disable-next-line no-unused-vars -- dropping style and original
  const { style, original, ...rest } = design
  return { ...rest, bg, nodes }
}

// The fonts a design uses (to load them).
export function fontsUsed(design) {
  return [...new Set(Object.values(design.nodes).map((n) => n.style?.font).filter(Boolean))]
}

// "Design with AI" words for a screen: the heading goes into its heading
// block, the subtitle into the first other text in the same card (if any).
export function screenWords(design, { heading, subtitle }) {
  const ids = headingIds(design)
  const nodes = { ...design.nodes }
  const headingNode = Object.values(nodes).find((n) => ids.has(n.id))
  if (headingNode && heading) nodes[headingNode.id] = { ...headingNode, text: heading.slice(0, 80) }
  if (headingNode && subtitle) {
    const sub = Object.values(nodes)
      .filter((n) => n.type === 'text' && n.parentId === headingNode.parentId && n.id !== headingNode.id)
      .sort((a, b) => frameOf(a, 'phone').y - frameOf(b, 'phone').y)[0]
    if (sub) nodes[sub.id] = { ...sub, text: subtitle.slice(0, 160) }
  }
  return { ...design, nodes }
}
