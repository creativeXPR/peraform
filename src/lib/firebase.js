import { initializeApp } from 'firebase/app'
import { ReCaptchaEnterpriseProvider, initializeAppCheck } from 'firebase/app-check'
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'
import { getStorage } from 'firebase/storage'

// Values come from Vite's VITE_-prefixed env vars — see .env.example.
// PeraForm lives in the "Quality Tools" Firebase project (quality-toolsx),
// alongside related apps — each with its own database, bucket and site.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseApp = initializeApp(firebaseConfig)

// `npm run dev:emulators` sets this, so local testing never touches the
// real project's data or user list.
const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true'

// App Check: proves requests come from this site (invisible reCAPTCHA
// Enterprise). On once VITE_RECAPTCHA_SITE_KEY is set. On localhost, set
// VITE_APPCHECK_DEBUG_TOKEN to a debug token registered in the console.
const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY
if (recaptchaKey && !useEmulators) {
  if (location.hostname === 'localhost') {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true
  }
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaEnterpriseProvider(recaptchaKey),
    isTokenAutoRefreshEnabled: true,
  })
}

// Named database, not the project's default one — that's what separates
// PeraForm's data (and its security rules) from the other Quality Tools apps.
export const db = getFirestore(firebaseApp, 'peraform')
if (useEmulators) connectFirestoreEmulator(db, '127.0.0.1', 8080)

// Points at PeraForm's own bucket (VITE_FIREBASE_STORAGE_BUCKET), so its
// storage rules stay separate from other Quality Tools apps.
export const storage = getStorage(firebaseApp)

// Same region as the database and the functions (functions/index.js).
export const functions = getFunctions(firebaseApp, 'europe-west1')
if (useEmulators) connectFunctionsEmulator(functions, '127.0.0.1', 5001)

export const callSubmitResponse = httpsCallable(functions, 'submitResponse')
export const callManageCollaborators = httpsCallable(functions, 'manageCollaborators')
export const callAcceptInvites = httpsCallable(functions, 'acceptInvites')

export const googleProvider = new GoogleAuthProvider()

// Lazy: getAuth() throws synchronously on a missing/invalid API key, which
// would crash every screen at import time while .env is still unfilled.
let authInstance
export function getFirebaseAuth() {
  if (!authInstance) {
    authInstance = getAuth(firebaseApp)
    if (useEmulators) {
      connectAuthEmulator(authInstance, 'http://127.0.0.1:9099', { disableWarnings: true })
    }
  }
  return authInstance
}
