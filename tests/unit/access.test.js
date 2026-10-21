import { describe, expect, it, vi } from 'vitest'

// src/lib/access.js also exports Firestore hooks; only its pure helpers are
// tested here, so Firebase isn't loaded.
vi.mock('../../src/lib/firebase.js', () => ({ db: {} }))

const { MAX_ENTRIES, extractEmails, isAllowedEmail, mergeAccess, parseEntries } = await import(
  '../../src/lib/access.js'
)
const { isAllowedResponder } = await import('../../functions/access.js')
const { checkSubmission } = await import('../../functions/submit.js')

describe('parseEntries', () => {
  it('splits pasted lists into emails and domains, lower-cased and de-duplicated', () => {
    const out = parseEntries('Ada@Example.com, grace@example.com\n@School.edu; ada@example.com')
    expect(out).toEqual({
      emails: ['ada@example.com', 'grace@example.com'],
      domains: ['school.edu'],
      invalid: [],
    })
  })

  it('accepts "Name <email>" and quoted values, and reports junk', () => {
    const out = parseEntries('"Ada" <ada@example.com> not-an-email @nodot')
    expect(out.emails).toEqual(['ada@example.com'])
    expect(out.invalid).toEqual(['"Ada"', 'not-an-email', '@nodot'])
  })
})

describe('extractEmails', () => {
  it('pulls every address out of a CSV, ignoring other columns', () => {
    const csv = 'Name,Email,Class\nAda Lovelace,ADA@example.com,5A\n"Hopper, Grace",grace@navy.mil,5B\n'
    expect(extractEmails(csv)).toEqual(['ada@example.com', 'grace@navy.mil'])
  })
})

describe('mergeAccess', () => {
  it('adds new entries, sorted, and counts only the new ones', () => {
    const current = { emails: ['b@x.com'], domains: [] }
    const out = mergeAccess(current, { emails: ['a@x.com', 'b@x.com'], domains: ['y.org'] })
    expect(out.access).toEqual({ emails: ['a@x.com', 'b@x.com'], domains: ['y.org'] })
    expect(out.added).toBe(2)
    expect(out.overflow).toBe(0)
  })

  it(`stops at ${MAX_ENTRIES} entries and reports the rest`, () => {
    const full = { emails: Array.from({ length: MAX_ENTRIES - 1 }, (_, i) => `p${i}@x.com`), domains: [] }
    const out = mergeAccess(full, { emails: ['new1@x.com', 'new2@x.com'] })
    expect(out.added).toBe(1)
    expect(out.overflow).toBe(1)
  })
})

describe('allowed responders (client and server agree)', () => {
  const access = { emails: ['ada@example.com'], domains: ['school.edu'] }
  const cases = [
    ['ada@example.com', true],
    ['ADA@Example.com', true],
    ['grace@school.edu', true],
    ['eve@sub.school.edu', false],
    ['eve@example.com', false],
    ['', false],
  ]
  it.each(cases)('%s → %s', (email, allowed) => {
    expect(isAllowedEmail(access, email)).toBe(allowed)
    expect(isAllowedResponder(access, email)).toBe(allowed)
  })

  it('allows no one without a list', () => {
    expect(isAllowedResponder(undefined, 'ada@example.com')).toBe(false)
  })
})

describe('checkSubmission: only people you choose', () => {
  const form = { status: 'published', settings: { restricted: true }, questions: [] }
  const access = { emails: ['ada@example.com'], domains: [] }
  const base = { form, now: 0, answersBytes: 1, access, signInProvider: 'google.com' }

  it('accepts a verified address on the list', () => {
    expect(checkSubmission({ ...base, email: 'ada@example.com', emailVerified: true })).toBeNull()
  })

  it('refuses anonymous, unverified and uninvited respondents', () => {
    expect(checkSubmission({ ...base, signInProvider: 'anonymous' }).code).toBe('unauthenticated')
    expect(checkSubmission({ ...base, email: 'ada@example.com', emailVerified: false }).code).toBe(
      'permission-denied',
    )
    expect(checkSubmission({ ...base, email: 'eve@example.com', emailVerified: true }).code).toBe(
      'permission-denied',
    )
  })
})
