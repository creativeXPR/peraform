import { useMemo, useState } from 'react'
import { shuffled } from '../../lib/shuffle.js'
import Select from '../../lib/Select.jsx'

// Multiple choice, checkboxes and dropdown on the public form, with the
// question's shuffleOptions and "Other" (typed answer) settings.
export default function ChoiceField({ q, name, labelId, value, onChange }) {
  const options = useMemo(
    () => (q.shuffleOptions ? shuffled(q.options, q.id) : q.options),
    [q.options, q.shuffleOptions, q.id],
  )
  const multi = q.type === 'checkboxes'
  const selected = multi ? (value ?? []) : value
  // The typed "Other" answer is whatever isn't one of the listed options.
  const typed = multi
    ? (selected.find((v) => !q.options.includes(v)) ?? '')
    : selected && !q.options.includes(selected)
      ? selected
      : ''
  const [otherOn, setOtherOn] = useState(Boolean(typed))
  const [otherText, setOtherText] = useState(typed)

  if (q.type === 'dropdown') {
    return (
      <Select
        className="respond-input respond-select"
        aria-labelledby={labelId}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Choose</option>
        {options.map((o, i) => (
          <option key={i} value={o}>
            {o}
          </option>
        ))}
      </Select>
    )
  }

  const listed = multi ? selected.filter((v) => q.options.includes(v)) : selected

  function setOther(on, text = otherText) {
    setOtherOn(on)
    setOtherText(text)
    if (multi) onChange(on && text.trim() ? [...listed, text] : listed)
    else onChange(on ? text : '')
  }

  function pick(option, checked) {
    if (multi) {
      const next = checked ? [...listed, option] : listed.filter((s) => s !== option)
      onChange(otherOn && otherText.trim() ? [...next, otherText] : next)
    } else {
      setOtherOn(false)
      onChange(option)
    }
  }

  return (
    <div
      role={multi ? 'group' : 'radiogroup'}
      aria-labelledby={labelId}
      className="respond-choices"
    >
      {options.map((o, i) => (
        <label key={i} className="respond-choice">
          <input
            type={multi ? 'checkbox' : 'radio'}
            name={name}
            checked={multi ? selected.includes(o) : !otherOn && selected === o}
            onChange={(e) => pick(o, e.target.checked)}
          />
          <span>{o}</span>
        </label>
      ))}
      {q.allowOther && (
        <label className="respond-choice respond-other">
          <input
            type={multi ? 'checkbox' : 'radio'}
            name={name}
            checked={otherOn}
            onChange={(e) => setOther(multi ? e.target.checked : true)}
          />
          <span>Other:</span>
          <input
            className="respond-input respond-other-input"
            value={otherText}
            aria-label="Other answer"
            maxLength={500}
            onFocus={() => !otherOn && setOther(true)}
            onChange={(e) => setOther(true, e.target.value)}
          />
        </label>
      )}
      {!multi && value && !q.required && (
        <button
          type="button"
          className="link-btn respond-clear"
          onClick={() => {
            setOtherOn(false)
            onChange('')
          }}
        >
          Clear selection
        </button>
      )}
    </div>
  )
}
