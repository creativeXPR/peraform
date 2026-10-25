import { X } from 'lucide-react'
import {
  VALIDATION,
  VALIDATION_KINDS,
  compilePattern,
  opValueCount,
} from '../../lib/validation.js'
import Select from '../../lib/Select.jsx'

// One row of "Response validation" under a question: kind, rule, value(s)
// and an optional custom error message.
export default function ValidationEditor({ question, change, onRemove }) {
  const rule = question.validation
  const kinds = VALIDATION_KINDS[question.type]
  const set = (patch) => change('validation', (q) => ({ ...q, validation: { ...q.validation, ...patch } }))
  const values = opValueCount(rule.op)
  const numeric = rule.kind !== 'regex' && rule.kind !== 'text'
  const badPattern = rule.kind === 'regex' && rule.value && !compilePattern(rule.value)

  return (
    <div className="validation">
      <div className="validation-row">
        {kinds.length > 1 && (
          <Select
            value={rule.kind}
            aria-label="Validation type"
            onChange={(e) => {
              const kind = e.target.value
              set({ kind, op: Object.keys(VALIDATION[kind].ops)[0], value: '', value2: '' })
            }}
          >
            {kinds.map((k) => (
              <option key={k} value={k}>
                {VALIDATION[k].label}
              </option>
            ))}
          </Select>
        )}
        <Select value={rule.op} aria-label="Rule" onChange={(e) => set({ op: e.target.value })}>
          {Object.entries(VALIDATION[rule.kind].ops).map(([op, label]) => (
            <option key={op} value={op}>
              {label}
            </option>
          ))}
        </Select>
        {values >= 1 && (
          <input
            value={rule.value}
            inputMode={numeric ? 'decimal' : undefined}
            placeholder={rule.kind === 'regex' ? 'Pattern' : numeric ? 'Number' : 'Text'}
            aria-label="Value"
            onChange={(e) => set({ value: e.target.value })}
          />
        )}
        {values === 2 && (
          <>
            <span className="validation-and">and</span>
            <input
              value={rule.value2}
              inputMode="decimal"
              placeholder="Number"
              aria-label="Second value"
              onChange={(e) => set({ value2: e.target.value })}
            />
          </>
        )}
        <button
          type="button"
          className="icon-btn"
          onClick={onRemove}
          aria-label="Remove validation"
          title="Remove validation"
        >
          <X size={16} />
        </button>
      </div>
      <input
        className="validation-message"
        value={rule.message}
        placeholder="Custom error text (optional)"
        aria-label="Custom error text"
        maxLength={200}
        onChange={(e) => set({ message: e.target.value })}
      />
      {badPattern && (
        <p className="validation-warning">
          This pattern isn’t valid, so it won’t be checked.
        </p>
      )}
    </div>
  )
}
