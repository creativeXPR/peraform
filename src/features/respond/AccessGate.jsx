import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, MailCheck } from 'lucide-react'
import { getFirebaseAuth } from '../../lib/firebase.js'
import { resendVerification, signOut } from '../auth/authActions.js'

// Shown instead of an invited-only form when the respondent can't open it
// (the reason comes from the formGate function):
//   signin — not signed in (or anonymous)
//   verify — signed in, but the email isn't verified yet
//   denied — signed in with an address that isn't on the list
//   allowed — on the list, but the read still failed (e.g. a stale token)
export default function AccessGate({ gate, formId }) {
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const signInPath = `/signin?next=${encodeURIComponent(`/f/${formId}`)}`

  async function switchAccount() {
    await signOut()
    navigate(signInPath)
  }

  // Pick up a just-verified email: refresh the account and its token, then
  // load the form again.
  async function recheck() {
    setStatus('Checking…')
    const user = getFirebaseAuth().currentUser
    try {
      await user?.reload()
      await user?.getIdToken(true)
      window.location.reload()
    } catch {
      setStatus('Couldn’t check. Please try again.')
    }
  }

  async function resend() {
    try {
      await resendVerification()
      setStatus(`Sent. Check ${gate.email}.`)
    } catch {
      setStatus('Couldn’t send the email. Try again in a few minutes.')
    }
  }

  const title = gate.title || 'Untitled form'
  return (
    <section className="respond-card respond-notice respond-gate">
      {gate.state === 'verify' ? (
        <MailCheck size={32} className="respond-gate-icon" />
      ) : (
        <Lock size={32} className="respond-gate-icon" />
      )}
      <h1>{title}</h1>

      {gate.state === 'signin' && (
        <>
          <p>
            Only people invited by the form’s owner can fill this out. Sign in with the email
            address you were invited with.
          </p>
          <Link to={signInPath} className="btn btn-primary">
            Sign in
          </Link>
        </>
      )}

      {gate.state === 'verify' && (
        <>
          <p>
            Verify your email address (<strong>{gate.email}</strong>) to open this form. We sent you
            a link when you signed up.
          </p>
          <div className="respond-gate-actions">
            <button type="button" className="btn btn-primary" onClick={recheck}>
              I’ve verified it
            </button>
            <button type="button" className="btn btn-outline" onClick={resend}>
              Resend the link
            </button>
          </div>
        </>
      )}

      {gate.state === 'denied' && (
        <>
          <p>
            You don’t have access. Only people invited by the form’s owner can fill it out, and
            you’re signed in as <strong>{gate.email}</strong>.
          </p>
          <p className="respond-gate-hint">
            If you were invited with another address, switch to that account. Otherwise, ask the
            person who sent you the link to add you.
          </p>
          <button type="button" className="btn btn-outline" onClick={switchAccount}>
            Use a different account
          </button>
        </>
      )}

      {gate.state === 'allowed' && (
        <>
          <p>You’re on the list, but the form didn’t load. Please try again.</p>
          <button type="button" className="btn btn-primary" onClick={recheck}>
            Try again
          </button>
        </>
      )}

      {status && (
        <p className="respond-gate-hint" role="status">
          {status}
        </p>
      )}
    </section>
  )
}
