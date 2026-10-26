import { describe, expect, it } from 'vitest'
import {
  formatRespondentCopy,
  formatScoreRelease,
  formatEmailFormInvitation,
  formatLagosTime,
} from '../../functions/emailFormat.js'

describe('emailFormat', () => {
  describe('formatLagosTime', () => {
    it('formats UTC timestamp into Lagos time (UTC+1)', () => {
      const d = new Date('2026-10-26T10:00:00Z')
      const formatted = formatLagosTime(d)
      expect(formatted).toContain('11:00')
    })

    it('returns empty string for missing or invalid dates', () => {
      expect(formatLagosTime(null)).toBe('')
      expect(formatLagosTime('invalid-date')).toBe('')
    })
  })

  describe('formatRespondentCopy', () => {
    const form = {
      title: 'Customer Survey <2026>',
      questions: [
        { id: 'q1', type: 'shortText', title: 'Your Name' },
        { id: 'q2', type: 'checkboxes', title: 'Interests' },
        {
          id: 'q3',
          type: 'mcGrid',
          title: 'Satisfaction Grid',
          rows: ['Service', 'Quality', 'Speed'],
          columns: ['Poor', 'Good', 'Excellent'],
        },
        { id: 'q4', type: 'fileUpload', title: 'Receipt' },
        { id: 'q5', type: 'longText', title: 'Unanswered Question' },
        { id: 'sec1', type: 'section', title: 'Next Section' },
      ],
    }

    it('formats respondent copy skipping unanswered questions and non-questions', () => {
      const answers = {
        q1: 'Jane & Doe',
        q2: ['Coding', 'Music'],
        q3: { 0: 'Good', 2: 'Excellent' },
        q4: [
          { name: 'receipt.pdf', url: 'https://storage.googleapis.com/secret/receipt.pdf' },
          { name: 'photo.jpg', url: 'https://storage.googleapis.com/secret/photo.jpg' },
        ],
        // q5 is omitted
      }

      const res = formatRespondentCopy({
        form,
        answers,
        submittedAt: new Date('2026-10-26T08:30:00Z'),
      })

      expect(res.subject).toBe('Your response to “Customer Survey <2026>”')

      // Plain text asserts
      expect(res.text).toContain('Customer Survey <2026>')
      expect(res.text).toContain('Your Name\nJane & Doe')
      expect(res.text).toContain('Interests\nCoding, Music')
      expect(res.text).toContain('Satisfaction Grid\nService: Good\nSpeed: Excellent')
      expect(res.text).not.toContain('Quality:')
      expect(res.text).toContain('Receipt\nreceipt.pdf, photo.jpg')
      expect(res.text).not.toContain('https://storage.googleapis.com') // No URLs for uploads per spec
      expect(res.text).not.toContain('Unanswered Question')
      expect(res.text).not.toContain('Next Section')
      expect(res.text).toContain(
        'You asked for a copy of your answers when you submitted this form. The form’s owner can’t see this email.',
      )

      // HTML asserts
      expect(res.html).toContain('&lt;2026&gt;') // Title escaped
      expect(res.html).toContain('Jane &amp; Doe') // Content escaped
      expect(res.html).toContain('receipt.pdf, photo.jpg')
      expect(res.html).not.toContain('https://storage.googleapis.com')
    })
  })

  describe('formatScoreRelease', () => {
    it('formats score release email with points and result link', () => {
      const form = { title: 'Math Quiz' }
      const response = { points: 8, maxScore: 10, score: 80 }
      const res = formatScoreRelease({
        form,
        response,
        resultUrl: 'https://peraform.web.app/f/xyz/r/res123',
      })

      expect(res.subject).toBe('Score released: Math Quiz')
      expect(res.text).toContain('8 / 10 (80%)')
      expect(res.text).toContain('https://peraform.web.app/f/xyz/r/res123')
      expect(res.html).toContain('Score released')
      expect(res.html).toContain('https://peraform.web.app/f/xyz/r/res123')
    })
  })

  describe('formatEmailFormInvitation', () => {
    it('formats form invitation with inviter, message, and form url', () => {
      const form = { title: 'Feedback Form' }
      const res = formatEmailFormInvitation({
        form,
        inviter: 'Alice',
        message: 'Please take 2 mins to fill this out.',
        formUrl: 'https://peraform.web.app/f/abc',
      })

      expect(res.subject).toBe('Please fill in: Feedback Form')
      expect(res.text).toContain('Please take 2 mins to fill this out.')
      expect(res.text).toContain('Alice invited you to fill out this form.')
      expect(res.text).toContain('https://peraform.web.app/f/abc')
      expect(res.html).toContain('https://peraform.web.app/f/abc')
    })

    it('uses custom subject if provided', () => {
      const form = { title: 'Feedback Form' }
      const res = formatEmailFormInvitation({
        form,
        inviter: 'Alice',
        customSubject: 'Urgent: Survey Deadline',
        formUrl: 'https://peraform.web.app/f/abc',
      })

      expect(res.subject).toBe('Urgent: Survey Deadline')
    })
  })
})
