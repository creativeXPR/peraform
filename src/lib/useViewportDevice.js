import { useSyncExternalStore } from 'react'
import { PHONE_MAX_WIDTH } from './interview.js'

const query = `(max-width: ${PHONE_MAX_WIDTH}px)`

function subscribe(onChange) {
  const media = window.matchMedia(query)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

// 'phone' or 'desktop': which interview design fits this screen.
export function useViewportDevice() {
  return useSyncExternalStore(subscribe, () => (window.matchMedia(query).matches ? 'phone' : 'desktop'))
}
