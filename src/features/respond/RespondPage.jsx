import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { doc, getDoc, getDocFromServer, serverTimestamp, setDoc } from 'firebase/firestore'
import { CheckCircle2, Moon, Sun, Timer } from 'lucide-react'
import { callFormGate, callSubmitResponse, db } from '../../lib/firebase.js'
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
import { needsSignIn, quizSettings, settingsOf, topBarTitle } from '../../lib/formModel.js'
import { applyClick, isHiddenNow, resolveActions, shownByActions } from '../../lib/actions.js'
import { frameOf, screenDesign, screensOf, visibleQuestionIds } from '../../lib/interview.js'
import { useViewportDevice } from '../../lib/useViewportDevice.js'
import { parsePrefill } from '../../lib/prefill.js'
import { shuffled } from '../../lib/shuffle.js'
import { loadThemeFont, themeOf, themeStyle } from '../../lib/theme.js'
import { validateAnswer } from '../../lib/validation.js'
import { useTheme } from '../../lib/useTheme.js'
import { ensureSignedIn } from '../auth/authActions.js'
import { isCreator, useAuth } from '../auth/useAuth.js'
import AccessGate from './AccessGate.jsx'
import PrefillBar from './PrefillBar.jsx'
import PrintView from './PrintView.jsx'
import ContentBlock from './ContentBlock.jsx'
import InterviewView from './InterviewView.jsx'
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
  // Invited-only form this person can't read: { key, state, title, email }.
  const [gate, setGate] = useState(null)
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
      .catch(async (err) => {
        if (cancelled) return
        if (err.code !== 'permission-denied') return setLoadError('failed')
        // Denied: a draft, a missing form, or an invited-only one. Ask why.
        try {
          const { data } = await callFormGate({ formId })
          if (cancelled) return
          if (data.state === 'missing') setLoadError('not-found')
          else setGate({ key: `${formId}:${uid}`, ...data })
        } catch {
          if (!cancelled) setLoadError('not-found')
        }
      })
    return () => {
      cancelled = true
    }
  }, [formId, authLoading, uid])
  // A gate only applies to the account it was checked for.
  const activeGate = gate?.key === `${formId}:${uid}` ? gate : null

  // ?embed=1: inside someone's website (no top bar or footer).
  // ?print=1: everything on one page, blank, ready to print.
  // ?mode=prefill: an editor answering questions to get a pre-filled link.
  const [modes] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return {
      embed: params.get('embed') === '1',
      print: params.get('print') === '1',
      prefill: params.get('mode') === 'prefill',
      search: window.location.search,
    }
  })

  if (form && modes.print) {
    return (
      <div className="respond themed respond-print" style={themeStyle(formTheme, false)}>
        <PrintView form={form} />
      </div>
    )
  }

  return (
    <div
      className={`respond themed${modes.embed ? ' respond-embed' : ''}`}
      style={form ? themeStyle(formTheme, mode === 'dark') : undefined}
    >
      {!modes.embed && (
        <RespondTopBar
          theme={mode}
          toggleTheme={toggleTheme}
          title={form ? topBarTitle(form) : null}
        />
      )}
      <main className="respond-main">
        {activeGate ? (
          <AccessGate gate={activeGate} formId={formId} />
        ) : loadError ? (
          <Notice title={loadError === 'not-found' ? 'Form not found' : 'Couldn’t load this form'}>
            {loadError === 'not-found'
              ? 'The link may be wrong, or the form isn’t published.'
              : 'Check your connection and refresh the page.'}
          </Notice>
        ) : !form ? (
          <div className="respond-skeleton" aria-busy="true" />
        ) : (
          <FormView
            form={form}
            user={user}
            initialAnswers={parsePrefill(form, modes.search)}
            prefillMode={modes.prefill && Boolean(user && form.memberIds.includes(user.uid))}
          />
        )}
      </main>
      <footer className="respond-foot">
        Made with{' '}
        <Link to="/" target={modes.embed ? '_blank' : undefined}>
          PeraForm
        </Link>
      </footer>
    </div>
  )
}

