// What each AI feature allows: quality levels, input limits, the output
// budget (max_tokens, thinking included) that sizes its hold, and the size
// of a typical run (for the "≈ X credits" hint). Shared with the app, so
// no prompts or imports here; those are in features.js (server only).
//
// Quality levels: quick = Gemini Flash-Lite, standard = Gemini Flash,
// best = Gemini Pro (billing/pricing.js → tiers; config/billing can repoint
// them). Every level carries the same markup.

import { holdFor } from '../billing/pricing.js'

export const AI_FEATURES = {
  'generate-form': {
    label: 'Create a form with AI',
    tiers: ['quick', 'standard', 'best'],
    defaultTier: 'standard',
    // Describe it (short) or paste a document/notes (long).
    maxChars: { describe: 2000, text: 30000 },
    maxTokens: { describe: 4000, text: 6000 },
    // The least a run may be given: enough for a typical form. With less
    // spare credit than the full budget, a run gets what's there, down to this.
    minTokens: { describe: 3000, text: 4000 },
    // System prompt + the output schema, in tokens (on top of the user's text).
    overheadTokens: 1100,
    // A ~15-question form from a short description.
    typical: { inputTokens: 1200, outputTokens: 2500 },
  },
}

// Input tokens for a run (what holds are sized on, here and on the server).
// Prompt wrappers are a few dozen characters; overheadTokens covers them.
export function inputTokensFor(feature, chars) {
  return Math.ceil(chars / 3) + AI_FEATURES[feature].overheadTokens
}

// The least and the most a run reserves, before knowing the balance.
export function holdRange(billing, feature, tier, mode, chars) {
  const f = AI_FEATURES[feature]
  const model = billing.tiers[tier]
  const input = inputTokensFor(feature, chars)
  return {
    min: holdFor(billing, model, input, f.minTokens[mode]),
    max: holdFor(billing, model, input, f.maxTokens[mode]),
  }
}

export function tierFor(feature, tier) {
  const f = AI_FEATURES[feature]
  return f?.tiers.includes(tier) ? tier : f?.defaultTier
}
