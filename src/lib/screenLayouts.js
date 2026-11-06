import { DEVICES, GLASS, fitText, frameOf, newNode, questionHeight, textHeight } from './interview.js'

// Ready-made screen layouts (Design screens → screen panel → Layout). A
// layout rearranges the blocks a screen already has — its words, questions,
// pictures and buttons keep their content, actions and animations — so the
// creator picks a starting shape and adjusts it, instead of placing every
// block by hand. Only when the creator picks one (never by itself).

// Sample photos for layouts that need one (public/layouts; free to use).
export const SAMPLE_PHOTOS = [
  { url: '/layouts/forest-falls.jpg', label: 'Forest falls' },
  { url: '/layouts/violet-path.jpg', label: 'Violet path' },
]

export const LAYOUTS = {
  card: { label: 'Card in the middle', hint: 'Everything in one card, as a new screen starts' },
  focus: { label: 'Big question', hint: 'No card: large words, centred, one thing at a time' },
  side: { label: 'Picture beside', hint: 'A picture on the left (on top on phones), questions beside it' },
  photo: { label: 'Full-screen photo', hint: 'A photo fills the screen; the questions sit on frosted glass' },
  cover: { label: 'Cover', hint: 'A big title and a Start button, centred: for a first screen' },
}

const GAP = 16
const MEDIA = ['image', 'video', 'embed']

// Where each layout puts the main card (and the picture card), per device.
//   card: { x, w, y?, pad }   y omitted → centred vertically
//   media: { x, y, w, h } — the picture card (side, photo)
//   size: heading size; center: words and buttons centred
function geometry(key, device) {
  const W = DEVICES[device].width
  const H = DEVICES[device].height
  const phone = device === 'phone'
  switch (key) {
    case 'focus':
      return phone
        ? { card: { x: 16, y: 72, w: W - 32, pad: 8 }, size: 30, center: true }
        : { card: { x: 200, y: 120, w: W - 400, pad: 8 }, size: 44, center: true }
    case 'cover':
      return phone
        ? { card: { x: 16, w: W - 32, pad: 8 }, size: 36, center: true }
        : { card: { x: 240, w: W - 480, pad: 8 }, size: 56, center: true }
    case 'side':
      return phone
        ? { media: { x: 0, y: 0, w: W, h: 300 }, card: { x: 16, y: 316, w: W - 32, pad: 8 }, size: 26 }
        : { media: { x: 0, y: 0, w: 620, h: H }, card: { x: 680, y: 80, w: W - 740, pad: 8 }, size: 34 }
    case 'photo':
      return phone
        ? { media: { x: 0, y: 0, w: W, h: H }, card: { x: 16, w: W - 32, pad: 20 }, size: 26 }
        : { media: { x: 0, y: 0, w: W, h: H }, card: { x: 390, w: W - 780, pad: 32 }, size: 32 }
    default:
      return phone
        ? { card: { x: 16, y: 48, w: W - 32, pad: 20 }, size: 26 }
        : { card: { x: 320, y: 64, w: 640, pad: 32 }, size: 32 }
  }
}

const CARD_LOOK = {
  card: { bg: 'surface', radius: 20, shadow: undefined, bgAlpha: undefined, blur: undefined, borderWidth: undefined },
  focus: { bg: 'transparent', radius: 0, shadow: 'none', bgAlpha: undefined, blur: undefined, borderWidth: undefined },
  cover: { bg: 'transparent', radius: 0, shadow: 'none', bgAlpha: undefined, blur: undefined, borderWidth: undefined },
  side: { bg: 'transparent', radius: 0, shadow: 'none', bgAlpha: undefined, blur: undefined, borderWidth: undefined },
  photo: { ...GLASS, bg: '#ffffff', radius: 24 },
}

// Absolute position on a device (frames are relative to the parent card).
function absolute(nodes, node, device) {
  let x = 0
  let y = 0
  for (let n = node; n; n = nodes[n.parentId]) {
    const f = frameOf(n, device)
    x += f.x
    y += f.y
  }
  return { x, y }
}

const clean = (style) => Object.fromEntries(Object.entries(style).filter(([, v]) => v !== undefined))

