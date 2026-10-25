// Gradient backgrounds, stored as CSS (used by ColorPicker, the canvas and
// design styles). Kept tiny so anything can import it.

// Gradients are stored as CSS: 'linear-gradient(135deg, #aaa 0%, #bbb 100%)'.
export function gradient(from, to, angle = 135) {
  return `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`
}

export function isGradient(value) {
  return typeof value === 'string' && value.includes('gradient(')
}

// { from, to, angle } from a stored gradient, or null.
export function parseGradient(value) {
  const m = isGradient(value) && value.match(/(\d+)deg,\s*(#[0-9a-f]{6})[^,]*,\s*(#[0-9a-f]{6})/i)
  return m ? { angle: Number(m[1]), from: m[2].toLowerCase(), to: m[3].toLowerCase() } : null
}

export const GRADIENT_PRESETS = [
  { value: gradient('#ff9a8b', '#a18cd1'), label: 'Sunset' },
  { value: gradient('#667eea', '#764ba2'), label: 'Violet' },
  { value: gradient('#43e97b', '#38f9d7'), label: 'Mint' },
  { value: gradient('#4facfe', '#00f2fe'), label: 'Sky' },
  { value: gradient('#fa709a', '#fee140'), label: 'Peach' },
  { value: gradient('#e0f2fe', '#fef9c3', 180), label: 'Morning' },
  { value: gradient('#0f172a', '#1e1b4b', 160), label: 'Night' },
  { value: gradient('#f8fafc', '#e2e8f0', 180), label: 'Paper' },
]
