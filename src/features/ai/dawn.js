// Dawn's greeting follows the time of day (owner's choice):
// "Good morning, Ada", or "Still up, Ada?" late at night.
export function dawnGreeting(name, hour = new Date().getHours()) {
  const who = name ? `, ${name}` : ''
  if (hour >= 5 && hour < 12) return `Good morning${who}`
  if (hour >= 12 && hour < 17) return `Good afternoon${who}`
  if (hour >= 17 && hour < 22) return `Good evening${who}`
  return name ? `Still up, ${name}?` : 'Still up?'
}
