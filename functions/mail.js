import { logger } from 'firebase-functions'
import { defineSecret, defineString } from 'firebase-functions/params'
import { FieldValue } from 'firebase-admin/firestore'
import { billingDb, lagosDay } from './app.js'

// Email goes out over plain SMTP, so any provider works: a Gmail app
// password (smtp.gmail.com), Brevo, Zoho, etc. Configure in functions/.env
// (SMTP_HOST, SMTP_USER, MAIL_FROM) and the SMTP_PASS secret. Until then,
// sendMail logs and skips — nothing else depends on email.
export const SMTP_PASS = defineSecret('SMTP_PASS')
const SMTP_HOST = defineString('SMTP_HOST', { default: 'smtp.gmail.com' })
const SMTP_USER = defineString('SMTP_USER', { default: '' })
const MAIL_FROM = defineString('MAIL_FROM', { default: '' })
export const APP_URL = defineString('APP_URL', { default: 'https://peraform.web.app' })

let transport

//   fromName: the sender's display name instead of MAIL_FROM's (e.g.
//   "HyperCBT (No-Reply)"); the address stays the same.
export async function sendMail({ to, subject, text, html, replyTo, fromName }) {
  const user = SMTP_USER.value()
  const pass = SMTP_PASS.value()
  if (!user || !pass || pass === 'none') {
    logger.info('Email not configured, skipping', { subject })
    return false
  }
  // Loaded only when an email is actually sent (keeps cold starts fast).
  const { default: nodemailer } = await import('nodemailer')
  transport ??= nodemailer.createTransport({
    host: SMTP_HOST.value(),
    port: 465,
    secure: true,
    auth: { user, pass },
  })
  await transport.sendMail({
    from: fromName ? `${fromName} <${user}>` : MAIL_FROM.value() || `PeraForm (No-Reply) <${user}>`,
    replyTo: replyTo || 'PeraForm (No-Reply) <noreply@peraform-qt.web.app>',
    to,
    subject,
    text,
    html,
  })

  const count = (to || '').split(',').map((s) => s.trim()).filter(Boolean).length
  if (count > 0) {
    try {
      const day = lagosDay()
      const ref = billingDb.doc(`activity/${day}`)
      const snap = await ref.get()
      const current = (snap.data()?.emails ?? 0) + count
      await ref.set({ emails: FieldValue.increment(count) }, { merge: true })
      if (current >= 400) {
        logger.warn('High daily email volume: approaching Gmail daily limit', { day, current })
      }
    } catch (err) {
      logger.warn('Failed to record email activity counter', { err: err.message })
    }
  }

  return true
}

export const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// Minimal branded email: a heading, body or bodyHtml, optional CTA button, optional footer.
export function emailHtml({ heading, body, bodyHtml, cta, href, footer, brand = 'PeraForm (No-Reply)' }) {
  const mainContent = bodyHtml
    ? bodyHtml
    : body
      ? `<p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#3d4049">${escapeHtml(body)}</p>`
      : ''
  const ctaButton =
    cta && href
      ? `<a href="${href}" style="display:inline-block;padding:11px 20px;border-radius:999px;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;font-size:14px">${escapeHtml(cta)}</a>`
      : ''
  const footerContent = footer
    ? `<p style="margin:24px 0 0;font-size:12px;color:#6b6f7b">${escapeHtml(footer)}</p>`
    : ''

  return `<!doctype html><html><body style="margin:0;background:#fbfcff;font-family:Inter,Segoe UI,Arial,sans-serif;color:#14151a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #eceef3;border-radius:12px;border-top:6px solid #4f46e5">
<tr><td style="padding:28px">
<p style="margin:0 0 16px;font-size:13px;font-weight:600;color:#6b6f7b">${escapeHtml(brand)}</p>
<h1 style="margin:0 0 12px;font-size:20px">${escapeHtml(heading)}</h1>
${mainContent}
${ctaButton}
${footerContent}
</td></tr></table></td></tr></table></body></html>`
}
