import { useRef, useState } from 'react'
import { AtSign, FileUp, Search, UserPlus, X } from 'lucide-react'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import {
  MAX_ENTRIES,
  extractEmails,
  mergeAccess,
  parseEntries,
  saveAccess,
  useAccessList,
} from '../../lib/access.js'

const FILTER_FROM = 8 // show a search box once the list gets long

// "Only people you choose" — the form's allowed responders, in the Share
// dialog. People are added by email or a whole "@domain", by typing,
// pasting a list, or importing a CSV. Saved straight to the private access
// doc (not part of the form's undo history).
export default function AllowedResponders({ formId }) {
  const { access, error } = useAccessList(formId)
  const [text, setText] = useState('')
  const [filter, setFilter] = useState('')
  const [message, setMessage] = useState(null) // { kind, text }
  const [pending, setPending] = useState(null) // { kind: 'one', entry } | { kind: 'all' }
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)

  if (error) return <p className="form-error">Couldn’t load the list. Check your connection.</p>
  if (!access) return <div className="collab-loading" aria-busy="true" />

  const total = access.emails.length + access.domains.length

  async function addEntries(entries, skipped = []) {
    if (!entries.emails.length && !entries.domains.length) {
      setMessage({
        kind: 'error',
        text: skipped.length
          ? `No email addresses found. Couldn’t read: ${skipped.slice(0, 3).join(', ')}`
          : 'No email addresses found.',
      })
      return
    }
    const { access: next, added, overflow } = mergeAccess(access, entries)
    setBusy(true)
    try {
      await saveAccess(formId, next)
      const parts = [added ? `Added ${added}.` : 'They’re already on the list.']
      if (overflow) parts.push(`${overflow} didn’t fit: the list holds up to ${MAX_ENTRIES}.`)
      if (skipped.length) {
        parts.push(
          `Skipped ${skipped.length} that ${skipped.length === 1 ? 'isn’t an email address' : 'aren’t email addresses'}: ${skipped.slice(0, 3).join(', ')}${skipped.length > 3 ? '…' : ''}`,
        )
      }
      setMessage({ kind: overflow || skipped.length ? 'error' : 'notice', text: parts.join(' ') })
      setText('')
    } catch {
      setMessage({ kind: 'error', text: 'Couldn’t save the list. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  function addTyped(e) {
    e.preventDefault()
    const { emails, domains, invalid } = parseEntries(text)
    addEntries({ emails, domains }, invalid)
  }

  async function importFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ kind: 'error', text: 'That file is too big. Use a CSV or text file under 2 MB.' })
      return
    }
    addEntries({ emails: extractEmails(await file.text()), domains: [] })
  }

  async function confirmRemove() {
    const next =
      pending.kind === 'all'
        ? { emails: [], domains: [] }
        : {
            emails: access.emails.filter((x) => x !== pending.entry),
            domains: access.domains.filter((x) => `@${x}` !== pending.entry),
          }
    setBusy(true)
    try {
      await saveAccess(formId, next)
      setPending(null)
      setMessage(null)
    } catch {
      setMessage({ kind: 'error', text: 'Couldn’t update the list. Please try again.' })
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  const query = filter.trim().toLowerCase()
  const entries = [
    ...access.domains.map((d) => ({ key: `@${d}`, domain: true })),
    ...access.emails.map((e) => ({ key: e, domain: false })),
  ].filter((x) => !query || x.key.includes(query))

  return (
    <div className="allowed">
      <p className="allowed-intro">
        They sign in with these addresses to open and answer the form. Add <strong>@school.edu</strong>{' '}
        to let everyone at a domain in.
      </p>
      <form className="allowed-add" onSubmit={addTyped}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) addTyped(e)
          }}
          rows={2}
          placeholder="Emails or @domains — paste a whole list"
          aria-label="Add allowed responders"
        />
        <div className="allowed-add-actions">
          <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>
            <UserPlus size={16} />
            Add
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => fileRef.current.click()}
            disabled={busy}
          >
            <FileUp size={16} />
            Import CSV
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            hidden
            onChange={importFile}
          />
        </div>
      </form>
      {message && (
        <p className={message.kind === 'error' ? 'form-error' : 'form-notice'} role="status">
          {message.text}
        </p>
      )}

      <div className="allowed-head">
        <strong>
          {total === 0
            ? 'No one yet'
            : [
                access.emails.length &&
                  `${access.emails.length} ${access.emails.length === 1 ? 'person' : 'people'}`,
                access.domains.length &&
                  `${access.domains.length} ${access.domains.length === 1 ? 'domain' : 'domains'}`,
              ]
                .filter(Boolean)
                .join(' · ')}
        </strong>
        {total > 0 && (
          <button type="button" className="link-btn allowed-clear" onClick={() => setPending({ kind: 'all' })}>
            Remove all
          </button>
        )}
      </div>
      {total === 0 && (
        <p className="allowed-empty">Until you add someone, no one but you and your collaborators can open the form.</p>
      )}
      {total >= FILTER_FROM && (
        <label className="allowed-filter">
          <Search size={15} />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Find on the list"
            aria-label="Find on the list"
          />
        </label>
      )}
      {total > 0 && (
        <ul className="allowed-list">
          {entries.map(({ key, domain }) => (
            <li key={key}>
              {domain && <AtSign size={14} className="allowed-domain-icon" />}
              <span>{domain ? `Anyone ${key}` : key}</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setPending({ kind: 'one', entry: key })}
                aria-label={`Remove ${key}`}
              >
                <X size={15} />
              </button>
            </li>
          ))}
          {!entries.length && <li className="allowed-none">Nothing matches “{filter}”.</li>}
        </ul>
      )}

      <ConfirmModal
        open={Boolean(pending)}
        title={pending?.kind === 'all' ? `Remove all ${total} from the list?` : `Remove ${pending?.entry}?`}
        message={
          pending?.kind === 'all'
            ? 'No one but you and your collaborators will be able to open the form until you add people again.'
            : 'They won’t be able to open or answer the form. Responses they already sent are kept.'
        }
        confirmLabel={pending?.kind === 'all' ? 'Remove all' : 'Remove'}
        busy={busy}
        onConfirm={confirmRemove}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}
