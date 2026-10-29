import { useState } from 'react'
import { CheckCircle2, Undo2 } from 'lucide-react'
import { AI_FEATURES, holdRange } from '../../../functions/ai/catalog.js'
import { formatCredits } from '../../../functions/billing/pricing.js'
import { DESIGN_STYLES, applyStyle, paletteFor, screenWords } from '../../lib/designStyles.js'
import { DEVICES, interviewOf, screenDesign, screensOf } from '../../lib/interview.js'
import { isQuestion } from '../../lib/formLogic.js'
import { applyScreenEdit, screenForAi } from '../../lib/screenEdit.js'
import { useFormEditor } from '../builder/editorContext.js'
import { useWallet } from '../credits/walletContext.js'
import { HoldLine, Progress, TierPicker } from './AiParts.jsx'
import AiStudio from './AiStudio.jsx'
import { SCREEN_IDEAS, STYLE_IDEAS } from './studioIdeas.js'
import { stamp, useAiRun } from './useAiRun.js'

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
    sub: 'What should change on this screen?',
    placeholder: 'e.g. Put the buttons side by side and make the heading bigger',
    ideas: SCREEN_IDEAS,
    unit: 'change',
    doing: 'Changing your screen…',
    submit: 'Change',
  },
  all: {
    feature: 'design-screens',
    label: 'All screens',
    sub: 'How should every screen look?',
    placeholder: 'e.g. Warm and welcoming, in our brand orange',
    ideas: STYLE_IDEAS,
    unit: 'screen',
    doing: 'Restyling your screens…',
    submit: 'Design',
  },
}

//   screenKey, device: the screen and device open in the editor ('screen' mode)
export default function DesignScreensDialog({ open, onClose, screenKey, device = 'phone' }) {
  const { form, draft, edit, undo, saveState } = useFormEditor()
  const { spendable, billing, loaded } = useWallet()
  const [mode, setMode] = useState('screen')
  const [instruction, setInstruction] = useState('')
  const [tiers, setTiers] = useState({}) // per mode
  const [done, setDone] = useState(null) // { summary, charged, style? , mode }
  const ai = useAiRun()

  const m = MODES[mode]
  const spec = AI_FEATURES[m.feature]
  const tier = tiers[mode] ?? spec.defaultTier
  const screens = screensOf(draft)
  const screen = screens.find((s) => s.key === screenKey) ?? screens[0]
  const deviceName = DEVICES[device].label.toLowerCase()
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

  async function run() {
    setDone(null)
    const input = mode === 'screen' ? { formId: form.id, instruction, screen: screenJson } : { formId: form.id, instruction }
    const data = await ai.run(m.feature, tier, input, { needed: range.min, spendable })
    if (!data) return
    if (mode === 'screen') {
      const key = screen.key
      edit(`ai-screen:${key}:${stamp()}`, (d) => {
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
      edit(`ai-design:${stamp()}`, (d) => {
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

  const tabs = !done && (
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
          {key === 'screen' ? `${x.label} (${deviceName})` : x.label}
        </button>
      ))}
    </div>
  )

  return (
    <AiStudio
      open={open}
      onClose={close}
      running={ai.running}
      label="Design with AI"
      sub={m.sub}
      tabs={tabs}
      ideas={m.ideas}
      onIdea={(idea) => setInstruction(idea.prompt)}
      middle={
        ai.running ? (
          <Progress progress={ai.progress} elapsed={ai.elapsed} doing={m.doing} unit={m.unit} />
        ) : done ? (
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
        ) : null
      }
      actions={
        done && (
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
        )
      }
      prompt={{
        value: instruction,
        onChange: setInstruction,
        placeholder: m.placeholder,
        maxChars: spec.maxChars[mode === 'screen' ? 'screen' : 'design'],
        onSubmit: run,
        submitLabel: unsaved ? 'Saving…' : m.submit,
        disabled: unsaved || tooBig,
        title: unsaved ? 'Saving your latest changes first…' : undefined,
      }}
      short={short}
      onCancel={ai.cancel}
      error={ai.error || (tooBig ? 'This screen has too many blocks to change with AI in one go.' : '')}
      optionsSummary={`Options · ${tier[0].toUpperCase() + tier.slice(1)} quality · up to ${formatCredits(range.max)} credits`}
      options={
        <>
          <TierPicker
            feature={m.feature}
            billing={billing}
            tier={tier}
            onTier={(t) => setTiers((all) => ({ ...all, [mode]: t }))}
            disabled={ai.running}
          />
          <HoldLine range={range} spendable={spendable} loaded={loaded} hidden={ai.running} />
        </>
      }
      note={
        mode === 'screen'
          ? `Layout changes apply to the ${deviceName} design; questions stay as they are. AI can make mistakes, so check the result. One Undo takes it back; cancelling is free.`
          : 'The AI picks a style and colours and writes each screen’s heading; your layout, questions and actions stay as they are. One Undo takes it back; cancelling is free.'
      }
    />
  )
}
