import { useLayoutEffect, useRef, useState } from 'react'
import { DEVICES, stageHeight } from '../../lib/interview.js'
import Stage from '../interview/Stage.jsx'

// A designed screen for respondents (interview mode), scaled to the width
// available — the phone design on phones, the desktop design elsewhere.
// Buttons call onButton(action); everything about answers, validation and
// submitting stays in RespondPage, shared with the normal form.
export default function InterviewView({ design, device, questions, renderQuestion, onButton, overlay }) {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  const W = DEVICES[device].width
  const scale = width ? Math.min(1, width / W) : 0
  const H = stageHeight(design, device)

  return (
    <div ref={ref} className={`interview-view interview-${device}`}>
      {overlay}
      {scale > 0 && (
        <div className="interview-frame" style={{ width: W * scale, height: H * scale }}>
          <div className="interview-scale" style={{ transform: `scale(${scale})` }}>
            <Stage
              design={design}
              device={device}
              mode="live"
              questions={questions}
              renderQuestion={renderQuestion}
              onButton={onButton}
            />
          </div>
        </div>
      )}
    </div>
  )
}
