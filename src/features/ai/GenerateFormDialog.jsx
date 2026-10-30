import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, FileUp, X } from 'lucide-react'
import { DOC_ACCEPT, DocumentError, readDocument } from '../../lib/readDocument.js'
import { AI_FEATURES, holdRange } from '../../../functions/ai/catalog.js'
import { formatCredits } from '../../../functions/billing/pricing.js'
import { useAuth } from '../auth/useAuth.js'
import { useWallet } from '../credits/walletContext.js'
import { createForm, parseFormContent } from '../dashboard/formActions.js'
import { HoldLine, Progress, TierPicker } from './AiParts.jsx'
import AiStudio from './AiStudio.jsx'
import { IDEAS } from './createIdeas.js'
import { useAiRun } from './useAiRun.js'

const FEATURE = 'generate-form'
const spec = AI_FEATURES[FEATURE]

// "Create a form" with Dawn: describe it (illustrated ideas to start from),
// or switch to pasting a document. While Dawn writes, the ideas give way to
// live progress (each question appears as it's written). Cancel is free.
//   startMode: 'describe' (default) or 'text' (from Import: a document)
export default function GenerateFormDialog({ open, onClose, startMode = 'describe' }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { spendable, billing, loaded } = useWallet()
  const [mode, setMode] = useState(startMode)
  const [text, setText] = useState('')
  const [tier, setTier] = useState(spec.defaultTier)
  // The document that was read into the field: { name, pages, chars, cut }
  const [doc, setDoc] = useState(null)
  const [reading, setReading] = useState('') // file name while it's read
  const [docError, setDocError] = useState('')
  const fileRef = useRef(null)
  const ai = useAiRun()

  const maxChars = spec.maxChars[mode]
  // A run reserves its full budget, or what's spare if that's less (down to
  // the minimum a form needs).
  const range = holdRange(billing, FEATURE, tier, mode, Math.max(text.trim().length, 1))
  const short = loaded && spendable < range.min

  // A document dropped, pasted or picked: read it here (nothing is
  // uploaded) and put its text in the field, where it can still be edited.
  async function addFile([file]) {
    if (!file || reading) return
    setMode('text')
    setDocError('')
    setReading(file.name)
    try {
      const read = await readDocument(file)
      const max = spec.maxChars.text
      setText(read.text.slice(0, max))
      setDoc({ name: read.name, pages: read.pages, chars: Math.min(read.text.length, max), cut: read.text.length > max })
    } catch (err) {
      setDocError(err instanceof DocumentError ? err.message : `“${file.name}” couldn’t be read. Try again, or paste its text.`)
    } finally {
      setReading('')
    }
  }

  function removeDoc() {
    setDoc(null)
    setText('')
  }

  async function generate() {
    const data = await ai.run(FEATURE, tier, { mode, text }, { needed: range.min, spendable })
    if (!data) return
    try {
      const id = await createForm(user.uid, parseFormContent(data.result.form, 'AI form'))
      navigate(`/forms/${id}/edit`, {
        state: { notice: `Made with Dawn · used ${formatCredits(data.charged)} credits` },
      })
    } catch {
      ai.finish()
      ai.setError('The form was written but couldn’t be saved. Please try again.')
    }
  }

  const modeButton = (
    <button
      type="button"
      className={`ai-prompt-mode${mode === 'text' ? ' is-on' : ''}`}
      onClick={() => setMode((m) => (m === 'text' ? 'describe' : 'text'))}
      aria-pressed={mode === 'text'}
      title={mode === 'text' ? 'Describe it instead' : 'Paste a document instead'}
      aria-label={mode === 'text' ? 'Describe it instead' : 'Paste a document instead'}
      disabled={ai.running}
    >
      <FileText size={18} />
    </button>
  )

  return (
    <AiStudio
      open={open}
      onClose={() => !ai.running && onClose()}
      running={ai.running}
      label="Create a form"
      sub={mode === 'describe' ? 'What should we create?' : 'Which document should become a form?'}
      ideas={mode === 'describe' ? IDEAS : []}
      onIdea={(idea) => {
        setMode('describe')
        setText(idea.prompt)
      }}
      middle={
        ai.running ? (
          <Progress progress={ai.progress} elapsed={ai.elapsed} />
        ) : mode === 'text' ? (
          <div className="dawn-doc">
            {reading ? (
              <p className="dawn-doc-chip" role="status">
                <FileText size={18} aria-hidden="true" /> Reading “{reading}”…
              </p>
            ) : doc ? (
              <p className="dawn-doc-chip">
                <FileText size={18} aria-hidden="true" />
                <span>
                  <b>{doc.name}</b>
                  <small>
                    {doc.pages ? `${doc.pages} ${doc.pages === 1 ? 'page' : 'pages'} · ` : ''}
                    {doc.chars.toLocaleString()} characters read
                    {doc.cut && ` · only the first ${spec.maxChars.text.toLocaleString()} fit, the rest was left out`}
                  </small>
                </span>
                <button type="button" className="icon-btn" onClick={removeDoc} aria-label={`Remove ${doc.name}`}>
                  <X size={16} />
                </button>
              </p>
            ) : (
              <div className="dawn-doc-pick">
                <button type="button" className="btn btn-outline" onClick={() => fileRef.current.click()}>
                  <FileUp size={16} aria-hidden="true" /> Choose a file
                </button>
                <span>
                  or drop it here, or paste a copied file. PDF, Word or text. You can also paste the text below.
                </span>
              </div>
            )}
            {docError && (
              <p className="form-error" role="alert">
                {docError}
              </p>
            )}
            <p className="ai-doc-hint">
              A questionnaire, a printout, meeting notes or a syllabus: Dawn keeps its questions and answer choices and
              picks the best question types. Files are read in your browser, not uploaded.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept={DOC_ACCEPT}
              hidden
              onChange={(e) => {
                const files = [...e.target.files]
                e.target.value = '' // so the same file can be picked again
                addFile(files)
              }}
            />
          </div>
        ) : null
      }
      prompt={{
        value: text,
        onChange: setText,
        placeholder: mode === 'describe' ? 'Describe the form or quiz you want…' : 'Paste the document’s text here…',
        maxChars,
        onSubmit: generate,
        multiline: mode === 'text',
        leading: modeButton,
      }}
      short={short}
      onCancel={ai.cancel}
      error={ai.error}
      optionsSummary={`Options · ${tier[0].toUpperCase() + tier.slice(1)} quality · up to ${formatCredits(range.max)} credits${
        text.length > 0 ? ` · ${text.length.toLocaleString()} / ${maxChars.toLocaleString()} characters` : ''
      }`}
      options={
        <>
          <TierPicker feature={FEATURE} billing={billing} tier={tier} onTier={setTier} disabled={ai.running} />
          <HoldLine range={range} spendable={spendable} loaded={loaded} hidden={ai.running} />
        </>
      }
      onFiles={addFile}
      note="Dawn can make mistakes, so check the form before you share it. Uses your Quality Tools AI credits; cancelling is free."
    />
  )
}
