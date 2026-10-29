import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { getFirebaseAuth } from '../../lib/firebase.js'
import { resendVerification, signOut } from './authActions.js'
import './VerifyEmailPage.css'

// Shown instead of the creator screens (RequireCreator) until a password
// account verifies its email: building forms, sharing, results and AI all
// need a verified address (firestore.rules isMaker, requireVerified in
// functions/app.js). Filling in forms never does.
export default function VerifyEmailPage({ user }) {
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState('')

  // The link may already have been clicked (in the email app, or another
  // tab) while this browser still remembers the old, unverified account.
  // Checking only reads the account; nothing of the user's changes.
  useEffect(() => {
    const current = getFirebaseAuth().currentUser
    current
      ?.reload()
      .then(async () => {
        if (!current.emailVerified) return
        await current.getIdToken(true)
        window.location.reload()
      })
      .catch(() => {})
  }, [])

  // Pick up a just-clicked link: refresh the account and its token, then
  // load the page again so everything uses the verified token.
  async function recheck() {
    setBusy('check')
    setStatus('')
    try {
      const current = getFirebaseAuth().currentUser
      await current?.reload()
      if (current?.emailVerified) {
        await current.getIdToken(true)
        window.location.reload()
        return
      }
      setStatus('Not verified yet. Open the link in the email, then press this again.')
    } catch {
      setStatus('Couldn’t check. Check your connection and try again.')
    }
    setBusy('')
  }

  async function resend() {
    setBusy('send')
    setStatus('')
    try {
      await resendVerification()
      setStatus(`Sent to ${user.email}. It comes from qualitytoolsx@gmail.com; if it isn’t in your inbox in a minute, check spam.`)
    } catch (err) {
      setStatus(
        err?.code === 'functions/resource-exhausted'
          ? err.message
          : 'Couldn’t send the email. Try again in a few minutes.',
      )
    }
    setBusy('')
  }

  async function switchAccount() {
    await signOut()
    navigate('/signin', { replace: true })
  }

  return (
    <main className="verify-page">
      <section className="verify-card">
        <MailCheck size={36} className="verify-icon" aria-hidden="true" />
        <h1>Verify your email</h1>
        <p>
          To build forms, see responses and use AI, confirm that <strong>{user.email}</strong> is yours. We sent a
          link when you signed up. Open it, then come back here.
        </p>
        <p className="verify-hint">Filling in other people’s forms doesn’t need this.</p>
        <div className="verify-actions">
          <button type="button" className="btn btn-primary" onClick={recheck} disabled={Boolean(busy)}>
            {busy === 'check' ? 'Checking…' : 'I’ve verified it'}
          </button>
          <button type="button" className="btn btn-outline" onClick={resend} disabled={Boolean(busy)}>
            {busy === 'send' ? 'Sending…' : 'Resend the link'}
          </button>
        </div>
        {status && (
          <p className="verify-status" role="status">
            {status}
          </p>
        )}
        <button type="button" className="link-btn verify-switch" onClick={switchAccount}>
          Use a different account
        </button>
      </section>
    </main>
  )
}
