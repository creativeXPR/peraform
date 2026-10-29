import { AI_FEATURES, STYLE_KEYS, compactForm } from './catalog.js'
import { resultStats } from '../resultStats.js'
import { HYPERCBT_FAKE_OUTPUT, hypercbtFeatures } from './hypercbt.js'

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

const TYPE_GUIDE = `Choose the question type that makes answering fastest and the answers easiest to analyse:
- multipleChoice (one answer) or checkboxes (several) when the answers are a known, short list; dropdown when the list is long (over 7).
- linearScale for agreement or satisfaction (min 0 or 1, max 2 to 10, usually 1 to 5, with minLabel and maxLabel); rating for star ratings (max 3 to 10 stars, usually 5).
- mcGrid or checkboxGrid when several items share the same scale (rows = items, columns = scale).
- date and time for dates and times; shortText for names, emails, phone numbers and one-line answers; longText only for open feedback.
- section starts a new page: use one only when the form has distinct parts and is long (over about 10 questions).
Mark a question required only when the form can't do without it. Keep wording short, neutral and friendly. Never ask for passwords or card details.`

const GENERATE_SYSTEM = `You design forms for PeraForm, an online form builder like Google Forms.
Write a complete, ready-to-use form: a clear title, a one or two sentence description, and well-ordered questions.

${TYPE_GUIDE}
Write in the language of the request.`

const EDIT_SYSTEM = `You edit an existing form in PeraForm, an online form builder like Google Forms.
You get the current form as JSON and an instruction. Return the whole form after making the change, in the same shape:
- Every item has an "id": copy each existing item's id exactly, even when you change the item. Give items you add "new-1", "new-2" and so on.
- Keep everything you weren't asked to change exactly as it is: same order, wording, options and settings.
- Remove an item only when the instruction asks for it.
- Items of type "text" are headings with a description; "image" and "video" items can be kept, moved or removed, but not created.
- Put one or two plain sentences saying what you changed in "summary" (for the form's owner).
When you add or retype questions:
${TYPE_GUIDE}
Write in the language of the form.`

function unescapeJson(s) {
  try {
    return JSON.parse(`"${s}"`)
  } catch {
    return s
  }
}

function cleanText(value, max) {
  if (typeof value !== 'string') throw new InputError('Tell us what the form is for.')
  const text = value.trim()
  if (text.length < 3) throw new InputError('Tell us a bit more about the form.')
  if (text.length > max) throw new InputError(`That’s too long (${max.toLocaleString()} characters at most).`)
  return text
}

// The edit schema: the form schema, items with an optional id, content
// items allowed, and a summary of the change.
const EDIT_SCHEMA = {
  ...FORM_SCHEMA,
  required: ['title', 'description', 'questions', 'summary'],
  properties: {
    ...FORM_SCHEMA.properties,
    summary: { type: 'string' },
    questions: {
      type: 'array',
      items: {
        ...FORM_SCHEMA.properties.questions.items,
        required: ['id', ...FORM_SCHEMA.properties.questions.items.required],
        properties: {
          id: { type: 'string' },
          ...FORM_SCHEMA.properties.questions.items.properties,
          type: { type: 'string', enum: [...QUESTION_TYPES, 'text', 'image', 'video'] },
        },
      },
    },
  },
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
    // From the half-written JSON: the form's title, how many questions are
    // under way, and the titles written so far (each question starts with
    // "type", then "title"; the first title is the form's).
    progress(text) {
      const questions = (text.match(/"type"\s*:/g) ?? []).length
      const titles = [...text.matchAll(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => unescapeJson(m[1]))
      return { title: titles[0] ?? null, questions, written: titles.slice(1) }
    },
  },
}

FEATURES['edit-form'] = {
  ...AI_FEATURES['edit-form'],
  system: EDIT_SYSTEM,
  schema: EDIT_SCHEMA,
  effort: 'low',
  // input: { formId, instruction }. The form is read here, from the
  // database (the caller must be one of its editors), not taken from the app.
  async prepare(input, ctx) {
    const instruction = cleanText(input?.instruction, this.maxChars.edit)
    const formId = typeof input?.formId === 'string' ? input.formId : ''
    const form = formId && ctx?.db ? (await ctx.db.doc(`forms/${formId}`).get()).data() : null
    if (!form || !form.memberIds?.includes(ctx.uid)) throw new InputError('Form not found.')
    const json = JSON.stringify(compactForm(form))
    if (json.length > this.maxFormChars) {
      throw new InputError('This form is too long to edit with AI in one go. Try it on a copy with fewer questions.')
    }
    const prompt = `Current form:\n${json}\n\nInstruction:\n${instruction}`
    return { prompt, mode: 'edit', chars: json.length + instruction.length }
  },
  result(json) {
    if (!json || !Array.isArray(json.questions)) return null
    return { form: json, summary: typeof json.summary === 'string' ? json.summary : '' }
  },
  progress: FEATURES['generate-form'].progress,
}

