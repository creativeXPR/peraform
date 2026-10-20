import { useCallback, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'peraform-theme'
const darkQuery = '(prefers-color-scheme: dark)'

// The theme in effect: an explicit choice (set before first paint by the
// script in index.html) or, failing that, the system setting.
function currentTheme() {
  const explicit = document.documentElement.dataset.theme
  if (explicit) return explicit
  return window.matchMedia(darkQuery).matches ? 'dark' : 'light'
}

// Every component using the hook sees the same value: it changes when the
// toggle sets data-theme on <html>, or when the system setting changes.
function subscribe(onChange) {
  const media = window.matchMedia(darkQuery)
  media.addEventListener('change', onChange)
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => {
    media.removeEventListener('change', onChange)
    observer.disconnect()
  }
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, currentTheme)

  const toggleTheme = useCallback(() => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage blocked — the choice just won't survive a reload.
    }
  }, [])

  return { theme, toggleTheme }
}
