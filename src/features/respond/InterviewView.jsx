import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MAX_END_WAIT, designedProps, play, prefersReducedMotion } from '../../lib/animations.js'
import { DEVICES, backgroundCss, frameOf, liveLayout } from '../../lib/interview.js'
import { findChoiceQuestion, isEnterBlocked, isTextInput } from '../../lib/interviewKeys.js'
import Stage from '../interview/Stage.jsx'

// A designed screen for respondents (interview mode), scaled to the width
// available — the phone design on phones, the desktop design elsewhere.
// Buttons call onButton(action); everything about answers, validation and
// submitting stays in RespondPage, shared with the normal form.
export default function InterviewView({
  design,
  device,
  questions,
  renderQuestion,
  onButton,
  overrides,
  overlay,
  leaveRef, // set to a function that plays the "before leaving" animations
  direction, // 'forward' | 'backward' | null
  progress, // { current, total } | null
  onEnter,
  onChoiceKey,
}) {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  // Before the screen changes: play every "before leaving" animation and wait
  // for them (at most MAX_END_WAIT, so a long one can't trap anyone).
  useEffect(() => {
    if (!leaveRef) return
    leaveRef.current = async () => {
      if (prefersReducedMotion() || !ref.current) return
      const runs = []
      for (const el of ref.current.querySelectorAll('[data-node-id]')) {
        const node = design.nodes[el.dataset.nodeId]
        const ov = overrides?.[node?.id]
        for (const anim of node?.animations ?? []) {
          if (anim.when !== 'end') continue
          const r = ov?.props?.rotate ?? frameOf(node, device).r ?? 0
          runs.push(play(el, anim, { ...ov?.props, r, rotate: 0 }, designedProps(node, ov)))
        }
      }
      if (!runs.length) return
      await Promise.race([Promise.all(runs), new Promise((done) => setTimeout(done, MAX_END_WAIT))])
    }
  })

  // Keyboard navigation on interview screens: Enter to continue, 1-9 to pick choices.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.defaultPrevented) return
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const target = document.activeElement || e.target

      // Enter goes on (next / submit), but not in multiline text, dropdowns, or buttons/links.
      if (e.key === 'Enter') {
        if (isEnterBlocked(target)) return
        e.preventDefault()
        onEnter?.()
        return
      }

      // 1-9 picks option 1-9 of multiple choice or checkbox question.
      if (e.key >= '1' && e.key <= '9') {
        if (isTextInput(target)) return
        const choiceQuestions = (questions || []).filter(
          (q) => q.type === 'multipleChoice' || q.type === 'checkboxes',
        )
        const choiceQ = findChoiceQuestion({ target, choiceQuestions })
        if (!choiceQ) return
        e.preventDefault()
        const optIndex = parseInt(e.key, 10) - 1
        onChoiceKey?.(choiceQ, optIndex)

        // Focus the chosen option input if present in DOM
        const inputs = document.querySelectorAll(
          `[data-question-id="${choiceQ.id}"] .respond-choice input, #q-${choiceQ.id} .respond-choice input`,
        )
        if (inputs && inputs[optIndex]) {
          inputs[optIndex].focus()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [questions, onEnter, onChoiceKey])

  const W = DEVICES[device].width
  const scale = width ? Math.min(1, width / W) : 0
  // Shorter while hidden blocks have given their space back.
  const H = liveLayout(design, device, overrides).height
  const slideClass = direction && !prefersReducedMotion() ? ` interview-slide-${direction}` : ''

  return (
    <div ref={ref} className={`interview-view interview-${device}`}>
      {/* The screen's background, behind the whole window. */}
      <div className="interview-backdrop" aria-hidden="true" style={{ background: backgroundCss(design.bg) ?? 'var(--bg)' }} />
      {progress && (
        <div
          className="interview-progress"
          role="progressbar"
          aria-label="Progress"
          aria-valuemin={1}
          aria-valuemax={progress.total}
          aria-valuenow={progress.current}
        >
          <span style={{ width: `${(progress.current / progress.total) * 100}%` }} />
        </div>
      )}
      {overlay}
      {scale > 0 && (
        <div className={`interview-frame${slideClass}`} style={{ width: W * scale, height: H * scale }}>
          <div className="interview-scale" style={{ transform: `scale(${scale})` }}>
            <Stage
              design={design}
              device={device}
              mode="live"
              transparentBg
              questions={questions}
              renderQuestion={renderQuestion}
              onButton={onButton}
              overrides={overrides}
            />
          </div>
        </div>
      )}
    </div>
  )
}
