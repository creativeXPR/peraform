import { FILE_KINDS, MAX_FILES_CHOICES, MAX_SIZE_CHOICES } from '../../lib/formModel.js'

// Settings for a file-upload question: allowed kinds, how many files, max size.
export default function FileUploadEditor({ question, change }) {
  const accept = question.accept ?? []
  const limited = accept.length > 0
  const set = (field, value) => change(field, (q) => ({ ...q, [field]: value }))

  return (
    <div className="upload-editor">
      <p className="key-note">
        Respondents will be asked to sign in, and files are saved to your PeraForm storage.
      </p>

      <label className="switch">
        <span>Allow only specific file types</span>
        <input
          type="checkbox"
          role="switch"
          checked={limited}
          onChange={(e) => set('accept', e.target.checked ? ['document', 'pdf', 'image'] : [])}
        />
      </label>

      {limited && (
        <div className="setting-checks upload-kinds">
          {Object.entries(FILE_KINDS).map(([kind, { label }]) => (
            <label key={kind} className="setting-check">
              <input
                type="checkbox"
                checked={accept.includes(kind)}
                onChange={(e) =>
                  set(
                    'accept',
                    e.target.checked ? [...accept, kind] : accept.filter((k) => k !== kind),
                  )
                }
              />
              {label}
            </label>
          ))}
        </div>
      )}

      <div className="upload-limits">
        <label>
          <span>Maximum number of files</span>
          <select
            value={question.maxFiles ?? 1}
            onChange={(e) => set('maxFiles', Number(e.target.value))}
          >
            {MAX_FILES_CHOICES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Maximum file size</span>
          <select
            value={question.maxSizeMb ?? 10}
            onChange={(e) => set('maxSizeMb', Number(e.target.value))}
          >
            {MAX_SIZE_CHOICES.map((n) => (
              <option key={n} value={n}>
                {n} MB
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
