// Paging, answer checks and skip logic, shared by the builder, the public
// form and the responses page.
//
// A form's `questions` array may contain Section items ({ type: 'section' }).
// Everything before the first section is page 1 (under the form header);
// each section starts a new page.
//
// Skip logic, like Google Forms:
//   - section.next: where to go after that section — 'next', 'submit', or
//     another section's id.
//   - multipleChoice/dropdown with `branching: true`: goTo[i] is the target
//     for options[i]. An answered branching question overrides the section's
//     default; if a page has several, the last one wins.
// Targets pointing at a section that no longer exists act as 'next'.

export const BRANCHING_TYPES = ['multipleChoice', 'dropdown']
export const GRID_TYPES = ['mcGrid', 'checkboxGrid']

export function isSection(item) {
  return item.type === 'section'
}

// [{ section: Section | null, questions: Question[] }]
export function splitPages(items) {
  const pages = [{ section: null, questions: [] }]
  for (const item of items) {
    if (isSection(item)) pages.push({ section: item, questions: [] })
    else pages[pages.length - 1].questions.push(item)
  }
  return pages
}

export function questionsOnly(items) {
  return items.filter((item) => !isSection(item))
}

function filled(value) {
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'number') return Number.isFinite(value)
  return typeof value === 'string' && value.trim() !== ''
}

// Did the respondent answer this at all? (Grids: at least one row.)
export function hasAnswer(question, value) {
  if (value === undefined || value === null) return false
  if (GRID_TYPES.includes(question.type)) {
    return typeof value === 'object' && Object.values(value).some(filled)
  }
  return filled(value)
}

// Enough to satisfy "required"? (Grids: every row, like Google Forms.)
export function isComplete(question, value) {
  if (!GRID_TYPES.includes(question.type)) return hasAnswer(question, value)
  return Boolean(value) && question.rows.every((_, i) => filled(value[i]))
}

// Where this page sends the respondent: 'next' | 'submit' | sectionId.
export function pageTarget(page, answers) {
  let target = page.section?.next ?? 'next'
  for (const q of page.questions) {
    if (!BRANCHING_TYPES.includes(q.type) || !q.branching) continue
    const i = q.options.indexOf(answers[q.id])
    if (i !== -1) target = q.goTo?.[i] ?? 'next'
  }
  return target
}

// Page index to show next, or 'submit'.
export function resolveTarget(pages, pageIndex, target) {
  if (target === 'submit') return 'submit'
  if (target !== 'next') {
    const i = pages.findIndex((p) => p.section?.id === target)
    if (i !== -1) return i
  }
  return pageIndex + 1 < pages.length ? pageIndex + 1 : 'submit'
}

// After deleting a section, point anything that targeted it back at 'next'.
export function dropSectionRefs(items, sectionId) {
  return items.map((item) => {
    if (isSection(item) && item.next === sectionId) return { ...item, next: 'next' }
    if (item.goTo?.includes(sectionId)) {
      return { ...item, goTo: item.goTo.map((t) => (t === sectionId ? 'next' : t)) }
    }
    return item
  })
}
