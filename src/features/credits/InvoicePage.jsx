import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { ArrowLeft, Download } from 'lucide-react'
import { billingDb } from '../../lib/firebase.js'
import { formatCredits, formatNaira } from '../../../functions/billing/pricing.js'
import { useAuth } from '../auth/useAuth.js'
import { useWallet } from './walletContext.js'
import './credits.css'

const CHANNEL = {
  card: 'Card',
  bank: 'Bank',
  bank_transfer: 'Bank transfer',
  ussd: 'USSD',
  qr: 'QR',
  mobile_money: 'Mobile money',
}

function dateOf(value) {
  const ms = typeof value === 'string' ? Date.parse(value) : value?.toMillis?.()
  return ms ? new Date(ms).toLocaleDateString(undefined, { dateStyle: 'long' }) : ''
}

// /credits/invoice/:reference: the invoice for one paid top-up, ready to
// print or save as PDF (the browser's print dialog). Only the payer can
// read the payment (billing rules).
export default function InvoicePage() {
  const { reference } = useParams()
  const { user } = useAuth()
  const { billing } = useWallet()
  const [payment, setPayment] = useState(undefined)

  useEffect(() => {
    getDoc(doc(billingDb, 'payments', reference)).then(
      (snap) => setPayment(snap.data() ?? null),
      () => setPayment(null),
    )
  }, [reference])

  if (payment === undefined) return <div className="credits credits-sub">Loading…</div>
  if (!payment || !payment.credited) {
    return (
      <div className="credits">
        <p>There’s no invoice for this payment{payment ? ' yet: it hasn’t been completed' : ''}.</p>
        <Link to="/credits">Back to credits</Link>
      </div>
    )
  }

  const seller = billing.invoice
  const refunded = Boolean(payment.reversed)
  return (
    <div className="credits invoice-page">
      <div className="invoice-tools">
        <Link to="/credits" className="link-btn credits-back">
          <ArrowLeft size={16} /> Credits
        </Link>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          <Download size={16} /> Download PDF
        </button>
      </div>

      <article className="invoice" aria-label={`Invoice ${payment.invoiceNo ?? reference}`}>
        <header className="invoice-head">
          <div>
            <strong className="invoice-seller">{seller.name}</strong>
            {seller.address && <span>{seller.address}</span>}
            <span>{seller.email}</span>
            <span>{seller.website}</span>
          </div>
          <div className="invoice-title">
            <h1>Invoice</h1>
            <span className={`invoice-stamp${refunded ? ' invoice-stamp-refunded' : ''}`}>
              {refunded ? 'Refunded' : 'Paid'}
            </span>
          </div>
        </header>

        <dl className="invoice-meta">
          <div>
            <dt>Invoice number</dt>
            <dd>{payment.invoiceNo ?? reference}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{dateOf(payment.paidAt) || dateOf(payment.invoicedAt) || dateOf(payment.createdAt)}</dd>
          </div>
          <div>
            <dt>Billed to</dt>
            <dd>
              {payment.buyer?.name && (
                <>
                  {payment.buyer.name}
                  <br />
                </>
              )}
              {payment.buyer?.email ?? user.email}
            </dd>
          </div>
          <div>
            <dt>Paid by</dt>
            <dd>{CHANNEL[payment.channel] ?? 'Paystack'}</dd>
          </div>
        </dl>

        <table className="invoice-lines">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                AI credits · {payment.packName ?? payment.packId} pack
                <span className="credits-sub">{formatCredits(payment.millicredits)} credits</span>
              </td>
              <td>1</td>
              <td>{formatNaira(payment.amountKobo)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={2}>Total</th>
              <td>{formatNaira(payment.amountKobo)}</td>
            </tr>
            <tr>
              <th colSpan={2}>{refunded ? 'Refunded' : 'Amount paid'}</th>
              <td>{formatNaira(payment.amountKobo)}</td>
            </tr>
          </tfoot>
        </table>

        <footer className="invoice-foot">
          <span>Payment reference: {reference}</span>
          {seller.note && <span>{seller.note}</span>}
        </footer>
      </article>
    </div>
  )
}
