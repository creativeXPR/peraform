// A form's header: its image, and optionally a colour overlay, a logo and
// text on top (theme.headerImage + theme.header). Shared by the editor and
// the respondent's page, so both look the same.
//
// theme.header = {
//   overlay: '#rrggbb', overlayOpacity: 0–90 (%),
//   logo: { url } | null,
//   title, subtitle,                 // text on the banner (optional)
//   align: 'center' | 'left',
//   height: 'short' | 'medium' | 'tall'
// }
export const HEADER_DEFAULTS = {
  overlay: '#000000',
  overlayOpacity: 0,
  logo: null,
  title: '',
  subtitle: '',
  align: 'center',
  height: 'medium',
}

export const HEADER_HEIGHTS = { short: '5 / 1', medium: '4 / 1', tall: '3 / 1' }

export function headerOf(theme) {
  return { ...HEADER_DEFAULTS, ...theme?.header }
}
