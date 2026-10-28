import { describe, expect, it } from 'vitest'
import { resultStats } from '../../functions/resultStats.js'
import { FEATURES } from '../../functions/ai/features.js'

const items = [
  { id: 's0', type: 'section', title: 'Part 1' },
  { id: 'q1', type: 'multipleChoice', title: 'Capital of France?', options: ['Paris', 'Lyon', 'Nice'], points: 1 },
  { id: 'q2', type: 'rating', title: 'Rate us', max: 5 },
  { id: 'q3', type: 'longText', title: 'Comments' },
]

// 12 graded responses: q1 right for the top half by score.
const responses = Array.from({ length: 12 }, (_, i) => ({
  answers: {
    q1: i < 6 ? 'Paris' : 'Lyon',
    q2: (i % 5) + 1,
    ...(i % 3 === 0 && { q3: `private note ${i}` }),
  },
  points: { q1: i < 6 ? 1 : 0 },
  score: i < 6 ? 10 - i : 3 - (i % 3),
  maxScore: 10,
}))

describe('resultStats', () => {
  const stats = resultStats(items, responses)
  const byId = (id) => stats.questions.find((q) => q.id === id)

  it('counts, distributions and averages per question (sections skipped)', () => {
    expect(stats.responses).toBe(12)
    expect(stats.questions.map((q) => q.id)).toEqual(['q1', 'q2', 'q3'])
    expect(byId('q1').options).toEqual([
      { label: 'Paris', count: 6 },
      { label: 'Lyon', count: 6 },
      { label: 'Nice', count: 0 },
    ])
    expect(byId('q2').average).toBe(2.75)
    expect(byId('q3')).toMatchObject({ answered: 4, noAnswer: 8 })
  })

  it('quiz figures: correct rate, and top vs lowest scorers', () => {
    expect(stats.quiz).toMatchObject({ graded: 12, maxScore: 10 })
    expect(byId('q1')).toMatchObject({ points: 1, correctRate: 0.5, strongRate: 1, weakRate: 0 })
  })

  it('never includes typed answers', () => {
    expect(JSON.stringify(stats)).not.toContain('private note')
  })

  it('needs 10 graded responses before comparing top and lowest scorers', () => {
    const few = resultStats(items, responses.slice(0, 5))
    expect(few.questions[0].strongRate).toBeUndefined()
  })
})

describe('analyse-results AI feature', () => {
  it('is registered with a schema and a read-only result', () => {
    const f = FEATURES['analyse-results']
    expect(f.schema.required).toEqual(['summary', 'findings', 'nextSteps'])
    expect(f.result({ summary: 'ok', findings: [], nextSteps: [] })).toEqual({
      report: { summary: 'ok', findings: [], nextSteps: [] },
    })
    expect(f.result({ nope: 1 })).toBeNull()
  })
})
