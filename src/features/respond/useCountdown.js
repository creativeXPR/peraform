import { useEffect, useRef, useState } from 'react'

// Seconds left until `deadline` (ms timestamp), ticking every second.
// Calls onExpire once when it reaches zero. null while there's no deadline.
export function useCountdown(deadline, onExpire) {
  const [now, setNow] = useState(() => Date.now())
  const expireRef = useRef(onExpire)
  const fired = useRef(false)

  useEffect(() => {
    expireRef.current = onExpire
  })

  useEffect(() => {
    if (!deadline) return
    fired.current = false
    const tick = () => {
      const t = Date.now()
      setNow(t)
      if (t >= deadline && !fired.current) {
        fired.current = true
        expireRef.current?.()
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [deadline])

  return deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null
}

export function formatClock(seconds) {
  const m = Math.floor(seconds / 60)
  const s = String(seconds % 60).padStart(2, '0')
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${s}` : `${m}:${s}`
}
