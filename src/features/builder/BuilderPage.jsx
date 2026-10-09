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
import { Plus } from 'lucide-react'
import AutoTextarea from '../../lib/AutoTextarea.jsx'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import { newQuestion } from '../../lib/formModel.js'
import QuestionCard from './QuestionCard.jsx'
import { useFormEditor } from './editorContext.js'

// Questions tab: header card (title + description), the question cards,
// and the floating add-question toolbar.
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

  const questions = draft.questions

  const setQuestions = (key, update) => edit(key, (d) => ({ ...d, questions: update(d.questions) }))

  const changeQuestion = (id) => (field, update) =>
    setQuestions(`q:${id}:${field}`, (qs) => qs.map((q) => (q.id === id ? update(q) : q)))

  function addQuestion() {
    const question = newQuestion('multipleChoice')
    setQuestions('add', (qs) => {
      const at = qs.findIndex((q) => q.id === activeId)
      const next = [...qs]
      next.splice(at === -1 ? qs.length : at + 1, 0, question)
      return next
    })
    setActiveId(question.id)
  }

  function duplicateQuestion(id) {
    const copy = { ...questions.find((q) => q.id === id), id: crypto.randomUUID() }
    setQuestions('duplicate', (qs) => {
      const next = [...qs]
      next.splice(qs.findIndex((q) => q.id === id) + 1, 0, copy)
      return next
    })
    setActiveId(copy.id)
  }

  function deleteQuestion(id) {
    setQuestions('delete', (qs) => qs.filter((q) => q.id !== id))
    setPendingDelete(null)
  }

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
            {questions.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                active={question.id === activeId}
                onActivate={() => setActiveId(question.id)}
                change={changeQuestion(question.id)}
                onDuplicate={() => duplicateQuestion(question.id)}
                onDelete={() => setPendingDelete(question.id)}
              />
            ))}
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
      </aside>

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Delete this question?"
        message="Answers already collected for it will no longer appear in your results. You can undo this right after."
        onConfirm={() => deleteQuestion(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
