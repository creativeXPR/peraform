import { useEffect, useRef, useState } from 'react'
import { HardDrive, ImageIcon, LayoutGrid, Link2, Upload, X } from 'lucide-react'
import { withDialogsAside } from '../../lib/dialogsAside.js'
import { driveImportReady, pickDriveImage } from '../../lib/googleDrive.js'
import { uploadFormImage } from '../../lib/upload.js'
import { useAuth } from '../auth/useAuth.js'
import { HEADER_GALLERY } from './headerGallery.js'

const SOURCES = [
  ['gallery', 'Gallery', LayoutGrid],
  ['upload', 'Upload', Upload],
  ['url', 'By web address', Link2],
  ['drive', 'Google Drive', HardDrive],
]

// "Select header": PeraForm's gallery (by category), an upload, an image
// at a web address, or one from Google Drive. Calls onPicked({ url, path? }).
export default function HeaderPickerDialog({ open, onClose, onPicked }) {
  const ref = useRef(null)
  const fileRef = useRef(null)
  const { user } = useAuth()
  const [source, setSource] = useState('gallery')
  const [category, setCategory] = useState(HEADER_GALLERY[0].key)
  const [url, setUrl] = useState('')
  const [checked, setChecked] = useState({ url: '', ok: null }) // the last address that finished loading
  const [busy, setBusy] = useState('') // what's happening
  const [error, setError] = useState('')

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) {
      setError('')
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  // A typed address is checked by loading it (so a broken link is caught);
  // until it has, it's neither good nor bad.
  const typed = url.trim()
  const urlOk = checked.url === typed ? checked.ok : null
  useEffect(() => {
    if (!/^https:\/\/\S+$/i.test(typed)) return
    const img = new Image()
    img.onload = () => setChecked({ url: typed, ok: true })
    img.onerror = () => setChecked({ url: typed, ok: false })
    img.src = typed
  }, [typed])

  function choose(image) {
    onPicked(image)
    onClose()
  }

  async function upload(file) {
    setError('')
    setBusy('Uploading…')
    try {
      choose(await uploadFormImage(file, user.uid, (p) => setBusy(`Uploading… ${Math.round(p * 100)}%`)))
    } catch (err) {
      setError(err.message || 'Couldn’t upload that image.')
    } finally {
      setBusy('')
    }
  }

  async function fromDrive() {
    setError('')
    setBusy('Waiting for Google…')
    try {
      const file = await withDialogsAside(pickDriveImage)
      setBusy('')
      if (file) await upload(file)
    } catch (err) {
      setError(err.message || 'Couldn’t get that image from Google Drive.')
    } finally {
      setBusy('')
    }
  }

  const gallery = HEADER_GALLERY.find((c) => c.key === category)

  return (
    <dialog
      ref={ref}
      className="header-picker"
      aria-label="Select header"
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onClose()
      }}
      onClick={(e) => e.target === ref.current && !busy && onClose()}
    >
      <div className="header-picker-body">
        <div className="header-picker-head">
          <h2>Select header</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close" disabled={Boolean(busy)}>
            <X size={20} />
          </button>
        </div>

        <div className="header-picker-main">
          <nav className="header-picker-nav" aria-label="Where from">
            {SOURCES.map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                className={source === key ? 'active' : ''}
                aria-current={source === key ? 'page' : undefined}
                onClick={() => {
                  setSource(key)
                  setError('')
                }}
              >
                <Icon size={18} aria-hidden="true" /> {label}
              </button>
            ))}
          </nav>

          <section className="header-picker-pane">
            {source === 'gallery' && (
              <>
                <div className="header-picker-tabs" role="tablist" aria-label="Categories">
                  {HEADER_GALLERY.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      role="tab"
                      aria-selected={category === c.key}
                      className={category === c.key ? 'active' : ''}
                      onClick={() => setCategory(c.key)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="header-picker-grid">
                  {gallery.images.map((img) => (
                    <button key={img.url} type="button" className="header-picker-img" onClick={() => choose({ url: img.url })}>
                      <img src={img.url} alt={img.label} loading="lazy" />
                    </button>
                  ))}
                </div>
              </>
            )}

            {source === 'upload' && (
              <div className="header-picker-center">
                <ImageIcon size={40} strokeWidth={1.4} aria-hidden="true" />
                <p>A wide image works best, around 1600 × 400. Large photos are made smaller for you.</p>
                <button type="button" className="btn btn-primary" onClick={() => fileRef.current.click()} disabled={Boolean(busy)}>
                  <Upload size={16} /> {busy || 'Choose an image'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) upload(file)
                  }}
                />
              </div>
            )}

            {source === 'url' && (
              <div className="header-picker-url">
                <label className="field">
                  Image address (https)
                  <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/banner.jpg" />
                </label>
                {urlOk === true && <img className="header-picker-preview" src={url.trim()} alt="" />}
                {urlOk === false && <p className="form-error">That address didn’t load as an image.</p>}
                <p className="key-note">
                  The image stays where it is online; if that site removes it, your header goes blank. Uploading keeps a
                  copy in PeraForm.
                </p>
                <button type="button" className="btn btn-primary" disabled={urlOk !== true} onClick={() => choose({ url: url.trim() })}>
                  Use this image
                </button>
              </div>
            )}

            {source === 'drive' && (
              <div className="header-picker-center">
                <HardDrive size={40} strokeWidth={1.4} aria-hidden="true" />
                <p>
                  {driveImportReady
                    ? 'Pick an image in Google’s file picker. PeraForm only sees the image you pick, and keeps a copy of it.'
                    : 'Not set up yet — this needs a one-time Google setup by the site’s owner.'}
                </p>
                <button type="button" className="btn btn-primary" onClick={fromDrive} disabled={Boolean(busy) || !driveImportReady}>
                  <HardDrive size={16} /> {busy || 'Choose from Google Drive'}
                </button>
              </div>
            )}

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </section>
        </div>
      </div>
    </dialog>
  )
}
