import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Sparkles, Undo2, X } from 'lucide-react'
import { AI_FEATURES, compactForm, holdRange } from '../../../functions/ai/catalog.js'
import { formatCredits } from '../../../functions/billing/pricing.js'
import { useFormEditor } from '../builder/editorContext.js'
import { useWallet } from '../credits/walletContext.js'
import { HoldLine, Progress, TierPicker } from './AiParts.jsx'
import { applyAiEdit } from './applyEdit.js'
import { useAiRun } from './useAiRun.js'
import './ai.css'

const FEATURE = 'edit-form'
const spec = AI_FEATURES[FEATURE]

const EXAMPLES = [
  'Add an email question after the name, and make it required',
  'Turn the satisfaction questions into one grid',
  'Translate the whole form into French',
  'Make the wording friendlier and shorter',
]

// "Edit with AI": change the form you're in by asking. The whole edit is
// one step, so Undo (here, or Ctrl+Z) takes it back. Questions keep their
// ids, so answers already collected still match.
export default function EditFormDialog({ open, onClose }) {
  const ref = useRef(null)
  const { form, draft, edit, undo, saveState } = useFormEditor()
  const { spendable, billing, loaded } = useWallet()
  const [instruction, setInstruction] = useState('')
  const [tier, setTier] = useState(spec.defaultTier)
  const [done, setDone] = useState(null) // { summary, charged }
  const ai = useAiRun()

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const formChars = JSON.stringify(compactForm(draft)).length
  const range = holdRange(billing, FEATURE, tier, 'edit', formChars + Math.max(instruction.trim().length, 1))
  const short = loaded && spendable < range.min
  const tooLong = formChars > spec.maxFormChars
  // The server edits the saved form, so the latest typing must be saved first.
  const unsaved = saveState !== 'saved'

  function close() {
    if (ai.running) return
    setDone(null)
    onClose()
  }

  async function run(e) {
    e.preventDefault()
    setDone(null)
    const data = await ai.run(
      FEATURE,
      tier,
      { formId: form.id, instruction },
      { needed: range.min, spendable },
    )
    if (!data) return
    // One undo step for the whole change.
    edit(`ai-edit:${Date.now()}`, (d) => applyAiEdit(d, data.result.form))
    ai.finish()
    setDone({ summary: data.result.summary, charged: data.charged })
    setInstruction('')
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
            <Sparkles size={18} /> Edit with AI
          </h2>
          <button type="button" className="icon-btn" onClick={close} aria-label="Close" disabled={ai.running}>
            <X size={18} />
          </button>
        </div>

        {done ? (
          <section className="ai-done" aria-live="polite">
            <p className="ai-done-head">
              <CheckCircle2 size={18} /> Done · used {formatCredits(done.charged)} credits
            </p>
            {done.summary && <p>{done.summary}</p>}
            <p className="ai-hold">Not what you wanted? Undo puts the form back exactly as it was.</p>
          </section>
        ) : (
          <>
            <label className="ai-field">
              <span className="sr-only">What should change?</span>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                maxLength={spec.maxChars.edit}
                rows={4}
                disabled={ai.running}
                placeholder="What should change? e.g. Add a phone number question after the email."
                required
              />
              <span className="ai-count">
                {instruction.length.toLocaleString()} / {spec.maxChars.edit.toLocaleString()}
              </span>
            </label>
            {!instruction && !ai.running && (
              <div className="ai-examples">
                {EXAMPLES.map((x) => (
                  <button key={x} type="button" className="ai-example" onClick={() => setInstruction(x)}>
                    {x}
                  </button>
                ))}
              </div>
            )}

            <TierPicker feature={FEATURE} billing={billing} tier={tier} onTier={setTier} disabled={ai.running} />

            {ai.running && <Progress progress={ai.progress} elapsed={ai.elapsed} doing="Applying the changes…" />}
            <HoldLine range={range} spendable={spendable} loaded={loaded} hidden={ai.running} />
            {tooLong && (
              <p className="form-error">This form is too long to edit with AI in one go. Try it on a copy with fewer questions.</p>
            )}
          </>
        )}
        {ai.error && (
          <p className="form-error" role="alert">
            {ai.error}
          </p>
        )}

        <div className="confirm-actions">
          {done ? (
            <>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  undo()
                  setDone(null)
                }}
              >
                <Undo2 size={16} /> Undo
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setDone(null)}>
                Another change
              </button>
              <button type="button" className="btn btn-primary" onClick={close}>
                Done
              </button>
            </>
          ) : (
            <>
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
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={ai.running || unsaved || tooLong || instruction.trim().length < 3}
                  title={unsaved ? 'Saving your latest changes first…' : undefined}
                >
                  <Sparkles size={16} />
                  {ai.running ? 'Editing…' : unsaved ? 'Saving…' : 'Make the change'}
                </button>
              )}
            </>
          )}
        </div>
      </form>
    </dialog>
  )
}
