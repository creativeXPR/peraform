import { Check, X } from 'lucide-react'
import { GRADABLE_TYPES } from '../../lib/formModel.js'

// The "Answer key" side of a question card: points, correct answer(s), and
// feedback. Points live on the (public) question; everything else goes into
// the private answer key via changeKey.
export default function AnswerKeyEditor({ question, entry, change, changeKey, onDone }) {
  const gradable = GRADABLE_TYPES.includes(question.type)
  const correct = entry?.correct ?? []
  const multi = question.type === 'checkboxes'

  const toggleCorrect = (option) =>
    changeKey('correct', (e) => {
      const current = e?.correct ?? []
      const next = current.includes(option)
        ? current.filter((c) => c !== option)
        : multi
          ? [...current, option]
          : [option]
      return { ...e, correct: next }
    })

  return (
    <div className="key-editor">
      <div className="key-head">
        <p className="key-title">{question.title || 'Untitled question'}</p>
        <label className="key-points">
          <input
            type="number"
            min={0}
            max={100}
            value={question.points ?? 0}
            aria-label="Points"
            onChange={(e) => {
              const n = Math.round(Number(e.target.value))
              const points = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0
              change('points', (q) => ({ ...q, points }))
            }}
          />
          points
        </label>
      </div>

      {!gradable ? (
        <p className="key-note">
          This question type isn’t graded automatically. Award its points by hand in the Responses
          tab.
        </p>
      ) : question.type === 'shortText' ? (
        <AcceptedAnswers correct={correct} changeKey={changeKey} />
      ) : (
        <>
          <p className="key-note">
            {multi ? 'Select every correct answer.' : 'Select the correct answer.'}
          </p>
          <ul className="key-options">
            {question.options.map((option, i) => {
              const on = correct.includes(option)
              return (
                <li key={i}>
                  <button
                    type="button"
                    className={`key-option${on ? ' on' : ''}`}
                    aria-pressed={on}
                    onClick={() => toggleCorrect(option)}
                  >
                    <span className={`q-marker q-marker-${multi ? 'box' : 'circle'}`} />
                    <span>{option}</span>
                    {on && <Check size={16} className="key-check" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {gradable && (
        <div className="key-feedback">
          {[
            ['feedbackCorrect', 'Feedback for correct answers'],
            ['feedbackIncorrect', 'Feedback for incorrect answers'],
          ].map(([field, label]) => (
            <input
              key={field}
              value={entry?.[field] ?? ''}
              placeholder={`${label} (optional)`}
              aria-label={label}
              maxLength={500}
              onChange={(e) => {
                const value = e.target.value
                changeKey(field, (k) => ({ ...k, [field]: value }))
              }}
            />
          ))}
        </div>
      )}

      <footer className="q-foot">
        <button type="button" className="btn btn-outline key-done" onClick={onDone}>
          Done
        </button>
      </footer>
    </div>
  )
}

function AcceptedAnswers({ correct, changeKey }) {
  const answers = correct.length ? correct : ['']
  // Blank rows are kept while editing; the grader ignores them.
  const set = (list) => changeKey('correct', (e) => ({ ...e, correct: list }))
  return (
    <>
      <p className="key-note">Accepted answers — matched ignoring capitals and extra spaces.</p>
      <ol className="q-options">
        {answers.map((answer, i) => (
          <li key={i} className="q-option">
            <span className="q-marker q-marker-num">{i + 1}.</span>
            <input
              value={answer}
              placeholder="Correct answer"
              aria-label={`Accepted answer ${i + 1}`}
              onChange={(e) => set(answers.map((a, j) => (j === i ? e.target.value : a)))}
            />
            {answers.length > 1 && (
              <button
                type="button"
                className="icon-btn q-option-remove"
                onClick={() => set(answers.filter((_, j) => j !== i))}
                aria-label={`Remove accepted answer ${i + 1}`}
              >
                <X size={16} />
              </button>
            )}
          </li>
        ))}
        <li className="q-option">
          <span className="q-marker q-marker-num">{answers.length + 1}.</span>
          <button
            type="button"
            className="link-btn q-add-option"
            onClick={() => changeKey('correct', (e) => ({ ...e, correct: [...(e?.correct ?? []), 'Answer'] }))}
          >
            Add accepted answer
          </button>
        </li>
      </ol>
    </>
  )
}
