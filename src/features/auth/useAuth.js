import { useContext } from 'react'
import { AuthContext } from './authContext.js'

export function useAuth() {
  return useContext(AuthContext)
}

// Creators need a real account; an anonymous respondent session doesn't count.
export function isCreator(user) {
  return Boolean(user && !user.isAnonymous)
}
