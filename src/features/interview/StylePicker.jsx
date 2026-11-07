import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { DESIGN_STYLES } from '../../lib/designStyles.js'
import { backgroundCss } from '../../lib/interview.js'
import { THEME_FONTS, loadThemeFont } from '../../lib/theme.js'

// The design styles as tiny live screens: each in its own background, card,
// heading font, corners, answer dots and Back/Next buttons, with a one-line
// feel. Hover plays its entrance. Pick one, then apply it to this screen or
// every screen. Restyles only: layout, content and actions stay.
//   restorable: a style has been applied (here or elsewhere), so "Back to
//   original look" is offered: onRestore('screen' | 'all')
const FEEL = {
  playful: 'Bright, round, bouncy',
  classroom: 'Calm, clear, for schools',
  official: 'Formal, square, no fuss',
  flow: 'Minimal, big heading',
  glass: 'Frosted, vivid, modern',
  midnight: 'Dark with a glow',
}
const SAMPLE = {
  playful: 'Hey there! 🎉',
  classroom: 'Lesson 1',
  official: 'Application',
  flow: 'Welcome',
  glass: 'Join us',
  midnight: 'Level up',
}

const fill = (bg, alpha = 100) => (bg === 'transparent' ? 'transparent' : backgroundCss(bg, alpha))

export default function StylePicker({ current, onApply, restorable, onRestore }) {
  const [picked, setPicked] = useState(null)
  // The previews' heading fonts (Friendly, Classic).
  useEffect(() => ['rounded', 'serif'].forEach(loadThemeFont), [])
  return (
    <div className="sp">
      <div className="sp-grid" role="radiogroup" aria-label="Design style">
        {Object.entries(DESIGN_STYLES).map(([key, def]) => {
          const s = def.build(def.palette)
          const on = (picked ?? current) === key
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={on}
              className={`sp-tile sp-${key}${on ? ' is-on' : ''}`}
              onClick={() => setPicked(key)}
              title={def.blurb}
            >
              <span className="sp-screen" style={{ background: s.bg }} aria-hidden="true">
                <span
                  className="sp-card"
                  style={{
                    background: fill(s.card.bg, s.card.bgAlpha),
                    borderRadius: Math.min(12, s.card.radius / 2),
                    border: s.card.borderWidth ? `1px solid ${s.card.borderColor}` : undefined,
                    backdropFilter: s.card.blur ? 'blur(6px)' : undefined,
                    color: s.text.color,
                  }}
                >
                  <span className="sp-h" style={{ color: s.title.color, fontFamily: THEME_FONTS[s.title.font]?.family }}>
                    {SAMPLE[key]}
                  </span>
                  <span className="sp-opt">
                    <i className="is-on" />
                    <span style={{ width: '55%' }} />
                  </span>
                  <span className="sp-opt">
                    <i />
                    <span style={{ width: '40%' }} />
                  </span>
                  <span className="sp-btns">
                    <em style={{ background: fill(s.back.bg, s.back.bgAlpha), borderRadius: Math.min(9, s.back.radius) }} />
                    <b style={{ background: s.button.bg, borderRadius: Math.min(9, s.button.radius) }} />
                  </span>
                </span>
              </span>
              <span className="sp-cap">
                <strong>{def.label}</strong>
                <small>{FEEL[key]}</small>
              </span>
            </button>
          )
        })}
      </div>
      {picked && (
        <div className="sp-apply">
          <span>
            Use <b>{DESIGN_STYLES[picked].label}</b> on
          </span>
          <button type="button" className="chip-btn" onClick={() => onApply(picked, 'screen')}>
            This screen
          </button>
          <button type="button" className="chip-btn is-primary" onClick={() => onApply(picked, 'all')}>
            All screens
          </button>
        </div>
      )}
      {restorable && (
        <div className="sp-apply sp-restore">
          <span>
            <RotateCcw size={13} aria-hidden="true" /> Original look on
          </span>
          <button type="button" className="chip-btn" onClick={() => onRestore('screen')}>
            This screen
          </button>
          <button type="button" className="chip-btn" onClick={() => onRestore('all')}>
            All screens
          </button>
        </div>
      )}
    </div>
  )
}
