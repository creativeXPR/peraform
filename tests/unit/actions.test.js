import { describe, expect, it } from 'vitest'
import {
  applyClick,
  conditionMet,
  matches,
  resolveActions,
  shownByActions,
  triggerKindFor,
} from '../../src/lib/actions.js'

const notHidden = () => false

describe('conditions', () => {
  it('select: the option is chosen (single or among checkboxes)', () => {
    expect(conditionMet({ type: 'select', option: 'Yes' }, 'Yes')).toBe(true)
    expect(conditionMet({ type: 'select', option: 'Yes' }, 'No')).toBe(false)
    expect(conditionMet({ type: 'select', option: 'Tea' }, ['Coffee', 'Tea'])).toBe(true)
  })

  it('match: regex, case-insensitive, with a plain-text fallback', () => {
    expect(matches('^\\d{5}$', '12345')).toBe(true)
    expect(matches('gmail\\.com$', 'ADA@GMAIL.COM')).toBe(true)
    expect(matches('student', 'I am a Student')).toBe(true)
    expect(matches('a+(', 'contains a+(')).toBe(true) // invalid regex → contains
    expect(matches('', 'anything')).toBe(true) // empty pattern = answered
    expect(matches('x', '')).toBe(false)
  })

  it('picks the trigger kind from the question type', () => {
    expect(triggerKindFor({ type: 'dropdown' })).toBe('select')
    expect(triggerKindFor({ type: 'shortText' })).toBe('match')
    expect(triggerKindFor({ type: 'fileUpload' })).toBeNull()
  })
})

describe('clicks build up', () => {
  const toggle = { trigger: { type: 'click' }, target: 'card', effect: { type: 'toggle' } }
  it('toggles each click, from the design’s own visibility', () => {
    const once = applyClick({}, [toggle], () => true)
    expect(once.card.hidden).toBe(false)
    const twice = applyClick(once, [toggle], () => true)
    expect(twice.card.hidden).toBe(true)
  })

  it('merges look changes and keeps the transition', () => {
    const fade = {
      trigger: { type: 'click' },
      target: 'card',
      effect: { type: 'set', props: { opacity: 50, bg: '#ff0000' } },
      transition: { duration: 600 },
    }
    const state = applyClick({}, [fade], notHidden)
    expect(state.card.props).toEqual({ opacity: 50, bg: '#ff0000' })
    expect(state.card.transition).toEqual({ duration: 600, easing: 'ease', display: true })
  })
})

describe('answer conditions hold only while true', () => {
  const sources = [
    {
      questionId: 'q1',
      actions: [{ trigger: { type: 'select', option: 'Yes' }, target: 'extra', effect: { type: 'show' } }],
    },
  ]
  const hiddenByDefault = (id) => id === 'extra'

  it('shows the target while Yes is chosen, and not otherwise', () => {
    expect(resolveActions({ sources, answers: { q1: 'Yes' }, baseHidden: hiddenByDefault }).extra.hidden).toBe(false)
    expect(resolveActions({ sources, answers: { q1: 'No' }, baseHidden: hiddenByDefault }).extra).toBeUndefined()
  })

  it('applies on top of clicks', () => {
    const clickState = { extra: { hidden: true, props: { opacity: 20 } } }
    const out = resolveActions({ sources, answers: { q1: 'Yes' }, clickState, baseHidden: hiddenByDefault })
    expect(out.extra).toMatchObject({ hidden: false, props: { opacity: 20 } })
  })
})

describe('normal forms', () => {
  it('starts "show" targets hidden', () => {
    const items = [
      { id: 'q1', actions: [{ target: 'q2', effect: { type: 'show' } }, { target: 'q3', effect: { type: 'hide' } }] },
      { id: 'q2' },
      { id: 'q3' },
    ]
    expect([...shownByActions(items)]).toEqual(['q2'])
  })
})

describe('playing animations', () => {
  const play = { trigger: { type: 'click' }, target: 'logo', effect: { type: 'play', animation: 'wiggle' } }
  it('counts up on every click, so each click plays it again', () => {
    const once = applyClick({}, [play], notHidden)
    expect(once.logo.plays).toEqual({ wiggle: 1 })
    expect(applyClick(once, [play], notHidden).logo.plays).toEqual({ wiggle: 2 })
  })

  it('answer conditions play it as they become true', () => {
    const sources = [{ questionId: 'q', actions: [{ ...play, trigger: { type: 'select', option: 'A' } }] }]
    expect(resolveActions({ sources, answers: { q: 'A' }, baseHidden: notHidden }).logo.plays).toEqual({ wiggle: 1 })
    expect(resolveActions({ sources, answers: { q: 'B' }, baseHidden: notHidden }).logo).toBeUndefined()
  })
})
