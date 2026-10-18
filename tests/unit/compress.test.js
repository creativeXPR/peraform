import { randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { MARK, compressBuffer, compressionFor } from '../../functions/compress.js'

// sharp is a functions dependency, not the web app's.
const sharp = createRequire(new URL('../../functions/', import.meta.url))('sharp')

const upload = (over) => ({ name: 'uploads/f1/u1/x-file', size: 1000, ...over })

describe('compressionFor', () => {
  it('picks images and text-like files under uploads/', () => {
    expect(compressionFor(upload({ contentType: 'image/jpeg' }))).toBe('image')
    expect(compressionFor(upload({ contentType: 'image/png' }))).toBe('image')
    expect(compressionFor(upload({ contentType: 'text/csv; charset=utf-8' }))).toBe('gzip')
    expect(compressionFor(upload({ contentType: 'application/pdf' }))).toBe('gzip')
    expect(compressionFor(upload({ contentType: 'image/svg+xml' }))).toBe('gzip')
  })

  it('skips already-compressed formats, other folders and done files', () => {
    expect(compressionFor(upload({ contentType: 'application/zip' }))).toBeNull()
    expect(compressionFor(upload({ contentType: 'video/mp4' }))).toBeNull()
    expect(compressionFor(upload({ contentType: 'image/gif' }))).toBeNull()
    expect(
      compressionFor(upload({ contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })),
    ).toBeNull()
    expect(compressionFor(upload({ name: 'creators/u1/images/a.png', contentType: 'image/png' }))).toBeNull()
    expect(compressionFor(upload({ contentType: 'text/plain', metadata: { [MARK]: 'gzip' } }))).toBeNull()
    expect(compressionFor(upload({ contentType: 'text/plain', contentEncoding: 'gzip' }))).toBeNull()
    expect(compressionFor(upload({ contentType: 'image/jpeg', size: 50 * 1024 * 1024 }))).toBeNull()
  })
})

describe('compressBuffer', () => {
  it('gzips text so it unzips back to the same bytes', async () => {
    const text = Buffer.from('name,answer\n'.repeat(500))
    const out = await compressBuffer(text, 'gzip', 'text/csv')
    expect(out.contentEncoding).toBe('gzip')
    expect(out.data.length).toBeLessThan(text.length / 5)
    expect(gunzipSync(out.data).equals(text)).toBe(true)
  })

  it('shrinks a large photo to fit 2560px, keeping the format', async () => {
    const noise = Buffer.alloc(4000 * 3000 * 3)
    for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) >>> 24
    const photo = await sharp(noise, { raw: { width: 4000, height: 3000, channels: 3 } })
      .jpeg({ quality: 100 })
      .toBuffer()
    const out = await compressBuffer(photo, 'image', 'image/jpeg')
    expect(out.contentEncoding).toBeUndefined()
    expect(out.data.length).toBeLessThan(photo.length)
    const meta = await sharp(out.data).metadata()
    expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 2560, 1920])
  }, 30_000)

  it('keeps the original when compressing would barely help', async () => {
    const random = randomBytes(4000)
    expect(await compressBuffer(random, 'gzip', 'application/pdf')).toBeNull()
  })
})
