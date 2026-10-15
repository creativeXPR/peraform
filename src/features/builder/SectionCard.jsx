import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripHorizontal, Trash2 } from 'lucide-react'
import AutoTextarea from '../../lib/AutoTextarea.jsx'
import TargetSelect from './TargetSelect.jsx'

// A page break in the builder: "Section N of M", its title/description, and
// where respondents go after it.
export default function SectionCard({
  section,
  number,
  total,
  targets,
  active,
  onActivate,
  change,
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
  } = useSortable({ id: section.id })

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`s-card${active ? ' q-card-active' : ''}${isDragging ? ' q-card-dragging' : ''}`}
      onClick={() => !active && onActivate()}
      onFocus={() => !active && onActivate()}
      aria-label={`Section ${number} of ${total}`}
    >
      <span className="s-chip">
        Section {number} of {total}
      </span>
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
          <AutoTextarea
            className="s-title-input"
            value={section.title}
            placeholder="Untitled section"
            aria-label="Section title"
            onChange={(e) => {
              const title = e.target.value
              change('title', (s) => ({ ...s, title }))
            }}
          />
          <AutoTextarea
            className="q-desc-input"
            value={section.description}
            placeholder="Description (optional)"
            aria-label="Section description"
            onChange={(e) => {
              const description = e.target.value
              change('description', (s) => ({ ...s, description }))
            }}
          />
          <footer className="q-foot s-foot">
            <label className="s-after">
              <span>After section {number}</span>
              <TargetSelect
                value={section.next}
                targets={targets.filter((t) => t.value !== section.id)}
                onChange={(next) => change('next', (s) => ({ ...s, next }))}
              />
            </label>
            <button
              type="button"
              className="icon-btn"
              onClick={onDelete}
              aria-label="Delete section"
              title="Delete section"
            >
              <Trash2 size={18} />
            </button>
          </footer>
        </>
      ) : (
        <div className="q-preview">
          <p className="s-preview-title">
            {section.title || <span className="muted">Untitled section</span>}
          </p>
          {section.description && <p className="q-preview-desc">{section.description}</p>}
        </div>
      )}
    </section>
  )
}
