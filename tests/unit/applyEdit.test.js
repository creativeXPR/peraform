import { describe, expect, it } from 'vitest'
import { applyAiEdit } from '../../src/features/ai/applyEdit.js'

const draft = {
  title: 'Bakery feedback',
  description: 'Tell us how we did.',
  questions: [
    { id: 'name', type: 'shortText', title: 'Name', description: '', required: true, validation: { kind: 'text', op: 'email' } },
    {
      id: 'visit',
      type: 'multipleChoice',
      title: 'How did you visit?',
      description: '',
      required: false,
      options: ['In store', 'Delivery'],
      branching: true,
      goTo: ['s2', 'submit'],
      image: { url: 'https://x/y.png', path: 'y.png' },
    },
    { id: 'pic', type: 'image', title: 'Our shop', description: '', image: { url: 'u', path: 'p' } },
    { id: 's2', type: 'section', title: 'In store', description: '', next: 'next' },
    { id: 'rate', type: 'rating', title: 'Rate us', description: '', required: false, max: 5 },
  ],
}

describe('applying an AI edit', () => {
  it('keeps ids and everything the AI never saw', () => {
    const next = applyAiEdit(draft, {
      title: 'Bakery feedback',
      description: 'Tell us how we did.',
      questions: [
        { id: 'name', type: 'shortText', title: 'Your full name', description: '', required: true },
        {
          id: 'visit',
          type: 'multipleChoice',
          title: 'How did you visit?',
          description: '',
          required: true,
          options: ['Delivery', 'In store', 'Pick-up'],
        },
        { id: 'pic', type: 'image', title: 'Our shop', description: '' },
        { id: 's2', type: 'section', title: 'In store', description: '' },
        { id: 'rate', type: 'rating', title: 'Rate us', description: '', required: false, max: 10 },
      ],
    })
    const [name, visit, pic, , rate] = next.questions
    expect(name).toMatchObject({ id: 'name', title: 'Your full name', validation: { kind: 'text', op: 'email' } })
    expect(visit.image.url).toBe('https://x/y.png')
    expect(visit.required).toBe(true)
    // Branching follows each option by its text; a new option goes to next.
    expect(visit.goTo).toEqual(['submit', 's2', 'next'])
    expect(pic.image.url).toBe('u')
    expect(rate.max).toBe(10)
  })

  it('adds new items with fresh ids, and drops what was left out', () => {
    const next = applyAiEdit(draft, {
      title: 'Bakery feedback',
      description: '',
      questions: [
        { id: 'name', type: 'shortText', title: 'Name', description: '', required: true },
        { type: 'shortText', title: 'Email', description: '', required: true },
        { type: 'text', title: 'Thanks!', description: 'Almost done.' },
        { type: 'image', title: 'Made-up image', description: '' },
      ],
    })
    expect(next.questions.map((q) => q.title)).toEqual(['Name', 'Email', 'Thanks!'])
    expect(next.questions[1].id).not.toBe('name')
    expect(next.questions[1].type).toBe('shortText')
    expect(next.questions[2].type).toBe('text')
  })

  it('retypes a question with the new type’s own fields', () => {
    const next = applyAiEdit(draft, {
      title: 'x',
      description: '',
      questions: [
        { id: 'rate', type: 'linearScale', title: 'How likely are you to recommend us?', description: '', required: true, min: 0, max: 10, minLabel: 'Not at all', maxLabel: 'Very' },
      ],
    })
    expect(next.questions[0]).toMatchObject({ id: 'rate', type: 'linearScale', min: 0, max: 10, minLabel: 'Not at all' })
  })

  it('points skip logic at "next" when its section is gone', () => {
    const next = applyAiEdit(draft, {
      title: 'x',
      description: '',
      questions: [{ id: 'visit', type: 'multipleChoice', title: 'How did you visit?', description: '', required: false, options: ['In store', 'Delivery'] }],
    })
    expect(next.questions[0].goTo).toEqual(['next', 'submit'])
  })

  it('never lets one id appear twice', () => {
    const q = { id: 'name', type: 'shortText', title: 'Name', description: '', required: true }
    const next = applyAiEdit(draft, { title: 'x', description: '', questions: [q, q] })
    expect(new Set(next.questions.map((x) => x.id)).size).toBe(2)
  })
})

describe('when the AI drops an id', () => {
  it('still finds the question by its type and title', () => {
    const next = applyAiEdit(draft, {
      title: 'x',
      description: '',
      questions: [
        { id: 'new-1', type: 'shortText', title: 'Email', description: '', required: true },
        { id: 'new-2', type: 'rating', title: 'Rate us', description: '', required: false, max: 10 },
      ],
    })
    expect(next.questions[1]).toMatchObject({ id: 'rate', max: 10 })
    expect(next.questions[0].id).not.toBe('new-1')
  })
})
