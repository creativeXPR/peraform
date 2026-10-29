import { useEffect, useRef, useState } from 'react'
import { FileJson, HardDrive, Info, Upload, X } from 'lucide-react'
import { fileToForm } from '../../lib/formFile.js'
import { convertGoogleForm } from '../../lib/googleFormImport.js'
import { driveImportReady, pickGoogleForm } from '../../lib/googleDrive.js'

const MAX_BYTES = 5 * 1024 * 1024

// Dashboard → Import: a PeraForm file from the computer, or a Google Form
// from Google Drive. (Google Forms can't be saved as a file — Google keeps
// them in Drive — so that's the way to bring one in.)
//   onImport({ content, answerKey, skipped? }) creates the form → its id
//   onOpen(id) opens it — straight away, or after saying what didn't come
//   across (images from Google Forms).
export default function ImportDialog({ open, onClose, onImport, onOpen, busy }) {
  const ref = useRef(null)
  const fileRef = useRef(null)
  const [error, setError] = useState('')
  const [working, setWorking] = useState('') // '' | 'file' | 'drive'
  const [done, setDone] = useState(null) // { id, skipped }

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) {
      setError('')
      setDone(null)
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  function finish(id, skipped) {
    if (skipped.length) setDone({ id, skipped })
    else onOpen(id)
  }

  async function fromFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // so picking the same file again still works
    if (!file) return
    setError('')
    setWorking('file')
    try {
      if (file.size > MAX_BYTES) throw new Error('That file is too large (5 MB at most).')
      let data
      try {
        data = JSON.parse(await file.text())
      } catch {
        throw new Error('That isn’t a PeraForm file. Choose a file saved with “Download as PeraForm file”.')
      }
      finish(await onImport(fileToForm(data)), [])
    } catch (err) {
      setError(err.message || 'Couldn’t import that file.')
    } finally {
      setWorking('')
    }
  }

  async function fromDrive() {
    setError('')
    setWorking('drive')
    // Google's picker is an ordinary layer on the page; a modal dialog
    // makes everything outside it unclickable. So this window steps aside
    // while the picker is open, and comes back for progress or errors.
    const dialog = ref.current
    dialog.close()
    const back = () => !dialog.open && dialog.showModal()
    try {
      let g
      try {
        g = await pickGoogleForm()
      } finally {
        back()
      }
      if (g) {
        const result = convertGoogleForm(g)
        finish(await onImport(result), result.skipped)
      }
    } catch (err) {
      setError(err.message || 'Couldn’t import that Google Form.')
    } finally {
      setWorking('')
    }
  }

  const disabled = Boolean(working) || busy

  return (
    <dialog
      ref={ref}
      className="confirm import-dialog"
      onCancel={(e) => {
        e.preventDefault()
        if (!disabled) onClose()
      }}
      onClick={(e) => e.target === ref.current && !disabled && onClose()}
    >
      <div className="confirm-body">
        <div className="collab-head">
          <h2>
            <Upload size={18} /> Import a form
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close" disabled={disabled}>
            <X size={18} />
          </button>
        </div>

        {done ? (
          <section className="import-done" role="status">
            <p>
              <strong>Imported.</strong> A few things couldn’t come across from Google Forms, so add them yourself if you
              need them:
            </p>
            <ul>
              {done.skipped.slice(0, 8).map((s) => (
                <li key={s}>{s}</li>
              ))}
              {done.skipped.length > 8 && <li>and {done.skipped.length - 8} more</li>}
            </ul>
            <div className="confirm-actions">
              <button type="button" className="btn btn-primary" onClick={() => onOpen(done.id)}>
                Open the form
              </button>
            </div>
          </section>
        ) : (
          <>
            <button
              type="button"
              className="import-option"
              onClick={() => fileRef.current.click()}
              disabled={disabled}
            >
              <FileJson size={26} aria-hidden="true" />
              <span>
                <strong>{working === 'file' ? 'Importing…' : 'PeraForm file from your computer'}</strong>
                <small>
                  A form saved with “Download as PeraForm file” (in a form’s ⋮ menu): questions, sections, actions,
                  quiz answers, theme and screen designs all come back.
                </small>
              </span>
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={fromFile} />

            <button
              type="button"
              className="import-option"
              onClick={fromDrive}
              disabled={disabled || !driveImportReady}
            >
              <HardDrive size={26} aria-hidden="true" />
              <span>
                <strong>{working === 'drive' ? 'Waiting for Google…' : 'Google Form from Google Drive'}</strong>
                <small>
                  {driveImportReady
                    ? 'Pick a form in Google’s file picker. PeraForm only sees the form you pick. Questions, sections, “go to section” choices and quiz answers come across; images don’t (Google’s image links expire).'
                    : 'Not set up yet — this needs a one-time Google setup by the site’s owner.'}
                </small>
              </span>
            </button>

            <p className="import-note">
              <Info size={15} aria-hidden="true" />
              <span>
                Google Forms can’t be saved as a file on your computer — Google keeps them in Drive — so import yours
                from Google Drive above. Have a printout or PDF of a form instead? Use <strong>Create with AI</strong>{' '}
                and paste its text.
              </span>
            </p>
          </>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </dialog>
  )
}
