import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'peraform-theme'
const darkQuery = '(prefers-color-scheme: dark)'

// The theme in effect: an explicit choice (set before first paint by the
// script in index.html) or, failing that, the system setting.
function currentTheme() {
  const explicit = document.documentElement.dataset.theme
  if (explicit) return explicit
  return window.matchMedia(darkQuery).matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState(currentTheme)

  // Track system changes while the user hasn't picked a theme themselves.
  useEffect(() => {
    const media = window.matchMedia(darkQuery)
    const onChange = () => setTheme(currentTheme())
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const toggleTheme = useCallback(() => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage blocked — the choice just won't survive a reload.
    }
    setTheme(next)
  }, [])

  return { theme, toggleTheme }
}
