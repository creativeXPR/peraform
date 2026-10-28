import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, X } from 'lucide-react'
import { AI_FEATURES, holdRange } from '../../../functions/ai/catalog.js'
import { useWallet } from '../credits/walletContext.js'
import { HoldLine, Progress, TierPicker } from './AiParts.jsx'
import { useAiRun } from './useAiRun.js'
import './ai.css'

const FEATURE = 'analyse-results'
const spec = AI_FEATURES[FEATURE]

// Responses tab, "Analyse results with AI": a plain-language report on the
// results. The server summarises the responses itself and sends only the
// totals to the AI (functions/resultStats.js) — never anyone's individual
// or typed answers. Read-only: nothing in the form changes.
//   statsChars: size of the statistics (for the credit estimate)
//   onReport({ report, charged, at })
export default function AnalyseResultsDialog({ open, onClose, formId, statsChars, onReport }) {
  const ref = useRef(null)
  const { spendable, billing, loaded } = useWallet()
  const [focus, setFocus] = useState('')
  const [tier, setTier] = useState(spec.defaultTier)
  const ai = useAiRun()

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const range = holdRange(billing, FEATURE, tier, 'analyse', statsChars + focus.trim().length)
  const short = loaded && spendable < range.min

  function close() {
    if (ai.running) return
    onClose()
  }

  async function run(e) {
    e.preventDefault()
    const data = await ai.run(FEATURE, tier, { formId, focus }, { needed: range.min, spendable })
    if (!data) return
    ai.finish()
    onReport({ report: data.result.report, charged: data.charged, at: Date.now() })
    setFocus('')
    onClose()
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
      <form className="confirm-body" onSubmit={run}>
        <div className="collab-head">
          <h2>
            <BarChart3 size={18} /> Analyse results with AI
          </h2>
          <button type="button" className="icon-btn" onClick={close} aria-label="Close" disabled={ai.running}>
            <X size={18} />
          </button>
        </div>
        <p className="ai-hold" style={{ margin: 0 }}>
          A plain-language report: what went well, questions that were too easy or too hard, choices nobody picked,
          and questions that may need a second look. Only totals are sent to the AI — never anyone’s individual or
          typed answers, or their emails. Nothing in your form changes.
        </p>
        <label className="ai-field">
          <span className="sr-only">Anything to focus on? (optional)</span>
          <textarea
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            maxLength={spec.maxChars.analyse}
            rows={2}
            disabled={ai.running}
            placeholder="Anything to focus on? (optional) e.g. Which questions should I rewrite?"
          />
        </label>

        <TierPicker feature={FEATURE} billing={billing} tier={tier} onTier={setTier} disabled={ai.running} />
        {ai.running && <Progress progress={ai.progress} elapsed={ai.elapsed} doing="Finishing the report…" unit="finding" />}
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
            <button type="submit" className="btn btn-primary" disabled={ai.running}>
              <BarChart3 size={16} />
              {ai.running ? 'Analysing…' : 'Analyse my results'}
            </button>
          )}
        </div>
      </form>
    </dialog>
  )
}
