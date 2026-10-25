import { AlertTriangle } from 'lucide-react'

// What's out of step on this screen after the question list changed
// (lib/interview.js → screenIssues), each with the button that fixes it.
// Nothing here happens unless the creator clicks.
//   onPlace(questions), onMoveThere(issue), onRemove(nodeId), onFixButton(issue)
const name = (q) => `“${q?.title || 'Untitled question'}”`

export default function ScreenIssues({ issues, questions, design, onPlace, onMoveThere, onRemove, onFixButton }) {
  if (!issues.length) return null
  return (
    <section className="ie-issues" aria-label="Needs your attention">
      {issues.map((issue) => {
        if (issue.kind === 'unplaced') {
          const n = issue.questions.length
          return (
            <div key="unplaced" className="ie-issue">
              <AlertTriangle size={16} aria-hidden="true" />
              <p>
                {n === 1 ? `${name(issue.questions[0])} is` : `${n} questions (${issue.questions.map(name).join(', ')}) are`} in
                this section but not on this screen, so respondents won’t be asked {n === 1 ? 'it' : 'them'}.
              </p>
              <button type="button" className="btn btn-outline" onClick={() => onPlace(issue.questions)}>
                Place {n === 1 ? 'it' : 'them'}
              </button>
            </div>
          )
        }
        if (issue.kind === 'moved') {
          const q = questions.find((x) => x.id === issue.questionId)
          return (
            <div key={issue.nodeId} className="ie-issue">
              <AlertTriangle size={16} aria-hidden="true" />
              <p>
                {name(q)} now belongs to “{issue.to.title}”, so it isn’t shown on this screen.
              </p>
              <button type="button" className="btn btn-outline" onClick={() => onMoveThere(issue)}>
                Move it there
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => onRemove(issue.nodeId)}>
                Remove from here
              </button>
            </div>
          )
        }
        const label = design.nodes[issue.nodeId]?.label || 'Button'
        return (
          <div key={issue.nodeId} className="ie-issue">
            <AlertTriangle size={16} aria-hidden="true" />
            <p>
              {issue.want === 'submit'
                ? `This is now the last screen, but “${label}” goes to a next screen.`
                : `“${label}” submits the form, but screens now come after this one.`}
            </p>
            <button type="button" className="btn btn-outline" onClick={() => onFixButton(issue)}>
              {issue.want === 'submit' ? 'Make it Submit' : 'Make it Next'}
            </button>
          </div>
        )
      })}
    </section>
  )
}
