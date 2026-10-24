import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sparkles, X } from 'lucide-react'
import { AI_FEATURES, holdRange } from '../../../functions/ai/catalog.js'
import { formatCredits } from '../../../functions/billing/pricing.js'
import { useAuth } from '../auth/useAuth.js'
import { useWallet } from '../credits/walletContext.js'
import { createForm, parseFormContent } from '../dashboard/formActions.js'
import { HoldLine, Progress, TierPicker } from './AiParts.jsx'
import { useAiRun } from './useAiRun.js'
import './ai.css'

const FEATURE = 'generate-form'
const spec = AI_FEATURES[FEATURE]

// "Create with AI": describe the form (or paste a document), pick a quality
// level, and get a ready-to-edit draft. Shows what it will roughly cost
// and the most it can cost before anything runs, then live progress (the
// run streams: each question appears as it's written). Cancel is free.
export default function GenerateFormDialog({ open, onClose }) {
  const ref = useRef(null)
  const navigate = useNavigate()
  const { user } = useAuth()
  const { spendable, billing, loaded } = useWallet()
  const [mode, setMode] = useState('describe')
  const [text, setText] = useState('')
  const [tier, setTier] = useState(spec.defaultTier)
  const ai = useAiRun()

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const maxChars = spec.maxChars[mode]
  // A run reserves its full budget, or what's spare if that's less (down to
  // the minimum a form needs).
  const range = holdRange(billing, FEATURE, tier, mode, Math.max(text.trim().length, 1))
  const short = loaded && spendable < range.min

  function close() {
    if (!ai.running) onClose()
  }

  async function generate(e) {
    e.preventDefault()
    const data = await ai.run(FEATURE, tier, { mode, text }, { needed: range.min, spendable })
    if (!data) return
    try {
      const id = await createForm(user.uid, parseFormContent(data.result.form, 'AI form'))
      navigate(`/forms/${id}/edit`, {
        state: { notice: `Made with AI · used ${formatCredits(data.charged)} credits` },
      })
    } catch {
      ai.finish()
      ai.setError('The form was written but couldn’t be saved. Please try again.')
    }
  }

  return (
    <dialog
      ref={ref}
      className="confirm ai-dialog"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => e.target === ref.current && close()}
    >
      <form className="confirm-body" onSubmit={generate}>
        <div className="collab-head">
          <h2>
            <Sparkles size={18} /> Create with AI
          </h2>
          <button type="button" className="icon-btn" onClick={close} aria-label="Close" disabled={ai.running}>
            <X size={18} />
          </button>
        </div>

        <div className="segmented" role="tablist">
          {[
            ['describe', 'Describe it'],
            ['text', 'From a document'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              className={mode === key ? 'active' : ''}
              onClick={() => setMode(key)}
              disabled={ai.running}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="ai-field">
          <span className="sr-only">{mode === 'describe' ? 'What is the form for?' : 'Document text'}</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={maxChars}
            rows={mode === 'describe' ? 4 : 10}
            disabled={ai.running}
            placeholder={
              mode === 'describe'
                ? 'e.g. A feedback form for customers of a small bakery: what they bought, how it tasted, delivery, and whether they’d recommend us.'
                : 'Paste a questionnaire, notes or any text the form should come from.'
            }
            required
          />
          <span className="ai-count">
            {text.length.toLocaleString()} / {maxChars.toLocaleString()}
          </span>
        </label>

        <TierPicker feature={FEATURE} billing={billing} tier={tier} onTier={setTier} disabled={ai.running} />

        {ai.running && <Progress progress={ai.progress} elapsed={ai.elapsed} />}
        <HoldLine range={range} spendable={spendable} loaded={loaded} hidden={ai.running} />
        {ai.error && (
          <p className="form-error" role="alert">
            {ai.error}
          </p>
        )}

        <div className="confirm-actions">
          {ai.running && (
            <button type="button" className="btn btn-outline" onClick={ai.cancel}>
              Cancel
            </button>
          )}
          {short ? (
            <Link to="/credits" className="btn btn-primary">
              Top up credits
            </Link>
          ) : (
            <button type="submit" className="btn btn-primary" disabled={ai.running || text.trim().length < 3}>
              <Sparkles size={16} />
              {ai.running ? 'Writing your form…' : 'Create form'}
            </button>
          )}
        </div>
      </form>
    </dialog>
  )
}
