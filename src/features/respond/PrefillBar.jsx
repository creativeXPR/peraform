import { useState } from 'react'
import { Link2 } from 'lucide-react'
import { prefillUrl } from '../../lib/prefill.js'

// Pre-fill mode (an editor at /f/:id?mode=prefill): answer what should be
// filled in, then get the link. Sharing it opens the form with those
// answers in place; respondents can still change them.
export default function PrefillBar({ form, answers }) {
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)

  async function getLink() {
    const url = prefillUrl(`${window.location.origin}/f/${form.id}`, form, answers)
    setLink(url)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="respond-card prefill-bar" aria-label="Pre-fill mode">
      <div className="prefill-head">
        <strong>Pre-fill mode</strong>
        <span>Answer the questions you want filled in, then get the link. Nothing is submitted.</span>
      </div>
      <button type="button" className="btn btn-primary" onClick={getLink}>
        <Link2 size={16} />
        Get pre-filled link
      </button>
      {link && (
        <label className="prefill-link">
          <span>{copied ? 'Copied. Anyone opening this link starts with your answers:' : 'Your link:'}</span>
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
        </label>
      )}
    </section>
  )
}
