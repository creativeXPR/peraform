import { AlertTriangle } from 'lucide-react'

// What's out of step on this screen after the question list changed
// (lib/interview.js → screenIssues), each said plainly — what happened,
// what respondents see meanwhile, what the button does — and that nothing
// was changed for the creator. Nothing happens unless they click.
//   onPlace(questions), onMoveThere(issue), onRemove(nodeId), onFixButton(issue)
const name = (q) => `“${q?.title || 'Untitled question'}”`

export default function ScreenIssues({ issues, questions, design, onPlace, onMoveThere, onRemove, onFixButton }) {
  if (!issues.length) return null
  return (
    <section className="ie-issues" aria-label="This screen needs your attention">
      <p className="ie-issues-head">
        <strong>This screen needs your attention.</strong> You changed the questions under Edit questions, and PeraForm
        doesn’t change your designs for you. Choose what to do below; until then the screen stays exactly as you left it.
      </p>
      {issues.map((issue) => {
        if (issue.kind === 'unplaced') {
          const n = issue.questions.length
          return (
            <div key="unplaced" className="ie-issue">
              <AlertTriangle size={16} aria-hidden="true" />
              <p>
                <strong>
                  {n === 1 ? `${name(issue.questions[0])} isn’t on this screen yet.` : `${n} questions aren’t on this screen yet:`}
                </strong>{' '}
                {n > 1 && `${issue.questions.map(name).join(', ')}. `}
                {n === 1 ? 'It’s' : 'They’re'} in this screen’s section, but respondents won’t be asked{' '}
                {n === 1 ? 'it' : 'them'} until {n === 1 ? 'it’s' : 'they’re'} placed here.{' '}
                <em>Place {n === 1 ? 'it' : 'them'}</em> adds {n === 1 ? 'it' : 'them'} to the main card, above the buttons;
                you can also add {n === 1 ? 'it' : 'them'} one by one from the list on the left.
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
                <strong>{name(q)} moved to the “{issue.to.title}” screen.</strong> Its block is still here, but respondents
                don’t see it on this screen any more. <em>Move it there</em> takes the block, with its look, to that
                screen; <em>Remove from here</em> deletes it from this screen (the question itself stays).
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
              {issue.want === 'submit' ? (
                <>
                  <strong>This is now the last screen, but “{label}” is set to go to a next screen.</strong> It still
                  works (respondents who press it submit, as there’s nothing after), but it’s clearer as a Submit button.
                </>
              ) : (
                <>
                  <strong>“{label}” submits the form, but other screens now come after this one.</strong> Respondents
                  who press it would finish here and skip them. If they should go on, make it a Next button; if ending
                  here is what you want, open the button and choose Submit under “When clicked”, and this goes away.
                </>
              )}
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
