// Turns a document someone adds (dropped, pasted or picked) into plain text
// for Dawn, in the browser; nothing is uploaded. Word and PDF readers load
// only when such a file arrives, so the main bundle stays small. Shared with
// HyperCBT (copy as is).
//
//   readDocument(file) → { name, kind: 'text' | 'word' | 'pdf', text, pages? }
//   throws DocumentError with a message that says what to do instead
//   DOC_ACCEPT: for <input type="file" accept>
//   filesFrom(dataTransfer): the files in a drop or a paste (may be empty)

export const DOC_ACCEPT =
  '.txt,.md,.csv,.tsv,.html,.htm,.docx,.pdf,text/plain,text/markdown,text/csv,text/html,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const MAX_BYTES = 20 * 1024 * 1024

export class DocumentError extends Error {}

export function filesFrom(dataTransfer) {
  return dataTransfer?.files?.length ? [...dataTransfer.files] : []
}

function kindOf(file) {
  const name = file.name.toLowerCase()
  const ext = name.includes('.') ? name.split('.').pop() : ''
  if (ext === 'pdf' || file.type === 'application/pdf') return 'pdf'
  if (ext === 'docx' || file.type.includes('wordprocessingml')) return 'word'
  if (ext === 'doc') return 'old-word'
  if (['html', 'htm'].includes(ext) || file.type === 'text/html') return 'html'
  if (['txt', 'md', 'csv', 'tsv'].includes(ext) || file.type.startsWith('text/')) return 'text'
  if (file.type.startsWith('image/')) return 'image'
  return 'unknown'
}

// Tidy whitespace: no trailing spaces, at most one blank line in a row.
function tidy(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\u00a0]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function readDocument(file) {
  if (file.size > MAX_BYTES) {
    throw new DocumentError(`“${file.name}” is too large (20 MB at most). Try a shorter document, or paste just the part you need.`)
  }
  const kind = kindOf(file)
  let text
  let pages

  if (kind === 'text') {
    text = await file.text()
  } else if (kind === 'html') {
    const doc = new DOMParser().parseFromString(await file.text(), 'text/html')
    text = doc.body?.innerText || doc.body?.textContent || ''
  } else if (kind === 'word') {
    const { default: mammoth } = await import('mammoth')
    try {
      text = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value
    } catch {
      throw new DocumentError(`“${file.name}” couldn’t be opened. It may be damaged; try saving it again as .docx or PDF.`)
    }
  } else if (kind === 'pdf') {
    ;({ text, pages } = await readPdf(file))
  } else if (kind === 'old-word') {
    throw new DocumentError('Older Word files (.doc) can’t be read. Open it in Word and save it as .docx or PDF, then add it again.')
  } else if (kind === 'image') {
    throw new DocumentError('Pictures can’t be read yet. Add a PDF or Word file, or paste the text.')
  } else {
    throw new DocumentError(`“${file.name}” isn’t a document Dawn can read. Use a PDF, Word (.docx) or text file, or paste the text.`)
  }

  text = tidy(text)
  if (!text) {
    throw new DocumentError(
      kind === 'pdf'
        ? `“${file.name}” looks like a scan: it has pictures of pages but no text to read. Use the original document, or paste its text.`
        : `“${file.name}” is empty.`,
    )
  }
  return { name: file.name, kind: kind === 'html' ? 'text' : kind, text, pages }
}

async function readPdf(file) {
  const pdfjs = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  // The loading task is what gets cleaned up afterwards (the document has
  // no destroy() in this pdf.js).
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  let pdf
  try {
    pdf = await task.promise
  } catch (err) {
    throw new DocumentError(
      err?.name === 'PasswordException'
        ? `“${file.name}” is password-protected. Remove the password and add it again.`
        : `“${file.name}” couldn’t be opened. It may be damaged; try saving it again as PDF.`,
    )
  }
  const pages = pdf.numPages
  const out = []
  for (let n = 1; n <= pages; n++) {
    const page = await pdf.getPage(n)
    const { items } = await page.getTextContent()
    out.push(items.map((it) => (it.str ?? '') + (it.hasEOL ? '\n' : ' ')).join(''))
  }
  await task.destroy()
  return { text: out.join('\n\n'), pages }
}
