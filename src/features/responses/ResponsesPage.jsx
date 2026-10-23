import { useState } from 'react'
import {
  arrayRemove,
  arrayUnion,
  deleteDoc,
  doc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import {
  BadgeCheck,
  Bell,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Download,
  FileText,
  MoreVertical,
  Sheet,
  Trash2,
} from 'lucide-react'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import { useSheetsStatus } from '../../lib/googleSheets.js'
import { db } from '../../lib/firebase.js'
import { formatAnswer } from '../../lib/formatAnswer.js'
import { hasAnswer, isQuestion, isSection, questionsOnly } from '../../lib/formLogic.js'
import { formatBytes } from '../../lib/upload.js'
import { quizSettings } from '../../lib/formModel.js'
import MenuButton from '../../lib/MenuButton.jsx'
import { useToast } from '../../lib/useToast.jsx'
import { useAuth } from '../auth/useAuth.js'
import { useFormEditor } from '../builder/editorContext.js'
import { deleteAllResponses } from '../dashboard/formActions.js'
import BarList from './BarList.jsx'
import InviteTracker from './InviteTracker.jsx'
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
  const { user } = useAuth()
  const sheets = useSheetsStatus(form?.id) // linked Google Sheet, if any

  if (!form || !draft) return <div className="builder-loading" aria-busy="true" />

  const items = draft.questions // questions and section breaks
  const title = draft.title || 'Untitled form'
  const count = responses.length
  const current = responses[Math.min(index, count - 1)]
  const quiz = quizSettings(draft)
  const graded = responses.filter((r) => r.gradedAt)
  const unreleased = graded.filter((r) => !r.released)

  // Each member opts in for themselves (the rules only allow changing your
  // own uid in notify).
  const notifying = Boolean(form?.notify?.includes(user.uid))
  async function toggleNotify() {
    try {
      await updateDoc(doc(db, 'forms', form.id), {
        notify: notifying ? arrayRemove(user.uid) : arrayUnion(user.uid),
      })
      showToast(notifying ? 'Email notifications off' : 'You’ll get an email for each new response')
    } catch {
      showToast('Couldn’t change notifications. Please try again.')
    }
  }

  async function releaseAll() {
    if (!unreleased.length) return showToast('Every graded score is already released')
    try {
      for (let i = 0; i < unreleased.length; i += 500) {
        const batch = writeBatch(db)
        for (const r of unreleased.slice(i, i + 500)) {
          batch.update(doc(db, 'forms', form.id, 'responses', r.id), { released: true })
        }
        await batch.commit()
      }
      showToast(`Released ${unreleased.length} ${unreleased.length === 1 ? 'score' : 'scores'}`)
    } catch {
      showToast('Couldn’t release scores. Please try again.')
    }
  }

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
          {sheets?.url && (
            <a className="btn btn-outline sheets-open" href={sheets.url} target="_blank" rel="noreferrer">
              <Sheet size={15} />
              Open in Sheets
            </a>
          )}
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
                label: 'Email me new responses',
                icon: Bell,
                checked: notifying,
                onSelect: toggleNotify,
              },
              ...(quiz.enabled
                ? [{ label: 'Release all scores', icon: BadgeCheck, onSelect: releaseAll }]
                : []),
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

      {draft.settings?.restricted && !loading && !error && (
        <InviteTracker formId={form.id} responses={responses} showToast={showToast} />
      )}

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
            <>
              {quiz.enabled && <QuizOverview responses={graded} />}
              {items.map((item) => (
                <SummaryItem key={item.id} item={item} responses={responses} quiz={quiz.enabled} />
              ))}
            </>
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
              <IndividualResponse
                key={current.id}
                response={current}
                questions={items}
                formId={form.id}
                quiz={quiz.enabled}
                answerKey={draft.answerKey ?? {}}
                showToast={showToast}
              />
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
// Quiz averages across graded responses.
function QuizOverview({ responses }) {
  if (!responses.length) return null
  const max = responses[0].maxScore ?? 0
  const avg = responses.reduce((sum, r) => sum + (r.score ?? 0), 0) / responses.length
  const scores = responses.map((r) => r.score ?? 0)
  return (
    <section className="summary-card quiz-overview">
      <h2>Quiz insights</h2>
      <div className="quiz-stats">
        <Stat label="Average" value={`${avg.toFixed(1)} / ${max}`} />
        <Stat label="Median" value={`${median(scores)} / ${max}`} />
        <Stat label="Range" value={`${Math.min(...scores)} – ${Math.max(...scores)}`} />
        <Stat label="Graded" value={responses.length} />
      </div>
    </section>
  )
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const m = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  return Number.isInteger(m) ? m : m.toFixed(1)
}

function Stat({ label, value }) {
  return (
    <div className="quiz-stat">
      <span className="quiz-stat-value">{value}</span>
      <span className="quiz-stat-label">{label}</span>
    </div>
  )
}

