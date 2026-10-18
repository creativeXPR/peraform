import { Star } from 'lucide-react'
import AutoTextarea from '../../lib/AutoTextarea.jsx'
import ChoiceField from './ChoiceField.jsx'
import FileUploadField from './FileUploadField.jsx'

// One question as respondents see it. `value` shapes per type are listed in
// lib/formModel.js (answers).
export default function QuestionField({ question: q, formId, value, onChange, error, points }) {
  const name = `q-${q.id}`
  const labelId = `${name}-label`

  return (
    <section id={name} className={`respond-card respond-q${error ? ' respond-q-missing' : ''}`}>
      <p id={labelId} className="respond-q-title">
        {q.title || 'Untitled question'}
        {q.required && <span className="q-required"> *</span>}
        {points !== null && points !== undefined && (
          <span className="respond-points">
            {points} {points === 1 ? 'point' : 'points'}
          </span>
        )}
      </p>
      {q.description && <p className="respond-q-desc">{q.description}</p>}
      {q.image && <img className="respond-image" src={q.image.url} alt="" loading="lazy" />}
      {q.type === 'fileUpload' ? (
        <FileUploadField
          question={q}
          formId={formId}
          value={value}
          onChange={onChange}
          labelId={labelId}
        />
      ) : (
        <Control q={q} name={name} labelId={labelId} value={value} onChange={onChange} />
      )}
      {error && (
        <p className="respond-q-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

function Control({ q, name, labelId, value, onChange }) {
  switch (q.type) {
    case 'shortText':
      return (
        <input
          className="respond-input"
          aria-labelledby={labelId}
          value={value ?? ''}
          maxLength={500}
          placeholder="Your answer"
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'longText':
      return (
        <AutoTextarea
          className="respond-input"
          aria-labelledby={labelId}
          value={value ?? ''}
          maxLength={5000}
          placeholder="Your answer"
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'date':
    case 'time':
      return (
        <input
          type={q.type}
          className="respond-input respond-date"
          aria-labelledby={labelId}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'dropdown':
    case 'multipleChoice':
    case 'checkboxes':
      return <ChoiceField q={q} name={name} labelId={labelId} value={value} onChange={onChange} />
    case 'linearScale': {
      const steps = Array.from({ length: q.max - q.min + 1 }, (_, i) => q.min + i)
      return (
        <div className="scale" role="radiogroup" aria-labelledby={labelId}>
          {q.minLabel && <span className="scale-label">{q.minLabel}</span>}
          <div className="scale-steps">
            {steps.map((n) => (
              <label key={n} className="scale-step">
                <span>{n}</span>
                <input
                  type="radio"
                  name={name}
                  checked={value === n}
                  onChange={() => onChange(n)}
                />
              </label>
            ))}
          </div>
          {q.maxLabel && <span className="scale-label">{q.maxLabel}</span>}
        </div>
      )
    }
    case 'rating':
      return (
        <div className="rating" role="radiogroup" aria-labelledby={labelId}>
          {Array.from({ length: q.max }, (_, i) => i + 1).map((n) => (
            <label
              key={n}
              className={`rating-star${value >= n ? ' on' : ''}`}
              title={`${n} of ${q.max}`}
            >
              <input
                type="radio"
                name={name}
                checked={value === n}
                onChange={() => onChange(n)}
                aria-label={`${n} of ${q.max}`}
              />
              <Star size={30} />
            </label>
          ))}
        </div>
      )
    case 'mcGrid':
    case 'checkboxGrid': {
      const multi = q.type === 'checkboxGrid'
      const grid = value ?? {}
      const setRow = (row, rowValue) => onChange({ ...grid, [row]: rowValue })
      return (
        <div className="grid-wrap">
          <table className="grid" aria-labelledby={labelId}>
            <thead>
              <tr>
                <td />
                {q.columns.map((c, j) => (
                  <th key={j} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.rows.map((r, i) => {
                const rowValue = grid[i]
                return (
                  <tr key={i}>
                    <th scope="row">{r}</th>
                    {q.columns.map((c, j) => (
                      <td key={j}>
                        <input
                          type={multi ? 'checkbox' : 'radio'}
                          name={`${name}-${i}`}
                          aria-label={`${r}: ${c}`}
                          checked={multi ? (rowValue ?? []).includes(c) : rowValue === c}
                          onChange={(e) =>
                            setRow(
                              i,
                              multi
                                ? e.target.checked
                                  ? [...(rowValue ?? []), c]
                                  : (rowValue ?? []).filter((x) => x !== c)
                                : c,
                            )
                          }
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )
    }
    default:
      return null
  }
}
