import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { getFirebaseAuth } from '../../lib/firebase.js'
import { AuthContext } from './authContext.js'

export default function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, loading: true })

  useEffect(
    () => onAuthStateChanged(getFirebaseAuth(), (user) => setState({ user, loading: false })),
    [],
  )

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
