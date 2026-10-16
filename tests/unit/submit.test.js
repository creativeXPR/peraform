import { describe, expect, it } from 'vitest'
import { checkSubmission, sanitizeAnswers } from '../../functions/submit.js'

const form = {
  status: 'published',
  settings: { requireSignIn: false, quiz: { enabled: false } },
  questions: [
    { id: 'name', type: 'shortText' },
    { id: 'pick', type: 'multipleChoice', options: ['A', 'B'] },
    { id: 'many', type: 'checkboxes', options: ['x', 'y'] },
    { id: 'scale', type: 'linearScale', min: 1, max: 5 },
    { id: 'stars', type: 'rating', max: 5 },
    { id: 'grid', type: 'mcGrid', rows: ['r1', 'r2'], columns: ['c1', 'c2'] },
    { id: 'cgrid', type: 'checkboxGrid', rows: ['r1'], columns: ['c1', 'c2'] },
    { id: 's1', type: 'section' },
  ],
}

describe('sanitizeAnswers', () => {
  it('keeps well-formed answers', () => {
    const answers = {
      name: '  Ada  ',
      pick: 'B',
      many: ['x', 'y'],
      scale: 3,
      stars: 5,
      grid: { 0: 'c1', 1: 'c2' },
      cgrid: { 0: ['c1', 'c2'] },
    }
    expect(sanitizeAnswers(form, answers)).toEqual({ ...answers, name: 'Ada' })
  })

  it('drops answers to unknown questions and sections', () => {
    expect(sanitizeAnswers(form, { evil: 'x', s1: 'x', name: 'ok' })).toEqual({ name: 'ok' })
  })

  it('drops answers of the wrong shape', () => {
    const clean = sanitizeAnswers(form, {
      name: { nested: true },
      many: 'x',
      scale: 9, // outside 1–5
      stars: 2.5,
      grid: ['c1'],
    })
    expect(clean).toEqual({})
  })

  it('clips very long text and de-duplicates choices', () => {
    const clean = sanitizeAnswers(form, { name: 'a'.repeat(9000), many: ['x', 'x', 'y'] })
    expect(clean.name).toHaveLength(5000)
    expect(clean.many).toEqual(['x', 'y'])
  })

  it('ignores junk input entirely', () => {
    expect(sanitizeAnswers(form, null)).toEqual({})
    expect(sanitizeAnswers(form, ['a'])).toEqual({})
  })
})

describe('checkSubmission', () => {
  const base = { form, signInProvider: 'anonymous', now: 1_000_000, answersBytes: 10 }

  it('accepts a normal submission', () => {
    expect(checkSubmission(base)).toBeNull()
  })

  it('rejects drafts, closed forms and missing forms', () => {
    expect(checkSubmission({ ...base, form: { ...form, status: 'closed' } }).code).toBe('failed-precondition')
    expect(checkSubmission({ ...base, form: { ...form, status: 'draft' } }).code).toBe('failed-precondition')
    expect(checkSubmission({ ...base, form: null }).code).toBe('not-found')
  })

  it('requires a real account when the form says so', () => {
    const signedIn = { ...form, settings: { requireSignIn: true } }
    expect(checkSubmission({ ...base, form: signedIn }).code).toBe('unauthenticated')
    expect(checkSubmission({ ...base, form: signedIn, signInProvider: 'google.com' })).toBeNull()
  })

  it('rejects oversized submissions', () => {
    expect(checkSubmission({ ...base, answersBytes: 200_000 }).code).toBe('invalid-argument')
  })

  it('enforces quiz time limits with 30 seconds of grace', () => {
    const timed = { ...form, settings: { quiz: { enabled: true, timeLimit: 10 } } }
    const start = 1_000_000
    const at = (ms) => checkSubmission({ ...base, form: timed, startedAt: start, now: start + ms })
    expect(at(10 * 60_000)).toBeNull()
    expect(at(10 * 60_000 + 29_000)).toBeNull()
    expect(at(10 * 60_000 + 31_000).code).toBe('deadline-exceeded')
    expect(checkSubmission({ ...base, form: timed }).code).toBe('deadline-exceeded') // never started
  })

  it('ignores a time limit on forms that are not quizzes', () => {
    const off = { ...form, settings: { quiz: { enabled: false, timeLimit: 10 } } }
    expect(checkSubmission({ ...base, form: off })).toBeNull()
  })
})
