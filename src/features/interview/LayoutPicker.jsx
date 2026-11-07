import { LAYOUTS, SAMPLE_PHOTOS } from '../../lib/screenLayouts.js'

// Screen panel → Layout: each ready-made layout (lib/screenLayouts.js) as a
// tiny phone with its pieces in place (heading, answer boxes, the button,
// the sample photos), and a two-word feel. Hover: the pieces drop in.
// Picking one asks first (InterviewEditor), then rearranges the screen.
//   current — the layout last applied to this screen, if any
//   onPick(key)
const FEEL = {
  card: ['Card', 'all in one'],
  focus: ['Big question', 'one at a time'],
  side: ['Picture', 'photo on top'],
  photo: ['Photo', 'glass on a photo'],
  cover: ['Cover', 'big hello'],
}

// Each piece: [class, style]. Positions in the 38 × 70 screen.
const PIECES = {
  card: [
    ['lp-card', { top: 10, bottom: 10 }],
    ['lp-h', { top: 15, width: 20 }],
    ['lp-q', { top: 22 }],
    ['lp-q', { top: 31 }],
    ['lp-q', { top: 40 }],
    ['lp-btn', { top: 52 }],
  ],
  focus: [
    ['lp-h', { top: 16, width: 26, height: 5 }],
    ['lp-h', { top: 24, width: 18, height: 5 }],
    ['lp-q', { top: 36, height: 8 }],
    ['lp-btn', { top: 52, right: 12, width: 20 }],
  ],
  side: [
    ['lp-img', { top: 0, height: 30 }, SAMPLE_PHOTOS[0].url],
    ['lp-h', { top: 35, width: 20 }],
    ['lp-q', { top: 42 }],
    ['lp-q', { top: 50 }],
    ['lp-btn', { top: 60 }],
  ],
  photo: [
    ['lp-img', { top: 0, height: '100%' }, SAMPLE_PHOTOS[1].url],
    ['lp-glass', { top: 18, bottom: 16 }],
    ['lp-h', { top: 23, width: 18 }],
    ['lp-q', { top: 30, left: 8, right: 8 }],
    ['lp-btn', { top: 44, right: 9 }],
  ],
  cover: [
    ['lp-h', { top: 22, left: 9, width: 22, height: 5 }],
    ['lp-l', { top: 31, left: 12, width: 16 }],
    ['lp-btn', { top: 44, left: 11, right: 'auto', width: 18, height: 6 }],
  ],
}

export default function LayoutPicker({ current, onPick }) {
  return (
    <div className="lp-grid">
      {Object.entries(LAYOUTS).map(([key, { hint }]) => {
        const [name, feel] = FEEL[key]
        return (
          <button
            key={key}
            type="button"
            className={`lp-tile${current === key ? ' is-on' : ''}`}
            onClick={() => onPick(key)}
            title={hint}
            aria-label={`${name}: ${hint}`}
            aria-pressed={current === key}
          >
            <span className="lp-phone" aria-hidden="true">
              <span className="lp-screen">
                {PIECES[key].map(([cls, style, src], i) =>
                  src ? <img key={i} className={cls} style={style} src={src} alt="" /> : <span key={i} className={cls} style={style} />,
                )}
              </span>
            </span>
            <span className="lp-name">{name}</span>
            <span className="lp-feel">{feel}</span>
          </button>
        )
      })}
    </div>
  )
}
