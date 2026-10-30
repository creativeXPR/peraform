import { useState } from 'react'
import { CheckCircle2, Undo2 } from 'lucide-react'
import { AI_FEATURES, compactForm, holdRange } from '../../../functions/ai/catalog.js'
import { formatCredits } from '../../../functions/billing/pricing.js'
import { isQuestion } from '../../lib/formLogic.js'
import { useFormEditor } from '../builder/editorContext.js'
import { useWallet } from '../credits/walletContext.js'
import { HoldLine, Progress, TierPicker } from './AiParts.jsx'
import AiStudio from './AiStudio.jsx'
import { applyAiEdit } from './applyEdit.js'
import { EDIT_IDEAS } from './studioIdeas.js'
import { stamp, useAiRun } from './useAiRun.js'

const FEATURE = 'edit-form'
const spec = AI_FEATURES[FEATURE]

// "Edit with AI": change the form you're in by asking. The whole edit is
// one step, so Undo (here, or Ctrl+Z) takes it back. Questions keep their
// ids, so answers already collected still match.
export default function EditFormDialog({ open, onClose }) {
  const { form, draft, edit, undo, saveState } = useFormEditor()
  const { spendable, billing, loaded } = useWallet()
  const [instruction, setInstruction] = useState('')
  const [tier, setTier] = useState(spec.defaultTier)
  const [done, setDone] = useState(null) // { summary, charged }
  const ai = useAiRun()

  const formChars = JSON.stringify(compactForm(draft)).length
  const questionCount = draft.questions.filter(isQuestion).length
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

  async function run() {
    setDone(null)
    const data = await ai.run(FEATURE, tier, { formId: form.id, instruction }, { needed: range.min, spendable })
    if (!data) return
    // One undo step for the whole change.
    edit(`ai-edit:${stamp()}`, (d) => applyAiEdit(d, data.result.form))
    ai.finish()
    setDone({ summary: data.result.summary, charged: data.charged })
    setInstruction('')
  }

  return (
    <AiStudio
      open={open}
      onClose={close}
      running={ai.running}
      label="Edit this form"
      context={`${form.title || 'Untitled form'} · ${questionCount} ${questionCount === 1 ? 'question' : 'questions'} · ${unsaved ? 'saving…' : 'saved'}`}
      sub="What should we change?"
      ideas={EDIT_IDEAS}
      onIdea={(idea) => setInstruction(idea.prompt)}
      middle={
        ai.running ? (
          <Progress progress={ai.progress} elapsed={ai.elapsed} doing="Applying the changes…" />
        ) : done ? (
          <section className="ai-done" aria-live="polite">
            <p className="ai-done-head">
              <CheckCircle2 size={18} /> Done · used {formatCredits(done.charged)} credits
            </p>
            {done.summary && <p>{done.summary}</p>}
            <p className="ai-hold">Not what you wanted? Undo puts the form back exactly as it was.</p>
          </section>
        ) : null
      }
      actions={
        done && (
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
        )
      }
      prompt={{
        value: instruction,
        onChange: setInstruction,
        placeholder: 'Describe the change, e.g. Add a phone number question after the email',
        maxChars: spec.maxChars.edit,
        onSubmit: run,
        submitLabel: unsaved ? 'Saving…' : undefined,
        disabled: unsaved || tooLong,
        title: unsaved ? 'Saving your latest changes first…' : undefined,
      }}
      short={short}
      onCancel={ai.cancel}
      error={
        ai.error ||
        (tooLong ? 'This form is too long to edit with AI in one go. Try it on a copy with fewer questions.' : '')
      }
      optionsSummary={`Options · ${tier[0].toUpperCase() + tier.slice(1)} quality · up to ${formatCredits(range.max)} credits`}
      options={
        <>
          <TierPicker feature={FEATURE} billing={billing} tier={tier} onTier={setTier} disabled={ai.running} />
          <HoldLine range={range} spendable={spendable} loaded={loaded} hidden={ai.running} />
        </>
      }
      note="Dawn can make mistakes, so check the changes. One Undo takes the whole change back. Cancelling is free."
    />
  )
}
