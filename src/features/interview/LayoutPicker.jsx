import { LAYOUTS } from '../../lib/screenLayouts.js'

// Screen panel → Layout: small pictures of each ready-made layout
// (lib/screenLayouts.js). Picking one asks first (InterviewEditor), then
// rearranges this screen's blocks into it.
//   current — the layout last applied to this screen, if any
//   onPick(key)
export default function LayoutPicker({ current, onPick }) {
  return (
    <div className="layout-picker" role="list">
      {Object.entries(LAYOUTS).map(([key, { label, hint }]) => (
        <button
          key={key}
          type="button"
          role="listitem"
          className={`layout-tile${current === key ? ' is-current' : ''}`}
          onClick={() => onPick(key)}
          title={hint}
          aria-label={`${label}: ${hint}`}
        >
          <span className={`layout-thumb layout-thumb-${key}`} aria-hidden="true">
            <i />
            <b />
            <em />
          </span>
          <span className="layout-name">{label}</span>
        </button>
      ))}
    </div>
  )
}
