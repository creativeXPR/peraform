import { useState } from 'react'
import { Folder, FolderPlus, Star } from 'lucide-react'
import MenuButton from '../../lib/MenuButton.jsx'
import { createFolder, moveToFolder, setStarred, useOrganize } from '../../lib/organize.js'
import PromptDialog from '../../lib/PromptDialog.jsx'
import { useToast } from '../../lib/useToast.jsx'
import { useAuth } from '../auth/useAuth.js'
import { useFormEditor } from './editorContext.js'

const SAVE_LABELS = { saving: 'Saving…', saved: 'Saved', error: 'Couldn’t save — retrying' }

// Top-bar title (same field as the header card's title), then Google-style
// "Move to folder" and star buttons, then save status. Stars and folders are
// this person's own (lib/organize.js).
export default function FormTitleField() {
  const { form, draft, edit, saveState } = useFormEditor()
  const { user } = useAuth()
  const { meta, folders } = useOrganize(user.uid)
  const [naming, setNaming] = useState(false)
  const [toast, showToast] = useToast()
  const mine = meta[form.id] ?? {}
  const folderName = folders.find((f) => f.id === mine.folderId)?.name

  async function move(folderId, name) {
    try {
      await moveToFolder(user.uid, form.id, folderId)
      showToast(folderId ? `Moved to ${name}` : 'Moved to My forms')
    } catch {
      showToast('Couldn’t move the form. Please try again.')
    }
  }

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
      <MenuButton
        className="title-tool"
        icon={<Folder size={17} />}
        label={folderName ? `In folder: ${folderName} — move` : 'Move to folder'}
        items={[
          { label: 'My forms (no folder)', checked: !mine.folderId, onSelect: () => move(null) },
          ...folders.map((f) => ({
            label: f.name,
            checked: mine.folderId === f.id,
            onSelect: () => move(f.id, f.name),
          })),
          { label: 'New folder…', icon: FolderPlus, onSelect: () => setNaming(true) },
        ]}
      />
      <button
        type="button"
        className={`icon-btn title-tool star-btn${mine.starred ? ' on' : ''}`}
        onClick={() => setStarred(user.uid, form.id, !mine.starred).catch(() => {})}
        aria-label={mine.starred ? 'Unstar' : 'Star'}
        aria-pressed={Boolean(mine.starred)}
        title={mine.starred ? 'Starred' : 'Star'}
      >
        <Star size={17} />
      </button>
      <span className={`save-state save-${saveState}`} role="status">
        {SAVE_LABELS[saveState]}
      </span>

      <PromptDialog
        open={naming}
        title="New folder"
        label="Folder name"
        confirmLabel="Create and move"
        onCancel={() => setNaming(false)}
        onSubmit={async (name) => {
          setNaming(false)
          try {
            const id = await createFolder(user.uid, name)
            await move(id, name)
          } catch {
            showToast('Couldn’t create the folder. Please try again.')
          }
        }}
      />
      {toast}
    </div>
  )
}
