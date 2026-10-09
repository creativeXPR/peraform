import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { collection, doc, getDoc, setDoc } from 'firebase/firestore'
import { CheckCircle2, Moon, Sun } from 'lucide-react'
import AutoTextarea from '../../lib/AutoTextarea.jsx'
import { db } from '../../lib/firebase.js'
import { newResponse } from '../../lib/formModel.js'
import { useTheme } from '../../lib/useTheme.js'
import { ensureSignedIn } from '../auth/authActions.js'
import { isCreator, useAuth } from '../auth/useAuth.js'
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

function FormView({ form, user }) {
  const [answers, setAnswers] = useState({})
  const [missing, setMissing] = useState(new Set())
  const [state, setState] = useState('filling') // filling | sending | sent | already
  const [error, setError] = useState('')
  const isMember = Boolean(user && form.memberIds.includes(user.uid))
  const { requireSignIn, limitOneResponse } = form.settings
  const title = form.title || 'Untitled form'

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
                setAnswers({})
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

  const setAnswer = (id, value) => {
    setAnswers((a) => ({ ...a, [id]: value }))
    if (missing.has(id)) {
      setMissing((m) => {
        const next = new Set(m)
        next.delete(id)
        return next
      })
    }
  }

  async function submit(e) {
    e.preventDefault()
    const clean = {}
    for (const q of form.questions) {
      const value = answers[q.id]
      if (Array.isArray(value) ? value.length : typeof value === 'string' && value.trim()) {
        clean[q.id] = typeof value === 'string' ? value.trim() : value
      }
    }
    const unanswered = form.questions.filter((q) => q.required && !(q.id in clean))
    if (unanswered.length) {
      setMissing(new Set(unanswered.map((q) => q.id)))
      document
        .getElementById(`q-${unanswered[0].id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
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

  const preview = form.status === 'draft'

  return (
    <form className="respond-form" onSubmit={submit} noValidate>
      {preview && (
        <p className="respond-banner">Preview — publish this form to start collecting responses.</p>
      )}

      <header className="respond-card respond-head">
        <h1>{title}</h1>
        {form.description && <p className="respond-desc">{form.description}</p>}
        <p className="respond-meta">
          {form.questions.some((q) => q.required) && (
            <span>
              <span className="q-required">*</span> Required
            </span>
          )}
          {limitOneResponse && <span>You can respond only once.</span>}
        </p>
      </header>

      {form.questions.map((q) => (
        <QuestionField
          key={q.id}
          question={q}
          value={answers[q.id]}
          onChange={(value) => setAnswer(q.id, value)}
          missing={missing.has(q.id)}
        />
      ))}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="respond-actions">
        <button type="submit" className="btn btn-primary" disabled={preview || state === 'sending'}>
          {state === 'sending' ? 'Submitting…' : 'Submit'}
        </button>
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setAnswers({})
            setMissing(new Set())
          }}
        >
          Clear form
        </button>
      </div>
    </form>
  )
}

function QuestionField({ question: q, value, onChange, missing }) {
  const name = `q-${q.id}`
  const labelId = `${name}-label`

  let control
  switch (q.type) {
    case 'shortText':
      control = (
        <input
          className="respond-input"
          aria-labelledby={labelId}
          value={value ?? ''}
          maxLength={500}
          placeholder="Your answer"
          onChange={(e) => onChange(e.target.value)}
        />
      )
      break
    case 'longText':
      control = (
        <AutoTextarea
          className="respond-input"
          aria-labelledby={labelId}
          value={value ?? ''}
          maxLength={5000}
          placeholder="Your answer"
          onChange={(e) => onChange(e.target.value)}
        />
      )
      break
    case 'date':
      control = (
        <input
          type="date"
          className="respond-input respond-date"
          aria-labelledby={labelId}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
      break
    case 'dropdown':
      control = (
        <select
          className="respond-input respond-select"
          aria-labelledby={labelId}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Choose</option>
          {q.options.map((o, i) => (
            <option key={i} value={o}>
              {o}
            </option>
          ))}
        </select>
      )
      break
    case 'multipleChoice':
      control = (
        <div role="radiogroup" aria-labelledby={labelId} className="respond-choices">
          {q.options.map((o, i) => (
            <label key={i} className="respond-choice">
              <input type="radio" name={name} checked={value === o} onChange={() => onChange(o)} />
              <span>{o}</span>
            </label>
          ))}
          {value && !q.required && (
            <button type="button" className="link-btn respond-clear" onClick={() => onChange('')}>
              Clear selection
            </button>
          )}
        </div>
      )
      break
    case 'checkboxes': {
      const selected = value ?? []
      control = (
        <div role="group" aria-labelledby={labelId} className="respond-choices">
          {q.options.map((o, i) => (
            <label key={i} className="respond-choice">
              <input
                type="checkbox"
                checked={selected.includes(o)}
                onChange={(e) =>
                  onChange(e.target.checked ? [...selected, o] : selected.filter((s) => s !== o))
                }
              />
              <span>{o}</span>
            </label>
          ))}
        </div>
      )
      break
    }
    default:
      control = null
  }

  return (
    <section id={name} className={`respond-card respond-q${missing ? ' respond-q-missing' : ''}`}>
      <p id={labelId} className="respond-q-title">
        {q.title || 'Untitled question'}
        {q.required && <span className="q-required"> *</span>}
      </p>
      {q.description && <p className="respond-q-desc">{q.description}</p>}
      {control}
      {missing && (
        <p className="respond-q-error" role="alert">
          This is a required question
        </p>
      )}
    </section>
  )
}
