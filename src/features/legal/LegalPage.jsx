import { Link } from 'react-router-dom'
import LogoMark from '../../lib/LogoMark.jsx'
import './LegalPage.css'

// Public /privacy and /terms (Google's consent screen links to both).
const UPDATED = '24 October 2026'
const CONTACT = import.meta.env.VITE_SUPPORT_EMAIL || ''

function Contact() {
  return CONTACT ? (
    <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
  ) : (
    <span>the support address shown on PeraForm’s Google sign-in screen</span>
  )
}

function Privacy() {
  return (
    <>
      <h1>Privacy policy</h1>
      <p className="legal-updated">Last updated {UPDATED}</p>
      <p>
        PeraForm (by Quality Tools) lets people build forms and collect responses. This page explains
        what we collect, why, and what you can do about it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your account:</strong> your email address, and your name and photo if you sign in
          with Google.
        </li>
        <li>
          <strong>Forms you create:</strong> their questions, designs, settings and who you share them
          with.
        </li>
        <li>
          <strong>Responses:</strong> the answers people give, files they upload, and — only when a form
          asks for it — the respondent’s account email.
        </li>
        <li>
          <strong>Security data:</strong> a device check (Firebase App Check) and a short-lived count of
          submissions per connection, used to stop spam.
        </li>
      </ul>

      <h2>How we use it</h2>
      <p>
        Only to run PeraForm: showing forms, saving and showing responses to the form’s owner and
        editors, sending the emails you turn on, and keeping the service safe. We don’t sell data, show
        ads, or use your forms or responses for anything else.
      </p>

      <h2>Google Sheets</h2>
      <p>
        If you choose <em>Link to Google Sheets</em>, PeraForm asks Google for permission to see, edit,
        create and delete <strong>only the Google Drive files that PeraForm creates</strong> (the{' '}
        <code>drive.file</code> permission). We use it solely to create the form’s responses
        spreadsheet in your Drive and keep it updated. PeraForm cannot see any other file in your Drive.
      </p>
      <p>
        The access key Google gives us is kept on our servers, is never shown to anyone (including
        other editors of the form), and is deleted — and revoked with Google — when you unlink the
        sheet. You can also remove PeraForm’s access at any time from your{' '}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
          Google account
        </a>
        .
      </p>
      <p>
        PeraForm’s use and transfer of information received from Google APIs adheres to the{' '}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noreferrer"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>

      <h2>Where it’s stored</h2>
      <p>
        On Google Cloud (Firebase) in the European Union (Belgium, europe-west1). Uploaded images and
        files are compressed to save space.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Delete any form or its responses at any time from PeraForm.</li>
        <li>Unlink a Google Sheet at any time; the spreadsheet stays yours.</li>
        <li>
          To delete your account or ask what we hold about you, contact <Contact />.
        </li>
      </ul>

      <h2>Contact</h2>
      <p>
        Questions about privacy: <Contact />.
      </p>
    </>
  )
}

function Terms() {
  return (
    <>
      <h1>Terms of service</h1>
      <p className="legal-updated">Last updated {UPDATED}</p>
      <p>By using PeraForm (by Quality Tools) you agree to these terms.</p>

      <h2>Your content</h2>
      <p>
        Forms and responses belong to the people who create and send them. You give us permission to
        store and show them only as needed to run PeraForm for you.
      </p>

      <h2>Fair use</h2>
      <ul>
        <li>Don’t use PeraForm to collect passwords, payment card numbers or other credentials.</li>
        <li>Don’t use it for phishing, spam, harassment, or anything illegal.</li>
        <li>Only collect personal data you have a right to collect, and tell respondents why.</li>
      </ul>
      <p>We may remove forms or accounts that break these rules.</p>

      <h2>The service</h2>
      <p>
        PeraForm is provided as is. We work to keep it available and your data safe, but can’t
        guarantee it will never be interrupted. Keep your own copy of anything important (for example
        with the CSV download or a linked Google Sheet).
      </p>

      <h2>Changes</h2>
      <p>If these terms change, we’ll update this page and the date above.</p>

      <h2>Contact</h2>
      <p>
        <Contact />
      </p>
    </>
  )
}

export default function LegalPage({ page }) {
  return (
    <div className="legal">
      <header className="legal-top">
        <Link to="/" className="logo">
          <LogoMark />
          PeraForm
        </Link>
      </header>
      <main className="legal-body">{page === 'terms' ? <Terms /> : <Privacy />}</main>
      <footer className="legal-foot">
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
      </footer>
    </div>
  )
}
