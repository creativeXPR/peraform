import { useLayoutEffect, useRef } from 'react'

// Textarea that grows with its content instead of scrolling.
export default function AutoTextarea({ value, ...props }) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const el = ref.current
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return <textarea ref={ref} rows={1} value={value} {...props} />
}
