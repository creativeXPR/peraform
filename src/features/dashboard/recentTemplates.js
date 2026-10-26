import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase.js'

export const RECENT_KEY = 'peraform-recent-templates'

export function getRecentTemplateKeys() {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list.slice(0, 6) : []
  } catch {
    return []
  }
}

// Stores the template key in localStorage and syncs with the user's Firestore
// account (users/{uid}/settings/templates) when signed in, enabling cross-device sync.
export function saveRecentTemplateKey(key, uid) {
  let next = []
  try {
    const existing = getRecentTemplateKeys().filter((k) => k !== key)
    next = [key, ...existing].slice(0, 6)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // Storage blocked or unavailable
  }

  if (uid && db) {
    try {
      setDoc(
        doc(db, 'users', uid, 'settings', 'templates'),
        { recentKeys: next.length ? next : [key] },
        { merge: true },
      ).catch(() => {})
    } catch {
      // Silently catch network or offline errors
    }
  }
}

// Live hook for recent template keys: starts with localStorage, then listens to
// users/{uid}/settings/templates in Firestore so recents sync across devices in real time.
export function useRecentTemplateKeys(uid) {
  const [keys, setKeys] = useState(getRecentTemplateKeys)

  useEffect(() => {
    if (!uid || !db) return

    const ref = doc(db, 'users', uid, 'settings', 'templates')
    return onSnapshot(
      ref,
      (snap) => {
        const cloudKeys = snap.data()?.recentKeys
        if (Array.isArray(cloudKeys) && cloudKeys.length > 0) {
          const valid = cloudKeys.slice(0, 6)
          setKeys(valid)
          try {
            localStorage.setItem(RECENT_KEY, JSON.stringify(valid))
          } catch {
            // Ignore storage write errors
          }
        } else {
          // If cloud has nothing yet, seed with any existing local recents
          const local = getRecentTemplateKeys()
          if (local.length > 0) {
            setDoc(ref, { recentKeys: local }, { merge: true }).catch(() => {})
          }
        }
      },
      () => {
        // Fall back to local keys if network/read fails
      },
    )
  }, [uid])

  return keys
}
