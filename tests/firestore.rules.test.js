import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

// Runs against the Firestore emulator (npm run test:rules). The rules don't
// depend on the database name, so the emulator's default database stands in
// for "peraform".
const OWNER = 'owner'
const EDITOR = 'editor'
const STRANGER = 'stranger'
const ANON = 'anon'

let testEnv

const real = (uid) =>
  testEnv.authenticatedContext(uid, { firebase: { sign_in_provider: 'google.com' } }).firestore()
const anon = (uid = ANON) =>
  testEnv.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore()
const guest = () => testEnv.unauthenticatedContext().firestore()

function form(overrides = {}) {
  return {
    title: 'Survey',
    description: '',
    ownerId: OWNER,
    memberIds: [OWNER, EDITOR],
    status: 'published',
    settings: { requireSignIn: false, limitOneResponse: false },
    questions: [],
    ...overrides,
  }
}

function response(respondentId) {
  return { respondentId, answers: { q1: 'hi' }, submittedAt: serverTimestamp() }
}

async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data))
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-peraform',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

afterAll(() => testEnv.cleanup())

beforeEach(() => testEnv.clearFirestore())

describe('forms: read', () => {
  it('lets anyone, even signed out, read a published form', async () => {
    await seed('forms/f1', form())
    await assertSucceeds(getDoc(doc(guest(), 'forms/f1')))
  })

  it('lets anyone read a closed form', async () => {
    await seed('forms/f1', form({ status: 'closed' }))
    await assertSucceeds(getDoc(doc(anon(), 'forms/f1')))
  })

  it('hides drafts from non-members', async () => {
    await seed('forms/f1', form({ status: 'draft' }))
    await assertFails(getDoc(doc(real(STRANGER), 'forms/f1')))
    await assertFails(getDoc(doc(guest(), 'forms/f1')))
  })

  it('shows drafts to the owner and editors', async () => {
    await seed('forms/f1', form({ status: 'draft' }))
    await assertSucceeds(getDoc(doc(real(OWNER), 'forms/f1')))
    await assertSucceeds(getDoc(doc(real(EDITOR), 'forms/f1')))
  })
})

describe('forms: only people you choose', () => {
  // A signed-in respondent with an (optionally verified) account email.
  const person = (uid, email, verified = true) =>
    testEnv
      .authenticatedContext(uid, {
        email,
        email_verified: verified,
        firebase: { sign_in_provider: 'password' },
      })
      .firestore()

  beforeEach(async () => {
    await seed('forms/f1', form({ settings: { restricted: true } }))
    await seed('forms/f1/private/access', { emails: ['ada@example.com'], domains: ['school.edu'] })
  })

  it('lets people on the list read the form, by address or by domain', async () => {
    await assertSucceeds(getDoc(doc(person('u1', 'ada@example.com'), 'forms/f1')))
    await assertSucceeds(getDoc(doc(person('u2', 'Grace@School.edu'), 'forms/f1')))
  })

  it('hides it from everyone else, signed out or anonymous', async () => {
    await assertFails(getDoc(doc(person('u3', 'eve@example.com'), 'forms/f1')))
    await assertFails(getDoc(doc(person('u4', 'eve@sub.school.edu'), 'forms/f1')))
    await assertFails(getDoc(doc(anon(), 'forms/f1')))
    await assertFails(getDoc(doc(guest(), 'forms/f1')))
  })

  it('ignores unverified addresses, even ones on the list', async () => {
    await assertFails(getDoc(doc(person('u5', 'ada@example.com', false), 'forms/f1')))
  })

  it('still shows it to the owner and editors', async () => {
    await assertSucceeds(getDoc(doc(real(OWNER), 'forms/f1')))
    await assertSucceeds(getDoc(doc(real(EDITOR), 'forms/f1')))
  })

  it('keeps the list itself private to members', async () => {
    await assertSucceeds(getDoc(doc(real(EDITOR), 'forms/f1/private/access')))
    await assertFails(getDoc(doc(person('u1', 'ada@example.com'), 'forms/f1/private/access')))
    await assertFails(
      setDoc(doc(person('u3', 'eve@example.com'), 'forms/f1/private/access'), {
        emails: ['eve@example.com'],
        domains: [],
      }),
    )
  })

  it('hides it when there is no list yet', async () => {
    await seed('forms/f2', form({ settings: { restricted: true } }))
    await assertFails(getDoc(doc(person('u1', 'ada@example.com'), 'forms/f2')))
  })
})

describe('forms: dashboard list query', () => {
  beforeEach(async () => {
    await seed('forms/mine', form({ status: 'draft', updatedAt: new Date() }))
    await seed(
      'forms/theirs',
      form({ status: 'draft', ownerId: STRANGER, memberIds: [STRANGER], updatedAt: new Date() }),
    )
  })

  const myForms = (db, uid) =>
    query(
      collection(db, 'forms'),
      where('memberIds', 'array-contains', uid),
      orderBy('updatedAt', 'desc'),
    )

  it('lets a user list the forms they are a member of', async () => {
    await assertSucceeds(getDocs(myForms(real(EDITOR), EDITOR)))
  })

  it('blocks listing every form', async () => {
    await assertFails(getDocs(collection(real(EDITOR), 'forms')))
  })

  it('blocks listing someone else’s forms', async () => {
    await assertFails(getDocs(myForms(real(EDITOR), STRANGER)))
  })
})

