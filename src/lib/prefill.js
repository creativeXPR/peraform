import { isQuestion } from './formLogic.js'

// Pre-filled links (Google Forms' "Get pre-filled link"): answers travel in
// the URL as a.<questionId>=value (repeated for checkboxes), and the public
// form starts with them filled in. Only values that fit the question are
// used — options that exist, numbers in range, plain text.

const TEXT_TYPES = ['shortText', 'longText', 'date', 'time']
const MAX_TEXT = 1000

function fits(q, values) {
  const options = q.options ?? []
  switch (q.type) {
    case 'multipleChoice':
    case 'dropdown': {
      const v = values[0]
      return options.includes(v) || (q.allowOther && q.type === 'multipleChoice' && v) ? v : undefined
    }
    case 'checkboxes': {
      const picked = values.filter((v) => options.includes(v))
      return picked.length ? picked : undefined
    }
    case 'linearScale': {
      const n = Number(values[0])
      const min = q.min ?? 1
      return Number.isInteger(n) && n >= min && n <= (q.max ?? 5) ? n : undefined
    }
    case 'rating': {
      const n = Number(values[0])
      return Number.isInteger(n) && n >= 1 && n <= (q.max ?? 5) ? n : undefined
    }
    default:
      return TEXT_TYPES.includes(q.type) && values[0] ? String(values[0]).slice(0, MAX_TEXT) : undefined
  }
}

// URL search string → { questionId: answer } for this form.
export function parsePrefill(form, search) {
  const params = new URLSearchParams(search)
  const out = {}
  for (const q of (form.questions ?? []).filter(isQuestion)) {
    const values = params.getAll(`a.${q.id}`)
    if (!values.length) continue
    const value = fits(q, values)
    if (value !== undefined) out[q.id] = value
  }
  return out
}

export function hasPrefill(search) {
  return [...new URLSearchParams(search).keys()].some((k) => k.startsWith('a.'))
}

// Answers → the form's link with them pre-filled. Grids and uploads can't
// be pre-filled and are left out.
export function prefillUrl(base, form, answers) {
  const url = new URL(base)
  for (const q of (form.questions ?? []).filter(isQuestion)) {
    const value = answers[q.id]
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (q.type !== 'checkboxes') continue
      value.forEach((v) => url.searchParams.append(`a.${q.id}`, v))
    } else if (typeof value !== 'object') {
      url.searchParams.set(`a.${q.id}`, String(value))
    }
  }
  return url.toString()
}
