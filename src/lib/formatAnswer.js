import { GRID_TYPES } from './formLogic.js'

// One answer as readable text (responses tab, respondent results).
// Grids become one "Row: choice" line per answered row.
export function formatAnswer(question, value) {
  if (GRID_TYPES.includes(question.type)) {
    return question.rows
      .map((row, i) => [row, value[i]])
      .filter(([, v]) => v !== undefined && !(Array.isArray(v) && !v.length))
      .map(([row, v]) => `${row}: ${[v].flat().join(', ')}`)
      .join('\n')
  }
  if (question.type === 'rating') return `${value} of ${question.max}`
  if (question.type === 'fileUpload') return value.map((f) => f.name).join(', ')
  return Array.isArray(value) ? value.join(', ') : String(value)
}
