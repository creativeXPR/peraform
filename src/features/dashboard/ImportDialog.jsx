import { useEffect, useRef, useState } from 'react'
import { FileJson, FileText, HardDrive, Info, Upload, X } from 'lucide-react'
import { fileToForm } from '../../lib/formFile.js'
import { convertGoogleForm } from '../../lib/googleFormImport.js'
import { driveImportReady, pickGoogleForm } from '../../lib/googleDrive.js'
import IdeaArt from '../ai/IdeaArt.jsx'
import '../ai/ai.css'

const MAX_BYTES = 5 * 1024 * 1024

// Picture colours for the three ways in (IdeaArt.jsx).
const ART = {
  file: { sky: '#eef0ff', sky2: '#d3d8ff', ground: '#a3acf5', accent: '#4f46e5' },
  drive: { sky: '#e6f4ea', sky2: '#c4e8cf', ground: '#81c995', accent: '#1e8e3e' },
  paper: { sky: '#fff1dc', sky2: '#ffd9b0', ground: '#f4b183', accent: '#e8743b' },
}

// Dashboard → Import: a PeraForm file from the computer, or a Google Form
// from Google Drive. (Google Forms can't be saved as a file — Google keeps
// them in Drive — so that's the way to bring one in.) A printout or PDF
// goes to Create with AI instead. Same look as the AI windows (ai.css).
//   onImport({ content, answerKey, skipped? }) creates the form → its id
//   onOpen(id) opens it — straight away, or after saying what didn't come
//   across (images from Google Forms).
//   onCreateAi() opens Create with AI (for a printout or PDF)
export default function ImportDialog({ open, onClose, onImport, onOpen, onCreateAi, busy }) {
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

  function choose(key) {
    if (key === 'file') fileRef.current.click()
    else if (key === 'drive') fromDrive()
    else onCreateAi()
  }

  const disabled = Boolean(working) || busy

  const options = [
    {
      key: 'file',
      title: working === 'file' ? 'Importing…' : 'PeraForm file from your computer',
      text: 'A form saved with “Download as PeraForm file” (in a form’s ⋮ menu). Questions, sections, actions, quiz answers, theme and screen designs all come back.',
      icon: FileJson,
    },
    {
      key: 'drive',
      title: working === 'drive' ? 'Waiting for Google…' : 'Google Form from Google Drive',
      text: driveImportReady
        ? 'Pick a form in Google’s file picker; PeraForm only sees the form you pick. Questions, sections, “go to section” choices and quiz answers come across. Images don’t, because Google’s image links expire.'
        : 'Not set up yet: this needs a one-time Google setup by the site’s owner.',
      icon: HardDrive,
      off: !driveImportReady,
    },
    onCreateAi && {
      key: 'paper',
      title: 'A printout, PDF or Word file',
      text: 'Dawn reads it and builds the form for you. Uses AI credits.',
      icon: FileText,
    },
  ].filter(Boolean)

  return (
    <dialog
      ref={ref}
      className="ai-create import-studio"
      aria-label="Import a form"
      onCancel={(e) => {
        e.preventDefault()
        if (!disabled) onClose()
      }}
      onClick={(e) => e.target === ref.current && !disabled && onClose()}
    >
      <div className="ai-create-body">
        <header className="win-head">
          <span className="win-icon" aria-hidden="true">
            <Upload size={18} />
          </span>
          <b>Import a form</b>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close" disabled={disabled}>
            <X size={20} />
          </button>
        </header>

        <div>
          <h2 className="win-q">{done ? 'Your form is in.' : 'Where is your form coming from?'}</h2>
          {!done && <p className="win-hint">Bring in a form you already have. Nothing changes where it came from.</p>}
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
            <div className="ai-create-actions">
              <button type="button" className="btn btn-primary" onClick={() => onOpen(done.id)}>
                Open the form
              </button>
            </div>
          </section>
        ) : (
          <div className={`ai-ideas no-shuffle import-ways is-${options.length}`}>
            {options.map((o, i) => (
              <button
                key={o.key}
                type="button"
                className="ai-idea import-way"
                onClick={() => choose(o.key)}
                disabled={disabled || o.off}
              >
                <IdeaArt art={ART[o.key]} icon={o.icon} flip={i % 2 === 1} />
                <span className="import-way-words">
                  <span className="ai-idea-title">{o.title}</span>
                  <small>{o.text}</small>
                </span>
              </button>
            ))}
          </div>
        )}
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={fromFile} />

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {!done && (
          <p className="ai-create-note import-note">
            <Info size={14} aria-hidden="true" />
            <span>
              Google Forms can’t be saved as a file on your computer, because Google keeps them in Drive. Import yours
              from Google Drive instead.
            </span>
          </p>
        )}
      </div>
    </dialog>
  )
}