describe('forms: create', () => {
  const draft = form({ status: 'draft', memberIds: [OWNER] })

  it('lets a real user create their own draft', async () => {
    await assertSucceeds(setDoc(doc(real(OWNER), 'forms/f1'), draft))
  })

  it('blocks anonymous users from creating forms', async () => {
    await assertFails(setDoc(doc(anon(OWNER), 'forms/f1'), draft))
  })

  it('blocks creating a form owned by someone else', async () => {
    await assertFails(setDoc(doc(real(STRANGER), 'forms/f1'), draft))
  })

  it('blocks creating a form already published', async () => {
    await assertFails(setDoc(doc(real(OWNER), 'forms/f1'), { ...draft, status: 'published' }))
  })

  it('blocks adding extra members at creation', async () => {
    await assertFails(
      setDoc(doc(real(OWNER), 'forms/f1'), { ...draft, memberIds: [OWNER, STRANGER] }),
    )
  })
})

describe('forms: update and delete', () => {
  beforeEach(() => seed('forms/f1', form()))

  it('lets an editor change content', async () => {
    await assertSucceeds(updateDoc(doc(real(EDITOR), 'forms/f1'), { title: 'New title' }))
  })

  it('blocks a stranger from changing content', async () => {
    await assertFails(updateDoc(doc(real(STRANGER), 'forms/f1'), { title: 'Hacked' }))
  })

  it('blocks an editor from changing members', async () => {
    await assertFails(
      updateDoc(doc(real(EDITOR), 'forms/f1'), { memberIds: [OWNER, EDITOR, STRANGER] }),
    )
  })

  it('blocks an editor from taking ownership', async () => {
    await assertFails(updateDoc(doc(real(EDITOR), 'forms/f1'), { ownerId: EDITOR }))
  })

  it('lets the owner add and remove collaborators', async () => {
    await assertSucceeds(updateDoc(doc(real(OWNER), 'forms/f1'), { memberIds: [OWNER, STRANGER] }))
  })

  it('blocks the owner from removing themselves from members', async () => {
    await assertFails(updateDoc(doc(real(OWNER), 'forms/f1'), { memberIds: [EDITOR] }))
  })

  it('blocks an editor from inviting people', async () => {
    await assertFails(
      updateDoc(doc(real(EDITOR), 'forms/f1'), { invitedEmails: ['friend@example.com'] }),
    )
  })

  it('lets a member turn their own notifications on and off', async () => {
    await assertSucceeds(updateDoc(doc(real(EDITOR), 'forms/f1'), { notify: [EDITOR] }))
    await assertSucceeds(updateDoc(doc(real(EDITOR), 'forms/f1'), { notify: [] }))
  })

  it('blocks signing someone else up for notifications', async () => {
    await assertFails(updateDoc(doc(real(EDITOR), 'forms/f1'), { notify: [OWNER] }))
    await assertFails(updateDoc(doc(real(OWNER), 'forms/f1'), { notify: [OWNER, EDITOR] }))
  })

  it('lets only the owner delete the form', async () => {
    await assertFails(deleteDoc(doc(real(EDITOR), 'forms/f1')))
    await assertSucceeds(deleteDoc(doc(real(OWNER), 'forms/f1')))
  })
})

describe('responses: create', () => {
  // Every submission goes through the submitResponse Cloud Function
  // (functions/submit.js, unit tested); browsers can't write responses.
  it('blocks direct writes from respondents, members and owners alike', async () => {
    await seed('forms/f1', form())
    await assertFails(setDoc(doc(anon(), 'forms/f1/responses/r1'), response(ANON)))
    await assertFails(setDoc(doc(real(STRANGER), 'forms/f1/responses/r2'), response(STRANGER)))
    await assertFails(setDoc(doc(real(OWNER), 'forms/f1/responses/r3'), response(OWNER)))
  })
})

describe('responses: read and delete', () => {
  beforeEach(async () => {
    await seed('forms/f1', form())
    await seed('forms/f1/responses/r1', {
      respondentId: ANON,
      answers: {},
      submittedAt: new Date(),
    })
  })

  it('lets the owner and editors read responses', async () => {
    await assertSucceeds(getDoc(doc(real(OWNER), 'forms/f1/responses/r1')))
    await assertSucceeds(getDoc(doc(real(EDITOR), 'forms/f1/responses/r1')))
  })

  it('blocks respondents and strangers from reading responses, even their own', async () => {
    await assertFails(getDoc(doc(anon(), 'forms/f1/responses/r1')))
    await assertFails(getDoc(doc(real(STRANGER), 'forms/f1/responses/r1')))
  })

  it('blocks respondents from editing their response', async () => {
    await assertFails(updateDoc(doc(anon(), 'forms/f1/responses/r1'), { answers: { q1: 'x' } }))
  })

  it('lets members delete responses, but not respondents', async () => {
    await assertFails(deleteDoc(doc(anon(), 'forms/f1/responses/r1')))
    await assertSucceeds(deleteDoc(doc(real(EDITOR), 'forms/f1/responses/r1')))
  })
})

