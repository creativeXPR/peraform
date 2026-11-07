import { useState } from 'react'
import { ChevronDown, LogOut, Play, Plus, Repeat, X, Zap } from 'lucide-react'
import ColorPicker from '../../lib/ColorPicker.jsx'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import { ANIM_PROPS, PRESETS, WHEN, newAnimation } from '../../lib/animations.js'
import { EASINGS } from '../../lib/actions.js'
import Select from '../../lib/Select.jsx'
import { CurvePicker, SoftTiles } from './Tiles.jsx'
import './actions.css'
import './inspector.css'

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
      <span className="mini-h">{title}</span>
      {Object.keys(values).length === 0 && <span className="action-fixed">as designed</span>}
      {Object.entries(values).map(([key, value]) => {
        const def = ANIM_PROPS[key]
        return (
          <div key={key} className={`action-prop${def.color ? ' is-colour' : ''}`}>
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
          className="add-prop"
          value=""
          onChange={(e) => e.target.value && set(e.target.value, ANIM_PROPS[e.target.value].start)}
          aria-label={`Add to ${title}`}
        >
          <option value="">+ Another property…</option>
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

const PLAYS = [
  { value: 'start', label: 'On start', icon: Play, color: '#16a34a', title: WHEN.start },
  { value: 'loop', label: 'Always', icon: Repeat, color: '#0ea5e9', title: WHEN.loop },
  { value: 'action', label: 'On action', icon: Zap, color: '#a855f7', title: WHEN.action },
  { value: 'end', label: 'Leaving', icon: LogOut, color: '#f59e0b', title: WHEN.end },
]
const SHORT_WHEN = { start: 'On screen start', loop: 'Always', action: 'On an action', end: 'Before leaving' }
// One-click picks under the list; Custom adds a blank one.
const QUICK = ['pop', 'fadeIn', 'slideUp', 'pulse']
const QUICK_NAME = { pop: 'Pop in', fadeIn: 'Fade', slideUp: 'Slide', pulse: 'Pulse' }

// A block's animations (lib/animations.js), in the canvas Inspector: a row
// each ("Pop in · On screen start · 0.5 s"), opened in place to edit.
export default function AnimationsEditor({ animations = [], onChange, onPreview, colorPresets }) {
  const [removing, setRemoving] = useState(null)
  const [openId, setOpenId] = useState(null)
  const update = (id, patch) => onChange(animations.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  const add = (anim) => {
    onChange([...animations, anim])
    setOpenId(anim.id)
  }

  return (
    <div className="actions-editor">
      {animations.map((a) => {
        const open = openId === a.id
        return (
          <div key={a.id} className={`act-card anim-card${open ? ' is-open' : ''}`}>
            <button type="button" className="act-top" onClick={() => setOpenId(open ? null : a.id)} aria-expanded={open}>
              <i className="anim-chip" aria-hidden="true" />
              <span className="anim-what">
                <b>{a.name || 'Animation'}</b>
                <small>
                  {SHORT_WHEN[a.when]} · {(a.duration / 1000).toFixed(a.duration % 1000 ? 1 : 0)} s
                </small>
              </span>
              <ChevronDown size={15} className="act-chev" aria-hidden="true" />
            </button>

            {open && (
              <div className="act-body">
                <input
                  className="insp-input"
                  value={a.name}
                  onChange={(e) => update(a.id, { name: e.target.value })}
                  aria-label="Animation name"
                />
                <span className="mini-h">Plays</span>
                <SoftTiles label="When it plays" columns={4} options={PLAYS} value={a.when} onChange={(when) => update(a.id, { when })} />
                <Select
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return
                    // Everything from the preset, but keep this animation's id
                    // (actions that play it refer to it).
                    update(a.id, { ...newAnimation(e.target.value), id: a.id })
                  }}
                  aria-label="Start from a preset"
                >
                  <option value="">Start from a preset…</option>
                  {Object.entries(PRESETS).map(([key, p]) => (
                    <option key={key} value={key}>
                      {p.name} ({WHEN[p.when].toLowerCase()})
                    </option>
                  ))}
                </Select>

                <PropList title="From" values={a.from} onChange={(from) => update(a.id, { from })} colorPresets={colorPresets} />
                <PropList title="To" values={a.to} onChange={(to) => update(a.id, { to })} colorPresets={colorPresets} />

                <span className="mini-h">Timing</span>
                <div className="anim-timing">
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
                </div>
                {(a.when === 'loop' || a.when === 'action') && (
                  <label className="action-check">
                    <input type="checkbox" checked={Boolean(a.alternate)} onChange={(e) => update(a.id, { alternate: e.target.checked })} />
                    Back and forth
                  </label>
                )}
                <CurvePicker
                  values={[...Object.keys(EASINGS), 'ease-in-out']}
                  value={a.easing}
                  onChange={(easing) => update(a.id, { easing })}
                />
                <div className="act-foot">
                  <button type="button" className="chip-btn" onClick={() => onPreview(a)}>
                    <Play size={12} /> Preview on canvas
                  </button>
                  <button type="button" className="act-remove" onClick={() => setRemoving(a.id)}>
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      <span className="mini-h">{animations.length ? 'Add another' : 'Add one'}</span>
      <div className="anim-quick">
        {QUICK.map((key) => (
          <button key={key} type="button" className={`anim-pick anim-${key}`} onClick={() => add(newAnimation(key))} title={PRESETS[key].name}>
            <i aria-hidden="true" />
            {QUICK_NAME[key]}
          </button>
        ))}
        <button
          type="button"
          className="anim-pick is-custom"
          onClick={() => add({ ...newAnimation('fadeIn'), preset: null, name: 'Custom', from: {}, to: {} })}
          title="A blank animation to set up yourself"
        >
          <i aria-hidden="true">
            <Plus size={12} />
          </i>
          Custom
        </button>
      </div>

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
