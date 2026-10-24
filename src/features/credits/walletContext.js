import { createContext, useContext } from 'react'
import { DEFAULT_BILLING, DEFAULT_PACKS } from '../../../functions/billing/pricing.js'

// { wallet, spendable, loaded, billing, packs }
//   wallet: { balance, held, … } in millicredits, or null before it exists
//   spendable: balance − held (what a new AI run can reserve)
export const WalletContext = createContext({
  wallet: null,
  spendable: 0,
  loaded: false,
  billing: DEFAULT_BILLING,
  packs: DEFAULT_PACKS,
})

export function useWallet() {
  return useContext(WalletContext)
}
