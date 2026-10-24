import { useEffect, useMemo, useState } from 'react'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { billingDb, callEnsureWallet } from '../../lib/firebase.js'
import { DEFAULT_PACKS, mergeBilling } from '../../../functions/billing/pricing.js'
import { useAuth } from '../auth/useAuth.js'
import { WalletContext } from './walletContext.js'

// Streams the signed-in creator's credit wallet. Nothing waits on it: the
// page renders straight away and the balance fills in. The wallet is only
// created (one function call) the first time an account has none.
export default function WalletProvider({ children }) {
  const { user } = useAuth()
  const uid = user?.uid
  const [state, setState] = useState({ uid: null, wallet: null })
  const [config, setConfig] = useState({ billing: mergeBilling(), packs: DEFAULT_PACKS })

  useEffect(() => {
    if (!uid) return
    let asked = false
    return onSnapshot(
      doc(billingDb, 'wallets', uid),
      (snap) => {
        setState({ uid, wallet: snap.data() ?? null })
        if (!snap.exists() && !asked) {
          asked = true
          callEnsureWallet().catch(() => {})
        }
      },
      () => setState({ uid, wallet: null }),
    )
  }, [uid])

  // Prices and packs: read once (the defaults show until then).
  useEffect(() => {
    let cancelled = false
    Promise.all([getDoc(doc(billingDb, 'config', 'billing')), getDoc(doc(billingDb, 'config', 'packs'))])
      .then(([b, p]) => {
        if (cancelled) return
        setConfig({ billing: mergeBilling(b.data()), packs: p.data()?.packs ?? DEFAULT_PACKS })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(() => {
    const wallet = state.uid === uid ? state.wallet : null
    return {
      wallet,
      spendable: wallet ? wallet.balance - wallet.held : 0,
      loaded: state.uid === uid,
      ...config,
    }
  }, [state, uid, config])

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}
