import { useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ChevronDown,
  CircleCheckBig,
  Copy,
  GripHorizontal,
  MoreVertical,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import AutoTextarea from '../../lib/AutoTextarea.jsx'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import { BRANCHING_TYPES, GRID_TYPES } from '../../lib/formLogic.js'
import { QUESTION_TYPES } from '../../lib/formModel.js'
import MenuButton from '../../lib/MenuButton.jsx'
import { VALIDATION_KINDS, newValidation } from '../../lib/validation.js'
import AnswerKeyEditor from './AnswerKeyEditor.jsx'
import FileUploadEditor from './FileUploadEditor.jsx'
import ImagePicker from './ImagePicker.jsx'
import TargetSelect from './TargetSelect.jsx'
import ValidationEditor from './ValidationEditor.jsx'
import { OPTION_TYPES, TYPE_INFO, changeQuestionType } from './questionTypes.js'
import { newAction, triggerKindFor } from '../../lib/actions.js'
import ActionsEditor from '../interview/ActionsEditor.jsx'

// One question in the builder. Inactive: a read-only preview, click to edit.
// Active: full editor. `change(field, updater)` edits this question with
// field-level undo coalescing. `targets` is non-empty only when the form has
// sections, which is when "go to section based on answer" makes sense.
export default function QuestionCard({
  question,
  active,
  onActivate,
  change,
  onDuplicate,
  onDelete,
  targets,
  renameOption,
  quiz,
  keyEntry,
  changeKey,
  actionTargets = [], // [{ id, label }] other items its actions can show or hide
}) {
  // Quiz forms: the card flips between the question and its answer key.
  const [keyMode, setKeyMode] = useState(false)
  const [removingImage, setRemovingImage] = useState(false)
  const [clearingActions, setClearingActions] = useState(false)
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
  const canBranch = BRANCHING_TYPES.includes(question.type) && targets.length > 0
  const canValidate = Boolean(VALIDATION_KINDS[question.type])

  const toggleValidation = () =>
    change('validation', (q) => {
      if (!q.validation) return { ...q, validation: newValidation(q.type) }
      const rest = { ...q }
      delete rest.validation
      return rest
    })

  const toggleBranching = () =>
    change('branching', (q) => {
      if (q.branching) {
        const rest = { ...q }
        delete rest.branching
        delete rest.goTo
        return rest
      }
      return { ...q, branching: true, goTo: q.options.map(() => 'next') }
    })

  const moreItems = []
  if (OPTION_TYPES.includes(question.type)) {
    moreItems.push({
      label: 'Shuffle option order',
      checked: Boolean(question.shuffleOptions),
      onSelect: () =>
        change('shuffleOptions', (q) => {
          const next = { ...q, shuffleOptions: !q.shuffleOptions }
          if (!next.shuffleOptions) delete next.shuffleOptions
          return next
        }),
    })
  }
  if (canValidate) {
    moreItems.push({
      label: 'Response validation',
      checked: Boolean(question.validation),
      onSelect: toggleValidation,
    })
  }
  // Actions: choosing an option / typing a match shows or hides other items.
  const actionTrigger = triggerKindFor(question)
  if (actionTrigger && actionTargets.length) {
    moreItems.push({
      label: 'Show or hide other questions',
      checked: Boolean(question.actions?.length),
      onSelect: () =>
        question.actions?.length
          ? setClearingActions(true)
          : change('actions', (q) => ({
              ...q,
              actions: [
                newAction(
                  actionTrigger === 'select'
                    ? { type: 'select', option: q.options?.[0] ?? '' }
                    : { type: 'match', pattern: '' },
                ),
              ],
            })),
    })
  }
  if (canBranch) {
    moreItems.push({
      label: 'Go to section based on answer',
      checked: Boolean(question.branching),
      onSelect: toggleBranching,
    })
  }

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

      {active && quiz && keyMode ? (
        <AnswerKeyEditor
          question={question}
          entry={keyEntry}
          change={change}
          changeKey={changeKey}
          onDone={() => setKeyMode(false)}
        />
      ) : active ? (
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
            <ImagePicker onPicked={(image) => change('image', (q) => ({ ...q, image }))} />
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

          {question.image && (
            <figure className="q-image">
              <img src={question.image.url} alt="" />
              <button
                type="button"
                className="icon-btn q-image-remove"
                onClick={() => setRemovingImage(true)}
                aria-label="Remove image"
                title="Remove image"
              >
                <X size={16} />
              </button>
            </figure>
          )}

          <QuestionBody
            question={question}
            change={change}
            targets={targets}
            renameOption={renameOption}
          />
          {actionTrigger && question.actions?.length > 0 && (
            <div className="q-actions">
              <p className="q-actions-note">
                Questions an action shows stay hidden until it happens; hidden questions aren’t required.
              </p>
              <ActionsEditor
                actions={question.actions}
                onChange={(actions) => change('actions', (q) => ({ ...q, actions }))}
                trigger={actionTrigger}
                options={question.options ?? []}
                targets={actionTargets}
              />
            </div>
          )}
          {question.validation && canValidate && (
            <ValidationEditor question={question} change={change} onRemove={toggleValidation} />
          )}

          <footer className="q-foot">
            {quiz && (
              <button type="button" className="key-btn" onClick={() => setKeyMode(true)}>
                <CircleCheckBig size={18} />
                Answer key
                <span className="key-btn-points">({pointsLabel(question.points)})</span>
              </button>
            )}
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
            {moreItems.length > 0 && (
              <MenuButton
                icon={<MoreVertical size={18} />}
                label="More question options"
                items={moreItems}
              />
            )}
          </footer>
        </>
      ) : (
        <QuestionPreview question={question} quiz={quiz} />
      )}
      <ConfirmModal
        open={clearingActions}
        title="Remove all of this question’s actions?"
        message="The questions they show or hide go back to always showing. You can undo this."
        confirmLabel="Remove all"
        onConfirm={() => {
          change('actions', (q) => {
            const rest = { ...q }
            delete rest.actions
            return rest
          })
          setClearingActions(false)
        }}
        onCancel={() => setClearingActions(false)}
      />
      <ConfirmModal
        open={removingImage}
        title="Remove this image?"
        message="It will no longer show on the question. You can undo this right after."
        confirmLabel="Remove"
        onConfirm={() => {
          change('image', (q) => {
            const rest = { ...q }
            delete rest.image
            return rest
          })
          setRemovingImage(false)
        }}
        onCancel={() => setRemovingImage(false)}
      />
    </section>
  )
}

