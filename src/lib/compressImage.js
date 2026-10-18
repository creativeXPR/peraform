// Shrinks a photo in the browser before it's uploaded: scaled to fit
// maxSide and re-encoded as WebP (JPEG where WebP encoding isn't supported).
// GIFs (may be animated) and SVGs (vector) are left alone, and so is any
// image the re-encode wouldn't make smaller.

const SKIP = ['image/gif', 'image/svg+xml']

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

export async function compressImage(file, { maxSide = 1600, quality = 0.82 } = {}) {
  if (!file.type.startsWith('image/') || SKIP.includes(file.type)) return file
  let bitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file // A format this browser can't decode (e.g. HEIC) — upload as is.
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  let blob = await toBlob(canvas, 'image/webp', quality)
  // Browsers without a WebP encoder hand back a PNG instead. JPEG has no
  // transparency, so a PNG stays as it is there.
  if (!blob || blob.type !== 'image/webp') {
    if (file.type === 'image/png') return file
    blob = await toBlob(canvas, 'image/jpeg', quality)
  }
  if (!blob || blob.size >= file.size) return file

  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const name = file.name.replace(/\.[^.]*$/, '') + '.' + ext
  return new File([blob], name, { type: blob.type, lastModified: file.lastModified })
}
