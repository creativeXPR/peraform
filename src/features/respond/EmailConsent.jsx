import { Mail } from 'lucide-react'

// The respondent's say over their email: whether the address they signed
// in with goes with their response. Shown only when the form would record
// it (it asks for emails, or only invited people can answer).
//   asked: the owner asked for emails (the switch starts on)
export default function EmailConsent({ email, checked, onChange, asked }) {
  return (
    <label className="email-consent">
      <Mail size={18} className="email-consent-icon" aria-hidden="true" />
      <span className="email-consent-text">
        <strong>Include my email with my response</strong>
        <span>
          {checked
            ? `${email} will be shared with the form’s owner.`
            : asked
              ? 'The owner asked for it. Without it, your response is sent without your email.'
              : 'Your response is sent without your email.'}
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label="Include my email with my response"
      />
    </label>
  )
}
