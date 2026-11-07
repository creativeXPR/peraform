import { useState } from 'react'
import { ChevronRight, Info } from 'lucide-react'
import './panel.css'

// The side panels' groups (Design screens): a heading that folds the group,
// with what's set shown on the right, so a folded group still says it.
// Which groups are open is remembered in this browser (per group id).
//   id — remembered under it; defaultOpen — before anyone chose
//   value — the current choice, shown on the heading; tip — an InfoTip text
const KEY = 'peraform:panel-groups'

function remembered() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {}
  } catch {
    return {}
  }
}

export default function PanelGroup({ id, title, value, tip, defaultOpen = false, children }) {
  const [open, setOpen] = useState(() => remembered()[id] ?? defaultOpen)
  function toggle() {
    const next = !open
    setOpen(next)
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...remembered(), [id]: next }))
    } catch {
      // Private windows: it just isn't remembered.
    }
  }
  return (
    <section className={`pg${open ? ' is-open' : ''}`}>
      <div className="pg-head">
        <button type="button" className="pg-toggle" onClick={toggle} aria-expanded={open}>
          <ChevronRight size={14} className="pg-chev" aria-hidden="true" />
          <span className="pg-title">{title}</span>
        </button>
        {tip && <InfoTip text={tip} />}
        {value && (
          <button type="button" className="pg-value" onClick={toggle} tabIndex={-1}>
            {value}
          </button>
        )}
      </div>
      {open && <div className="pg-body">{children}</div>}
    </section>
  )
}

// ⓘ: a longer note, shown on hover or focus (tap on phones).
export function InfoTip({ text, label = 'More about this' }) {
  return (
    <span className="info-tip" tabIndex={0} role="note" aria-label={`${label}: ${text}`}>
      <Info size={14} aria-hidden="true" />
      <span className="info-bubble" aria-hidden="true">
        {text}
      </span>
    </span>
  )
}