const DESIGN_SYSTEM = `You are the visual designer for an interview-style form in PeraForm: each section of the form is a screen people move through, like an app's onboarding.
Pick the design style that suits the form and the instruction, choose its colours, and write each screen's heading and subtitle.

Styles:
- playful: bright gradient, round shapes, bouncy. Fun, friendly, kids, parties, community.
- classroom: calm and clear, classic heading. Schools, quizzes, lessons, training.
- official: formal, square corners, thin borders, no effects. Government, legal, HR, finance.
- flow: minimal white onboarding, big heading. Sign-ups, product onboarding, simple surveys.
- glass: frosted glass over a vivid gradient. Launches, events, modern brands.
- midnight: dark and bold with a glowing accent. Tech, gaming, night events.

Colours (6-digit hex): "from" and "to" make the screen background gradient; "accent" is the main button colour. Keep text readable: light backgrounds for playful, classroom, official and flow; vivid for glass; dark for midnight. Follow any colours or brand the instruction mentions.
Screens: return every screen you were given, by its key. Heading: at most 40 characters, may start with one fitting emoji (not for official). Subtitle: one short, warm sentence (at most 90 characters) saying what this screen is about.
Write in the language of the form.
Put one or two plain sentences on what you chose and why in "summary".`

const DESIGN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['style', 'palette', 'screens', 'summary'],
  properties: {
    style: { type: 'string', enum: STYLE_KEYS },
    palette: {
      type: 'object',
      additionalProperties: false,
      required: ['from', 'to', 'accent'],
      properties: { from: { type: 'string' }, to: { type: 'string' }, accent: { type: 'string' } },
    },
    screens: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'heading', 'subtitle'],
        properties: { key: { type: 'string' }, heading: { type: 'string' }, subtitle: { type: 'string' } },
      },
    },
    summary: { type: 'string' },
  },
}

// The form's screens as the designer sees them: key, title, description
// and the first few questions (enough to understand each screen).
function screensForDesign(form) {
  const out = [{ key: 'start', title: form.title || 'Untitled form', description: form.description ?? '', questions: [] }]
  for (const item of form.questions ?? []) {
    if (item.type === 'section') {
      out.push({ key: item.id, title: item.title || 'Untitled section', description: item.description ?? '', questions: [] })
    } else if (item.title && out.at(-1).questions.length < 5) out.at(-1).questions.push(item.title)
  }
  return out
}

