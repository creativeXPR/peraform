import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth'
import { getFirebaseAuth, googleProvider } from '../../lib/firebase.js'

export function signInWithGoogle() {
  return signInWithPopup(getFirebaseAuth(), googleProvider)
}

export function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(getFirebaseAuth(), email, password)
}

export async function createAccount(name, email, password) {
  const { user } = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password)
  if (name) await updateProfile(user, { displayName: name })
  return user
}

export function resetPassword(email) {
  return sendPasswordResetEmail(getFirebaseAuth(), email)
}

export function signOut() {
  return firebaseSignOut(getFirebaseAuth())
}

// Respondents on open forms: reuse whatever session exists (real or
// anonymous), otherwise create a silent anonymous one so the response
// rules have a uid to check.
export async function ensureSignedIn() {
  const auth = getFirebaseAuth()
  await auth.authStateReady()
  if (auth.currentUser) return auth.currentUser
  const { user } = await signInAnonymously(auth)
  return user
}

const MESSAGES = {
  'auth/invalid-credential': 'That email and password don’t match.',
  'auth/invalid-email': 'That doesn’t look like a valid email address.',
  'auth/email-already-in-use': 'An account with that email already exists. Try signing in.',
  'auth/weak-password': 'Use at least 6 characters for your password.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/network-request-failed': 'Couldn’t reach the server. Check your connection.',
  'auth/unauthorized-domain': 'Sign-in isn’t enabled for this web address yet.',
}

// null for errors that aren't worth showing (the user closed the popup).
export function authErrorMessage(error) {
  if (['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(error?.code)) {
    return null
  }
  return MESSAGES[error?.code] ?? 'Something went wrong. Please try again.'
}
