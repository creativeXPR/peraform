import { describe, expect, it } from 'vitest'
import {
  dropSectionRefs,
  hasAnswer,
  isComplete,
  pageTarget,
  resolveTarget,
  splitPages, skipHiddenPages } from '../../src/lib/formLogic.js'
import { changeQuestionType } from '../../src/features/builder/questionTypes.js'
import { responsesToCsv, summarizeQuestion } from '../../src/features/responses/summarize.js'

const q = (id, extra = {}) => ({ id, type: 'shortText', title: id, required: false, ...extra })
const sec = (id, next = 'next') => ({ id, type: 'section', title: id, next })
const choice = (id, options, goTo) => ({
  ...q(id, { type: 'multipleChoice', options }),
  ...(goTo && { branching: true, goTo }),
})

describe('splitPages', () => {
  it('puts everything before the first section on page 1', () => {
    const pages = splitPages([q('a'), sec('s1'), q('b'), q('c'), sec('s2')])
    expect(pages.map((p) => [p.section?.id ?? null, p.questions.map((x) => x.id)])).toEqual([
      [null, ['a']],
      ['s1', ['b', 'c']],
      ['s2', []],
    ])
  })

  it('keeps content blocks on the page but out of the questions', () => {
    const [page] = splitPages([
      { id: 't', type: 'text', title: 'Intro' },
      q('a'),
      { id: 'i', type: 'image' },
      { id: 'v', type: 'video' },
    ])
    expect(page.items.map((x) => x.id)).toEqual(['t', 'a', 'i', 'v'])
    expect(page.questions.map((x) => x.id)).toEqual(['a'])
  })

  it('is a single page without sections', () => {
    expect(splitPages([q('a'), q('b')])).toHaveLength(1)
  })
})

describe('answers', () => {
  const grid = q('g', { type: 'mcGrid', rows: ['r1', 'r2'], columns: ['c1', 'c2'] })

  it('treats blank text, empty arrays and missing values as unanswered', () => {
    expect(hasAnswer(q('a'), '   ')).toBe(false)
    expect(hasAnswer(q('a'), [])).toBe(false)
    expect(hasAnswer(q('a'), undefined)).toBe(false)
    expect(hasAnswer(q('a'), 0)).toBe(true) // scale value 0 is an answer
  })

  it('counts a grid with one row as answered but not complete', () => {
    expect(hasAnswer(grid, { 0: 'c1' })).toBe(true)
    expect(isComplete(grid, { 0: 'c1' })).toBe(false)
    expect(isComplete(grid, { 0: 'c1', 1: 'c2' })).toBe(true)
  })

  it('needs at least one tick per row for a checkbox grid', () => {
    const cg = { ...grid, type: 'checkboxGrid' }
    expect(isComplete(cg, { 0: ['c1'], 1: [] })).toBe(false)
    expect(isComplete(cg, { 0: ['c1'], 1: ['c1', 'c2'] })).toBe(true)
  })
})

describe('skip logic', () => {
  const items = [
    choice('attend', ['Yes', 'No'], ['next', 'submit']),
    sec('details', 'thanks'),
    q('name'),
    sec('extra'),
    q('notes'),
    sec('thanks'),
    q('rating'),
  ]
  const pages = splitPages(items)
  const go = (i, answers) => resolveTarget(pages, i, pageTarget(pages[i], answers))

  it('follows the chosen option of a branching question', () => {
    expect(go(0, { attend: 'Yes' })).toBe(1)
    expect(go(0, { attend: 'No' })).toBe('submit')
  })

  it('falls back to the section default when the branching question is unanswered', () => {
    expect(go(0, {})).toBe(1)
  })

  it('uses a section’s "after this section" target', () => {
    expect(go(1, {})).toBe(3) // details → thanks, skipping extra
  })

  it('submits after the last page', () => {
    expect(go(3, {})).toBe('submit')
  })

  it('treats a target for a deleted section as "next"', () => {
    const broken = splitPages([q('a'), sec('s1', 'gone'), q('b'), sec('s2')])
    expect(resolveTarget(broken, 1, pageTarget(broken[1], {}))).toBe(2)
  })

  it('lets the last answered branching question on a page win', () => {
    const page = splitPages([
      choice('first', ['x'], ['submit']),
      choice('second', ['y'], ['s1']),
      sec('s1'),
    ])
    expect(pageTarget(page[0], { first: 'x', second: 'y' })).toBe('s1')
  })

  it('points references to a deleted section back at "next"', () => {
    const cleaned = dropSectionRefs(items, 'thanks')
    expect(cleaned.find((i) => i.id === 'details').next).toBe('next')
    expect(dropSectionRefs(items, 'details')[0].goTo).toEqual(['next', 'submit'])
  })
})

