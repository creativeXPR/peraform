import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  doc,
  getDoc,
  getDocFromServer,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { CheckCircle2, Moon, Sun, Timer } from 'lucide-react'
import { callSubmitResponse, db } from '../../lib/firebase.js'
import {
  CONTENT_TYPES,
  GRID_TYPES,
  hasAnswer,
  isComplete,
  pageTarget,
  questionsOnly,
  resolveTarget,
  splitPages,
} from '../../lib/formLogic.js'
import { needsSignIn, quizSettings, settingsOf } from '../../lib/formModel.js'
import { shuffled } from '../../lib/shuffle.js'
import { loadThemeFont, themeOf, themeStyle } from '../../lib/theme.js'
import { validateAnswer } from '../../lib/validation.js'
import { useTheme } from '../../lib/useTheme.js'
import { ensureSignedIn } from '../auth/authActions.js'
import { isCreator, useAuth } from '../auth/useAuth.js'
import ContentBlock from './ContentBlock.jsx'
import QuestionField from './QuestionField.jsx'
import QuizSubmitted from './QuizSubmitted.jsx'
import { formatClock, useCountdown } from './useCountdown.js'
import './RespondPage.css'
import LogoMark from '../../lib/LogoMark.jsx'

// The public form at /f/:formId. Anyone with the link can read a published
// form; members can also open drafts here as a preview.
export default function RespondPage() {
  const { formId } = useParams()
  const { user, loading: authLoading } = useAuth()
  const [form, setForm] = useState(null)
  const [loadError, setLoadError] = useState(null) // 'not-found' | 'failed'
  const { theme: mode, toggleTheme } = useTheme()
  const formTheme = themeOf(form)
  useEffect(() => loadThemeFont(formTheme.font), [formTheme.font])

  // Wait for auth first: whether a draft is visible depends on who's asking.
  const uid = user?.uid
  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    getDoc(doc(db, 'forms', formId))
      .then((snap) => {
        if (cancelled) return
        if (snap.exists()) setForm({ id: snap.id, ...snap.data() })
        else setLoadError('not-found')
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.code === 'permission-denied' ? 'not-found' : 'failed')
      })
    return () => {
      cancelled = true
    }
  }, [formId, authLoading, uid])

  return (
    <div className="respond themed" style={form ? themeStyle(formTheme, mode === 'dark') : undefined}>
      <RespondTopBar theme={mode} toggleTheme={toggleTheme} />
      <main className="respond-main">
        {loadError ? (
          <Notice title={loadError === 'not-found' ? 'Form not found' : 'Couldn’t load this form'}>
            {loadError === 'not-found'
              ? 'The link may be wrong, or the form isn’t published.'
              : 'Check your connection and refresh the page.'}
          </Notice>
        ) : !form ? (
          <div className="respond-skeleton" aria-busy="true" />
        ) : (
          <FormView form={form} user={user} />
        )}
      </main>
      <footer className="respond-foot">
        Made with <Link to="/">PeraForm</Link>
      </footer>
    </div>
  )
}

function RespondTopBar({ theme, toggleTheme }) {
  return (
    <header className="respond-top">
      <span className="logo"><LogoMark />PeraForm</span>
      <button
        type="button"
        className="icon-btn"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </header>
  )
}

function Notice({ title, children, icon }) {
  return (
    <section className="respond-card respond-notice">
      {icon}
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </section>
  )
}

// The server-recorded start of a timed quiz, in ms. Read from the server (a
// cached copy right after the write can still lack the server timestamp),
// retrying briefly on a slow connection.
async function readStartTime(ref) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const startedAt = (await getDocFromServer(ref)).data()?.startedAt
      if (startedAt) return startedAt.toMillis()
    } catch {
      // fall through to retry
    }
    await new Promise((r) => setTimeout(r, 600))
  }
  throw new Error('Could not read the quiz start time')
}

// Trim text; drop empty grid rows. Returns undefined for "no answer".
function cleanAnswer(question, value) {
  if (!hasAnswer(question, value)) return undefined
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value) || typeof value === 'number') return value
  // Grid: { rowIndex: value } with only the answered rows.
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => (Array.isArray(v) ? v.length : Boolean(v))),
  )
}

