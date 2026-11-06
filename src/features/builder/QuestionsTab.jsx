import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { screenDesign, screenIssues, screensOf } from '../../lib/interview.js'
import InterviewEditor from '../interview/InterviewEditor.jsx'
import BuilderPage from './BuilderPage.jsx'
import { useFormEditor } from './editorContext.js'
import Spinner from '../../lib/Spinner.jsx'
import { useToast } from '../../lib/useToast.jsx'

// The Questions tab. Normal forms: the question list. Interview mode: the
// screen designer, with a switch back to the list to edit the questions
// themselves (they're shared by both modes). The line between them: words
// and rules live in Edit questions; looks and movement in Design screens.
// ?screen= keeps the screen being designed across the switch.
export default function QuestionsTab() {
  const { draft, notice } = useFormEditor()
  const [params, setParams] = useSearchParams()
  const [toast, showToast] = useToast(5000)

  // Designed screens followed a question-list edit (editorReducer): say so.
  useEffect(() => {
    if (!notice) return
    const [first] = notice.placed
    showToast(
      notice.placed.length === 1
        ? `Put “${first.title}” on screen ${first.screen} of your design. Ctrl+Z undoes it.`
        : `Put ${notice.placed.length} questions on their screens in your design. Ctrl+Z undoes it.`,
    )
  }, [notice, showToast])

  if (!draft) return <Spinner />
  if (draft.mode !== 'interview') return <BuilderPage />

  const view = params.get('view') === 'questions' ? 'questions' : 'design'
  const screenParam = params.get('screen')
  const go = (key) =>
    setParams({ ...(key !== 'design' && { view: key }), ...(screenParam && { screen: screenParam }) }, { replace: true })

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
        ['design', 'Design screens', 'How each screen looks and moves (Interview mode only)'],
        ['questions', 'Edit questions', 'The words and rules: questions, answers, sections, “Show only if” and where each section leads (shared by both modes)'],
      ].map(([key, label, hint]) => (
        <button
          key={key}
          type="button"
          role="tab"
          title={hint}
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
  const viewHint = (
    <p className="view-hint">
      {view === 'design'
        ? 'Looks and movement, for Interview mode. The words, answers and rules are in Edit questions.'
        : 'Words and rules, shared by Normal and Interview mode. How screens look is in Design screens.'}
    </p>
  )

  if (view === 'design')
    return (
      <>
        <InterviewEditor viewSwitch={viewSwitch} viewHint={viewHint} />
        {toast}
      </>
    )
  return (
    <>
      <div className="questions-switch">
        {viewSwitch}
        {viewHint}
      </div>
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
            . Most changes are followed for you, but not these. Nothing is broken: open Design screens and use the
            buttons there to place or fix them.
          </p>
          <button type="button" className="btn btn-outline" onClick={() => go('design')}>
            Go to Design screens
          </button>
        </div>
      )}
      <BuilderPage />
      {toast}
    </>
  )
}
