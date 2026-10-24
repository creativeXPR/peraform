// One Claude call per AI run: JSON out (structured outputs), usage back.
// The SDK loads on first use, so functions that never call Claude don't
// pay for it at cold start.
let client

export class AiError extends Error {}

export async function runClaude(apiKey, { model, system, prompt, schema, maxTokens, effort }) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  client ??= new Anthropic({ apiKey, timeout: 90_000, maxRetries: 1 })
  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: prompt }],
    output_config: { effort, format: { type: 'json_schema', schema } },
  })

  // Thinking tokens are inside output_tokens, and billed as output.
  const usage = {
    tokensIn:
      message.usage.input_tokens +
      (message.usage.cache_creation_input_tokens ?? 0) +
      (message.usage.cache_read_input_tokens ?? 0),
    tokensOut: message.usage.output_tokens,
  }
  if (message.stop_reason === 'refusal') throw new AiError('refused', { cause: usage })
  if (message.stop_reason === 'max_tokens') throw new AiError('too-long', { cause: usage })

  const text = message.content.find((b) => b.type === 'text')?.text
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new AiError('bad-output', { cause: usage })
  }
  return { json, usage, model: message.model }
}