const pointsLabel = (points = 0) => `${points} ${points === 1 ? 'point' : 'points'}`

function QuestionBody({ question, change, targets, renameOption }) {
  const { type } = question
  if (OPTION_TYPES.includes(type)) {
    return (
      <OptionsEditor
        question={question}
        change={change}
        targets={targets}
        renameOption={renameOption}
      />
    )
  }
  if (type === 'linearScale') return <ScaleEditor question={question} change={change} />
  if (type === 'rating') return <RatingEditor question={question} change={change} />
  if (GRID_TYPES.includes(type)) return <GridEditor question={question} change={change} />
  if (type === 'fileUpload') return <FileUploadEditor question={question} change={change} />
  return <p className="q-hint">{TYPE_INFO[type].hint}</p>
}

function Marker({ type, index }) {
  if (type === 'dropdown') return <span className="q-marker q-marker-num">{index + 1}.</span>
  const box = type === 'checkboxes' || type === 'checkboxGrid'
  return <span className={`q-marker q-marker-${box ? 'box' : 'circle'}`} />
}

// Editable list of strings (options, grid rows/columns). Enter adds the next
// item and moves the cursor into it.
function ListEditor({ items, noun, marker, onSet, onAdd, onRemove, extra }) {
  const listRef = useRef(null)
  const focusItem = (i) =>
    requestAnimationFrame(() => listRef.current?.querySelectorAll('.q-option input')[i]?.focus())
  const add = (after = items.length - 1) => {
    onAdd(after)
    focusItem(after + 1)
  }

  return (
    <ol className="q-options" ref={listRef}>
      {items.map((item, i) => (
        <li key={i} className="q-option">
          {marker(i)}
          <input
            value={item}
            aria-label={`${noun} ${i + 1}`}
            onChange={(e) => onSet(i, e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add(i)
              }
            }}
          />
          {extra?.(i)}
          {items.length > 1 && (
            <button
              type="button"
              className="icon-btn q-option-remove"
              onClick={() => onRemove(i)}
              aria-label={`Remove ${noun.toLowerCase()} ${i + 1}`}
            >
              <X size={16} />
            </button>
          )}
        </li>
      ))}
      <li className="q-option">
        {marker(items.length)}
        <button type="button" className="link-btn q-add-option" onClick={() => add()}>
          Add {noun.toLowerCase()}
        </button>
      </li>
    </ol>
  )
}

