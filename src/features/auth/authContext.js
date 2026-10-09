import { createContext } from 'react'

// { user, loading } — user is the Firebase User (possibly anonymous) or null.
export const AuthContext = createContext({ user: null, loading: true })
