import { beforeEach, describe, expect, it, vi } from 'vitest'

// A stand-in for the Gemini SDK: records the request, returns `reply`.
const sent = []
let reply
// Mocked at the path functions/ai/gemini.js resolves it from.
vi.mock('../../functions/node_modules/@google/genai', () => ({
  GoogleGenAI: class {
    models = {
      generateContent: async (req) => {
        sent.push(req)
        return reply
      },
    }
  },
}))

const { runGemini } = await import('../../functions/ai/gemini.js')
const request = (model) => ({ model, system: 'sys', prompt: 'make a form', schema: { type: 'object' }, maxTokens: 3000 })

describe('Gemini runs', () => {
  beforeEach(() => {
    sent.length = 0
    reply = {
      text: '{"title":"T","questions":[]}',
      candidates: [{ finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 1500, thoughtsTokenCount: 300 },
    }
  })

  it('asks for JSON in the schema, within the output budget', async () => {
    const out = await runGemini('key', request('gemini-3.8-flash'))
    expect(out.json.title).toBe('T')
    const { config, model, contents } = sent[0]
    expect(model).toBe('gemini-3.8-flash')
    expect(contents).toBe('make a form')
    expect(config).toMatchObject({
      systemInstruction: 'sys',
      maxOutputTokens: 3000,
      responseMimeType: 'application/json',
      responseJsonSchema: { type: 'object' },
      thinkingConfig: { thinkingLevel: 'LOW' },
    })
  })

  it('bills thinking as output', async () => {
    const out = await runGemini('key', request('gemini-3.8-flash'))
    expect(out.usage).toEqual({ tokensIn: 900, tokensOut: 1800 })
  })

  it('keeps thinking light on 2.5 models, and off on Flash-Lite', async () => {
    await runGemini('key', request('gemini-2.5-pro'))
    await runGemini('key', request('gemini-2.5-flash-lite'))
    expect(sent[0].config.thinkingConfig).toEqual({ thinkingBudget: 512 })
    expect(sent[1].config.thinkingConfig).toEqual({ thinkingBudget: 0 })
  })

  it('fails (so the run is free) when blocked, cut off or not JSON', async () => {
    reply = { ...reply, promptFeedback: { blockReason: 'SAFETY' } }
    await expect(runGemini('key', request('gemini-3.8-flash'))).rejects.toThrow('refused')
    reply = { ...reply, promptFeedback: undefined, candidates: [{ finishReason: 'MAX_TOKENS' }] }
    await expect(runGemini('key', request('gemini-3.8-flash'))).rejects.toThrow('too-long')
    reply = { ...reply, candidates: [{ finishReason: 'STOP' }], text: 'not json' }
    await expect(runGemini('key', request('gemini-3.8-flash'))).rejects.toThrow('bad-output')
  })
})
