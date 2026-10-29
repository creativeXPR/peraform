import { useState } from 'react'
import { ExternalLink, RefreshCw, Sheet, Unlink } from 'lucide-react'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import { callSheetsLink } from '../../lib/firebase.js'
import { SHEETS_CLIENT_ID, requestSheetsCode, useSheetsStatus } from '../../lib/googleSheets.js'
import { timeAgo } from '../../lib/timeAgo.js'
import Spinner from '../../lib/Spinner.jsx'

// Settings → Google Sheets: link the form to a spreadsheet in the owner's
// Drive that fills itself with responses, re-sync it, or unlink it.
export default function SheetsSettings({ formId }) {
  const status = useSheetsStatus(formId)
  const [busy, setBusy] = useState('') // 'link' | 'resync' | 'unlink'
  const [message, setMessage] = useState(null) // { kind, text }
  const [confirmUnlink, setConfirmUnlink] = useState(false)

  async function run(action, extra = {}) {
    setBusy(action)
    setMessage(null)
    try {
      const { data } = await callSheetsLink({ action, formId, ...extra })
      if (action === 'link') {
        setMessage({ kind: 'notice', text: `Linked — ${data.rows} ${data.rows === 1 ? 'response' : 'responses'} added.` })
        window.open(data.url, '_blank', 'noopener')
      }
      if (action === 'resync') setMessage({ kind: 'notice', text: `Up to date — ${data.rows} ${data.rows === 1 ? 'response' : 'responses'}.` })
    } catch (err) {
      setMessage({ kind: 'error', text: err.message?.replace(/\s*\[\d+\]$/, '') || 'Something went wrong. Please try again.' })
    } finally {
      setBusy('')
    }
  }

  async function link() {
    setMessage(null)
    let code
    try {
      code = await requestSheetsCode()
    } catch (err) {
      if (err.message !== 'closed' && err.message !== 'access_denied') {
        setMessage({ kind: 'error', text: 'Google didn’t finish the approval. Please try again.' })
      }
      return
    }
    run('link', { code })
  }

  if (!SHEETS_CLIENT_ID) {
    return <p className="sheets-note">Google Sheets isn’t set up for PeraForm yet.</p>
  }
  if (status === undefined) return <Spinner fill="box" />

  return (
    <div className="sheets">
      {status ? (
        <>
          <div className="sheets-linked">
            <span className="sheets-icon" aria-hidden="true">
              <Sheet size={18} />
            </span>
            <span className="sheets-text">
              <strong>Linked to a Google Sheet</strong>
              <span>
                In {status.email ? `${status.email}’s` : 'your'} Drive
                {status.syncedAt && ` · updated ${timeAgo(status.syncedAt.toDate())}`}
              </span>
            </span>
          </div>
          {status.error && (
            <p className="form-error" role="alert">
              {status.error}
            </p>
          )}
          <div className="sheets-actions">
            <a className="btn btn-primary" href={status.url} target="_blank" rel="noreferrer">
              <ExternalLink size={15} />
              Open sheet
            </a>
            <button type="button" className="btn btn-outline" onClick={() => run('resync')} disabled={Boolean(busy)}>
              <RefreshCw size={15} className={busy === 'resync' ? 'spin' : ''} />
              {busy === 'resync' ? 'Re-syncing…' : 'Re-sync'}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setConfirmUnlink(true)} disabled={Boolean(busy)}>
              <Unlink size={15} />
              Unlink
            </button>
          </div>
          <p className="sheets-note">
            New responses are added as they arrive. Re-sync rebuilds the sheet from all responses
            (handy after editing questions or rows).
          </p>
        </>
      ) : (
        <>
          <p className="sheets-note">
            Responses go into a Google Sheet in your Drive as they arrive — for pivots, formulas and
            charts. PeraForm can only open the spreadsheet it creates, nothing else in your Drive.
          </p>
          <div className="sheets-actions">
            <button type="button" className="btn btn-primary" onClick={link} disabled={Boolean(busy)}>
              <Sheet size={15} />
              {busy === 'link' ? 'Creating your sheet…' : 'Link to Google Sheets'}
            </button>
          </div>
        </>
      )}
      {message && (
        <p className={message.kind === 'error' ? 'form-error' : 'form-notice'} role="status">
          {message.text}
        </p>
      )}

      <ConfirmModal
        open={confirmUnlink}
        title="Unlink the Google Sheet?"
        message="New responses stop going to the sheet. The sheet itself stays in your Drive with everything it has so far."
        confirmLabel="Unlink"
        busy={busy === 'unlink'}
        onConfirm={async () => {
          await run('unlink')
          setConfirmUnlink(false)
        }}
        onCancel={() => setConfirmUnlink(false)}
      />
    </div>
  )
}
