import { useState } from 'react'
import { ChevronDown, Copy, Mail } from 'lucide-react'
import { useAccessList } from '../../lib/access.js'
import { callEmailForm } from '../../lib/firebase.js'

// Invited-only forms: who on the list has responded and who hasn't yet.
// Responses carry the respondent's verified email (submitResponse records it
// for these forms). "Copy emails" puts the waiting addresses on the
// clipboard, ready to paste into a reminder email. "Send reminder" calls
// emailForm pre-filled with waiting addresses (up to 25 at a time).
export default function InviteTracker({ form, formId, responses, showToast }) {
  const { access } = useAccessList(formId)
  const [open, setOpen] = useState(false)
  const [reminderOpen, setReminderOpen] = useState(false)
  const [reminderMessage, setReminderMessage] = useState('')
  const [sending, setSending] = useState(false)
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
      showToast("Couldn't copy. Select the addresses and copy them instead.")
    }
  }

  async function sendReminder(e) {
    e.preventDefault()
    // emailForm caps at 25 recipients per send; send the first batch.
    const batch = waiting.slice(0, 25)
    const title = form?.title || 'Untitled form'
    setSending(true)
    try {
      const { data } = await callEmailForm({
        formId,
        to: batch.join(', '),
        subject: `Reminder: fill in "${title}"`,
        message: reminderMessage,
      })
      const sent = data.sent ?? batch.length
      const extra =
        waiting.length > 25 ? ` (${waiting.length - 25} more — send again to reach them)` : ''
      showToast(`Reminder sent to ${sent} ${sent === 1 ? 'person' : 'people'}${extra}`)
      setReminderOpen(false)
      setReminderMessage('')
    } catch (err) {
      showToast(err.message || "Couldn't send the reminder. Please try again.")
    } finally {
      setSending(false)
    }
  }

  // Can only send when the form is published (emailForm requires it).
  const canSendReminder = form?.status === 'published'

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
            {canSendReminder && (
              <button
                type="button"
                className={`btn btn-outline invite-copy${reminderOpen ? ' invite-reminder-on' : ''}`}
                onClick={() => setReminderOpen((o) => !o)}
              >
                <Mail size={15} />
                Send reminder
              </button>
            )}
          </div>
          {open && (
            <ul className="invite-list">
              {waiting.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {reminderOpen && (
            <form className="invite-reminder" onSubmit={sendReminder}>
              <p className="invite-note">
                Sending to {Math.min(waiting.length, 25)} of {waiting.length} waiting{' '}
                {waiting.length === 1 ? 'person' : 'people'}.
                {waiting.length > 25 && ' Send again to reach the rest.'}
              </p>
              <label className="invite-reminder-field">
                <span>Message (optional)</span>
                <textarea
                  value={reminderMessage}
                  onChange={(e) => setReminderMessage(e.target.value)}
                  placeholder="Add a personal note..."
                  rows={2}
                />
              </label>
              <div className="invite-reminder-actions">
                <button type="submit" className="btn btn-primary" disabled={sending}>
                  {sending ? 'Sending…' : 'Send'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setReminderOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </>
      )}
      {invited.length > 0 && !waiting.length && (
        <p className="invite-note invite-all">Everyone on your list has responded.</p>
      )}
    </section>
  )
}
