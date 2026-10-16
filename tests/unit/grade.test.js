import { describe, expect, it } from 'vitest'
import { gradeResponse } from '../../functions/grade.js'

const form = (quiz = {}) => ({
  settings: { quiz: { enabled: true, showMissed: true, showCorrect: true, ...quiz } },
  questions: [
    { id: 'mc', type: 'multipleChoice', points: 2, options: ['A', 'B'] },
    { id: 'cb', type: 'checkboxes', points: 3, options: ['x', 'y', 'z'] },
    { id: 'st', type: 'shortText', points: 1 },
    { id: 's1', type: 'section' },
    { id: 'essay', type: 'longText', points: 5 },
    { id: 'survey', type: 'linearScale', min: 1, max: 5 }, // no points
  ],
})
const key = {
  questions: {
    mc: { correct: ['B'], feedbackCorrect: 'Nice', feedbackIncorrect: 'Revisit chapter 2' },
    cb: { correct: ['x', 'z'] },
    st: { correct: ['Abuja', 'FCT'] },
  },
}

describe('gradeResponse', () => {
  it('awards full points for right answers and sums the score', () => {
    const g = gradeResponse(form(), key, { mc: 'B', cb: ['z', 'x'], st: '  abuja ' })
    expect(g.points).toMatchObject({ mc: 2, cb: 3, st: 1, essay: 0 })
    expect(g.score).toBe(6)
    expect(g.maxScore).toBe(11) // 2 + 3 + 1 + 5; sections and pointless questions add nothing
  })

  it('needs the exact set for checkboxes', () => {
    expect(gradeResponse(form(), key, { cb: ['x'] }).points.cb).toBe(0)
    expect(gradeResponse(form(), key, { cb: ['x', 'y', 'z'] }).points.cb).toBe(0)
  })

  it('marks unanswered questions wrong', () => {
    const g = gradeResponse(form(), key, {})
    expect(g.score).toBe(0)
    expect(g.result.mc).toMatchObject({ correct: false, correctAnswer: ['B'] })
  })

  it('gives feedback for right and wrong answers', () => {
    expect(gradeResponse(form(), key, { mc: 'B' }).result.mc.feedback).toBe('Nice')
    expect(gradeResponse(form(), key, { mc: 'A' }).result.mc.feedback).toBe('Revisit chapter 2')
  })

  it('leaves questions without a key for manual grading', () => {
    const g = gradeResponse(form(), key, { essay: 'Long answer' })
    expect(g.points.essay).toBe(0)
    expect(g.result.essay).toEqual({ pending: true })
    expect(g.result.survey).toBeUndefined() // worth nothing, nothing to grade
  })

  it('only reveals what the quiz settings allow', () => {
    const hidden = gradeResponse(form({ showMissed: false, showCorrect: false }), key, { mc: 'A' })
    expect(hidden.result.mc).toEqual({ feedback: 'Revisit chapter 2' })
    const noAnswers = gradeResponse(form({ showCorrect: false }), key, { mc: 'A' })
    expect(noAnswers.result.mc).toEqual({ correct: false, feedback: 'Revisit chapter 2' })
  })

  it('never reveals the correct answer to someone who got it right', () => {
    expect(gradeResponse(form(), key, { mc: 'B' }).result.mc).not.toHaveProperty('correctAnswer')
  })

  it('ignores blank accepted answers', () => {
    const blankKey = { questions: { st: { correct: ['', '  '] } } }
    expect(gradeResponse(form(), blankKey, { st: 'x' }).result.st).toEqual({ pending: true })
    const mixed = { questions: { st: { correct: ['', 'Lagos'] } } }
    expect(gradeResponse(form(), mixed, { st: 'lagos' }).points.st).toBe(1)
  })

  it('copes with a missing answer key', () => {
    const g = gradeResponse(form(), undefined, { mc: 'B' })
    expect(g.score).toBe(0)
    expect(g.result.mc).toEqual({ pending: true })
  })
})
