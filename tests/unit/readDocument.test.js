import { describe, expect, it, vi } from 'vitest'
import { DocumentError, filesFrom, readDocument } from '../../src/lib/readDocument.js'

// A stand-in for pdf.js 6 with its real shape: the loading task has
// destroy(); the document doesn't (calling pdf.destroy() broke every PDF).
const pdfPages = vi.hoisted(() => ({ list: [] }))
const destroyed = vi.hoisted(() => ({ count: 0 }))
const pdfFail = vi.hoisted(() => ({ error: null }))

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: () => ({
    promise: pdfFail.error
      ? Promise.reject(pdfFail.error)
      : Promise.resolve({
          numPages: pdfPages.list.length,
          getPage: async (n) => ({
            getTextContent: async () => ({ items: pdfPages.list[n - 1].map((str) => ({ str, hasEOL: true })) }),
          }),
        }),
    destroy: async () => {
      destroyed.count++
    },
  }),
}))
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'pdf.worker.js' }))

vi.mock('mammoth', () => ({
  default: {
    extractRawText: async ({ arrayBuffer }) => {
      const text = new TextDecoder().decode(arrayBuffer)
      if (text.includes('CORRUPT')) throw new Error('Corrupt zip')
      return { value: text || 'Questions from Word file' }
    },
  },
}))

const file = (body, name, type = '') => new File([body], name, { type })

describe('readDocument', () => {
  it('reads text files and tidies the whitespace', async () => {
    const read = await readDocument(file('Q1. Name?  \r\n\r\n\r\n\r\nQ2. Age? \n', 'quiz.txt', 'text/plain'))
    expect(read).toEqual({ name: 'quiz.txt', kind: 'text', text: 'Q1. Name?\n\nQ2. Age?', pages: undefined })
  })

  it('reads Markdown and CSV by their extension', async () => {
    expect((await readDocument(file('# Survey', 'notes.md'))).text).toBe('# Survey')
    expect((await readDocument(file('a,b\n1,2', 'list.csv'))).text).toBe('a,b\n1,2')
  })

  it('reads a Word (.docx) file', async () => {
    const read = await readDocument(file('Question 1: What is 2 + 2?', 'test.docx'))
    expect(read).toEqual({
      name: 'test.docx',
      kind: 'word',
      text: 'Question 1: What is 2 + 2?',
      pages: undefined,
    })
  })

  it('explains when a Word file is damaged', async () => {
    await expect(readDocument(file('CORRUPT', 'broken.docx'))).rejects.toThrow(/couldn’t be opened\. It may be damaged/)
  })

  it('explains what to do with files it can’t read', async () => {
    await expect(readDocument(file('x', 'old.doc'))).rejects.toThrow(/save it as \.docx or PDF/)
    await expect(readDocument(file('x', 'docfile', 'application/msword'))).rejects.toThrow(/save it as \.docx or PDF/)
    await expect(readDocument(file('x', 'photo.png', 'image/png'))).rejects.toThrow(/Pictures can’t be read yet/)
    await expect(readDocument(file('x', 'scan.jpg', ''))).rejects.toThrow(/Pictures can’t be read yet/)
    await expect(readDocument(file('x', 'data.zip', 'application/zip'))).rejects.toThrow(DocumentError)
    await expect(readDocument(file('   \n ', 'blank.txt'))).rejects.toThrow(/is empty/)
  })

  it('reads a PDF’s text, page by page, and cleans up afterwards', async () => {
    pdfPages.list = [['Q1. Your name?'], ['Q2. Your age?']]
    pdfFail.error = null
    destroyed.count = 0
    const read = await readDocument(file('%PDF', 'quiz.pdf', 'application/pdf'))
    expect(read).toEqual({ name: 'quiz.pdf', kind: 'pdf', text: 'Q1. Your name?\n\nQ2. Your age?', pages: 2 })
    expect(destroyed.count).toBe(1)
  })

  it('says plainly when a PDF is a scan with no text', async () => {
    pdfPages.list = [[], []]
    pdfFail.error = null
    await expect(readDocument(file('%PDF', 'scan.pdf', 'application/pdf'))).rejects.toThrow(/looks like a scan/)
  })

  it('identifies password-protected PDFs and tells the user', async () => {
    const err = new Error('Password required')
    err.name = 'PasswordException'
    pdfFail.error = err
    destroyed.count = 0
    await expect(readDocument(file('%PDF', 'locked.pdf', 'application/pdf'))).rejects.toThrow(
      /is password-protected\. Remove the password and add it again\./,
    )
    expect(destroyed.count).toBe(1)
    pdfFail.error = null
  })

  it('refuses very large files before reading them', async () => {
    const big = file('x', 'huge.txt')
    Object.defineProperty(big, 'size', { value: 21 * 1024 * 1024 })
    await expect(readDocument(big)).rejects.toThrow(/too large/)
  })
})

describe('filesFrom', () => {
  it('lists the files in a drop or paste, or none', () => {
    const f = file('x', 'a.txt')
    expect(filesFrom({ files: [f] })).toEqual([f])
    expect(filesFrom({ files: [] })).toEqual([])
    expect(filesFrom(null)).toEqual([])
  })

  it('extracts files from clipboard items when files list is empty', () => {
    const f = file('img', 'screenshot.png', 'image/png')
    const item = { kind: 'file', getAsFile: () => f }
    expect(filesFrom({ files: [], items: [item] })).toEqual([f])
  })
})
