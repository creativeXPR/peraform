import { useState } from 'react'
import { Check } from 'lucide-react'
import { contrast, normalizeHex } from './color.js'
import './ColorPicker.css'

// Preset swatches plus "Custom colour": the system colour picker, or a hex
// typed in. Used for form themes, and anywhere else a colour is chosen.
//   value    — a preset's value, or a '#rrggbb'
//   presets  — [{ value, label, swatch }] (swatch: the colour to show)
//   onChange — called with a preset value or a '#rrggbb'
export default function ColorPicker({ value, presets, onChange, label = 'Colour' }) {
  const custom = presets.some((p) => p.value === value) ? null : normalizeHex(value)
  const [typed, setTyped] = useState(null) // hex text while it's being typed

  // Check mark that stays visible on light and dark colours alike.
  const tick = (hex) => (contrast(hex, '#ffffff') >= 2.5 ? '#ffffff' : '#0e0f13')

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
            className="color-swatch"
            style={{ background: p.swatch, color: tick(p.swatch) }}
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
