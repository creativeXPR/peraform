import { useEffect, useRef, useState } from 'react'
import { callAiRun } from '../../lib/firebase.js'
import { formatCredits } from '../../../functions/billing/pricing.js'

// One AI run at a time, streamed: progress as it goes, seconds elapsed,
// friendly errors, and Cancel (always free: the server releases the hold).
//   run(feature, tier, input, { needed, spendable }) → the result, or null
//     (then `error` says why)
export function useAiRun() {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  // { stage: 'starting' | 'started' | 'writing' | 'saving', title, questions, written }
  const [progress, setProgress] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const abortRef = useRef(null)

  useEffect(() => {
    if (!running) return
    const started = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [running])

  async function run(feature, tier, input, credit = {}) {
    setRunning(true)
    setError('')
    setElapsed(0)
    setProgress({ stage: 'starting' })
    const controller = new AbortController()
    abortRef.current = { controller, holdId: null }
    try {
      const call = await callAiRun.stream({ feature, tier, input }, { signal: controller.signal })
      // call.data rejects too when the stream fails or is cancelled; the
      // loop below reports that, so don't let it surface as unhandled.
      call.data.catch(() => {})
      for await (const chunk of call.stream) {
        if (chunk.holdId) abortRef.current.holdId = chunk.holdId
        setProgress(chunk)
      }
      const data = await call.data
      setProgress((p) => ({ ...p, stage: 'saving' }))
      return data
    } catch (err) {
      setRunning(false)
      setProgress(null)
      if (controller.signal.aborted) setError('Cancelled. You weren’t charged.')
      else if (err.message === 'insufficient-credits') {
        setError(
          `This needs at least ${formatCredits(err.details?.needed ?? credit.needed ?? 0)} credits free and you have ${formatCredits(err.details?.spendable ?? credit.spendable ?? 0)}.`,
        )
      } else setError(err.message || 'Something went wrong. You weren’t charged; please try again.')
      return null
    }
  }

  // Call when the result has been used (or the dialog closes).
  function finish() {
    setRunning(false)
    setProgress(null)
  }

  // Ask the server to cancel first. If the run is still going, it's marked
  // so it's released, not charged, and we stop waiting. If it has just
  // finished (and been charged), keep the result: it's on its way.
  async function cancel() {
    const { controller, holdId } = abortRef.current ?? {}
    if (!holdId) {
      controller?.abort()
      return
    }
    try {
      const { data } = await callAiRun({ cancel: holdId })
      if (data.cancelled) controller.abort()
    } catch {
      controller.abort()
    }
  }

  return { running, error, setError, progress, elapsed, run, finish, cancel }
}

// A time stamp for a finished run (undo keys, report time). Called from
// event handlers only; kept here so the React compiler's purity check
// doesn't mistake handlers passed through props for render code.
export function stamp() {
  return Date.now()
}
