import { useId } from 'react'

// Marks of the other Quality Tools apps, for the app switcher (AppSwitcher.jsx).
// PeraForm uses its own LogoMark.

// The suite mark: two sparkles in the Quality Tools spectrum.
export function QtMark({ size = 20 }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="12" y1="12" x2="38" y2="38">
          <stop offset="0" stopColor="#ff6b8b" />
          <stop offset="0.3" stopColor="#ffb347" />
          <stop offset="0.55" stopColor="#3ddc97" />
          <stop offset="0.78" stopColor="#3fa9ff" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M21 9c1.2 7.6 4.4 10.8 12 12-7.6 1.2-10.8 4.4-12 12-1.2-7.6-4.4-10.8-12-12 7.6-1.2 10.8-4.4 12-12z"
      />
      <path fill={`url(#${id})`} d="M34 27c.6 3.7 2.3 5.4 6 6-3.7.6-5.4 2.3-6 6-.6-3.7-2.3-5.4-6-6 3.7-.6 5.4-2.3 6-6z" />
    </svg>
  )
}

// HyperCBT mark: three answer rows leaning forward (hyper), the bottom one
// chosen - a filled bubble with a tick (CBT). Colours from the Quality Tools
// spectrum, with HyperCBT's orange-amber on the chosen answer. Same art as
// ex-cbt/src/lib/LogoMark.jsx.
export function HyperCbtMark({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="logo-mark">
      <g transform="skewX(-10) translate(5 0)">
        <circle cx="12" cy="10.5" r="4.5" fill="#3fa9ff" />
        <rect x="7.5" y="18.5" width="22" height="9" rx="4.5" fill="#3ddc97" />
        <rect x="12" y="31.5" width="31" height="10" rx="5" fill="#ffb347" />
        <circle cx="13" cy="36.5" r="7.5" fill="#ea7a10" />
        <path
          d="M9.6 36.6l2.4 2.4 4.6-4.8"
          fill="none"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}
