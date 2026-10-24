import AutoTextarea from '../../lib/AutoTextarea.jsx'
import { quizSettings, settingsOf } from '../../lib/formModel.js'
import { useFormEditor } from './editorContext.js'
import SheetsSettings from './SheetsSettings.jsx'

// Settings tab: who can respond and how, presentation, and quiz options.
// Saved through the same autosave/undo pipeline as the questions.
export default function SettingsPage() {
  const { form, draft, edit } = useFormEditor()
  if (!draft) return <div className="builder-loading" aria-busy="true" />

  const {
    requireSignIn,
    limitOneResponse,
    collectEmails,
    showProgressBar,
    shuffleQuestions,
    confirmationMessage,
    showSubmitAnother,
    topTitleOn,
    topTitle,
    fieldPadding,
  } = settingsOf(draft)
  const quiz = quizSettings(draft)
  const mode = draft.mode === 'interview' ? 'interview' : 'normal'
  // File-upload questions always need signed-in respondents (as in Google Forms).
  const hasUploads = draft.questions.some((q) => q.type === 'fileUpload')
  // Invited-only: respondents sign in with the address on the list, and it's
  // always recorded with their answers.
  const restricted = Boolean(draft.settings?.restricted)

  const set = (key, value) =>
    edit(`settings:${key}`, (d) => {
      const settings = { ...d.settings, [key]: value }
      // One-per-person is only enforceable with real accounts.
      if (key === 'limitOneResponse' && value) settings.requireSignIn = true
      if (key === 'requireSignIn' && !value) settings.limitOneResponse = false
      if (key === 'restricted' && value) settings.requireSignIn = true
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
        <h2>Form type</h2>
        <div className="form-type" role="radiogroup" aria-label="Form type">
          {[
            ['normal', 'Normal form', 'Questions on one page per section, like Google Forms.'],
            [
              'interview',
              'Interview mode',
              'Each section is a screen you design, like an app’s onboarding. Design it under Questions.',
            ],
          ].map(([value, title, text]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              className={`form-type-option${mode === value ? ' active' : ''}`}
              onClick={() => edit('mode', (d) => ({ ...d, mode: value }))}
            >
              <strong>{title}</strong>
              <span>{text}</span>
            </button>
          ))}
        </div>
        <p className="form-type-note">
          Switching keeps both: the questions are shared, and your screen designs stay saved while
          you use the normal form (and the other way round).
        </p>
      </section>

      <section className="settings-group">
        <h2>Responses</h2>
        <Toggle
          title="Only people you choose"
          text="Only the people on your list (by email or @domain) can open and answer the form. Manage the list under Share."
          checked={restricted}
          onChange={(v) => set('restricted', v)}
        />
        <Toggle
          title="Require sign-in"
          text={
            restricted
              ? 'Always on: only invited people can respond, so they sign in with their invited address.'
              : hasUploads
                ? 'Always on: this form has a file-upload question, which needs signed-in respondents.'
                : 'Respondents must sign in with Google or email before answering.'
          }
          checked={requireSignIn || hasUploads || restricted}
          disabled={hasUploads || restricted}
          onChange={(v) => set('requireSignIn', v)}
        />
        <Toggle
          title="Limit to 1 response"
          text="Each person can answer once. Turns on “Require sign-in”."
          checked={limitOneResponse}
          onChange={(v) => set('limitOneResponse', v)}
        />
        <Toggle
          title="Collect email addresses"
          text={
            restricted
              ? 'Always on for invited-only forms, so you can see who has responded.'
              : 'Records each respondent’s account email with their answers. Respondents sign in, so the address can’t be made up.'
          }
          checked={collectEmails || restricted}
          disabled={restricted}
          onChange={(v) => set('collectEmails', v)}
        />
      </section>

      <section className="settings-group">
        <h2>Google Sheets</h2>
        <SheetsSettings formId={form.id} />
      </section>

      <section className="settings-group">
        <h2>Presentation</h2>
        <Toggle
          title="Show a title at the top"
          text="Replaces the PeraForm logo at the top of the form with a title of your own: the form’s name, unless you change it."
          checked={topTitleOn}
          onChange={(on) =>
            edit('settings:topTitleOn', (d) => ({
              ...d,
              settings: {
                ...d.settings,
                topTitleOn: on,
                // Starts as the form's name; yours to change.
                topTitle: on && !settingsOf(d).topTitle.trim() ? d.title || '' : settingsOf(d).topTitle,
              },
            }))
          }
        />
        {topTitleOn && (
          <label className="setting-field">
            <span>Title at the top</span>
            <input
              className="setting-input"
              value={topTitle}
              maxLength={80}
              placeholder={draft.title || 'Untitled form'}
              onChange={(e) => set('topTitle', e.target.value)}
            />
          </label>
        )}
        <label className="setting setting-number">
          <span className="setting-text">
            <strong>Space inside answer fields</strong>
            <span>Padding around what respondents type, in text boxes, dropdowns and dates.</span>
          </span>
          <span className="setting-px">
            <input
              className="setting-input"
              type="number"
              min={0}
              max={32}
              value={fieldPadding}
              onChange={(e) =>
                e.target.value !== '' && set('fieldPadding', Math.min(32, Math.max(0, Math.round(Number(e.target.value)))))
              }
              aria-label="Space inside answer fields, in pixels"
            />
            px
          </span>
        </label>
        <Toggle
          title="Show progress bar"
          text="Shows how far through the form respondents are (forms with sections)."
          checked={showProgressBar}
          onChange={(v) => set('showProgressBar', v)}
        />
        <Toggle
          title="Shuffle question order"
          text="Each respondent sees the questions within each section in a different order."
          checked={shuffleQuestions}
          onChange={(v) => set('shuffleQuestions', v)}
        />
        <Toggle
          title="Show link to submit another response"
          text="After submitting, respondents can start again (not shown when limited to 1 response)."
          checked={showSubmitAnother}
          onChange={(v) => set('showSubmitAnother', v)}
        />
        <div className="setting setting-stack">
          <span className="setting-text">
            <strong>Confirmation message</strong>
            <span>Shown after someone submits. Leave empty for “Your response has been recorded.”</span>
          </span>
          <AutoTextarea
            className="setting-textarea"
            value={confirmationMessage}
            placeholder="Your response has been recorded."
            maxLength={500}
            aria-label="Confirmation message"
            onChange={(e) => set('confirmationMessage', e.target.value)}
          />
        </div>
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
