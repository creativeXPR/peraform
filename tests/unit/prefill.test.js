import { describe, expect, it } from 'vitest'
import { hasPrefill, parsePrefill, prefillUrl } from '../../src/lib/prefill.js'

const form = {
  questions: [
    { id: 'name', type: 'shortText', title: 'Name' },
    { id: 'go', type: 'multipleChoice', title: 'Coming?', options: ['Yes', 'No'] },
    { id: 'food', type: 'checkboxes', title: 'Food', options: ['Rice', 'Beans', 'Yam'] },
    { id: 'rate', type: 'linearScale', title: 'Rate', min: 1, max: 5 },
    { id: 's', type: 'section', title: 'More' },
    { id: 'grid', type: 'mcGrid', title: 'Grid', rows: ['a'], columns: ['x'] },
  ],
}

describe('pre-filled links', () => {
  it('round-trips answers through the URL', () => {
    const answers = { name: 'Adé Amo & co', go: 'Yes', food: ['Rice', 'Yam'], rate: 4, grid: { 0: 'x' } }
    const url = prefillUrl('https://x.app/f/abc', form, answers)
    expect(url).not.toContain('grid')
    expect(parsePrefill(form, new URL(url).search)).toEqual({
      name: 'Adé Amo & co',
      go: 'Yes',
      food: ['Rice', 'Yam'],
      rate: 4,
    })
  })

  it('drops values that don’t fit the question', () => {
    const search = '?a.go=Maybe&a.food=Pizza&a.rate=9&a.unknown=1&a.s=hi'
    expect(parsePrefill(form, search)).toEqual({})
    expect(hasPrefill(search)).toBe(true)
    expect(hasPrefill('?embed=1')).toBe(false)
  })
})
