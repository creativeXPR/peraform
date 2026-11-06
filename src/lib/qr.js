import QRCode from 'qrcode'

// Downloads a high-resolution PNG of the QR code (suitable for slides or printing)
export async function downloadQrPng(value, filename = 'qr-code.png', size = 1024) {
  const dataUrl = await QRCode.toDataURL(value, {
    width: size,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  })
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
