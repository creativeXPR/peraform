import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { HYPERCBT_AI_FEATURES } from './hypercbt-catalog.js'

// The server half of HyperCBT's AI features, run by the suite's shared
// aiRun (billing/functions.js) so every Quality Tools app spends from the
// same wallet. features.js adds them with
//   Object.assign(FEATURES, hypercbtFeatures({ InputError, unescapeJson }))
// (passed in rather than imported, so the two files don't import each
// other). HyperCBT's data is in its own named database, `hypercbt`.

const DIFFICULTIES = ['easy', 'medium', 'hard']
const REVIEW_KINDS = ['unclear-wording', 'doubtful-answer', 'two-correct', 'weak-options', 'spelling', 'giveaway', 'other']

const TEST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'minutes', 'questions'],
  properties: {
    title: { type: 'string' },
    minutes: { type: 'integer' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'options', 'answerIndex', 'explanation', 'difficulty'],
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          answerIndex: { type: 'integer' },
          explanation: { type: 'string' },
          difficulty: { type: 'string', enum: DIFFICULTIES },
        },
      },
    },
  },
}

const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'suggestions'],
  properties: {
    summary: { type: 'string' },
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['questionId', 'kind', 'detail'],
        properties: {
          questionId: { type: 'string' },
          kind: { type: 'string', enum: REVIEW_KINDS },
          detail: { type: 'string' },
          // The fix, when there's a concrete one: only what changes.
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          answerIndex: { type: 'integer' },
        },
      },
    },
  },
}

const QUESTION_RULES = `Every question is multiple choice with exactly one correct answer:
- 4 options (3 to 5 only if the subject really calls for it); "answerIndex" is the 0-based position of the correct one.
- Wrong options are plausible: common mistakes and misconceptions, similar in length and style to the right one. No "all of the above", "none of the above" or joke options.
- Vary where the correct answer sits; don't let wording or length give it away.
- One clear question each: no double negatives, no trick wording, nothing that depends on another question.
- "explanation": one short sentence saying why the answer is right (shown to the teacher).
- "difficulty": easy, medium or hard. Unless asked otherwise, mix them: about 30% easy, 50% medium, 20% hard.
Facts must be correct; when unsure, leave the question out.`

const CREATE_SYSTEM = `You write computer-based tests for HyperCBT, a test and exam app for schools and organisations.
Write a complete, ready-to-use multiple-choice test: a short title, a sensible time limit in "minutes" (about 1 minute a question, 1 to 180), and well-ordered questions.
If the request says how many questions, write exactly that many (at most 60); otherwise write 10.

${QUESTION_RULES}
Write in the language of the request.`

const REVIEW_SYSTEM = `You are a careful exam moderator for HyperCBT, a computer-based test app.
You get a multiple-choice test as JSON; "answer" is the 0-based index of the option marked correct. Check each question and suggest fixes only where they are needed:
- unclear-wording: ambiguous or confusing question text.
- doubtful-answer: the marked answer looks wrong, or another option is the right one.
- two-correct: more than one option could be argued correct.
- weak-options: wrong options that are obviously wrong, joke options, or "all/none of the above".
- spelling: spelling, grammar or punctuation mistakes.
- giveaway: wording, length or grammar that gives the answer away.
- other: anything else a moderator should flag.
For each suggestion give the question's "questionId", the "kind", and "detail": one or two plain sentences for the teacher.
When there is a concrete fix, add only what changes: "question" (new text), "options" (the full new list) and/or "answerIndex" (the 0-based index in the new or current list).
Don't suggest changes for their own sake: a sound question gets no suggestion. At most 3 suggestions a question.
"summary": one or two plain sentences on the test overall.
Write in the language of the test.`

function cleanText(value, max, InputError, empty = 'Tell us what the test is about.') {
  if (typeof value !== 'string') throw new InputError(empty)
  const text = value.trim()
  if (text.length < 3) throw new InputError(empty)
  if (text.length > max) throw new InputError(`That’s too long (${max.toLocaleString()} characters at most).`)
  return text
}

// A question the AI wrote → one HyperCBT can use (or null).
function cleanQuestion(q) {
  const question = String(q?.question ?? '').trim()
  const options = (Array.isArray(q?.options) ? q.options : []).map((o) => String(o).trim()).filter(Boolean).slice(0, 8)
  const answerIndex = Number.isInteger(q?.answerIndex) ? q.answerIndex : -1
  if (!question || options.length < 2 || answerIndex < 0 || answerIndex >= options.length) return null
  return {
    question,
    options,
    answerIndex,
    explanation: String(q?.explanation ?? '').trim(),
    difficulty: DIFFICULTIES.includes(q?.difficulty) ? q.difficulty : 'medium',
  }
}

