import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUp, ChevronDown, Shuffle, Sparkles, X } from 'lucide-react'
import { useAuth } from '../auth/useAuth.js'
import IdeaArt from './IdeaArt.jsx'
import './ai.css'

const SHOWN = 3

// The frame every AI window shares (Create, Edit, Design with AI, Analyse
// results): a greeting, illustrated ideas (Shuffle for more), a chat-style
// prompt bar, a quiet "Options" line (quality and credits) and a note.
// Each window supplies its words, ideas and what happens; while it runs or
// once it's done, `middle` replaces the ideas.
//
//   open, onClose, running          the dialog, and whether a run is going
//   label                           top-left, e.g. "Edit with AI"
//   sub                             under "Hello, <name>"
//   tabs                            optional switch under the greeting
//   ideas [{ key, title, prompt, art, icon }], onIdea(idea)
//   middle                          progress or the result, instead of ideas
//   prompt { value, onChange, placeholder, maxChars, onSubmit, submitLabel,
//            disabled, title, leading, multiline, hidden, optional }
//                                   optional: may be sent empty
//   short                           not enough credits: Top up instead
//   onCancel                        while running
//   options, optionsSummary         the Options line and what opens
//   error, note, actions            actions: buttons shown instead of the
//                                   prompt (e.g. Undo / Done)
export default function AiStudio({
  open,
  onClose,
  running,
  label,
  sub,
  tabs,
  ideas = [],
  onIdea,
  middle,
  prompt,
  short,
  onCancel,
  options,
  optionsSummary,
  error,
  note = 'AI can make mistakes, so check the result before you share it. Uses your Quality Tools AI credits; cancelling is free.',
  actions,
}) {
  const ref = useRef(null)
  const inputRef = useRef(null)
  const { user } = useAuth()
  const [first, setFirst] = useState(() => Math.floor(Math.random() * Math.max(1, ideas.length)))

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
    el.style.height = `${Math.min(el.scrollHeight, prompt?.multiline ? 320 : 160)}px`
  }, [prompt?.value, prompt?.multiline, open])

  function close() {
    if (!running) onClose()
  }

  const name = (user?.displayName || '').trim().split(/\s+/)[0]
  const shown = ideas.length > SHOWN ? Array.from({ length: SHOWN }, (_, i) => ideas[(first + i) % ideas.length]) : ideas
  const typed = (prompt?.value ?? '').trim().length
  const canSend = prompt && !prompt.disabled && (prompt.optional ? typed === 0 || typed >= 3 : typed >= 3)

  return (
    <dialog
      ref={ref}
      className="ai-create"
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => e.target === ref.current && close()}
    >
      <form
        className="ai-create-body"
        onSubmit={(e) => {
          e.preventDefault()
          if (!running && canSend) prompt.onSubmit()
        }}
      >
        <header className="ai-create-top">
          <span className="ai-create-brand">
            <Sparkles size={16} aria-hidden="true" /> {label}
          </span>
          <button type="button" className="icon-btn" onClick={close} aria-label="Close" disabled={running}>
            <X size={20} />
          </button>
        </header>

        <h2 className="ai-hello">
          <span className="ai-hello-name">{name ? `Hello, ${name}` : 'Hello'}</span>
          <span className="ai-hello-sub">{sub}</span>
        </h2>

        {tabs}

        {middle ? (
          <div className="ai-create-progress">{middle}</div>
        ) : (
          shown.length > 0 && (
            <div className={`ai-ideas${ideas.length > SHOWN ? '' : ' no-shuffle'}`}>
              {shown.map((idea, i) => (
                <button
                  key={idea.key}
                  type="button"
                  className="ai-idea"
                  onClick={() => {
                    onIdea(idea)
                    requestAnimationFrame(() => inputRef.current?.focus())
                  }}
                  title={idea.prompt}
                >
                  <span className="ai-idea-title">{idea.title}</span>
                  <IdeaArt art={idea.art} icon={idea.icon} flip={i % 2 === 1} />
                </button>
              ))}
              {ideas.length > SHOWN && (
                <button
                  type="button"
                  className="ai-shuffle"
                  onClick={() => setFirst((f) => (f + SHOWN) % ideas.length)}
                  aria-label="Show other ideas"
                  title="Other ideas"
                >
                  <Shuffle size={18} />
                </button>
              )}
            </div>
          )
        )}

        {actions ? (
          <div className="ai-create-actions">{actions}</div>
        ) : (
          prompt &&
          !prompt.hidden && (
            <div className={`ai-prompt${prompt.multiline ? ' is-doc' : ''}`}>
              {prompt.leading}
              <textarea
                ref={inputRef}
                value={prompt.value}
                onChange={(e) => prompt.onChange(e.target.value)}
                onKeyDown={(e) => {
                  // Enter sends (Shift+Enter for a new line), like a chat box.
                  if (!prompt.multiline && e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (!running && canSend) prompt.onSubmit()
                  }
                }}
                maxLength={prompt.maxChars}
                rows={1}
                disabled={running}
                aria-label={prompt.placeholder}
                placeholder={prompt.placeholder}
              />
              {running ? (
                <button type="button" className="ai-prompt-go is-cancel" onClick={onCancel}>
                  Cancel
                </button>
              ) : short ? (
                <Link to="/credits" className="ai-prompt-go">
                  Top up
                </Link>
              ) : (
                <button type="submit" className="ai-prompt-go" disabled={!canSend} title={prompt.title}>
                  <ArrowUp size={16} aria-hidden="true" /> {prompt.submitLabel ?? 'Go'}
                </button>
              )}
            </div>
          )
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {options && !actions && (
          <details className="ai-create-options">
            <summary>
              {optionsSummary}
              <ChevronDown size={14} aria-hidden="true" />
            </summary>
            {options}
          </details>
        )}

        <p className="ai-create-note">{note}</p>
      </form>
    </dialog>
  )
}
