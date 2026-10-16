import { describe, expect, it } from 'vitest'
import { validateAnswer } from '../../src/lib/validation.js'

const short = (kind, op, value = '', value2 = '', message = '') => ({
  type: 'shortText',
  validation: { kind, op, value, value2, message },
})

describe('number', () => {
  it('rejects non-numbers for any number rule', () => {
    expect(validateAnswer(short('number', 'gt', '5'), 'abc')).toBe('Must be a number greater than 5')
  })

  it('checks comparisons', () => {
    expect(validateAnswer(short('number', 'gt', '5'), '6')).toBeNull()
    expect(validateAnswer(short('number', 'gt', '5'), '5')).not.toBeNull()
    expect(validateAnswer(short('number', 'lte', '5'), '5')).toBeNull()
    expect(validateAnswer(short('number', 'neq', '0'), '0')).not.toBeNull()
  })

  it('checks ranges either way round', () => {
    expect(validateAnswer(short('number', 'between', '10', '1'), '4')).toBeNull()
    expect(validateAnswer(short('number', 'between', '1', '10'), '11')).not.toBeNull()
    expect(validateAnswer(short('number', 'notBetween', '1', '10'), '11')).toBeNull()
  })

  it('checks whole numbers', () => {
    expect(validateAnswer(short('number', 'whole'), '3')).toBeNull()
    expect(validateAnswer(short('number', 'whole'), '3.5')).toBe('Must be a whole number')
  })

  it('ignores a half-configured rule', () => {
    expect(validateAnswer(short('number', 'between', '1', ''), '99')).toBeNull()
  })
})

describe('text', () => {
  it('checks contains case-insensitively', () => {
    expect(validateAnswer(short('text', 'contains', 'Lagos'), 'I live in lagos')).toBeNull()
    expect(validateAnswer(short('text', 'notContains', 'spam'), 'SPAM here')).not.toBeNull()
  })

  it('checks email and url', () => {
    expect(validateAnswer(short('text', 'email'), 'ada@example.com')).toBeNull()
    expect(validateAnswer(short('text', 'email'), 'ada@example')).not.toBeNull()
    expect(validateAnswer(short('text', 'url'), 'peraform.web.app')).toBeNull()
    expect(validateAnswer(short('text', 'url'), 'https://peraform.web.app/f/x')).toBeNull()
    expect(validateAnswer(short('text', 'url'), 'not a url')).not.toBeNull()
    expect(validateAnswer(short('text', 'url'), 'javascript:alert(1)')).not.toBeNull()
  })
})

describe('length and regex', () => {
  it('checks character counts', () => {
    expect(validateAnswer(short('length', 'maxChars', '5'), 'hello')).toBeNull()
    expect(validateAnswer(short('length', 'maxChars', '5'), 'hello!')).not.toBeNull()
    expect(validateAnswer(short('length', 'minChars', '3'), 'hi')).not.toBeNull()
  })

  it('distinguishes contains from full match', () => {
    expect(validateAnswer(short('regex', 'contains', '\\d+'), 'abc123')).toBeNull()
    expect(validateAnswer(short('regex', 'matches', '\\d+'), 'abc123')).not.toBeNull()
    expect(validateAnswer(short('regex', 'matches', '[A-Z]{3}\\d{3}'), 'ABC123')).toBeNull()
    expect(validateAnswer(short('regex', 'notMatches', 'a|b'), 'ab')).toBeNull()
  })

  it('never blocks respondents because of a broken pattern', () => {
    expect(validateAnswer(short('regex', 'matches', '(unclosed'), 'anything')).toBeNull()
  })
})

describe('selection and general behaviour', () => {
  const boxes = (op, value) => ({ type: 'checkboxes', validation: { kind: 'select', op, value } })

  it('counts checkbox selections', () => {
    expect(validateAnswer(boxes('atLeast', '2'), ['a'])).toBe('Select at least 2')
    expect(validateAnswer(boxes('atMost', '2'), ['a', 'b', 'c'])).not.toBeNull()
    expect(validateAnswer(boxes('exactly', '2'), ['a', 'b'])).toBeNull()
  })

  it('lets empty answers through (that is what "required" is for)', () => {
    expect(validateAnswer(short('text', 'email'), '')).toBeNull()
    expect(validateAnswer(boxes('atLeast', '2'), [])).toBeNull()
  })

  it('uses the creator’s own message when given', () => {
    expect(validateAnswer(short('text', 'email', '', '', 'Use your school email'), 'x')).toBe(
      'Use your school email',
    )
  })

  it('ignores rules that do not fit the question type', () => {
    expect(validateAnswer({ type: 'longText', validation: { kind: 'number', op: 'isNumber' } }, 'x')).toBeNull()
  })
})