export function hypercbtFeatures({ InputError, unescapeJson }) {
  return {
    'create-test': {
      ...HYPERCBT_AI_FEATURES['create-test'],
      system: CREATE_SYSTEM,
      schema: TEST_SCHEMA,
      effort: 'low',
      // input: { mode: 'describe' | 'notes', text }
      prepare(input) {
        const mode = input?.mode === 'notes' ? 'notes' : 'describe'
        const text = cleanText(input?.text, this.maxChars[mode], InputError)
        const prompt =
          mode === 'describe'
            ? `Create a test for this:\n\n${text}`
            : `Write a test that checks understanding of this material. Ask only about what the material says.\n\n<material>\n${text}\n</material>`
        return { prompt, mode, chars: text.length }
      },
      result(json) {
        const questions = (Array.isArray(json?.questions) ? json.questions : []).map(cleanQuestion).filter(Boolean)
        if (!questions.length) return null
        const minutes = Math.min(180, Math.max(1, Number.isInteger(json.minutes) ? json.minutes : questions.length))
        return { test: { title: String(json.title ?? '').trim(), minutes, questions } }
      },
      // From the half-written JSON: the title, and the questions so far.
      progress(text) {
        const title = text.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/)
        const written = [...text.matchAll(/"question"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => unescapeJson(m[1]))
        return { title: title ? unescapeJson(title[1]) : null, questions: written.length, written }
      },
    },

    'review-test': {
      ...HYPERCBT_AI_FEATURES['review-test'],
      system: REVIEW_SYSTEM,
      schema: REVIEW_SCHEMA,
      effort: 'low',
      // input: { testId, focus? }. The test and its answer key are read
      // here, from HyperCBT's database - only the test's owner may run it.
      async prepare(input, ctx) {
        const focus = typeof input?.focus === 'string' ? input.focus.trim().slice(0, this.maxChars.review) : ''
        const testId = typeof input?.testId === 'string' ? input.testId : ''
        const email = ctx?.email ?? (ctx?.uid ? (await getAuth().getUser(ctx.uid)).email : null)
        const hdb = getFirestore('hypercbt')
        const [testSnap, keySnap] = testId
          ? await Promise.all([hdb.doc(`tests/${testId}`).get(), hdb.doc(`tests/${testId}/answerKey/data`).get()])
          : [null, null]
        const test = testSnap?.data()
        if (!test || !email || test.createdBy !== email) throw new InputError('Test not found.')
        const answers = keySnap?.data()?.answers ?? []
        const questions = (test.questions ?? []).map((q, i) => {
          const answer = String(answers[i] ?? '').trim().toLowerCase()
          return {
            id: q.id || `q${i + 1}`,
            question: q.question,
            options: q.options,
            answer: answer ? q.options.findIndex((o) => o.trim().toLowerCase() === answer) : -1,
          }
        })
        if (!questions.length) throw new InputError('Add some questions first.')
        const json = JSON.stringify({ title: test.displayName ?? '', questions })
        if (json.length > this.maxTestChars) {
          throw new InputError('This test is too long to review in one go. Try it on a copy with fewer questions.')
        }
        const prompt = `Test:\n${json}${focus ? `\n\nWhat to focus on:\n${focus}` : ''}`
        return { prompt, mode: 'review', chars: json.length + focus.length }
      },
      result(json) {
        if (!json || !Array.isArray(json.suggestions)) return null
        const suggestions = json.suggestions
          .filter((s) => s && typeof s.questionId === 'string' && REVIEW_KINDS.includes(s.kind) && s.detail)
          .map((s) => {
            const out = { questionId: s.questionId, kind: s.kind, detail: String(s.detail).trim() }
            if (typeof s.question === 'string' && s.question.trim()) out.question = s.question.trim()
            if (Array.isArray(s.options)) {
              const options = s.options.map((o) => String(o).trim()).filter(Boolean)
              if (options.length >= 2 && options.length <= 8) out.options = options
            }
            if (Number.isInteger(s.answerIndex) && s.answerIndex >= 0) out.answerIndex = s.answerIndex
            return out
          })
        return { summary: String(json.summary ?? '').trim(), suggestions }
      },
      // Progress: the suggestions written so far (their details).
      progress(text) {
        const written = [...text.matchAll(/"detail"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => unescapeJson(m[1]))
        return { title: null, questions: written.length, written }
      },
    },
  }
}

// Emulator stand-ins (AI_FAKE=1), merged into FAKE_OUTPUT.
export const HYPERCBT_FAKE_OUTPUT = {
  'create-test': {
    title: 'The water cycle',
    minutes: 5,
    questions: [
      {
        question: 'What is it called when water vapour cools and turns back into liquid?',
        options: ['Evaporation', 'Condensation', 'Precipitation', 'Collection'],
        answerIndex: 1,
        explanation: 'Condensation is vapour cooling into liquid droplets, which form clouds.',
        difficulty: 'easy',
      },
      {
        question: 'Which process returns water from clouds to the ground?',
        options: ['Precipitation', 'Transpiration', 'Evaporation', 'Infiltration'],
        answerIndex: 0,
        explanation: 'Rain, snow, sleet and hail are all precipitation.',
        difficulty: 'medium',
      },
    ],
  },
  'review-test': {
    summary: 'The test is mostly clear; one question has two answers that could be argued.',
    suggestions: [
      {
        questionId: 'q1',
        kind: 'two-correct',
        detail: 'Both “Newton” and “kg·m/s²” name the SI unit of force.',
        options: ['Newton', 'Joule', 'Watt', 'Pascal'],
        answerIndex: 0,
      },
    ],
  },
}
