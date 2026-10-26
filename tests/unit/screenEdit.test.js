import { describe, expect, it } from 'vitest'
import { FAKE_OUTPUT } from '../../functions/ai/features.js'
import { screensOf, starterScreen } from '../../src/lib/interview.js'
import { applyScreenEdit, cleanStyle, screenForAi } from '../../src/lib/screenEdit.js'

const form = {
  title: 'Welcome',
  description: 'Tell us about you',
  questions: [{ id: 'q1', type: 'shortText', title: 'Name' }],
}
const screens = screensOf(form)
const start = starterScreen(form, screens[0], true)
const byType = (d, type) => Object.values(d.nodes).filter((n) => n.type === type)
const title = byType(start, 'text')[0]
const card = byType(start, 'card')[0]
const question = byType(start, 'question')[0]
const button = byType(start, 'button')[0]

describe('screenForAi', () => {
  it('lists every block with its frame on the device, text and question titles', () => {
    const s = screenForAi(start, 'desktop', form.questions)
    expect(s.width).toBe(1280)
    expect(s.blocks).toHaveLength(Object.keys(start.nodes).length)
    expect(s.blocks.find((b) => b.id === title.id)).toMatchObject({ type: 'text', parent: card.id, text: 'Welcome' })
    expect(s.blocks.find((b) => b.id === question.id).question).toBe('Name')
    expect(s.blocks.find((b) => b.id === button.id)).toMatchObject({ label: 'Submit', action: 'submit' })
    expect(s.blocks.find((b) => b.id === card.id).x).toBe(card.frames.desktop.x)
  })
})

describe('applyScreenEdit', () => {
  it('moves and restyles on the edited device only', () => {
    const { design, applied } = applyScreenEdit(
      start,
      { changes: [{ op: 'update', id: button.id, x: 100, style: { bg: '#FF0000', size: 999, shadow: 'glow', font: 'comic' } }] },
      'phone',
    )
    expect(applied).toBe(1)
    const b = design.nodes[button.id]
    expect(b.frames.phone.x).toBe(100)
    expect(b.frames.desktop).toEqual(button.frames.desktop)
    expect(b.style).toMatchObject({ bg: '#ff0000', size: 120, shadow: 'glow' })
    expect(b.style.font).toBeUndefined()
  })

  it('adds blocks into a card (and a card added in the same answer)', () => {
    const { design } = applyScreenEdit(
      start,
      {
        changes: [
          { op: 'add', id: 'new-1', type: 'image', parent: card.id, x: 20, y: 400, w: 200, h: 120 },
          { op: 'add', id: 'new-2', type: 'card', x: 16, y: 900, w: 300, h: 100 },
          { op: 'add', id: 'new-3', type: 'text', parent: 'new-2', x: 10, y: 10, w: 200, h: 30, text: 'Hi' },
          { op: 'add', id: 'new-4', type: 'text', x: 10, y: 10, w: 200, h: 30, text: 'Not in a card' },
        ],
      },
      'phone',
    )
    const added = Object.values(design.nodes).filter((n) => !start.nodes[n.id])
    expect(added.map((n) => n.type).sort()).toEqual(['card', 'image', 'text'])
    const newCard = added.find((n) => n.type === 'card')
    expect(added.find((n) => n.type === 'text')).toMatchObject({ parentId: newCard.id, text: 'Hi' })
    // Cards keep their size ("Fit to blocks" is a button).
    expect(design.nodes[card.id].frames.phone.h).toBe(start.nodes[card.id].frames.phone.h)
  })

  it('never removes or hides question blocks', () => {
    const { design, applied } = applyScreenEdit(
      start,
      {
        changes: [
          { op: 'remove', id: question.id },
          { op: 'remove', id: card.id },
          { op: 'update', id: question.id, hidden: true },
          { op: 'remove', id: 'nope' },
          { op: 'remove', id: button.id },
        ],
      },
      'phone',
    )
    expect(design.nodes[question.id].frames.phone.hidden).toBeFalsy()
    expect(design.nodes[card.id]).toBeTruthy()
    expect(design.nodes[button.id]).toBeUndefined()
    expect(applied).toBe(2) // the (no-op) update and the button removal
  })

  it('sets a colour or gradient background', () => {
    expect(applyScreenEdit(start, { background: { color: '#112233' } }, 'phone').design.bg).toBe('#112233')
    expect(applyScreenEdit(start, { background: { color: '#112233', to: '#445566', angle: 90 } }, 'phone').design.bg).toBe(
      'linear-gradient(90deg, #112233 0%, #445566 100%)',
    )
    expect(applyScreenEdit(start, { background: { color: 'url(evil)' } }, 'phone').design.bg).toBe(start.bg)
  })

  it('applies url actions to buttons and url links to text', () => {
    const { design } = applyScreenEdit(
      start,
      {
        changes: [
          { op: 'update', id: button.id, action: 'url', url: 'https://peraform.com', target: '_blank' },
          { op: 'update', id: title.id, url: 'https://example.com', target: '_self' },
        ],
      },
      'desktop',
    )
    expect(design.nodes[button.id].action).toMatchObject({ type: 'url', url: 'https://peraform.com', target: '_blank' })
    expect(design.nodes[title.id].url).toBe('https://example.com')
    expect(design.nodes[title.id].target).toBe('_self')
  })

  it('applies the emulator stand-in answer', () => {
    const { applied } = applyScreenEdit(start, FAKE_OUTPUT['edit-screen'], 'phone')
    expect(applied).toBe(2)
  })
})

describe('cleanStyle', () => {
  it('keeps only drawable values', () => {
    expect(cleanStyle({ bg: 'red', color: 'accent', weight: 650, align: 'middle', opacity: 3, extra: 1 })).toEqual({
      color: 'accent',
      weight: 700,
      opacity: 1,
    })
  })

  it('keeps valid valign (top, middle, bottom) and drops invalid values', () => {
    expect(cleanStyle({ valign: 'top' })).toEqual({ valign: 'top' })
    expect(cleanStyle({ valign: 'middle' })).toEqual({ valign: 'middle' })
    expect(cleanStyle({ valign: 'bottom' })).toEqual({ valign: 'bottom' })
    expect(cleanStyle({ valign: 'center' })).toEqual({})
    expect(cleanStyle({ valign: 'invalid' })).toEqual({})
  })
})
