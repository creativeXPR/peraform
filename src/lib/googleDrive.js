// "Import from Google Drive": the person picks a Google Form in Google's own
// file picker, and PeraForm reads it with the Google Forms API.
//
// Access: the "drive.file" permission only — PeraForm can see just the
// files the person picks, nothing else in their Drive (and it's a
// non-sensitive Google permission, so no extra Google review). The token
// stays in this browser tab; nothing is stored.
//
// Needs (in .env, then rebuild): VITE_GOOGLE_OAUTH_CLIENT_ID (the web OAuth
// client), VITE_GOOGLE_API_KEY (an API key allowed to use the Google Picker
// API), and the project number (VITE_FIREBASE_MESSAGING_SENDER_ID). In
// Google Cloud: Google Picker API and Google Forms API enabled, this site's
// address listed as an authorized JavaScript origin of the OAuth client.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY
const APP_ID = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
const SCOPE = 'https://www.googleapis.com/auth/drive.file'

export const driveImportReady = Boolean(CLIENT_ID && API_KEY && APP_ID)

const scripts = {}
function loadScript(src) {
  scripts[src] ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = resolve
    s.onerror = () => {
      delete scripts[src]
      reject(new Error('Couldn’t reach Google. Check your connection and try again.'))
    }
    document.head.appendChild(s)
  })
  return scripts[src]
}

function getToken() {
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (res) => (res.error ? reject(new Error('Google didn’t give access.')) : resolve(res.access_token)),
      error_callback: (err) =>
        reject(new Error(err?.type === 'popup_closed' ? 'cancelled' : 'Google sign-in didn’t finish. Please try again.')),
    })
    client.requestAccessToken({ prompt: '' })
  })
}

function pick(token) {
  return new Promise((resolve) => {
    const { picker } = window.google
    const view = new picker.DocsView(picker.ViewId.FORMS).setMode(picker.DocsViewMode.LIST)
    new picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(API_KEY)
      .setAppId(APP_ID)
      .setTitle('Choose a Google Form to import')
      .setCallback((data) => {
        if (data.action === picker.Action.PICKED) resolve(data.docs?.[0]?.id ?? null)
        else if (data.action === picker.Action.CANCEL) resolve(null)
      })
      .build()
      .setVisible(true)
  })
}

// The picked form's JSON (Google Forms API forms.get), or null if the
// person cancelled. Throws an Error with a plain message on failure.
export async function pickGoogleForm() {
  if (!driveImportReady) throw new Error('Importing from Google Drive isn’t set up yet.')
  await Promise.all([loadScript('https://accounts.google.com/gsi/client'), loadScript('https://apis.google.com/js/api.js')])
  await new Promise((resolve) => window.gapi.load('picker', resolve))
  let token
  try {
    token = await getToken()
  } catch (err) {
    if (err.message === 'cancelled') return null
    throw err
  }
  const id = await pick(token)
  if (!id) return null
  const res = await fetch(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 403 || res.status === 404) {
    throw new Error('Google didn’t let PeraForm read that form. Make sure you can edit it, then try again.')
  }
  if (!res.ok) throw new Error('Couldn’t read that form from Google. Please try again.')
  return res.json()
}
