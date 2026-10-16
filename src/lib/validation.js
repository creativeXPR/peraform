// Response validation, like Google Forms. A question may carry
//   validation: { kind, op, value, value2, message }
// checked in the browser before a page can be left (it's a convenience for
// respondents, not a security boundary — Firestore rules don't see it).

// kind → ops → label, per question type.
export const VALIDATION = {
  number: {
    label: 'Number',
    ops: {
      gt: 'Greater than',
      gte: 'Greater than or equal to',
      lt: 'Less than',
      lte: 'Less than or equal to',
      eq: 'Equal to',
      neq: 'Not equal to',
      between: 'Between',
      notBetween: 'Not between',
      isNumber: 'Is number',
      whole: 'Whole number',
    },
  },
  text: {
    label: 'Text',
    ops: { contains: 'Contains', notContains: 'Doesn’t contain', email: 'Email', url: 'URL' },
  },
  length: {
    label: 'Length',
    ops: { maxChars: 'Maximum character count', minChars: 'Minimum character count' },
  },
  regex: {
    label: 'Regular expression',
    ops: {
      contains: 'Contains',
      notContains: 'Doesn’t contain',
      matches: 'Matches',
      notMatches: 'Doesn’t match',
    },
  },
  select: {
    label: 'Selection',
    ops: { atLeast: 'Select at least', atMost: 'Select at most', exactly: 'Select exactly' },
  },
}

export const VALIDATION_KINDS = {
  shortText: ['number', 'text', 'length', 'regex'],
  longText: ['length', 'regex'],
  checkboxes: ['select'],
}

const NO_VALUE = ['isNumber', 'whole', 'email', 'url']
const TWO_VALUES = ['between', 'notBetween']

export function opValueCount(op) {
  if (NO_VALUE.includes(op)) return 0
  return TWO_VALUES.includes(op) ? 2 : 1
}

export function newValidation(type) {
  const kind = VALIDATION_KINDS[type][0]
  return { kind, op: Object.keys(VALIDATION[kind].ops)[0], value: '', value2: '', message: '' }
}

function toNumber(text) {
  const n = Number(String(text).trim())
  return String(text).trim() !== '' && Number.isFinite(n) ? n : null
}

// null if the pattern isn't a valid regular expression.
export function compilePattern(pattern) {
  try {
    return new RegExp(pattern)
  } catch {
    return null
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isUrl(text) {
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`)
    return ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.')
  } catch {
    return false
  }
}

// Default error text when the creator didn't write one.
function defaultMessage({ kind, op, value, value2 }) {
  switch (`${kind}:${op}`) {
    case 'number:gt':
      return `Must be a number greater than ${value}`
    case 'number:gte':
      return `Must be a number greater than or equal to ${value}`
    case 'number:lt':
      return `Must be a number less than ${value}`
    case 'number:lte':
      return `Must be a number less than or equal to ${value}`
    case 'number:eq':
      return `Must be ${value}`
    case 'number:neq':
      return `Must be a number other than ${value}`
    case 'number:between':
      return `Must be a number between ${value} and ${value2}`
    case 'number:notBetween':
      return `Must be a number outside ${value}–${value2}`
    case 'number:isNumber':
      return 'Must be a number'
    case 'number:whole':
      return 'Must be a whole number'
    case 'text:contains':
      return `Must contain “${value}”`
    case 'text:notContains':
      return `Can’t contain “${value}”`
    case 'text:email':
      return 'Must be a valid email address'
    case 'text:url':
      return 'Must be a valid web address'
    case 'length:maxChars':
      return `Must be at most ${value} characters`
    case 'length:minChars':
      return `Must be at least ${value} characters`
    case 'select:atLeast':
      return `Select at least ${value}`
    case 'select:atMost':
      return `Select at most ${value}`
    case 'select:exactly':
      return `Select exactly ${value}`
    default:
      return 'Please check your answer'
  }
}

// True if `answer` passes. Empty answers always pass — "required" is a
// separate check.
function passes(rule, answer) {
  const { kind, op, value, value2 } = rule
  if (kind === 'select') {
    const count = Array.isArray(answer) ? answer.length : 0
    if (count === 0) return true
    const n = toNumber(value)
    if (n === null) return true
    return op === 'atLeast' ? count >= n : op === 'atMost' ? count <= n : count === n
  }

  const text = typeof answer === 'string' ? answer.trim() : ''
  if (!text) return true

  if (kind === 'number') {
    const n = toNumber(text)
    if (n === null) return false
    if (op === 'isNumber') return true
    if (op === 'whole') return Number.isInteger(n)
    const a = toNumber(value)
    const b = toNumber(value2)
    if (a === null || (TWO_VALUES.includes(op) && b === null)) return true // half-configured
    const [lo, hi] = [Math.min(a, b ?? a), Math.max(a, b ?? a)]
    return {
      gt: n > a,
      gte: n >= a,
      lt: n < a,
      lte: n <= a,
      eq: n === a,
      neq: n !== a,
      between: n >= lo && n <= hi,
      notBetween: n < lo || n > hi,
    }[op]
  }

  if (kind === 'text') {
    if (op === 'email') return EMAIL.test(text)
    if (op === 'url') return isUrl(text)
    const needle = String(value).toLowerCase()
    if (!needle) return true
    const has = text.toLowerCase().includes(needle)
    return op === 'contains' ? has : !has
  }

  if (kind === 'length') {
    const n = toNumber(value)
    if (n === null) return true
    return op === 'maxChars' ? text.length <= n : text.length >= n
  }

  if (kind === 'regex') {
    const re = compilePattern(value)
    if (!re || !value) return true // an invalid pattern never blocks respondents
    if (op === 'matches' || op === 'notMatches') {
      const full = compilePattern(`^(?:${value})$`)
      const ok = full ? full.test(text) : re.test(text)
      return op === 'matches' ? ok : !ok
    }
    const found = re.test(text)
    return op === 'contains' ? found : !found
  }

  return true
}

// Error message to show, or null if the answer is fine.
export function validateAnswer(question, answer) {
  const rule = question.validation
  if (!rule || !VALIDATION_KINDS[question.type]?.includes(rule.kind)) return null
  return passes(rule, answer) ? null : rule.message?.trim() || defaultMessage(rule)
}
