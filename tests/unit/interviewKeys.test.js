import { describe, expect, it } from 'vitest'
import {
  findChoiceQuestion,
  flatReadingOrder,
  interviewProgress,
  isEnterBlocked,
  isTextInput,
  readingOrder,
  toggleChoiceOption,
  visibleInterviewScreens,
} from '../../src/lib/interviewKeys.js'

describe('interviewKeys', () => {
  describe('readingOrder and flatReadingOrder', () => {
    it('sorts sibling nodes by y then x', () => {
      const nodes = {
        n1: { id: 'n1', parentId: null, frames: { phone: { x: 50, y: 100, w: 200, h: 40, z: 1 } }, seq: 1 },
        n2: { id: 'n2', parentId: null, frames: { phone: { x: 10, y: 50, w: 200, h: 40, z: 10 } }, seq: 2 },
        n3: { id: 'n3', parentId: null, frames: { phone: { x: 10, y: 100, w: 200, h: 40, z: 0 } }, seq: 3 },
      }
      const order = readingOrder(nodes, null, 'phone')
      // y=50 (n2) first, then y=100 with x=10 (n3), then y=100 with x=50 (n1)
      expect(order.map((n) => n.id)).toEqual(['n2', 'n3', 'n1'])
    })

    it('orders cards before their children in flat reading order', () => {
      const nodes = {
        cardA: { id: 'cardA', type: 'card', parentId: null, frames: { phone: { x: 0, y: 10, w: 300, h: 200 } } },
        childA1: { id: 'childA1', parentId: 'cardA', frames: { phone: { x: 0, y: 10, w: 100, h: 30 } } },
        childA2: { id: 'childA2', parentId: 'cardA', frames: { phone: { x: 0, y: 50, w: 100, h: 30 } } },
        cardB: { id: 'cardB', type: 'card', parentId: null, frames: { phone: { x: 0, y: 300, w: 300, h: 200 } } },
        childB1: { id: 'childB1', parentId: 'cardB', frames: { phone: { x: 0, y: 10, w: 100, h: 30 } } },
      }
      const flat = flatReadingOrder(nodes, null, 'phone')
      expect(flat.map((n) => n.id)).toEqual(['cardA', 'childA1', 'childA2', 'cardB', 'childB1'])
    })
  })

  describe('isEnterBlocked', () => {
    it('blocks Enter inside textarea or contenteditable', () => {
      expect(isEnterBlocked({ tagName: 'TEXTAREA' })).toBe(true)
      expect(isEnterBlocked({ tagName: 'div', isContentEditable: true })).toBe(true)
    })

    it('blocks Enter on dropdowns and select elements', () => {
      expect(isEnterBlocked({ tagName: 'SELECT' })).toBe(true)
      expect(isEnterBlocked({ tagName: 'button', getAttribute: (attr) => (attr === 'role' ? 'combobox' : null) })).toBe(true)
      expect(isEnterBlocked({ tagName: 'div', closest: (sel) => sel.includes('select') })).toBe(true)
    })

    it('blocks Enter when a button or link has focus', () => {
      expect(isEnterBlocked({ tagName: 'BUTTON' })).toBe(true)
      expect(isEnterBlocked({ tagName: 'A' })).toBe(true)
      expect(isEnterBlocked({ tagName: 'span', getAttribute: (attr) => (attr === 'role' ? 'button' : null) })).toBe(true)
      expect(isEnterBlocked({ tagName: 'span', getAttribute: (attr) => (attr === 'role' ? 'link' : null) })).toBe(true)
      expect(isEnterBlocked({ tagName: 'span', closest: (sel) => sel.includes('button') })).toBe(true)
    })

    it('allows Enter for general body or text input elements', () => {
      expect(isEnterBlocked(null)).toBe(false)
      expect(isEnterBlocked({ tagName: 'BODY' })).toBe(false)
      expect(isEnterBlocked({ tagName: 'DIV' })).toBe(false)
      expect(isEnterBlocked({ tagName: 'INPUT', type: 'text' })).toBe(false)
      expect(isEnterBlocked({ tagName: 'INPUT', type: 'radio' })).toBe(false)
    })
  })

  describe('isTextInput', () => {
    it('identifies text input fields correctly', () => {
      expect(isTextInput({ tagName: 'TEXTAREA' })).toBe(true)
      expect(isTextInput({ tagName: 'div', isContentEditable: true })).toBe(true)
      expect(isTextInput({ tagName: 'INPUT', type: 'text' })).toBe(true)
      expect(isTextInput({ tagName: 'INPUT', type: 'email' })).toBe(true)
      expect(isTextInput({ tagName: 'INPUT', type: 'number' })).toBe(true)
    })

    it('returns false for non-text inputs and buttons', () => {
      expect(isTextInput(null)).toBe(false)
      expect(isTextInput({ tagName: 'INPUT', type: 'radio' })).toBe(false)
      expect(isTextInput({ tagName: 'INPUT', type: 'checkbox' })).toBe(false)
      expect(isTextInput({ tagName: 'INPUT', type: 'button' })).toBe(false)
      expect(isTextInput({ tagName: 'BUTTON' })).toBe(false)
      expect(isTextInput({ tagName: 'BODY' })).toBe(false)
      expect(isTextInput({ tagName: 'DIV' })).toBe(false)
    })
  })

  describe('findChoiceQuestion', () => {
    const q1 = { id: 'q1', type: 'multipleChoice', options: ['A', 'B', 'C'] }
    const q2 = { id: 'q2', type: 'checkboxes', options: ['X', 'Y', 'Z'] }

    it('finds question when target is inside its question block', () => {
      const target = {
        closest: (selector) => {
          if (selector.includes('data-question-id')) return { dataset: { questionId: 'q2' } }
          return null
        },
      }
      const match = findChoiceQuestion({ target, choiceQuestions: [q1, q2] })
      expect(match).toBe(q2)
    })

    it('picks the only choice question on the screen when focus is elsewhere', () => {
      const target = { tagName: 'BODY' }
      const match = findChoiceQuestion({ target, choiceQuestions: [q1] })
      expect(match).toBe(q1)
    })

    it('returns null when multiple choice questions exist and focus is outside', () => {
      const target = { tagName: 'BODY' }
      const match = findChoiceQuestion({ target, choiceQuestions: [q1, q2] })
      expect(match).toBeNull()
    })

    it('returns null when no choice questions exist', () => {
      const match = findChoiceQuestion({ target: null, choiceQuestions: [] })
      expect(match).toBeNull()
    })
  })

  describe('toggleChoiceOption', () => {
    it('sets option value for multipleChoice', () => {
      const q = { type: 'multipleChoice' }
      expect(toggleChoiceOption(q, 'Option B', 'Option A')).toBe('Option B')
      expect(toggleChoiceOption(q, 'Option A', null)).toBe('Option A')
    })

    it('toggles option in array for checkboxes', () => {
      const q = { type: 'checkboxes' }
      expect(toggleChoiceOption(q, 'Opt 1', [])).toEqual(['Opt 1'])
      expect(toggleChoiceOption(q, 'Opt 2', ['Opt 1'])).toEqual(['Opt 1', 'Opt 2'])
      expect(toggleChoiceOption(q, 'Opt 1', ['Opt 1', 'Opt 2'])).toEqual(['Opt 2'])
      expect(toggleChoiceOption(q, 'Opt 1', null)).toEqual(['Opt 1'])
    })
  })

  describe('visibleInterviewScreens and interviewProgress', () => {
    const screens = [
      { key: 's1' },
      { key: 's2' },
      { key: 's3' },
      { key: 's4' },
    ]

    it('filters out hidden screens', () => {
      const overrides = { s2: { hidden: true } }
      const startsHidden = () => false
      const visible = visibleInterviewScreens(screens, overrides, startsHidden)
      expect(visible.map((s) => s.key)).toEqual(['s1', 's3', 's4'])
    })

    it('computes 1-based current screen / total visible screens', () => {
      const overrides = { s2: { hidden: true } }
      const startsHidden = () => false
      // s1 is visible screen #1 of 3
      expect(interviewProgress(screens, 's1', overrides, startsHidden)).toEqual({ current: 1, total: 3 })
      // s3 is visible screen #2 of 3
      expect(interviewProgress(screens, 's3', overrides, startsHidden)).toEqual({ current: 2, total: 3 })
      // s4 is visible screen #3 of 3
      expect(interviewProgress(screens, 's4', overrides, startsHidden)).toEqual({ current: 3, total: 3 })
    })
  })
})
