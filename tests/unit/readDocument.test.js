import { describe, expect, it } from 'vitest'
import { DocumentError, filesFrom, readDocument } from '../../src/lib/readDocument.js'

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

  it('explains what to do with files it can’t read', async () => {
    await expect(readDocument(file('x', 'old.doc'))).rejects.toThrow(/save it as \.docx or PDF/)
    await expect(readDocument(file('x', 'photo.png', 'image/png'))).rejects.toThrow(/Pictures can’t be read yet/)
    await expect(readDocument(file('x', 'data.zip', 'application/zip'))).rejects.toThrow(DocumentError)
    await expect(readDocument(file('   \n ', 'blank.txt'))).rejects.toThrow(/is empty/)
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
})