describe('changeQuestionType', () => {
  it('keeps options and branching between multiple choice and dropdown', () => {
    const mc = choice('a', ['x', 'y'], ['next', 'submit'])
    const dd = changeQuestionType(mc, 'dropdown')
    expect(dd).toMatchObject({ options: ['x', 'y'], branching: true, goTo: ['next', 'submit'] })
  })

  it('drops branching for checkboxes but keeps options', () => {
    const cb = changeQuestionType(choice('a', ['x'], ['submit']), 'checkboxes')
    expect(cb.options).toEqual(['x'])
    expect(cb).not.toHaveProperty('branching')
    expect(cb).not.toHaveProperty('goTo')
  })

  it('resets to the new type’s defaults when nothing carries over', () => {
    const scale = changeQuestionType(choice('a', ['x']), 'linearScale')
    expect(scale).toMatchObject({ min: 1, max: 5 })
    expect(scale).not.toHaveProperty('options')
  })

  it('keeps rows and columns between grid types', () => {
    const g = q('g', { type: 'mcGrid', rows: ['r'], columns: ['c'] })
    expect(changeQuestionType(g, 'checkboxGrid')).toMatchObject({ rows: ['r'], columns: ['c'] })
  })
})

describe('summaries', () => {
  it('counts every scale step and averages', () => {
    const scale = q('s', { type: 'linearScale', min: 1, max: 3 })
    const res = [{ answers: { s: 1 } }, { answers: { s: 3 } }, { answers: { s: 3 } }, { answers: {} }]
    const summary = summarizeQuestion(scale, res)
    expect(summary.rows).toEqual([
      { label: '1', count: 1 },
      { label: '2', count: 0 },
      { label: '3', count: 2 },
    ])
    expect(summary.average).toBeCloseTo(7 / 3)
    expect(summary.answered).toBe(3)
  })

  it('counts grid answers per row and column', () => {
    const grid = q('g', { type: 'checkboxGrid', rows: ['r1', 'r2'], columns: ['a', 'b'] })
    const res = [{ answers: { g: { 0: ['a', 'b'], 1: ['b'] } } }, { answers: { g: { 0: ['a'] } } }]
    expect(summarizeQuestion(grid, res).rows).toEqual([
      { label: 'r1', counts: [2, 1] },
      { label: 'r2', counts: [0, 1] },
    ])
  })

  it('writes one CSV column per grid row', () => {
    const grid = q('g', { type: 'mcGrid', title: 'Rate', rows: ['Food', 'Music'], columns: ['Ok'] })
    const csv = responsesToCsv([grid], [{ submittedAt: null, answers: { g: { 1: 'Ok' } } }])
    expect(csv.split('\r\n')).toEqual(['Submitted at,Rate [Food],Rate [Music]', ',,Ok'])
  })
})

describe('youtubeId', () => {
  it('reads ids from the usual link shapes', async () => {
    const { youtubeId } = await import('../../src/lib/formModel.js')
    const id = 'dQw4w9WgXcQ'
    for (const link of [
      id,
      `https://youtu.be/${id}`,
      `https://www.youtube.com/watch?v=${id}&t=10s`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/embed/${id}`,
      `  https://m.youtube.com/watch?feature=share&v=${id}  `,
    ]) {
      expect(youtubeId(link)).toBe(id)
    }
    expect(youtubeId('https://example.com/video')).toBe('')
  })
})

describe('pickDraft', () => {
  it('leaves out fields an older form does not have', async () => {
    const { pickDraft } = await import('../../src/features/builder/editorReducer.js')
    const draft = pickDraft({ title: 'Old form', description: '', questions: [], settings: {} })
    expect(draft).not.toHaveProperty('theme')
    expect(Object.values(draft)).not.toContain(undefined)
  })
})

describe('shuffled', () => {
  it('keeps every item and is stable for the same key', async () => {
    const { shuffled } = await import('../../src/lib/shuffle.js')
    const items = ['a', 'b', 'c', 'd', 'e', 'f']
    const once = shuffled(items, 'q1')
    expect([...once].sort()).toEqual(items)
    expect(shuffled(items, 'q1')).toEqual(once)
    expect(items).toEqual(['a', 'b', 'c', 'd', 'e', 'f']) // input untouched
  })
})

describe('top bar title', () => {
  it('is off by default (the logo shows), and uses the form name until changed', async () => {
    const { topBarTitle } = await import('../../src/lib/formModel.js')
    expect(topBarTitle({ title: 'Trip', settings: {} })).toBeNull()
    expect(topBarTitle({ title: 'Trip', settings: { topTitleOn: true } })).toBe('Trip')
    expect(topBarTitle({ title: 'Trip', settings: { topTitleOn: true, topTitle: '  Acme survey ' } })).toBe('Acme survey')
    expect(topBarTitle({ title: '', settings: { topTitleOn: true } })).toBe('Untitled form')
  })
})

describe('sections hidden by actions', () => {
  const pages = [
    { section: null, items: [], questions: [] },
    { section: { id: 's1' }, items: [], questions: [] },
    { section: { id: 's2' }, items: [], questions: [] },
    { section: { id: 's3' }, items: [], questions: [] },
  ]
  it('skips hidden sections, to the next shown one or to submit', () => {
    expect(skipHiddenPages(pages, 1, (id) => id === 's1')).toBe(2)
    expect(skipHiddenPages(pages, 1, (id) => ['s1', 's2'].includes(id))).toBe(3)
    expect(skipHiddenPages(pages, 2, () => true)).toBe('submit')
    expect(skipHiddenPages(pages, 'submit', () => true)).toBe('submit')
    expect(skipHiddenPages(pages, 2, () => false)).toBe(2)
  })
})
