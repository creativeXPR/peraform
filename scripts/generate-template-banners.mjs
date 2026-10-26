import fs from 'node:fs'
import path from 'node:path'

const outDir = path.resolve('public/templates')
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}

const templates = [
  {
    name: 'contact.svg',
    bg: ['#312e81', '#4f46e5', '#818cf8'],
    shapes: `
      <circle cx="200" cy="200" r="180" fill="white" opacity="0.08"/>
      <circle cx="1400" cy="150" r="220" fill="white" opacity="0.06"/>
      <path d="M -100 400 Q 400 100 900 350 T 1700 200 L 1700 500 L -100 500 Z" fill="white" opacity="0.07"/>
      <path d="M 100 0 Q 600 300 1200 100 T 1700 300" stroke="white" stroke-width="2" fill="none" opacity="0.2"/>
      <circle cx="450" cy="210" r="12" fill="#818cf8" opacity="0.6"/>
      <circle cx="950" cy="280" r="8" fill="#c7d2fe" opacity="0.5"/>
      <line x1="450" y1="210" x2="950" y2="280" stroke="white" stroke-width="1.5" stroke-dasharray="6,6" opacity="0.3"/>
    `,
  },
  {
    name: 'find-time.svg',
    bg: ['#1e3a8a', '#2563eb', '#60a5fa'],
    shapes: `
      <rect x="150" y="80" width="240" height="240" rx="24" fill="white" opacity="0.08"/>
      <circle cx="270" cy="200" r="80" stroke="white" stroke-width="3" fill="none" opacity="0.25"/>
      <polyline points="270,150 270,200 310,200" stroke="white" stroke-width="4" stroke-linecap="round" fill="none" opacity="0.4"/>
      <path d="M 600 400 C 800 150 1100 380 1650 120" stroke="white" stroke-width="3" fill="none" opacity="0.18"/>
      <circle cx="1350" cy="220" r="160" fill="white" opacity="0.05"/>
      <rect x="1100" y="100" width="120" height="120" rx="16" fill="white" opacity="0.07"/>
    `,
  },
  {
    name: 'rsvp.svg',
    bg: ['#78350f', '#b45309', '#fbbf24'],
    shapes: `
      <path d="M 0 350 Q 400 180 800 320 T 1600 180 L 1600 400 L 0 400 Z" fill="white" opacity="0.09"/>
      <circle cx="300" cy="120" r="40" fill="#fef3c7" opacity="0.2"/>
      <circle cx="850" cy="100" r="24" fill="#fde68a" opacity="0.25"/>
      <circle cx="1300" cy="140" r="50" fill="#fef3c7" opacity="0.15"/>
      <polygon points="500,80 515,115 550,115 522,135 532,170 500,150 468,170 478,135 450,115 485,115" fill="white" opacity="0.25"/>
      <polygon points="1150,160 1160,185 1185,185 1165,200 1172,225 1150,210 1128,225 1135,200 1115,185 1140,185" fill="white" opacity="0.2"/>
    `,
  },
  {
    name: 'party-invite.svg',
    bg: ['#831843', '#db2777', '#f472b6'],
    shapes: `
      <ellipse cx="250" cy="160" rx="70" ry="90" fill="white" opacity="0.15"/>
      <path d="M 250 250 Q 240 320 260 380" stroke="white" stroke-width="2" fill="none" opacity="0.2"/>
      <ellipse cx="380" cy="140" rx="60" ry="80" fill="white" opacity="0.12"/>
      <path d="M 380 220 Q 400 290 370 370" stroke="white" stroke-width="2" fill="none" opacity="0.18"/>
      <circle cx="1200" cy="120" r="16" fill="#fbcfe8" opacity="0.4"/>
      <circle cx="1350" cy="180" r="28" fill="#f472b6" opacity="0.3"/>
      <circle cx="1450" cy="100" r="12" fill="#fff" opacity="0.3"/>
      <path d="M 700 50 Q 850 350 1100 120 T 1500 280" stroke="white" stroke-width="3" stroke-dasharray="8,8" fill="none" opacity="0.25"/>
    `,
  },
  {
    name: 'tshirt.svg',
    bg: ['#134e4a', '#0f766e', '#2dd4bf'],
    shapes: `
      <path d="M 0 0 L 1600 400 L 1600 0 Z" fill="white" opacity="0.05"/>
      <path d="M 0 400 L 1600 100 L 0 100 Z" fill="white" opacity="0.04"/>
      <circle cx="800" cy="200" r="260" stroke="white" stroke-width="2" fill="none" opacity="0.15"/>
      <circle cx="800" cy="200" r="180" stroke="white" stroke-width="2" fill="none" opacity="0.12"/>
      <circle cx="800" cy="200" r="100" stroke="white" stroke-width="2" stroke-dasharray="6,6" fill="none" opacity="0.2"/>
      <rect x="200" y="120" width="160" height="160" rx="20" transform="rotate(45 280 200)" fill="white" opacity="0.06"/>
      <rect x="1320" y="120" width="160" height="160" rx="20" transform="rotate(45 1400 200)" fill="white" opacity="0.06"/>
    `,
  },
  {
    name: 'event-registration.svg',
    bg: ['#1e1b4b', '#4338ca', '#6366f1'],
    shapes: `
      <path d="M 0 300 C 300 100 600 450 1000 200 C 1300 50 1500 320 1700 180 L 1700 500 L 0 500 Z" fill="white" opacity="0.08"/>
      <circle cx="350" cy="180" r="130" stroke="white" stroke-width="2" fill="none" opacity="0.18"/>
      <circle cx="1250" cy="160" r="110" stroke="white" stroke-width="2" fill="none" opacity="0.18"/>
      <line x1="0" y1="200" x2="1600" y2="200" stroke="white" stroke-width="1.5" stroke-dasharray="10,10" opacity="0.15"/>
    `,
  },
  {
    name: 'event-feedback.svg',
    bg: ['#172554', '#1d4ed8', '#3b82f6'],
    shapes: `
      <rect x="220" y="90" width="180" height="130" rx="18" fill="white" opacity="0.14"/>
      <polygon points="260,220 280,250 310,220" fill="white" opacity="0.14"/>
      <rect x="360" y="150" width="190" height="140" rx="18" fill="white" opacity="0.1"/>
      <polygon points="490,290 520,320 520,290" fill="white" opacity="0.1"/>
      <circle cx="1200" cy="160" r="90" fill="white" opacity="0.06"/>
      <polygon points="1200,100 1220,140 1265,140 1230,165 1242,205 1200,180 1158,205 1170,165 1135,140 1180,140" fill="white" opacity="0.3"/>
    `,
  },
  {
    name: 'order-form.svg',
    bg: ['#14532d', '#15803d', '#4ade80'],
    shapes: `
      <rect x="180" y="110" width="160" height="180" rx="16" fill="white" opacity="0.12"/>
      <line x1="210" y1="150" x2="310" y2="150" stroke="white" stroke-width="4" stroke-linecap="round" opacity="0.3"/>
      <line x1="210" y1="185" x2="280" y2="185" stroke="white" stroke-width="4" stroke-linecap="round" opacity="0.3"/>
      <line x1="210" y1="220" x2="300" y2="220" stroke="white" stroke-width="4" stroke-linecap="round" opacity="0.3"/>
      <path d="M 500 400 L 900 180 L 1300 400 Z" fill="white" opacity="0.06"/>
      <circle cx="1350" cy="160" r="100" fill="white" opacity="0.07"/>
    `,
  },
  {
    name: 'job-application.svg',
    bg: ['#1e1b4b', '#3730a3', '#6366f1'],
    shapes: `
      <rect x="120" y="70" width="220" height="260" rx="12" fill="white" opacity="0.12"/>
      <circle cx="230" cy="140" r="35" fill="white" opacity="0.25"/>
      <line x1="160" y1="210" x2="300" y2="210" stroke="white" stroke-width="4" stroke-linecap="round" opacity="0.3"/>
      <line x1="180" y1="235" x2="280" y2="235" stroke="white" stroke-width="3" stroke-linecap="round" opacity="0.25"/>
      <path d="M 600 400 Q 1100 100 1600 350 L 1600 400 Z" fill="white" opacity="0.08"/>
      <circle cx="1350" cy="180" r="140" fill="white" opacity="0.05"/>
    `,
  },
  {
    name: 'time-off.svg',
    bg: ['#042f2e', '#0d9488', '#2dd4bf'],
    shapes: `
      <circle cx="800" cy="380" r="280" fill="white" opacity="0.08"/>
      <circle cx="800" cy="380" r="200" fill="white" opacity="0.1"/>
      <circle cx="800" cy="380" r="120" fill="white" opacity="0.12"/>
      <path d="M 0 320 C 400 240 800 380 1200 280 T 1600 300 L 1600 400 L 0 400 Z" fill="white" opacity="0.15"/>
      <circle cx="250" cy="120" r="50" fill="white" opacity="0.18"/>
      <circle cx="1380" cy="100" r="40" fill="white" opacity="0.15"/>
    `,
  },
  {
    name: 'work-request.svg',
    bg: ['#0f172a', '#334155', '#64748b'],
    shapes: `
      <rect x="180" y="90" width="200" height="220" rx="14" fill="white" opacity="0.1"/>
      <circle cx="220" cy="140" r="10" stroke="white" stroke-width="2" fill="none" opacity="0.4"/>
      <line x1="250" y1="140" x2="340" y2="140" stroke="white" stroke-width="3" stroke-linecap="round" opacity="0.3"/>
      <circle cx="220" cy="185" r="10" stroke="white" stroke-width="2" fill="none" opacity="0.4"/>
      <line x1="250" y1="185" x2="330" y2="185" stroke="white" stroke-width="3" stroke-linecap="round" opacity="0.3"/>
      <circle cx="220" cy="230" r="10" stroke="white" stroke-width="2" fill="none" opacity="0.4"/>
      <line x1="250" y1="230" x2="310" y2="230" stroke="white" stroke-width="3" stroke-linecap="round" opacity="0.3"/>
      <path d="M 600 400 L 1100 150 L 1600 400 Z" fill="white" opacity="0.05"/>
    `,
  },
  {
    name: 'customer-feedback.svg',
    bg: ['#7c2d12', '#c2410c', '#fb923c'],
    shapes: `
      <circle cx="300" cy="200" r="120" fill="white" opacity="0.1"/>
      <path d="M 250 210 Q 300 260 350 210" stroke="white" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.35"/>
      <circle cx="265" cy="170" r="8" fill="white" opacity="0.4"/>
      <circle cx="335" cy="170" r="8" fill="white" opacity="0.4"/>
      <path d="M 600 350 Q 1000 150 1400 300 T 1700 200" stroke="white" stroke-width="3" fill="none" opacity="0.2"/>
      <circle cx="1300" cy="160" r="110" fill="white" opacity="0.08"/>
    `,
  },
  {
    name: 'blank-quiz.svg',
    bg: ['#31104b', '#6b21a8', '#a855f7'],
    shapes: `
      <circle cx="250" cy="180" r="90" fill="white" opacity="0.1"/>
      <text x="250" y="215" font-family="sans-serif" font-size="100" font-weight="bold" fill="white" opacity="0.35" text-anchor="middle">?</text>
      <circle cx="1350" cy="180" r="110" fill="white" opacity="0.08"/>
      <text x="1350" y="225" font-family="sans-serif" font-size="120" font-weight="bold" fill="white" opacity="0.25" text-anchor="middle">?</text>
      <path d="M 500 350 Q 800 100 1100 300" stroke="white" stroke-width="3" stroke-dasharray="10,10" fill="none" opacity="0.2"/>
    `,
  },
  {
    name: 'exit-ticket.svg',
    bg: ['#064e3b', '#047857', '#34d399'],
    shapes: `
      <circle cx="260" cy="200" r="100" fill="white" opacity="0.1"/>
      <polyline points="215,200 245,230 310,165" stroke="white" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.4"/>
      <rect x="1150" y="100" width="260" height="200" rx="16" fill="white" opacity="0.07"/>
      <line x1="1200" y1="150" x2="1360" y2="150" stroke="white" stroke-width="4" stroke-linecap="round" opacity="0.25"/>
      <line x1="1200" y1="190" x2="1320" y2="190" stroke="white" stroke-width="4" stroke-linecap="round" opacity="0.25"/>
      <line x1="1200" y1="230" x2="1340" y2="230" stroke="white" stroke-width="4" stroke-linecap="round" opacity="0.25"/>
    `,
  },
  {
    name: 'assessment.svg',
    bg: ['#1e3a8a', '#1d4ed8', '#60a5fa'],
    shapes: `
      <rect x="200" y="220" width="40" height="100" rx="6" fill="white" opacity="0.2"/>
      <rect x="260" y="170" width="40" height="150" rx="6" fill="white" opacity="0.25"/>
      <rect x="320" y="120" width="40" height="200" rx="6" fill="white" opacity="0.3"/>
      <rect x="380" y="80" width="40" height="240" rx="6" fill="white" opacity="0.35"/>
      <path d="M 180 250 L 280 180 L 340 130 L 400 90" stroke="white" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.45"/>
      <circle cx="1300" cy="180" r="140" fill="white" opacity="0.06"/>
    `,
  },
  {
    name: 'worksheet.svg',
    bg: ['#115e59', '#0d9488', '#2dd4bf'],
    shapes: `
      <rect x="160" y="80" width="240" height="240" rx="14" fill="white" opacity="0.1"/>
      <line x1="160" y1="140" x2="400" y2="140" stroke="white" stroke-width="1.5" opacity="0.2"/>
      <line x1="160" y1="200" x2="400" y2="200" stroke="white" stroke-width="1.5" opacity="0.2"/>
      <line x1="160" y1="260" x2="400" y2="260" stroke="white" stroke-width="1.5" opacity="0.2"/>
      <line x1="220" y1="80" x2="220" y2="320" stroke="white" stroke-width="1.5" opacity="0.2"/>
      <line x1="280" y1="80" x2="280" y2="320" stroke="white" stroke-width="1.5" opacity="0.2"/>
      <line x1="340" y1="80" x2="340" y2="320" stroke="white" stroke-width="1.5" opacity="0.2"/>
      <path d="M 650 350 L 1150 150 L 1550 350 Z" fill="white" opacity="0.06"/>
    `,
  },
  {
    name: 'course-eval.svg',
    bg: ['#831843', '#be185d', '#f472b6'],
    shapes: `
      <polygon points="300,120 420,160 300,200 180,160" fill="white" opacity="0.25"/>
      <polygon points="180,160 300,200 300,240 180,200" fill="white" opacity="0.2"/>
      <line x1="300" y1="200" x2="300" y2="260" stroke="white" stroke-width="3" opacity="0.3"/>
      <circle cx="1200" cy="180" r="100" fill="white" opacity="0.07"/>
      <path d="M 600 380 Q 950 150 1450 320" stroke="white" stroke-width="3" stroke-dasharray="8,8" fill="none" opacity="0.2"/>
    `,
  },
]

for (const t of templates) {
  const [c1, c2, c3] = t.bg
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 400" width="1600" height="400">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}" />
      <stop offset="50%" stop-color="${c2}" />
      <stop offset="100%" stop-color="${c3}" />
    </linearGradient>
  </defs>
  <rect width="1600" height="400" fill="url(#g)" />
  ${t.shapes}
</svg>`
  fs.writeFileSync(path.join(outDir, t.name), svg.trim(), 'utf8')
}

console.log(`Generated ${templates.length} template banners in ${outDir}`)
