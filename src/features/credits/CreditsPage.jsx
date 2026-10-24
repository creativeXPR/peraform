import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { Shield, Sparkles } from 'lucide-react'
import { billingDb, callCreateTopup, callEnsureWallet } from '../../lib/firebase.js'
import { AI_FEATURES } from '../../../functions/ai/catalog.js'
import { formatCredits, formatNaira, typicalCharge } from '../../../functions/billing/pricing.js'
import { useAuth } from '../auth/useAuth.js'
import { useWallet } from './walletContext.js'
import './credits.css'

import { entryLabel } from './entries.js'

function when(ts) {
  const ms = typeof ts === 'number' ? ts : ts?.toMillis?.()
  return ms ? new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''
}

// Hooks for one user's recent ledger entries or payments, newest first.
function useRecent(name, uid) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    const q = query(collection(billingDb, name), where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(50))
    return onSnapshot(
      q,
      (snap) => setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setRows([]),
    )
  }, [name, uid])
  return rows
}

export default function CreditsPage() {
  const { user } = useAuth()
  const { wallet, spendable, loaded, billing, packs } = useWallet()
  const ledger = useRecent('ledger', user.uid)
  const payments = useRecent('payments', user.uid)
  const [buying, setBuying] = useState(null)
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    callEnsureWallet().then((r) => setIsAdmin(Boolean(r.data?.isAdmin)), () => {})
  }, [])

  async function buy(pack) {
    setBuying(pack.id)
    setError('')
    try {
      const { data } = await callCreateTopup({ packId: pack.id })
      window.location.assign(data.url)
    } catch (err) {
      setError(err.message || 'Couldn’t start the payment. Please try again.')
      setBuying(null)
    }
  }

  const perCredit = (pack) => formatNaira(Math.round((pack.priceKobo / pack.millicredits) * 1000))

  return (
    <div className="credits">
      <section className="credits-balance">
        <div>
          <span className="credits-kicker">
            <Sparkles size={16} /> AI credits
          </span>
          <strong className="credits-amount">{loaded ? formatCredits(spendable) : '…'}</strong>
          {wallet?.held > 0 && <span className="credits-sub">{formatCredits(wallet.held)} reserved for a run in progress</span>}
          {wallet && wallet.balance < 0 && (
            <span className="credits-sub credits-warn">Your balance is below zero after a refund. Top up to use AI again.</span>
          )}
        </div>
        <p className="credits-note">
          Credits work across every Quality Tools app. Each AI run reserves the most it could cost, then charges
          only what it used. A run that fails costs nothing.
        </p>
        {isAdmin && (
          <Link to="/admin/credits" className="btn btn-outline credits-admin">
            <Shield size={16} />
            Admin
          </Link>
        )}
      </section>

      <section aria-labelledby="packs-h">
        <h2 id="packs-h">Buy credits</h2>
        <div className="credits-packs">
          {packs
            .filter((p) => p.active)
            .map((pack) => (
              <div key={pack.id} className="credits-pack">
                <span className="credits-pack-name">{pack.name}</span>
                <strong>{formatCredits(pack.millicredits)} credits</strong>
                <span className="credits-sub">{perCredit(pack)} per credit</span>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => buy(pack)}
                  disabled={Boolean(buying)}
                >
                  {buying === pack.id ? 'Opening Paystack…' : `Buy for ${formatNaira(pack.priceKobo)}`}
                </button>
              </div>
            ))}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="credits-sub">
          Payments by card, bank transfer or USSD through Paystack. A typical AI form costs about{' '}
          {formatCredits(typical(billing))} credits.
        </p>
      </section>

      <section aria-labelledby="usage-h">
        <h2 id="usage-h">Usage</h2>
        {ledger === null ? (
          <p className="credits-sub">Loading…</p>
        ) : ledger.length === 0 ? (
          <p className="credits-sub">Nothing yet.</p>
        ) : (
          <ul className="credits-list">
            {ledger.map((e) => (
              <li key={e.id}>
                <div>
                  <span>{entryLabel(e)}</span>
                  <span className="credits-sub">
                    {when(e.createdAt)}
                    {e.type === 'charge' && e.tokensIn != null && ` · ${(e.tokensIn + e.tokensOut).toLocaleString()} tokens`}
                  </span>
                </div>
                <strong className={e.millicredits < 0 ? 'credits-minus' : 'credits-plus'}>
                  {e.millicredits > 0 ? '+' : ''}
                  {formatCredits(e.millicredits)}
                </strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      {payments?.length > 0 && (
        <section aria-labelledby="payments-h">
          <h2 id="payments-h">Payments</h2>
          <ul className="credits-list">
            {payments.map((p) => (
              <li key={p.id}>
                <div>
                  <span>
                    {p.packName ?? p.packId} · {formatNaira(p.amountKobo)}
                  </span>
                  <span className="credits-sub">
                    {when(p.createdAt)} · {p.id}
                  </span>
                </div>
                <span className="credits-row-end">
                  {p.credited && (
                    <Link to={`/credits/invoice/${p.id}`} className="link-btn">
                      Invoice
                    </Link>
                  )}
                  <span className={`credits-status credits-status-${p.status}`}>{STATUS[p.status] ?? p.status}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

const STATUS = {
  initialized: 'Not completed',
  success: 'Paid',
  failed: 'Failed',
  abandoned: 'Cancelled',
  refunded: 'Refunded',
}

function typical(billing) {
  const { inputTokens, outputTokens } = AI_FEATURES['generate-form'].typical
  return typicalCharge(billing, billing.tiers.standard, inputTokens, outputTokens)
}
