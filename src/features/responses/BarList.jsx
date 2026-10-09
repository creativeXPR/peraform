// Horizontal bar chart for one choice question: label | bar | value.
// Single series, so no legend — the card title names it. Bars are ≤20px
// thick with a 4px rounded data end and a square baseline; the value sits
// at the tip in text ink, and hovering a row shows the exact share.
export default function BarList({ rows, total, unit = 'response' }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <ul className="bars">
      {rows.map(({ label, count }) => {
        const pct = total ? Math.round((count / total) * 100) : 0
        const tip = `${label}: ${count} ${count === 1 ? unit : `${unit}s`} (${pct}%)`
        return (
          <li key={label} className="bar-row" tabIndex={0} aria-label={tip}>
            <span className="bar-label">{label}</span>
            <span className="bar-track">
              {count > 0 && <span className="bar" style={{ width: `${(count / max) * 100}%` }} />}
              <span className="bar-value">
                {count} <span className="bar-pct">({pct}%)</span>
              </span>
            </span>
            <span className="bar-tip" role="tooltip">
              {tip}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
