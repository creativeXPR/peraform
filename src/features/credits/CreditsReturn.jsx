import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { callVerifyTopup } from '../../lib/firebase.js'
import { formatCredits } from '../../../functions/billing/pricing.js'
import './credits.css'

// Paystack sends the buyer back here (?reference=…). We ask the server to
// check with Paystack right away, so the credits show without waiting for
// the webhook. A pending payment (e.g. a bank transfer) is checked again a
// few times.
const RETRIES = 5

export default function CreditsReturn() {
  const [params] = useSearchParams()
  const reference = params.get('reference') || params.get('trxref')
  const [result, setResult] = useState(reference ? { status: 'checking' } : { status: 'missing' })

  useEffect(() => {
    if (!reference) return
    let cancelled = false
    let timer
    const check = async (attempt) => {
      try {
        const { data } = await callVerifyTopup({ reference })
        if (cancelled) return
        if (data.status === 'pending' && attempt < RETRIES) {
          setResult({ status: 'pending' })
          timer = setTimeout(() => check(attempt + 1), 3000)
          return
        }
        setResult(data)
      } catch {
        if (!cancelled) setResult({ status: 'error' })
      }
    }
    check(1)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [reference])

  const view = {
    checking: [Clock, 'Checking your payment…', ''],
    pending: [Clock, 'Waiting for Paystack…', 'This can take a moment for bank transfers and USSD.'],
    success: [CheckCircle2, `+${formatCredits(result.millicredits ?? 0)} credits added`, 'Thanks! They’re ready to use.'],
    failed: [XCircle, 'The payment didn’t go through', 'Nothing was charged. You can try again.'],
    abandoned: [XCircle, 'Payment cancelled', 'Nothing was charged.'],
    error: [XCircle, 'We couldn’t check this payment', 'If you were charged, the credits will still arrive shortly.'],
    missing: [XCircle, 'No payment to check', ''],
  }[result.status] ?? [Clock, 'Payment not completed yet', 'If you paid, the credits will arrive shortly.']
  const [Icon, title, text] = view

  return (
    <div className="credits credits-return">
      <Icon size={40} className={`credits-return-icon credits-return-${result.status}`} />
      <h1>{title}</h1>
      {text && <p className="credits-sub">{text}</p>}
      <div className="credits-return-actions">
        {result.status === 'success' && (
          <Link to={`/credits/invoice/${reference}`} className="btn btn-outline">
            View invoice
          </Link>
        )}
        <Link to="/credits" className="btn btn-primary">
          Back to credits
        </Link>
      </div>
    </div>
  )
}
