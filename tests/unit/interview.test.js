import { describe, expect, it } from 'vitest'
import {
  DEVICES,
  childrenOf,
  deleteNode,
  duplicateNode,
  frameOf,
  placeNew,
  placedQuestionIds,
  rotateVector,
  screenDesign,
  screensOf,
  setFrame,
  snapFrame,
  stageHeight,
  starterScreen,
  visibleQuestionIds,
} from '../../src/lib/interview.js'

const form = {
  title: 'Welcome',
  description: 'Tell us about you',
  questions: [
    { id: 'q1', type: 'shortAnswer', title: 'Name', required: true },
    { id: 'q2', type: 'multipleChoice', title: 'Plan', options: ['A', 'B', 'C'] },
    { id: 's1', type: 'section', title: 'Details' },
    { id: 'q3', type: 'paragraph', title: 'Anything else?' },
  ],
}

describe('screens', () => {
  it('makes one screen per section, keyed by the section id', () => {
    const screens = screensOf(form)
    expect(screens.map((s) => [s.key, s.title])).toEqual([
      ['start', 'Welcome'],
      ['s1', 'Details'],
    ])
  })
})

describe('starter design', () => {
  const screens = screensOf(form)

  it('is the same every time (so unsaved screens can be edited)', () => {
    expect(starterScreen(form, screens[0], false)).toEqual(starterScreen(form, screens[0], false))
  })

  it('holds the title, description, the screen’s questions and a button', () => {
    const design = starterScreen(form, screens[0], false)
    const [card] = childrenOf(design.nodes, null, 'phone')
    const kids = childrenOf(design.nodes, card.id, 'phone')
    expect(kids.map((n) => n.type)).toEqual(['text', 'text', 'question', 'question', 'button'])
    expect([...placedQuestionIds(design)]).toEqual(['q1', 'q2'])
    expect(kids.at(-1).action).toEqual({ type: 'next' })
    const last = Object.values(starterScreen(form, screens[1], true).nodes).find((n) => n.type === 'button')
    expect(last.action).toEqual({ type: 'submit' })
  })

  it('fits each device: children stay inside the card', () => {
    const design = starterScreen(form, screens[0], false)
    for (const device of Object.keys(DEVICES)) {
      const [card] = childrenOf(design.nodes, null, device)
      const cf = frameOf(card, device)
      expect(cf.x + cf.w).toBeLessThanOrEqual(DEVICES[device].width)
      for (const kid of childrenOf(design.nodes, card.id, device)) {
        const f = frameOf(kid, device)
        expect(f.x + f.w).toBeLessThanOrEqual(cf.w)
        expect(f.y + f.h).toBeLessThanOrEqual(cf.h)
      }
    }
  })

  it('is used until a design is saved', () => {
    const saved = { bg: '#000000', nodes: {} }
    expect(screenDesign({ ...form, interview: { screens: { start: saved } } }, screens[0])).toBe(saved)
    expect(screenDesign(form, screens[0]).nodes['start-1'].type).toBe('card')
  })
})

describe('snapFrame', () => {
  const parent = { w: 390, h: 844 }
  it('snaps near the left, centre and right (and top/middle/bottom)', () => {
    expect(snapFrame({ x: 6, y: 300, w: 100, h: 50 }, parent)).toMatchObject({ x: 0, guides: [{ axis: 'x', at: 0 }] })
    expect(snapFrame({ x: 140, y: 300, w: 100, h: 50 }, parent).x).toBe(145) // centred
    expect(snapFrame({ x: 285, y: 300, w: 100, h: 50 }, parent).x).toBe(290) // right edge
    expect(snapFrame({ x: 50, y: 790, w: 100, h: 50 }, parent).y).toBe(794) // bottom
  })

  it('leaves it alone when nowhere near', () => {
    expect(snapFrame({ x: 60, y: 200, w: 100, h: 50 }, parent)).toEqual({ x: 60, y: 200, guides: [] })
  })
})

describe('editing', () => {
  const screens = screensOf(form)
  const design = starterScreen(form, screens[0], false)
  const card = childrenOf(design.nodes, null, 'phone')[0]

  it('deletes a card with everything inside it', () => {
    expect(Object.keys(deleteNode(design, card.id).nodes)).toEqual([])
  })

  it('duplicates a card and its children with new ids, offset', () => {
    const { design: d2, id } = duplicateNode(design, card.id)
    expect(Object.keys(d2.nodes)).toHaveLength(Object.keys(design.nodes).length * 2)
    expect(childrenOf(d2.nodes, id, 'phone')).toHaveLength(5)
    expect(frameOf(d2.nodes[id], 'phone').x).toBe(frameOf(card, 'phone').x + 16)
  })

  it('places new blocks inside the parent on both devices', () => {
    const node = placeNew(design, 'image', card)
    expect(node.parentId).toBe(card.id)
    for (const device of Object.keys(DEVICES)) {
      expect(frameOf(node, device).w).toBeLessThanOrEqual(frameOf(card, device).w)
    }
  })

  it('counts only questions shown on this device', () => {
    const qNode = Object.values(design.nodes).find((n) => n.questionId === 'q1')
    const hidden = setFrame(design, qNode.id, 'phone', { hidden: true })
    expect(visibleQuestionIds(hidden, 'phone').has('q1')).toBe(false)
    expect(visibleQuestionIds(hidden, 'desktop').has('q1')).toBe(true)
    // Hiding the card hides what's inside it.
    expect(visibleQuestionIds(setFrame(design, card.id, 'phone', { hidden: true }), 'phone').size).toBe(0)
  })

  it('grows the stage to fit content taller than the screen', () => {
    const tall = setFrame(design, card.id, 'phone', { y: 0, h: 2000 })
    expect(stageHeight(tall, 'phone')).toBe(2040)
    expect(stageHeight(design, 'desktop')).toBe(DEVICES.desktop.height)
  })
})

