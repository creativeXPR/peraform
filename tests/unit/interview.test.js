import { describe, expect, it } from 'vitest'
import {
  DEVICES,
  alignFrames,
  collapseHidden,
  childrenOf,
  deleteNode,
  duplicateNode,
  fitText,
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
  screenIssues,
  placeQuestions,
  moveStrayBlock,
  fixButton,
  withoutStrays,
  textHeight,
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

describe('screens out of step with the question list', () => {
  // Saved first-screen design while everything was on one page.
  const onePage = {
    ...form,
    questions: form.questions.filter((q) => q.type !== 'section'),
  }
  const saved = starterScreen(onePage, screensOf(onePage)[0], true)
  // Then a section is added before q2 (q2 and q3 now belong to it).
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
  const screens = screensOf(moved)
  const start = screenDesign(moved, screens[0], screens)

  it('changes nothing by itself: the saved design is exactly as it was', () => {
    expect(start).toBe(saved)
  })

  it('reports blocks whose question moved, and a Submit that no longer ends the form', () => {
    const issues = screenIssues(moved, screens[0], start, screens)
    expect(issues.filter((i) => i.kind === 'moved').map((i) => [i.questionId, i.to.key])).toEqual([
      ['q2', 's2'],
      ['q3', 's2'],
    ])
    expect(issues.filter((i) => i.kind === 'button').map((i) => i.want)).toEqual(['next'])
  })

  it('Move it there: the block goes to its screen; the question list stays as it is', () => {
    const issue = screenIssues(moved, screens[0], start, screens).find((i) => i.questionId === 'q2')
    const target = starterScreen(moved, screens[1], true)
    const withTarget = { ...moved, interview: { screens: { start: saved, s2: { ...target, removed: ['q2'] } } } }
    const next = moveStrayBlock(withTarget, 'start', issue.nodeId, 's2')
    expect(next.questions).toBe(withTarget.questions)
    expect(next.interview.screens.start.nodes[issue.nodeId]).toBeUndefined()
    expect(next.interview.screens.s2.nodes[issue.nodeId].questionId).toBe('q2')
    expect(next.interview.screens.s2.removed).toEqual([])
  })

  it('Make it Next / Submit fixes the button, and then it’s settled', () => {
    const issue = screenIssues(moved, screens[0], start, screens).find((i) => i.kind === 'button')
    const fixed = fixButton(start, issue.nodeId, issue.want)
    expect(fixed.nodes[issue.nodeId]).toMatchObject({ label: 'Next', action: { type: 'next', chosen: true } })
    expect(screenIssues(moved, screens[0], fixed, screens).some((i) => i.kind === 'button')).toBe(false)
  })

  it('Place them adds this page’s questions that have no block', () => {
    const bare = { ...saved, nodes: Object.fromEntries(Object.entries(saved.nodes).filter(([, n]) => n.questionId !== 'q1')) }
    const issue = screenIssues(moved, screens[0], bare, screens).find((i) => i.kind === 'unplaced')
    expect(issue.questions.map((q) => q.id)).toEqual(['q1'])
    expect(placedQuestionIds(placeQuestions(bare, issue.questions)).has('q1')).toBe(true)
  })

  it('respondents only see this page’s questions meanwhile', () => {
    expect([...placedQuestionIds(withoutStrays(start, screens[0].page))]).toEqual(['q1'])
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

describe('text that needs more room', () => {
  const at = (x, y, w, h) => ({ phone: { x, y, w, h, r: 0, z: 0 }, desktop: { x, y, w, h, r: 0, z: 0 } })
  const design = {
    bg: null,
    nodes: {
      card: { id: 'card', type: 'card', parentId: null, seq: 1, frames: at(16, 40, 360, 220) },
      title: { id: 'title', type: 'text', parentId: 'card', seq: 2, text: 'Section A: Departmental Identification & Contacts', style: { size: 30 }, frames: at(20, 20, 320, 44) },
      sub: { id: 'sub', type: 'text', parentId: 'card', seq: 3, text: 'Please provide details.', style: { size: 16 }, frames: at(20, 80, 320, 40) },
      side: { id: 'side', type: 'button', parentId: 'card', seq: 4, frames: at(350, 80, 4, 20) },
    },
  }

  it('grows the text and moves what is below it down (the card keeps its size)', () => {
    const out = fitText(design)
    const title = frameOf(out.nodes.title, 'phone')
    expect(title.h).toBeGreaterThan(44)
    const grow = title.h - 44
    expect(frameOf(out.nodes.sub, 'phone').y).toBe(80 + grow)
    // Beside the column, not under it: stays put.
    expect(frameOf(out.nodes.side, 'phone').y).toBe(80)
    expect(frameOf(out.nodes.card, 'phone').h).toBe(frameOf(design.nodes.card, 'phone').h)
  })

  it('leaves designs that fit alone', () => {
    const roomy = { ...design, nodes: { ...design.nodes, title: { ...design.nodes.title, text: 'Hi' } } }
    expect(fitText(roomy)).toBe(roomy)
  })

  it('estimates more lines for longer text', () => {
    expect(textHeight('short', 16, 300)).toBeLessThan(textHeight('a much longer piece of text that wraps onto several lines', 16, 120))
  })
})

describe('fitCard', () => {
  it('hugs the blocks with the given space, keeping them in place on screen', async () => {
    const { fitCard, frameOf } = await import('../../src/lib/interview.js')
    const card = { id: 'c', type: 'card', parentId: null, seq: 1, frames: { phone: { x: 10, y: 20, w: 370, h: 600, r: 0, z: 0 } } }
    const a = { id: 'a', type: 'text', parentId: 'c', seq: 2, frames: { phone: { x: 50, y: 80, w: 200, h: 40, r: 0, z: 0 } } }
    const b = { id: 'b', type: 'button', parentId: 'c', seq: 3, frames: { phone: { x: 60, y: 140, w: 100, h: 48, r: 0, z: 0 } } }
    const d = fitCard({ bg: null, nodes: { c: card, a, b } }, 'c', 'phone', 12)
    expect(frameOf(d.nodes.c, 'phone')).toMatchObject({ x: 48, y: 88, w: 224, h: 132 })
    expect(frameOf(d.nodes.a, 'phone')).toMatchObject({ x: 12, y: 12 })
    expect(frameOf(d.nodes.b, 'phone')).toMatchObject({ x: 22, y: 72 })
    // On screen: card x + block x is unchanged.
    expect(48 + 12).toBe(10 + 50)
    const empty = { bg: null, nodes: { c: card } }
    expect(fitCard(empty, 'c', 'phone', 12)).toBe(empty)
  })
})

describe('fitBlockHeight (the Fit height button)', () => {
  it('makes the block that tall and moves the blocks below down, card included', async () => {
    const { fitBlockHeight, frameOf } = await import('../../src/lib/interview.js')
    const at = (x, y, w, h) => ({ phone: { x, y, w, h, r: 0, z: 0 } })
    const design = {
      bg: null,
      nodes: {
        card: { id: 'card', type: 'card', parentId: null, seq: 1, frames: at(16, 40, 360, 200) },
        text: { id: 'text', type: 'text', parentId: 'card', seq: 2, frames: at(20, 20, 320, 40) },
        q: { id: 'q', type: 'question', parentId: 'card', seq: 3, frames: at(20, 76, 320, 100) },
        side: { id: 'side', type: 'button', parentId: 'card', seq: 4, frames: at(345, 76, 10, 20) },
      },
    }
    const out = fitBlockHeight(design, 'text', 'phone', 100)
    expect(frameOf(out.nodes.text, 'phone').h).toBe(100)
    expect(frameOf(out.nodes.q, 'phone').y).toBe(136) // moved down by 60
    expect(frameOf(out.nodes.side, 'phone').y).toBe(76) // beside it: stays
    expect(frameOf(out.nodes.card, 'phone').h).toBe(136 + 100 + 16)
  })
})

describe('overflowOf', () => {
  it('reads the setting, or what each block did before it existed', async () => {
    const { overflowOf } = await import('../../src/lib/interview.js')
    expect(overflowOf({ type: 'text', style: {} })).toBe('scroll')
    expect(overflowOf({ type: 'question' })).toBe('scroll')
    expect(overflowOf({ type: 'card', style: { clip: true } })).toBe('hidden')
    expect(overflowOf({ type: 'card', style: {} })).toBe('visible')
    expect(overflowOf({ type: 'image', style: {} })).toBe('visible')
    expect(overflowOf({ type: 'card', style: { clip: true, overflow: 'scroll' } })).toBe('scroll')
    expect(overflowOf({ type: 'text', style: { overflow: 'nonsense' } })).toBe('scroll')
  })
})

describe('shared or per-device look', () => {
  it('splits, edits one device, and shares again', async () => {
    const { resolveNode, setSplit, setStyleOn, setContentOn, differsByDevice, mapStyle } = await import('../../src/lib/interview.js')
    const at = { phone: { x: 0, y: 0, w: 100, h: 40, r: 0, z: 0 }, desktop: { x: 0, y: 0, w: 300, h: 40, r: 0, z: 0 } }
    let d = { bg: null, nodes: { t: { id: 't', type: 'text', parentId: 'c', seq: 1, text: 'Hello', style: { size: 30, color: '#111111' }, frames: at } } }
    // Shared: a change shows on both.
    d = setStyleOn(d, 't', 'phone', { size: 24 })
    expect(resolveNode(d.nodes.t, 'desktop').style.size).toBe(24)
    // Split: phone gets its own size and words; desktop keeps its.
    d = setSplit(d, 't', true, 'phone')
    expect(differsByDevice(d.nodes.t)).toBe(false)
    d = setStyleOn(d, 't', 'phone', { size: 18 })
    d = setContentOn(d, 't', 'phone', { text: 'Hi' })
    expect(resolveNode(d.nodes.t, 'phone')).toMatchObject({ text: 'Hi', style: { size: 18 } })
    expect(resolveNode(d.nodes.t, 'desktop')).toMatchObject({ text: 'Hello', style: { size: 24 } })
    expect(differsByDevice(d.nodes.t)).toBe(true)
    // A design style or dark mode reaches every copy.
    const recoloured = mapStyle(d.nodes.t, (s) => ({ ...s, color: '#eeeeee' }))
    expect(resolveNode(recoloured, 'phone').style.color).toBe('#eeeeee')
    expect(resolveNode(recoloured, 'desktop').style.color).toBe('#eeeeee')
    // Sharing again keeps the device being edited.
    d = setSplit(d, 't', false, 'phone')
    expect(d.nodes.t.split).toBeUndefined()
    expect(d.nodes.t.byDevice).toBeUndefined()
    expect(resolveNode(d.nodes.t, 'desktop')).toMatchObject({ text: 'Hi', style: { size: 18 } })
  })
})

describe('nextAsSubmit', () => {
  it('turns default Next buttons into Submit, keeping custom labels and other buttons', async () => {
    const { nextAsSubmit } = await import('../../src/lib/interview.js')
    const d = {
      nodes: {
        n: { id: 'n', type: 'button', label: 'Next', action: { type: 'next' } },
        b: { id: 'b', type: 'button', label: 'Back', action: { type: 'back' } },
        c: { id: 'c', type: 'button', label: 'Let’s go', action: { type: 'next' } },
        s: { id: 's', type: 'button', label: 'Next →', split: true, byDevice: { phone: { label: 'Next' }, desktop: { label: 'Continue' } }, action: { type: 'next' } },
      },
    }
    const out = nextAsSubmit(d)
    expect(out.nodes.n.label).toBe('Submit')
    expect(out.nodes.b.label).toBe('Back')
    expect(out.nodes.c.label).toBe('Let’s go')
    expect(out.nodes.s.byDevice).toEqual({ phone: { label: 'Submit' }, desktop: { label: 'Continue' } })
    expect(nextAsSubmit({ nodes: { b: d.nodes.b } }).nodes).toEqual({ b: d.nodes.b })
  })
})

describe('choices the creator made are never flagged', () => {
  it('a chosen Submit on an earlier screen, and a question taken off on purpose', async () => {
    const { removeBlocks, screenIssues, screensOf, starterScreen } = await import('../../src/lib/interview.js')
    const f = {
      title: 'T',
      questions: [
        { id: 'q1', type: 'shortText', title: 'A' },
        { id: 'q2', type: 'shortText', title: 'B' },
        { id: 's1', type: 'section', title: 'S' },
        { id: 'q3', type: 'shortText', title: 'C' },
      ],
    }
    const screens = screensOf(f)
    const first = starterScreen(f, screens[0], false)
    const btn = Object.values(first.nodes).find((n) => n.type === 'button')
    const q2 = Object.values(first.nodes).find((n) => n.questionId === 'q2')
    let d = { ...first, nodes: { ...first.nodes, [btn.id]: { ...btn, action: { type: 'submit', chosen: true } } } }
    d = removeBlocks(d, [q2.id])
    expect(d.removed).toEqual(['q2'])
    expect(screenIssues(f, screens[0], d, screens)).toEqual([])
    // Not chosen: flagged (with a button), still not changed.
    const auto = { ...first, nodes: { ...first.nodes, [btn.id]: { ...btn, action: { type: 'submit' } } } }
    expect(screenIssues(f, screens[0], auto, screens).map((i) => i.kind)).toEqual(['button'])
  })
})
