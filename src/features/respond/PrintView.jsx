import { useEffect } from 'react'
import { Printer } from 'lucide-react'
import { CONTENT_TYPES, GRID_TYPES, isQuestion, isSection } from '../../lib/formLogic.js'

// /f/:id?print=1 — the whole form on one page, blank, for paper. The print
// dialog opens by itself once fonts are ready.
function Answer({ q }) {
  const options = q.options ?? []
  switch (q.type) {
    case 'multipleChoice':
    case 'checkboxes':
    case 'dropdown': {
      const box = q.type === 'checkboxes' ? 'print-box' : 'print-circle'
      return (
        <ul className="print-options">
          {options.map((o) => (
            <li key={o}>
              <span className={box} />
              {o}
            </li>
          ))}
          {q.allowOther && (
            <li>
              <span className={box} />
              Other: <span className="print-line print-line-inline" />
            </li>
          )}
        </ul>
      )
    }
    case 'linearScale': {
      const min = q.min ?? 1
      const nums = Array.from({ length: (q.max ?? 5) - min + 1 }, (_, i) => min + i)
      return (
        <div className="print-scale">
          {q.minLabel && <span>{q.minLabel}</span>}
          {nums.map((n) => (
            <span key={n} className="print-scale-item">
              {n}
              <span className="print-circle" />
            </span>
          ))}
          {q.maxLabel && <span>{q.maxLabel}</span>}
        </div>
      )
    }
    case 'rating':
      return <div className="print-rating">{'☆ '.repeat(q.max ?? 5)}</div>
    case 'mcGrid':
    case 'checkboxGrid':
      return (
        <table className="print-grid">
          <thead>
            <tr>
              <th />
              {(q.columns ?? []).map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(q.rows ?? []).map((r) => (
              <tr key={r}>
                <th>{r}</th>
                {(q.columns ?? []).map((c) => (
                  <td key={c}>
                    <span className={q.type === 'checkboxGrid' ? 'print-box' : 'print-circle'} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )
    case 'date':
      return <div className="print-fixed">Date: ____ / ____ / ________</div>
    case 'time':
      return <div className="print-fixed">Time: ____ : ____</div>
    case 'fileUpload':
      return <div className="print-fixed">File upload: answer this one online.</div>
    case 'longText':
      return (
        <>
          <span className="print-line" />
          <span className="print-line" />
          <span className="print-line" />
        </>
      )
    default:
      return <span className="print-line" />
  }
}

export default function PrintView({ form }) {
  useEffect(() => {
    let cancelled = false
    // Wait for the fonts, but never more than 1.5 s (fonts.ready can stall).
    const fonts = document.fonts?.ready ?? Promise.resolve()
    Promise.race([fonts, new Promise((r) => setTimeout(r, 1500))]).then(
      () => !cancelled && window.print(),
    )
    return () => {
      cancelled = true
    }
  }, [])

  // Questions are numbered 1, 2, 3… (sections and blocks aren't).
  const numbers = new Map(
    (form.questions ?? []).filter(isQuestion).map((q, i) => [q.id, i + 1]),
  )
  return (
    <main className="print-sheet">
      <button type="button" className="btn btn-primary print-again" onClick={() => window.print()}>
        <Printer size={16} />
        Print
      </button>
      <header className="print-head">
        <h1>{form.title || 'Untitled form'}</h1>
        {form.description && <p>{form.description}</p>}
        <p className="print-meta">
          Name: <span className="print-line print-line-inline" />
        </p>
      </header>
      {(form.questions ?? []).map((item) => {
        if (isSection(item)) {
          return (
            <section key={item.id} className="print-section">
              <h2>{item.title || 'Untitled section'}</h2>
              {item.description && <p>{item.description}</p>}
            </section>
          )
        }
        if (CONTENT_TYPES.includes(item.type)) {
          return (
            <div key={item.id} className="print-content">
              {item.title && <h3>{item.title}</h3>}
              {item.type === 'text' && item.description && <p>{item.description}</p>}
              {item.type === 'image' && item.image && <img src={item.image.url} alt={item.title || ''} />}
            </div>
          )
        }
        if (!isQuestion(item)) return null
        return (
          <div key={item.id} className={`print-q${GRID_TYPES.includes(item.type) ? ' print-q-wide' : ''}`}>
            <p className="print-q-title">
              {numbers.get(item.id)}. {item.title || 'Untitled question'}
              {item.required && <span className="print-required"> *</span>}
            </p>
            {item.description && <p className="print-q-desc">{item.description}</p>}
            {item.image && <img className="print-q-image" src={item.image.url} alt="" />}
            <Answer q={item} />
          </div>
        )
      })}
    </main>
  )
}
