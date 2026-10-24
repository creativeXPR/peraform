import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { defineBoolean } from 'firebase-functions/params'
import { HttpsError } from 'firebase-functions/v2/https'

// Set-up shared by every function module.
initializeApp()
// PeraForm's named database (the project's default one belongs to other apps).
export const db = getFirestore('peraform')
// The suite-wide billing database: one credit wallet per Quality Tools
// account, whichever app spends it.
export const billingDb = getFirestore('billing')
export const REGION = 'europe-west1'

// Off until the reCAPTCHA key is set up (see README); then set
// ENFORCE_APP_CHECK=true in functions/.env and redeploy.
const ENFORCE_APP_CHECK = defineBoolean('ENFORCE_APP_CHECK', { default: false })

// Every callable starts here: refuses requests without a valid App Check
// token (i.e. not from PeraForm's own site) once enforcement is on.
// The local emulators run without App Check, so it's never required there.
export const EMULATED = process.env.FUNCTIONS_EMULATOR === 'true'
export function requireApp(request) {
  if (ENFORCE_APP_CHECK.value() && !EMULATED && !request.app) {
    throw new HttpsError('failed-precondition', 'This request didn’t come from PeraForm.')
  }
}
