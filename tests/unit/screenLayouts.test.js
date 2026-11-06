import { describe, expect, it } from 'vitest'
import { DEVICES, frameOf, resolveNode, screenDesign, screensOf } from '../../src/lib/interview.js'
import { LAYOUTS, applyLayout } from '../../src/lib/screenLayouts.js'

const form = {
  title: 'Welcome',
  questions: [
    { id: 'q1', type: 'shortText', title: 'Name' },
    { id: 'q2', type: 'multipleChoice', title: 'Plan', options: ['A', 'B'] },
    { id: 's1', type: 'section', title: 'More' },
    { id: 'q3', type: 'longText', title: 'Notes' },
  ],
}
const [first, second] = screensOf(form)
const start = screenDesign(form, first)
const later = screenDesign(form, second)
const qs = form.questions

const byType = (design, type) => Object.values(design.nodes).filter((n) => n.type === type)

describe('screen layouts', () => {
  it('keeps every block (same ids) in every layout', () => {
    for (const key of Object.keys(LAYOUTS)) {
      const out = applyLayout(later, key, { questions: qs })
      for (const id of Object.keys(later.nodes)) expect(out.nodes[id], `${key}: ${id}`).toBeTruthy()
      expect(out.layout).toBe(key)
    }
  })

  it('stacks the questions without overlapping, buttons last, on both devices', () => {
    const out = applyLayout(start, 'focus', { questions: qs })
    for (const device of Object.keys(DEVICES)) {
      const kids = Object.values(out.nodes)
        .filter((n) => n.parentId)
        .map((n) => frameOf(n, device))
        .sort((a, b) => a.y - b.y)
      for (let i = 1; i < kids.length; i++) expect(kids[i].y).toBeGreaterThanOrEqual(kids[i - 1].y)
      const button = frameOf(byType(out, 'button')[0], device)
      expect(Math.max(...kids.map((f) => f.y))).toBe(button.y)
    }
  })

  it('puts Back before Next on one row', () => {
    const out = applyLayout(later, 'card', { questions: qs })
    const [back] = byType(out, 'button').filter((b) => b.action?.type === 'back')
    const [next] = byType(out, 'button').filter((b) => b.action?.type !== 'back')
    for (const device of Object.keys(DEVICES)) {
      expect(frameOf(back, device).y).toBe(frameOf(next, device).y)
      expect(frameOf(back, device).x).toBeLessThan(frameOf(next, device).x)
    }
  })

  it('adds a sample picture beside the questions when the screen has none', () => {
    const out = applyLayout(start, 'side', { questions: qs, photo: '/layouts/x.jpg' })
    const [img] = byType(out, 'image')
    expect(img.image.url).toBe('/layouts/x.jpg')
    expect(out.nodes[img.parentId].parentId).toBeNull()
    expect(byType(out, 'card')).toHaveLength(2)
  })

  it('makes the heading bigger on desktop', () => {
    const out = applyLayout(start, 'cover', { questions: qs })
    const heading = byType(out, 'text')[0]
    expect(resolveNode(out.nodes[heading.id], 'desktop').style.size).toBeGreaterThan(
      resolveNode(out.nodes[heading.id], 'phone').style.size,
    )
  })
})

describe('how far people got (reachRows)', async () => {
  const { reachRows } = await import('../../src/features/responses/summarize.js')
  it('counts people per section, in order, with zeros', () => {
    const rows = reachRows(form, [{ screens: ['start', 's1'] }, { screens: ['start'] }, { screens: [] }])
    expect(rows).toEqual([
      { label: 'Section 1: Welcome', count: 2 },
      { label: 'Section 2: More', count: 1 },
    ])
    expect(reachRows({ ...form, mode: 'interview' }, [])[0]).toEqual({ label: 'Screen 1: Welcome', count: 0 })
  })
})
