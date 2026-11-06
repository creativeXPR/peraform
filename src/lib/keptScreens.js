import { screenWords } from './designStyles.js'
import { isQuestion } from './formLogic.js'
import { frameOf, interviewOf, newId, placeQuestions, screenDesign, screensOf } from './interview.js'

// Keep → "Keep this screen": a whole screen design, to use on a screen of
// any form (Design screens → Keep → Paste). Its question blocks take this
// screen's questions in order; its heading and subtitle take this screen's
// title and description. Questions left over get blocks of their own; extra
// question blocks go.
//   { design, questions: [titles] } (titles only so the Keep can describe it)

export function keepScreenData(design, questions = []) {
  const shown = Object.values(design.nodes)
    .filter((n) => n.type === 'question')
    .map((n) => questions.find((q) => q.id === n.questionId)?.title || 'Untitled question')
  // eslint-disable-next-line no-unused-vars -- "Back to original look" belongs to the screen it came from
  const { original, removed, ...rest } = design
  return { design: rest, questions: shown }
}

const readingOrder = (nodes) => (a, b) => {
  const at = (n) => {
    let y = 0
    let x = 0
    for (let p = n; p; p = nodes[p.parentId]) {
      y += frameOf(p, 'phone').y
      x += frameOf(p, 'phone').x
    }
    return [y, x]
  }
  const [ay, ax] = at(a)
  const [by, bx] = at(b)
  return ay - by || ax - bx
}

// The kept screen as this form's screen `key`. Returns the form.
export function pasteScreen(form, key, data) {
  const screens = screensOf(form)
  const screen = screens.find((s) => s.key === key)
  if (!screen || !data?.design?.nodes) return form
  const kept = structuredClone(data.design.nodes)
  // New ids, so nothing clashes with blocks elsewhere in this form.
  const ids = Object.fromEntries(Object.keys(kept).map((id) => [id, newId()]))
  const mine = screen.page.items.filter(isQuestion)
  const asked = Object.values(kept)
    .filter((n) => n.type === 'question')
    .sort(readingOrder(kept))
  const gone = new Set()
  asked.forEach((n, i) => {
    if (mine[i]) n.questionId = mine[i].id
    else gone.add(n.id)
  })
  const screenKeys = new Set(screens.map((s) => s.key))
  const nodes = {}
  for (const n of Object.values(kept)) {
    if (gone.has(n.id) || gone.has(n.parentId)) continue
    nodes[ids[n.id]] = {
      ...n,
      id: ids[n.id],
      parentId: n.parentId ? ids[n.parentId] : null,
      // Actions keep targets that came along (or screens of this form).
      ...(n.actions && {
        actions: n.actions
          .filter((a) => (ids[a.target] && !gone.has(a.target)) || screenKeys.has(a.target))
          .map((a) => ({ ...a, id: newId(), target: ids[a.target] ?? a.target })),
      }),
      // A button that jumps to a screen of the other form just goes on.
      ...(n.action?.type === 'goto' && !screenKeys.has(n.action.screen) && { action: { type: 'next' } }),
    }
  }
  let design = { ...data.design, nodes, removed: [] }
  const left = mine.slice(asked.length)
  if (left.length) design = placeQuestions(design, left)
  const description = screen.index === 0 ? form.description : screen.page.section?.description
  design = screenWords(design, { heading: screen.title, subtitle: description || '' })
  // Hidden-until-shown is this screen's own setting.
  const was = screenDesign(form, screen, screens)
  if (was.hidden) design.hidden = true
  else delete design.hidden
  const iv = interviewOf(form)
  return { ...form, interview: { ...iv, screens: { ...iv.screens, [key]: design } } }
}
