// "Only people you choose": is this (verified) account email on the form's
// list? Same check as isAllowedEmail() in src/lib/access.js and the
// isAllowedResponder() rule in firestore.rules.
//   access = forms/{formId}/private/access → { emails: [], domains: [] }
export function isAllowedResponder(access, email) {
  if (!access || typeof email !== 'string' || !email) return false
  const address = email.toLowerCase()
  return (
    (access.emails ?? []).includes(address) ||
    (access.domains ?? []).includes(address.split('@')[1])
  )
}
