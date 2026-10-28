import { useEffect, useRef, useState } from 'react'
import { Grip } from 'lucide-react'
import { CURRENT_APP, QT_APPS } from './qtApps.js'
import './AppSwitcher.css'

// Top-bar "Quality Tools apps" grid (like Google's apps menu): a 3×3 dot
// button that opens a panel of every QT app. The current app is marked and
// opens in place; the others open in a new tab so work here isn't lost.
export default function AppSwitcher() {
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

  return (
    <div className="apps" ref={rootRef}>
      <button
        type="button"
        className="icon-btn apps-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Quality Tools apps"
        title="Quality Tools apps"
        aria-expanded={open}
      >
        <Grip size={20} />
      </button>

      {open && (
        <div className="apps-pop" role="menu" aria-label="Quality Tools apps">
          <p className="apps-title">Quality Tools</p>
          <div className="apps-grid">
            {QT_APPS.map(({ id, name, url, Mark }) => {
              const current = id === CURRENT_APP
              return (
                <a
                  key={id}
                  href={current ? '/' : url}
                  target={current ? undefined : '_blank'}
                  rel={current ? undefined : 'noopener'}
                  className={`apps-item${current ? ' current' : ''}`}
                  role="menuitem"
                  aria-current={current ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                >
                  <span className="apps-icon">
                    <Mark size={30} />
                  </span>
                  <span className="apps-name">{name}</span>
                </a>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
