import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

// Small, reusable QR code component (SVG output).
// Zero HyperCBT or PeraForm-specific dependencies so it can be shared cleanly.
export default function QrCode({ value, size = 280, className = '' }) {
  const [svg, setSvg] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!value) return

    QRCode.toString(value, {
      type: 'svg',
      margin: 1,
      width: size,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((str) => {
        if (!cancelled) setSvg(str)
      })
      .catch((err) => {
        console.error('Failed to generate QR code SVG', err)
      })

    return () => {
      cancelled = true
    }
  }, [value, size])

  if (!value || !svg) return null

  return (
    <div
      className={`qr-code-box ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
        padding: '16px',
        borderRadius: '16px',
        maxWidth: '100%',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.06)',
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
