// Turns raw responses into per-question summaries and CSV.
import { responseTable } from '../../../functions/responseTable.js'
import { GRID_TYPES, hasAnswer } from '../../lib/formLogic.js'

const CHOICE_TYPES = ['multipleChoice', 'checkboxes', 'dropdown']
const SCALE_TYPES = ['linearScale', 'rating']

// One of:
//   { answered, kind: 'choice', rows: [{ label, count }] }
//   { answered, kind: 'scale', rows: [{ label, count }], average }
//   { answered, kind: 'grid', columns, rows: [{ label, counts: [n per column] }] }
//   { answered, kind: 'files', files: [{ name, url, size }] } (newest first)
//   { answered, kind: 'text', values: [string] } (newest first)
export function summarizeQuestion(question, responses) {
  const values = responses
    .map((r) => r.answers?.[question.id])
    .filter((v) => hasAnswer(question, v))
  const answered = values.length

  if (CHOICE_TYPES.includes(question.type)) {
    // Current options first, in form order; answers for options that were
    // since renamed or removed still count, listed after them.
    const counts = new Map(question.options.map((o) => [o, 0]))
    for (const v of values) {
      for (const choice of Array.isArray(v) ? v : [v]) {
        counts.set(choice, (counts.get(choice) ?? 0) + 1)
      }
    }
    return {
      answered,
      kind: 'choice',
      rows: [...counts].map(([label, count]) => ({ label, count })),
    }
  }

  if (SCALE_TYPES.includes(question.type)) {
    const min = question.type === 'rating' ? 1 : question.min
    const counts = new Map()
    for (let n = min; n <= question.max; n++) counts.set(n, 0)
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
    const average = answered ? values.reduce((sum, v) => sum + v, 0) / answered : 0
    return {
      answered,
      kind: 'scale',
      average,
      rows: [...counts].map(([n, count]) => ({ label: String(n), count })),
    }
  }

  if (GRID_TYPES.includes(question.type)) {
    const rows = question.rows.map((label, i) => {
      const counts = question.columns.map(() => 0)
      for (const v of values) {
        for (const choice of [v[i]].flat()) {
          const j = question.columns.indexOf(choice)
          if (j !== -1) counts[j]++
        }
      }
      return { label, counts }
    })
    return { answered, kind: 'grid', columns: question.columns, rows }
  }

  if (question.type === 'fileUpload') return { answered, kind: 'files', files: values.flat() }

  return { answered, kind: 'text', values: values.map(String) }
}

function csvCell(text) {
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

// CSV of all responses: the same table the Google Sheets sync writes
// (functions/responseTable.js), so both always have the same columns.
export function responsesToCsv(questions, responses) {
  const { header, rows } = responseTable(questions, responses)
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}

export function downloadCsv(filename, csv) {
  // Byte-order mark so Excel opens UTF-8 (accents, emoji) correctly.
  const blob = new Blob([String.fromCharCode(0xfeff), csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
