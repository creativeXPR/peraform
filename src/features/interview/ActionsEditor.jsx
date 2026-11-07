import { useState } from 'react'
import { ChevronDown, EyeOff, Eye, Palette, Play, Plus, Repeat, X } from 'lucide-react'
import ColorPicker from '../../lib/ColorPicker.jsx'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import { EASINGS, EFFECTS, SET_PROPS, TRANSITION_DEFAULTS, newAction } from '../../lib/actions.js'
import Select from '../../lib/Select.jsx'
import { CurvePicker, SoftTiles } from './Tiles.jsx'
import './actions.css'
import './inspector.css'

// Edits a block's actions (lib/actions.js). Shared by the interview canvas
// (buttons and question blocks) and normal-form questions. Each action reads
// as a sentence (Show [Submit] with a [fade]); click it to open its settings
// in place. (mockups/interview-editor-mockup.html)
//   trigger     — 'click' | 'select' | 'match': what this block can react to
//   options     — for 'select': the question's options
//   targets     — [{ id, label, shownAtStart? }] blocks an action can change
//   allowSet    — interview only: "Change how it looks"
//   colorPresets — swatches for colour changes
//   onTargetVisibility(id, hidden) — interview: sets whether a target starts
//                 hidden, offered when "Show" points at a block already shown
const EFFECT_TILES = {
  show: { label: 'Show', icon: Eye, color: '#16a34a' },
  hide: { label: 'Hide', icon: EyeOff, color: '#64748b' },
  toggle: { label: 'Toggle', icon: Repeat, color: '#0ea5e9', title: 'Show ↔ hide' },
  set: { label: 'Change', icon: Palette, color: '#a855f7', title: 'Change how it looks' },
  play: { label: 'Animate', icon: Play, color: '#f59e0b', title: 'Play an animation' },
}
const VERB = { show: 'Show', hide: 'Hide', toggle: 'Toggle', set: 'Change', play: 'Animate' }

function Sentence({ a, targets }) {
  const target = targets.find((x) => x.id === a.target)
  const t = { ...TRANSITION_DEFAULTS, ...a.transition }
  return (
    <span className="act-line">
      {a.trigger.type === 'select' && (
        <>
          When they choose <span className="tok tok-a">{a.trigger.option || '…'}</span>→
        </>
      )}
      {a.trigger.type === 'match' && (
        <>
          When it includes <span className="tok tok-a">{a.trigger.pattern || 'anything'}</span>→
        </>
      )}
      <span>{VERB[a.effect.type]}</span>
      <span className={`tok tok-v${target ? '' : ' is-missing'}`}>{target?.label ?? 'choose a block'}</span>
      {['show', 'hide', 'toggle'].includes(a.effect.type) && t.display && (
        <>
          with a <span className="tok tok-t">fade</span>
        </>
      )}
    </span>
  )
}

