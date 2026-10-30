import { useId } from 'react'

const RAYS = Array.from({ length: 7 }, (_, i) => {
  const a = Math.PI + (i + 1) * (Math.PI / 8)
  const len = i % 2 ? 22 : 31
  return [64 + Math.cos(a) * 12, 74 + Math.sin(a) * 12, 64 + Math.cos(a) * (12 + len), 74 + Math.sin(a) * (12 + len)]
})

// A 4-point sparkle with curved sides, like the Quality Tools mark.
function sparkle(cx, cy, r, k = 0.13) {
  const q = r * k
  return `M${cx} ${cy - r}Q${cx + q} ${cy - q} ${cx + r} ${cy}Q${cx + q} ${cy + q} ${cx} ${cy + r}Q${cx - q} ${cy + q} ${cx - r} ${cy}Q${cx - q} ${cy - q} ${cx} ${cy - r}Z`
}

// Dawn's mark: the Sunburst glowing inside a semi-clear ice orb (owner's
// choice, mockups/dawn-ice-logo.html). Its core breathes, a glint crosses
// the glass, and while Dawn works the rays light in turn (ai.css, .dawn-orb).
export default function DawnOrb({ size = 30, className = '' }) {
  const id = useId().replace(/:/g, '')
  const u = (name) => `url(#${id}-${name})`
  return (
    <svg className={`dawn-orb ${className}`} width={size} height={size} viewBox="0 0 128 128" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-glass`} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#cfefff" stopOpacity=".04" />
          <stop offset=".55" stopColor="#8fdcff" stopOpacity=".1" />
          <stop offset=".78" stopColor="#5f86ff" stopOpacity=".28" />
          <stop offset=".92" stopColor="#9b78ff" stopOpacity=".5" />
          <stop offset="1" stopColor="#ff8fcf" stopOpacity=".7" />
        </radialGradient>
        <radialGradient id={`${id}-core`} cx=".5" cy=".62" r=".5">
          <stop offset="0" stopColor="#fff1c2" />
          <stop offset=".28" stopColor="#ffa47a" stopOpacity=".9" />
          <stop offset=".55" stopColor="#ff6fa0" stopOpacity=".7" />
          <stop offset=".8" stopColor="#9d7bf5" stopOpacity=".45" />
          <stop offset="1" stopColor="#9d7bf5" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-ray`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c9ccff" />
          <stop offset=".5" stopColor="#ffb3c6" />
          <stop offset="1" stopColor="#ffe39a" />
        </linearGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e9fdff" stopOpacity=".95" />
          <stop offset=".3" stopColor="#6fe3ff" stopOpacity=".8" />
          <stop offset=".55" stopColor="#8b7bff" stopOpacity=".55" />
          <stop offset=".8" stopColor="#ff86c8" stopOpacity=".75" />
          <stop offset="1" stopColor="#fff" stopOpacity=".6" />
        </linearGradient>
        <linearGradient id={`${id}-glint`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${id}-soft`}>
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <clipPath id={`${id}-clip`}>
          <circle cx="64" cy="64" r="58" />
        </clipPath>
      </defs>
      <g clipPath={u('clip')}>
        <circle cx="64" cy="64" r="58" fill={u('glass')} />
        <ellipse className="dawn-orb-core" cx="64" cy="70" rx="46" ry="40" fill={u('core')} />
        <g filter={u('glow')}>
          <g stroke={u('ray')} strokeWidth="5.4" strokeLinecap="round">
            {RAYS.map(([x1, y1, x2, y2], i) => (
              <line key={i} className="dawn-orb-ray" style={{ '--i': i }} x1={x1} y1={y1} x2={x2} y2={y2} />
            ))}
          </g>
          <path d={sparkle(64, 72, 8)} fill="#fff4cf" />
        </g>
        <rect x="30" y="78" width="68" height="3.4" rx="1.7" fill="#fff" opacity=".85" />
        <path d="M8 34 Q 40 6 82 10" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" opacity=".55" filter={u('soft')} />
        <rect className="dawn-orb-glint" x="-10" y="-20" width="34" height="170" fill={u('glint')} transform="rotate(18 64 64)" />
      </g>
      <circle cx="64" cy="64" r="57" fill="none" stroke={u('rim')} strokeWidth="2.6" />
      <circle cx="64" cy="64" r="47" fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth="1.4" />
    </svg>
  )
}
