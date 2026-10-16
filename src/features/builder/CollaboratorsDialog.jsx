import { useEffect, useRef, useState } from 'react'
import { MailPlus, X } from 'lucide-react'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import { callManageCollaborators } from '../../lib/firebase.js'

// "Collaborators" dialog: who can edit this form, pending invites, and (for
// the owner) adding or removing people by email. Membership changes go
// through the manageCollaborators function, which can look people up by email.
export default function CollaboratorsDialog({ formId, open, onClose, showToast }) {
  const ref = useRef(null)
  const [data, setData] = useState(null) // { isOwner, members, invites }
  const [loadError, setLoadError] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null) // { kind: 'error' | 'notice', text }
  const [pending, setPending] = useState(null) // { kind: 'remove' | 'cancelInvite', … }

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
          <h2>Collaborators</h2>
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
              placeholder="Add by email"
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
          <div className="collab-loading" aria-busy="true" />
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
