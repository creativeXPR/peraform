import { useId } from 'react'
import {
  BookOpen,
  Briefcase,
  Cake,
  CalendarCheck,
  ClipboardList,
  GraduationCap,
  HandHeart,
  HeartPulse,
  PartyPopper,
  PawPrint,
  Plane,
  Shirt,
} from 'lucide-react'

const ICONS = { BookOpen, Briefcase, Cake, CalendarCheck, ClipboardList, GraduationCap, HandHeart, HeartPulse, PartyPopper, PawPrint, Plane, Shirt }

// A Create-with-AI idea's picture: a soft flat scene in the idea's colours
// (sky, sun, rolling hills, a few sparkles), a little form floating in it,
// and the idea's icon in a badge. Drawn here, so it's PeraForm's own art.
//   art: { sky, sky2, ground, accent }; flip: mirror the layout
export default function IdeaArt({ art, icon, flip = false }) {
  const id = useId()
  const Icon = ICONS[icon] ?? ClipboardList
  return (
    <span className={`idea-art${flip ? ' is-flipped' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 300 150" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={art.sky} />
            <stop offset="1" stopColor={art.sky2} />
          </linearGradient>
        </defs>
        <rect width="300" height="150" fill={`url(#${id}-sky)`} />
        <circle cx="248" cy="34" r="20" fill={art.accent} opacity="0.22" />
        <circle cx="248" cy="34" r="11" fill="#fff" opacity="0.7" />
        {/* Clouds */}
        <g fill="#fff" opacity="0.85">
          <ellipse cx="62" cy="30" rx="22" ry="7" />
          <ellipse cx="76" cy="25" rx="13" ry="8" />
          <ellipse cx="186" cy="20" rx="16" ry="5" />
        </g>
        {/* Hills */}
        <path d="M0 116 C 60 92, 120 104, 170 112 S 260 98, 300 108 V150 H0Z" fill={art.ground} opacity="0.55" />
        <path d="M0 132 C 70 112, 150 126, 210 128 S 280 118, 300 124 V150 H0Z" fill={art.ground} />
        {/* Sparkles */}
        <g fill={art.accent} opacity="0.55">
          <path d="M150 34l2.2 5.8 5.8 2.2-5.8 2.2-2.2 5.8-2.2-5.8-5.8-2.2 5.8-2.2z" />
          <path d="M276 84l1.4 3.6 3.6 1.4-3.6 1.4-1.4 3.6-1.4-3.6-3.6-1.4 3.6-1.4z" />
        </g>
        {/* The little form */}
        <g className="idea-form">
          <rect x="34" y="40" width="118" height="92" rx="10" fill="#fff" />
          <rect x="34" y="40" width="118" height="9" rx="4" fill={art.accent} />
          <rect x="46" y="58" width="70" height="6" rx="3" fill={art.accent} opacity="0.35" />
          {[74, 90, 106].map((y, i) => (
            <g key={y}>
              <circle cx="51" cy={y + 3} r="4.5" fill="none" stroke={art.accent} strokeWidth="1.6" opacity="0.7" />
              {i === 1 && <circle cx="51" cy={y + 3} r="2.3" fill={art.accent} />}
              <rect x="61" y={y} width={i === 1 ? 64 : 52} height="6" rx="3" fill="#d9dbe3" />
            </g>
          ))}
        </g>
      </svg>
      <span className="idea-badge" style={{ color: art.accent }}>
        <Icon size={30} strokeWidth={1.75} />
      </span>
    </span>
  )
}
