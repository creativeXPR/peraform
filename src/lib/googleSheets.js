import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from './firebase.js'

// "Link to Google Sheets" in the browser: Google Identity Services shows
// Google's own approval popup and hands back a one-time code, which the
// sheetsLink function redeems (functions/index.js). The client id is public.
export const SHEETS_CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || ''
const SCOPE = 'https://www.googleapis.com/auth/drive.file'

let gisLoading = null
function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  gisLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = resolve
    script.onerror = () => {
      gisLoading = null
      reject(new Error('Couldn’t reach Google. Check your connection and try again.'))
    }
    document.head.appendChild(script)
  })
  return gisLoading
}

// Opens Google's popup; resolves with the code, or rejects if it was
// closed or refused.
export async function requestSheetsCode() {
  await loadGis()
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initCodeClient({
      client_id: SHEETS_CLIENT_ID,
      scope: SCOPE,
      ux_mode: 'popup',
      // Always ask, so Google issues the lasting key the sync needs.
      prompt: 'consent',
      callback: (res) => (res.error ? reject(new Error(res.error)) : resolve(res.code)),
      error_callback: (err) => reject(new Error(err?.type === 'popup_closed' ? 'closed' : err?.message || 'failed')),
    })
    client.requestCode()
  })
}

// The form's link, as members see it: forms/{id}/private/sheets, or null.
export function useSheetsStatus(formId) {
  const [state, setState] = useState({ formId: null, status: undefined })
  useEffect(() => {
    if (!formId) return
    return onSnapshot(
      doc(db, 'forms', formId, 'private', 'sheets'),
      (snap) => setState({ formId, status: snap.exists() ? snap.data() : null }),
      () => setState({ formId, status: null }),
    )
  }, [formId])
  return state.formId === formId ? state.status : undefined // undefined = loading
}
