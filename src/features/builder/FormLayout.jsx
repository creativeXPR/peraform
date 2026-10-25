import { Link, useParams } from 'react-router-dom'
import { BarChart3, ListChecks, Settings } from 'lucide-react'
import AppShell from '../../lib/AppShell.jsx'
import { themeOf, themeStyle } from '../../lib/theme.js'
import { useTheme } from '../../lib/useTheme.js'
import { usePageTitle } from '../../lib/usePageTitle.js'
import { useAuth } from '../auth/useAuth.js'
import BuilderActions from './BuilderActions.jsx'
import FormEditorProvider from './FormEditorProvider.jsx'
import FormTitleField from './FormTitleField.jsx'
import { useFormEditor } from './editorContext.js'
import './builder.css'

// Frame for /forms/:formId/* — the sidebar holds the Questions / Responses /
// Settings tabs, the top bar holds the title and the form's actions.
export default function FormLayout() {
  const { formId } = useParams()
  return (
    // key: switching forms starts a fresh editing session.
    <FormEditorProvider key={formId} formId={formId}>
      <FormFrame formId={formId} />
    </FormEditorProvider>
  )
}

function FormFrame({ formId }) {
  const { form, draft, loadError: error } = useFormEditor()
  const { user } = useAuth()
  const { theme: mode } = useTheme()
  // The tab shows which form this is, and follows renames as you type.
  usePageTitle(draft ? `${draft.title || 'Untitled form'} · PeraForm` : null)
  // Published forms are readable by anyone (respondents load them), so a
  // successful load doesn't mean this person may edit it.
  const loadError = error ?? (form && !form.memberIds.includes(user.uid) ? 'not-found' : null)

  if (loadError) {
    return (
      <div className="form-missing">
        <h1>{loadError === 'not-found' ? 'Form not found' : 'Couldn’t load this form'}</h1>
        <p>
          {loadError === 'not-found'
            ? 'It may have been deleted, or you don’t have access to it.'
            : 'Check your connection and try again.'}
        </p>
        <Link to="/" className="btn btn-primary">
          Back to my forms
        </Link>
      </div>
    )
  }

  const nav = [
    { to: `/forms/${formId}/edit`, label: 'Questions', icon: ListChecks },
    { to: `/forms/${formId}/responses`, label: 'Responses', icon: BarChart3 },
    { to: `/forms/${formId}/settings`, label: 'Settings', icon: Settings },
  ]

  return (
    <AppShell
      nav={nav}
      // The form's theme colours the whole editor, as in Google Forms.
      style={draft ? themeStyle(themeOf(draft), mode === 'dark', { font: false }) : undefined}
      center={form && draft ? <FormTitleField /> : null}
      actions={form && draft ? <BuilderActions /> : null}
    />
  )
}
