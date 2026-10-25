import { useState } from 'react'
import { Eye, Plus, Trash2 } from 'lucide-react'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import { triggerKindFor } from '../../lib/actions.js'
import Select from '../../lib/Select.jsx'

// "Show only if…" on the item that appears: it stays hidden until an
// earlier question's answer matches, and hides again if it stops matching.
// Several rules: any one of them shows it. Each rule is an action stored on
// the question it reads (lib/actions.js), so respondents' forms already
// follow it.
//   rules:   [{ sourceId, actionId, trigger }] — this item's rules
//   sources: questions before this item that can trigger (choice or typed)
//   onAdd(sourceId, trigger), onRemove(sourceId, actionId)
//   compact: the card is collapsed — just a summary chip
function ruleText(rule, sources) {
  const q = sources.find((s) => s.id === rule.sourceId)
  const name = `“${q?.title || 'Untitled question'}”`
  if (rule.trigger.type === 'select') return `${name} is “${rule.trigger.option}”`
  return rule.trigger.pattern ? `${name} includes “${rule.trigger.pattern}”` : `${name} is answered`
}

export default function ShowIf({ rules, sources, onAdd, onRemove, compact = false, noun = 'question' }) {
  const [adding, setAdding] = useState(false)
  const [sourceId, setSourceId] = useState('')
  const [value, setValue] = useState('')
  const [removing, setRemoving] = useState(null) // rule

  if (compact) {
    if (!rules.length) return null
    return (
      <p className="showif-chip">
        <Eye size={14} aria-hidden="true" />
        Shows only if {rules.map((r) => ruleText(r, sources)).join(' or ')}
      </p>
    )
  }

  const source = sources.find((s) => s.id === sourceId)
  const kind = triggerKindFor(source)
  const ready = source && (kind === 'select' ? value !== '' : true)

  function save() {
    onAdd(sourceId, kind === 'select' ? { type: 'select', option: value } : { type: 'match', pattern: value.trim() })
    setAdding(false)
    setSourceId('')
    setValue('')
  }

  return (
    <div className="showif">
      {rules.length > 0 && (
        <div className="showif-rules">
          <span className="showif-head">
            <Eye size={15} aria-hidden="true" /> This {noun} shows only if
          </span>
          {rules.map((r, i) => (
            <div key={r.actionId} className="showif-rule">
              {i > 0 && <span className="showif-or">or</span>}
              <span>{ruleText(r, sources)}</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setRemoving(r)}
                aria-label="Remove this condition"
                title="Remove this condition"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="showif-form">
          <span className="showif-head">
            <Eye size={15} aria-hidden="true" /> Show this {noun} only if
          </span>
          <div className="showif-row">
            <Select
              value={sourceId}
              onChange={(e) => {
                setSourceId(e.target.value)
                setValue('')
              }}
              aria-label="Which question"
            >
              <option value="">Choose a question above…</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || 'Untitled question'}
                </option>
              ))}
            </Select>
            {source && kind === 'select' && (
              <>
                <span>is</span>
                <Select value={value} onChange={(e) => setValue(e.target.value)} aria-label="Which answer">
                  <option value="">Choose an answer…</option>
                  {(source.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              </>
            )}
            {source && kind === 'match' && (
              <>
                <span>includes</span>
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="any answer"
                  aria-label="Text the answer includes (empty: any answer)"
                />
              </>
            )}
          </div>
          <div className="showif-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={!ready} onClick={save}>
              Add condition
            </button>
          </div>
        </div>
      ) : sources.length > 0 ? (
        <button type="button" className="link-btn showif-add" onClick={() => setAdding(true)}>
          <Plus size={15} /> {rules.length ? 'Or show it if…' : 'Show only if…'}
        </button>
      ) : null}

      <ConfirmModal
        open={Boolean(removing)}
        title="Remove this condition?"
        message={
          rules.length > 1
            ? 'The other conditions still apply.'
            : `With no conditions left, this ${noun} always shows. You can undo this.`
        }
        confirmLabel="Remove"
        onConfirm={() => {
          onRemove(removing.sourceId, removing.actionId)
          setRemoving(null)
        }}
        onCancel={() => setRemoving(null)}
      />
    </div>
  )
}
