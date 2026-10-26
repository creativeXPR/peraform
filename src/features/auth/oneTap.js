import { useEffect } from 'react'
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth'
import { getFirebaseAuth } from '../../lib/firebase.js'

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || ''

let scriptLoading = null

export function loadGsiScript() {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  if (scriptLoading) return scriptLoading

  scriptLoading = new Promise((resolve) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google?.accounts?.id))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.google?.accounts?.id)
    script.onerror = () => resolve(null)
    document.head.appendChild(script)
  })

  return scriptLoading
}

/**
 * Initializes Google One Tap prompt.
 * If the user is signed into Google in their browser, Google displays a native
 * prompt with their name & email, and can automatically sign them in (auto_select).
 */
export async function promptOneTap({ autoSelect = true, onUser, onError } = {}) {
  if (!GOOGLE_CLIENT_ID) return

  try {
    const gsi = await loadGsiScript()
    if (!gsi) return

    gsi.initialize({
      client_id: GOOGLE_CLIENT_ID,
      auto_select: autoSelect,
      cancel_on_tap_outside: false,
      callback: async (response) => {
        if (!response?.credential) return
        try {
          const auth = getFirebaseAuth()
          const cred = GoogleAuthProvider.credential(response.credential)
          const result = await signInWithCredential(auth, cred)
          onUser?.(result.user)
        } catch (err) {
          onError?.(err)
        }
      },
    })

    gsi.prompt()
  } catch {
    // Fail silently if blocked by browser policy/extensions
  }
}

/**
 * React hook to prompt Google One Tap when enabled (e.g., when sign-in is required).
 */
export function useGoogleOneTap({ enabled = true, onUser, onError } = {}) {
  useEffect(() => {
    if (!enabled) return
    promptOneTap({ autoSelect: true, onUser, onError })
  }, [enabled, onUser, onError])
}
