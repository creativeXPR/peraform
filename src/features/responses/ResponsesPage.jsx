import { useState } from 'react'
import { deleteDoc, doc } from 'firebase/firestore'
import { ChevronLeft, ChevronRight, Download, MoreVertical, Trash2 } from 'lucide-react'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import { db } from '../../lib/firebase.js'
import { GRID_TYPES, hasAnswer, isSection, questionsOnly } from '../../lib/formLogic.js'
import MenuButton from '../../lib/MenuButton.jsx'
import { useToast } from '../../lib/useToast.jsx'
import { useFormEditor } from '../builder/editorContext.js'
import { deleteAllResponses } from '../dashboard/formActions.js'
import BarList from './BarList.jsx'
import { downloadCsv, responsesToCsv, summarizeQuestion } from './summarize.js'
import { useResponses } from './useResponses.js'
import './ResponsesPage.css'

const TEXT_PREVIEW = 5

// Responses tab: count + accepting toggle, then Summary (a chart or answer
// list per question) or Individual (one response at a time).
export default function ResponsesPage() {
  const { form, draft, setStatus } = useFormEditor()
  const { responses, loading, error } = useResponses(form?.id)
  const [view, setView] = useState('summary')
  const [index, setIndex] = useState(0)
  const [confirm, setConfirm] = useState(null) // { kind: 'all' } | { kind: 'one', id }
  const [busy, setBusy] = useState(false)
  const [toast, showToast] = useToast()

  if (!form || !draft) return <div className="builder-loading" aria-busy="true" />

  const items = draft.questions // questions and section breaks
  const title = draft.title || 'Untitled form'
  const count = responses.length
  const current = responses[Math.min(index, count - 1)]

  async function toggleAccepting(accepting) {
    try {
      await setStatus(accepting ? 'published' : 'closed')
    } catch {
      showToast('Couldn’t update the form. Please try again.')
    }
  }

  async function onConfirm() {
    setBusy(true)
    try {
      if (confirm.kind === 'all') {
        await deleteAllResponses(form.id)
        setIndex(0)
        showToast('All responses deleted')
      } else {
        await deleteDoc(doc(db, 'forms', form.id, 'responses', confirm.id))
        setIndex((i) => Math.max(0, Math.min(i, count - 2)))
        showToast('Response deleted')
      }
    } catch {
      showToast('Couldn’t delete. Please try again.')
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  return (
    <div className="responses">
      <header className="responses-head">
        <h1>{loading ? 'Responses' : `${count} ${count === 1 ? 'response' : 'responses'}`}</h1>
        <div className="responses-tools">
          {form.status !== 'draft' && (
            <label className="switch">
              <span>Accepting responses</span>
              <input
                type="checkbox"
                role="switch"
                checked={form.status === 'published'}
                onChange={(e) => toggleAccepting(e.target.checked)}
              />
            </label>
          )}
          <MenuButton
            icon={<MoreVertical size={18} />}
            label="Response actions"
            items={[
              {
                label: 'Download CSV',
                icon: Download,
                onSelect: () =>
                  count
                    ? downloadCsv(`${title} responses.csv`, responsesToCsv(questionsOnly(items), responses))
                    : showToast('No responses to download yet'),
              },
              {
                label: 'Delete all responses',
                icon: Trash2,
                danger: true,
                onSelect: () =>
                  count ? setConfirm({ kind: 'all' }) : showToast('No responses to delete'),
              },
            ]}
          />
        </div>
      </header>

      {loading ? (
        <div className="builder-loading" aria-busy="true" />
      ) : error ? (
        <p className="form-error" role="alert">
          Couldn’t load responses. Check your connection and refresh.
        </p>
      ) : count === 0 ? (
        <section className="responses-empty">
          <h2>Waiting for responses</h2>
          <p>
            {form.status === 'draft'
              ? 'Publish your form, then share its link to start collecting responses.'
              : 'Share your form’s link — responses will show up here as they come in.'}
          </p>
        </section>
      ) : (
        <>
          <div className="segmented" role="tablist" aria-label="Response view">
            {['summary', 'individual'].map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                className={view === v ? 'active' : ''}
                onClick={() => setView(v)}
              >
                {v === 'summary' ? 'Summary' : 'Individual'}
              </button>
            ))}
          </div>

          {view === 'summary' ? (
            items.map((item) => <SummaryItem key={item.id} item={item} responses={responses} />)
          ) : (
            <>
              <div className="pager">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  disabled={index === 0}
                  aria-label="Newer response"
                >
                  <ChevronLeft size={18} />
                </button>
                <span>
                  {Math.min(index, count - 1) + 1} of {count}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setIndex((i) => Math.min(count - 1, i + 1))}
                  disabled={index >= count - 1}
                  aria-label="Older response"
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  type="button"
                  className="icon-btn pager-delete"
                  onClick={() => setConfirm({ kind: 'one', id: current.id })}
                  aria-label="Delete this response"
                  title="Delete this response"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <IndividualResponse response={current} questions={items} />
            </>
          )}
        </>
      )}

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.kind === 'all' ? 'Delete all responses?' : 'Delete this response?'}
        message={
          confirm?.kind === 'all'
            ? `All ${count} responses will be permanently deleted. This can’t be undone.`
            : 'This response will be permanently deleted. This can’t be undone.'
        }
        busy={busy}
        onConfirm={onConfirm}
        onCancel={() => setConfirm(null)}
      />
      {toast}
    </div>
  )
}