// Choice options. With branching on, goTo stays index-aligned with options.
// Renames go through renameOption so the answer key follows the new text.
function OptionsEditor({ question, change, targets, renameOption }) {
  const { options, type, branching } = question
  const insertAt = (arr, at, value) => {
    const next = [...arr]
    next.splice(at, 0, value)
    return next
  }

  const canOther = type === 'multipleChoice' || type === 'checkboxes'
  const setOther = (allowOther) =>
    change('allowOther', (q) => {
      const next = { ...q, allowOther }
      if (!allowOther) delete next.allowOther
      return next
    })

  return (
    <>
      <ListEditor
        items={options}
        noun="Option"
        marker={(i) => <Marker type={type} index={i} />}
        onSet={renameOption}
        onAdd={(after) =>
          change('options', (q) => ({
            ...q,
            options: insertAt(q.options, after + 1, `Option ${q.options.length + 1}`),
            ...(q.goTo && { goTo: insertAt(q.goTo, after + 1, 'next') }),
          }))
        }
        onRemove={(i) =>
          change('options', (q) => ({
            ...q,
            options: q.options.filter((_, j) => j !== i),
            ...(q.goTo && { goTo: q.goTo.filter((_, j) => j !== i) }),
          }))
        }
        extra={
          branching
            ? (i) => (
                <TargetSelect
                  value={question.goTo?.[i] ?? 'next'}
                  targets={targets}
                  label={`After option ${i + 1}`}
                  onChange={(target) =>
                    change(`goto-${i}`, (q) => ({
                      ...q,
                      goTo: q.options.map((_, j) => (j === i ? target : (q.goTo?.[j] ?? 'next'))),
                    }))
                  }
                />
              )
            : null
        }
      />
      {canOther &&
        (question.allowOther ? (
          <div className="q-option q-other">
            <Marker type={type} index={options.length} />
            <span className="q-other-label">Other…</span>
            <button
              type="button"
              className="icon-btn q-option-remove"
              onClick={() => setOther(false)}
              aria-label="Remove Other option"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <button type="button" className="link-btn q-add-other" onClick={() => setOther(true)}>
            or add “Other”
          </button>
        ))}
    </>
  )
}