// title: the creator's own title (Settings → "Show a title at the top"),
// shown instead of the PeraForm logo.
function RespondTopBar({ theme, toggleTheme, title }) {
  return (
    <header className="respond-top">
      {title ? (
        <span className="logo respond-top-title">{title}</span>
      ) : (
        <span className="logo">
          <LogoMark />
          PeraForm
        </span>
      )}
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

//   initialAnswers: from a pre-filled link (lib/prefill.js)
//   prefillMode: an editor making a pre-filled link — nothing is required
//   or submitted; the bar at the top turns the answers into a link.
function FormView({ form, user, initialAnswers = {}, prefillMode = false }) {
  const formTheme = themeOf(form)
  const [answers, setAnswers] = useState(initialAnswers)
  // Interview mode: what button clicks have changed so far (lib/actions.js).
  const [clickState, setClickState] = useState({})
  const [errors, setErrors] = useState({}) // questionId → message
  // filling | sending | sent | already | late (timed quiz: arrived after the limit)
  const [state, setState] = useState('filling')
  const [error, setError] = useState('')
  // Sections are pages; history is the pages visited before this one, so
  // Back retraces skip logic and only visited pages' answers are submitted.
  const [pageIndex, setPageIndex] = useState(0)
  const [history, setHistory] = useState([])
  const pages = useMemo(() => splitPages(form.questions), [form.questions])
  // Interview mode: which design (phone/desktop) fits this screen.
  const device = useViewportDevice()
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
  // Interview mode: plays the screen's "before leaving" animations (set by
  // InterviewView), and whether that's in progress (ignore extra clicks).
  const leaveRef = useRef(null)
  const leavingRef = useRef(false)
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
    setClickState({})
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
        {state === 'sent' ? doneMessage : 'You’ve already responded to this form.'}
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
    // The rules refused the start: either it was already recorded (then
    // we resume from it) or this account may not take the quiz.
    let refused = false
    try {
      const respondent = await ensureSignedIn()
      const ref = doc(db, 'forms', form.id, 'starts', respondent.uid)
      try {
        await setDoc(ref, { startedAt: serverTimestamp() })
      } catch (err) {
        if (err.code !== 'permission-denied') throw err
        refused = true
      }
      const end = (await readStartTime(ref)) + quiz.timeLimit * 60_000
      if (end <= Date.now()) setState('late')
      else setDeadline(end)
    } catch {
      setError(
        refused
          ? 'This account can’t start the quiz. If it only accepts invited people, sign in with the address you were invited with.'
          : 'Couldn’t start the quiz. Check your connection and try again.',
      )
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
  // Normal forms: questions' actions show and hide other items; an item some
  // action can show starts hidden. Hidden questions aren't asked.
  const startsHidden = shownByActions(form.questions)
  const itemOverrides =
    form.mode === 'interview'
      ? {}
      : resolveActions({
          sources: questionsOnly(form.questions)
            .filter((q) => q.actions?.length)
            .map((q) => ({ actions: q.actions, questionId: q.id })),
          answers,
          baseHidden: (id) => startsHidden.has(id),
        })
  const itemHidden = (id) => isHiddenNow(id, itemOverrides, (x) => startsHidden.has(x))
  let pageItems = page.items.filter((item) => !itemHidden(item.id))
  if (shuffleQuestions) {
    const order = shuffled(
      page.questions.filter((q) => !itemHidden(q.id)),
      `page-${pageIndex}`,
    )
    let next = 0
    pageItems = pageItems.map((item) => (CONTENT_TYPES.includes(item.type) ? item : order[next++]))
  }
  const next = resolveTarget(pages, pageIndex, pageTarget(page, answers))
  const preview = form.status === 'draft'

  // Interview mode: each page is a designed screen, and only the questions
  // shown on it (on this device) are asked.
  const interview = form.mode === 'interview'
  const screens = interview ? screensOf(form) : null
  const design = interview ? screenDesign(form, screens[pageIndex], screens) : null
  // Blocks' state from actions: button clicks so far + answer conditions.
  const nodeHidden = (id) =>
    design?.nodes[id] ? (frameOf(design.nodes[id], device).hidden ?? false) : false
  const overrides = interview
    ? resolveActions({
        sources: Object.values(design.nodes)
          .filter((n) => n.actions?.length)
          .map((n) => ({
            actions: n.actions,
            questionId: n.type === 'question' ? n.questionId : null,
          })),
        answers,
        clickState,
        baseHidden: nodeHidden,
      })
    : null
  const shownIds = interview ? visibleQuestionIds(design, device, overrides) : null
  const asked = interview
    ? page.questions.filter((q) => shownIds.has(q.id))
    : page.questions.filter((q) => !itemHidden(q.id))

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
    if (prefillMode) return true // filling in only some answers is the point
    const found = {}
    for (const q of asked) {
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
    const first = asked.find((q) => found[q.id])
    if (!first) return true
    setErrors(found)
    document
      .getElementById(`q-${first.id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
    if (prefillMode) {
      setError('This is pre-fill mode: use “Get pre-filled link” at the top instead of submitting.')
      return
    }
    // Only pages the respondent actually saw — skipped sections don't count.
    const visited = new Set([...history, pageIndex])
    const clean = {}
    for (const i of visited) {
      for (const q of pages[i].questions) {
        // Hidden by an action now: its old answer doesn't count.
        if (!interview && itemHidden(q.id)) continue
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
      const { data } = await callSubmitResponse({
        formId: form.id,
        answers: clean,
      })
      setSentId(data.responseId)
      setState('sent')
    } catch (err) {
      const code = err.code?.replace('functions/', '')
      if (code === 'already-exists') return setState('already')
      if (code === 'deadline-exceeded') return setState('late')
      setState('filling')
      if (auto) {
        setError(
          'Time’s up, but your answers couldn’t be sent. Check your connection and press Submit.',
        )
        return
      }
      // Server errors carry a readable message (closed form, too many
      // submissions, sign-in needed…); network failures don't.
      const readable = [
        'failed-precondition',
        'resource-exhausted',
        'unauthenticated',
        'invalid-argument',
        'not-found',
        'permission-denied', // e.g. not on an invited-only form's list
      ]
      setError(
        readable.includes(code)
          ? err.message.replace(/\s*\[\d+\]$/, '') // the SDK appends the HTTP status
          : 'Couldn’t submit your response. Check your connection and try again.',
      )
    }
  }

  // The countdown's expiry calls the latest send (with this render's answers).
  // eslint-disable-next-line react-hooks/refs -- deliberate: kept current every render
  sendRef.current = send
  // "Running low": the last minute, or the last quarter of a short quiz.
  const lowAt = Math.min(60, quiz.timeLimit * 15)

  if (interview) {
    // Designed buttons drive navigation: next (following skip logic, and
    // submitting from the last screen), back, submit, or a chosen screen.
    // Leaving a screen: answers are checked first, then the screen's "before
    // leaving" animations play, then it changes.
    const leave = async (go) => {
      if (leavingRef.current) return
      leavingRef.current = true
      try {
        await leaveRef.current?.()
        go()
      } finally {
        leavingRef.current = false
      }
    }
    const finish = () => {
      if (preview) return setError('This is a preview. Publish the form to submit responses.')
      if (pageIsValid()) leave(() => send({ auto: false }))
    }
    const onButton = (action, node) => {
      if (state === 'sending' || leavingRef.current) return
      // The button's effects on other blocks first, then where it goes.
      if (node?.actions?.length) setClickState((cs) => applyClick(cs, node.actions, nodeHidden))
      if (action.type === 'none') return
      if (action.type === 'back') {
        if (history.length) leave(goBack)
      } else if (action.type === 'submit') {
        finish()
      } else if (action.type === 'goto') {
        const target = screens.findIndex((s) => s.key === action.screen)
        if (target < 0 || target === pageIndex || !pageIsValid()) return
        leave(() => {
          setHistory((h) => [...h, pageIndex])
          setPageIndex(target)
        })
      } else if (next === 'submit') {
        finish()
      } else if (pageIsValid()) {
        leave(goNext)
      }
    }
    return (
      <InterviewView
        key={pageIndex}
        design={design}
        device={device}
        questions={questionsOnly(form.questions)}
        renderQuestion={(q) => (
          <QuestionField
            question={q}
            formId={form.id}
            value={answers[q.id]}
            onChange={(value) => setAnswer(q.id, value)}
            error={errors[q.id]}
            points={quiz.enabled && quiz.showPoints && q.points > 0 ? q.points : null}
          />
        )}
        onButton={onButton}
        overrides={overrides}
        leaveRef={leaveRef}
        overlay={
          (prefillMode ||
            preview ||
            deadline ||
            error ||
            state === 'sending' ||
            (showProgressBar && pages.length > 1)) && (
            <div className="interview-overlay">
              {prefillMode && <PrefillBar form={form} answers={answers} />}
              {preview && !prefillMode && (
                <p className="respond-banner">
                  Preview — publish this form to start collecting responses.
                </p>
              )}
              {showProgressBar && pages.length > 1 && (
                <div
                  className="respond-progress"
                  role="progressbar"
                  aria-label="Progress"
                  aria-valuemin={1}
                  aria-valuemax={pages.length}
                  aria-valuenow={pageIndex + 1}
                >
                  <span
                    style={{
                      width: `${((pageIndex + 1) / pages.length) * 100}%`,
                    }}
                  />
                </div>
              )}
              {deadline && (
                <div
                  className={`quiz-timer${secondsLeft <= lowAt ? ' quiz-timer-low' : ''}`}
                  role="timer"
                >
                  <Timer size={16} />
                  <span>{formatClock(secondsLeft)}</span>
                  <span className="quiz-timer-label">left</span>
                </div>
              )}
              {state === 'sending' && <p className="respond-banner">Submitting…</p>}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
            </div>
          )
        }
      />
    )
  }

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
      {prefillMode && <PrefillBar form={form} answers={answers} />}
      {preview && !prefillMode && (
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
              {(collectEmails || form.settings?.restricted) && user?.email && (
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

      {pageItems.map((q) => {
        const block = CONTENT_TYPES.includes(q.type) ? (
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
        )
        // Revealed by an action: fades in (unless its action turned that off).
        const t = itemOverrides[q.id]?.transition
        return t && startsHidden.has(q.id) && t.display ? (
          <div
            key={q.id}
            className="respond-reveal"
            style={{
              animationDuration: `${t.duration}ms`,
              animationTimingFunction: t.easing,
            }}
          >
            {block}
          </div>
        ) : (
          block
        )
      })}

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
          {/* Pre-fill mode only makes a link; there's nothing to send. */}
          {next === 'submit' ? (
            !prefillMode && (
              <button
                key="submit"
                type="submit"
                className="btn btn-primary"
                disabled={preview || state === 'sending'}
              >
                {state === 'sending' ? 'Submitting…' : 'Submit'}
              </button>
            )
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
