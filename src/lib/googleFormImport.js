import { newContent, newQuestion, newSection } from './formModel.js'

// A Google Form (the JSON the Google Forms API returns for forms.get) as
// PeraForm content: { content: { title, description, questions, settings },
// answerKey, skipped }. Pure — tested without Google.
//
// Mapping:
//   choiceQuestion RADIO / CHECKBOX / DROP_DOWN → multipleChoice / checkboxes /
//     dropdown ("Other" → allowOther; "go to section" → branching/goTo)
//   textQuestion → shortText / longText (paragraph)
//   scaleQuestion → linearScale;  ratingQuestion → rating
//   dateQuestion → date;  timeQuestion → time;  fileUploadQuestion → fileUpload
//   questionGroupItem grid RADIO / CHECKBOX → mcGrid / checkboxGrid
//   pageBreakItem → section;  textItem → title-and-description
//   videoItem → video (YouTube);  imageItem → skipped (Google's image links
//   expire within minutes, so they can't be kept)
//   quiz grading → points and answer key (correct answers, feedback text)
// `skipped` lists what couldn't come across, to tell the user.

const CHOICE = { RADIO: 'multipleChoice', CHECKBOX: 'checkboxes', DROP_DOWN: 'dropdown' }

function feedbackText(f) {
  return typeof f?.text === 'string' ? f.text : ''
}

export function convertGoogleForm(g) {
  if (!g || !Array.isArray(g.items ?? [])) throw new Error('That doesn’t look like a Google Form.')
  const skipped = []
  const answerKey = {}
  const sectionIds = new Map() // Google page break itemId → our section id
  const pendingGoTo = [] // [question, [googleTargets]]
  const questions = []
  const isQuiz = Boolean(g.settings?.quizSettings?.isQuiz)

  const titled = (item, q) => {
    q.title = String(item.title ?? '').slice(0, 500)
    q.description = String(item.description ?? '').slice(0, 2000)
    return q
  }
  const grade = (q, gq) => {
    const grading = gq.grading
    if (!grading) return
    if (Number.isFinite(grading.pointValue)) q.points = grading.pointValue
    const correct = (grading.correctAnswers?.answers ?? []).map((a) => a.value).filter((v) => typeof v === 'string')
    const entry = {}
    if (correct.length) entry.correct = correct
    if (feedbackText(grading.whenRight)) entry.feedbackCorrect = feedbackText(grading.whenRight)
    if (feedbackText(grading.whenWrong)) entry.feedbackIncorrect = feedbackText(grading.whenWrong)
    if (feedbackText(grading.generalFeedback) && !entry.feedbackCorrect) {
      entry.feedbackCorrect = entry.feedbackIncorrect = feedbackText(grading.generalFeedback)
    }
    if (Object.keys(entry).length) answerKey[q.id] = entry
  }

  for (const item of g.items ?? []) {
    const label = item.title || 'an untitled item'
    if (item.pageBreakItem) {
      const s = titled(item, newSection())
      sectionIds.set(item.itemId, s.id)
      questions.push(s)
      continue
    }
    if (item.textItem) {
      questions.push(titled(item, newContent('text')))
      continue
    }
    if (item.videoItem) {
      const v = titled(item, newContent('video'))
      const m = String(item.videoItem.video?.youtubeUri ?? '').match(/(?:youtu\.be\/|[?&]v=|\/(?:embed|shorts)\/)([\w-]{11})/)
      if (m) {
        v.videoId = m[1]
        questions.push(v)
      } else skipped.push(`video “${label}”`)
      continue
    }
    if (item.imageItem) {
      skipped.push(`image “${label}”`)
      continue
    }
    if (item.questionGroupItem) {
      const grid = item.questionGroupItem.grid
      const type = grid?.columns?.type === 'CHECKBOX' ? 'checkboxGrid' : 'mcGrid'
      const q = titled(item, newQuestion(type))
      q.rows = (item.questionGroupItem.questions ?? []).map((r) => String(r.rowQuestion?.title ?? '')).slice(0, 200)
      q.columns = (grid?.columns?.options ?? []).map((o) => String(o.value ?? '')).slice(0, 200)
      q.required = (item.questionGroupItem.questions ?? []).some((r) => r.required)
      if (!q.rows.length || !q.columns.length) {
        skipped.push(`grid “${label}”`)
        continue
      }
      questions.push(q)
      continue
    }
    const gq = item.questionItem?.question
    if (!gq) {
      skipped.push(`“${label}”`)
      continue
    }
    let q
    if (gq.choiceQuestion) {
      const c = gq.choiceQuestion
      q = titled(item, newQuestion(CHOICE[c.type] ?? 'multipleChoice'))
      const opts = (c.options ?? []).filter((o) => !o.isOther)
      q.options = opts.map((o) => String(o.value ?? '')).slice(0, 200)
      if ((c.options ?? []).some((o) => o.isOther) && q.type !== 'dropdown') q.allowOther = true
      if (c.shuffle) q.shuffleOptions = true
      const jumps = opts.map((o) => o.goToSectionId ?? (o.goToAction === 'SUBMIT_FORM' ? 'submit' : 'next'))
      if (q.type !== 'checkboxes' && jumps.some((t) => t !== 'next')) pendingGoTo.push([q, jumps])
    } else if (gq.textQuestion) {
      q = titled(item, newQuestion(gq.textQuestion.paragraph ? 'longText' : 'shortText'))
    } else if (gq.scaleQuestion) {
      const s = gq.scaleQuestion
      q = titled(item, newQuestion('linearScale'))
      q.min = s.low === 0 ? 0 : 1
      q.max = Math.min(10, Math.max(2, s.high ?? 5))
      q.minLabel = String(s.lowLabel ?? '').slice(0, 60)
      q.maxLabel = String(s.highLabel ?? '').slice(0, 60)
    } else if (gq.ratingQuestion) {
      q = titled(item, newQuestion('rating'))
      q.max = Math.min(10, Math.max(3, gq.ratingQuestion.ratingScaleLevel ?? 5))
    } else if (gq.dateQuestion) {
      q = titled(item, newQuestion('date'))
    } else if (gq.timeQuestion) {
      q = titled(item, newQuestion('time'))
    } else if (gq.fileUploadQuestion) {
      q = titled(item, newQuestion('fileUpload'))
    } else {
      skipped.push(`“${label}”`)
      continue
    }
    q.required = gq.required === true
    grade(q, gq)
    questions.push(q)
  }

  // Section jumps, now every section has its id.
  for (const [q, jumps] of pendingGoTo) {
    q.branching = true
    q.goTo = jumps.map((t) => (t === 'submit' ? 'submit' : (sectionIds.get(t) ?? 'next')))
  }

  const settings = isQuiz ? { quiz: { enabled: true } } : {}
  return {
    content: {
      title: String(g.info?.title || g.info?.documentTitle || 'Imported Google Form').slice(0, 200),
      description: String(g.info?.description ?? '').slice(0, 2000),
      questions,
      settings,
    },
    answerKey: Object.keys(answerKey).length ? answerKey : null,
    skipped,
  }
}
