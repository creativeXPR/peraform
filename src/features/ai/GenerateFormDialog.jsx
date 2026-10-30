import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'
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
export default function GenerateFormDialog({ open, onClose }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { spendable, billing, loaded } = useWallet()
  const [mode, setMode] = useState('describe')
  const [text, setText] = useState('')
  const [tier, setTier] = useState(spec.defaultTier)
  const ai = useAiRun()

  const maxChars = spec.maxChars[mode]
  // A run reserves its full budget, or what's spare if that's less (down to
  // the minimum a form needs).
  const range = holdRange(billing, FEATURE, tier, mode, Math.max(text.trim().length, 1))
  const short = loaded && spendable < range.min

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
          <p className="ai-doc-hint">
            Paste a questionnaire, a printout’s text, meeting notes or a syllabus below. Dawn keeps its questions and
            answer choices and picks the best question types.
          </p>
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
      note="Dawn can make mistakes, so check the form before you share it. Uses your Quality Tools AI credits; cancelling is free."
    />
  )
}
