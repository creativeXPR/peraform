import { describe, expect, it } from 'vitest'
import { TEMPLATES } from '../../src/features/dashboard/templates.js'
import { QUESTION_TYPES } from '../../src/lib/formModel.js'

describe('templates', () => {
  it('has templates defined with required metadata', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(15)
    for (const t of TEMPLATES) {
      expect(t.key).toBeTruthy()
      expect(t.name).toBeTruthy()
      expect(['personal', 'work', 'education']).toContain(t.category)
      expect(t.theme).toBeDefined()
      expect(t.theme.headerImage?.url).toMatch(/^\/templates\/[\w-]+\.svg$/)
    }
  })

  it('generates unique question IDs on separate build calls', () => {
    for (const t of TEMPLATES) {
      const form1 = t.build()
      const form2 = t.build()

      expect(form1.title).toBeTruthy()
      expect(form1.questions.length).toBeGreaterThanOrEqual(1)

      const ids1 = form1.questions.map((q) => q.id)
      const ids2 = form2.questions.map((q) => q.id)

      // Internal uniqueness
      expect(new Set(ids1).size).toBe(ids1.length)
      expect(new Set(ids2).size).toBe(ids2.length)

      // Uniqueness across separate build calls
      const shared = ids1.filter((id) => ids2.includes(id))
      expect(shared).toEqual([])
    }
  })

  it('uses valid question types and required options', () => {
    const validTypes = [...QUESTION_TYPES, 'section', 'text', 'image', 'video']
    const choiceTypes = ['multipleChoice', 'checkboxes', 'dropdown']

    for (const t of TEMPLATES) {
      const form = t.build()
      for (const q of form.questions) {
        expect(validTypes).toContain(q.type)
        if (choiceTypes.includes(q.type)) {
          expect(Array.isArray(q.options)).toBe(true)
          expect(q.options.length).toBeGreaterThanOrEqual(1)
        }
        if (q.type === 'mcGrid' || q.type === 'checkboxGrid') {
          expect(Array.isArray(q.rows)).toBe(true)
          expect(q.rows.length).toBeGreaterThanOrEqual(1)
          expect(Array.isArray(q.columns)).toBe(true)
          expect(q.columns.length).toBeGreaterThanOrEqual(1)
        }
      }
    }
  })

  it('configures quiz settings for education quiz templates', () => {
    const quizKeys = ['blank-quiz', 'exit-ticket', 'assessment', 'worksheet']
    for (const key of quizKeys) {
      const t = TEMPLATES.find((x) => x.key === key)
      expect(t).toBeDefined()
      const form = t.build()
      expect(form.settings?.quiz?.enabled).toBe(true)
      expect(form.settings.quiz.release).toBe('immediate')
    }
  })

  it('manages recently used template keys in localStorage', async () => {
    const store = new Map()
    globalThis.localStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    }

    const { getRecentTemplateKeys, saveRecentTemplateKey } = await import(
      '../../src/features/dashboard/templates.js'
    )
    expect(getRecentTemplateKeys()).toEqual([])

    saveRecentTemplateKey('contact')
    saveRecentTemplateKey('rsvp')
    saveRecentTemplateKey('assessment')

    expect(getRecentTemplateKeys()).toEqual(['assessment', 'rsvp', 'contact'])

    // Deduplication and moving to front
    saveRecentTemplateKey('rsvp')
    expect(getRecentTemplateKeys()).toEqual(['rsvp', 'assessment', 'contact'])

    // Caps at 6 items
    saveRecentTemplateKey('k1')
    saveRecentTemplateKey('k2')
    saveRecentTemplateKey('k3')
    saveRecentTemplateKey('k4')
    expect(getRecentTemplateKeys().length).toBe(6)
    expect(getRecentTemplateKeys()[0]).toBe('k4')
  })
})
