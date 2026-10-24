import { describe, expect, it } from 'vitest'
import {
  DEVICES,
  alignFrames,
  collapseHidden,
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
  syncInterview,
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
    // Later screens: Back, then Submit (or Next), side by side.
    const later = Object.values(starterScreen(form, screens[1], true).nodes).filter((n) => n.type === 'button')
    expect(later.map((b) => b.action.type)).toEqual(['back', 'submit'])
    const [back, submit] = later.map((b) => b.frames.phone)
    expect(back.y).toBe(submit.y)
    expect(back.x + back.w).toBeLessThan(submit.x)
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

describe('keeping saved screens in step with the question list', () => {
  // Saved first-screen design while everything was on one page.
  const onePage = {
    ...form,
    questions: form.questions.filter((q) => q.type !== 'section'),
  }
  const startScreen = screensOf(onePage)[0]
  const saved = starterScreen(onePage, startScreen, true)
  // Then a section is added before q3 (and q2 moved after it, like dragging).
  const moved = {
    ...onePage,
    interview: { screens: { start: saved } },
    questions: [
      { id: 'q1', type: 'shortAnswer', title: 'Name', required: true },
      { id: 's2', type: 'section', title: 'Section 2' },
      { id: 'q2', type: 'multipleChoice', title: 'Plan', options: ['A', 'B', 'C'] },
      { id: 'q3', type: 'paragraph', title: 'Anything else?' },
    ],
  }

  it('takes moved questions off the old screen', () => {
    const synced = syncInterview(moved)
    expect([...placedQuestionIds(synced.interview.screens.start)]).toEqual(['q1'])
  })

  it('turns the old screen’s Submit into Next once it is no longer last', () => {
    const synced = syncInterview(moved)
    const buttons = Object.values(synced.interview.screens.start.nodes).filter((n) => n.type === 'button')
    expect(buttons.map((b) => [b.label, b.action.type])).toEqual([['Next', 'next']])
  })

  it('gives the new screen its questions, with Back and Submit', () => {
    const synced = syncInterview(moved)
    const screens = screensOf(synced)
    const design = screenDesign(synced, screens[1], screens)
    expect([...placedQuestionIds(design)]).toEqual(['q2', 'q3'])
    const buttons = Object.values(design.nodes).filter((n) => n.type === 'button')
    expect(buttons.map((b) => b.action.type)).toEqual(['back', 'submit'])
  })

  it('carries a moved block (and its look) to a screen that has a saved design', () => {
    const screens = screensOf(moved)
    const target = starterScreen(moved, screens[1], true)
    // That screen was saved before q1 moved there too.
    const q1Block = Object.values(saved.nodes).find((n) => n.questionId === 'q1')
    const styled = { ...saved, nodes: { ...saved.nodes, [q1Block.id]: { ...q1Block, style: { bg: 'accent-soft' } } } }
    const later = {
      ...moved,
      interview: { screens: { start: styled, s2: target } },
      questions: [
        { id: 's0', type: 'shortAnswer', title: 'Intro' },
        { id: 's2', type: 'section', title: 'Section 2' },
        ...moved.questions.filter((q) => q.id !== 's2'),
      ],
    }
    const synced = syncInterview(later)
    const s2 = synced.interview.screens.s2
    const carried = Object.values(s2.nodes).find((n) => n.questionId === 'q1')
    expect(carried.style).toEqual({ bg: 'accent-soft' })
    // It sits above the buttons, and the card grew to hold everything.
    const [card] = childrenOf(s2.nodes, null, 'phone')
    const kids = childrenOf(s2.nodes, card.id, 'phone')
    const buttonY = Math.min(...kids.filter((k) => k.type === 'button').map((k) => frameOf(k, 'phone').y))
    expect(frameOf(carried, 'phone').y + frameOf(carried, 'phone').h).toBeLessThanOrEqual(buttonY)
    for (const k of kids) expect(frameOf(k, 'phone').y + frameOf(k, 'phone').h).toBeLessThanOrEqual(frameOf(card, 'phone').h)
  })

  it('leaves forms alone when nothing changed', () => {
    const synced = syncInterview(moved)
    expect(syncInterview(synced)).toBe(synced)
    expect(syncInterview(form)).toBe(form)
  })
})

describe('snapping to other blocks', () => {
  const parent = { w: 400, h: 600 }
  const other = { x: 20, y: 100, w: 200, h: 40 }

  it('lines up left edges, right edges and centres with a neighbour', () => {
    expect(snapFrame({ x: 26, y: 300, w: 100, h: 40 }, parent, 10, [other]).x).toBe(20)
    expect(snapFrame({ x: 115, y: 300, w: 100, h: 40 }, parent, 10, [other]).x).toBe(120) // right to right
    expect(snapFrame({ x: 66, y: 300, w: 100, h: 40 }, parent, 10, [other]).x).toBe(70) // centres
  })

  it('sits right below a neighbour, and draws the guide there', () => {
    const snapped = snapFrame({ x: 200, y: 146, w: 100, h: 40 }, parent, 10, [other])
    expect(snapped.y).toBe(140)
    expect(snapped.guides).toContainEqual({ axis: 'y', at: 140 })
  })

  it('leaves the block alone when nothing is near', () => {
    expect(snapFrame({ x: 260, y: 300, w: 60, h: 40 }, parent, 10, [other])).toMatchObject({ x: 260, y: 300, guides: [] })
  })
})

describe('hidden blocks give their space back', () => {
  const at = (x, y, w, h) => ({ phone: { x, y, w, h, r: 0, z: 0 } })
  const design = {
    nodes: {
      card: { id: 'card', type: 'card', parentId: null, seq: 1, frames: at(16, 40, 300, 300) },
      a: { id: 'a', type: 'text', parentId: 'card', seq: 2, frames: at(20, 20, 260, 40) },
      b: { id: 'b', type: 'text', parentId: 'card', seq: 3, frames: at(20, 76, 260, 60) },
      c: { id: 'c', type: 'button', parentId: 'card', seq: 4, frames: at(20, 152, 260, 48) },
      side: { id: 'side', type: 'text', parentId: 'card', seq: 5, frames: at(290, 0, 8, 300) },
      below: { id: 'below', type: 'card', parentId: null, seq: 6, frames: at(16, 360, 300, 100) },
    },
  }
  // A strip at the top right, beside the column (it doesn't overlap a/b/c,
  // so it never moves, and it's above them, so the card can still shrink).
  design.nodes.side.frames = at(285, 0, 10, 30)

  it('moves the blocks below up, shrinks the card, and moves what is below the card', () => {
    const out = collapseHidden(design, 'phone', (n) => n.id === 'b')
    expect(out.c.y).toBe(152 - 76) // b's 60 + the 16 gap after it
    expect(out.a).toBeUndefined()
    expect(out.card.h).toBe(300 - 76)
    expect(out.below.y).toBe(360 - 76)
  })

  it('changes nothing when nothing is hidden', () => {
    expect(collapseHidden(design, 'phone', () => false)).toEqual({})
  })
})

describe('aligning several blocks', () => {
  const frames = { a: { x: 10, y: 0, w: 100, h: 20 }, b: { x: 50, y: 40, w: 60, h: 20 } }
  it('lines them up on a shared edge or centre', () => {
    expect(alignFrames(frames, 'left')).toEqual({ a: { x: 10 }, b: { x: 10 } })
    expect(alignFrames(frames, 'right')).toEqual({ a: { x: 10 }, b: { x: 50 } })
    expect(alignFrames(frames, 'center')).toEqual({ a: { x: 10 }, b: { x: 30 } })
    expect(alignFrames(frames, 'bottom')).toEqual({ a: { y: 40 }, b: { y: 40 } })
  })
})
