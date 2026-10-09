import { useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, Copy, GripHorizontal, Trash2, X } from 'lucide-react'
import AutoTextarea from '../../lib/AutoTextarea.jsx'
import { QUESTION_TYPES } from '../../lib/formModel.js'
import MenuButton from '../../lib/MenuButton.jsx'
import { OPTION_TYPES, TYPE_INFO, changeQuestionType } from './questionTypes.js'

// One question in the builder. Inactive: a read-only preview, click to edit.
// Active: full editor. `change(field, updater)` edits this question with
// field-level undo coalescing.
export default function QuestionCard({
  question,
  active,
  onActivate,
  change,
  onDuplicate,
  onDelete,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id })

  const style = { transform: CSS.Translate.toString(transform), transition }
  const info = TYPE_INFO[question.type]

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={`q-card${active ? ' q-card-active' : ''}${isDragging ? ' q-card-dragging' : ''}`}
      onClick={() => !active && onActivate()}
      onFocus={() => !active && onActivate()}
      aria-label={question.title || 'Untitled question'}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="q-drag"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripHorizontal size={16} />
      </button>

      {active ? (
        <>
          <div className="q-head">
            <AutoTextarea
              className="q-title-input"
              value={question.title}
              placeholder="Question"
              aria-label="Question"
              onChange={(e) => {
                const title = e.target.value
                change('title', (q) => ({ ...q, title }))
              }}
            />
            <MenuButton
              className="type-menu"
              label={`Question type: ${info.label}`}
              icon={
                <span className="type-trigger">
                  <info.icon size={16} />
                  <span>{info.label}</span>
                  <ChevronDown size={14} />
                </span>
              }
              items={QUESTION_TYPES.map((type) => ({
                label: TYPE_INFO[type].label,
                icon: TYPE_INFO[type].icon,
                checked: type === question.type,
                onSelect: () => change('type', (q) => changeQuestionType(q, type)),
              }))}
            />
          </div>
          <AutoTextarea
            className="q-desc-input"
            value={question.description}
            placeholder="Description (optional)"
            aria-label="Question description"
            onChange={(e) => {
              const description = e.target.value
              change('description', (q) => ({ ...q, description }))
            }}
          />

          {OPTION_TYPES.includes(question.type) ? (
            <OptionsEditor question={question} change={change} />
          ) : (
            <p className="q-hint">{info.hint}</p>
          )}

          <footer className="q-foot">
            <button
              type="button"
              className="icon-btn"
              onClick={onDuplicate}
              aria-label="Duplicate question"
              title="Duplicate"
            >
              <Copy size={18} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={onDelete}
              aria-label="Delete question"
              title="Delete"
            >
              <Trash2 size={18} />
            </button>
            <span className="q-foot-divider" />
            <label className="switch">
              <span>Required</span>
              <input
                type="checkbox"
                role="switch"
                checked={question.required}
                onChange={(e) => {
                  const required = e.target.checked
                  change('required', (q) => ({ ...q, required }))
                }}
              />
            </label>
          </footer>
        </>
      ) : (
        <QuestionPreview question={question} />
      )}
    </section>
  )
}

function Marker({ type, index }) {
  if (type === 'dropdown') return <span className="q-marker q-marker-num">{index + 1}.</span>
  return <span className={`q-marker q-marker-${type === 'checkboxes' ? 'box' : 'circle'}`} />
}

function OptionsEditor({ question, change }) {
  const { options, type } = question
  const listRef = useRef(null)

  // After adding, put the cursor in the new option (after React renders it).
  const focusOption = (i) =>
    requestAnimationFrame(() => listRef.current?.querySelectorAll('input')[i]?.focus())

  const setOption = (i, value) =>
    change(`option-${i}`, (q) => ({
      ...q,
      options: q.options.map((o, j) => (j === i ? value : o)),
    }))

  const addOption = (after = options.length - 1) => {
    change('options', (q) => {
      const next = [...q.options]
      next.splice(after + 1, 0, `Option ${q.options.length + 1}`)
      return { ...q, options: next }
    })
    focusOption(after + 1)
  }

  const removeOption = (i) =>
    change('options', (q) => ({ ...q, options: q.options.filter((_, j) => j !== i) }))

  return (
    <ol className="q-options" ref={listRef}>
      {options.map((option, i) => (
        <li key={i} className="q-option">
          <Marker type={type} index={i} />
          <input
            value={option}
            aria-label={`Option ${i + 1}`}
            onChange={(e) => setOption(i, e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addOption(i)
              }
            }}
          />
          {options.length > 1 && (
            <button
              type="button"
              className="icon-btn q-option-remove"
              onClick={() => removeOption(i)}
              aria-label={`Remove option ${i + 1}`}
            >
              <X size={16} />
            </button>
          )}
        </li>
      ))}
      <li className="q-option">
        <Marker type={type} index={options.length} />
        <button type="button" className="link-btn q-add-option" onClick={() => addOption()}>
          Add option
        </button>
      </li>
    </ol>
  )
}

function QuestionPreview({ question }) {
  const info = TYPE_INFO[question.type]
  return (
    <div className="q-preview">
      <p className="q-preview-title">
        {question.title || <span className="muted">Untitled question</span>}
        {question.required && <span className="q-required"> *</span>}
      </p>
      {question.description && <p className="q-preview-desc">{question.description}</p>}
      {question.options ? (
        <ol className="q-options">
          {question.options.map((option, i) => (
            <li key={i} className="q-option">
              <Marker type={question.type} index={i} />
              <span>{option}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="q-hint">{info.hint}</p>
      )}
    </div>
  )
}
