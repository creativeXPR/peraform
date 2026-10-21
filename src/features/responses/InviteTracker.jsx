import { useState } from 'react'
import { ChevronDown, Copy } from 'lucide-react'
import { useAccessList } from '../../lib/access.js'

// Invited-only forms: who on the list has responded and who hasn't yet.
// Responses carry the respondent's verified email (submitResponse records it
// for these forms). "Copy emails" puts the waiting addresses on the
// clipboard, ready to paste into a reminder email.
export default function InviteTracker({ formId, responses, showToast }) {
  const { access } = useAccessList(formId)
  const [open, setOpen] = useState(false)
  if (!access) return null

  const responded = new Set(
    responses.map((r) => r.respondentEmail?.toLowerCase()).filter(Boolean),
  )
  const invited = access.emails
  const done = invited.filter((e) => responded.has(e))
  const waiting = invited.filter((e) => !responded.has(e))
  // People let in by a whole domain can't be listed in advance — just count them.
  const byDomain = [...responded].filter(
    (e) => !invited.includes(e) && access.domains.includes(e.split('@')[1]),
  ).length
  const share = invited.length ? Math.round((done.length / invited.length) * 100) : 0

  async function copyWaiting() {
    try {
      await navigator.clipboard.writeText(waiting.join(', '))
      showToast(`Copied ${waiting.length} ${waiting.length === 1 ? 'address' : 'addresses'}`)
    } catch {
      showToast('Couldn’t copy. Select the addresses and copy them instead.')
    }
  }

  return (
    <section className="summary-card invite-tracker">
      <div className="invite-head">
        <h2>Invited responders</h2>
        {invited.length > 0 && (
          <span className="invite-count">
            <strong>{done.length}</strong> of {invited.length} responded
          </span>
        )}
      </div>

      {invited.length > 0 && (
        <div
          className="invite-bar"
          role="progressbar"
          aria-label="Invited people who have responded"
          aria-valuemin={0}
          aria-valuemax={invited.length}
          aria-valuenow={done.length}
        >
          <span style={{ width: `${share}%` }} />
        </div>
      )}

      {access.domains.length > 0 && (
        <p className="invite-note">
          {byDomain} {byDomain === 1 ? 'response' : 'responses'} from{' '}
          {access.domains.map((d) => `@${d}`).join(', ')}
        </p>
      )}
      {!invited.length && !access.domains.length && (
        <p className="invite-note">
          No one is on the list yet. Add people under Share to let them respond.
        </p>
      )}

      {waiting.length > 0 && (
        <>
          <div className="invite-actions">
            <button
              type="button"
              className="link-btn invite-toggle"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              Waiting on {waiting.length}
              <ChevronDown size={16} className={open ? 'invite-chevron-open' : ''} />
            </button>
            <button type="button" className="btn btn-outline invite-copy" onClick={copyWaiting}>
              <Copy size={15} />
              Copy emails
            </button>
          </div>
          {open && (
            <ul className="invite-list">
              {waiting.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </>
      )}
      {invited.length > 0 && !waiting.length && (
        <p className="invite-note invite-all">Everyone on your list has responded.</p>
      )}
    </section>
  )
}
