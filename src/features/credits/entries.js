import { AI_FEATURES } from '../../../functions/ai/catalog.js'

const TIER_LABEL = { quick: 'Quick', standard: 'Standard', best: 'Best' }

// What a ledger entry was, in words.
export function entryLabel(e) {
  switch (e.type) {
    case 'starter':
      return 'Welcome credits'
    case 'topup':
      return `Top-up · ${e.note ?? 'pack'}`
    case 'charge':
      return `${AI_FEATURES[e.feature]?.label ?? 'AI'}${e.tier ? ` · ${TIER_LABEL[e.tier]}` : ''}`
    case 'grant':
      return e.note ? `Credit from PeraForm · ${e.note}` : 'Credit from PeraForm'
    case 'adjustment':
      return e.note ? `Adjustment · ${e.note}` : 'Adjustment'
    case 'refund':
      return 'Refund'
    case 'chargeback':
      return 'Chargeback'
    default:
      return e.type
  }
}
