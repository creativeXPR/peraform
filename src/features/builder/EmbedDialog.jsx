import { useEffect, useRef, useState } from 'react'
import { Code2, Copy, X } from 'lucide-react'

// "Embed HTML": code to put the form inside another website. The embedded
// form drops PeraForm's top bar and footer (?embed=1).
export default function EmbedDialog({ open, link, onClose, showToast }) {
  const ref = useRef(null)
  const [width, setWidth] = useState(640)
  const [height, setHeight] = useState(900)

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const code = `<iframe src="${link}?embed=1" width="${width}" height="${height}" frameborder="0" style="border:0;max-width:100%" loading="lazy" title="Form">Loading…</iframe>`

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      showToast('Embed code copied')
    } catch {
      showToast('Couldn’t copy. Select the code and copy it instead.')
    }
  }

  return (
    <dialog
      ref={ref}
      className="confirm embed-dialog"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="confirm-body">
        <div className="collab-head">
          <h2>
            <Code2 size={18} aria-hidden="true" />
            Embed HTML</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p>Paste this into your website’s HTML. The form keeps working there, theme and all.</p>
        <textarea className="embed-code" readOnly value={code} rows={4} onFocus={(e) => e.target.select()} />
        <div className="embed-size">
          <label>
            Width
            <input type="number" min={240} max={2000} value={width} onChange={(e) => setWidth(Number(e.target.value) || 640)} />
            px
          </label>
          <label>
            Height
            <input type="number" min={240} max={4000} value={height} onChange={(e) => setHeight(Number(e.target.value) || 900)} />
            px
          </label>
        </div>
        <div className="confirm-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Done
          </button>
          <button type="button" className="btn btn-primary" onClick={copy}>
            <Copy size={16} />
            Copy code
          </button>
        </div>
      </div>
    </dialog>
  )
}
