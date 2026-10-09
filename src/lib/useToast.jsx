import { useCallback, useEffect, useRef, useState } from 'react'

// Brief bottom-centre confirmation ("Link copied"). Returns the element to
// render and a function to show a message.
export function useToast(duration = 2500) {
  const [message, setMessage] = useState('')
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const showToast = useCallback(
    (text) => {
      setMessage(text)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setMessage(''), duration)
    },
    [duration],
  )

  const toast = message ? (
    <div className="toast" role="status">
      {message}
    </div>
  ) : null

  return [toast, showToast]
}
