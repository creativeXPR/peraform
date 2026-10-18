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

describe('choice answers', () => {
  const choiceForm = {
    ...form,
    questions: [
      { id: 'mc', type: 'multipleChoice', options: ['A', 'B'] },
      { id: 'mco', type: 'multipleChoice', options: ['A'], allowOther: true },
      { id: 'dd', type: 'dropdown', options: ['X'], allowOther: true },
      { id: 'cb', type: 'checkboxes', options: ['x', 'y'] },
      { id: 'cbo', type: 'checkboxes', options: ['x'], allowOther: true },
    ],
  }

  it('only accepts listed options', () => {
    expect(sanitizeAnswers(choiceForm, { mc: 'B', dd: 'X' })).toEqual({ mc: 'B', dd: 'X' })
    expect(sanitizeAnswers(choiceForm, { mc: 'Z', dd: 'nope' })).toEqual({})
    expect(sanitizeAnswers(choiceForm, { cb: ['x', 'made-up'] })).toEqual({ cb: ['x'] })
  })

  it('lets one typed "Other" answer through where allowed', () => {
    expect(sanitizeAnswers(choiceForm, { mco: 'My own answer' })).toEqual({ mco: 'My own answer' })
    expect(sanitizeAnswers(choiceForm, { cbo: ['x', 'first', 'second'] })).toEqual({ cbo: ['x', 'first'] })
  })
})

describe('file upload answers', () => {
  const files = {
    ...form,
    questions: [{ id: 'cv', type: 'fileUpload', maxFiles: 2, maxSizeMb: 1 }],
  }
  const ctx = { formId: 'f1', uid: 'u1', bucket: 'b' }
  const file = (path, size = 1000) => ({
    name: 'cv.pdf',
    path,
    url: `https://firebasestorage.googleapis.com/v0/b/b/o/${encodeURIComponent(path)}?alt=media&token=t`,
    size,
    type: 'application/pdf',
  })

  it('keeps the respondent’s own uploads', () => {
    const clean = sanitizeAnswers(files, { cv: [file('uploads/f1/u1/a-cv.pdf')] }, ctx)
    expect(clean.cv).toHaveLength(1)
  })

  it('drops files from other people, other forms, or other buckets', () => {
    const other = { ...file('uploads/f1/u1/x.pdf'), url: 'https://evil.example/x.pdf' }
    const clean = sanitizeAnswers(
      files,
      { cv: [file('uploads/f1/someone/a.pdf'), file('uploads/f2/u1/a.pdf'), other] },
      ctx,
    )
    expect(clean).toEqual({})
  })

  it('enforces the size and count limits', () => {
    const big = file('uploads/f1/u1/big.pdf', 5 * 1024 * 1024)
    const three = ['a', 'b', 'c'].map((n) => file(`uploads/f1/u1/${n}.pdf`))
    expect(sanitizeAnswers(files, { cv: [big] }, ctx)).toEqual({})
    expect(sanitizeAnswers(files, { cv: three }, ctx).cv).toHaveLength(2)
  })

  it('requires sign-in for forms with file uploads', () => {
    expect(checkSubmission({ form: files, signInProvider: 'anonymous', now: 0, answersBytes: 1 }).code).toBe('unauthenticated')
    expect(checkSubmission({ form: files, signInProvider: 'google.com', now: 0, answersBytes: 1 })).toBeNull()
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

  it('requires a real account when collecting emails', () => {
    const emails = { ...form, settings: { collectEmails: true } }
    expect(checkSubmission({ ...base, form: emails }).code).toBe('unauthenticated')
    expect(checkSubmission({ ...base, form: emails, signInProvider: 'password' })).toBeNull()
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

describe('CSV email column', () => {
  it('adds an Email address column when emails were collected', async () => {
    const { responsesToCsv } = await import('../../src/features/responses/summarize.js')
    const q = [{ id: 'a', type: 'shortText', title: 'Name' }]
    const csv = responsesToCsv(q, [{ submittedAt: null, respondentEmail: 'ada@example.com', answers: { a: 'Ada' } }])
    expect(csv.split('\r\n')).toEqual(['Submitted at,Email address,Name', ',ada@example.com,Ada'])
    expect(responsesToCsv(q, [{ submittedAt: null, answers: { a: 'Ada' } }]).split('\r\n')[0]).toBe('Submitted at,Name')
  })
})
