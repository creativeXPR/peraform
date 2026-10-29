import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUp, ChevronDown, FileText, Shuffle, Sparkles, X } from 'lucide-react'
import { AI_FEATURES, holdRange } from '../../../functions/ai/catalog.js'
import { formatCredits } from '../../../functions/billing/pricing.js'
import { useAuth } from '../auth/useAuth.js'
import { useWallet } from '../credits/walletContext.js'
import { createForm, parseFormContent } from '../dashboard/formActions.js'
import { HoldLine, Progress, TierPicker } from './AiParts.jsx'
import { IDEAS } from './createIdeas.js'
import IdeaArt from './IdeaArt.jsx'
import { useAiRun } from './useAiRun.js'
import './ai.css'

const FEATURE = 'generate-form'
const spec = AI_FEATURES[FEATURE]
const SHOWN = 3

// "Create with AI": a greeting, three illustrated ideas (Shuffle for more),
// and one prompt bar — describe the form, or switch to pasting a document.
// Quality level and the credit estimate sit in a quiet "Options" line;
// while it writes, the ideas give way to live progress (each question
// appears as it's written). Cancel is free.
export default function GenerateFormDialog({ open, onClose }) {
  const ref = useRef(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const { user } = useAuth()
  const { spendable, billing, loaded } = useWallet()
  const [mode, setMode] = useState('describe')
  const [text, setText] = useState('')
  const [tier, setTier] = useState(spec.defaultTier)
  const [first, setFirst] = useState(() => Math.floor(Math.random() * IDEAS.length))
  const ai = useAiRun()

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // The prompt bar grows with what's typed (up to a few lines, then scrolls).
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, mode === 'describe' ? 160 : 320)}px`
  }, [text, mode, open])

  const maxChars = spec.maxChars[mode]
  // A run reserves its full budget, or what's spare if that's less (down to
  // the minimum a form needs).
  const range = holdRange(billing, FEATURE, tier, mode, Math.max(text.trim().length, 1))
  const short = loaded && spendable < range.min
  const name = (user?.displayName || '').trim().split(/\s+/)[0]
  const ideas = Array.from({ length: SHOWN }, (_, i) => IDEAS[(first + i) % IDEAS.length])

  function close() {
    if (!ai.running) onClose()
  }

  function pickIdea(idea) {
    setMode('describe')
    setText(idea.prompt)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  async function generate(e) {
    e.preventDefault()
    if (ai.running || text.trim().length < 3) return
    const data = await ai.run(FEATURE, tier, { mode, text }, { needed: range.min, spendable })
    if (!data) return
    try {
      const id = await createForm(user.uid, parseFormContent(data.result.form, 'AI form'))
      navigate(`/forms/${id}/edit`, {
        state: { notice: `Made with AI · used ${formatCredits(data.charged)} credits` },
      })
    } catch {
      ai.finish()
      ai.setError('The form was written but couldn’t be saved. Please try again.')
    }
  }

  return (
    <dialog
      ref={ref}
      className="ai-create"
      aria-label="Create with AI"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => e.target === ref.current && close()}
    >
      <form className="ai-create-body" onSubmit={generate}>
        <header className="ai-create-top">
          <span className="ai-create-brand">
            <Sparkles size={16} aria-hidden="true" /> Create with AI
          </span>
          <button type="button" className="icon-btn" onClick={close} aria-label="Close" disabled={ai.running}>
            <X size={20} />
          </button>
        </header>

        <h2 className="ai-hello">
          <span className="ai-hello-name">{name ? `Hello, ${name}` : 'Hello'}</span>
          <span className="ai-hello-sub">{mode === 'describe' ? 'Let’s create a form' : 'Turn a document into a form'}</span>
        </h2>

        {ai.running ? (
          <div className="ai-create-progress">
            <Progress progress={ai.progress} elapsed={ai.elapsed} />
          </div>
        ) : mode === 'describe' ? (
          <div className="ai-ideas">
            {ideas.map((idea, i) => (
              <button key={idea.key} type="button" className="ai-idea" onClick={() => pickIdea(idea)} title={idea.prompt}>
                <span className="ai-idea-title">{idea.title}</span>
                <IdeaArt art={idea.art} icon={idea.icon} flip={i % 2 === 1} />
              </button>
            ))}
            <button
              type="button"
              className="ai-shuffle"
              onClick={() => setFirst((f) => (f + SHOWN) % IDEAS.length)}
              aria-label="Show other ideas"
              title="Other ideas"
            >
              <Shuffle size={18} />
            </button>
          </div>
        ) : (
          <p className="ai-doc-hint">
            Paste a questionnaire, a printout’s text, meeting notes or a syllabus below — the AI keeps its questions and
            answer choices and picks the best question types.
          </p>
        )}

        <div className={`ai-prompt${mode === 'text' ? ' is-doc' : ''}`}>
          <button
            type="button"
            className={`ai-prompt-mode${mode === 'text' ? ' is-on' : ''}`}
            onClick={() => {
              setMode((m) => (m === 'text' ? 'describe' : 'text'))
              requestAnimationFrame(() => inputRef.current?.focus())
            }}
            aria-pressed={mode === 'text'}
            title={mode === 'text' ? 'Describe it instead' : 'Paste a document instead'}
            aria-label={mode === 'text' ? 'Describe it instead' : 'Paste a document instead'}
            disabled={ai.running}
          >
            <FileText size={18} />
          </button>
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter creates (Shift+Enter for a new line), like a chat box.
              if (mode === 'describe' && e.key === 'Enter' && !e.shiftKey) generate(e)
            }}
            maxLength={maxChars}
            rows={1}
            disabled={ai.running}
            aria-label={mode === 'describe' ? 'Describe the form you want' : 'The document’s text'}
            placeholder={
              mode === 'describe'
                ? 'Describe the form or quiz you want to create…'
                : 'Paste the document’s text here…'
            }
          />
          {ai.running ? (
            <button type="button" className="ai-prompt-go is-cancel" onClick={ai.cancel}>
              Cancel
            </button>
          ) : short ? (
            <Link to="/credits" className="ai-prompt-go">
              Top up
            </Link>
          ) : (
            <button type="submit" className="ai-prompt-go" disabled={text.trim().length < 3}>
              <ArrowUp size={16} aria-hidden="true" /> Create
            </button>
          )}
        </div>

        {ai.error && (
          <p className="form-error" role="alert">
            {ai.error}
          </p>
        )}

        <details className="ai-create-options">
          <summary>
            Options · {tier[0].toUpperCase() + tier.slice(1)} quality · up to {formatCredits(range.max)} credits
            {text.length > 0 && ` · ${text.length.toLocaleString()} / ${maxChars.toLocaleString()} characters`}
            <ChevronDown size={14} aria-hidden="true" />
          </summary>
          <TierPicker feature={FEATURE} billing={billing} tier={tier} onTier={setTier} disabled={ai.running} />
          <HoldLine range={range} spendable={spendable} loaded={loaded} hidden={ai.running} />
        </details>

        <p className="ai-create-note">
          AI can make mistakes, so check the form before you share it. Uses your Quality Tools AI credits; cancelling is
          free.
        </p>
      </form>
    </dialog>
  )
}
