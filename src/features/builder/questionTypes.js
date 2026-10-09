import {
  AlignJustify,
  AlignLeft,
  Calendar,
  CircleChevronDown,
  CircleDot,
  SquareCheck,
} from 'lucide-react'

// Builder labels/icons for each QUESTION_TYPES entry in lib/formModel.js.
export const TYPE_INFO = {
  shortText: { label: 'Short answer', icon: AlignLeft, hint: 'Short answer text' },
  longText: { label: 'Paragraph', icon: AlignJustify, hint: 'Long answer text' },
  multipleChoice: { label: 'Multiple choice', icon: CircleDot },
  checkboxes: { label: 'Checkboxes', icon: SquareCheck },
  dropdown: { label: 'Dropdown', icon: CircleChevronDown },
  date: { label: 'Date', icon: Calendar, hint: 'Day, month, year' },
}

export const OPTION_TYPES = ['multipleChoice', 'checkboxes', 'dropdown']

// Switching type keeps title/description/required; options are added or
// dropped to match the new type (kept when moving between choice types).
export function changeQuestionType(question, type) {
  const next = { ...question, type }
  if (OPTION_TYPES.includes(type)) {
    next.options = question.options?.length ? question.options : ['Option 1']
  } else {
    delete next.options
  }
  return next
}
