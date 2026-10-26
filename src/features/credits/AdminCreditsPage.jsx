import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import { callBillingAdmin, callEnsureWallet } from '../../lib/firebase.js'
import { formatCredits, formatNaira } from '../../../functions/billing/pricing.js'
import { entryLabel } from './entries.js'
import './credits.css'

// Admins (ADMIN_EMAILS in functions/.env): today's AI cost vs top-ups,
// look up an account, grant/adjust credits, refund a payment. Every change
// asks first, and lands in the ledger with the admin's uid.
export default function AdminCreditsPage() {
  const [allowed, setAllowed] = useState(null)
  const [report, setReport] = useState(null)
  const [email, setEmail] = useState('')
  const [account, setAccount] = useState(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(null) // { kind: 'grant'|'adjust'|'refund', … }
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    callEnsureWallet().then(
      (r) => {
        setAllowed(Boolean(r.data?.isAdmin))
        if (r.data?.isAdmin) callBillingAdmin({ action: 'report' }).then((x) => setReport(x.data), () => {})
      },
      () => setAllowed(false),
    )
  }, [])

  async function lookup(e) {
    e?.preventDefault()
    setMessage('')
    try {
      const { data } = await callBillingAdmin({ action: 'lookup', email })
      setAccount(data)
    } catch (err) {
      setAccount(null)
      setMessage(err.message)
    }
  }

  async function confirm() {
    setBusy(true)
    setMessage('')
    try {
      if (pending.kind === 'refund') {
        const { data } = await callBillingAdmin({ action: 'refund', reference: pending.reference })
        setMessage(data.status === 'refunded' ? 'Refunded.' : 'Refund sent to Paystack. The credits come off once it completes.')
      } else {
        await callBillingAdmin({ action: pending.kind, uid: account.uid, credits: pending.credits, note })
        setMessage('Done.')
        setAmount('')
        setNote('')
      }
      await lookup()
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  if (allowed === null) return <div className="credits credits-sub">Checking…</div>
  if (!allowed) {
    return (
      <div className="credits">
        <p>Admins only.</p>
        <Link to="/credits">Back to credits</Link>
      </div>
    )
  }

  const credits = Number(amount)
  const amountOk = Number.isFinite(credits) && credits !== 0 && Math.abs(credits) <= 1000

  return (
    <div className="credits">
      <Link to="/credits" className="link-btn credits-back">
        <ArrowLeft size={16} /> Credits
      </Link>
      <h1>Credits admin</h1>

      {report && (
        <section className="credits-stats" aria-label="Today">
          <div>
            <span className="credits-sub">AI runs today</span>
            <strong>{report.totals.aiRuns}</strong>
          </div>
          <div>
            <span className="credits-sub">What they cost us</span>
            <strong>{formatNaira(Math.round(report.totals.aiCostUsd * report.fxNgnPerUsd * 100))}</strong>
            <span className="credits-sub">${report.totals.aiCostUsd.toFixed(3)}</span>
          </div>
          <div>
            <span className="credits-sub">Credits charged</span>
            <strong>{formatCredits(report.totals.creditsCharged)}</strong>
          </div>
          <div>
            <span className="credits-sub">Top-ups today</span>
            <strong>{formatNaira(report.totals.topupKobo)}</strong>
            <span className="credits-sub">{report.totals.topups} payments</span>
          </div>
          <div>
            <span className="credits-sub">Emails sent today</span>
            <strong>{report.daily?.at(-1)?.emails ?? 0}</strong>
            <span className="credits-sub">of 500 Gmail limit</span>
          </div>
        </section>
      )}
      {report?.daily && <DailyChart daily={report.daily} field="users" title="Daily users" noun="users" />}
      {report?.daily && (
        <DailyChart daily={report.daily} field="responses" title="Daily responses" noun="responses" />
      )}
      {report?.daily && (
        <DailyChart daily={report.daily} field="emails" title="Daily emails sent" noun="emails" />
      )}
      {report?.owners && <ResponsesByCreator owners={report.owners} />}
      {report?.failed.length > 0 && (
        <details className="credits-failed">
          <summary>{report.failed.length} recent failed payments</summary>
          <ul className="credits-list">
            {report.failed.map((p) => (
              <li key={p.id}>
                <span>
                  {p.id}
                  {p.mismatch && ' · amount mismatch'}
                </span>
                <span>{formatNaira(p.amountKobo)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <form className="credits-lookup" onSubmit={lookup}>
        <label className="field">
          Account email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <button type="submit" className="btn btn-primary">
          <Search size={16} /> Look up
        </button>
      </form>
      {message && <p className="form-notice">{message}</p>}

      {account && (
        <section className="credits-account">
          <h2>{account.email}</h2>
          <p>
            Balance: <strong>{account.wallet ? formatCredits(account.wallet.balance) : 'no wallet yet'}</strong>
            {account.wallet?.held > 0 && ` (${formatCredits(account.wallet.held)} reserved)`}
          </p>

          {account.wallet && (
            <div className="credits-adjust">
              <label className="field">
                Credits (negative to take away)
                <input type="number" step="0.1" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </label>
              <label className="field">
                Note (shown to them)
                <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
              </label>
              <button
                type="button"
                className="btn btn-outline"
                disabled={!amountOk}
                onClick={() => setPending({ kind: credits > 0 ? 'grant' : 'adjust', credits })}
              >
                {credits < 0 ? 'Take away' : 'Give'}
              </button>
            </div>
          )}

          <h3>Payments</h3>
          <ul className="credits-list">
            {account.payments.map((p) => (
              <li key={p.id}>
                <div>
                  <span>
                    {p.packName} · {formatNaira(p.amountKobo)} · {p.status}
                  </span>
                  <span className="credits-sub">{p.id}</span>
                </div>
                {p.credited && !p.reversed && (
                  <button type="button" className="btn btn-ghost" onClick={() => setPending({ kind: 'refund', reference: p.id, payment: p })}>
                    Refund
                  </button>
                )}
              </li>
            ))}
          </ul>

          <h3>Ledger</h3>
          <ul className="credits-list">
            {account.ledger.map((e) => (
              <li key={e.id}>
                <span>{entryLabel(e)}</span>
                <strong className={e.millicredits < 0 ? 'credits-minus' : 'credits-plus'}>
                  {e.millicredits > 0 ? '+' : ''}
                  {formatCredits(e.millicredits)}
                </strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmModal
        open={Boolean(pending)}
        title={
          pending?.kind === 'refund'
            ? `Refund ${formatNaira(pending.payment.amountKobo)}?`
            : pending?.kind === 'adjust'
              ? `Take ${Math.abs(pending.credits)} credits from ${account?.email}?`
              : `Give ${pending?.credits} credits to ${account?.email}?`
        }
        message={
          pending?.kind === 'refund'
            ? `Paystack returns the money and the pack’s ${formatCredits(pending.payment.millicredits)} credits come off their balance, even if that takes it below zero. This can’t be undone.`
            : 'This is recorded in their usage history, with your note.'
        }
        confirmLabel={pending?.kind === 'refund' ? 'Refund' : pending?.kind === 'adjust' ? 'Take away' : 'Give'}
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}

// One count per day (Lagos time), last 14 days, as bars.
//   field: 'users' (signed-in users who opened the app) | 'responses'
function DailyChart({ daily, field, title, noun }) {
  const today = daily.at(-1)?.[field] ?? 0
  const week = daily.slice(-7)
  const average = Math.round(week.reduce((n, d) => n + (d[field] ?? 0), 0) / week.length)
  const top = Math.max(1, ...daily.map((d) => d[field] ?? 0))
  const label = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return (
    <section className="admin-daily" aria-label={title}>
      <h2>{title}</h2>
      <p className="credits-sub">
        <strong>{today}</strong> today · {average} a day over the last 7 days
      </p>
      <div className="admin-daily-bars">
        {daily.map((d) => (
          <div key={d.day} className="admin-daily-bar" title={`${label(d.day)}: ${d[field] ?? 0} ${noun}`}>
            <span className="admin-daily-count">{d[field] ?? 0}</span>
            <span className="admin-daily-fill" style={{ height: `${((d[field] ?? 0) / top) * 100}%` }} />
            <span className="admin-daily-day">{label(d.day)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

// Responses each creator's forms got: today and over the last 7 days.
function ResponsesByCreator({ owners }) {
  return (
    <section className="admin-daily" aria-label="Responses by creator">
      <h2>Responses by creator</h2>
      {owners.length ? (
        <table className="admin-owners">
          <thead>
            <tr>
              <th scope="col">Creator</th>
              <th scope="col">Today</th>
              <th scope="col">Last 7 days</th>
            </tr>
          </thead>
          <tbody>
            {owners.map((o) => (
              <tr key={o.uid}>
                <td>{o.email || o.uid}</td>
                <td>{o.today}</td>
                <td>{o.week}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="credits-sub">No responses in the last 7 days.</p>
      )}
    </section>
  )
}
