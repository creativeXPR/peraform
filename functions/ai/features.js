import { AI_FEATURES } from './catalog.js'

// The server half of each AI feature: input checks, the prompt and the
// output schema. The app sends only { feature, tier, input }: never a
// prompt, a model or a token limit.

export class InputError extends Error {}

const QUESTION_TYPES = [
  'section',
  'shortText',
  'longText',
  'multipleChoice',
  'checkboxes',
  'dropdown',
  'linearScale',
  'rating',
  'mcGrid',
  'checkboxGrid',
  'date',
  'time',
]

const strings = { type: 'array', items: { type: 'string' } }

// A PeraForm form, in the same shape as an exported/imported file
// (src/features/dashboard/formActions.js → parseFormContent cleans it).
const FORM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description', 'questions'],
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'title', 'description', 'required'],
        properties: {
          type: { type: 'string', enum: QUESTION_TYPES },
          title: { type: 'string' },
          description: { type: 'string' },
          required: { type: 'boolean' },
          options: strings,
          min: { type: 'integer', enum: [0, 1] },
          max: { type: 'integer' },
          minLabel: { type: 'string' },
          maxLabel: { type: 'string' },
          rows: strings,
          columns: strings,
        },
      },
    },
  },
}

const GENERATE_SYSTEM = `You design forms for PeraForm, an online form builder like Google Forms.
Write a complete, ready-to-use form: a clear title, a one or two sentence description, and well-ordered questions.

Choose the question type that makes answering fastest and the answers easiest to analyse:
- multipleChoice (one answer) or checkboxes (several) when the answers are a known, short list; dropdown when the list is long (over 7).
- linearScale for agreement or satisfaction (min 1, max 5, with minLabel and maxLabel); rating for star ratings (max 5).
- mcGrid or checkboxGrid when several items share the same scale (rows = items, columns = scale).
- date and time for dates and times; shortText for names, emails, phone numbers and one-line answers; longText only for open feedback.
- section starts a new page: use one only when the form has distinct parts and is long (over about 10 questions).
Mark a question required only when the form can't do without it. Keep wording short, neutral and friendly. Never ask for passwords or card details.
Write in the language of the request.`

function cleanText(value, max) {
  if (typeof value !== 'string') throw new InputError('Tell us what the form is for.')
  const text = value.trim()
  if (text.length < 3) throw new InputError('Tell us a bit more about the form.')
  if (text.length > max) throw new InputError(`That’s too long (${max.toLocaleString()} characters at most).`)
  return text
}

export const FEATURES = {
  'generate-form': {
    ...AI_FEATURES['generate-form'],
    system: GENERATE_SYSTEM,
    schema: FORM_SCHEMA,
    effort: 'low',
    // input: { mode: 'describe' | 'text', text }
    prepare(input) {
      const mode = input?.mode === 'text' ? 'text' : 'describe'
      const text = cleanText(input?.text, this.maxChars[mode])
      const prompt =
        mode === 'describe'
          ? `Create a form for this:\n\n${text}`
          : `Turn this document into a form. Keep its questions and answer choices, and fix the types where a better one fits. If it isn't a list of questions, write the form it calls for.\n\n<document>\n${text}\n</document>`
      return { prompt, mode, chars: text.length }
    },
    result(json) {
      if (!json || !Array.isArray(json.questions) || !json.questions.length) return null
      return { form: json }
    },
  },
}

// Canned output for the emulators (AI_FAKE=1), so tests never call Claude.
export const FAKE_OUTPUT = {
  'generate-form': {
    title: 'Team lunch',
    description: 'Help us plan the lunch.',
    questions: [
      { type: 'shortText', title: 'Your name', description: '', required: true },
      {
        type: 'multipleChoice',
        title: 'Which day suits you?',
        description: '',
        required: true,
        options: ['Friday', 'Saturday'],
      },
    ],
  },
}
