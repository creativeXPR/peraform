// Turns raw responses into per-question summaries and CSV.

const CHOICE_TYPES = ['multipleChoice', 'checkboxes', 'dropdown']

// { answered, kind: 'choice', rows: [{ label, count }] }
//   or { answered, kind: 'text', values: [string] } (newest first)
export function summarizeQuestion(question, responses) {
  const values = responses
    .map((r) => r.answers?.[question.id])
    .filter((v) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length))

  if (!CHOICE_TYPES.includes(question.type)) {
    return { answered: values.length, kind: 'text', values: values.map(String) }
  }

  // Current options first, in form order; answers for options that were
  // since renamed or removed still count, listed after them.
  const counts = new Map(question.options.map((o) => [o, 0]))
  for (const v of values) {
    for (const choice of Array.isArray(v) ? v : [v]) {
      counts.set(choice, (counts.get(choice) ?? 0) + 1)
    }
  }
  return {
    answered: values.length,
    kind: 'choice',
    rows: [...counts].map(([label, count]) => ({ label, count })),
  }
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join('; ') : String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function responsesToCsv(questions, responses) {
  const header = ['Submitted at', ...questions.map((q) => q.title || 'Untitled question')]
  // Oldest first reads naturally in a spreadsheet.
  const rows = [...responses]
    .reverse()
    .map((r) => [
      r.submittedAt ? r.submittedAt.toISOString() : '',
      ...questions.map((q) => r.answers?.[q.id]),
    ])
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
