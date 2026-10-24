import { runClaude } from './claude.js'
import { runGemini } from './gemini.js'

// Which provider runs a model, by its id. Both return { json, usage, model }
// with usage = { tokensIn, tokensOut } (thinking counted as output).
// keys: { gemini, anthropic } — only the providers in use need one.
export function runModel(keys, request) {
  if (request.model.startsWith('gemini-')) return runGemini(keys.gemini, request)
  if (request.model.startsWith('claude-')) {
    // Add ANTHROPIC_API_KEY to aiRun's secrets before pointing a tier here.
    if (!keys.anthropic) throw new Error('No Anthropic key configured')
    return runClaude(keys.anthropic, request)
  }
  throw new Error(`No provider for ${request.model}`)
}
