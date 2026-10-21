// Colour helpers for custom colours (any #rrggbb the user picks).

export const HEX = /^#[0-9a-f]{6}$/i

export function normalizeHex(value) {
  if (typeof value !== 'string') return null
  let v = value.trim().toLowerCase()
  if (!v.startsWith('#')) v = `#${v}`
  if (/^#[0-9a-f]{3}$/.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
  return HEX.test(v) ? v : null
}

const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const toHex = (rgb) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`

// WCAG relative luminance and contrast ratio.
function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// Mixes `amount` (0–1) of `toward` into `hex`.
export function mix(hex, toward, amount) {
  const a = toRgb(hex)
  const b = toRgb(toward)
  return toHex(a.map((c, i) => c + (b[i] - c) * amount))
}

// Steps a colour toward black or white until text on it is readable.
function adjustFor(hex, text, toward, minRatio) {
  let c = hex
  for (let i = 0; i < 20 && contrast(c, text) < minRatio; i++) c = mix(c, toward, 0.08)
  return c
}

// A custom accent in both modes, matching the presets' guarantees:
// light mode has white button text (≥4.6:1), dark mode dark text (≥6.4:1).
export function accentPair(hex) {
  const light = adjustFor(hex, '#ffffff', '#000000', 4.6)
  const dark = adjustFor(hex, '#0e0f13', '#ffffff', 6.4)
  return { light, dark, chart: [light, dark] }
}