function FormView({ form, user }) {
  const formTheme = themeOf(form)
  const [answers, setAnswers] = useState({})
  const [errors, setErrors] = useState({}) // questionId → message
  // filling | sending | sent | already | late (timed quiz: arrived after the limit)
  const [state, setState] = useState('filling')
  const [error, setError] = useState('')
  // Sections are pages; history is the pages visited before this one, so
  // Back retraces skip logic and only visited pages' answers are submitted.
  const [pageIndex, setPageIndex] = useState(0)
  const [history, setHistory] = useState([])
  const pages = useMemo(() => splitPages(form.questions), [form.questions])
  const isMember = Boolean(user && form.memberIds.includes(user.uid))
  const {
    limitOneResponse,
    collectEmails,
    showProgressBar,
    shuffleQuestions,
    confirmationMessage,
    showSubmitAnother,
  } = settingsOf(form)
  const doneMessage = confirmationMessage.trim() || 'Your response has been recorded.'
  const title = form.title || 'Untitled form'
  const quiz = quizSettings(form)
  const timed = quiz.enabled && quiz.timeLimit > 0 && form.status === 'published'
  const [deadline, setDeadline] = useState(null) // ms; timed quizzes, once started
  const [starting, setStarting] = useState(false)
  const [sentId, setSentId] = useState(null)
  // When time runs out, submit whatever has been answered so far.
  const sendRef = useRef(null)
  const secondsLeft = useCountdown(deadline, () => sendRef.current?.({ auto: true }))

  // A timed quiz already started in this browser (e.g. after a reload):
  // pick the clock back up from the server-recorded start.
  const uid = user?.uid
  useEffect(() => {
    if (!timed || !uid) return
    let cancelled = false
    getDoc(doc(db, 'forms', form.id, 'starts', uid))
      .then((snap) => {
        if (cancelled || !snap.exists()) return
        const end = snap.data().startedAt.toMillis() + quiz.timeLimit * 60_000
        if (end <= Date.now()) setState('late')
        else setDeadline(end)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [timed, uid, form.id, quiz.timeLimit])

  // Each new page starts at the top.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pageIndex])

  function reset() {
    setAnswers({})
    setErrors({})
    setPageIndex(0)
    setHistory([])
  }

  if (form.status === 'closed') {
    return <Notice title={title}>This form is no longer accepting responses.</Notice>
  }
  if (form.status === 'draft' && !isMember) {
    return (
      <Notice title="Form not found">The link may be wrong, or the form isn’t published.</Notice>
    )
  }
  if (needsSignIn(form) && !isCreator(user)) {
    return (
      <section className="respond-card respond-notice">
        <h1>{title}</h1>
        <p>Sign in to fill out this form.</p>
        <Link
          to={`/signin?next=${encodeURIComponent(`/f/${form.id}`)}`}
          className="btn btn-primary"
        >
          Sign in
        </Link>
      </section>
    )
  }
  if (state === 'late') {
    return (
      <Notice title={title}>
        Time’s up. This quiz’s time limit has passed, so no more answers can be submitted.
      </Notice>
    )
  }
  if (state === 'sent' && quiz.enabled && sentId) {
    return <QuizSubmitted form={form} quiz={quiz} responseId={sentId} message={doneMessage} />
  }
  if (state === 'sent' || state === 'already') {
    return (
      <Notice title={title} icon={<CheckCircle2 size={36} className="respond-done-icon" />}>
        {state === 'sent'
          ? doneMessage
          : 'You’ve already responded to this form.'}
        {state === 'sent' && !limitOneResponse && showSubmitAnother && (
          <>
            <br />
            <button
              type="button"
              className="link-btn respond-again"
              onClick={() => {
                reset()
                setState('filling')
              }}
            >
              Submit another response
            </button>
          </>
        )}
      </Notice>
    )
  }

  async function startQuiz() {
    setStarting(true)
    setError('')
    try {
      const respondent = await ensureSignedIn()
      const ref = doc(db, 'forms', form.id, 'starts', respondent.uid)
      try {
        await setDoc(ref, { startedAt: serverTimestamp() })
      } catch (err) {
        // Already started earlier: the rules refuse a second start, which
        // is fine — we just resume from the first one.
        if (err.code !== 'permission-denied') throw err
      }
      const end = (await readStartTime(ref)) + quiz.timeLimit * 60_000
      if (end <= Date.now()) setState('late')
      else setDeadline(end)
    } catch {
      setError('Couldn’t start the quiz. Check your connection and try again.')
    } finally {
      setStarting(false)
    }
  }

  if (timed && !deadline) {
    return (
      <section className="respond-card respond-notice quiz-start">
        <Timer size={36} className="respond-done-icon" />
        <h1>{title}</h1>
        {form.description && <p className="respond-desc">{form.description}</p>}
        <p>
          This quiz has a <strong>{quiz.timeLimit}-minute</strong> time limit. The timer starts when
          you press Start and keeps running if you leave the page. When time runs out, your answers
          are submitted automatically.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="btn btn-primary" onClick={startQuiz} disabled={starting}>
          {starting ? 'Starting…' : 'Start quiz'}
        </button>
      </section>
    )
  }

  const page = pages[pageIndex]
  let pageItems = page.items
  if (shuffleQuestions) {
    const order = shuffled(page.questions, `page-${pageIndex}`)
    let next = 0
    pageItems = page.items.map((item) => (CONTENT_TYPES.includes(item.type) ? item : order[next++]))
  }
  const next = resolveTarget(pages, pageIndex, pageTarget(page, answers))
  const preview = form.status === 'draft'

  const setAnswer = (id, value) => {
    setAnswers((a) => ({ ...a, [id]: value }))
    if (errors[id]) {
      setErrors((e) => {
        const without = { ...e }
        delete without[id]
        return without
      })
    }
  }

  // Every question on this page must be complete (if required) and pass its
  // response validation before moving on.
  function pageIsValid() {
    const found = {}
    for (const q of page.questions) {
      const value = answers[q.id]
      if (q.required && !isComplete(q, value)) {
        found[q.id] = GRID_TYPES.includes(q.type)
          ? 'This question requires one response per row'
          : 'This is a required question'
      } else {
        const message = validateAnswer(q, value)
        if (message) found[q.id] = message
      }
    }
    const first = page.questions.find((q) => found[q.id])
    if (!first) return true
    setErrors(found)
    document.getElementById(`q-${first.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return false
  }

  function goNext() {
    if (!pageIsValid()) return
    setHistory((h) => [...h, pageIndex])
    setPageIndex(next)
  }

  function goBack() {
    setPageIndex(history[history.length - 1])
    setHistory((h) => h.slice(0, -1))
  }

  function submit(e) {
    e.preventDefault()
    if (next !== 'submit') return goNext() // Enter key on a non-final page
    if (!pageIsValid()) return
    send({ auto: false })
  }

  // auto: the timer ran out — send what's there, skipping required checks.
  async function send({ auto }) {
    if (state === 'sending' || state === 'sent') return
    // Only pages the respondent actually saw — skipped sections don't count.
    const visited = new Set([...history, pageIndex])
    const clean = {}
    for (const i of visited) {
      for (const q of pages[i].questions) {
        const value = cleanAnswer(q, answers[q.id])
        if (value !== undefined) clean[q.id] = value
      }
    }

    setState('sending')
    setError('')
    try {
      // Anonymous session if needed; the function checks everything else
      // (functions/index.js → submitResponse).
      await ensureSignedIn()
      const { data } = await callSubmitResponse({ formId: form.id, answers: clean })
      setSentId(data.responseId)
      setState('sent')
    } catch (err) {
      const code = err.code?.replace('functions/', '')
      if (code === 'already-exists') return setState('already')
      if (code === 'deadline-exceeded') return setState('late')
      setState('filling')
      if (auto) {
        setError('Time’s up, but your answers couldn’t be sent. Check your connection and press Submit.')
        return
      }
      // Server errors carry a readable message (closed form, too many
      // submissions, sign-in needed…); network failures don't.
      const readable = ['failed-precondition', 'resource-exhausted', 'unauthenticated', 'invalid-argument', 'not-found']
      setError(
        readable.includes(code)
          ? err.message.replace(/\s*\[\d+\]$/, '') // the SDK appends the HTTP status
          : 'Couldn’t submit your response. Check your connection and try again.',
      )
    }
  }

  sendRef.current = send
  // "Running low": the last minute, or the last quarter of a short quiz.
  const lowAt = Math.min(60, quiz.timeLimit * 15)

  return (
    <form className="respond-form" onSubmit={submit} noValidate>
      {showProgressBar && pages.length > 1 && (
        <div
          className="respond-progress"
          role="progressbar"
          aria-label="Progress"
          aria-valuemin={1}
          aria-valuemax={pages.length}
          aria-valuenow={pageIndex + 1}
        >
          <span style={{ width: `${((pageIndex + 1) / pages.length) * 100}%` }} />
        </div>
      )}
      {deadline && (
        <div className={`quiz-timer${secondsLeft <= lowAt ? ' quiz-timer-low' : ''}`} role="timer">
          <Timer size={16} />
          <span>{formatClock(secondsLeft)}</span>
          <span className="quiz-timer-label">left</span>
        </div>
      )}
      {preview && (
        <p className="respond-banner">Preview — publish this form to start collecting responses.</p>
      )}

      {formTheme.headerImage && (
        <img className="form-header-image" src={formTheme.headerImage.url} alt="" />
      )}
      <header className="respond-card respond-head">
        <h1>{title}</h1>
        {pageIndex === 0 && (
          <>
            {form.description && <p className="respond-desc">{form.description}</p>}
            <p className="respond-meta">
              {questionsOnly(form.questions).some((q) => q.required) && (
                <span>
                  <span className="q-required">*</span> Required
                </span>
              )}
              {limitOneResponse && <span>You can respond only once.</span>}
              {collectEmails && user?.email && (
                <span>
                  Your email (<strong>{user.email}</strong>) will be recorded when you submit.
                </span>
              )}
            </p>
          </>
        )}
      </header>

      {page.section && (
        <section className="respond-card respond-section">
          <h2>{page.section.title || 'Untitled section'}</h2>
          {page.section.description && <p className="respond-desc">{page.section.description}</p>}
        </section>
      )}

      {pageItems.map((q) =>
        CONTENT_TYPES.includes(q.type) ? (
          <ContentBlock key={q.id} item={q} />
        ) : (
          <QuestionField
            key={q.id}
            question={q}
            formId={form.id}
            value={answers[q.id]}
            onChange={(value) => setAnswer(q.id, value)}
            error={errors[q.id]}
            points={quiz.enabled && quiz.showPoints && q.points > 0 ? q.points : null}
          />
        ),
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="respond-actions">
        <div className="respond-nav">
          {history.length > 0 && (
            <button type="button" className="btn btn-outline" onClick={goBack}>
              Back
            </button>
          )}
          {/* Distinct keys: if React reused one <button> and flipped its type
              to "submit" mid-click, clicking Next on the second-to-last page
              would submit the form straight away. */}
          {next === 'submit' ? (
            <button
              key="submit"
              type="submit"
              className="btn btn-primary"
              disabled={preview || state === 'sending'}
            >
              {state === 'sending' ? 'Submitting…' : 'Submit'}
            </button>
          ) : (
            <button
              key="next"
              type="button"
              className="btn btn-primary"
              onClick={(e) => {
                e.preventDefault()
                goNext()
              }}
            >
              Next
            </button>
          )}
        </div>
        {pages.length > 1 && (
          <span className="respond-page">
            Page {pageIndex + 1} of {pages.length}
          </span>
        )}
        <button type="button" className="link-btn" onClick={reset}>
          Clear form
        </button>
      </div>
    </form>
  )
}
