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
        </section>
      )}
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
