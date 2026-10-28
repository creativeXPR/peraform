// Result statistics: what a form's responses add up to, per question —
// totals only, never anyone's individual or typed answers. Shared by the
// Responses tab (src/features/responses), the server's "Analyse results
// with AI" (functions/ai/features.js) and, later, HyperCBT. Pure: no
// Firebase, no DOM.
//
// resultStats(items, responses) → {
//   responses,                      // how many
//   quiz: { graded, average, median, maxScore } | null,
//   questions: [{
//     id, title, type, answered, noAnswer,
//     options?: [{ label, count }],      // choices, scales
//     average?, min?, max?,              // linearScale, rating
//     points?, correctRate?,             // quiz questions with points
//     strongRate?, weakRate?,            // correct rate in the top / bottom
//                                        // 27% by score (≥ 10 graded)
//   }]
// }
// Typed answers (short/long text, dates, times, files) are counted, never
// included.

const SKIP = ['section', 'text', 'image', 'video']
const CHOICE = ['multipleChoice', 'checkboxes', 'dropdown']
const SCALE = ['linearScale', 'rating']
const GRID = ['mcGrid', 'checkboxGrid']

function answered(value) {
  if (value === undefined || value === null || value === '') return false
  if (Array.isArray(value)) return value.some((v) => answered(v))
  if (typeof value === 'object') return Object.values(value).some((v) => answered(v))
  return true
}

const round = (n, places = 2) => Math.round(n * 10 ** places) / 10 ** places

function median(values) {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function resultStats(items, responses) {
  const questions = (items ?? []).filter((q) => !SKIP.includes(q.type))
  const graded = responses.filter((r) => r.points && Number.isFinite(r.score))
  const scores = graded.map((r) => r.score)
  // Top and bottom 27% by score (the usual split for spotting questions
  // that strong respondents miss); only with enough graded responses.
  const byScore = [...graded].sort((a, b) => b.score - a.score)
  const cut = graded.length >= 10 ? Math.max(1, Math.round(graded.length * 0.27)) : 0
  const strong = byScore.slice(0, cut)
  const weak = cut ? byScore.slice(-cut) : []
  const rate = (group, q) => {
    const marked = group.filter((r) => q.id in r.points)
    return marked.length ? round(marked.filter((r) => r.points[q.id] >= q.points).length / marked.length) : undefined
  }

  return {
    responses: responses.length,
    quiz: graded.length
      ? {
          graded: graded.length,
          average: round(scores.reduce((s, n) => s + n, 0) / graded.length, 1),
          median: round(median(scores), 1),
          maxScore: graded[0].maxScore ?? 0,
        }
      : null,
    questions: questions.map((q) => {
      const values = responses.map((r) => r.answers?.[q.id]).filter(answered)
      const out = { id: q.id, title: q.title || 'Untitled question', type: q.type, answered: values.length, noAnswer: responses.length - values.length }
      if (CHOICE.includes(q.type)) {
        const counts = new Map((q.options ?? []).map((o) => [o, 0]))
        for (const v of values) for (const c of Array.isArray(v) ? v : [v]) if (counts.has(c)) counts.set(c, counts.get(c) + 1)
        // Typed "Other" answers are counted together, never listed.
        const other = values.filter((v) => (Array.isArray(v) ? v : [v]).some((c) => !counts.has(c))).length
        out.options = [...counts].map(([label, count]) => ({ label, count }))
        if (other) out.options.push({ label: 'Other (typed answers)', count: other })
      } else if (SCALE.includes(q.type)) {
        const min = q.type === 'rating' ? 1 : (q.min ?? 1)
        const max = q.max ?? 5
        const nums = values.map(Number).filter(Number.isFinite)
        out.min = min
        out.max = max
        out.average = nums.length ? round(nums.reduce((s, n) => s + n, 0) / nums.length) : undefined
        out.options = []
        for (let n = min; n <= max; n++) out.options.push({ label: String(n), count: nums.filter((x) => x === n).length })
      } else if (GRID.includes(q.type)) {
        out.rows = (q.rows ?? []).length
        out.columns = (q.columns ?? []).length
      }
      if (q.points > 0 && graded.length) {
        out.points = q.points
        out.correctRate = rate(graded, q)
        if (cut) {
          out.strongRate = rate(strong, q)
          out.weakRate = rate(weak, q)
        }
      }
      return out
    }),
  }
}