describe('rotateVector', () => {
  it('turns drag movement into a rotated parent’s coordinates', () => {
    const v = rotateVector(10, 0, 90)
    expect(v.x).toBeCloseTo(0)
    expect(v.y).toBeCloseTo(10)
  })
})

describe('adding inside a full card', () => {
  it('puts the new block below the others and grows the card', async () => {
    const { growToFit, addNode } = await import('../../src/lib/interview.js')
    const screens = screensOf(form)
    const design = starterScreen(form, screens[0], false)
    const card = childrenOf(design.nodes, null, 'phone')[0]
    const node = placeNew(design, 'text', card)
    const lastBottom = Math.max(
      ...childrenOf(design.nodes, card.id, 'phone').map((n) => frameOf(n, 'phone').y + frameOf(n, 'phone').h),
    )
    expect(frameOf(node, 'phone').y).toBe(lastBottom + 16)
    const grown = growToFit(addNode(design, node), node.id)
    for (const device of Object.keys(DEVICES)) {
      const f = frameOf(grown.nodes[node.id], device)
      expect(frameOf(grown.nodes[card.id], device).h).toBe(f.y + f.h + 16)
    }
  })
})

describe('see-through backgrounds (glass)', () => {
  it('mixes the colour with transparency, theme tokens included', async () => {
    const { backgroundCss } = await import('../../src/lib/interview.js')
    expect(backgroundCss('#ffffff', 35)).toBe('color-mix(in srgb, #ffffff 35%, transparent)')
    expect(backgroundCss('accent', 50)).toBe('color-mix(in srgb, var(--accent) 50%, transparent)')
    expect(backgroundCss('surface')).toBe('var(--surface)')
    expect(backgroundCss(undefined, 20)).toBeUndefined()
  })
})

describe('duplicating and moving blocks', () => {
  const twoScreens = {
    title: 'Trip',
    questions: [
      { id: 'q1', type: 'shortText', title: 'Name' },
      { id: 's1', type: 'section', title: 'Details' },
      { id: 'q3', type: 'longText', title: 'Notes' },
    ],
  }

  it('duplicates a question block with its own new question, right after the original', async () => {
    const { duplicateBlock } = await import('../../src/lib/interview.js')
    const node = Object.values(screenDesign(twoScreens, screensOf(twoScreens)[0]).nodes).find((n) => n.questionId === 'q1')
    const { form, id } = duplicateBlock(twoScreens, 'start', node.id)
    expect(form.questions.map((q) => q.title)).toEqual(['Name', 'Name', 'Details', 'Notes'])
    const copy = form.interview.screens.start.nodes[id]
    expect(copy.questionId).toBe(form.questions[1].id)
    expect(copy.questionId).not.toBe('q1')
  })

  it('moves a block into another card on the same screen', async () => {
    const { moveBlock, addNode } = await import('../../src/lib/interview.js')
    const design = screenDesign(twoScreens, screensOf(twoScreens)[0])
    const card = childrenOf(design.nodes, null, 'phone')[0]
    const second = placeNew(design, 'card', null)
    const form = { ...twoScreens, interview: { screens: { start: addNode(design, second) } } }
    const text = childrenOf(design.nodes, card.id, 'phone').find((n) => n.type === 'text')
    const moved = moveBlock(form, 'start', text.id, 'start', second.id)
    expect(moved.interview.screens.start.nodes[text.id].parentId).toBe(second.id)
  })

  it('won’t move a card into itself, or a non-card onto the screen’s top level', async () => {
    const { moveBlock } = await import('../../src/lib/interview.js')
    const design = screenDesign(twoScreens, screensOf(twoScreens)[0])
    const card = childrenOf(design.nodes, null, 'phone')[0]
    const text = childrenOf(design.nodes, card.id, 'phone').find((n) => n.type === 'text')
    expect(moveBlock(twoScreens, 'start', card.id, 'start', card.id)).toBe(twoScreens)
    expect(moveBlock(twoScreens, 'start', text.id, 's1', null)).toBe(twoScreens)
  })

  it('moving a question block to another screen moves the question into that section', async () => {
    const { moveBlock, moveTargets } = await import('../../src/lib/interview.js')
    const node = Object.values(screenDesign(twoScreens, screensOf(twoScreens)[0]).nodes).find((n) => n.questionId === 'q1')
    const targets = moveTargets(twoScreens, 'start', node.id)
    const details = targets.find((t) => t.screen.key === 's1')
    const moved = moveBlock(twoScreens, 'start', node.id, 's1', details.cards[0].id)
    expect(moved.questions.map((q) => q.id)).toEqual(['s1', 'q3', 'q1'])
    expect(moved.interview.screens.s1.nodes[node.id].parentId).toBe(details.cards[0].id)
    expect(moved.interview.screens.start.nodes[node.id]).toBeUndefined()
  })
})
