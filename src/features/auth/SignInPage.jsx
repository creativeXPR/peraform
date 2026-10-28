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
import GoogleMark from '../../lib/GoogleMark.jsx'

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
  // ?mode=signup (e.g. Get started on the Quality Tools site) opens on Create an account.
  const [mode, setMode] = useState(() => (params.get('mode') === 'signup' ? 'signup' : 'signin'))
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
            // Not a wrapping <label>: it would name the "Forgot?" button (the
            // first control inside it) instead of the password box.
            <div className="field">
              <span className="field-row">
                <label htmlFor="signin-password">Password</label>
                {mode === 'signin' && (
                  <button type="button" className="link-btn" onClick={() => switchMode('reset')}>
                    Forgot?
                  </button>
                )}
              </span>
              <input
                id="signin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                minLength={6}
                required
              />
            </div>
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

      <footer className="signin-legal">
        {/* Shared by every Quality Tools app (quality-tools/ site). */}
        <a href="https://quality-toolsx.web.app/privacy">Privacy</a>
        <a href="https://quality-toolsx.web.app/terms">Terms</a>
      </footer>
    </div>
  )
}
