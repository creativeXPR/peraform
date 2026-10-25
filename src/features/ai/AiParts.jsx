import { Check, Sparkles } from 'lucide-react'
import { AI_FEATURES } from '../../../functions/ai/catalog.js'
import { formatCredits, typicalCharge } from '../../../functions/billing/pricing.js'
import './ai.css'

const LEVELS = [
  { tier: 'quick', name: 'Quick', blurb: 'Fast and very cheap. Good for simple forms.' },
  { tier: 'standard', name: 'Standard', blurb: 'Well-chosen question types. Right for most forms.' },
  { tier: 'best', name: 'Best', blurb: 'Most careful. For long documents and detailed surveys.' },
]

// Quick / Standard / Best, each with what a typical run of `feature` costs.
export function TierPicker({ feature, billing, tier, onTier, disabled }) {
  const spec = AI_FEATURES[feature]
  return (
    <fieldset className="ai-levels" disabled={disabled}>
      <legend>Quality</legend>
      {LEVELS.filter((l) => spec.tiers.includes(l.tier)).map((l) => {
        const about = typicalCharge(billing, billing.tiers[l.tier], spec.typical.inputTokens, spec.typical.outputTokens)
        return (
          <label key={l.tier} className={`ai-level${tier === l.tier ? ' is-on' : ''}`}>
            <input type="radio" name={`tier-${feature}`} value={l.tier} checked={tier === l.tier} onChange={() => onTier(l.tier)} />
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
  )
}

// How much a run will reserve, or how much more is needed.
export function HoldLine({ range, spendable, loaded, hidden }) {
  const short = loaded && spendable < range.min
  const hold = Math.min(range.max, Math.max(spendable, range.min))
  return (
    <p className="ai-hold" hidden={hidden}>
      {short
        ? `Needs at least ${formatCredits(range.min)} credits free; you have ${formatCredits(spendable)}.`
        : `Reserves up to ${formatCredits(hold)} credits while it works; you pay only what it uses. You have ${loaded ? formatCredits(spendable) : '…'}.`}
    </p>
  )
}

// What the run is doing right now. The questions appear as they're written.
//   doing: what "saving" means here ("Saving your form…", "Applying the changes…")
//   unit: what's being written, one by one ("question", "screen")
export function Progress({ progress, elapsed, doing = 'Saving your form…', unit = 'question' }) {
  const { stage, title, questions = 0, written = [] } = progress ?? {}
  const status =
    stage === 'saving'
      ? doing
      : stage === 'writing' && questions > 0
        ? `${unit === 'screen' ? 'Designing screen' : 'Writing question'} ${questions}…`
        : stage === 'writing' || stage === 'started'
          ? unit === 'screen' ? 'Choosing a style…' : 'Planning your form…'
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
              {t || `Untitled ${unit}`}
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
