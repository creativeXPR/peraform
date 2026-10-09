import { useParams } from 'react-router-dom'

export default function ResponsesPage() {
  const { formId } = useParams()
  return (
    <main>
      <h1>Responses</h1>
      <p>Responses for {formId} go here.</p>
    </main>
  )
}
