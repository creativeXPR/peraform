import { useEffect, useRef, useState } from 'react'
import { LogOut } from 'lucide-react'
import { signOut } from './authActions.js'
import { useAuth } from './useAuth.js'
import './AccountMenu.css'

// Top-bar avatar with a small popover: who's signed in, and sign out.
export default function AccountMenu() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e) => !rootRef.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null
  const label = user.displayName || user.email

  return (
    <div className="account" ref={rootRef}>
      <button
        type="button"
        className="icon-btn account-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account"
        aria-expanded={open}
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span>{(label || '?').charAt(0).toUpperCase()}</span>
        )}
      </button>

      {open && (
        <div className="account-pop" role="menu">
          <div className="account-who">
            {user.displayName && <strong>{user.displayName}</strong>}
            <span>{user.email}</span>
          </div>
          <button type="button" className="account-item" role="menuitem" onClick={signOut}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
