import { describe, expect, it } from 'vitest'
import { FILE_FORMAT, fileName, fileToForm, formToFile } from '../../src/lib/formFile.js'
import { convertGoogleForm } from '../../src/lib/googleFormImport.js'

const draft = {
  title: 'Quiz',
  description: 'About France',
  mode: 'interview',
  theme: { color: 'teal', headerImage: { url: 'https://example.com/h.png', path: 'forms/x/h.png' } },
  settings: { quiz: { enabled: true }, restricted: true, limitOneResponse: true },
  questions: [
    { id: 'q1', type: 'multipleChoice', title: 'Capital?', options: ['Paris', 'Lyon'], points: 1, actions: [{ id: 'a', trigger: { type: 'select', option: 'Lyon' }, target: 's1', effect: { type: 'hide' } }] },
    { id: 's1', type: 'section', title: 'More', next: 'submit' },
    { id: 't1', type: 'text', title: 'Thanks', description: '' },
    { id: 'v1', type: 'video', title: '', description: '', videoId: 'dQw4w9WgXcQ' },
  ],
  interview: {
    screens: {
      start: { bg: null, nodes: { n1: { id: 'n1', type: 'question', questionId: 'q1', frames: {} }, e1: { id: 'e1', type: 'embed', url: 'javascript:alert(1)', frames: {} } } },
      s1: { bg: null, nodes: {} },
    },
  },
  answerKey: { q1: { correct: ['Paris'] } },
  ownerId: 'someone',
  memberIds: ['someone'],
  status: 'published',
}

describe('PeraForm file', () => {
  const file = formToFile(draft)

  it('saves the form, never ownership, status or responses', () => {
    expect(file.format).toBe(FILE_FORMAT)
    expect(file.form.ownerId).toBeUndefined()
    expect(file.form.status).toBeUndefined()
    expect(file.answerKey).toEqual({ q1: { correct: ['Paris'] } })
    expect(fileName('A/B: test?')).toBe('A B test.peraform.json')
  })

  it('imports with fresh ids, every reference following', () => {
    const { content, answerKey } = fileToForm(JSON.parse(JSON.stringify(file)))
    const [q1, s1, t1, v1] = content.questions
    expect(q1.id).not.toBe('q1')
    expect(q1.actions[0].target).toBe(s1.id)
    expect(Object.keys(answerKey)).toEqual([q1.id])
    expect(content.interview.screens[s1.id]).toBeTruthy()
    expect(content.interview.screens.start.nodes.n1.questionId).toBe(q1.id)
    expect(t1.type).toBe('text')
    expect(v1.videoId).toBe('dQw4w9WgXcQ')
    expect(content.mode).toBe('interview')
  })

  it('drops unsafe addresses, storage paths and lock-out settings', () => {
    const { content } = fileToForm(JSON.parse(JSON.stringify(file)))
    expect(content.interview.screens.start.nodes.e1.url).toBeUndefined()
    expect(content.theme.headerImage).toEqual({ url: 'https://example.com/h.png' })
    expect(content.settings.restricted).toBeUndefined()
    expect(content.settings.limitOneResponse).toBe(true)
  })

  it('still reads the older simple files, and refuses unknown items', () => {
    const { content } = fileToForm({ title: 'Old', questions: [{ type: 'shortText', title: 'Name' }] })
    expect(content.questions[0].title).toBe('Name')
    expect(() => fileToForm({ format: FILE_FORMAT, version: 1, form: { questions: [{ id: 'x', type: 'virus' }] } })).toThrow()
  })
})

describe('Google Form import', () => {
  const g = {
    info: { title: 'Survey', description: 'Hi' },
    settings: { quizSettings: { isQuiz: true } },
    items: [
      {
        itemId: 'i1',
        title: 'Pick one',
        questionItem: {
          question: {
            required: true,
            grading: { pointValue: 2, correctAnswers: { answers: [{ value: 'B' }] }, whenRight: { text: 'Yes!' } },
            choiceQuestion: { type: 'RADIO', options: [{ value: 'A', goToSectionId: 'p1' }, { value: 'B', goToAction: 'SUBMIT_FORM' }, { isOther: true }] },
          },
        },
      },
      { itemId: 'i2', title: 'About you', questionItem: { question: { textQuestion: { paragraph: true } } } },
      { itemId: 'i3', title: 'Rate', questionItem: { question: { scaleQuestion: { low: 0, high: 7, lowLabel: 'Bad', highLabel: 'Good' } } } },
      { itemId: 'p1', title: 'Part 2', pageBreakItem: {} },
      { itemId: 'i4', title: 'Grid', questionGroupItem: { questions: [{ rowQuestion: { title: 'Row 1' } }], grid: { columns: { type: 'CHECKBOX', options: [{ value: 'X' }, { value: 'Y' }] } } } },
      { itemId: 'i5', title: 'Logo', imageItem: { image: { contentUri: 'https://lh3.example/x' } } },
      { itemId: 'i6', title: 'Clip', videoItem: { video: { youtubeUri: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } } },
    ],
  }
  const { content, answerKey, skipped } = convertGoogleForm(g)
  const [mc, long, scale, section, grid, video] = content.questions

  it('maps question types, sections and quiz answers', () => {
    expect(content.title).toBe('Survey')
    expect(content.settings).toEqual({ quiz: { enabled: true } })
    expect(mc).toMatchObject({ type: 'multipleChoice', options: ['A', 'B'], allowOther: true, required: true, points: 2, branching: true })
    expect(mc.goTo).toEqual([section.id, 'submit'])
    expect(answerKey[mc.id]).toEqual({ correct: ['B'], feedbackCorrect: 'Yes!' })
    expect(long.type).toBe('longText')
    expect(scale).toMatchObject({ type: 'linearScale', min: 0, max: 7, minLabel: 'Bad', maxLabel: 'Good' })
    expect(section.type).toBe('section')
    expect(grid).toMatchObject({ type: 'checkboxGrid', rows: ['Row 1'], columns: ['X', 'Y'] })
    expect(video).toMatchObject({ type: 'video', videoId: 'dQw4w9WgXcQ' })
  })

  it('says what couldn’t come across', () => {
    expect(skipped).toEqual(['image “Logo”'])
  })
})

describe('PeraForm file: header art', () => {
  it('keeps this site’s own header images and the banner settings', () => {
    const file = formToFile({
      title: 'T',
      questions: [],
      theme: { headerImage: { url: '/headers/waves-ocean.svg' }, header: { overlayOpacity: 40, logo: { url: 'https://x.example/logo.png' }, title: 'Hi' } },
    })
    const { content } = fileToForm(JSON.parse(JSON.stringify(file)))
    expect(content.theme.headerImage.url).toBe('/headers/waves-ocean.svg')
    expect(content.theme.header).toMatchObject({ overlayOpacity: 40, logo: { url: 'https://x.example/logo.png' }, title: 'Hi' })
    const bad = fileToForm({ ...file, form: { ...file.form, theme: { headerImage: { url: '//evil.example/x.png' } } } })
    expect(bad.content.theme.headerImage.url).toBeUndefined()
  })
})
