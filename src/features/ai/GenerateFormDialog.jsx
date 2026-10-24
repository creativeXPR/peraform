import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Sparkles, X } from 'lucide-react'
import { callAiRun } from '../../lib/firebase.js'
import { AI_FEATURES, holdRange } from '../../../functions/ai/catalog.js'
import { formatCredits, typicalCharge } from '../../../functions/billing/pricing.js'
import { useAuth } from '../auth/useAuth.js'
import { useWallet } from '../credits/walletContext.js'
import { createForm, parseFormContent } from '../dashboard/formActions.js'
import './ai.css'

const FEATURE = 'generate-form'
const spec = AI_FEATURES[FEATURE]

const LEVELS = [
  { tier: 'quick', name: 'Quick', blurb: 'Fast and very cheap. Good for simple forms.' },
  { tier: 'standard', name: 'Standard', blurb: 'Well-chosen question types. Right for most forms.' },
  { tier: 'best', name: 'Best', blurb: 'Most careful. For long documents and detailed surveys.' },
]

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
  const [state, setState] = useState('idle') // idle | running
  const [error, setError] = useState('')
  // { stage: 'starting' | 'started' | 'writing' | 'saving', title, questions, written }
  const [progress, setProgress] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const abortRef = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const maxChars = spec.maxChars[mode]
  // A run reserves its full budget, or what's spare if that's less (down to
  // the minimum a form needs).
  const range = holdRange(billing, FEATURE, tier, mode, Math.max(text.trim().length, 1))
  const hold = Math.min(range.max, Math.max(spendable, range.min))
  const short = loaded && spendable < range.min
  const running = state === 'running'

  // Seconds since the run started, for the progress panel.
  useEffect(() => {
    if (!running) return
    const started = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [running])

  function close() {
    if (!running) onClose()
  }

  // Ask the server to cancel first. If the run is still going, it's marked
  // so it's released, not charged, and we stop waiting. If it has just
  // finished (and been charged), keep the result: the form is on its way.
  async function cancel() {
    const { controller, holdId } = abortRef.current ?? {}
    if (!holdId) {
      controller?.abort()
      return
    }
    try {
      const { data } = await callAiRun({ cancel: holdId })
      if (data.cancelled) controller.abort()
    } catch {
      controller.abort()
    }
  }

  async function generate(e) {
    e.preventDefault()
    setState('running')
    setError('')
    setElapsed(0)
    setProgress({ stage: 'starting' })
    const controller = new AbortController()
    abortRef.current = { controller, holdId: null }
    try {
      const call = await callAiRun.stream(
        { feature: FEATURE, tier, input: { mode, text } },
        { signal: controller.signal },
      )
      // call.data rejects too when the stream fails or is cancelled; the
      // loop below reports that, so don't let it surface as unhandled.
      call.data.catch(() => {})
      for await (const chunk of call.stream) {
        if (chunk.holdId) abortRef.current.holdId = chunk.holdId
        setProgress(chunk)
      }
      const data = await call.data
      setProgress((p) => ({ ...p, stage: 'saving' }))
      const content = parseFormContent(data.result.form, 'AI form')
      const id = await createForm(user.uid, content)
      navigate(`/forms/${id}/edit`, {
        state: { notice: `Made with AI · used ${formatCredits(data.charged)} credits` },
      })
    } catch (err) {
      setState('idle')
      setProgress(null)
      if (controller.signal.aborted) {
        setError('Cancelled. You weren’t charged.')
        return
      }
      setError(
        err.message === 'insufficient-credits'
          ? `This needs at least ${formatCredits(err.details?.needed ?? range.min)} credits free and you have ${formatCredits(err.details?.spendable ?? spendable)}.`
          : err.message || 'Something went wrong. You weren’t charged; please try again.',
      )
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
          <button type="button" className="icon-btn" onClick={close} aria-label="Close" disabled={running}>
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
              disabled={running}
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
            disabled={running}
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

        <fieldset className="ai-levels" disabled={running}>
          <legend>Quality</legend>
          {LEVELS.map((l) => {
            const m = billing.tiers[l.tier]
            const about = typicalCharge(billing, m, spec.typical.inputTokens, spec.typical.outputTokens)
            return (
              <label key={l.tier} className={`ai-level${tier === l.tier ? ' is-on' : ''}`}>
                <input type="radio" name="tier" value={l.tier} checked={tier === l.tier} onChange={() => setTier(l.tier)} />
                <span className="ai-level-name">
                  {l.name}
                  {l.tier === spec.defaultTier && <em>Recommended</em>}
                </span>
                <span className="ai-level-blurb">{l.blurb}</span>
                <span className="ai-level-cost">≈ {formatCredits(about)} credits</span>
              </label>
            )
          })}
        </fieldset>

        {running && <Progress progress={progress} elapsed={elapsed} />}

        <p className="ai-hold" hidden={running}>
          {short
            ? `Needs at least ${formatCredits(range.min)} credits free; you have ${formatCredits(spendable)}.`
            : `Reserves up to ${formatCredits(hold)} credits while it works; you pay only what it uses. You have ${loaded ? formatCredits(spendable) : '…'}.`}
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="confirm-actions">
          {running && (
            <button type="button" className="btn btn-outline" onClick={cancel}>
              Cancel
            </button>
          )}
          {short ? (
            <Link to="/credits" className="btn btn-primary">
              Top up credits
            </Link>
          ) : (
            <button type="submit" className="btn btn-primary" disabled={running || text.trim().length < 3}>
              <Sparkles size={16} />
              {running ? 'Writing your form…' : 'Create form'}
            </button>
          )}
        </div>
      </form>
    </dialog>
  )
}

// What the run is doing right now. The questions appear as they're written.
function Progress({ progress, elapsed }) {
  const { stage, title, questions = 0, written = [] } = progress ?? {}
  const status =
    stage === 'saving'
      ? 'Saving your form…'
      : stage === 'writing' && questions > 0
        ? `Writing question ${questions}…`
        : stage === 'writing' || stage === 'started'
          ? 'Planning your form…'
          : 'Reserving credits…'
  return (
    <section className="ai-progress" aria-live="polite">
      <div className="ai-progress-head">
        <span className="ai-progress-spark" aria-hidden="true">
          <Sparkles size={16} />
        </span>
        <strong>{status}</strong>
        <span className="ai-progress-time">{elapsed}s</span>
      </div>
      {title && <p className="ai-progress-title">{title}</p>}
      {written.length > 0 && (
        <ol className="ai-progress-list">
          {written.slice(-5).map((t, i, shown) => (
            <li key={written.length - shown.length + i}>
              <Check size={14} aria-hidden="true" />
              {t || 'Untitled question'}
            </li>
          ))}
        </ol>
      )}
      {elapsed >= 25 && stage !== 'saving' && (
        <p className="ai-progress-note">Longer forms take a little longer. It’s still going; you can cancel at no charge.</p>
      )}
    </section>
  )
}
