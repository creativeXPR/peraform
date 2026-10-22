import { useSearchParams } from 'react-router-dom'
import InterviewEditor from '../interview/InterviewEditor.jsx'
import BuilderPage from './BuilderPage.jsx'
import { useFormEditor } from './editorContext.js'

// The Questions tab. Normal forms: the question list. Interview mode: the
// screen designer, with a switch back to the list to edit the questions
// themselves (they're shared by both modes).
export default function QuestionsTab() {
  const { draft } = useFormEditor()
  const [params, setParams] = useSearchParams()
  if (!draft) return <div className="builder-loading" aria-busy="true" />
  if (draft.mode !== 'interview') return <BuilderPage />

  const view = params.get('view') === 'questions' ? 'questions' : 'design'
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
          onClick={() => setParams(key === 'design' ? {} : { view: key }, { replace: true })}
        >
          {label}
        </button>
      ))}
    </div>
  )

  return view === 'design' ? (
    <InterviewEditor viewSwitch={viewSwitch} />
  ) : (
    <>
      <div className="questions-switch">{viewSwitch}</div>
      <BuilderPage />
    </>
  )
}
