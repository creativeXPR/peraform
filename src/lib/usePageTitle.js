import { useEffect } from 'react'

const DEFAULT_TITLE = 'PeraForm'

// The browser tab's title (and, optionally, its icon) while a page is shown;
// both go back to PeraForm's when it closes. Updates as they change (e.g.
// while the form is being renamed).
export function usePageTitle(title, icon) {
  useEffect(() => {
    if (!title) return
    document.title = title
    return () => {
      document.title = DEFAULT_TITLE
    }
  }, [title])

  useEffect(() => {
    if (!icon) return
    const link = document.querySelector('link[rel="icon"]')
    if (!link) return
    const before = { href: link.getAttribute('href'), type: link.getAttribute('type') }
    link.setAttribute('href', icon)
    link.removeAttribute('type') // the icon may be a PNG or JPEG, not the SVG logo
    return () => {
      link.setAttribute('href', before.href)
      if (before.type) link.setAttribute('type', before.type)
    }
  }, [icon])
}