FEATURES['design-screens'] = {
  ...AI_FEATURES['design-screens'],
  system: DESIGN_SYSTEM,
  schema: DESIGN_SCHEMA,
  effort: 'low',
  // input: { formId, instruction }; the form is read here (editors only).
  async prepare(input, ctx) {
    const instruction = cleanText(input?.instruction, this.maxChars.design)
    const formId = typeof input?.formId === 'string' ? input.formId : ''
    const form = formId && ctx?.db ? (await ctx.db.doc(`forms/${formId}`).get()).data() : null
    if (!form || !form.memberIds?.includes(ctx.uid)) throw new InputError('Form not found.')
    const json = JSON.stringify(screensForDesign(form))
    const prompt = `Screens:\n${json}\n\nWhat the creator wants:\n${instruction}`
    return { prompt, mode: 'design', chars: json.length + instruction.length }
  },
  result(json) {
    if (!json || !STYLE_KEYS.includes(json.style) || !Array.isArray(json.screens)) return null
    return { design: json, summary: typeof json.summary === 'string' ? json.summary : '' }
  },
  // Progress: the screens designed so far (their headings).
  progress(text) {
    const headings = [...text.matchAll(/"heading"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => unescapeJson(m[1]))
    return { title: null, questions: headings.length, written: headings }
  },
}

const SCREEN_SYSTEM = `You are the layout designer for one screen of an interview-style form in PeraForm (each section of the form is a screen, like an app's onboarding).
You get the screen as JSON and the creator's instruction. Make exactly the change asked for, and return it as a list of changes.

The screen: "width" and "height" are the device size in pixels. Blocks are cards (only cards sit on the screen itself) and, inside cards, text, image, video, embed, question and button blocks. "parent" is the card a block is in (null = on the screen). x, y, w, h are in pixels, relative to the parent card's top-left. "hidden" blocks start hidden until an action shows them.

Changes:
- {"op":"update","id":…} with only the fields that change: x, y, w, h; text (text blocks); label and action (buttons: next, back, submit or none); hidden; style.
- {"op":"add","id":"new-1","type":"card"|"text"|"button"|"image","parent":<card id or "new-…" of a card you added>,"x","y","w","h", plus text, label, action or style}. Number new blocks new-1, new-2… An added image is an empty placeholder the creator fills in.
- {"op":"remove","id":…}. Never remove question blocks, or cards holding them.
- To change the screen background, set "background": {"color":"#rrggbb"} or a gradient {"color","to","angle"}.
Style fields: bg, color, borderColor (6-digit hex, "transparent", or theme tokens: surface, bg, accent, accent-soft, on-accent, text, muted); size (font px), weight (300–900), align (left, center, right), valign (top, middle, bottom), radius, padding, borderWidth (px), opacity (0–1), font (inter, serif, rounded, mono), shadow (none, soft, medium, strong, glow).

Layout rules: keep blocks inside their card (x ≥ 0, x + w ≤ the card's w) and inside the screen width; don't let blocks overlap unless asked; when you move or add something, move the blocks below it so nothing collides, and make the card taller if needed. Don't change question wording (that's done in the form editor). Change only what the instruction asks.
Put one or two plain sentences saying what you changed in "summary" (for the creator). Write in the language of the instruction.`

const SCREEN_STYLE = {
  type: 'object',
  additionalProperties: false,
  properties: Object.fromEntries(
    [
      ['bg', 'string'],
      ['color', 'string'],
      ['borderColor', 'string'],
      ['size', 'number'],
      ['weight', 'number'],
      ['align', 'string'],
      ['valign', 'string'],
      ['radius', 'number'],
      ['padding', 'number'],
      ['borderWidth', 'number'],
      ['opacity', 'number'],
      ['font', 'string'],
      ['shadow', 'string'],
    ].map(([k, type]) => [k, { type }]),
  ),
}

const SCREEN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['changes', 'summary'],
  properties: {
    changes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['op', 'id'],
        properties: {
          op: { type: 'string', enum: ['update', 'add', 'remove'] },
          id: { type: 'string' },
          type: { type: 'string', enum: ['card', 'text', 'button', 'image'] },
          parent: { type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' },
          w: { type: 'number' },
          h: { type: 'number' },
          text: { type: 'string' },
          label: { type: 'string' },
          action: { type: 'string', enum: ['next', 'back', 'submit', 'none'] },
          hidden: { type: 'boolean' },
          style: SCREEN_STYLE,
        },
      },
    },
    background: {
      type: 'object',
      additionalProperties: false,
      required: ['color'],
      properties: { color: { type: 'string' }, to: { type: 'string' }, angle: { type: 'number' } },
    },
    summary: { type: 'string' },
  },
}

FEATURES['edit-screen'] = {
  ...AI_FEATURES['edit-screen'],
  system: SCREEN_SYSTEM,
  schema: SCREEN_SCHEMA,
  effort: 'low',
  // input: { formId, instruction, screen } — screen is what the creator sees
  // (src/lib/screenEdit.js → screenForAi), possibly unsaved; only editors of
  // the form may run it.
  async prepare(input, ctx) {
    const instruction = cleanText(input?.instruction, this.maxChars.screen)
    const formId = typeof input?.formId === 'string' ? input.formId : ''
    const form = formId && ctx?.db ? (await ctx.db.doc(`forms/${formId}`).get()).data() : null
    if (!form || !form.memberIds?.includes(ctx.uid)) throw new InputError('Form not found.')
    const screen = input?.screen
    if (!screen || typeof screen !== 'object' || !Array.isArray(screen.blocks)) throw new InputError('Screen not found.')
    const json = JSON.stringify(screen)
    if (json.length > this.maxScreenChars) {
      throw new InputError('This screen has too many blocks to change with AI in one go.')
    }
    const prompt = `Screen:\n${json}\n\nInstruction:\n${instruction}`
    return { prompt, mode: 'screen', chars: json.length + instruction.length }
  },
  result(json) {
    if (!json || !Array.isArray(json.changes)) return null
    return {
      changes: json.changes,
      background: json.background ?? null,
      summary: typeof json.summary === 'string' ? json.summary : '',
    }
  },
  // Progress: how many changes are written so far.
  progress(text) {
    const ops = [...text.matchAll(/"op"\s*:\s*"(\w+)"/g)].map((m) => m[1])
    return { title: null, questions: ops.length, written: [] }
  },
}