// ── Quizzes ────────────────────────────────────────────────
const quizForm = (quiz = {}) =>
  form({
    settings: {
      requireSignIn: false,
      limitOneResponse: false,
      quiz: { enabled: true, release: 'immediate', timeLimit: 0, ...quiz },
    },
  })

describe('quiz answer key', () => {
  beforeEach(async () => {
    await seed('forms/f1', quizForm())
    await seed('forms/f1/private/answerKey', { questions: { q1: { correct: ['A'] } } })
  })

  it('lets members read and write the key', async () => {
    await assertSucceeds(getDoc(doc(real(EDITOR), 'forms/f1/private/answerKey')))
    await assertSucceeds(setDoc(doc(real(OWNER), 'forms/f1/private/answerKey'), { questions: {} }))
  })

  it('hides the key from respondents and strangers', async () => {
    await assertFails(getDoc(doc(anon(), 'forms/f1/private/answerKey')))
    await assertFails(getDoc(doc(real(STRANGER), 'forms/f1/private/answerKey')))
    await assertFails(setDoc(doc(anon(), 'forms/f1/private/answerKey'), { questions: {} }))
  })
})

describe('timed quizzes', () => {
  beforeEach(() => seed('forms/f1', quizForm({ timeLimit: 10 })))

  const start = (db, uid = ANON) =>
    setDoc(doc(db, `forms/f1/starts/${uid}`), { startedAt: serverTimestamp() })

  it('lets a respondent record their own start once', async () => {
    await assertSucceeds(start(anon()))
    await assertFails(start(anon())) // a second write would be an update
    await assertSucceeds(getDoc(doc(anon(), `forms/f1/starts/${ANON}`)))
  })

  it('blocks starting for someone else, or with a made-up time', async () => {
    await assertFails(start(anon(), STRANGER))
    await assertFails(
      setDoc(doc(anon(), `forms/f1/starts/${ANON}`), { startedAt: new Date('2030-01-01') }),
    )
  })

  it('blocks starts on untimed forms', async () => {
    await seed('forms/f2', quizForm({ timeLimit: 0 }))
    await assertFails(
      setDoc(doc(anon(), `forms/f2/starts/${ANON}`), { startedAt: serverTimestamp() }),
    )
  })

  it('hides other respondents’ start times', async () => {
    await start(anon())
    await assertFails(getDoc(doc(anon('someone-else'), `forms/f1/starts/${ANON}`)))
    await assertSucceeds(getDoc(doc(real(EDITOR), `forms/f1/starts/${ANON}`)))
  })
})

describe('grading and released results', () => {
  beforeEach(async () => {
    await seed('forms/f1', quizForm({ release: 'manual' }))
    await seed('forms/f1/responses/mine', {
      respondentId: ANON,
      answers: { q1: 'A' },
      submittedAt: new Date(),
      points: { q1: 1 },
      score: 1,
      maxScore: 2,
      released: false,
    })
  })

  it('lets members adjust points and release', async () => {
    await assertSucceeds(
      updateDoc(doc(real(EDITOR), 'forms/f1/responses/mine'), {
        points: { q1: 2 },
        score: 2,
        released: true,
      }),
    )
  })

  it('blocks members from changing what was answered', async () => {
    await assertFails(
      updateDoc(doc(real(OWNER), 'forms/f1/responses/mine'), { answers: { q1: 'B' } }),
    )
  })

  it('blocks respondents from grading themselves', async () => {
    await assertFails(updateDoc(doc(anon(), 'forms/f1/responses/mine'), { score: 2 }))
  })

  it('shows respondents their own result only once released', async () => {
    await assertFails(getDoc(doc(anon(), 'forms/f1/responses/mine')))
    await testEnv.withSecurityRulesDisabled((ctx) =>
      updateDoc(doc(ctx.firestore(), 'forms/f1/responses/mine'), { released: true }),
    )
    await assertSucceeds(getDoc(doc(anon(), 'forms/f1/responses/mine')))
    await assertFails(getDoc(doc(anon('someone-else'), 'forms/f1/responses/mine')))
  })
})

describe('stars and folders', () => {
  it('lets people manage their own stars and folders', async () => {
    await assertSucceeds(setDoc(doc(real(OWNER), `users/${OWNER}/formMeta/f1`), { starred: true }))
    await assertSucceeds(setDoc(doc(real(OWNER), `users/${OWNER}/folders/x`), { name: 'Work' }))
    await assertSucceeds(getDoc(doc(real(OWNER), `users/${OWNER}/folders/x`)))
  })

  it('keeps them private from everyone else', async () => {
    await assertFails(getDoc(doc(real(EDITOR), `users/${OWNER}/formMeta/f1`)))
    await assertFails(setDoc(doc(real(EDITOR), `users/${OWNER}/folders/x`), { name: 'Hijack' }))
    await assertFails(setDoc(doc(anon(), `users/${ANON}/folders/x`), { name: 'Anon' }))
  })
})
