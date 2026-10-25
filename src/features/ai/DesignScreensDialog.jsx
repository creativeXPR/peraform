import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Sparkles, Undo2, X } from 'lucide-react'
import { AI_FEATURES, holdRange } from '../../../functions/ai/catalog.js'
import { formatCredits } from '../../../functions/billing/pricing.js'
import { DESIGN_STYLES, applyStyle, paletteFor, screenWords } from '../../lib/designStyles.js'
import { DEVICES, interviewOf, screenDesign, screensOf } from '../../lib/interview.js'
import { isQuestion } from '../../lib/formLogic.js'
import { applyScreenEdit, screenForAi } from '../../lib/screenEdit.js'
import { useFormEditor } from '../builder/editorContext.js'
import { useWallet } from '../credits/walletContext.js'
import { HoldLine, Progress, TierPicker } from './AiParts.jsx'
import { useAiRun } from './useAiRun.js'
import './ai.css'

// Two ways to design with AI:
//   'screen' — change the screen you're on, block by block ("move the
//              button left", "add an image under the title"); edit-screen
//   'all'    — restyle every screen: a design style, colours, and each
//              screen's heading and subtitle; design-screens
// Either way the result is one undo step.
const MODES = {
  screen: {
    feature: 'edit-screen',
    label: 'This screen',
    intro: 'Say what to change on this screen: move, resize, restyle, add or remove blocks. Questions stay as they are.',
    placeholder: 'What should change? e.g. Put the buttons side by side and make the heading bigger.',
    examples: [
      'Centre everything and make the heading bigger',
      'Add an image above the heading',
      'Put the buttons side by side at the bottom',
      'Make the card glassy on a purple gradient',
    ],
    unit: 'change',
    doing: 'Changing your screen…',
    submit: 'Change this screen',
  },
  all: {
    feature: 'design-screens',
    label: 'All screens',
    intro: 'Describe the look you want. The AI picks a style and colours and writes each screen’s heading; your layout, questions and actions stay as they are.',
    placeholder: 'How should it look? e.g. Warm and welcoming, in our brand orange.',
    examples: [
      'Fun and colourful, for a kids’ party',
      'Formal, for a university quality office',
      'Calm and clear, for a school quiz',
      'Dark and techy, for a hackathon',
    ],
    unit: 'screen',
    doing: 'Restyling your screens…',
    submit: 'Design my screens',
  },
}

