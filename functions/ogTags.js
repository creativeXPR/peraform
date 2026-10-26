// Pure helper for Open Graph & Twitter card preview tags.
// Unit-testable without any Firebase SDK dependencies.

export function escapeHtml(str) {
  if (str == null) return ''
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]))
}

// Builds preview metadata for a form. Only published forms return metadata;
// drafts and closed forms return null so their private details are never shown.
export function formMeta(form, appUrl, formId = form?.id) {
  if (!form || typeof form !== 'object' || form.status !== 'published') {
    return null
  }

  const base = (appUrl || '').replace(/\/+$/, '')
  const id = form.id || formId

  const rawTitle = typeof form.title === 'string' && form.title.trim() ? form.title.trim() : 'Untitled form'
  const title = rawTitle.length > 90 ? rawTitle.slice(0, 90).trim() : rawTitle

  const rawDesc = typeof form.description === 'string' ? form.description.replace(/\s+/g, ' ').trim() : ''
  const description = rawDesc
    ? (rawDesc.length > 200 ? rawDesc.slice(0, 200).trim() : rawDesc)
    : 'Fill in this form on PeraForm.'

  const headerUrl = form.theme?.headerImage?.url
  const image = typeof headerUrl === 'string' && headerUrl.startsWith('https://')
    ? headerUrl
    : `${base}/og-banner.png`

  const url = id ? `${base}/f/${id}` : base

  return { title, description, image, url }
}

// Injects per-form preview tags into the index.html shell.
// Replaces default og:title, og:description, og:image; adds og:url;
// sets <title> to "<form title> · PeraForm"; adds twitter:title/description/image.
// Returns html unchanged if meta is null.
export function injectOg(html, meta) {
  if (!meta || typeof meta !== 'object') {
    return html
  }

  const titleEscaped = escapeHtml(meta.title)
  const descEscaped = escapeHtml(meta.description)
  const imageEscaped = escapeHtml(meta.image)
  const urlEscaped = escapeHtml(meta.url)

  let out = html

  // <title>
  if (/<title>.*?<\/title>/i.test(out)) {
    out = out.replace(/<title>.*?<\/title>/i, `<title>${titleEscaped} · PeraForm</title>`)
  }

  // og:title
  if (/<meta\s+(?:[^>]*?\s+)?property=["']og:title["'][^>]*>/i.test(out)) {
    out = out.replace(
      /<meta\s+(?:[^>]*?\s+)?property=["']og:title["'][^>]*>/i,
      `<meta property="og:title" content="${titleEscaped}" />`,
    )
  }

  // og:description
  if (/<meta\s+(?:[^>]*?\s+)?property=["']og:description["'][^>]*>/i.test(out)) {
    out = out.replace(
      /<meta\s+(?:[^>]*?\s+)?property=["']og:description["'][^>]*>/i,
      `<meta property="og:description" content="${descEscaped}" />`,
    )
  }

  // og:image
  if (/<meta\s+(?:[^>]*?\s+)?property=["']og:image["'][^>]*>/i.test(out)) {
    out = out.replace(
      /<meta\s+(?:[^>]*?\s+)?property=["']og:image["'][^>]*>/i,
      `<meta property="og:image" content="${imageEscaped}" />`,
    )
  }

  // og:url
  if (urlEscaped) {
    const urlTag = `<meta property="og:url" content="${urlEscaped}" />`
    if (/<meta\s+(?:[^>]*?\s+)?property=["']og:url["'][^>]*>/i.test(out)) {
      out = out.replace(/<meta\s+(?:[^>]*?\s+)?property=["']og:url["'][^>]*>/i, urlTag)
    } else if (/<meta\s+(?:[^>]*?\s+)?property=["']og:image:height["'][^>]*>/i.test(out)) {
      out = out.replace(
        /(<meta\s+(?:[^>]*?\s+)?property=["']og:image:height["'][^>]*>)/i,
        `$1\n    ${urlTag}`,
      )
    } else if (/<meta\s+(?:[^>]*?\s+)?property=["']og:image["'][^>]*>/i.test(out)) {
      out = out.replace(
        /(<meta\s+(?:[^>]*?\s+)?property=["']og:image["'][^>]*>)/i,
        `$1\n    ${urlTag}`,
      )
    } else if (/<\/head>/i.test(out)) {
      out = out.replace(/<\/head>/i, `    ${urlTag}\n  </head>`)
    }
  }

  // twitter tags
  const twTitleTag = `<meta name="twitter:title" content="${titleEscaped}" />`
  const twDescTag = `<meta name="twitter:description" content="${descEscaped}" />`
  const twImgTag = `<meta name="twitter:image" content="${imageEscaped}" />`

  if (/<meta\s+(?:[^>]*?\s+)?name=["']twitter:title["'][^>]*>/i.test(out)) {
    out = out.replace(/<meta\s+(?:[^>]*?\s+)?name=["']twitter:title["'][^>]*>/i, twTitleTag)
  }
  if (/<meta\s+(?:[^>]*?\s+)?name=["']twitter:description["'][^>]*>/i.test(out)) {
    out = out.replace(/<meta\s+(?:[^>]*?\s+)?name=["']twitter:description["'][^>]*>/i, twDescTag)
  }
  if (/<meta\s+(?:[^>]*?\s+)?name=["']twitter:image["'][^>]*>/i.test(out)) {
    out = out.replace(/<meta\s+(?:[^>]*?\s+)?name=["']twitter:image["'][^>]*>/i, twImgTag)
  }

  const missingTwitter = []
  if (!out.includes('name="twitter:title"')) missingTwitter.push(twTitleTag)
  if (!out.includes('name="twitter:description"')) missingTwitter.push(twDescTag)
  if (!out.includes('name="twitter:image"')) missingTwitter.push(twImgTag)

  if (missingTwitter.length > 0) {
    const block = missingTwitter.join('\n    ')
    if (/<meta\s+(?:[^>]*?\s+)?name=["']twitter:card["'][^>]*>/i.test(out)) {
      out = out.replace(
        /(<meta\s+(?:[^>]*?\s+)?name=["']twitter:card["'][^>]*>)/i,
        `$1\n    ${block}`,
      )
    } else if (/<\/head>/i.test(out)) {
      out = out.replace(/<\/head>/i, `    ${block}\n  </head>`)
    }
  }

  return out
}
