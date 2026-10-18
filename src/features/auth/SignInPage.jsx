import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import {
  authErrorMessage,
  createAccount,
  resetPassword,
  signInWithEmail,
  signInWithGoogle,
} from './authActions.js'
import { isCreator, useAuth } from './useAuth.js'
import './SignInPage.css'
import LogoMark from '../../lib/LogoMark.jsx'

const TITLES = {
  signin: 'Sign in to PeraForm',
  signup: 'Create your account',
  reset: 'Reset your password',
}

// Only same-site paths, so ?next= can't bounce users to another site.
function safeNext(next) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

export default function SignInPage() {
  const { user, loading } = useAuth()
  const [params] = useSearchParams()
  const [mode, setMode] = useState('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  if (loading) return null
  if (isCreator(user)) return <Navigate to={safeNext(params.get('next'))} replace />

  function switchMode(next) {
    setMode(next)
    setError('')
    setNotice('')
  }

  async function run(action) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
    } catch (err) {
      const message = authErrorMessage(err)
      if (message) setError(message)
    } finally {
      setBusy(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (mode === 'signin') run(() => signInWithEmail(email, password))
    if (mode === 'signup') run(() => createAccount(name.trim(), email, password))
    if (mode === 'reset') {
      run(async () => {
        await resetPassword(email)
        // Same wording whether or not the account exists.
        setNotice('If an account exists for that email, a reset link is on its way.')
      })
    }
  }

  return (
    <div className="signin">
      <Link to="/" className="logo">
        <LogoMark />
        PeraForm
      </Link>

      <section className="signin-card">
        <h1>{TITLES[mode]}</h1>

        {mode !== 'reset' && (
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => run(signInWithGoogle)}
              disabled={busy}
            >
              <GoogleMark />
              Continue with Google
            </button>
            <div className="signin-divider">
              <span>or</span>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="signin-form">
          {mode === 'signup' && (
            <label className="field">
              <span>Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          {mode !== 'reset' && (
            <label className="field">
              <span className="field-row">
                Password
                {mode === 'signin' && (
                  <button type="button" className="link-btn" onClick={() => switchMode('reset')}>
                    Forgot?
                  </button>
                )}
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                minLength={6}
                required
              />
            </label>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="form-notice" role="status">
              {notice}
            </p>
          )}

          <button type="submit" className="btn btn-primary" disabled={busy}>
            {mode === 'signin' && 'Sign in'}
            {mode === 'signup' && 'Create account'}
            {mode === 'reset' && 'Send reset link'}
          </button>
        </form>

        <p className="signin-switch">
          {mode === 'signin' ? (
            <>
              New to PeraForm?{' '}
              <button type="button" className="link-btn" onClick={() => switchMode('signup')}>
                Create an account
              </button>
            </>
          ) : (
            <button type="button" className="link-btn" onClick={() => switchMode('signin')}>
              Back to sign in
            </button>
          )}
        </p>
      </section>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  )
}
