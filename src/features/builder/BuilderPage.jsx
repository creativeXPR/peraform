import { useParams } from 'react-router-dom'

export default function BuilderPage() {
  const { formId } = useParams()
  return (
    <main>
      <h1>Edit form</h1>
      <p>Builder for {formId} goes here.</p>
    </main>
  )
}
