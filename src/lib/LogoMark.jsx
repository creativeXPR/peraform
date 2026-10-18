import { useId } from 'react'

// PeraForm mark: Google-Forms-style rows leaning forward with speed lines.
export default function LogoMark({ size = 20 }) {
  const id = useId()
  const fill = `${id}-fill`
  const streak = `${id}-streak`
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="logo-mark">
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
        <linearGradient id={streak} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#818cf8" stopOpacity="0" />
          <stop offset="1" stopColor="#818cf8" />
        </linearGradient>
      </defs>
      <g transform="skewX(-12) translate(6 0)">
        <rect x="10" y="7" width="30" height="9" rx="4.5" fill={`url(#${fill})`} />
        <rect x="10" y="19.5" width="30" height="9" rx="4.5" fill="#6366f1" />
        <rect x="10" y="32" width="30" height="9" rx="4.5" fill="#a5b4fc" />
        <circle cx="15" cy="11.5" r="2.2" fill="#fff" />
        <circle cx="15" cy="24" r="2.2" fill="#fff" />
        <circle cx="15" cy="36.5" r="2.2" fill="#fff" />
      </g>
      <rect x="1" y="10.5" width="9" height="2" rx="1" fill={`url(#${streak})`} />
      <rect x="3" y="23" width="7" height="2" rx="1" fill={`url(#${streak})`} />
    </svg>
  )
}
