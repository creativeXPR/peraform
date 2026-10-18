import { useRef, useState } from 'react'
import { FileText, Upload, X } from 'lucide-react'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import { FILE_KINDS } from '../../lib/formModel.js'
import { deleteStored, formatBytes, uploadResponseFile } from '../../lib/upload.js'
import { useAuth } from '../auth/useAuth.js'

// Does `file` match the question's allowed kinds? (Empty list = anything.)
function allowed(file, kinds) {
  if (!kinds.length) return true
  const name = file.name.toLowerCase()
  return kinds.some((kind) =>
    FILE_KINDS[kind].accept.split(',').some((rule) =>
      rule.startsWith('.')
        ? name.endsWith(rule)
        : rule.endsWith('/*')
          ? file.type.startsWith(rule.slice(0, -1))
          : file.type === rule,
    ),
  )
}

// File-upload answer: a list of uploaded files ({ name, path, url, size, type }).
// Files upload straight away to the respondent's own folder; the response
// only stores the links. Signing in is required before this is shown.
export default function FileUploadField({ question: q, formId, value, onChange, labelId }) {
  const { user } = useAuth()
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(null) // { name, progress }
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState(null)
  const files = value ?? []
  const kinds = q.accept ?? []
  const maxFiles = q.maxFiles ?? 1
  const maxBytes = (q.maxSizeMb ?? 10) * 1024 * 1024
  const acceptAttr = kinds.map((k) => FILE_KINDS[k].accept).join(',')

  async function pick(e) {
    const chosen = [...(e.target.files ?? [])]
    e.target.value = ''
    setError('')
    let current = files
    for (const file of chosen) {
      if (current.length >= maxFiles) {
        setError(`You can add up to ${maxFiles} ${maxFiles === 1 ? 'file' : 'files'}.`)
        break
      }
      if (!allowed(file, kinds)) {
        setError(`“${file.name}” isn’t an allowed file type.`)
        continue
      }
      if (file.size > maxBytes) {
        setError(`“${file.name}” is larger than ${q.maxSizeMb ?? 10} MB.`)
        continue
      }
      try {
        setUploading({ name: file.name, progress: 0 })
        const uploaded = await uploadResponseFile(file, formId, user.uid, (progress) =>
          setUploading({ name: file.name, progress }),
        )
        current = [...current, uploaded]
        onChange(current)
      } catch {
        setError(`Couldn’t upload “${file.name}”. Check your connection and try again.`)
      } finally {
        setUploading(null)
      }
    }
  }

  function remove(file) {
    onChange(files.filter((f) => f.path !== file.path))
    deleteStored(file.path)
    setRemoving(null)
  }

  return (
    <div className="upload-field" aria-labelledby={labelId}>
      {files.length > 0 && (
        <ul className="upload-files">
          {files.map((file) => (
            <li key={file.path}>
              <FileText size={18} />
              <span className="upload-name">{file.name}</span>
              <span className="upload-size">{formatBytes(file.size)}</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setRemoving(file)}
                aria-label={`Remove ${file.name}`}
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {uploading ? (
        <div className="upload-progress" role="status">
          <span>Uploading {uploading.name}…</span>
          <span className="upload-bar">
            <span style={{ width: `${Math.round(uploading.progress * 100)}%` }} />
          </span>
        </div>
      ) : (
        files.length < maxFiles && (
          <button type="button" className="btn btn-outline upload-add" onClick={() => inputRef.current.click()}>
            <Upload size={16} />
            Add file{maxFiles > 1 ? 's' : ''}
          </button>
        )
      )}
      <p className="upload-hint">
        {kinds.length ? kinds.map((k) => FILE_KINDS[k].label).join(', ') : 'Any file type'} · up to{' '}
        {maxFiles} {maxFiles === 1 ? 'file' : 'files'}, {q.maxSizeMb ?? 10} MB each
      </p>
      {error && (
        <p className="respond-q-error" role="alert">
          {error}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple={maxFiles > 1}
        accept={acceptAttr || undefined}
        onChange={pick}
      />

      <ConfirmModal
        open={Boolean(removing)}
        title={`Remove “${removing?.name}”?`}
        message="The file will be deleted from this response."
        confirmLabel="Remove"
        onConfirm={() => remove(removing)}
        onCancel={() => setRemoving(null)}
      />
    </div>
  )
}
