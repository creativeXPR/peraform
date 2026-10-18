import { quizSettings } from '../../lib/formModel.js'
import { useFormEditor } from './editorContext.js'

// Settings tab: who can respond and how often, and quiz options. Saved
// through the same autosave/undo pipeline as the questions.
export default function SettingsPage() {
  const { draft, edit } = useFormEditor()
  if (!draft) return <div className="builder-loading" aria-busy="true" />

  const { requireSignIn, limitOneResponse } = draft.settings
  const quiz = quizSettings(draft)
  // File-upload questions always need signed-in respondents (as in Google Forms).
  const hasUploads = draft.questions.some((q) => q.type === 'fileUpload')

  const set = (key, value) =>
    edit(`settings:${key}`, (d) => {
      const settings = { ...d.settings, [key]: value }
      // One-per-person is only enforceable with real accounts.
      if (key === 'limitOneResponse' && value) settings.requireSignIn = true
      if (key === 'requireSignIn' && !value) settings.limitOneResponse = false
      return { ...d, settings }
    })

  const setQuiz = (key, value) =>
    edit(`quiz:${key}`, (d) => ({
      ...d,
      settings: { ...d.settings, quiz: { ...quizSettings(d), [key]: value } },
    }))

  return (
    <div className="settings">
      <h1>Settings</h1>

      <section className="settings-group">
        <h2>Responses</h2>
        <Toggle
          title="Require sign-in"
          text={
            hasUploads
              ? 'Always on: this form has a file-upload question, which needs signed-in respondents.'
              : 'Respondents must sign in with Google or email before answering.'
          }
          checked={requireSignIn || hasUploads}
          disabled={hasUploads}
          onChange={(v) => set('requireSignIn', v)}
        />
        <Toggle
          title="Limit to 1 response"
          text="Each person can answer once. Turns on “Require sign-in”."
          checked={limitOneResponse}
          onChange={(v) => set('limitOneResponse', v)}
        />
      </section>

      <section className="settings-group">
        <h2>Quiz</h2>
        <Toggle
          title="Make this a quiz"
          text="Assign points, set answer keys, and grade responses automatically."
          checked={quiz.enabled}
          onChange={(v) => setQuiz('enabled', v)}
        />

        {quiz.enabled && (
          <>
            <div className="setting">
              <span className="setting-text">
                <strong>Release grades</strong>
                <span>When respondents see their score.</span>
              </span>
              <select
                className="setting-select"
                value={quiz.release}
                aria-label="Release grades"
                onChange={(e) => setQuiz('release', e.target.value)}
              >
                <option value="immediate">Immediately after each submission</option>
                <option value="manual">Later, after I review</option>
              </select>
            </div>

            <div className="setting setting-stack">
              <span className="setting-text">
                <strong>Respondents can see</strong>
              </span>
              <div className="setting-checks">
                {[
                  ['showMissed', 'Missed questions'],
                  ['showCorrect', 'Correct answers'],
                  ['showPoints', 'Point values'],
                ].map(([key, label]) => (
                  <label key={key} className="setting-check">
                    <input
                      type="checkbox"
                      checked={quiz[key]}
                      onChange={(e) => setQuiz(key, e.target.checked)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="setting">
              <span className="setting-text">
                <strong>Time limit</strong>
                <span>
                  Minutes from when a respondent starts. Answers are submitted automatically when
                  time runs out, and late submissions are rejected. 0 means no limit.
                </span>
                {quiz.timeLimit > 0 && !requireSignIn && (
                  <span className="setting-hint">
                    Tip: turn on “Require sign-in” too, so nobody can restart the clock from
                    another browser.
                  </span>
                )}
              </span>
              <span className="setting-minutes">
                <input
                  type="number"
                  min={0}
                  max={600}
                  step={1}
                  value={quiz.timeLimit}
                  aria-label="Time limit in minutes"
                  onChange={(e) => {
                    const minutes = Math.round(Number(e.target.value))
                    setQuiz('timeLimit', Number.isFinite(minutes) ? Math.min(600, Math.max(0, minutes)) : 0)
                  }}
                />
                min
              </span>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function Toggle({ title, text, checked, onChange, disabled = false }) {
  return (
    <label className={`setting${disabled ? ' setting-disabled' : ''}`}>
      <span className="setting-text">
        <strong>{title}</strong>
        <span>{text}</span>
      </span>
      <span className="switch">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
      </span>
    </label>
  )
}