//   screenKey, device: the screen and device open in the editor ('screen' mode)
export default function DesignScreensDialog({ open, onClose, screenKey, device = 'phone' }) {
  const ref = useRef(null)
  const { form, draft, edit, undo, saveState } = useFormEditor()
  const { spendable, billing, loaded } = useWallet()
  const [mode, setMode] = useState('screen')
  const [instruction, setInstruction] = useState('')
  const [tiers, setTiers] = useState({}) // per mode
  const [done, setDone] = useState(null) // { summary, charged, style? , mode }
  const ai = useAiRun()

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const m = MODES[mode]
  const spec = AI_FEATURES[m.feature]
  const tier = tiers[mode] ?? spec.defaultTier
  const screens = screensOf(draft)
  const screen = screens.find((s) => s.key === screenKey) ?? screens[0]
  // What the AI reads: this screen (as the creator sees it now), or every
  // screen's title.
  const screenJson = mode === 'screen' ? screenForAi(screenDesign(draft, screen, screens), device, draft.questions.filter(isQuestion)) : null
  const chars =
    mode === 'screen' ? JSON.stringify(screenJson).length : screens.reduce((n, s) => n + s.title.length + 120, 0)
  const range = holdRange(billing, m.feature, tier, mode === 'screen' ? 'screen' : 'design', chars + Math.max(instruction.trim().length, 1))
  const short = loaded && spendable < range.min
  // Restyling every screen reads the saved form on the server.
  const unsaved = mode === 'all' && saveState !== 'saved'
  const tooBig = mode === 'screen' && chars > spec.maxScreenChars

  function close() {
    if (ai.running) return
    setDone(null)
    onClose()
  }

  async function run(e) {
    e.preventDefault()
    setDone(null)
    const input = mode === 'screen' ? { formId: form.id, instruction, screen: screenJson } : { formId: form.id, instruction }
    const data = await ai.run(m.feature, tier, input, { needed: range.min, spendable })
    if (!data) return
    if (mode === 'screen') {
      const key = screen.key
      edit(`ai-screen:${key}:${Date.now()}`, (d) => {
        const all = screensOf(d)
        const target = all.find((s) => s.key === key)
        if (!target) return d
        const iv = interviewOf(d)
        const { design } = applyScreenEdit(screenDesign(d, target, all), data.result, device)
        return { ...d, interview: { ...iv, screens: { ...iv.screens, [key]: design } } }
      })
      ai.finish()
      setDone({ mode, summary: data.result.summary, charged: data.charged })
    } else {
      const { style, palette, screens: words } = data.result.design
      edit(`ai-design:${Date.now()}`, (d) => {
        const all = screensOf(d)
        const iv = interviewOf(d)
        const next = { ...iv.screens }
        const colours = paletteFor(style, palette)
        for (const s of all) {
          const w = words.find((x) => x.key === s.key)
          const styled = applyStyle(screenDesign(d, s, all), style, colours)
          next[s.key] = w ? screenWords(styled, w) : styled
        }
        return { ...d, interview: { ...iv, screens: next } }
      })
      ai.finish()
      setDone({ mode, summary: data.result.summary, charged: data.charged, style })
    }
    setInstruction('')
  }

  return (
    <dialog
      ref={ref}
      className="confirm ai-dialog"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => e.target === ref.current && close()}
    >
      <form className="confirm-body" onSubmit={run}>
        <div className="collab-head">
          <h2>
            <Sparkles size={18} /> Design with AI
          </h2>
          <button type="button" className="icon-btn" onClick={close} aria-label="Close" disabled={ai.running}>
            <X size={18} />
          </button>
        </div>

        {done ? (
          <section className="ai-done" aria-live="polite">
            <p className="ai-done-head">
              <CheckCircle2 size={18} />{' '}
              {done.mode === 'screen' ? 'Screen changed' : `${DESIGN_STYLES[done.style]?.label} style`} · used{' '}
              {formatCredits(done.charged)} credits
            </p>
            {done.summary && <p>{done.summary}</p>}
            <p className="ai-hold">
              Not quite right? Undo puts {done.mode === 'screen' ? 'the screen' : 'every screen'} back exactly as it was.
            </p>
          </section>
        ) : (
          <>
            <div className="segmented ai-modes" role="radiogroup" aria-label="What to design">
              {Object.entries(MODES).map(([key, x]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={mode === key}
                  className={mode === key ? 'active' : ''}
                  onClick={() => setMode(key)}
                  disabled={ai.running}
                >
                  {key === 'screen' ? `${x.label} (${DEVICES[device].label.toLowerCase()})` : x.label}
                </button>
              ))}
            </div>
            <p className="ai-hold" style={{ margin: 0 }}>
              {m.intro}
              {mode === 'screen' && ` Layout changes apply to the ${DEVICES[device].label.toLowerCase()} design.`}
            </p>
            <label className="ai-field">
              <span className="sr-only">{mode === 'screen' ? 'What should change?' : 'How should the screens look?'}</span>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                maxLength={spec.maxChars[mode === 'screen' ? 'screen' : 'design']}
                rows={3}
                disabled={ai.running}
                placeholder={m.placeholder}
                required
              />
              <span className="ai-count">
                {instruction.length.toLocaleString()} / {spec.maxChars[mode === 'screen' ? 'screen' : 'design'].toLocaleString()}
              </span>
            </label>
            {!instruction && !ai.running && (
              <div className="ai-examples">
                {m.examples.map((x) => (
                  <button key={x} type="button" className="ai-example" onClick={() => setInstruction(x)}>
                    {x}
                  </button>
                ))}
              </div>
            )}

            <TierPicker
              feature={m.feature}
              billing={billing}
              tier={tier}
              onTier={(t) => setTiers((all) => ({ ...all, [mode]: t }))}
              disabled={ai.running}
            />

            {ai.running && <Progress progress={ai.progress} elapsed={ai.elapsed} doing={m.doing} unit={m.unit} />}
            <HoldLine range={range} spendable={spendable} loaded={loaded} hidden={ai.running} />
            {tooBig && (
              <p className="form-error" role="alert">
                This screen has too many blocks to change with AI in one go.
              </p>
            )}
          </>
        )}
        {ai.error && (
          <p className="form-error" role="alert">
            {ai.error}
          </p>
        )}

        <div className="confirm-actions">
          {done ? (
            <>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  undo()
                  setDone(null)
                }}
              >
                <Undo2 size={16} /> Undo
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setDone(null)}>
                {done.mode === 'screen' ? 'Change something else' : 'Try another look'}
              </button>
              <button type="button" className="btn btn-primary" onClick={close}>
                Done
              </button>
            </>
          ) : (
            <>
              {ai.running && (
                <button type="button" className="btn btn-outline" onClick={ai.cancel}>
                  Cancel
                </button>
              )}
              {short ? (
                <Link to="/credits" className="btn btn-primary">
                  Top up credits
                </Link>
              ) : (
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={ai.running || unsaved || tooBig || instruction.trim().length < 3}
                  title={unsaved ? 'Saving your latest changes first…' : undefined}
                >
                  <Sparkles size={16} />
                  {ai.running ? 'Designing…' : unsaved ? 'Saving…' : m.submit}
                </button>
              )}
            </>
          )}
        </div>
      </form>
    </dialog>
  )
}
