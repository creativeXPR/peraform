import { useState } from 'react'
import { AI_FEATURES, holdRange } from '../../../functions/ai/catalog.js'
import { formatCredits } from '../../../functions/billing/pricing.js'
import { useWallet } from '../credits/walletContext.js'
import { HoldLine, Progress, TierPicker } from './AiParts.jsx'
import AiStudio from './AiStudio.jsx'
import { ANALYSE_IDEAS } from './studioIdeas.js'
import { stamp, useAiRun } from './useAiRun.js'

const FEATURE = 'analyse-results'
const spec = AI_FEATURES[FEATURE]

// Responses tab, "Analyse results with AI": a plain-language report on the
// results. The server summarises the responses itself and sends only the
// totals to the AI (functions/resultStats.js) — never anyone's individual
// or typed answers. Read-only: nothing in the form changes.
//   statsChars: size of the statistics (for the credit estimate)
//   onReport({ report, charged, at })
export default function AnalyseResultsDialog({ open, onClose, formId, statsChars, onReport }) {
  const { spendable, billing, loaded } = useWallet()
  const [focus, setFocus] = useState('')
  const [tier, setTier] = useState(spec.defaultTier)
  const ai = useAiRun()

  const range = holdRange(billing, FEATURE, tier, 'analyse', statsChars + focus.trim().length)
  const short = loaded && spendable < range.min

  function close() {
    if (ai.running) return
    onClose()
  }

  async function run() {
    const data = await ai.run(FEATURE, tier, { formId, focus }, { needed: range.min, spendable })
    if (!data) return
    ai.finish()
    onReport({ report: data.result.report, charged: data.charged, at: stamp() })
    setFocus('')
    onClose()
  }

  return (
    <AiStudio
      open={open}
      onClose={close}
      running={ai.running}
      label="Analyse results with AI"
      sub="What should the report look at?"
      ideas={ANALYSE_IDEAS}
      onIdea={(idea) => setFocus(idea.prompt)}
      middle={
        ai.running && <Progress progress={ai.progress} elapsed={ai.elapsed} doing="Finishing the report…" unit="finding" />
      }
      prompt={{
        value: focus,
        onChange: setFocus,
        placeholder: 'Anything to focus on? (optional) Or just press Analyse',
        maxChars: spec.maxChars.analyse,
        onSubmit: run,
        submitLabel: 'Analyse',
        optional: true,
      }}
      short={short}
      onCancel={ai.cancel}
      error={ai.error}
      optionsSummary={`Options · ${tier[0].toUpperCase() + tier.slice(1)} quality · up to ${formatCredits(range.max)} credits`}
      options={
        <>
          <TierPicker feature={FEATURE} billing={billing} tier={tier} onTier={setTier} disabled={ai.running} />
          <HoldLine range={range} spendable={spendable} loaded={loaded} hidden={ai.running} />
        </>
      }
      note="A plain-language report: what went well, questions that were too easy or too hard, and ones that may need a second look. Only totals go to the AI — never anyone’s individual answers or emails. Nothing in your form changes."
    />
  )
}
