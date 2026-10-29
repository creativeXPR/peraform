import { Navigate, Outlet, useLocation } from 'react-router-dom'
import WalletProvider from '../credits/WalletProvider.jsx'
import KeepProvider from '../keep/KeepProvider.jsx'
import { isCreator, useAuth } from './useAuth.js'
import VerifyEmailPage from './VerifyEmailPage.jsx'

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
  // Makers need a verified email (Google accounts always are).
  if (!user.emailVerified) return <VerifyEmailPage user={user} />
  // Creators have a credit wallet (AI features; the balance streams in)
  // and a Keep (saved items shared across Quality Tools).
  return (
    <WalletProvider>
      <KeepProvider>
        <Outlet />
      </KeepProvider>
    </WalletProvider>
  )
}
