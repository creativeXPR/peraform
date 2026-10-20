// Per-form themes (Google Forms' palette): colour, background, font,
// header image. A theme only overrides the design tokens from index.css,
// so every component follows it without knowing about themes.
//
// form.theme = { color, background: 'plain' | 'tinted', font, headerImage }

// Each colour has a light-mode value (white button text ≥4.6:1) and a
// lighter dark-mode value (dark button text ≥6.4:1). Chart bars use their
// own shades, checked with the dataviz palette validator in both modes —
// the button shades are too dark/light for charts. Slate is near-grey,
// which fails the chart chroma floor, so its charts use indigo.
export const THEME_COLORS = {
  indigo: { label: 'Indigo', light: '#4f46e5', dark: '#818cf8', chart: ['#4f46e5', '#6d70f5'] },
  blue: { label: 'Blue', light: '#2563eb', dark: '#60a5fa', chart: ['#2563eb', '#3b82f6'] },
  teal: { label: 'Teal', light: '#0f766e', dark: '#2dd4bf', chart: ['#0d9488', '#0d9488'] },
  green: { label: 'Green', light: '#15803d', dark: '#4ade80', chart: ['#15803d', '#16a34a'] },
  amber: { label: 'Amber', light: '#b45309', dark: '#fbbf24', chart: ['#b45309', '#d97706'] },
  red: { label: 'Red', light: '#dc2626', dark: '#f87171', chart: ['#dc2626', '#ef4444'] },
  pink: { label: 'Pink', light: '#db2777', dark: '#f472b6', chart: ['#db2777', '#ec4899'] },
  slate: { label: 'Slate', light: '#475569', dark: '#94a3b8', chart: ['#6366f1', '#6366f1'] },
}

export const THEME_FONTS = {
  inter: { label: 'Modern', family: "'Inter', system-ui, sans-serif", google: null },
  serif: {
    label: 'Classic',
    family: "'Source Serif 4', Georgia, serif",
    google: 'Source+Serif+4:wght@400;600;700',
  },
  rounded: { label: 'Friendly', family: "'Nunito', system-ui, sans-serif", google: 'Nunito:wght@400;600;700' },
  mono: { label: 'Technical', family: "'JetBrains Mono', ui-monospace, monospace", google: 'JetBrains+Mono:wght@400;600;700' },
}

// Tinted by default, like Google Forms' light page colour.
export const THEME_DEFAULTS = { color: 'indigo', background: 'tinted', font: 'inter', headerImage: null }

export function themeOf(form) {
  return { ...THEME_DEFAULTS, ...form?.theme }
}

// CSS custom properties for a theme in the current light/dark mode.
// font: false leaves the font alone — the editor's frame (top bar, sidebar)
// takes the form's colours but keeps the app's own type.
export function themeStyle(theme, dark, { font = true } = {}) {
  const color = THEME_COLORS[theme.color] ?? THEME_COLORS.indigo
  const accent = dark ? color.dark : color.light
  const base = dark ? '#0e0f13' : '#fbfcff'
  const style = {
    '--accent': accent,
    '--accent-hover': `color-mix(in srgb, ${accent} 85%, ${dark ? 'white' : 'black'})`,
    '--accent-soft': `color-mix(in srgb, ${accent} ${dark ? 16 : 11}%, transparent)`,
    '--chart-bar': color.chart[dark ? 1 : 0],
  }
  if (font) style['--font'] = (THEME_FONTS[theme.font] ?? THEME_FONTS.inter).family
  if (theme.background === 'tinted') {
    style['--bg'] = `color-mix(in srgb, ${accent} ${dark ? 10 : 9}%, ${base})`
  }
  return style
}

// Loads a theme font from Google Fonts once (Inter is already loaded).
const loaded = new Set()
export function loadThemeFont(font) {
  const spec = THEME_FONTS[font]?.google
  if (!spec || loaded.has(spec)) return
  loaded.add(spec)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`
  document.head.appendChild(link)
}
