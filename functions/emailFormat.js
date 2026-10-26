import { emailHtml, escapeHtml } from './mail.js'

const GRID_TYPES = ['mcGrid', 'checkboxGrid']
const NON_QUESTION_TYPES = ['section', 'text', 'image', 'video']

export function isQuestion(item) {
  return !NON_QUESTION_TYPES.includes(item.type)
}

export function formatLagosTime(value) {
  if (!value) return ''
  const date = typeof value.toDate === 'function' ? value.toDate() : value instanceof Date ? value : new Date(value)
  if (isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function hasAnswer(question, value) {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'number') return true
  if (GRID_TYPES.includes(question.type) && typeof value === 'object') {
    return Object.values(value).some((v) => {
      if (Array.isArray(v)) return v.length > 0
      return v !== undefined && v !== null && String(v).trim().length > 0
    })
  }
  return false
}

function answerText(question, value) {
  if (question.type === 'fileUpload' && Array.isArray(value)) {
    return value.map((f) => (typeof f === 'object' && f?.name ? f.name : String(f))).join(', ')
  }
  if (question.type === 'checkboxes' && Array.isArray(value)) {
    return value.join(', ')
  }
  if (GRID_TYPES.includes(question.type) && typeof value === 'object') {
    const rows = question.rows ?? []
    const lines = []
    rows.forEach((row, idx) => {
      const rowVal = value?.[idx]
      if (rowVal === undefined || rowVal === null) return
      const cell = Array.isArray(rowVal) ? rowVal.join(', ') : String(rowVal).trim()
      if (cell) lines.push(`${row}: ${cell}`)
    })
    return lines.join('\n')
  }
  if (Array.isArray(value)) return value.join(', ')
  return String(value ?? '').trim()
}

export function formatRespondentCopy({ form, answers = {}, submittedAt }) {
  const title = form.title?.trim() || 'Untitled form'
  const timeStr = formatLagosTime(submittedAt)
  const questions = (form.questions ?? []).filter(isQuestion)

  const qaItems = []
  for (const q of questions) {
    const val = answers[q.id]
    if (!hasAnswer(q, val)) continue
    const text = answerText(q, val)
    if (!text) continue
    qaItems.push({
      title: q.title?.trim() || 'Untitled question',
      answer: text,
    })
  }

  const subject = `Your response to “${title}”`
  const footer =
    'You asked for a copy of your answers when you submitted this form. The form’s owner can’t see this email.'

  // Plain text version
  let text = `${title}\nSubmitted: ${timeStr}\n\n`
  for (const item of qaItems) {
    text += `${item.title}\n${item.answer}\n\n`
  }
  text += `---\n${footer}`

  // HTML version
  let bodyHtml = `
    <p style="margin:0 0 8px;font-size:14px;color:#6b6f7b">Submitted: <strong>${escapeHtml(timeStr)}</strong></p>
    <div style="margin:20px 0;border-top:1px solid #eceef3;padding-top:16px">
  `
  for (const item of qaItems) {
    const answerHtml = escapeHtml(item.answer).replace(/\n/g, '<br/>')
    bodyHtml += `
      <div style="margin-bottom:18px">
        <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#14151a">${escapeHtml(item.title)}</p>
        <p style="margin:0;font-size:14px;line-height:1.5;color:#3d4049;white-space:pre-wrap">${answerHtml}</p>
      </div>
    `
  }
  bodyHtml += '</div>'

  const html = emailHtml({
    heading: title,
    bodyHtml,
    footer,
  })

  return { subject, text, html }
}

export function formatScoreRelease({ form, response, resultUrl }) {
  const title = form.title?.trim() || 'Untitled form'
  const points = response.points ?? 0
  const maxScore = response.maxScore ?? 0
  const pct = Math.round(response.score ?? (maxScore > 0 ? (points / maxScore) * 100 : 0))
  const subject = `Score released: ${title}`
  const body = `Your score for “${title}” has been released: ${points} / ${maxScore} (${pct}%).`
  const footer = `You received this email because you shared your email when submitting “${title}”.`

  return {
    subject,
    text: `${body}\n\nView score: ${resultUrl}\n\n---\n${footer}`,
    html: emailHtml({
      heading: 'Score released',
      body,
      cta: 'View score',
      href: resultUrl,
      footer,
    }),
  }
}

export function formatEmailFormInvitation({ form, inviter, message, formUrl, customSubject }) {
  const title = form.title?.trim() || 'Untitled form'
  const subject = customSubject?.trim() || `Please fill in: ${title}`
  const inviterName = inviter || 'Someone'
  const note = message?.trim()
  const body = note ? `${note}\n\n${inviterName} invited you to fill out this form.` : `${inviterName} invited you to fill out this form.`
  const footer = `You received this email because ${inviterName} sent you a link to fill out this form on PeraForm.`

  return {
    subject,
    text: `${body}\n\nFill out form: ${formUrl}\n\n---\n${footer}`,
    html: emailHtml({
      heading: title,
      body,
      cta: 'Fill out form',
      href: formUrl,
      footer,
    }),
  }
}
