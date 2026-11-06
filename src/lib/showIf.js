import { newAction, triggerKindFor } from './actions.js'
import { isQuestion, isSection } from './formLogic.js'

// "Show only if…" (builder/ShowIf.jsx): an item's rules are the show-actions
// that target it, stored on the questions above it that they read. One
// store for both modes: Edit questions and Design screens edit the same
// rules (a section's rules are its screen's).
//   setQuestions(key, update) — the editor's undoable questions edit
export function showIfProps(questions, item, setQuestions) {
  const index = questions.findIndex((q) => q.id === item.id)
  const sources = questions.slice(0, Math.max(0, index)).filter((q) => isQuestion(q) && triggerKindFor(q))
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
