import { CircleCheck, CircleX, Clock3 } from 'lucide-react'
import { formatAnswer } from '../../lib/formatAnswer.js'
import { hasAnswer, questionsOnly } from '../../lib/formLogic.js'

// A respondent's graded quiz: total score, then each question with their
// answer and whatever the creator chose to show (missed questions, correct
// answers, point values, feedback). `response` is their released response.
export default function QuizResult({ form, response, quiz }) {
  const questions = questionsOnly(form.questions)
  const { points = {}, result = {} } = response

  return (
    <div className="quiz-result">
      <section className="respond-card quiz-score">
        <p className="quiz-score-label">Your score</p>
        <p className="quiz-score-value">
          {response.score} <span>/ {response.maxScore}</span>
        </p>
        {Object.values(result).some((r) => r.pending) && (
          <p className="quiz-score-note">
            Some answers are graded by hand, so your score may still change.
          </p>
        )}
      </section>

      {questions.map((q) => {
        const answer = response.answers?.[q.id]
        const r = result[q.id] ?? {}
        const max = q.points ?? 0
        const status = r.pending ? 'pending' : r.correct === true ? 'right' : r.correct === false ? 'wrong' : null
        return (
          <section key={q.id} className={`respond-card quiz-q${status ? ` quiz-q-${status}` : ''}`}>
            <div className="quiz-q-head">
              <p className="respond-q-title">{q.title || 'Untitled question'}</p>
              {quiz.showPoints && max > 0 && (
                <span className="quiz-q-points">
                  {points[q.id] ?? 0}/{max}
                </span>
              )}
            </div>
            <p className={hasAnswer(q, answer) ? 'quiz-answer' : 'quiz-answer muted'}>
              {status === 'right' && <CircleCheck size={16} aria-label="Correct" />}
              {status === 'wrong' && <CircleX size={16} aria-label="Incorrect" />}
              {status === 'pending' && <Clock3 size={16} aria-label="Awaiting grading" />}
              <span>{hasAnswer(q, answer) ? formatAnswer(q, answer) : 'No answer'}</span>
            </p>
            {r.correctAnswer && (
              <p className="quiz-correct">
                Correct answer: <strong>{r.correctAnswer.join(', ')}</strong>
              </p>
            )}
            {r.feedback && <p className="quiz-feedback">{r.feedback}</p>}
          </section>
        )
      })}
    </div>
  )
}
