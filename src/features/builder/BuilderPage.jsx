import { useState } from 'react'
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
import { Plus, Rows3 } from 'lucide-react'
import AutoTextarea from '../../lib/AutoTextarea.jsx'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import { dropSectionRefs, isSection } from '../../lib/formLogic.js'
import { newQuestion, newSection } from '../../lib/formModel.js'
import QuestionCard from './QuestionCard.jsx'
import SectionCard from './SectionCard.jsx'
import { useFormEditor } from './editorContext.js'
import { buildTargets } from './questionTypes.js'

// Questions tab: header card (title + description), the question and
// section cards, and the floating toolbar (add question / add section).
export default function BuilderPage() {
  const { draft, edit } = useFormEditor()
  const [activeId, setActiveId] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const sensors = useSensors(
    // A small drag distance so clicks on the handle don't start a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (!draft) return <div className="builder-loading" aria-busy="true" />

  // Questions and section breaks, in order (see lib/formLogic.js).
  const questions = draft.questions
  const sections = questions.filter(isSection)
  const totalSections = sections.length + 1 // the header is section 1
  const targets = sections.length ? buildTargets(sections) : []

  const setQuestions = (key, update) => edit(key, (d) => ({ ...d, questions: update(d.questions) }))

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

  function duplicateQuestion(id) {
    const copy = { ...questions.find((q) => q.id === id), id: crypto.randomUUID() }
    setQuestions('duplicate', (qs) => {
      const next = [...qs]
      next.splice(qs.findIndex((q) => q.id === id) + 1, 0, copy)
      return next
    })
    setActiveId(copy.id)
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

  const pendingIsSection =
    pendingDelete && isSection(questions.find((q) => q.id === pendingDelete) ?? {})

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
    <div className="builder">
      <div className="builder-column">
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
            {questions.map((item) =>
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
        <button
          type="button"
          className="icon-btn"
          onClick={addQuestion}
          aria-label="Add question"
          title="Add question"
        >
          <Plus size={20} />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={addSection}
          aria-label="Add section"
          title="Add section"
        >
          <Rows3 size={20} />
        </button>
      </aside>

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title={pendingIsSection ? 'Delete this section?' : 'Delete this question?'}
        message={
          pendingIsSection
            ? 'Its questions stay and join the section above. Anything that jumped to this section will continue to the next one instead. You can undo this right after.'
            : 'Answers already collected for it will no longer appear in your results. You can undo this right after.'
        }
        onConfirm={() => deleteItem(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
