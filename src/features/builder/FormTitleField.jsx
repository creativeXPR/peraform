import { useFormEditor } from './editorContext.js'

const SAVE_LABELS = { saving: 'Saving…', saved: 'Saved', error: 'Couldn’t save — retrying' }

// Top-bar title (same field as the header card's title) plus save status.
export default function FormTitleField() {
  const { draft, edit, saveState } = useFormEditor()
  return (
    <div className="title-field">
      <input
        value={draft.title}
        onChange={(e) => {
          const title = e.target.value
          edit('title', (d) => ({ ...d, title }))
        }}
        placeholder="Untitled form"
        aria-label="Form title"
      />
      <span className={`save-state save-${saveState}`} role="status">
        {SAVE_LABELS[saveState]}
      </span>
    </div>
  )
}
