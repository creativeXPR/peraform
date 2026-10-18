import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { CheckCircle2 } from 'lucide-react'
import { db } from '../../lib/firebase.js'
import QuizResult from './QuizResult.jsx'

const POLL_MS = 1500
const POLL_TRIES = 20

// After a quiz is submitted. Grading happens in a Cloud Function, and the
// respondent can only read their response once it's released — so for
// "release immediately" we poll until the grade appears.
export default function QuizSubmitted({ form, quiz, responseId, message }) {
  const [graded, setGraded] = useState(null)
  const [gaveUp, setGaveUp] = useState(false)
  const resultLink = `/f/${form.id}/r/${responseId}`

  useEffect(() => {
    if (quiz.release === 'manual') return
    let tries = 0
    let timer
    let cancelled = false
    const poll = async () => {
      try {
        const snap = await getDoc(doc(db, 'forms', form.id, 'responses', responseId))
        if (cancelled) return
        if (snap.exists() && snap.data().gradedAt) {
          setGraded(snap.data())
          return
        }
      } catch {
        // Not released yet (permission denied until the grader runs).
      }
      if (++tries >= POLL_TRIES) setGaveUp(true)
      else timer = setTimeout(poll, POLL_MS)
    }
    poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [form.id, responseId, quiz.release])

  if (graded) return <QuizResult form={form} response={graded} quiz={quiz} />

  const title = form.title || 'Untitled form'
  return (
    <section className="respond-card respond-notice">
      <CheckCircle2 size={36} className="respond-done-icon" />
      <h1>{title}</h1>
      <p>{message}</p>
      {quiz.release === 'manual' || gaveUp ? (
        <>
          <p>
            {quiz.release === 'manual'
              ? 'Your score will be available here once it’s been reviewed:'
              : 'Your score is taking a moment. It will appear here:'}
          </p>
          <Link to={resultLink} className="link-btn">
            {window.location.origin}
            {resultLink}
          </Link>
          <p className="quiz-score-note">Open it on this device and browser to see your score.</p>
        </>
      ) : (
        <p className="quiz-grading">Grading your answers…</p>
      )}
    </section>
  )
}
