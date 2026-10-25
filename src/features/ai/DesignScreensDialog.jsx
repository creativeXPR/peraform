import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Sparkles, Undo2, X } from 'lucide-react'
import { AI_FEATURES, holdRange } from '../../../functions/ai/catalog.js'
import { formatCredits } from '../../../functions/billing/pricing.js'
import { DESIGN_STYLES, applyStyle, paletteFor, screenWords } from '../../lib/designStyles.js'
import { interviewOf, screenDesign, screensOf } from '../../lib/interview.js'
import { useFormEditor } from '../builder/editorContext.js'
import { useWallet } from '../credits/walletContext.js'
import { HoldLine, Progress, TierPicker } from './AiParts.jsx'
import { useAiRun } from './useAiRun.js'
import './ai.css'

const FEATURE = 'design-screens'
const spec = AI_FEATURES[FEATURE]

const EXAMPLES = [
  'Fun and colourful, for a kids’ party',
  'Formal, for a university quality office',
  'Calm and clear, for a school quiz',
  'Dark and techy, for a hackathon',
]

// Interview mode, "Design with AI": the AI picks a design style and colours
// and writes each screen's heading and subtitle; every screen is restyled
// with them (layout, questions and actions stay). One undo step.
export default function DesignScreensDialog({ open, onClose }) {
  const ref = useRef(null)
  const { form, draft, edit, undo, saveState } = useFormEditor()
  const { spendable, billing, loaded } = useWallet()
  const [instruction, setInstruction] = useState('')
  const [tier, setTier] = useState(spec.defaultTier)
  const [done, setDone] = useState(null) // { summary, charged, style }
  const ai = useAiRun()

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const screenChars = screensOf(draft).reduce((n, s) => n + s.title.length + 120, 0)
  const range = holdRange(billing, FEATURE, tier, 'design', screenChars + Math.max(instruction.trim().length, 1))
  const short = loaded && spendable < range.min
  const unsaved = saveState !== 'saved'

  function close() {
    if (ai.running) return
    setDone(null)
    onClose()
  }

  async function run(e) {
    e.preventDefault()
    setDone(null)
    const data = await ai.run(FEATURE, tier, { formId: form.id, instruction }, { needed: range.min, spendable })
    if (!data) return
    const { style, palette, screens: words } = data.result.design
    edit(`ai-design:${Date.now()}`, (d) => {
      const all = screensOf(d)
      const iv = interviewOf(d)
      const next = { ...iv.screens }
      const colours = paletteFor(style, palette)
      for (const s of all) {
        const w = words.find((x) => x.key === s.key)
        const styled = applyStyle(screenDesign(d, s, all), style, colours)
        next[s.key] = w ? screenWords(styled, w) : styled
      }
      return { ...d, interview: { ...iv, screens: next } }
    })
    ai.finish()
    setDone({ summary: data.result.summary, charged: data.charged, style })
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
            <Sparkles size={18} /> Design with AI
          </h2>
          <button type="button" className="icon-btn" onClick={close} aria-label="Close" disabled={ai.running}>
            <X size={18} />
          </button>
        </div>

        {done ? (
          <section className="ai-done" aria-live="polite">
            <p className="ai-done-head">
              <CheckCircle2 size={18} /> {DESIGN_STYLES[done.style]?.label} style · used {formatCredits(done.charged)} credits
            </p>
            {done.summary && <p>{done.summary}</p>}
            <p className="ai-hold">Not quite right? Undo puts every screen back exactly as it was.</p>
          </section>
        ) : (
          <>
            <p className="ai-hold" style={{ margin: 0 }}>
              Describe the look you want. The AI picks a style and colours and writes each screen’s heading;
              your layout, questions and actions stay as they are.
            </p>
            <label className="ai-field">
              <span className="sr-only">How should the screens look?</span>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                maxLength={spec.maxChars.design}
                rows={3}
                disabled={ai.running}
                placeholder="How should it look? e.g. Warm and welcoming, in our brand orange."
                required
              />
              <span className="ai-count">
                {instruction.length.toLocaleString()} / {spec.maxChars.design.toLocaleString()}
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

            {ai.running && (
              <Progress progress={ai.progress} elapsed={ai.elapsed} doing="Restyling your screens…" unit="screen" />
            )}
            <HoldLine range={range} spendable={spendable} loaded={loaded} hidden={ai.running} />
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
                Try another look
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
                  disabled={ai.running || unsaved || instruction.trim().length < 3}
                  title={unsaved ? 'Saving your latest changes first…' : undefined}
                >
                  <Sparkles size={16} />
                  {ai.running ? 'Designing…' : unsaved ? 'Saving…' : 'Design my screens'}
                </button>
              )}
            </>
          )}
        </div>
      </form>
    </dialog>
  )
}
