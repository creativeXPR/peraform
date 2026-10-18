import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { compressImage } from './compressImage.js'
import { storage } from './firebase.js'

// Paths match storage.rules:
//   creators/{uid}/images/…        images on forms (public)
//   uploads/{formId}/{uid}/…       respondents' files

const MB = 1024 * 1024
export const MAX_IMAGE_MB = 10
// Originals can be bigger: they're shrunk in the browser before upload.
const MAX_ORIGINAL_MB = 40

function safeName(name) {
  return name.replace(/[^\w.-]+/g, '_').slice(-80) || 'file'
}

function upload(path, file, onProgress) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type })
    task.on(
      'state_changed',
      (snap) => onProgress?.(snap.bytesTransferred / snap.totalBytes),
      reject,
      async () => resolve(await getDownloadURL(task.snapshot.ref)),
    )
  })
}

// An image for the form itself, compressed first. Returns { url, path }.
export async function uploadFormImage(file, uid, onProgress) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
  if (file.size > MAX_ORIGINAL_MB * MB) throw new Error(`Images can be up to ${MAX_ORIGINAL_MB} MB.`)
  file = await compressImage(file)
  if (file.size > MAX_IMAGE_MB * MB) {
    throw new Error(`That image is still over ${MAX_IMAGE_MB} MB after compressing. Try a smaller one.`)
  }
  const path = `creators/${uid}/images/${crypto.randomUUID()}-${safeName(file.name)}`
  return { url: await upload(path, file, onProgress), path }
}

// A respondent's file for a file-upload question.
// Returns { name, path, url, size, type } — the shape stored in answers.
export async function uploadResponseFile(file, formId, uid, onProgress) {
  const path = `uploads/${formId}/${uid}/${crypto.randomUUID()}-${safeName(file.name)}`
  const url = await upload(path, file, onProgress)
  return { name: file.name, path, url, size: file.size, type: file.type || 'application/octet-stream' }
}

// Best effort: a leftover file is harmless, so failures are ignored.
export function deleteStored(path) {
  return deleteObject(ref(storage, path)).catch(() => {})
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`
}
