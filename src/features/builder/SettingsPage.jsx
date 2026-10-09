import { useFormEditor } from './editorContext.js'

// Settings tab: who can respond and how often. Saved through the same
// autosave/undo pipeline as the questions.
export default function SettingsPage() {
  const { draft, edit } = useFormEditor()
  if (!draft) return <div className="builder-loading" aria-busy="true" />

  const { requireSignIn, limitOneResponse } = draft.settings

  const set = (key, value) =>
    edit(`settings:${key}`, (d) => {
      const settings = { ...d.settings, [key]: value }
      // One-per-person is only enforceable with real accounts.
      if (key === 'limitOneResponse' && value) settings.requireSignIn = true
      if (key === 'requireSignIn' && !value) settings.limitOneResponse = false
      return { ...d, settings }
    })

  return (
    <div className="settings">
      <h1>Settings</h1>

      <section className="settings-group">
        <h2>Responses</h2>

        <label className="setting">
          <span className="setting-text">
            <strong>Require sign-in</strong>
            <span>Respondents must sign in with Google or email before answering.</span>
          </span>
          <span className="switch">
            <input
              type="checkbox"
              role="switch"
              checked={requireSignIn}
              onChange={(e) => set('requireSignIn', e.target.checked)}
            />
          </span>
        </label>

        <label className="setting">
          <span className="setting-text">
            <strong>Limit to 1 response</strong>
            <span>Each person can answer once. Turns on “Require sign-in”.</span>
          </span>
          <span className="switch">
            <input
              type="checkbox"
              role="switch"
              checked={limitOneResponse}
              onChange={(e) => set('limitOneResponse', e.target.checked)}
            />
          </span>
        </label>
      </section>
    </div>
  )
}
