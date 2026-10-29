// Result statistics for a HyperCBT test: pure, no imports, no I/O, so the
// same code runs on the server ("Analyse results with AI", hypercbt.js) and
// in HyperCBT's app (ex-cbt/src/lib/resultStats.js is a COPY - keep the two
// identical). Totals only: never a name, email or Student ID.
//
//   questions   - the test's public questions [{ id, question, options }]
//   answers     - the answer key's correct option text, index-aligned
//   submissions - submitted attempts [{ answers: [picked option text], score }]
//
// Answers are matched to questions by position (as grading does), and to
// options by their text, ignoring case and spaces at the ends.

const norm = (v) => String(v ?? '').trim().toLowerCase()
const round = (n, places = 2) => Math.round(n * 10 ** places) / 10 ** places

// The "upper and lower 27%" groups used in item analysis, once there are
// enough results for them to mean something.
const GROUP_SHARE = 0.27
export const MIN_FOR_GROUPS = 10
// A flag needs at least this many results behind it.
export const MIN_FOR_FLAGS = 5

export function testStats(questions = [], answers = [], submissions = []) {
  const total = questions.length
  const subs = submissions.filter((s) => Array.isArray(s.answers))
  const count = subs.length
  const percents = subs.map((s) => (total ? ((s.score ?? 0) / total) * 100 : 0)).sort((a, b) => a - b)

  // Score distribution in 10 bands: 0–9%, 10–19% … 90–100%.
  const bands = Array.from({ length: 10 }, (_, i) => ({ from: i * 10, to: i === 9 ? 100 : i * 10 + 9, count: 0 }))
  for (const p of percents) bands[Math.min(9, Math.floor(p / 10))].count++

  // Strong and weak groups by total score (for "possible problem").
  const ranked = [...subs].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const groupSize = count >= MIN_FOR_GROUPS ? Math.max(1, Math.round(count * GROUP_SHARE)) : 0
  const strong = ranked.slice(0, groupSize)
  const weak = groupSize ? ranked.slice(-groupSize) : []

  const perQuestion = questions.map((q, i) => {
    const correctText = norm(answers[i])
    const optionCounts = q.options.map((text) => ({ text, count: 0, correct: norm(text) === correctText }))
    let answered = 0
    let right = 0
    for (const s of subs) {
      const picked = norm(s.answers[i])
      if (!picked) continue
      answered++
      const at = optionCounts.findIndex((o) => norm(o.text) === picked)
      if (at >= 0) optionCounts[at].count++
      if (correctText && picked === correctText) right++
    }
    const rateIn = (group) =>
      group.length ? group.filter((s) => correctText && norm(s.answers[i]) === correctText).length / group.length : null
    const strongRate = rateIn(strong)
    const weakRate = rateIn(weak)
    const correctRate = count ? right / count : null

    const flags = []
    if (count >= MIN_FOR_FLAGS && correctRate != null) {
      if (correctRate >= 0.9) flags.push('too-easy')
      if (correctRate <= 0.3) flags.push('too-hard')
    }
    if (count >= MIN_FOR_GROUPS && optionCounts.some((o) => !o.correct && o.count === 0)) flags.push('unused-option')
    if (strongRate != null && weakRate != null && weakRate > strongRate) flags.push('possible-problem')

    return {
      id: q.id || `q${i + 1}`,
      n: i + 1,
      question: q.question,
      answered,
      noAnswer: count - answered,
      correctRate: correctRate == null ? null : round(correctRate),
      strongRate: strongRate == null ? null : round(strongRate),
      weakRate: weakRate == null ? null : round(weakRate),
      // How well the question separates strong from weak candidates (-1 to 1).
      discrimination: strongRate == null ? null : round(strongRate - weakRate),
      options: optionCounts,
      flags,
    }
  })

  const median = count ? (count % 2 ? percents[(count - 1) / 2] : (percents[count / 2 - 1] + percents[count / 2]) / 2) : null
  return {
    count,
    total,
    average: count ? round(percents.reduce((a, b) => a + b, 0) / count, 1) : null,
    median: median == null ? null : round(median, 1),
    highest: count ? round(percents[count - 1], 1) : null,
    lowest: count ? round(percents[0], 1) : null,
    bands,
    groups: groupSize > 0,
    questions: perQuestion,
  }
}