const ANALYSE_SYSTEM = `You analyse the results of a form or quiz made in PeraForm, for its owner — who is not a statistician.
You get statistics as JSON: totals only, never individual answers. Per question: "answered", "noAnswer" (didn't answer: skipped, or not shown to them), "options" with counts (choices and scales), "average" (scales), and for quiz questions "points", "correctRate" (share who got full points, 0–1) and, with enough responses, "strongRate" / "weakRate" (correct rate among the top and bottom scorers).

Write a short, plain-language report:
- "summary": two to four sentences on the overall picture (how many responded, how it went).
- "findings": the notable points, most useful first, each about one question (its "questionId"), with a "kind":
  too-easy (quiz: almost everyone right, correctRate above about 0.9), too-hard (quiz: few right, below about 0.3), unused-option (a choice nobody or almost nobody picked), possible-problem (quiz: strongRate is not clearly above weakRate, or below it — the question or its answer key may be wrong or unclear; or many people didn't answer), strong-result (a clear, useful pattern worth knowing), other.
  "detail": one or two sentences with the numbers, as percentages or counts people understand ("8 of 10 picked Yes"), and why it matters.
- "nextSteps": up to four practical suggestions (e.g. check the answer key of a question, reword a question, drop an unused option).
Rules: use only the numbers given — never invent any. With few responses (under about 10), say the picture may change. Refer to questions by their titles in the text. No jargon (don't say "discrimination index" or "p-value"). Write in the language of the question titles.`

const ANALYSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'findings', 'nextSteps'],
  properties: {
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'questionId', 'detail'],
        properties: {
          kind: { type: 'string', enum: ['too-easy', 'too-hard', 'unused-option', 'possible-problem', 'strong-result', 'other'] },
          questionId: { type: 'string' },
          detail: { type: 'string' },
        },
      },
    },
    nextSteps: { type: 'array', items: { type: 'string' } },
  },
}

FEATURES['analyse-results'] = {
  ...AI_FEATURES['analyse-results'],
  system: ANALYSE_SYSTEM,
  schema: ANALYSE_SCHEMA,
  effort: 'low',
  // input: { formId, focus? }. The responses are read and summarised here,
  // on the server (editors of the form only); only the totals reach the AI.
  async prepare(input, ctx) {
    const formId = typeof input?.formId === 'string' ? input.formId : ''
    const form = formId && ctx?.db ? (await ctx.db.doc(`forms/${formId}`).get()).data() : null
    if (!form || !form.memberIds?.includes(ctx.uid)) throw new InputError('Form not found.')
    const focus = typeof input?.focus === 'string' ? input.focus.trim().slice(0, this.maxChars.analyse) : ''
    const snap = await ctx.db
      .collection(`forms/${formId}/responses`)
      .orderBy('submittedAt', 'desc')
      .limit(this.maxResponses)
      .get()
    const responses = snap.docs.map((d) => d.data())
    if (responses.length < 3) throw new InputError('Analysis needs at least 3 responses. Try again when more have come in.')
    const stats = resultStats(form.questions ?? [], responses)
    const json = JSON.stringify({ form: form.title || 'Untitled form', ...stats })
    if (json.length > this.maxStatsChars) {
      throw new InputError('This form has too many questions to analyse in one go.')
    }
    const prompt = `Statistics:\n${json}${focus ? `\n\nThe owner wants to know especially:\n${focus}` : ''}`
    return { prompt, mode: 'analyse', chars: json.length + focus.length }
  },
  result(json) {
    if (!json || typeof json.summary !== 'string' || !Array.isArray(json.findings)) return null
    return { report: { summary: json.summary, findings: json.findings, nextSteps: json.nextSteps ?? [] } }
  },
  // Progress: findings written so far.
  progress(text) {
    const kinds = (text.match(/"kind"\s*:/g) ?? []).length
    return { title: null, questions: kinds, written: [] }
  },
}

// HyperCBT's features run through the same aiRun and wallet (hypercbt.js).
Object.assign(FEATURES, hypercbtFeatures({ InputError, unescapeJson }))

// Canned output for the emulators (AI_FAKE=1), so tests never call the AI.
export const FAKE_OUTPUT = {
  ...HYPERCBT_FAKE_OUTPUT,
  'analyse-results': {
    summary: 'Ten people responded and most did well: the average was 7 of 10.',
    findings: [{ kind: 'too-easy', questionId: 'q1', detail: 'All 10 got this right, so it doesn’t tell people apart.' }],
    nextSteps: ['Make the first question a little harder.'],
  },
  'edit-screen': {
    changes: [
      { op: 'add', id: 'new-1', type: 'text', parent: 'start-1', x: 20, y: 0, w: 300, h: 24, text: '✨ Changed by AI' },
    ],
    background: { color: '#e0f2fe', to: '#fef9c3', angle: 180 },
    summary: 'Added a note at the top and a soft morning background.',
  },
  'design-screens': {
    style: 'playful',
    palette: { from: '#ffd166', to: '#ef476f', accent: '#7c3aed' },
    screens: [{ key: 'start', heading: '🎉 Let’s plan lunch', subtitle: 'It only takes a minute.' }],
    summary: 'Playful, warm colours for a friendly team lunch.',
  },
  'edit-form': {
    title: 'Team lunch (edited)',
    description: 'Help us plan the lunch.',
    summary: 'Added an email question.',
    questions: [{ type: 'shortText', title: 'Email', description: '', required: true }],
  },
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
