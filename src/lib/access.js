import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase.js'

// "Only people you choose": a form's allowed responders, kept in
// forms/{formId}/private/access = { emails: [], domains: [], updatedAt }.
// Only the form's members can read it (firestore.rules); the rules and the
// submitResponse function check respondents' verified account email against
// it. Domains are written without the "@" ("school.edu").

export const MAX_ENTRIES = 5000

const EMAIL = /^[^\s@,;<>()"']+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/
const DOMAIN = /^@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/

// Typed or pasted entries: emails and "@domain"s separated by spaces,
// commas, semicolons or new lines. Anything else is reported back.
export function parseEntries(text) {
  const emails = new Set()
  const domains = new Set()
  const invalid = []
  for (const raw of text.split(/[\s,;]+/)) {
    // Tolerate "Name <ada@x.com>" and quoted values.
    const entry = raw.replace(/^["'<(]+|[>"')]+$/g, '').toLowerCase()
    if (!entry) continue
    if (EMAIL.test(entry)) emails.add(entry)
    else if (DOMAIN.test(entry)) domains.add(entry.slice(1))
    else invalid.push(raw)
  }
  return { emails: [...emails], domains: [...domains], invalid }
}

// Every email address in a CSV or text file (names, headers and other
// columns are ignored).
export function extractEmails(text) {
  const found = text.match(/[^\s@,;<>()"']+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/gi) ?? []
  return [...new Set(found.map((e) => e.toLowerCase()))]
}

// Adds entries to a list, sorted and without duplicates. `added` counts the
// new ones; `overflow` is how many didn't fit under MAX_ENTRIES.
export function mergeAccess(current, { emails = [], domains = [] }) {
  const nextEmails = new Set(current.emails)
  const nextDomains = new Set(current.domains)
  let added = 0
  let overflow = 0
  const addTo = (set, entry) => {
    if (set.has(entry)) return
    if (nextEmails.size + nextDomains.size >= MAX_ENTRIES) {
      overflow++
      return
    }
    set.add(entry)
    added++
  }
  domains.forEach((d) => addTo(nextDomains, d))
  emails.forEach((e) => addTo(nextEmails, e))
  return {
    access: { emails: [...nextEmails].sort(), domains: [...nextDomains].sort() },
    added,
    overflow,
  }
}

export function isAllowedEmail(access, email) {
  if (!access || !email) return false
  const address = email.toLowerCase()
  return (
    (access.emails ?? []).includes(address) ||
    (access.domains ?? []).includes(address.split('@')[1])
  )
}

const accessRef = (formId) => doc(db, 'forms', formId, 'private', 'access')

export function saveAccess(formId, { emails, domains }) {
  return setDoc(accessRef(formId), { emails, domains, updatedAt: serverTimestamp() })
}

// Live list for the form's members. null while loading.
export function useAccessList(formId, enabled = true) {
  const [state, setState] = useState({ formId: null, access: null, error: false })
  useEffect(() => {
    if (!formId || !enabled) return
    return onSnapshot(
      accessRef(formId),
      (snap) => {
        const data = snap.data() ?? {}
        setState({
          formId,
          access: { emails: data.emails ?? [], domains: data.domains ?? [] },
          error: false,
        })
      },
      () => setState({ formId, access: null, error: true }),
    )
  }, [formId, enabled])
  const current = state.formId === formId
  return { access: current ? state.access : null, error: current && state.error }
}
