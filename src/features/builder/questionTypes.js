import {
  AlignJustify,
  AlignLeft,
  Calendar,
  CircleChevronDown,
  CircleDot,
  Clock,
  Grid3x3,
  LayoutGrid,
  SlidersHorizontal,
  SquareCheck,
  Star,
} from 'lucide-react'
import { TYPE_DEFAULTS } from '../../lib/formModel.js'
import { BRANCHING_TYPES, GRID_TYPES } from '../../lib/formLogic.js'
import { VALIDATION_KINDS } from '../../lib/validation.js'

// Builder labels/icons for each QUESTION_TYPES entry in lib/formModel.js.
export const TYPE_INFO = {
  shortText: { label: 'Short answer', icon: AlignLeft, hint: 'Short answer text' },
  longText: { label: 'Paragraph', icon: AlignJustify, hint: 'Long answer text' },
  multipleChoice: { label: 'Multiple choice', icon: CircleDot },
  checkboxes: { label: 'Checkboxes', icon: SquareCheck },
  dropdown: { label: 'Dropdown', icon: CircleChevronDown },
  linearScale: { label: 'Linear scale', icon: SlidersHorizontal },
  rating: { label: 'Rating', icon: Star },
  mcGrid: { label: 'Multiple-choice grid', icon: Grid3x3 },
  checkboxGrid: { label: 'Checkbox grid', icon: LayoutGrid },
  date: { label: 'Date', icon: Calendar, hint: 'Day, month, year' },
  time: { label: 'Time', icon: Clock, hint: 'Time' },
}

export const OPTION_TYPES = ['multipleChoice', 'checkboxes', 'dropdown']

const TYPE_FIELDS = ['options', 'branching', 'goTo', 'min', 'max', 'minLabel', 'maxLabel', 'rows', 'columns']

// Switching type keeps title/description/required, and keeps whatever
// carries over: options between choice types, rows/columns between grids.
// Everything else resets to the new type's defaults.
export function changeQuestionType(question, type) {
  const next = { ...question, type }
  const keep = new Set()
  if (OPTION_TYPES.includes(type) && OPTION_TYPES.includes(question.type)) keep.add('options')
  if (BRANCHING_TYPES.includes(type) && BRANCHING_TYPES.includes(question.type)) {
    keep.add('branching').add('goTo')
  }
  if (GRID_TYPES.includes(type) && GRID_TYPES.includes(question.type)) {
    keep.add('rows').add('columns')
  }
  for (const field of TYPE_FIELDS) if (!keep.has(field)) delete next[field]
  if (next.validation && !VALIDATION_KINDS[type]?.includes(next.validation.kind)) {
    delete next.validation
  }
  const defaults = TYPE_DEFAULTS[type]?.() ?? {}
  for (const [field, value] of Object.entries(defaults)) if (!keep.has(field)) next[field] = value
  return next
}

// targets for a form: [{ value, label }] — 'next', each section, 'submit'.
export function buildTargets(sections) {
  return [
    { value: 'next', label: 'Continue to next section' },
    ...sections.map((s, i) => ({
      value: s.id,
      // Sections are pages 2..N; page 1 is the form header.
      label: `Go to section ${i + 2} (${s.title || 'Untitled section'})`,
    })),
    { value: 'submit', label: 'Submit form' },
  ]
}
