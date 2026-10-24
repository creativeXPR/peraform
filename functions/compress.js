import { gzipSync } from 'node:zlib'

// Respondents' uploads are compressed after they land in Storage:
//   photos  → resized to fit MAX_SIDE, re-encoded in the same format
//             (also drops EXIF data such as GPS location)
//   text-like files (CSV, TXT, JSON, SVG, old Office, PDF…) → gzipped and
//             stored with Content-Encoding: gzip, so downloads unzip
//             themselves and the file looks unchanged to the creator.
// Already-compressed formats (zip, docx/xlsx, video, audio, gif) are left
// alone, and a result is only kept when it saves at least MIN_SAVING.

export const MARK = 'peraCompressed'
const MAX_SIDE = 2560
const MAX_IMAGE_BYTES = 40 * 1024 * 1024
const MIN_SAVING = 0.1

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const GZIP_TYPES = [
  'application/json',
  'application/xml',
  'application/pdf',
  'application/rtf',
  'application/x-ndjson',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
]

// Which kind of compression an uploaded object gets, or null to skip it.
export function compressionFor({ name = '', contentType = '', contentEncoding, size = 0, metadata }) {
  if (!name.startsWith('uploads/')) return null
  if (metadata?.[MARK] || contentEncoding) return null
  const type = contentType.split(';')[0].trim().toLowerCase()
  if (IMAGE_TYPES.includes(type)) return size <= MAX_IMAGE_BYTES ? 'image' : null
  if (type.startsWith('text/') || GZIP_TYPES.includes(type)) return 'gzip'
  return null
}

// sharp is large: loaded on first use, so other functions' cold starts
// (which share this code) don't pay for it.
async function shrinkImage(input, type) {
  const { default: sharp } = await import('sharp')
  const img = sharp(input, { failOn: 'none' })
    .rotate() // Apply EXIF orientation before metadata is dropped.
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
  if (type === 'image/jpeg') return img.jpeg({ quality: 80, mozjpeg: true }).toBuffer()
  if (type === 'image/png') return img.png({ compressionLevel: 9, effort: 8 }).toBuffer()
  return img.webp({ quality: 80 }).toBuffer()
}

// Returns { data, contentEncoding? } when compression is worth keeping,
// otherwise null.
export async function compressBuffer(input, kind, contentType) {
  const data =
    kind === 'image'
      ? await shrinkImage(input, contentType.split(';')[0].trim().toLowerCase())
      : gzipSync(input, { level: 9 })
  if (data.length > input.length * (1 - MIN_SAVING)) return null
  return kind === 'gzip' ? { data, contentEncoding: 'gzip' } : { data }
}
