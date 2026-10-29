import { useEffect, useState } from 'react'
import { newAction, renameTriggerOption, triggerKindFor } from '../../lib/actions.js'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { FileInput, Image as ImageIcon, Plus, Rows3, SquarePlay, Type } from 'lucide-react'
import AutoTextarea from '../../lib/AutoTextarea.jsx'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import { CONTENT_TYPES, dropSectionRefs, isQuestion, isSection } from '../../lib/formLogic.js'
import { newContent, newQuestion, newSection, quizSettings } from '../../lib/formModel.js'
import { loadThemeFont, themeOf, themeStyle } from '../../lib/theme.js'
import { useTheme } from '../../lib/useTheme.js'
import ContentCard from './ContentCard.jsx'
import ImportQuestionsDialog from './ImportQuestionsDialog.jsx'
import QuestionCard from './QuestionCard.jsx'
import SectionCard from './SectionCard.jsx'
import { useFormEditor } from './editorContext.js'
import { buildTargets } from './questionTypes.js'
import { keepField, pasteFields, textAsField } from '../../lib/keep.js'
import HeaderBanner from '../../lib/HeaderBanner.jsx'
import { useKeep, useKeepTargets } from '../keep/keepContext.js'

// Questions tab: header card (title + description), the question and
// section cards, and the floating toolbar (add question / add section).
export default function BuilderPage() {
  const { draft, edit } = useFormEditor()
  const [activeId, setActiveId] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [importing, setImporting] = useState(false)
  const keepStore = useKeep()
  const { theme: mode } = useTheme()
  const formTheme = themeOf(draft)
  useEffect(() => loadThemeFont(formTheme.font), [formTheme.font])
  const sensors = useSensors(
    // A small drag distance so clicks on the handle don't start a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Kept fields, text and links paste below the selected card (pasteKept).
  useKeepTargets(draft ? { field: pasteKept, text: (data) => pasteKept(textAsField(data)) } : null)

  if (!draft) return <div className="builder-loading" aria-busy="true" />

  // Questions and section breaks, in order (see lib/formLogic.js).
  const questions = draft.questions
  const sections = questions.filter(isSection)
  const totalSections = sections.length + 1 // the header is section 1
  const targets = sections.length ? buildTargets(sections) : []

  const setQuestions = (key, update) => edit(key, (d) => ({ ...d, questions: update(d.questions) }))

  const quiz = quizSettings(draft).enabled

  // Renaming an option also renames it in the answer key — one edit, so it's
  // one undo step and the key never points at a stale option.
  const renameOption = (id) => (i, value) =>
    edit(`q:${id}:option-${i}`, (d) => {
      const old = d.questions.find((q) => q.id === id).options[i]
      // The option's actions (on the question, and on the design blocks
      // showing it) follow the new text.
      const questions = d.questions.map((q) =>
        q.id === id
          ? {
              ...q,
              options: q.options.map((o, j) => (j === i ? value : o)),
              ...(q.actions && { actions: renameTriggerOption(q.actions, old, value) }),
            }
          : q,
      )
      let next = { ...d, questions }
      if (d.interview?.screens) {
        const screens = Object.fromEntries(
          Object.entries(d.interview.screens).map(([key, design]) => {
            const nodes = Object.fromEntries(
              Object.entries(design.nodes).map(([nid, n]) => [
                nid,
                n.questionId === id && n.actions ? { ...n, actions: renameTriggerOption(n.actions, old, value) } : n,
              ]),
            )
            return [key, { ...design, nodes }]
          }),
        )
        next = { ...next, interview: { ...d.interview, screens } }
      }
      const entry = d.answerKey?.[id]
      if (!entry?.correct?.includes(old)) return next
      const correct = entry.correct.map((c) => (c === old ? value : c))
      return { ...next, answerKey: { ...d.answerKey, [id]: { ...entry, correct } } }
    })

  const changeKey = (id) => (field, update) =>
    edit(`key:${id}:${field}`, (d) => ({
      ...d,
      answerKey: { ...d.answerKey, [id]: update(d.answerKey?.[id] ?? {}) },
    }))

  // "Show only if…": an item's rules are the show-actions that target it,
  // stored on the questions above it that they read.
  const showIfFor = (item, index) => {
    const sources = questions.slice(0, index).filter((q) => isQuestion(q) && triggerKindFor(q))
    const rules = []
    for (const q of questions) {
      for (const a of q.actions ?? []) {
        if (a.target === item.id && a.effect?.type === 'show' && a.trigger?.type !== 'click') {
          rules.push({ sourceId: q.id, actionId: a.id, trigger: a.trigger })
        }
      }
    }
    return {
      rules,
      sources,
      noun: isSection(item) ? 'section' : isQuestion(item) ? 'question' : 'block',
      onAdd: (sourceId, trigger) =>
        setQuestions(`showif:${item.id}:add`, (qs) =>
          qs.map((q) => (q.id === sourceId ? { ...q, actions: [...(q.actions ?? []), newAction(trigger, item.id)] } : q)),
        ),
      onRemove: (sourceId, actionId) =>
        setQuestions(`showif:${item.id}:remove`, (qs) =>
          qs.map((q) => (q.id === sourceId ? { ...q, actions: (q.actions ?? []).filter((a) => a.id !== actionId) } : q)),
        ),
    }
  }

  const changeQuestion = (id) => (field, update) =>
    setQuestions(`q:${id}:${field}`, (qs) => qs.map((q) => (q.id === id ? update(q) : q)))

  // New items go after the active card, or at the end.
  function insert(item) {
    setQuestions('add', (qs) => {
      const at = qs.findIndex((q) => q.id === activeId)
      const next = [...qs]
      next.splice(at === -1 ? qs.length : at + 1, 0, item)
      return next
    })
    setActiveId(item.id)
  }

  const addQuestion = () => insert(newQuestion('multipleChoice'))
  const addSection = () => insert(newSection())

  // Imported items arrive with fresh ids (see ImportQuestionsDialog).
  function insertMany(items) {
    if (!items.length) return
    setQuestions('import', (qs) => {
      const at = qs.findIndex((q) => q.id === activeId)
      const next = [...qs]
      next.splice(at === -1 ? qs.length : at + 1, 0, ...items)
      return next
    })
    setActiveId(items[items.length - 1].id)
  }

  function duplicateQuestion(id) {
    const copy = { ...questions.find((q) => q.id === id), id: crypto.randomUUID() }
    // The copy gets the original's answer key too.
    edit('duplicate', (d) => {
      const next = [...d.questions]
      next.splice(d.questions.findIndex((q) => q.id === id) + 1, 0, copy)
      const entry = d.answerKey?.[id]
      return {
        ...d,
        questions: next,
        ...(entry && { answerKey: { ...d.answerKey, [copy.id]: entry } }),
      }
    })
    setActiveId(copy.id)
  }

  // Keep: a card kept with all its properties (and quiz answer key); kept
  // fields, text and links pasted below the selected card.
  const keepItem = (item) => keepStore?.keep(keepField(item, draft.answerKey?.[item.id]))
  function pasteKept(data) {
    const after = questions.some((q) => q.id === activeId) ? activeId : null
    // Worked out once, here, so the new ids are known (as in duplicate).
    const { questions: next, ids, answerKey } = pasteFields(draft.questions, data, after)
    if (!ids.length) return
    edit(`paste:${ids[0]}`, (d) => ({
      ...d,
      questions: next,
      ...(Object.keys(answerKey).length && { answerKey: { ...d.answerKey, ...answerKey } }),
    }))
    setActiveId(ids.at(-1))
  }

  function deleteItem(id) {
    setQuestions('delete', (qs) =>
      dropSectionRefs(
        qs.filter((q) => q.id !== id),
        id,
      ),
    )
    setPendingDelete(null)
  }

  const pendingType = pendingDelete && questions.find((q) => q.id === pendingDelete)?.type
  const DELETE_COPY = {
    section: [
      'Delete this section?',
      'Its questions stay and join the section above. Anything that jumped to this section will continue to the next one instead. You can undo this right after.',
    ],
    text: ['Delete this title and description?', 'You can undo this right after.'],
    image: ['Delete this image?', 'You can undo this right after.'],
    video: ['Delete this video?', 'You can undo this right after.'],
  }
  const [deleteTitle, deleteMessage] = DELETE_COPY[pendingType] ?? [
    'Delete this question?',
    'Answers already collected for it will no longer appear in your results. You can undo this right after.',
  ]

  function onDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    setQuestions('move', (qs) =>
      arrayMove(
        qs,
        qs.findIndex((q) => q.id === active.id),
        qs.findIndex((q) => q.id === over.id),
      ),
    )
  }

  return (
    <div className="builder themed" style={themeStyle(formTheme, mode === 'dark')}>
      <div className="builder-column">
        <HeaderBanner theme={formTheme} />
        <section
          className={`form-head${activeId === 'head' ? ' q-card-active' : ''}`}
          onFocus={() => setActiveId('head')}
          onClick={() => setActiveId('head')}
        >
          {sections.length > 0 && <span className="s-chip">Section 1 of {totalSections}</span>}
          <AutoTextarea
            className="form-head-title"
            value={draft.title}
            placeholder="Untitled form"
            aria-label="Form title"
            onChange={(e) => {
              const title = e.target.value
              edit('title', (d) => ({ ...d, title }))
            }}
          />
          <AutoTextarea
            className="form-head-desc"
            value={draft.description}
            placeholder="Form description"
            aria-label="Form description"
            onChange={(e) => {
              const description = e.target.value
              edit('description', (d) => ({ ...d, description }))
            }}
          />
        </section>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={questions.map((q) => q.id)}
            strategy={verticalListSortingStrategy}
          >
            {questions.map((item, index) =>
              isSection(item) ? (
                <SectionCard
                  key={item.id}
                  section={item}
                  number={sections.indexOf(item) + 2}
                  total={totalSections}
                  targets={targets}
                  active={item.id === activeId}
                  onActivate={() => setActiveId(item.id)}
                  change={changeQuestion(item.id)}
                  onDelete={() => setPendingDelete(item.id)}
                  onKeep={() => keepItem(item)}
                  showIf={showIfFor(item, index)}
                />
              ) : CONTENT_TYPES.includes(item.type) ? (
                <ContentCard
                  key={item.id}
                  item={item}
                  active={item.id === activeId}
                  onActivate={() => setActiveId(item.id)}
                  change={changeQuestion(item.id)}
                  onDuplicate={() => duplicateQuestion(item.id)}
                  onDelete={() => setPendingDelete(item.id)}
                  onKeep={() => keepItem(item)}
                  showIf={showIfFor(item, index)}
                />
              ) : (
                <QuestionCard
                  key={item.id}
                  question={item}
                  targets={targets}
                  active={item.id === activeId}
                  onActivate={() => setActiveId(item.id)}
                  change={changeQuestion(item.id)}
                  onDuplicate={() => duplicateQuestion(item.id)}
                  onDelete={() => setPendingDelete(item.id)}
                  onKeep={() => keepItem(item)}
                  renameOption={renameOption(item.id)}
                  quiz={quiz}
                  keyEntry={draft.answerKey?.[item.id]}
                  changeKey={changeKey(item.id)}
                  showIf={showIfFor(item, index)}
                  actionTargets={questions
                    .filter((x) => x.id !== item.id)
                    .map((x) => ({
                      id: x.id,
                      label: isSection(x)
                        ? `Section: ${x.title || 'Untitled section'} (its whole page)`
                        : x.title || (isQuestion(x) ? 'Untitled question' : 'Untitled block'),
                    }))}
                />
              ),
            )}
          </SortableContext>
        </DndContext>

        {questions.length === 0 && (
          <button type="button" className="builder-empty" onClick={addQuestion}>
            <Plus size={18} />
            Add your first question
          </button>
        )}
      </div>

      <aside className="builder-toolbar" aria-label="Add to form">
        {[
          ['Add question', Plus, addQuestion],
          ['Import questions', FileInput, () => setImporting(true)],
          ['Add title and description', Type, () => insert(newContent('text'))],
          ['Add image', ImageIcon, () => insert(newContent('image'))],
          ['Add video', SquarePlay, () => insert(newContent('video'))],
          ['Add section', Rows3, addSection],
        ].map(([label, Icon, onClick]) => (
          <button
            key={label}
            type="button"
            className="icon-btn"
            onClick={onClick}
            aria-label={label}
            title={label}
          >
            <Icon size={20} />
          </button>
        ))}
      </aside>

      <ImportQuestionsDialog
        open={importing}
        onClose={() => setImporting(false)}
        onImport={(items) => {
          insertMany(items)
          setImporting(false)
        }}
      />

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title={deleteTitle}
        message={deleteMessage}
        onConfirm={() => deleteItem(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
