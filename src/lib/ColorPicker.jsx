import { useState } from 'react'
import { Blend, Check } from 'lucide-react'
import { contrast, normalizeHex } from './color.js'
import { gradient, isGradient, parseGradient } from './gradient.js'
import './ColorPicker.css'

// Preset swatches plus "Custom colour": the system colour picker, or a hex
// typed in. Used for form themes, and anywhere else a colour is chosen.
//   value    — a preset's value, or a '#rrggbb'
//   presets  — [{ value, label, swatch }] (swatch: the colour to show — a
//              hex, a CSS colour such as a theme variable, or 'transparent')
//   onChange — called with a preset value or a '#rrggbb'
//   gradients — optional [{ value, label }]: offers gradients too (value is
//              then a CSS linear-gradient, see lib/designStyles.js)
const DIRECTIONS = [
  [135, 'Diagonal ↘'],
  [180, 'Top to bottom'],
  [90, 'Left to right'],
  [45, 'Diagonal ↗'],
]

export default function ColorPicker({ value, presets, onChange, label = 'Colour', gradients }) {
  const custom = presets.some((p) => p.value === value) ? null : normalizeHex(value)
  const grad = gradients && isGradient(value) ? (parseGradient(value) ?? { from: '#667eea', to: '#764ba2', angle: 135 }) : null
  const isPresetGradient = Boolean(gradients?.some((g) => g.value === value))
  const [typed, setTyped] = useState(null) // hex text while it's being typed

  // Check mark that stays visible on light and dark colours alike.
  // (Non-hex swatches get a white tick with a shadow, see ColorPicker.css.)
  const tick = (hex) =>
    !normalizeHex(hex) ? '#ffffff' : contrast(hex, '#ffffff') >= 2.5 ? '#ffffff' : '#0e0f13'

  function commitTyped() {
    const hex = normalizeHex(typed ?? '')
    if (hex) onChange(hex)
    setTyped(null)
  }

  return (
    <div className="color-picker">
      <div className="color-swatches" role="radiogroup" aria-label={label}>
        {presets.map((p) => (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={value === p.value}
            aria-label={p.label}
            title={p.label}
            className={`color-swatch${p.swatch === 'transparent' ? ' color-swatch-clear' : ''}${normalizeHex(p.swatch) ? '' : ' color-swatch-var'}`}
            style={{ background: p.swatch === 'transparent' ? undefined : p.swatch, color: tick(p.swatch) }}
            onClick={() => onChange(p.value)}
          >
            {value === p.value && <Check size={16} />}
          </button>
        ))}
        <label
          className={`color-swatch color-swatch-custom${custom ? ' is-set' : ''}`}
          title="Custom colour"
          style={custom ? { background: custom, color: tick(custom) } : undefined}
        >
          <input
            type="color"
            aria-label={custom ? `Custom colour ${custom} (selected)` : 'Custom colour'}
            value={custom ?? '#4f46e5'}
            onChange={(e) => onChange(e.target.value)}
          />
          {custom && <Check size={16} />}
        </label>
      </div>
      {gradients && (
        <div className="color-swatches color-gradients" role="radiogroup" aria-label={`${label}: gradient`}>
          {gradients.map((g) => (
            <button
              key={g.value}
              type="button"
              role="radio"
              aria-checked={value === g.value}
              aria-label={g.label}
              title={g.label}
              className="color-swatch"
              style={{ background: g.value, color: '#ffffff' }}
              onClick={() => onChange(g.value)}
            >
              {value === g.value && <Check size={16} />}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={Boolean(grad) && !isPresetGradient}
            className={`color-swatch color-swatch-custom${grad && !isPresetGradient ? ' is-set' : ''}`}
            title="Custom gradient"
            aria-label="Custom gradient"
            style={grad && !isPresetGradient ? { background: value, color: '#ffffff' } : undefined}
            onClick={() => onChange(grad ? value : gradient('#667eea', '#764ba2'))}
          >
            {grad && !isPresetGradient ? <Check size={16} /> : <Blend size={16} />}
          </button>
        </div>
      )}
      {grad && (
        <div className="color-gradient-edit">
          <label>
            <span>From</span>
            <input type="color" value={grad.from} onChange={(e) => onChange(gradient(e.target.value, grad.to, grad.angle))} />
          </label>
          <label>
            <span>To</span>
            <input type="color" value={grad.to} onChange={(e) => onChange(gradient(grad.from, e.target.value, grad.angle))} />
          </label>
          <label className="color-gradient-dir">
            <span>Direction</span>
            <select value={grad.angle} onChange={(e) => onChange(gradient(grad.from, grad.to, Number(e.target.value)))}>
              {DIRECTIONS.map(([deg, name]) => (
                <option key={deg} value={deg}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {custom && (
        <label className="color-hex">
          <span>Custom</span>
          <input
            value={typed ?? custom.toUpperCase()}
            onChange={(e) => setTyped(e.target.value)}
            onBlur={commitTyped}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitTyped()
              }
            }}
            maxLength={7}
            spellCheck={false}
            aria-label="Custom colour hex code"
          />
          {typed !== null && !normalizeHex(typed) && <em>Use a hex code like #4F46E5</em>}
        </label>
      )}
    </div>
  )
}
