import { AiError } from './errors.js'

// One Gemini call per AI run, through Vertex AI: billed monthly to the
// project's Cloud billing account (no prepayment), and no API key: the
// function's own service account signs in. JSON out (responseJsonSchema),
// usage back. The SDK loads on first use, so functions that never call
// Gemini don't pay for it at cold start.
//
// VERTEX_LOCATION (functions/.env): "global" is cheapest for Gemini 3.x and
// the most available; a region (e.g. europe-west1) keeps processing there.
let client

function projectId() {
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT
  try {
    return JSON.parse(process.env.FIREBASE_CONFIG).projectId
  } catch {
    return undefined
  }
}

// Keep thinking light: these runs are form-shaped JSON, not puzzles.
// Gemini 3.x takes a level (Flash-Lite: minimal); 2.5 takes a token budget
// (Flash-Lite: none).
function thinkingFor(model) {
  if (model.startsWith('gemini-2.5-flash-lite')) return { thinkingBudget: 0 }
  if (model.startsWith('gemini-2.5')) return { thinkingBudget: 512 }
  if (model.includes('flash-lite')) return { thinkingLevel: 'MINIMAL' }
  return { thinkingLevel: 'LOW' }
}

export async function runGemini({ model, system, prompt, schema, maxTokens }) {
  const { GoogleGenAI } = await import('@google/genai')
  client ??= new GoogleGenAI({
    vertexai: true,
    project: projectId(),
    location: process.env.VERTEX_LOCATION || 'global',
  })
  const res = await client.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: system,
      // Thinking counts towards this too, so it caps the whole bill.
      maxOutputTokens: maxTokens,
      responseMimeType: 'application/json',
      responseJsonSchema: schema,
      thinkingConfig: thinkingFor(model),
      abortSignal: AbortSignal.timeout(90_000),
    },
  })

  // Thinking tokens are billed as output.
  const meta = res.usageMetadata ?? {}
  const usage = {
    tokensIn: meta.promptTokenCount ?? 0,
    tokensOut: (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0),
  }
  const finish = res.candidates?.[0]?.finishReason
  if (res.promptFeedback?.blockReason || ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII'].includes(finish)) {
    throw new AiError('refused', { cause: usage })
  }
  if (finish === 'MAX_TOKENS') throw new AiError('too-long', { cause: usage })

  let json
  try {
    json = JSON.parse(res.text)
  } catch {
    throw new AiError('bad-output', { cause: usage })
  }
  return { json, usage, model }
}