function ScaleEditor({ question, change }) {
  const { min, max, minLabel, maxLabel } = question
  const set = (field, value) => change(field, (q) => ({ ...q, [field]: value }))
  return (
    <div className="scale-editor">
      <div className="scale-range">
        <select
          value={min}
          aria-label="Scale start"
          onChange={(e) => set('min', Number(e.target.value))}
        >
          {[0, 1].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
        <span>to</span>
        <select
          value={max}
          aria-label="Scale end"
          onChange={(e) => set('max', Number(e.target.value))}
        >
          {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </div>
      {[
        ['minLabel', min, minLabel],
        ['maxLabel', max, maxLabel],
      ].map(([field, n, value]) => (
        <label key={field} className="q-option">
          <span className="scale-num">{n}</span>
          <input
            value={value}
            placeholder="Label (optional)"
            aria-label={`Label for ${n}`}
            maxLength={60}
            onChange={(e) => set(field, e.target.value)}
          />
        </label>
      ))}
    </div>
  )
}

function RatingEditor({ question, change }) {
  return (
    <div className="scale-range">
      <select
        value={question.max}
        aria-label="Number of stars"
        onChange={(e) => {
          const max = Number(e.target.value)
          change('max', (q) => ({ ...q, max }))
        }}
      >
        {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <option key={n}>{n}</option>
        ))}
      </select>
      <span className="stars" aria-hidden="true">
        {Array.from({ length: question.max }, (_, i) => (
          <Star key={i} size={18} />
        ))}
      </span>
    </div>
  )
}

function GridEditor({ question, change }) {
  const listOps = (field, noun) => ({
    onSet: (i, value) =>
      change(`${field}-${i}`, (q) => ({
        ...q,
        [field]: q[field].map((v, j) => (j === i ? value : v)),
      })),
    onAdd: (after) =>
      change(field, (q) => {
        const next = [...q[field]]
        next.splice(after + 1, 0, `${noun} ${q[field].length + 1}`)
        return { ...q, [field]: next }
      }),
    onRemove: (i) => change(field, (q) => ({ ...q, [field]: q[field].filter((_, j) => j !== i) })),
  })

  return (
    <div className="grid-editor">
      <div>
        <p className="grid-editor-head">Rows</p>
        <ListEditor
          items={question.rows}
          noun="Row"
          marker={(i) => <span className="q-marker q-marker-num">{i + 1}.</span>}
          {...listOps('rows', 'Row')}
        />
      </div>
      <div>
        <p className="grid-editor-head">Columns</p>
        <ListEditor
          items={question.columns}
          noun="Column"
          marker={() => <Marker type={question.type} />}
          {...listOps('columns', 'Column')}
        />
      </div>
    </div>
  )
}

function QuestionPreview({ question, quiz }) {
  const { type } = question
  let body
  if (question.options) {
    body = (
      <ol className="q-options">
        {question.options.map((option, i) => (
          <li key={i} className="q-option">
            <Marker type={type} index={i} />
            <span>{option}</span>
          </li>
        ))}
        {question.allowOther && (
          <li className="q-option">
            <Marker type={type} index={question.options.length} />
            <span className="muted">Other…</span>
          </li>
        )}
      </ol>
    )
  } else if (type === 'linearScale') {
    body = (
      <p className="q-hint">
        {question.minLabel || question.min} … {question.maxLabel || question.max}
      </p>
    )
  } else if (type === 'rating') {
    body = (
      <span className="stars" aria-label={`${question.max} stars`}>
        {Array.from({ length: question.max }, (_, i) => (
          <Star key={i} size={18} />
        ))}
      </span>
    )
  } else if (GRID_TYPES.includes(type)) {
    body = (
      <p className="q-hint">
        {question.rows.length} {question.rows.length === 1 ? 'row' : 'rows'} ×{' '}
        {question.columns.length} {question.columns.length === 1 ? 'column' : 'columns'}
      </p>
    )
  } else {
    body = <p className="q-hint">{TYPE_INFO[type].hint}</p>
  }

  return (
    <div className="q-preview">
      <p className="q-preview-title">
        {question.title || <span className="muted">Untitled question</span>}
        {question.required && <span className="q-required"> *</span>}
        {quiz && <span className="q-points">{pointsLabel(question.points)}</span>}
      </p>
      {question.description && <p className="q-preview-desc">{question.description}</p>}
      {question.image && <img className="q-image-thumb" src={question.image.url} alt="" />}
      {body}
    </div>
  )
}