function SummaryItem({ item, responses, quiz }) {
  if (isSection(item)) {
    return <h2 className="summary-section">{item.title || 'Untitled section'}</h2>
  }
  if (!isQuestion(item)) return null // title, image and video blocks
  return <QuestionSummary question={item} responses={responses} quiz={quiz} />
}

function QuestionSummary({ question, responses, quiz }) {
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
        {quiz && question.points > 0 && <CorrectCount question={question} responses={responses} />}
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
      ) : summary.kind === 'files' ? (
        <>
          <FileList files={expanded ? summary.files : summary.files.slice(0, TEXT_PREVIEW)} />
          {summary.files.length > TEXT_PREVIEW && (
            <button type="button" className="link-btn" onClick={() => setExpanded((e) => !e)}>
              {expanded ? 'Show fewer' : `Show all ${summary.files.length} files`}
            </button>
          )}
        </>
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

// Uploaded files as download links (the URLs carry access tokens, and only
// form members can read responses).
function FileList({ files }) {
  return (
    <ul className="file-list">
      {files.map((f) => (
        <li key={f.path}>
          <a href={f.url} target="_blank" rel="noopener noreferrer">
            <FileText size={15} />
            {f.name}
          </a>
          <span>{formatBytes(f.size)}</span>
        </li>
      ))}
    </ul>
  )
}

// How many graded responses earned full points on this question.
function CorrectCount({ question, responses }) {
  const graded = responses.filter((r) => r.points && question.id in r.points)
  if (!graded.length) return null
  const full = graded.filter((r) => r.points[question.id] >= question.points).length
  return ` · ${full} of ${graded.length} got full points`
}

function IndividualResponse({ response, questions, formId, quiz, answerKey, showToast }) {
  const ref = doc(db, 'forms', formId, 'responses', response.id)
  const graded = quiz && response.gradedAt

  // Creators can override any question's points; the score follows.
  async function setPoints(questionId, value) {
    const points = { ...response.points, [questionId]: value }
    const score = Object.values(points).reduce((sum, n) => sum + (Number(n) || 0), 0)
    try {
      await updateDoc(ref, { points, score })
    } catch {
      showToast('Couldn’t save the points. Please try again.')
    }
  }

  async function release() {
    try {
      await updateDoc(ref, { released: true })
      showToast('Score released')
    } catch {
      showToast('Couldn’t release the score. Please try again.')
    }
  }

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
        {response.respondentEmail && (
          <>
            {' · '}
            <strong className="individual-email">{response.respondentEmail}</strong>
          </>
        )}
      </p>
      {quiz && (
        <div className="individual-score">
          {graded ? (
            <>
              <span className="individual-score-value">
                {response.score} <span>/ {response.maxScore}</span>
              </span>
              {response.released ? (
                <span className="released-chip">
                  <BadgeCheck size={14} /> Released
                </span>
              ) : (
                <button type="button" className="btn btn-primary release-btn" onClick={release}>
                  Release score
                </button>
              )}
            </>
          ) : (
            <span className="muted">Grading…</span>
          )}
        </div>
      )}
      {questions.map((q) => {
        if (isSection(q)) {
          return (
            <h3 key={q.id} className="individual-section">
              {q.title || 'Untitled section'}
            </h3>
          )
        }
        if (!isQuestion(q)) return null
        const value = response.answers?.[q.id]
        const empty = !hasAnswer(q, value)
        const max = q.points ?? 0
        const awarded = response.points?.[q.id]
        const keyed = answerKey[q.id]?.correct?.some((c) => String(c).trim())
        const status = graded && keyed && max > 0 ? (awarded >= max ? 'right' : 'wrong') : null
        return (
          <div key={q.id} className="individual-row">
            <div className="individual-q-row">
              <p className="individual-q">{q.title || 'Untitled question'}</p>
              {graded && max > 0 && (
                <label className="points-input">
                  <input
                    type="number"
                    min={0}
                    max={max}
                    defaultValue={awarded ?? 0}
                    aria-label={`Points for ${q.title || 'this question'}`}
                    onBlur={(e) => {
                      const n = Math.min(max, Math.max(0, Math.round(Number(e.target.value)) || 0))
                      e.target.value = n
                      if (n !== awarded) setPoints(q.id, n)
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  />
                  / {max}
                </label>
              )}
            </div>
            <p className={empty ? 'individual-a muted' : `individual-a${status ? ` is-${status}` : ''}`}>
              {status === 'right' && <CircleCheck size={15} aria-label="Correct" />}
              {status === 'wrong' && <CircleX size={15} aria-label="Incorrect" />}
              {!empty && q.type === 'fileUpload' ? (
                <FileList files={value} />
              ) : (
                <span>{empty ? 'No answer' : formatAnswer(q, value)}</span>
              )}
            </p>
            {status === 'wrong' && (
              <p className="individual-key">Answer key: {answerKey[q.id].correct.join(', ')}</p>
            )}
          </div>
        )
      })}
    </section>
  )
}
