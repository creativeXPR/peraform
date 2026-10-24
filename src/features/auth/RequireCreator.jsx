import { Navigate, Outlet, useLocation } from 'react-router-dom'
import WalletProvider from '../credits/WalletProvider.jsx'
import { isCreator, useAuth } from './useAuth.js'

// Gate for creator screens: anyone without a real account goes to /signin
// and comes back to where they were headed afterwards.
export default function RequireCreator() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!isCreator(user)) {
    const next = location.pathname + location.search
    return <Navigate to={`/signin?next=${encodeURIComponent(next)}`} replace />
  }
  // Creators have a credit wallet (AI features); the balance streams in.
  return (
    <WalletProvider>
      <Outlet />
    </WalletProvider>
  )
}
