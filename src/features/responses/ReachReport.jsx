import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase.js'
import BarList from './BarList.jsx'
import { reachRows } from './summarize.js'

// "How far people got" (Settings → Count how far people get): how many
// people reached each section or screen (forms/{id}/reach, written by the
// respondent page), so the creator sees where people stop. Read once when
// the page opens; Refresh reads again.
export default function ReachReport({ form, submitted }) {
  const [docs, setDocs] = useState(null)
  const [error, setError] = useState(false)
  const [nonce, setNonce] = useState(0)
  const on = Boolean(form.settings?.trackReach)

  useEffect(() => {
    let cancelled = false
    getDocs(collection(db, 'forms', form.id, 'reach'))
      .then((snap) => !cancelled && setDocs(snap.docs.map((d) => d.data())))
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [form.id, nonce])

  // Nothing counted and counting is off: nothing to show.
  if (!on && !docs?.length) return null
  const started = docs?.length ?? 0
  return (
    <section className="summary-card reach-report">
      <div className="reach-head">
        <h2>How far people got</h2>
        <button type="button" className="link-btn" onClick={() => setNonce((n) => n + 1)}>
          Refresh
        </button>
      </div>
      {error ? (
        <p className="summary-none">Couldn’t load these counts. Try Refresh.</p>
      ) : docs === null ? (
        <p className="summary-none">Loading…</p>
      ) : !started ? (
        <p className="summary-none">No one has opened the published form since counting was turned on.</p>
      ) : (
        <>
          <p className="summary-count">
            {started} {started === 1 ? 'person' : 'people'} started · {submitted} submitted
            {!on && ' · counting is now off'}
          </p>
          <BarList rows={reachRows(form, docs)} total={started} unit="person" />
        </>
      )}
    </section>
  )
}
