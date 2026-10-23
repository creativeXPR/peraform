// The responses as a table — one row per response, oldest first — shared by
// the CSV download (src/features/responses/summarize.js) and the Google
// Sheets sync (functions/sheets.js), so both always have the same columns.
// Pure: no Firebase.

const GRID_TYPES = ['mcGrid', 'checkboxGrid']
const isQuestion = (item) => !['section', 'text', 'image', 'video'].includes(item.type)

function columnsFor(question) {
  const title = question.title || 'Untitled question'
  if (question.type === 'fileUpload') {
    return [{ header: title, value: (answers) => answers?.[question.id]?.map((f) => f.url) }]
  }
  if (!GRID_TYPES.includes(question.type)) {
    return [{ header: title, value: (answers) => answers?.[question.id] }]
  }
  return question.rows.map((row, i) => ({
    header: `${title} [${row}]`,
    value: (answers) => answers?.[question.id]?.[i],
  }))
}

// A cell as text: lists joined with "; ", nothing as "".
export function cellText(value) {
  return Array.isArray(value) ? value.join('; ') : String(value ?? '')
}

// Date, Firestore Timestamp or nothing → ISO text.
function timeText(value) {
  if (!value) return ''
  const date = typeof value.toDate === 'function' ? value.toDate() : value
  return date instanceof Date ? date.toISOString() : String(value)
}

// items: the form's questions (sections/blocks are skipped)
// responses: newest first (as listed in the app); rows come out oldest first.
// withEmail: force the "Email address" column on/off (default: only when
// some response has one).
export function responseTable(items, responses, { withEmail } = {}) {
  const questions = items.filter(isQuestion)
  const emails = withEmail ?? responses.some((r) => r.respondentEmail)
  const columns = [
    ...(emails ? [{ header: 'Email address', value: (_, r) => r.respondentEmail }] : []),
    ...questions.flatMap(columnsFor),
  ]
  const header = ['Submitted at', ...columns.map((c) => c.header)]
  const rowFor = (r) => [timeText(r.submittedAt), ...columns.map((c) => cellText(c.value(r.answers, r)))]
  return { header, rows: [...responses].reverse().map(rowFor), rowFor }
}
