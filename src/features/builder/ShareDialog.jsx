import { useEffect, useRef, useState } from 'react'
import { Globe, Info, Link2, Lock, Mail, MailPlus, UserCheck, X } from 'lucide-react'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import { callEmailForm, callManageCollaborators } from '../../lib/firebase.js'
import AllowedResponders from './AllowedResponders.jsx'
import { useFormEditor } from './editorContext.js'
import Select from '../../lib/Select.jsx'
import Spinner from '../../lib/Spinner.jsx'

// "Share" dialog, modelled on Google Forms': add people by email (owner),
// who has access, general access (editors restricted; respondents anyone
// with the link, signed-in users only, or only people you choose), publish
// status, Email the form link, and Copy link.
// Membership changes go through the manageCollaborators function, which can
// look people up by email.
export default function ShareDialog({ formId, open, onClose, showToast, onPublish, onCopyLink }) {
  const { form, draft, edit } = useFormEditor()
  // 'anyone' | 'signedIn' | 'restricted' (only the people on the list)
  const responders = draft?.settings?.restricted
    ? 'restricted'
    : draft?.settings?.requireSignIn
      ? 'signedIn'
      : 'anyone'
  const setResponders = (value) =>
    edit('settings:responders', (d) => {
      const settings = {
        ...d.settings,
        restricted: value === 'restricted',
        requireSignIn: value !== 'anyone',
      }
      // One-per-person needs real accounts (see SettingsPage).
      if (value === 'anyone') settings.limitOneResponse = false
      return { ...d, settings }
    })
  const ref = useRef(null)
  const [data, setData] = useState(null) // { isOwner, members, invites }
  const [loadError, setLoadError] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null) // { kind: 'error' | 'notice', text }
  const [pending, setPending] = useState(null) // { kind: 'remove' | 'cancelInvite', … }

  const [showEmailSection, setShowEmailSection] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailStatus, setEmailStatus] = useState(null)

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const fetchList = () => callManageCollaborators({ action: 'list', formId })
  const showList = ({ data }) => {
    setData(data)
    setLoadError('')
  }
  const showLoadError = () =>
    setLoadError('Couldn’t load collaborators. Check your connection and try again.')

  // Refresh after a change.
  const load = () => fetchList().then(showList, showLoadError)

  // Fresh list each time the dialog opens.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    callManageCollaborators({ action: 'list', formId }).then(
      (res) => !cancelled && showList(res),
      () => !cancelled && showLoadError(),
    )
    return () => {
      cancelled = true
    }
  }, [open, formId])

  async function add(e) {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    setMessage(null)
    try {
      const { data: res } = await callManageCollaborators({ action: 'add', formId, email })
      const text = {
        added: `${email.trim()} can now edit this form.`,
        invited: `${email.trim()} doesn’t have a PeraForm account yet. They’ll get access when they sign up with that email.`,
        already: `${email.trim()} already has access.`,
      }[res.status]
      setMessage({ kind: 'notice', text })
      setEmail('')
      await load()
    } catch (err) {
      setMessage({ kind: 'error', text: err.message || 'Couldn’t add them. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  async function confirmPending() {
    setBusy(true)
    try {
      await callManageCollaborators({ action: pending.kind, formId, uid: pending.uid, email: pending.email })
      showToast(pending.kind === 'remove' ? 'Collaborator removed' : 'Invite cancelled')
      setPending(null)
      await load()
    } catch {
      showToast('Something went wrong. Please try again.')
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  async function sendEmailForm(e) {
    e.preventDefault()
    if (!emailTo.trim()) return
    setEmailSending(true)
    setEmailStatus(null)
    try {
      const title = draft?.title || 'Untitled form'
      const { data: res } = await callEmailForm({
        formId,
        to: emailTo,
        subject: emailSubject.trim() || `Please fill in: ${title}`,
        message: emailMessage,
      })
      showToast(`Sent to ${res.sent} ${res.sent === 1 ? 'recipient' : 'recipients'}`)
      setEmailTo('')
      setEmailMessage('')
      setShowEmailSection(false)
    } catch (err) {
      setEmailStatus({
        kind: 'error',
        text: err.message || 'Couldn’t send email. Please try again.',
      })
    } finally {
      setEmailSending(false)
    }
  }

  return (
    <dialog
      ref={ref}
      className="confirm collab"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="confirm-body">
        <div className="collab-head">
          <h2>Share “{draft?.title || 'Untitled form'}”</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className="collab-sub">Collaborators can edit the form and see its responses.</p>

        {data?.isOwner && (
          <form className="collab-add" onSubmit={add}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Add people by email"
              aria-label="Collaborator’s email"
              autoComplete="off"
            />
            <button type="submit" className="btn btn-primary" disabled={busy || !email.trim()}>
              <MailPlus size={16} />
              Add
            </button>
          </form>
        )}
        {message && (
          <p className={message.kind === 'error' ? 'form-error' : 'form-notice'} role="status">
            {message.text}
          </p>
        )}

        {loadError ? (
          <p className="form-error">{loadError}</p>
        ) : !data ? (
          <Spinner fill="box" />
        ) : (
          <ul className="collab-list">
            {data.members.map((m) => (
              <li key={m.uid}>
                <span className="collab-avatar" aria-hidden="true">
                  {m.photo ? (
                    <img src={m.photo} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    (m.name || m.email || '?').charAt(0).toUpperCase()
                  )}
                </span>
                <span className="collab-who">
                  <strong>{m.name || m.email}</strong>
                  {m.name && <span>{m.email}</span>}
                </span>
                <span className="collab-role">{m.role === 'owner' ? 'Owner' : 'Editor'}</span>
                {data.isOwner && m.role !== 'owner' && (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setPending({ kind: 'remove', uid: m.uid, label: m.name || m.email })}
                    aria-label={`Remove ${m.name || m.email}`}
                  >
                    <X size={16} />
                  </button>
                )}
              </li>
            ))}
            {data.invites.map((inviteEmail) => (
              <li key={inviteEmail}>
                <span className="collab-avatar collab-avatar-pending" aria-hidden="true">
                  {inviteEmail.charAt(0).toUpperCase()}
                </span>
                <span className="collab-who">
                  <strong>{inviteEmail}</strong>
                  <span>Waiting for them to sign up</span>
                </span>
                <span className="collab-role">Invited</span>
                {data.isOwner && (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() =>
                      setPending({ kind: 'cancelInvite', email: inviteEmail, label: inviteEmail })
                    }
                    aria-label={`Cancel invite for ${inviteEmail}`}
                  >
                    <X size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="share-email-toggle">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setShowEmailSection((s) => !s)}
          >
            <Mail size={16} />
            {showEmailSection ? 'Hide email form link' : 'Email the form link'}
          </button>
        </div>

        {showEmailSection && (
          <form className="share-email-form" onSubmit={sendEmailForm}>
            <label className="share-field">
              <span>To (comma-separated, up to 25)</span>
              <input
                type="text"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="colleague@example.com, friend@example.com"
                aria-label="Recipient email addresses"
                required
              />
            </label>
            <label className="share-field">
              <span>Subject</span>
              <input
                type="text"
                value={emailSubject || `Please fill in: ${draft?.title || 'Untitled form'}`}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder={`Please fill in: ${draft?.title || 'Untitled form'}`}
                aria-label="Email subject"
              />
            </label>
            <label className="share-field">
              <span>Message (optional)</span>
              <textarea
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                placeholder="Add a message..."
                rows={3}
                aria-label="Email message"
              />
            </label>
            {emailStatus && (
              <p className={emailStatus.kind === 'error' ? 'form-error' : 'form-notice'} role="status">
                {emailStatus.text}
              </p>
            )}
            <div className="share-email-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={emailSending || !emailTo.trim() || form?.status !== 'published'}
              >
                {emailSending ? 'Sending…' : 'Send email'}
              </button>
            </div>
            {form?.status !== 'published' && (
              <p className="share-field-hint">Publish the form before emailing it to respondents.</p>
            )}
          </form>
        )}

        <h3 className="share-heading">General access</h3>
        <div className="share-access">
          <span className="share-access-icon">
            <Lock size={16} />
          </span>
          <span className="share-access-text">
            <strong>Editor view · Restricted</strong>
            <span>Only the people above can open the editor</span>
          </span>
        </div>
        <div className="share-access">
          <span className={`share-access-icon${responders === 'restricted' ? '' : ' share-access-open'}`}>
            {responders === 'restricted' ? <UserCheck size={16} /> : <Globe size={16} />}
          </span>
          <span className="share-access-text">
            <strong>Responder view</strong>
            <span>
              {
                {
                  anyone: 'Anyone on the internet with the link can respond',
                  signedIn: 'People must sign in to PeraForm to respond',
                  restricted: 'Only the people on your list can open and respond',
                }[responders]
              }
            </span>
          </span>
          <Select
            className="share-select"
            value={responders}
            aria-label="Who can respond"
            onChange={(e) => setResponders(e.target.value)}
          >
            <option value="anyone">Anyone with the link</option>
            <option value="signedIn">Signed-in users only</option>
            <option value="restricted">Only people you choose</option>
          </Select>
        </div>
        {responders === 'restricted' && open && <AllowedResponders formId={formId} />}

        {form?.status !== 'published' && (
          <div className="share-status">
            <Info size={16} />
            <span>
              {form?.status === 'closed'
                ? 'This form isn’t accepting responses right now.'
                : 'Publish the form to accept responses.'}
            </span>
            {form?.status === 'draft' && (
              <button type="button" className="link-btn" onClick={onPublish}>
                Publish
              </button>
            )}
          </div>
        )}

        <div className="share-foot">
          <button type="button" className="btn btn-outline" onClick={onCopyLink}>
            <Link2 size={16} />
            Copy responder link
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(pending)}
        title={pending?.kind === 'remove' ? `Remove ${pending?.label}?` : `Cancel the invite for ${pending?.label}?`}
        message={
          pending?.kind === 'remove'
            ? 'They’ll lose access to this form and its responses straight away.'
            : 'They won’t get access when they sign up.'
        }
        confirmLabel={pending?.kind === 'remove' ? 'Remove' : 'Cancel invite'}
        busy={busy}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
    </dialog>
  )
}
