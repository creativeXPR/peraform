import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { collection, doc, getDoc, setDoc } from 'firebase/firestore'
import { CheckCircle2, Moon, Sun } from 'lucide-react'
import { db } from '../../lib/firebase.js'
import {
  GRID_TYPES,
  hasAnswer,
  isComplete,
  pageTarget,
  questionsOnly,
  resolveTarget,
  splitPages,
} from '../../lib/formLogic.js'
import { newResponse } from '../../lib/formModel.js'
import { validateAnswer } from '../../lib/validation.js'
import { useTheme } from '../../lib/useTheme.js'
import { ensureSignedIn } from '../auth/authActions.js'
import { isCreator, useAuth } from '../auth/useAuth.js'
import QuestionField from './QuestionField.jsx'
import './RespondPage.css'

// The public form at /f/:formId. Anyone with the link can read a published
// form; members can also open drafts here as a preview.
export default function RespondPage() {
  const { formId } = useParams()
  const { user, loading: authLoading } = useAuth()
  const [form, setForm] = useState(null)
  const [loadError, setLoadError] = useState(null) // 'not-found' | 'failed'

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
    <div className="respond">
      <RespondTopBar />
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

function RespondTopBar() {
  const { theme, toggleTheme } = useTheme()
  return (
    <header className="respond-top">
      <span className="logo">PeraForm</span>
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
  const [answers, setAnswers] = useState({})
  const [errors, setErrors] = useState({}) // questionId → message
  const [state, setState] = useState('filling') // filling | sending | sent | already
  const [error, setError] = useState('')
  // Sections are pages; history is the pages visited before this one, so
  // Back retraces skip logic and only visited pages' answers are submitted.
  const [pageIndex, setPageIndex] = useState(0)
  const [history, setHistory] = useState([])
  const pages = useMemo(() => splitPages(form.questions), [form.questions])
  const isMember = Boolean(user && form.memberIds.includes(user.uid))
  const { requireSignIn, limitOneResponse } = form.settings
  const title = form.title || 'Untitled form'

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
  if (requireSignIn && !isCreator(user)) {
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
  if (state === 'sent' || state === 'already') {
    return (
      <Notice title={title} icon={<CheckCircle2 size={36} className="respond-done-icon" />}>
        {state === 'sent'
          ? 'Your response has been recorded.'
          : 'You’ve already responded to this form.'}
        {state === 'sent' && !limitOneResponse && (
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

  const page = pages[pageIndex]
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

  async function submit(e) {
    e.preventDefault()
    if (next !== 'submit') return goNext() // Enter key on a non-final page
    if (!pageIsValid()) return

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
      const respondent = await ensureSignedIn()
      const responses = collection(db, 'forms', form.id, 'responses')
      // One-per-person: the response id is the respondent's uid, so a second
      // submission is rejected by the rules (see firestore.rules).
      const ref = limitOneResponse ? doc(responses, respondent.uid) : doc(responses)
      await setDoc(ref, newResponse(respondent.uid, clean))
      setState('sent')
    } catch (err) {
      if (err.code === 'permission-denied' && limitOneResponse) {
        setState('already')
        return
      }
      setState('filling')
      setError(
        err.code === 'permission-denied'
          ? 'This form isn’t accepting responses right now.'
          : 'Couldn’t submit your response. Check your connection and try again.',
      )
    }
  }

  return (
    <form className="respond-form" onSubmit={submit} noValidate>
      {preview && (
        <p className="respond-banner">Preview — publish this form to start collecting responses.</p>
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

      {page.questions.map((q) => (
        <QuestionField
          key={q.id}
          question={q}
          value={answers[q.id]}
          onChange={(value) => setAnswer(q.id, value)}
          error={errors[q.id]}
        />
      ))}

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
