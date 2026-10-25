import { describe, expect, it } from 'vitest'
import { DESIGN_STYLES, applyStyle, paletteFor, screenWords } from '../../src/lib/designStyles.js'
import { gradient, isGradient, parseGradient } from '../../src/lib/gradient.js'
import { screensOf, starterScreen } from '../../src/lib/interview.js'

const form = {
  title: 'Welcome',
  description: 'Tell us about you',
  questions: [
    { id: 'q1', type: 'shortText', title: 'Name' },
    { id: 's1', type: 'section', title: 'More', description: 'A few more things' },
    { id: 'q2', type: 'longText', title: 'Anything else?' },
  ],
}
const screens = screensOf(form)
const start = starterScreen(form, screens[0], false)
const button = Object.values(start.nodes).find((n) => n.type === 'button')
const withAction = {
  ...start,
  nodes: { ...start.nodes, [button.id]: { ...button, actions: [{ id: 'a', trigger: { type: 'click' }, target: 's1', effect: { type: 'show' } }] } },
}

describe('design styles', () => {
  it('restyles every role but keeps layout, content and actions', () => {
    const out = applyStyle(withAction, 'playful')
    expect(isGradient(out.bg)).toBe(true)
    expect(out.style).toBe('playful')
    for (const n of Object.values(withAction.nodes)) {
      expect(out.nodes[n.id].frames).toEqual(n.frames)
      expect(out.nodes[n.id].text).toEqual(n.text)
    }
    expect(out.nodes[button.id].actions).toHaveLength(1)
    const heading = Object.values(out.nodes).find((n) => n.type === 'text' && n.text === 'Welcome')
    expect(heading.style).toMatchObject({ font: 'rounded', weight: 700 })
    expect(out.nodes[button.id].style.radius).toBe(999)
  })

  it('swaps its own entrance on re-applying, keeping the creator’s animations', () => {
    const card = Object.values(start.nodes).find((n) => n.type === 'card')
    const mine = { id: 'mine', preset: 'pulse', when: 'loop' }
    const base = { ...start, nodes: { ...start.nodes, [card.id]: { ...card, animations: [mine] } } }
    const twice = applyStyle(applyStyle(base, 'playful'), 'classroom')
    const anims = twice.nodes[card.id].animations
    expect(anims.filter((a) => a.fromStyle)).toHaveLength(1)
    expect(anims.find((a) => a.fromStyle).preset).toBe('slideUp')
    expect(anims.some((a) => a.id === 'mine')).toBe(true)
    // Official has no entrance.
    expect(applyStyle(twice, 'official').nodes[card.id].animations).toEqual([mine])
  })

  it('every style has a full look', () => {
    for (const [key, def] of Object.entries(DESIGN_STYLES)) {
      const look = def.build(def.palette)
      for (const part of ['bg', 'card', 'title', 'text', 'button', 'back']) expect(look[part], `${key}.${part}`).toBeTruthy()
    }
  })

  it('takes valid palette colours only', () => {
    expect(paletteFor('glass', { from: '#123456', accent: 'red' })).toEqual({ from: '#123456', to: '#f093fb', accent: '#ffffff' })
  })

  it('writes a screen’s heading and subtitle into its blocks', () => {
    const out = screenWords(start, { heading: '👋 Hi there', subtitle: 'Two minutes, tops.' })
    const texts = Object.values(out.nodes).filter((n) => n.type === 'text').map((n) => n.text)
    expect(texts).toEqual(expect.arrayContaining(['👋 Hi there', 'Two minutes, tops.']))
  })
})

describe('gradients', () => {
  it('round-trip', () => {
    const g = gradient('#AABBCC', '#112233', 90)
    expect(parseGradient(g)).toEqual({ from: '#aabbcc', to: '#112233', angle: 90 })
    expect(parseGradient('#ffffff')).toBeNull()
  })
})
