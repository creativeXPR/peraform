// Per-form themes (Google Forms' palette): colour, background, font,
// header image. A theme only overrides the design tokens from index.css,
// so every component follows it without knowing about themes.
//
// form.theme = { color, background, font, headerImage }

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

// Page background: a shade of the theme colour (Google Forms style) or grey.
// Percent of the colour mixed into the page, [light mode, dark mode].
export const THEME_BACKGROUNDS = {
  light: { label: 'Light', mix: [10, 10] },
  medium: { label: 'Medium', mix: [17, 15] },
  strong: { label: 'Strong', mix: [24, 20] },
  grey: { label: 'Grey', mix: [0, 0] },
}
// Before the shades: 'plain' (the old default) and 'tinted' both show as light.
const OLD_BACKGROUNDS = { plain: 'light', tinted: 'light' }

export const THEME_DEFAULTS = { color: 'indigo', background: 'light', font: 'inter', headerImage: null }

export function themeOf(form) {
  const theme = { ...THEME_DEFAULTS, ...form?.theme }
  theme.background = OLD_BACKGROUNDS[theme.background] ?? theme.background
  if (!THEME_BACKGROUNDS[theme.background]) theme.background = THEME_DEFAULTS.background
  return theme
}

// CSS custom properties for a theme in the current light/dark mode.
// font: false leaves the font alone — the editor's frame (top bar, sidebar)
// takes the form's colours but keeps the app's own type.
export function themeStyle(theme, dark, { font = true } = {}) {
  const color = THEME_COLORS[theme.color] ?? THEME_COLORS.indigo
  const accent = dark ? color.dark : color.light
  const base = dark ? '#0e0f13' : '#fbfcff'
  const mix = (THEME_BACKGROUNDS[theme.background] ?? THEME_BACKGROUNDS.light).mix[dark ? 1 : 0]
  const tint = (pct, over) => `color-mix(in srgb, ${accent} ${pct}%, ${over})`
  const style = {
    '--accent': accent,
    '--accent-hover': tint(85, dark ? 'white' : 'black'),
    '--accent-soft': tint(dark ? 16 : 11, 'transparent'),
    '--chart-bar': color.chart[dark ? 1 : 0],
    '--bg': tint(mix, base),
    // Fills, hairlines and the content card pick up the colour too, so the
    // whole page reads as the theme, not just the accents.
    '--fill': tint(dark ? 11 : 8, 'transparent'),
    '--fill-strong': tint(dark ? 18 : 14, 'transparent'),
    '--line': tint(dark ? 16 : 13, 'transparent'),
    '--surface-center': dark ? tint(6, '#15161b40') : tint(3, '#ffffff70'),
  }
  if (font) style['--font'] = (THEME_FONTS[theme.font] ?? THEME_FONTS.inter).family
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
