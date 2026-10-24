import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A stand-in for the Gemini SDK: records the request and streams `chunks`
// (each { text?, usageMetadata?, candidates?, promptFeedback? }).
const sent = []
const clients = []
let chunks
let pauseMs = 0
// Mocked at the path functions/ai/gemini.js resolves it from.
vi.mock('../../functions/node_modules/@google/genai', () => ({
  GoogleGenAI: class {
    constructor(options) {
      clients.push(options)
    }
    models = {
      generateContentStream: async (req) => {
        sent.push(req)
        const signal = req.config.abortSignal
        return (async function* () {
          for (const c of chunks) {
            if (pauseMs) {
              await new Promise((resolve, reject) => {
                const t = setTimeout(resolve, pauseMs)
                signal.addEventListener('abort', () => {
                  clearTimeout(t)
                  reject(new Error('aborted'))
                })
              })
            }
            if (signal.aborted) throw new Error('aborted')
            yield c
          }
        })()
      },
    }
  },
}))

const { runGemini } = await import('../../functions/ai/gemini.js')
const request = (model, extra) => ({
  model,
  system: 'sys',
  prompt: 'make a form',
  schema: { type: 'object' },
  maxTokens: 3000,
  ...extra,
})
const done = (usage = { promptTokenCount: 900, candidatesTokenCount: 1500, thoughtsTokenCount: 300 }) => ({
  candidates: [{ finishReason: 'STOP' }],
  usageMetadata: usage,
})

describe('Gemini runs', () => {
  beforeEach(() => {
    sent.length = 0
    pauseMs = 0
    chunks = [{ text: '{"title":"T",' }, { text: '"questions":[]}' }, done()]
  })
  afterEach(() => vi.useRealTimers())

  it('goes through Vertex AI on this project (no API key)', async () => {
    process.env.GCLOUD_PROJECT = 'quality-toolsx'
    await runGemini(request('gemini-3.6-flash'))
    expect(clients[0]).toEqual({ vertexai: true, project: 'quality-toolsx', location: 'global' })
  })

  it('asks for JSON in the schema, within the output budget, and joins the stream', async () => {
    const out = await runGemini(request('gemini-3.6-flash'))
    expect(out.json).toEqual({ title: 'T', questions: [] })
    const { config, model, contents } = sent[0]
    expect(model).toBe('gemini-3.6-flash')
    expect(contents).toBe('make a form')
    expect(config).toMatchObject({
      systemInstruction: 'sys',
      maxOutputTokens: 3000,
      responseMimeType: 'application/json',
      responseJsonSchema: { type: 'object' },
      thinkingConfig: { thinkingLevel: 'LOW' },
    })
  })

  it('reports the text so far as it streams', async () => {
    const seen = []
    await runGemini(request('gemini-3.6-flash', { onText: (t) => seen.push(t) }))
    expect(seen).toEqual(['{"title":"T",', '{"title":"T","questions":[]}'])
  })

  it('bills thinking as output', async () => {
    const out = await runGemini(request('gemini-3.6-flash'))
    expect(out.usage).toEqual({ tokensIn: 900, tokensOut: 1800 })
  })

  it('keeps thinking light (minimal on Flash-Lite, off on 2.5 Flash-Lite)', async () => {
    for (const m of ['gemini-3.5-flash-lite', 'gemini-3.1-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash-lite']) {
      await runGemini(request(m))
    }
    expect(sent.map((r) => r.config.thinkingConfig)).toEqual([
      { thinkingLevel: 'MINIMAL' },
      { thinkingLevel: 'LOW' },
      { thinkingBudget: 512 },
      { thinkingBudget: 0 },
    ])
  })

  it('fails (so the run is free) when blocked, cut off or not JSON', async () => {
    chunks = [{ promptFeedback: { blockReason: 'SAFETY' } }]
    await expect(runGemini(request('gemini-3.6-flash'))).rejects.toThrow('refused')
    chunks = [{ text: '{"title":' }, { candidates: [{ finishReason: 'MAX_TOKENS' }] }]
    await expect(runGemini(request('gemini-3.6-flash'))).rejects.toThrow('too-long')
    chunks = [{ text: 'not json' }, done()]
    await expect(runGemini(request('gemini-3.6-flash'))).rejects.toThrow('bad-output')
  })

  it('stops when the caller hangs up', async () => {
    pauseMs = 50
    const hangUp = new AbortController()
    const run = runGemini(request('gemini-3.6-flash', { signal: hangUp.signal }))
    setTimeout(() => hangUp.abort(), 10)
    await expect(run).rejects.toThrow('cancelled')
  })

  it('stops a stalled run (nothing new for 45 s), but not a slow steady one', async () => {
    vi.useFakeTimers()
    pauseMs = 30_000 // each chunk 30 s apart: slow, but never 45 s of silence
    const steady = runGemini(request('gemini-3.6-flash'))
    await vi.advanceTimersByTimeAsync(100_000)
    await expect(steady).resolves.toMatchObject({ json: { title: 'T' } })

    pauseMs = 50_000 // silence longer than 45 s
    const stalled = runGemini(request('gemini-3.6-flash'))
    const caught = expect(stalled).rejects.toThrow('stalled')
    await vi.advanceTimersByTimeAsync(60_000)
    await caught
  })
})
