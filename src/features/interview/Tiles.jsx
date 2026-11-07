// Small choice pieces for the Design screens panels (inspector.css):
// soft colour tiles (one choice of a few) and easing curves.

// options: [{ value, label, icon: Component, color }]
export function SoftTiles({ options, value, onChange, columns = 3, label }) {
  return (
    <div className="soft-tiles" style={{ '--cols': columns }} role="radiogroup" aria-label={label}>
      {options.map(({ value: v, label: l, icon: Icon, color, title }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          className={`soft-tile${value === v ? ' is-on' : ''}`}
          style={{ '--c': color }}
          onClick={() => onChange(v)}
          title={title}
        >
          <span className="soft-tile-icon" aria-hidden="true">
            <Icon size={15} />
          </span>
          {l}
        </button>
      ))}
    </div>
  )
}

// Each easing as a little curve (time across, progress up).
const CURVES = {
  ease: ['Smooth', 'M2 16 C 10 16, 16 2, 24 2'],
  linear: ['Linear', 'M2 16 L 24 2'],
  'ease-in': ['Speed up', 'M2 16 C 14 16, 20 10, 24 2'],
  'ease-out': ['Slow down', 'M2 16 C 6 4, 14 2, 24 2'],
  'ease-in-out': ['Both ways', 'M2 16 C 12 16, 14 2, 24 2'],
  'cubic-bezier(0.34, 1.56, 0.64, 1)': ['Bounce', 'M2 16 C 8 -4, 16 4, 24 2'],
}

// values: the easings offered (keys of CURVES), in order.
export function CurvePicker({ value, onChange, values }) {
  return (
    <div className="curves" style={{ '--cols': values.length }} role="radiogroup" aria-label="Easing">
      {values.map((v) => {
        const [name, d] = CURVES[v]
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            className={`curve${value === v ? ' is-on' : ''}`}
            onClick={() => onChange(v)}
            title={name}
          >
            <svg viewBox="0 0 26 18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d={d} />
            </svg>
            {name}
          </button>
        )
      })}
    </div>
  )
}
