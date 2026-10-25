import { useState } from 'react'
import { Plus, Trash2, X, Zap } from 'lucide-react'
import ColorPicker from '../../lib/ColorPicker.jsx'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import { EASINGS, EFFECTS, SET_PROPS, TRANSITION_DEFAULTS, newAction } from '../../lib/actions.js'
import Select from '../../lib/Select.jsx'
import './actions.css'

// Edits a block's actions (lib/actions.js). Shared by the interview canvas
// (buttons and question blocks) and normal-form questions.
//   trigger     — 'click' | 'select' | 'match': what this block can react to
//   options     — for 'select': the question's options
//   targets     — [{ id, label, shownAtStart? }] blocks an action can change
//   allowSet    — interview only: "Change how it looks"
//   colorPresets — swatches for colour changes
//   onTargetVisibility(id, hidden) — interview: sets whether a target starts
//                 hidden, offered when "Show" points at a block already shown
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

  const firstTrigger =
    trigger === 'click'
      ? { type: 'click' }
      : trigger === 'select'
        ? { type: 'select', option: options[0] ?? '' }
        : { type: 'match', pattern: '' }

  const update = (id, fn) => onChange(actions.map((a) => (a.id === id ? fn(a) : a)))
  // Changing looks and playing animations are interview-only.
  const effects = Object.entries(EFFECTS).filter(([key]) => allowSet || (key !== 'set' && key !== 'play'))

  return (
    <div className="actions-editor">
      {actions.map((a, i) => {
        const t = { ...TRANSITION_DEFAULTS, ...a.transition }
        const props = a.effect.props ?? {}
        // A whole screen only has a background to change.
        const forScreen = targets.find((x) => x.id === a.target)?.screen
        const unused = Object.keys(SET_PROPS).filter((key) => !(key in props) && (!forScreen || key === 'bg'))
        return (
          <div key={a.id} className="action-card">
            <div className="action-row action-title">
              <Zap size={14} />
              <strong>Action {i + 1}</strong>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setRemoving(a.id)}
                aria-label={`Remove action ${i + 1}`}
                title="Remove action"
              >
                <Trash2 size={15} />
              </button>
            </div>

            <div className="action-row">
              <span className="action-word">When</span>
              {a.trigger.type === 'click' && <span className="action-fixed">this button is clicked</span>}
              {a.trigger.type === 'select' && (
                <>
                  <span className="action-fixed">they choose</span>
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
                  <span className="action-fixed">the answer includes</span>
                  <input
                    value={a.trigger.pattern}
                    onChange={(e) => update(a.id, (x) => ({ ...x, trigger: { type: 'match', pattern: e.target.value } }))}
                    placeholder="text or a pattern, e.g. @school\.edu$"
                    aria-label="Text or pattern to look for"
                  />
                </>
              )}
            </div>

            <div className="action-row">
              <span className="action-word">Then</span>
              <Select
                value={a.effect.type}
                onChange={(e) =>
                  update(a.id, (x) => ({
                    ...x,
                    effect:
                      e.target.value === 'set'
                        ? { type: 'set', props: x.effect.props ?? { opacity: 100 } }
                        : e.target.value === 'play'
                          ? { type: 'play', animation: null }
                          : { type: e.target.value },
                  }))
                }
                aria-label="What happens"
              >
                {effects.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
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
            </div>

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

            {targets.find((x) => x.id === a.target)?.screen && ['play'].includes(a.effect.type) && (
              <p className="action-hint">A whole screen can be shown, hidden or recoloured, but it has no animations of its own.</p>
            )}

            {a.effect.type === 'play' && (
              <div className="action-row">
                <span className="action-word" />
                {(() => {
                  const anims = targets.find((x) => x.id === a.target)?.animations ?? []
                  return anims.length ? (
                    <Select
                      value={a.effect.animation ?? ''}
                      onChange={(e) =>
                        update(a.id, (x) => ({ ...x, effect: { type: 'play', animation: e.target.value || null } }))
                      }
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
                    <span className="action-fixed">
                      {a.target ? 'That block has no animations yet: add one to it first.' : 'Choose a block first.'}
                    </span>
                  )
                })()}
              </div>
            )}

            {a.effect.type === 'set' && (
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
                    <div key={key} className="action-prop">
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
                        <label className="action-num">
                          <input
                            type="number"
                            value={value}
                            min={def.min}
                            max={def.max}
                            step={def.step}
                            onChange={(e) => e.target.value !== '' && setProp(Number(e.target.value))}
                          />
                          <em>{def.unit}</em>
                        </label>
                      )}
                      <button type="button" className="icon-btn action-x" onClick={dropProp} aria-label={`Remove ${def.label}`} title="Remove">
                        <X size={14} />
                      </button>
                    </div>
                  )
                })}
                {unused.length > 0 && (
                  <Select
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
                    <option value="">+ Add a change…</option>
                    {unused.map((key) => (
                      <option key={key} value={key}>
                        {SET_PROPS[key].label}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            )}

            <div className="action-row action-transition">
              <span className="action-word">Over</span>
              <label className="action-num">
                <input
                  type="number"
                  value={t.duration}
                  min={0}
                  max={10000}
                  step={50}
                  onChange={(e) =>
                    e.target.value !== '' &&
                    update(a.id, (x) => ({ ...x, transition: { ...t, duration: Number(e.target.value) } }))
                  }
                  aria-label="Transition length in milliseconds"
                />
                <em>ms</em>
              </label>
              <Select
                value={t.easing}
                onChange={(e) => update(a.id, (x) => ({ ...x, transition: { ...t, easing: e.target.value } }))}
                aria-label="Transition style"
              >
                {Object.entries(EASINGS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <label className="action-check">
                <input
                  type="checkbox"
                  checked={t.display}
                  onChange={(e) => update(a.id, (x) => ({ ...x, transition: { ...t, display: e.target.checked } }))}
                />
                Fade when showing/hiding
              </label>
            </div>
          </div>
        )
      })}

      <button
        type="button"
        className="btn btn-outline actions-add"
        disabled={trigger === 'select' && !options.length}
        onClick={() => onChange([...actions, newAction(firstTrigger)])}
      >
        <Plus size={15} />
        Add action
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
