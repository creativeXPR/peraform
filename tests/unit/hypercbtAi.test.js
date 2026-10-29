import { describe, expect, it } from 'vitest'
import { AI_FEATURES, holdRange } from '../../functions/ai/catalog.js'
import { FAKE_OUTPUT, FEATURES, InputError } from '../../functions/ai/features.js'
import { DEFAULT_BILLING } from '../../functions/billing/pricing.js'

// HyperCBT's AI features run through the shared aiRun (one wallet).
describe('HyperCBT features in the shared aiRun', () => {
  it('are in the catalog, labelled with their app', () => {
    expect(AI_FEATURES['create-test'].app).toBe('hypercbt')
    expect(AI_FEATURES['review-test'].app).toBe('hypercbt')
    expect(AI_FEATURES['generate-form'].app).toBeUndefined() // PeraForm's (default)
    const range = holdRange(DEFAULT_BILLING, 'create-test', 'standard', 'describe', 200)
    expect(range.min).toBeGreaterThan(0)
    expect(range.max).toBeGreaterThanOrEqual(range.min)
  })

  it('create-test: prepares, checks input, and cleans the result', () => {
    const f = FEATURES['create-test']
    expect(f.prepare({ mode: 'describe', text: 'Ten questions on fractions' })).toMatchObject({ mode: 'describe' })
    expect(f.prepare({ mode: 'notes', text: 'Some notes about cells' }).mode).toBe('notes')
    expect(() => f.prepare({ text: 'x' })).toThrow(InputError)
    const out = f.result(FAKE_OUTPUT['create-test'])
    expect(out.test.questions).toHaveLength(2)
    expect(out.test.questions[0]).toMatchObject({ answerIndex: 1, difficulty: 'easy' })
    // A question whose answer is out of range is dropped.
    expect(f.result({ title: 'T', minutes: 5, questions: [{ question: 'Q', options: ['a', 'b'], answerIndex: 4 }] })).toBeNull()
    expect(f.progress('{"title":"The water cycle","questions":[{"question":"What is').title).toBe('The water cycle')
  })

  it('review-test: cleans suggestions (only known kinds, sane fixes)', () => {
    const out = FEATURES['review-test'].result({
      summary: ' Fine ',
      suggestions: [
        FAKE_OUTPUT['review-test'].suggestions[0],
        { questionId: 'q2', kind: 'made-up', detail: 'x' },
        { questionId: 'q3', kind: 'spelling', detail: 'Typo', options: ['only one'], answerIndex: -1 },
      ],
    })
    expect(out.summary).toBe('Fine')
    expect(out.suggestions.map((s) => s.questionId)).toEqual(['q1', 'q3'])
    expect(out.suggestions[1].options).toBeUndefined()
    expect(out.suggestions[1].answerIndex).toBeUndefined()
  })
})
