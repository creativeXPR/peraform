import { describe, expect, it } from 'vitest'
import { escapeHtml, formMeta, injectOg } from '../../functions/ogTags.js'

describe('escapeHtml', () => {
  it('escapes &, <, >, ", and \'', () => {
    expect(escapeHtml('<script>alert("x & y\'s")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x &amp; y&#39;s&quot;)&lt;/script&gt;',
    )
  })

  it('handles null, undefined, and non-string inputs safely', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
    expect(escapeHtml(123)).toBe('123')
  })
})

describe('formMeta', () => {
  const appUrl = 'https://peraform-qt.web.app'

  it('returns null for drafts, closed forms, and non-published statuses', () => {
    expect(formMeta({ status: 'draft', title: 'Secret Draft' }, appUrl)).toBeNull()
    expect(formMeta({ status: 'closed', title: 'Closed Form' }, appUrl)).toBeNull()
    expect(formMeta({ status: 'archived', title: 'Old Form' }, appUrl)).toBeNull()
    expect(formMeta(null, appUrl)).toBeNull()
    expect(formMeta(undefined, appUrl)).toBeNull()
    expect(formMeta({}, appUrl)).toBeNull()
  })

  it('extracts metadata for published forms with custom header image', () => {
    const form = {
      id: 'abc123',
      status: 'published',
      title: 'Customer Feedback Survey',
      description: 'Tell us what you think about our service.',
      theme: {
        headerImage: {
          url: 'https://images.unsplash.com/photo-header.jpg',
        },
      },
    }

    const meta = formMeta(form, appUrl)
    expect(meta).toEqual({
      title: 'Customer Feedback Survey',
      description: 'Tell us what you think about our service.',
      image: 'https://images.unsplash.com/photo-header.jpg',
      url: 'https://peraform-qt.web.app/f/abc123',
    })
  })

  it('applies fallbacks for missing title, description, and header image', () => {
    const form = {
      status: 'published',
    }

    const meta = formMeta(form, appUrl, 'form-456')
    expect(meta).toEqual({
      title: 'Untitled form',
      description: 'Fill in this form on PeraForm.',
      image: 'https://peraform-qt.web.app/og-banner.png',
      url: 'https://peraform-qt.web.app/f/form-456',
    })
  })

  it('falls back to default og-banner if header image is not https', () => {
    const form = {
      status: 'published',
      title: 'Survey',
      theme: {
        headerImage: {
          url: 'http://insecure.example.com/banner.png',
        },
      },
    }

    const meta = formMeta(form, appUrl, 'form-insecure')
    expect(meta.image).toBe('https://peraform-qt.web.app/og-banner.png')
  })

  it('trims titles over 90 characters', () => {
    const longTitle = 'A'.repeat(120)
    const form = {
      status: 'published',
      title: longTitle,
    }

    const meta = formMeta(form, appUrl, 'form-long')
    expect(meta.title.length).toBeLessThanOrEqual(90)
    expect(meta.title).toBe('A'.repeat(90))
  })

  it('collapses whitespace and trims descriptions over 200 characters', () => {
    const longDesc = 'First line.\n\n   Second line with lots   of spaces.   ' + 'Word '.repeat(40)
    const form = {
      status: 'published',
      title: 'Survey',
      description: longDesc,
    }

    const meta = formMeta(form, appUrl, 'form-desc')
    expect(meta.description.length).toBeLessThanOrEqual(200)
    expect(meta.description).not.toContain('\n')
    expect(meta.description).not.toMatch(/\s{2,}/)
  })
})

describe('injectOg', () => {
  const sampleHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>PeraForm</title>
    <meta name="description" content="A web app for building forms." />
    <meta property="og:site_name" content="PeraForm" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="PeraForm" />
    <meta property="og:description" content="Build forms and onboarding-style interviews." />
    <meta property="og:image" content="https://peraform-qt.web.app/og-banner.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`

  it('returns html unchanged if meta is null or undefined', () => {
    expect(injectOg(sampleHtml, null)).toBe(sampleHtml)
    expect(injectOg(sampleHtml, undefined)).toBe(sampleHtml)
  })

  it('swaps in form title, description, image, and adds og:url and twitter tags', () => {
    const meta = {
      title: 'Registration Form',
      description: 'Sign up for the 2026 conference.',
      image: 'https://peraform-qt.web.app/photos/conf.jpg',
      url: 'https://peraform-qt.web.app/f/conf2026',
    }

    const injected = injectOg(sampleHtml, meta)

    expect(injected).toContain('<title>Registration Form · PeraForm</title>')
    expect(injected).toContain('<meta property="og:title" content="Registration Form" />')
    expect(injected).toContain(
      '<meta property="og:description" content="Sign up for the 2026 conference." />',
    )
    expect(injected).toContain(
      '<meta property="og:image" content="https://peraform-qt.web.app/photos/conf.jpg" />',
    )
    expect(injected).toContain(
      '<meta property="og:url" content="https://peraform-qt.web.app/f/conf2026" />',
    )
    expect(injected).toContain('<meta name="twitter:card" content="summary_large_image" />')
    expect(injected).toContain('<meta name="twitter:title" content="Registration Form" />')
    expect(injected).toContain(
      '<meta name="twitter:description" content="Sign up for the 2026 conference." />',
    )
    expect(injected).toContain(
      '<meta name="twitter:image" content="https://peraform-qt.web.app/photos/conf.jpg" />',
    )
  })

  it('escapes special characters like <script> and quotes in tags and title', () => {
    const meta = {
      title: '<script>alert("pwned")</script>',
      description: 'Form with "quotes" & \'apostrophes\' <tag>',
      image: 'https://peraform-qt.web.app/og-banner.png?v=1&w=2',
      url: 'https://peraform-qt.web.app/f/x?a=1&b=2',
    }

    const injected = injectOg(sampleHtml, meta)

    expect(injected).not.toContain('<script>')
    expect(injected).toContain('&lt;script&gt;alert(&quot;pwned&quot;)&lt;/script&gt; · PeraForm')
    expect(injected).toContain(
      '<meta property="og:title" content="&lt;script&gt;alert(&quot;pwned&quot;)&lt;/script&gt;" />',
    )
    expect(injected).toContain(
      '<meta property="og:description" content="Form with &quot;quotes&quot; &amp; &#39;apostrophes&#39; &lt;tag&gt;" />',
    )
    expect(injected).toContain(
      '<meta property="og:image" content="https://peraform-qt.web.app/og-banner.png?v=1&amp;w=2" />',
    )
    expect(injected).toContain(
      '<meta property="og:url" content="https://peraform-qt.web.app/f/x?a=1&amp;b=2" />',
    )
  })
})
