import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { formatCredits } from '../../../functions/billing/pricing.js'
import { useWallet } from './walletContext.js'

// Top-bar credit balance; opens the Credits page.
export default function BalanceChip() {
  const { wallet, spendable, loaded, billing } = useWallet()
  if (!loaded) return null
  const low = !wallet || spendable < billing.lowBalanceMillicredits
  return (
    <Link
      to="/credits"
      className={`credit-chip${low ? ' credit-chip-low' : ''}`}
      title="AI credits"
      aria-label={`${formatCredits(spendable)} AI credits`}
    >
      <Sparkles size={16} />
      <span>{formatCredits(spendable)}</span>
    </Link>
  )
}
