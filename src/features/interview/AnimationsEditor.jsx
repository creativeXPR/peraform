import { useState } from 'react'
import { Play, Plus, Sparkles, Trash2, X } from 'lucide-react'
import ColorPicker from '../../lib/ColorPicker.jsx'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import { ANIM_PROPS, PRESETS, WHEN, newAnimation } from '../../lib/animations.js'
import { EASINGS } from '../../lib/actions.js'
import Select from '../../lib/Select.jsx'
import './actions.css'

// One side (From / To) of an animation: the properties it sets.
function PropList({ title, values, onChange, colorPresets }) {
  const unused = Object.keys(ANIM_PROPS).filter((key) => !(key in values))
  const set = (key, value) => onChange({ ...values, [key]: value })
  const drop = (key) => {
    const rest = { ...values }
    delete rest[key]
    onChange(rest)
  }
  return (
    <div className="action-props anim-side">
      <span className="anim-side-title">{title}</span>
      {Object.keys(values).length === 0 && <span className="action-fixed">as designed</span>}
      {Object.entries(values).map(([key, value]) => {
        const def = ANIM_PROPS[key]
        return (
          <div key={key} className="action-prop">
            <span>{def.label}</span>
            {def.color ? (
              <ColorPicker value={value} presets={colorPresets} onChange={(v) => set(key, v)} label={def.label} />
            ) : (
              <label className="action-num">
                <input
                  type="number"
                  value={value}
                  min={def.min}
                  max={def.max}
                  onChange={(e) => e.target.value !== '' && set(key, Number(e.target.value))}
                />
                <em>{def.unit}</em>
              </label>
            )}
            <button type="button" className="icon-btn action-x" onClick={() => drop(key)} aria-label={`Remove ${def.label}`} title="Remove">
              <X size={14} />
            </button>
          </div>
        )
      })}
      {unused.length > 0 && (
        <Select
          value=""
          onChange={(e) => e.target.value && set(e.target.value, ANIM_PROPS[e.target.value].start)}
          aria-label={`Add to ${title}`}
        >
          <option value="">+ Add…</option>
          {unused.map((key) => (
            <option key={key} value={key}>
              {ANIM_PROPS[key].label}
            </option>
          ))}
        </Select>
      )}
    </div>
  )
}

// A block's animations (lib/animations.js), in the canvas Inspector.
export default function AnimationsEditor({ animations = [], onChange, onPreview, colorPresets }) {
  const [removing, setRemoving] = useState(null)
  const update = (id, patch) => onChange(animations.map((a) => (a.id === id ? { ...a, ...patch } : a)))

  return (
    <div className="actions-editor">
      {animations.map((a) => (
        <div key={a.id} className="action-card">
          <div className="action-row action-title">
            <Sparkles size={14} />
            <input
              className="anim-name"
              value={a.name}
              onChange={(e) => update(a.id, { name: e.target.value })}
              aria-label="Animation name"
            />
            <button type="button" className="icon-btn" onClick={() => onPreview(a)} title="Preview" aria-label={`Preview ${a.name}`}>
              <Play size={15} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setRemoving(a.id)}
              title="Remove animation"
              aria-label={`Remove ${a.name}`}
            >
              <Trash2 size={15} />
            </button>
          </div>

          <div className="action-row">
            <span className="action-word">When</span>
            <Select value={a.when} onChange={(e) => update(a.id, { when: e.target.value })} aria-label="When it plays">
              {Object.entries(WHEN).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div className="action-row">
            <span className="action-word">Preset</span>
            <Select
              value=""
              onChange={(e) => {
                if (!e.target.value) return
                // Everything from the preset, but keep this animation's id
                // (actions that play it refer to it).
                update(a.id, { ...newAnimation(e.target.value), id: a.id })
              }}
              aria-label="Apply a preset"
            >
              <option value="">Apply a preset…</option>
              {Object.entries(PRESETS).map(([key, p]) => (
                <option key={key} value={key}>
                  {p.name} ({WHEN[p.when].toLowerCase()})
                </option>
              ))}
            </Select>
          </div>

          <PropList title="From" values={a.from} onChange={(from) => update(a.id, { from })} colorPresets={colorPresets} />
          <PropList title="To" values={a.to} onChange={(to) => update(a.id, { to })} colorPresets={colorPresets} />

          <div className="action-row action-transition">
            <span className="action-word">Time</span>
            <label className="action-num">
              <input
                type="number"
                value={a.duration}
                min={0}
                max={20000}
                step={50}
                onChange={(e) => e.target.value !== '' && update(a.id, { duration: Number(e.target.value) })}
                aria-label="Length in milliseconds"
              />
              <em>ms</em>
            </label>
            <label className="action-num">
              <span className="action-fixed">after</span>
              <input
                type="number"
                value={a.delay ?? 0}
                min={0}
                max={20000}
                step={50}
                onChange={(e) => e.target.value !== '' && update(a.id, { delay: Number(e.target.value) })}
                aria-label="Delay in milliseconds"
              />
              <em>ms</em>
            </label>
            <Select value={a.easing} onChange={(e) => update(a.id, { easing: e.target.value })} aria-label="Easing">
              {Object.entries({ ...EASINGS, 'ease-in-out': 'Smooth both ways' }).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            {(a.when === 'loop' || a.when === 'action') && (
              <label className="action-check">
                <input type="checkbox" checked={Boolean(a.alternate)} onChange={(e) => update(a.id, { alternate: e.target.checked })} />
                Back and forth
              </label>
            )}
          </div>
        </div>
      ))}

      <button type="button" className="btn btn-outline actions-add" onClick={() => onChange([...animations, newAnimation('fadeIn')])}>
        <Plus size={15} />
        Add animation
      </button>

      <ConfirmModal
        open={Boolean(removing)}
        title="Remove this animation?"
        message="Actions that play it will stop doing anything. You can undo this."
        confirmLabel="Remove"
        onConfirm={() => {
          onChange(animations.filter((a) => a.id !== removing))
          setRemoving(null)
        }}
        onCancel={() => setRemoving(null)}
      />
    </div>
  )
}
