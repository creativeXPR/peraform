import { describe, expect, it } from 'vitest'
import { keepBlockData, pasteBlock, screensOf, screenDesign, starterScreen, embedSrc } from '../../src/lib/interview.js'
import { keepField, keepSummary, keepText, pasteFields, readPayload, textAsField, visibleHere } from '../../src/lib/keep.js'

const form = {
  title: 'Welcome',
  questions: [
    { id: 'q1', type: 'multipleChoice', title: 'Pick one', options: ['A', 'B'], required: true, actions: [{ id: 'a1', trigger: { type: 'select', option: 'A' }, target: 'q2', effect: { type: 'show' } }] },
    { id: 'q2', type: 'shortText', title: 'Why?' },
    { id: 's1', type: 'section', title: 'More' },
    { id: 'q3', type: 'longText', title: 'Anything else?' },
  ],
}

describe('keep: fields', () => {
  it('keeps a field with all its properties and pastes a fresh copy', () => {
    const kept = keepField(form.questions[0])
    expect(kept).toMatchObject({ kind: 'field', app: 'peraform', label: 'Pick one' })
    expect(keepSummary(kept)).toBe('multipleChoice · 2 options · required')
    const { questions, ids } = pasteFields(form.questions, readPayload(kept), 'q2')
    expect(questions).toHaveLength(5)
    expect(questions[2]).toMatchObject({ id: ids[0], title: 'Pick one', options: ['A', 'B'], required: true })
    expect(ids[0]).not.toBe('q1')
    expect(questions[2].actions).toHaveLength(1) // q2 exists here
    // In another form, an action whose target isn't there is dropped.
    const other = pasteFields([{ id: 'x', type: 'shortText', title: 'X' }], readPayload(kept))
    expect(other.questions[1].actions).toEqual([])
  })

  it('keeps text and links (every app) and pastes them as a text item', () => {
    expect(keepText('https://example.com/a')).toMatchObject({ kind: 'link', app: null })
    const t = keepText('Heading\nSome details')
    expect(t).toMatchObject({ kind: 'text', label: 'Heading' })
    expect(textAsField(readPayload(t)).items[0]).toEqual({ type: 'text', title: 'Heading', description: 'Some details' })
    expect(keepText('   ')).toBeNull()
    expect(visibleHere({ app: null })).toBe(true)
    expect(visibleHere({ app: 'docs' })).toBe(false)
  })
})

describe('keep: design blocks', () => {
  const screens = screensOf(form)
  const start = starterScreen(form, screens[0], false)
  const saved = { ...form, mode: 'interview', interview: { screens: { start } } }
  const card = Object.values(start.nodes).find((n) => n.type === 'card')

  it('keeps a card with everything inside and the questions it shows', () => {
    const data = keepBlockData(start, card.id, form.questions)
    expect(Object.keys(data.nodes)).toHaveLength(Object.keys(start.nodes).length)
    expect(data.questions.map((q) => q.id)).toEqual(['q1', 'q2'])
  })

  it('pastes onto another screen with new ids and copied questions in that section', () => {
    const data = JSON.parse(JSON.stringify(keepBlockData(start, card.id, form.questions)))
    const { form: next, id } = pasteBlock(saved, 's1', data)
    expect(id).toBeTruthy()
    const design = screenDesign(next, screensOf(next).find((s) => s.key === 's1'))
    expect(design.nodes[id].type).toBe('card')
    expect(design.nodes[id].parentId).toBeNull()
    // Copies of q1 and q2 now sit in section s1 (after q3).
    expect(next.questions.map((q) => q.title)).toEqual(['Pick one', 'Why?', 'More', 'Anything else?', 'Pick one', 'Why?'])
    const pastedQs = Object.values(design.nodes).filter((n) => n.type === 'question' && !['q1', 'q2', 'q3'].includes(n.questionId))
    expect(pastedQs).toHaveLength(2)
    for (const n of pastedQs) expect(next.questions.some((q) => q.id === n.questionId)).toBe(true)
  })

  it('pastes a single block into the selected card, or the first card', () => {
    const text = Object.values(start.nodes).find((n) => n.type === 'text')
    const data = keepBlockData(start, text.id)
    const { form: next, id } = pasteBlock(saved, 'start', data)
    expect(screenDesign(next, screensOf(next)[0]).nodes[id].parentId).toBe(card.id)
  })
})

describe('embedSrc', () => {
  it('takes a web address or an iframe embed code (https only)', () => {
    expect(embedSrc('https://maps.google.com/x')).toBe('https://maps.google.com/x')
    expect(embedSrc('<iframe width="560" src="https://www.youtube.com/embed/abc?si=1&amp;t=2" allowfullscreen></iframe>')).toBe(
      'https://www.youtube.com/embed/abc?si=1&t=2',
    )
    expect(embedSrc('<iframe src="http://insecure.example"></iframe>')).toBeNull()
    expect(embedSrc('javascript:alert(1)')).toBeNull()
  })
})

describe('keep: quiz answer keys', () => {
  it('travel with a kept question to its pasted copy', () => {
    const kept = keepField(form.questions[0], { correct: ['A'] })
    const { ids, answerKey } = pasteFields([], readPayload(kept))
    expect(answerKey).toEqual({ [ids[0]]: { correct: ['A'] } })
  })
})
