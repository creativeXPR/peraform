import { useSearchParams } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { screenDesign, screenIssues, screensOf } from '../../lib/interview.js'
import InterviewEditor from '../interview/InterviewEditor.jsx'
import BuilderPage from './BuilderPage.jsx'
import { useFormEditor } from './editorContext.js'
import Spinner from '../../lib/Spinner.jsx'

// The Questions tab. Normal forms: the question list. Interview mode: the
// screen designer, with a switch back to the list to edit the questions
// themselves (they're shared by both modes).
export default function QuestionsTab() {
  const { draft } = useFormEditor()
  const [params, setParams] = useSearchParams()
  if (!draft) return <Spinner />
  if (draft.mode !== 'interview') return <BuilderPage />

  const view = params.get('view') === 'questions' ? 'questions' : 'design'
  const go = (key) => setParams(key === 'design' ? {} : { view: key }, { replace: true })

  // Screens out of step with the question list (never fixed by themselves:
  // see lib/interview.js → screenIssues). Counted on the Design tab, and
  // explained here, where the change usually starts.
  const screens = screensOf(draft)
  const all = screens.flatMap((s) => screenIssues(draft, s, screenDesign(draft, s, screens), screens))
  const unplaced = all.filter((i) => i.kind === 'unplaced').reduce((n, i) => n + i.questions.length, 0)
  const moved = all.filter((i) => i.kind === 'moved').length
  const buttons = all.filter((i) => i.kind === 'button').length

  const viewSwitch = (
    <div className="segmented" role="tablist" aria-label="Questions view">
      {[
        ['design', 'Design screens'],
        ['questions', 'Edit questions'],
      ].map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={view === key}
          className={view === key ? 'active' : ''}
          onClick={() => go(key)}
        >
          {label}
          {key === 'design' && all.length > 0 && (
            <span className="tab-issues" title={`${all.length} thing${all.length > 1 ? 's' : ''} need your attention`}>
              {all.length}
            </span>
          )}
        </button>
      ))}
    </div>
  )

  if (view === 'design') return <InterviewEditor viewSwitch={viewSwitch} />
  return (
    <>
      <div className="questions-switch">{viewSwitch}</div>
      {all.length > 0 && (
        <div className="ie-issue questions-issues" role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          <p>
            <strong>Your design screens haven’t been updated for these changes yet.</strong>{' '}
            {[
              unplaced &&
                `${unplaced} question${unplaced > 1 ? 's aren’t' : ' isn’t'} on a screen, so respondents won’t be asked ${unplaced > 1 ? 'them' : 'it'} yet`,
              moved && `${moved} block${moved > 1 ? 's show questions' : ' shows a question'} you moved to another section`,
              buttons && `${buttons} Next/Submit button${buttons > 1 ? 's no longer match' : ' no longer matches'} the screen order`,
            ]
              .filter(Boolean)
              .join('; ')}
            . PeraForm doesn’t change your designs for you, so nothing is broken: open Design screens and use the buttons
            there to place or fix them.
          </p>
          <button type="button" className="btn btn-outline" onClick={() => go('design')}>
            Go to Design screens
          </button>
        </div>
      )}
      <BuilderPage />
    </>
  )
}
