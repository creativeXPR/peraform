import { useState } from 'react'
import { Check } from 'lucide-react'
import { DESIGN_STYLES } from '../../lib/designStyles.js'

// The design styles as small previews: pick one, then apply it to this
// screen or every screen. Restyles only: layout, content and actions stay.
export default function StylePicker({ current, onApply }) {
  const [picked, setPicked] = useState(current ?? null)
  return (
    <div className="style-picker">
      <div className="style-grid" role="radiogroup" aria-label="Design style">
        {Object.entries(DESIGN_STYLES).map(([key, def]) => {
          const look = def.build(def.palette)
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={picked === key}
              className={`style-card${picked === key ? ' is-on' : ''}`}
              onClick={() => setPicked(key)}
              title={def.blurb}
            >
              <span className="style-preview" style={{ background: look.bg }} aria-hidden="true">
                <span
                  className="style-preview-card"
                  style={{
                    background: look.card.bg === 'transparent' ? 'transparent' : look.card.bg,
                    opacity: 1,
                    borderRadius: Math.min(10, look.card.radius / 2),
                    border: look.card.borderWidth ? `1px solid ${look.card.borderColor}` : undefined,
                    backdropFilter: look.card.blur ? 'blur(6px)' : undefined,
                    ...(look.card.bgAlpha < 100 && look.card.bg !== 'transparent'
                      ? { background: `color-mix(in srgb, ${look.card.bg} ${look.card.bgAlpha}%, transparent)` }
                      : {}),
                  }}
                >
                  <span className="style-preview-title" style={{ background: look.title.color }} />
                  <span className="style-preview-line" style={{ background: look.text.color }} />
                  <span className="style-preview-btn" style={{ background: look.button.bg, borderRadius: Math.min(8, look.button.radius) }} />
                </span>
              </span>
              <span className="style-name">
                {def.label}
                {picked === key && <Check size={14} aria-hidden="true" />}
              </span>
            </button>
          )
        })}
      </div>
      {picked && <p className="insp-note">{DESIGN_STYLES[picked].blurb}</p>}
      <div className="style-actions">
        <button type="button" className="btn btn-outline" disabled={!picked} onClick={() => onApply(picked, 'screen')}>
          This screen
        </button>
        <button type="button" className="btn btn-primary" disabled={!picked} onClick={() => onApply(picked, 'all')}>
          All screens
        </button>
      </div>
    </div>
  )
}
