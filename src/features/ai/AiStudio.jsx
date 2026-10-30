import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, FileText, Shuffle, X } from 'lucide-react'
import { useAuth } from '../auth/useAuth.js'
import DawnOrb from './DawnOrb.jsx'
import IdeaArt from './IdeaArt.jsx'
import { dawnGreeting } from './dawn.js'
import './ai.css'

const SHOWN = 3

// The frame every AI window shares (Create, Edit, Design, Analyse): Dawn,
// Quality Tools' AI. Its orb and what it's doing on top, the form it's
// working on, a time-of-day greeting with the question, illustrated ideas
// (Shuffle for more), a clean field with the "Ask Dawn" button, a quiet
// Options line (quality and credits) and a note. A warm glow sits at the
// horizon; while Dawn works it rises and Dawn's colours circle the edge.
// While it runs or once it's done, `middle` replaces the ideas.
//
//   open, onClose, running          the dialog, and whether a run is going
//   label                           what Dawn is doing, e.g. "Edit this form"
//   context                         the quiet line under it (form, size, saved)
//   sub                             the question under the greeting
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
  context,
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
  note = 'Dawn can make mistakes, so check the result before you share it. Uses your Quality Tools AI credits; cancelling is free.',
  actions,
}) {
  const ref = useRef(null)
  const inputRef = useRef(null)
  const { user } = useAuth()
  const [first, setFirst] = useState(() => Math.floor(Math.random() * Math.max(1, ideas.length)))
  const done = Boolean(actions)

  // Opening: the edge glows once. Done: the horizon brightens once.
  // (Classes on the dialog itself, so nothing re-renders for them.)
  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) {
      dialog.showModal()
      flash(dialog, 'is-opening', 1900)
    }
    if (!open && dialog.open) dialog.close()
  }, [open])
  useEffect(() => {
    if (done) flash(ref.current, 'is-landed', 1200)
  }, [done])

  // The field grows with what's typed (up to a few lines, then scrolls).
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
      className={`ai-create is-dawn${running ? ' is-thinking' : ''}`}
      aria-label={`Dawn · ${label}`}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => e.target === ref.current && close()}
    >
      <div className="dawn-glow" aria-hidden="true" />
      <div className="dawn-edge is-soft" aria-hidden="true" />
      <div className="dawn-edge" aria-hidden="true" />
      <form
        className="ai-create-body"
        onSubmit={(e) => {
          e.preventDefault()
          if (!running && canSend) prompt.onSubmit()
        }}
      >
        <header className="ai-create-top dawn-top">
          <span className="dawn-brand">
            <DawnOrb size={30} />
            <b>Dawn</b>
            <span className="dawn-what">· {label}</span>
          </span>
          <button type="button" className="icon-btn" onClick={close} aria-label="Close" disabled={running}>
            <X size={20} />
          </button>
        </header>
        {context && (
          <p className="dawn-context">
            <FileText size={15} aria-hidden="true" /> {context}
          </p>
        )}

        <h2 className="dawn-hello">
          <span className="dawn-greet">{dawnGreeting(name)}</span>
          <span className="dawn-ask">{sub}</span>
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
                  className={`ai-idea${idea.prompt === prompt?.value ? ' is-picked' : ''}`}
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
                <button type="button" className="dawn-go is-cancel" onClick={onCancel}>
                  Cancel
                </button>
              ) : short ? (
                <Link to="/credits" className="dawn-go">
                  Top up
                </Link>
              ) : (
                <button type="submit" className="dawn-go" disabled={!canSend} title={prompt.title}>
                  <DawnOrb size={32} />
                  {prompt.submitLabel ?? 'Ask Dawn'}
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

// Adds a class for one animation, then takes it off again.
function flash(el, cls, ms) {
  el.classList.remove(cls)
  void el.offsetWidth
  el.classList.add(cls)
  setTimeout(() => el.classList.remove(cls), ms)
}