// The screen's blocks in that layout. `questions`: the form's questions (for
// their heights); `photo`: a picture url for side/photo when the screen has
// none. Extra cards are merged away (their blocks move into the main card).
// Returns a new design; the same blocks keep their ids.
export function applyLayout(design, key, { questions = [], photo = SAMPLE_PHOTOS[0].url } = {}) {
  const nodes = design.nodes
  const all = Object.values(nodes)
  const order = (a, b) => {
    const pa = absolute(nodes, a, 'phone')
    const pb = absolute(nodes, b, 'phone')
    return pa.y - pb.y || pa.x - pb.x
  }
  const cards = all.filter((n) => n.type === 'card').sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
  const blocks = all.filter((n) => n.type !== 'card').sort(order)
  const texts = blocks.filter((n) => n.type === 'text')
  const heading = texts.find((n) => (n.style?.weight ?? 400) >= 600) ?? texts[0] ?? null
  const words = texts.filter((n) => n !== heading)
  const media = blocks.filter((n) => MEDIA.includes(n.type))
  const asked = blocks.filter((n) => n.type === 'question')
  const buttons = blocks.filter((n) => n.type === 'button')

  const out = {}
  let seq = all.reduce((m, n) => Math.max(m, n.seq ?? 0), 0) + 1
  const main = cards[0] ?? newNode('card', { seq: seq++ })
  const hasMediaCard = key === 'side' || key === 'photo'
  // The picture card: the second card if there is one, so its look stays.
  const mediaCard = hasMediaCard ? (cards[1] ?? newNode('card', { seq: seq++ })) : null
  let pictures = media
  if (hasMediaCard && !pictures.length) {
    pictures = [newNode('image', { seq, image: { url: photo }, alt: '' })]
  }
  // The photo layout uses one picture as the backdrop; the rest stay in the card.
  const behind = hasMediaCard ? (key === 'photo' ? pictures.slice(0, 1) : pictures) : []
  const inCard = [
    ...(heading ? [heading] : []),
    ...words,
    ...media.filter((m) => !behind.includes(m)),
    ...asked,
  ]

  const frames = {} // id → { phone, desktop }
  const set = (id, device, f) => {
    const old = frameOf(nodes[id] ?? { frames: {} }, device)
    frames[id] = { ...frames[id], [device]: { ...old, r: 0, z: old.z ?? 0, ...f } }
  }

  for (const device of Object.keys(DEVICES)) {
    const g = geometry(key, device)
    const inner = g.card.w - g.card.pad * 2
    let y = g.card.pad
    for (const n of inCard) {
      const q = n.type === 'question' ? questions.find((x) => x.id === n.questionId) : null
      const size = n === heading ? g.size : (n.style?.size ?? 16)
      const h =
        n.type === 'text'
          ? textHeight(n.text, size, inner) + 8
          : n.type === 'question'
            ? (q ? questionHeight(q) : 120)
            : device === 'phone'
              ? 200
              : 280
      set(n.id, device, { x: g.card.pad, y, w: inner, h })
      y += h + GAP
    }
    if (buttons.length) {
      // Back first, then the rest, on one row.
      const row = [...buttons].sort((a, b) => (a.action?.type === 'back' ? -1 : b.action?.type === 'back' ? 1 : 0))
      const phone = device === 'phone'
      const widths = row.map((b) => (phone ? Math.floor((inner - GAP * (row.length - 1)) / row.length) : b.action?.type === 'back' ? 140 : 200))
      const total = widths.reduce((s, w) => s + w, 0) + GAP * (row.length - 1)
      let x = g.center && !phone ? g.card.pad + Math.max(0, Math.round((inner - total) / 2)) : g.card.pad
      row.forEach((b, i) => {
        set(b.id, device, { x, y, w: widths[i], h: 52 })
        x += widths[i] + GAP
      })
      y += 52 + GAP
    }
    const h = Math.max(y - GAP + g.card.pad, 120)
    const H = DEVICES[device].height
    const cardY = g.card.y ?? Math.max(48, Math.round((H - h) / 2))
    set(main.id, device, { x: g.card.x, y: cardY, w: g.card.w, h, z: 1 })
    if (mediaCard) {
      const m = g.media
      set(mediaCard.id, device, { ...m, z: 0 })
      const each = Math.floor(m.h / behind.length)
      behind.forEach((p, i) => set(p.id, device, { x: 0, y: i * each, w: m.w, h: each }))
    }
  }

  // The blocks, rehomed; cards other than the main (and picture) card go.
  const keep = [main, ...(mediaCard ? [mediaCard] : []), ...blocks, ...pictures.filter((p) => !nodes[p.id])]
  for (const n of keep) {
    const parentId = n === main || n === mediaCard ? null : behind.includes(n) ? mediaCard.id : main.id
    out[n.id] = { ...n, parentId, frames: { ...n.frames, ...frames[n.id] } }
  }
  out[main.id].style = clean({ ...main.style, ...CARD_LOOK[key], clip: false })
  if (mediaCard) out[mediaCard.id].style = clean({ ...mediaCard.style, bg: 'transparent', radius: 0, padding: 0, clip: true, shadow: 'none' })
  const align = key === 'focus' || key === 'cover' ? 'center' : 'left'
  for (const n of words) out[n.id].style = { ...out[n.id].style, align }
  if (heading) {
    // The heading is bigger on desktop: each device gets its own size (the
    // block's per-device look, as "Different on phone and desktop" makes).
    const h = out[heading.id]
    const look = (d) => ({ ...h.style, ...h.byDevice?.[d]?.style, size: geometry(key, d).size, weight: 700, align })
    out[heading.id] = {
      ...h,
      style: { ...h.style, weight: 700, align },
      split: true,
      byDevice: Object.fromEntries(
        Object.keys(DEVICES).map((d) => [d, { ...h.byDevice?.[d], style: look(d), text: h.byDevice?.[d]?.text ?? h.text }]),
      ),
    }
  }
  return fitText({ ...design, layout: key, nodes: out })
}
