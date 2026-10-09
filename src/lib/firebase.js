import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import { getStorage } from 'firebase/storage'

// Values come from Vite's VITE_-prefixed env vars — see .env.example.
// PeraForm shares the "c-xpr25" Firebase project with Anix and MulTeam
// rather than owning its own project.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseApp = initializeApp(firebaseConfig)
// Named database, not the project's default one — that's what separates
// PeraForm's data (and its security rules) from the other apps.
export const db = getFirestore(firebaseApp, 'peraform')
// Points at PeraForm's own bucket (VITE_FIREBASE_STORAGE_BUCKET), so its
// storage rules can't overwrite Anix's on the project's default bucket.
export const storage = getStorage(firebaseApp)
export const functions = getFunctions(firebaseApp)
export const googleProvider = new GoogleAuthProvider()

// Lazy: getAuth() throws synchronously on a missing/invalid API key, which
// would crash every screen at import time while .env is still unfilled.
let authInstance
export function getFirebaseAuth() {
  if (!authInstance) {
    authInstance = getAuth(firebaseApp)
  }
  return authInstance
}