// Section breaks show as dividers between their questions' summaries.
function SummaryItem({ item, responses }) {
  if (isSection(item)) {
    return <h2 className="summary-section">{item.title || 'Untitled section'}</h2>
  }
  return <QuestionSummary question={item} responses={responses} />
}

function QuestionSummary({ question, responses }) {
  const [expanded, setExpanded] = useState(false)
  const summary = summarizeQuestion(question, responses)
  const shown = expanded ? summary.values : summary.values?.slice(0, TEXT_PREVIEW)
  const multi = question.type === 'checkboxes' || question.type === 'checkboxGrid'

  return (
    <section className="summary-card">
      <h2>{question.title || 'Untitled question'}</h2>
      <p className="summary-count">
        {summary.answered} {summary.answered === 1 ? 'response' : 'responses'}
        {multi && summary.answered > 0 && ' · people could pick several'}
        {summary.kind === 'scale' && summary.answered > 0 && (
          <>
            {' · '}average <strong>{summary.average.toFixed(1)}</strong>
            {question.type === 'rating' && ` of ${question.max}`}
          </>
        )}
      </p>
      {summary.answered === 0 ? (
        <p className="summary-none">No answers yet.</p>
      ) : summary.kind === 'choice' || summary.kind === 'scale' ? (
        <BarList rows={summary.rows} total={summary.answered} />
      ) : summary.kind === 'grid' ? (
        <GridSummary summary={summary} />
      ) : (
        <>
          <ul className="summary-texts">
            {shown.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
          {summary.values.length > TEXT_PREVIEW && (
            <button type="button" className="link-btn" onClick={() => setExpanded((e) => !e)}>
              {expanded ? 'Show fewer' : `Show all ${summary.values.length}`}
            </button>
          )}
        </>
      )}
    </section>
  )
}

// Counts per row × column. Cell tint scales with the count (one hue,
// light → strong) and every cell also prints its number, so the tint is
// never the only signal.
function GridSummary({ summary }) {
  const max = Math.max(1, ...summary.rows.flatMap((r) => r.counts))
  return (
    <div className="grid-wrap">
      <table className="grid-summary">
        <thead>
          <tr>
            <td />
            {summary.columns.map((c, j) => (
              <th key={j} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {summary.rows.map((row, i) => (
            <tr key={i}>
              <th scope="row">{row.label}</th>
              {row.counts.map((n, j) => (
                <td
                  key={j}
                  title={`${row.label} — ${summary.columns[j]}: ${n}`}
                  style={{ '--heat': `${Math.round((n / max) * 32)}%` }}
                >
                  {n}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatAnswer(question, value) {
  if (GRID_TYPES.includes(question.type)) {
    return question.rows
      .map((row, i) => [row, value[i]])
      .filter(([, v]) => v !== undefined && !(Array.isArray(v) && !v.length))
      .map(([row, v]) => `${row}: ${[v].flat().join(', ')}`)
      .join('\n')
  }
  if (question.type === 'rating') return `${value} of ${question.max}`
  return Array.isArray(value) ? value.join(', ') : String(value)
}

function IndividualResponse({ response, questions }) {
  return (
    <section className="summary-card individual">
      <p className="summary-count">
        Submitted{' '}
        {response.submittedAt
          ? response.submittedAt.toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })
          : 'just now'}
      </p>
      {questions.map((q) => {
        if (isSection(q)) {
          return (
            <h3 key={q.id} className="individual-section">
              {q.title || 'Untitled section'}
            </h3>
          )
        }
        const value = response.answers?.[q.id]
        const empty = !hasAnswer(q, value)
        return (
          <div key={q.id} className="individual-row">
            <p className="individual-q">{q.title || 'Untitled question'}</p>
            <p className={empty ? 'individual-a muted' : 'individual-a'}>
              {empty ? 'No answer' : formatAnswer(q, value)}
            </p>
          </div>
        )
      })}
    </section>
  )
}
