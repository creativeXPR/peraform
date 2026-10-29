import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth'
import { callSendVerification, getFirebaseAuth, googleProvider } from '../../lib/firebase.js'

export function signInWithGoogle() {
  return signInWithPopup(getFirebaseAuth(), googleProvider)
}

export function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(getFirebaseAuth(), email, password)
}

export async function createAccount(name, email, password) {
  const { user } = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password)
  if (name) await updateProfile(user, { displayName: name })
  // A verified address is what lets someone accept collaboration invites
  // sent to it (see acceptInvites in functions/index.js).
  await resendVerification().catch(() => {})
  return user
}

// The link goes out from Quality Tools' own address (sendVerification in
// functions/index.js), which spam filters trust more than Firebase's shared
// sender. If our mail isn't working, Firebase sends its own email instead.
// A "too many emails" refusal is passed on rather than sending another.
export async function resendVerification() {
  const user = getFirebaseAuth().currentUser
  try {
    const { data } = await callSendVerification()
    if (data.sent || data.verified) return
  } catch (err) {
    if (err?.code === 'functions/resource-exhausted') throw err
  }
  await sendEmailVerification(user)
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
