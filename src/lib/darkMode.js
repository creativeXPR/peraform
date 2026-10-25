import { mapStyle } from './interview.js'

// Dark mode for designed screens (interview mode). Theme tokens already
// follow the respondent's light/dark setting; fixed colours ('#rrggbb', in
// gradients too) don't. When a respondent picks dark mode and the screen
// was designed light — by a style, the AI or by hand — every fixed colour
// gets its lightness flipped, keeping its hue: a pale blue background turns
// deep navy, navy headings turn pale blue. Screens already designed dark
// stay as they are.

const HEX = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi

function toRgb(hex) {
  let h = hex.slice(1)
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
}

// Relative luminance (WCAG), 0 (black) to 1 (white).
function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Same hue and saturation, lightness flipped (kept off pure black/white).
export function flipHex(hex) {
  const [r, g, b] = toRgb(hex)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1))
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  }
  const l2 = Math.min(0.94, Math.max(0.07, 1 - l))
  const c = (1 - Math.abs(2 * l2 - 1)) * s
  const x = c * (1 - Math.abs((h % 2) - 1))
  const m = l2 - c / 2
  const [r1, g1, b1] =
    h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x]
  const out = [r1, g1, b1].map((v) => Math.round(Math.min(1, Math.max(0, v + m)) * 255).toString(16).padStart(2, '0'))
  return `#${out.join('')}`
}

// Every fixed colour in a value (a colour or a gradient) flipped.
export const flipColours = (value) => (typeof value === 'string' ? value.replace(HEX, (m) => flipHex(m)) : value)

const COLOUR_FIELDS = ['bg', 'color', 'borderColor']
const SCHEME_FLIP = { light: 'dark', dark: 'light' }

// Is the screen light? Judged where the text sits: the top-level cards (a
// light text scheme, or a solid light fill), else the screen background.
// No fixed colours at all: it already follows the theme.
export function isLightDesign(design) {
  const sample = (value) => (typeof value === 'string' ? (value.match(HEX) ?? []) : [])
  const average = (colours) => colours.reduce((sum, c) => sum + luminance(c), 0) / colours.length
  const cards = Object.values(design.nodes).filter((n) => !n.parentId)
  if (cards.some((n) => n.style?.scheme === 'dark')) return false
  if (cards.some((n) => n.style?.scheme === 'light')) return true
  const solid = cards.filter((n) => (n.style?.bgAlpha ?? 100) >= 50).flatMap((n) => sample(n.style?.bg))
  if (solid.length) return average(solid) > 0.4
  const bg = sample(design.bg)
  return bg.length > 0 && average(bg) > 0.4
}

// The dark version of a light screen (the same design when it isn't light).
export function darkDesign(design) {
  if (!isLightDesign(design)) return design
  const nodes = {}
  for (const [id, n] of Object.entries(design.nodes)) {
    nodes[id] = mapStyle(n, (st) => {
      const style = { ...st }
      for (const k of COLOUR_FIELDS) if (style[k]) style[k] = flipColours(style[k])
      if (SCHEME_FLIP[style.scheme]) style.scheme = SCHEME_FLIP[style.scheme]
      return style
    })
  }
  return { ...design, bg: flipColours(design.bg), nodes, dark: true }
}

// Colours an action sets (overrides[id].props bg, color, borderColor),
// flipped to match.
export function darkOverrides(overrides) {
  const out = {}
  for (const [id, o] of Object.entries(overrides ?? {})) {
    const props = o?.props && {
      ...o.props,
      bg: flipColours(o.props.bg),
      color: flipColours(o.props.color),
      borderColor: flipColours(o.props.borderColor),
    }
    out[id] = props ? { ...o, props } : o
  }
  return out
}