export default function ActionsEditor({
  actions = [],
  onChange,
  trigger,
  options = [],
  targets,
  allowSet,
  colorPresets,
  onTargetVisibility,
}) {
  const [removing, setRemoving] = useState(null) // action id
  const [openId, setOpenId] = useState(null)

  const firstTrigger =
    trigger === 'click'
      ? { type: 'click' }
      : trigger === 'select'
        ? { type: 'select', option: options[0] ?? '' }
        : { type: 'match', pattern: '' }

  const update = (id, fn) => onChange(actions.map((a) => (a.id === id ? fn(a) : a)))
  // Changing looks and playing animations are interview-only.
  const effects = Object.keys(EFFECTS)
    .filter((key) => allowSet || (key !== 'set' && key !== 'play'))
    .map((key) => ({ value: key, ...EFFECT_TILES[key] }))

  return (
    <div className="actions-editor">
      {actions.map((a, i) => {
        const open = openId === a.id
        const t = { ...TRANSITION_DEFAULTS, ...a.transition }
        const props = a.effect.props ?? {}
        // A whole screen only has a background to change.
        const forScreen = targets.find((x) => x.id === a.target)?.screen
        const unused = Object.keys(SET_PROPS).filter((key) => !(key in props) && (!forScreen || key === 'bg'))
        return (
          <div key={a.id} className={`act-card${open ? ' is-open' : ''}`}>
            <button type="button" className="act-top" onClick={() => setOpenId(open ? null : a.id)} aria-expanded={open}>
              <span className="act-n">{i + 1}</span>
              <Sentence a={a} targets={targets} />
              <ChevronDown size={15} className="act-chev" aria-hidden="true" />
            </button>

            {open && (
              <div className="act-body">
                {a.trigger.type === 'select' && (
                  <>
                    <span className="mini-h">When they choose</span>
                    {/* An answer that's no longer an option (renamed or removed)
                        shows as unset, so it's never mistaken for the first one. */}
                    <Select
                      value={options.includes(a.trigger.option) ? a.trigger.option : ''}
                      onChange={(e) => update(a.id, (x) => ({ ...x, trigger: { type: 'select', option: e.target.value } }))}
                      aria-label="Option"
                      className={options.includes(a.trigger.option) ? '' : 'action-missing'}
                      title={options.includes(a.trigger.option) ? undefined : 'Pick which answer sets this off'}
                    >
                      {!options.includes(a.trigger.option) && (
                        <option value="" disabled>
                          Choose an answer…
                        </option>
                      )}
                      {options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </Select>
                  </>
                )}
                {a.trigger.type === 'match' && (
                  <>
                    <span className="mini-h">When the answer includes</span>
                    <input
                      className="insp-input"
                      value={a.trigger.pattern}
                      onChange={(e) => update(a.id, (x) => ({ ...x, trigger: { type: 'match', pattern: e.target.value } }))}
                      placeholder="text or a pattern, e.g. @school\.edu$"
                      aria-label="Text or pattern to look for"
                    />
                  </>
                )}

                <span className="mini-h">Do this</span>
                <SoftTiles
                  label="What happens"
                  columns={effects.length}
                  options={effects}
                  value={a.effect.type}
                  onChange={(v) =>
                    update(a.id, (x) => ({
                      ...x,
                      effect:
                        v === 'set'
                          ? { type: 'set', props: x.effect.props ?? { opacity: 100 } }
                          : v === 'play'
                            ? { type: 'play', animation: null }
                            : { type: v },
                    }))
                  }
                />

                <span className="mini-h">To</span>
                <Select
                  value={a.target ?? ''}
                  onChange={(e) => update(a.id, (x) => ({ ...x, target: e.target.value || null }))}
                  aria-label="Which block"
                  className={a.target ? '' : 'action-missing'}
                >
                  <option value="">Choose a block…</option>
                  {targets.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.label}
                    </option>
                  ))}
                </Select>

                {onTargetVisibility && a.target && (() => {
                  const shown = targets.find((x) => x.id === a.target)?.shownAtStart
                  if (a.effect.type === 'show' && shown) {
                    return (
                      <p className="action-hint">
                        That block already shows from the start, so this won’t change anything.{' '}
                        <button type="button" className="link-btn" onClick={() => onTargetVisibility(a.target, true)}>
                          Hide it until then
                        </button>
                      </p>
                    )
                  }
                  if (a.effect.type === 'hide' && shown === false) {
                    return (
                      <p className="action-hint">
                        That block starts hidden, so this won’t change anything.{' '}
                        <button type="button" className="link-btn" onClick={() => onTargetVisibility(a.target, false)}>
                          Show it from the start
                        </button>
                      </p>
                    )
                  }
                  return null
                })()}

                {forScreen && a.effect.type === 'play' && (
                  <p className="action-hint">A whole screen can be shown, hidden or recoloured, but it has no animations of its own.</p>
                )}

                {a.effect.type === 'play' &&
                  (() => {
                    const anims = targets.find((x) => x.id === a.target)?.animations ?? []
                    return anims.length ? (
                      <Select
                        value={a.effect.animation ?? ''}
                        onChange={(e) => update(a.id, (x) => ({ ...x, effect: { type: 'play', animation: e.target.value || null } }))}
                        aria-label="Which animation"
                        className={a.effect.animation ? '' : 'action-missing'}
                      >
                        <option value="">Choose an animation…</option>
                        {anims.map((anim) => (
                          <option key={anim.id} value={anim.id}>
                            {anim.name}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <p className="action-hint">
                        {a.target ? 'That block has no animations yet: add one to it first.' : 'Choose a block first.'}
                      </p>
                    )
                  })()}

                {a.effect.type === 'set' && (
                  <>
                    <span className="mini-h">Change these</span>
                    <div className="action-props">
                      {Object.entries(props).map(([key, value]) => {
                        const def = SET_PROPS[key]
                        const setProp = (v) =>
                          update(a.id, (x) => ({ ...x, effect: { ...x.effect, props: { ...x.effect.props, [key]: v } } }))
                        const dropProp = () =>
                          update(a.id, (x) => {
                            const rest = { ...x.effect.props }
                            delete rest[key]
                            return { ...x, effect: { ...x.effect, props: rest } }
                          })
                        return (
                          <div key={key} className={`action-prop${def.color ? ' is-colour' : ''}`}>
                            <span>{def.label}</span>
                            {def.color ? (
                              <ColorPicker value={value} presets={colorPresets} onChange={setProp} label={def.label} />
                            ) : def.choices ? (
                              <Select value={value} onChange={(e) => setProp(e.target.value)} aria-label={def.label}>
                                {Object.entries(def.choices).map(([k, label]) => (
                                  <option key={k} value={k}>
                                    {label}
                                  </option>
                                ))}
                              </Select>
                            ) : (
                              <span className="prop-slide">
                                <input
                                  type="range"
                                  value={value}
                                  min={def.min}
                                  max={def.max}
                                  step={def.step}
                                  onChange={(e) => setProp(Number(e.target.value))}
                                  aria-label={def.label}
                                />
                                <label className="action-num">
                                  <input
                                    type="number"
                                    value={value}
                                    min={def.min}
                                    max={def.max}
                                    step={def.step}
                                    onChange={(e) => e.target.value !== '' && setProp(Number(e.target.value))}
                                    aria-label={`${def.label} value`}
                                  />
                                  <em>{def.unit}</em>
                                </label>
                              </span>
                            )}
                            <button type="button" className="icon-btn action-x" onClick={dropProp} aria-label={`Remove ${def.label}`} title="Remove">
                              <X size={14} />
                            </button>
                          </div>
                        )
                      })}
                      {unused.length > 0 && (
                        <Select
                          className="add-prop"
                          value=""
                          onChange={(e) => {
                            const key = e.target.value
                            if (!key) return
                            const def = SET_PROPS[key]
                            const start = def.start ?? (def.color ? 'accent' : key === 'scale' || key === 'opacity' ? 100 : 0)
                            update(a.id, (x) => ({ ...x, effect: { ...x.effect, props: { ...x.effect.props, [key]: start } } }))
                          }}
                          aria-label="Add a change"
                        >
                          <option value="">+ Another property…</option>
                          {unused.map((key) => (
                            <option key={key} value={key}>
                              {SET_PROPS[key].label}
                            </option>
                          ))}
                        </Select>
                      )}
                    </div>
                  </>
                )}

                <span className="mini-h">Transition</span>
                <label className="action-num">
                  <input
                    type="number"
                    value={t.duration}
                    min={0}
                    max={10000}
                    step={50}
                    onChange={(e) =>
                      e.target.value !== '' && update(a.id, (x) => ({ ...x, transition: { ...t, duration: Number(e.target.value) } }))
                    }
                    aria-label="Transition length in milliseconds"
                  />
                  <em>ms</em>
                </label>
                <CurvePicker
                  values={Object.keys(EASINGS)}
                  value={t.easing}
                  onChange={(easing) => update(a.id, (x) => ({ ...x, transition: { ...t, easing } }))}
                />
                <label className="action-check">
                  <input
                    type="checkbox"
                    checked={t.display}
                    onChange={(e) => update(a.id, (x) => ({ ...x, transition: { ...t, display: e.target.checked } }))}
                  />
                  Fade when showing/hiding
                </label>
                <div className="act-foot">
                  <button type="button" className="act-remove" onClick={() => setRemoving(a.id)}>
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      <button
        type="button"
        className="showif-add"
        disabled={trigger === 'select' && !options.length}
        onClick={() => {
          const action = newAction(firstTrigger)
          onChange([...actions, action])
          setOpenId(action.id)
        }}
      >
        <span className="showif-plus" aria-hidden="true">
          <Plus size={13} />
        </span>
        Add an effect
        <small>show, hide, change, animate</small>
      </button>

      <ConfirmModal
        open={Boolean(removing)}
        title="Remove this action?"
        message="This block will stop changing the other block. You can undo this."
        confirmLabel="Remove"
        onConfirm={() => {
          onChange(actions.filter((a) => a.id !== removing))
          setRemoving(null)
        }}
        onCancel={() => setRemoving(null)}
      />
    </div>
  )
}
