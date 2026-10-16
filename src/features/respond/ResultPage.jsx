import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase.js'
import { quizSettings } from '../../lib/formModel.js'
import { useAuth } from '../auth/useAuth.js'
import QuizResult from './QuizResult.jsx'
import './RespondPage.css'

// /f/:formId/r/:responseId — a respondent's quiz result, readable once the
// creator releases it (and only by the person who submitted it).
export default function ResultPage() {
  const { formId, responseId } = useParams()
  const { loading: authLoading, user } = useAuth()
  const [state, setState] = useState({ status: 'loading' })

  const uid = user?.uid
  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    ;(async () => {
      try {
        const formSnap = await getDoc(doc(db, 'forms', formId))
        if (!formSnap.exists()) throw new Error('missing')
        const form = { id: formSnap.id, ...formSnap.data() }
        try {
          const res = await getDoc(doc(db, 'forms', formId, 'responses', responseId))
          if (!cancelled) setState({ status: res.exists() ? 'ready' : 'pending', form, response: res.data() })
        } catch {
          if (!cancelled) setState({ status: 'pending', form })
        }
      } catch {
        if (!cancelled) setState({ status: 'missing' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [formId, responseId, authLoading, uid])

  return (
    <div className="respond">
      <header className="respond-top">
        <span className="logo">PeraForm</span>
      </header>
      <main className="respond-main">
        {state.status === 'loading' ? (
          <div className="respond-skeleton" aria-busy="true" />
        ) : state.status === 'ready' ? (
          <QuizResult form={state.form} response={state.response} quiz={quizSettings(state.form)} />
        ) : (
          <section className="respond-card respond-notice">
            <h1>{state.form?.title || 'Quiz result'}</h1>
            <p>
              {state.status === 'missing'
                ? 'This quiz couldn’t be found.'
                : 'Your score hasn’t been released yet. Check back later on this device and browser.'}
            </p>
          </section>
        )}
      </main>
      <footer className="respond-foot">
        Made with <Link to="/">PeraForm</Link>
      </footer>
    </div>
  )
}
