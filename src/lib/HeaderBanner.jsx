import { HEADER_HEIGHTS, headerOf } from './header.js'

// A form's header (see header.js): its image, plus any overlay, logo and
// text on top. Shared by the editor and the respondent's page.
export default function HeaderBanner({ theme }) {
  if (!theme?.headerImage?.url) return null
  const h = headerOf(theme)
  const hasText = h.title.trim() || h.subtitle.trim()
  const layered = h.overlayOpacity > 0 || h.logo || hasText
  if (!layered) return <img className="form-header-image" src={theme.headerImage.url} alt="" />
  return (
    <div
      className={`form-header-banner align-${h.align === 'left' ? 'left' : 'center'}`}
      style={{ aspectRatio: HEADER_HEIGHTS[h.height] ?? HEADER_HEIGHTS.medium }}
    >
      <img className="form-header-banner-img" src={theme.headerImage.url} alt="" />
      {h.overlayOpacity > 0 && (
        <span
          className="form-header-banner-overlay"
          style={{ background: h.overlay, opacity: Math.min(90, h.overlayOpacity) / 100 }}
        />
      )}
      {(h.logo || hasText) && (
        <div className="form-header-banner-content">
          {h.logo?.url && <img className="form-header-banner-logo" src={h.logo.url} alt="" />}
          {h.title.trim() && <p className="form-header-banner-title">{h.title}</p>}
          {h.subtitle.trim() && <p className="form-header-banner-sub">{h.subtitle}</p>}
        </div>
      )}
    </div>
  )
}
