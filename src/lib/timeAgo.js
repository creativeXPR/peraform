const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

const STEPS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

// "5 minutes ago", "yesterday", "just now".
export function timeAgo(date) {
  if (!date) return 'just now'
  const seconds = (date.getTime() - Date.now()) / 1000
  for (const [unit, size] of STEPS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}
