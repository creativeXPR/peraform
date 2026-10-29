import './Spinner.css'

// The one loading indicator across Quality Tools: a soft grey ring whose
// arc grows, shrinks and turns (like Google's). Same look in every app.
//   fill: 'page'   centred in the whole window (app start, route loads)
//         'area'   centred in the space a section will take
//         'inline' just the ring, e.g. inside a list
//   size: ring size in px; label: read out by screen readers
export default function Spinner({ fill = 'area', size, label = 'Loading', className = '' }) {
  const px = size ?? (fill === 'inline' ? 24 : 40)
  return (
    <div className={`qt-spinner is-${fill} ${className}`} role="status" aria-live="polite">
      <svg width={px} height={px} viewBox="0 0 50 50" aria-hidden="true">
        <circle cx="25" cy="25" r="20" fill="none" strokeWidth="4.5" strokeLinecap="round" />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  )
}
