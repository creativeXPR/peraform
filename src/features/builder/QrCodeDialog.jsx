import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, Copy, Download, QrCode as QrCodeIcon, X } from 'lucide-react'
import QrCode from '../../lib/QrCode.jsx'
import { downloadQrPng } from '../../lib/qr.js'

export default function QrCodeDialog({ open, onClose, formId, formTitle, status = 'draft', showToast }) {
  const ref = useRef(null)
  const [copied, setCopied] = useState(false)
  const url = `https://peraform-qt.web.app/f/${formId}`

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      showToast?.(status === 'published' ? 'Link copied' : 'Link copied — publish the form so people can open it')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast?.('Couldn’t copy the link')
    }
  }

  async function handleDownload() {
    try {
      const slug = (formTitle || 'form')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'form'
      await downloadQrPng(url, `${slug}-qr.png`, 1024)
      showToast?.('QR code saved to your downloads')
    } catch {
      showToast?.('Couldn’t download the QR code')
    }
  }

  return (
    <dialog
      ref={ref}
      className="confirm qr-dialog"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="confirm-body">
        <div className="win-head">
          <span className="win-icon" aria-hidden="true">
            <QrCodeIcon size={18} />
          </span>
          <b>QR code</b>
          <span className="win-what">· {formTitle || 'Untitled form'}</span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <h2 className="win-q">Scan to open the form</h2>
        <p className="win-hint">Project this on a slide or screen so people can scan it with their phone camera.</p>

        {status === 'draft' && (
          <div
            role="note"
            className="form-notice"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: '6px 0 0',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>Publish the form so people can open it.</span>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '8px 0 4px',
          }}
        >
          <QrCode value={url} size={280} />
          <span
            style={{
              marginTop: '12px',
              fontSize: '12px',
              color: 'var(--text-muted)',
              wordBreak: 'break-all',
              textAlign: 'center',
            }}
          >
            {url}
          </span>
        </div>

        <div className="confirm-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-outline" onClick={handleCopy}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied ? 'Copied' : 'Copy link'}</span>
            </button>
            <button type="button" className="btn btn-outline" onClick={handleDownload}>
              <Download size={16} />
              <span>Download PNG</span>
            </button>
          </div>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </dialog>
  )
}
