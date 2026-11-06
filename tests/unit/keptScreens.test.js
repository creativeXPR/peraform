import { describe, expect, it } from 'vitest'
import { applyLook, applyStyle, captureLook } from '../../src/lib/designStyles.js'
import { placedQuestionIds, screenDesign, screensOf } from '../../src/lib/interview.js'
import { keepScreenData, pasteScreen } from '../../src/lib/keptScreens.js'
import { applyLayout } from '../../src/lib/screenLayouts.js'

const source = {
  title: 'Old form',
  questions: [
    { id: 'a1', type: 'shortText', title: 'Name' },
    { id: 'a2', type: 'shortText', title: 'Email' },
    { id: 'a3', type: 'shortText', title: 'Phone' },
  ],
}
const target = {
  title: 'New form',
  questions: [
    { id: 'b1', type: 'longText', title: 'Story' },
    { id: 's1', type: 'section', title: 'Two' },
    { id: 'b2', type: 'shortText', title: 'Age' },
    { id: 'b3', type: 'shortText', title: 'City' },
    { id: 'b4', type: 'shortText', title: 'Job' },
    { id: 'b5', type: 'shortText', title: 'Pet' },
  ],
}

describe('kept screens', () => {
  const [src] = screensOf(source)
  const kept = keepScreenData(applyLayout(screenDesign(source, src), 'focus', { questions: source.questions }), source.questions)

  it('describes its questions by title', () => {
    expect(kept.questions).toEqual(['Name', 'Email', 'Phone'])
    expect(kept.design.layout).toBe('focus')
  })

  it('shows this screen’s questions, dropping extra question blocks', () => {
    const out = pasteScreen(target, 'start', kept)
    const d = out.interview.screens.start
    expect([...placedQuestionIds(d)]).toEqual(['b1'])
    expect(d.layout).toBe('focus')
    expect(Object.values(d.nodes).some((n) => n.type === 'text' && n.text === 'New form')).toBe(true)
  })

  it('places questions left over, with new block ids', () => {
    const out = pasteScreen(target, 's1', kept)
    const d = out.interview.screens.s1
    expect([...placedQuestionIds(d)].sort()).toEqual(['b2', 'b3', 'b4', 'b5'])
    for (const id of Object.keys(kept.design.nodes)) expect(d.nodes[id]).toBeUndefined()
  })
})

describe('kept looks', () => {
  it('carries colours (not sizes) to another screen', () => {
    const [src] = screensOf(source)
    const styled = applyStyle(screenDesign(source, src), 'midnight')
    const look = captureLook(styled)
    expect(look.style).toBe('midnight')
    const [, two] = screensOf(target)
    const plain = screenDesign(target, two)
    const out = applyLook(plain, look)
    expect(out.bg).toBe(styled.bg)
    const button = (d) => Object.values(d.nodes).find((n) => n.type === 'button' && n.action?.type !== 'back')
    expect(button(out).style.bg).toBe(button(styled).style.bg)
    expect(out.original).toBeTruthy()
  })
})
