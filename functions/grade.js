// Quiz grading — pure, no Firebase, so it can be unit tested
// (tests/unit/grade.test.js). Used by the gradeResponse function.

const GRADABLE = ['multipleChoice', 'dropdown', 'checkboxes', 'shortText']

const normalize = (text) => String(text).trim().replace(/\s+/g, ' ').toLowerCase()

function isCorrect(type, correct, answer) {
  if (answer === undefined) return false
  if (type === 'checkboxes') {
    const given = Array.isArray(answer) ? answer : []
    return given.length === correct.length && correct.every((c) => given.includes(c))
  }
  if (type === 'shortText') {
    // Any accepted answer, ignoring case and extra spaces.
    return correct.some((c) => normalize(c) === normalize(answer))
  }
  return correct.includes(answer)
}

// form:    the form document (questions, settings.quiz)
// key:     the answerKey document ({ questions: { [id]: { correct, feedback… } } })
// answers: the response's answers
//
// Returns the fields written onto the response:
//   points   { [id]: number }  — auto-awarded; creators can change these later
//   score, maxScore
//   result   { [id]: { correct?, correctAnswer?, feedback?, pending? } } —
//            what the respondent may see, trimmed to the quiz's show* settings
export function gradeResponse(form, key, answers) {
  const quiz = form.settings?.quiz ?? {}
  const points = {}
  const result = {}
  let score = 0
  let maxScore = 0

  for (const q of form.questions ?? []) {
    if (['section', 'text', 'image', 'video'].includes(q.type)) continue
    const max = Number.isFinite(q.points) ? Math.max(0, q.points) : 0
    maxScore += max
    const entry = key?.questions?.[q.id]
    // Blank accepted answers are half-typed rows in the builder, not answers.
    const accepted = (entry?.correct ?? []).filter((c) => String(c).trim() !== '')
    const auto = GRADABLE.includes(q.type) && accepted.length > 0

    if (!auto) {
      // No key for this question: a creator awards points by hand.
      points[q.id] = 0
      if (max > 0) result[q.id] = { pending: true }
      continue
    }

    const correct = isCorrect(q.type, accepted, answers?.[q.id])
    points[q.id] = correct ? max : 0
    score += points[q.id]

    const shown = {}
    if (quiz.showMissed !== false) shown.correct = correct
    if (quiz.showCorrect !== false && !correct) shown.correctAnswer = accepted
    const feedback = correct ? entry.feedbackCorrect : entry.feedbackIncorrect
    if (feedback) shown.feedback = feedback
    result[q.id] = shown
  }

  return { points, score, maxScore, result }
}
