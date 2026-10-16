import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { gradeResponse } from './grade.js'

initializeApp()
// PeraForm's named database (the project's default one belongs to other apps).
const db = getFirestore('peraform')

// Grades each new response to a quiz with the private answer key, so
// respondents never see the key and can't award themselves points.
// Runs next to the database in europe-west1.
export const gradeQuizResponse = onDocumentCreated(
  {
    document: 'forms/{formId}/responses/{responseId}',
    database: 'peraform',
    region: 'europe-west1',
  },
  async (event) => {
    const { formId } = event.params
    const formSnap = await db.doc(`forms/${formId}`).get()
    const form = formSnap.data()
    if (!form?.settings?.quiz?.enabled) return

    const keySnap = await db.doc(`forms/${formId}/private/answerKey`).get()
    const graded = gradeResponse(form, keySnap.data(), event.data.data().answers)

    await event.data.ref.update({
      ...graded,
      released: form.settings.quiz.release !== 'manual',
      gradedAt: FieldValue.serverTimestamp(),
    })
  },
)
