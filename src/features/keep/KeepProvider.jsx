import { useCallback, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth.js'
import { useToast } from '../../lib/useToast.jsx'
import { saveKeep } from './keepStore.js'
import { KeepContext } from './keepContext.js'
import KeepDialog from './KeepDialog.jsx'

// Gives creator screens the Keep: saving items (with a "Kept" toast) and
// the Keep dialog, opened from the top bar.
export default function KeepProvider({ children }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const targetsRef = useRef(null)
  const [toast, showToast] = useToast()

  const keep = useCallback(
    async (item) => {
      if (!user || !item) return
      try {
        await saveKeep(user.uid, item)
        showToast(`Kept “${item.label}” — find it under Keep in the top bar`)
      } catch {
        showToast('Couldn’t keep that. Check your connection and try again.')
      }
    },
    [user, showToast],
  )

  // Pages set their paste targets here (keepContext.js → useKeepTargets).
  const value = useMemo(
    () => ({
      keep,
      openKeep: () => setOpen(true),
      targetsRef,
      setTargets: (targets) => {
        targetsRef.current = targets
      },
      showToast,
    }),
    [keep, showToast],
  )

  return (
    <KeepContext.Provider value={value}>
      {children}
      {user && <KeepDialog open={open} onClose={() => setOpen(false)} uid={user.uid} />}
      {toast}
    </KeepContext.Provider>
  )
}
