import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  Copy,
  Eye,
  Link2,
  MoreVertical,
  Redo2,
  Trash2,
  Undo2,
  UserPlus,
} from 'lucide-react'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import MenuButton from '../../lib/MenuButton.jsx'
import { useToast } from '../../lib/useToast.jsx'
import { useAuth } from '../auth/useAuth.js'
import { createForm, deleteForm } from '../dashboard/formActions.js'
import CollaboratorsDialog from './CollaboratorsDialog.jsx'
import { useFormEditor } from './editorContext.js'

// Text fields have their own native undo; only take Ctrl+Z when focus is
// elsewhere, so we never fight the browser over a half-typed word.
function isTextField(el) {
  return el?.matches?.('input, textarea, select, [contenteditable="true"]')
}

// Top-bar actions for the open form: undo/redo, preview, link, publish, more.
export default function BuilderActions() {
  const { form, draft, undo, redo, canUndo, canRedo, setStatus } = useFormEditor()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [toast, showToast] = useToast()
  const [confirm, setConfirm] = useState(null) // 'delete' | 'unpublish'
  const [busy, setBusy] = useState(false)
  const [collabOpen, setCollabOpen] = useState(false)
  const isOwner = form.ownerId === user.uid
  const link = `${window.location.origin}/f/${form.id}`

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || isTextField(e.target)) {
        return
      }
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      showToast(
        form.status === 'draft' ? 'Link copied — publish so people can open it' : 'Link copied',
      )
    } catch {
      showToast('Couldn’t copy the link')
    }
  }

  async function changeStatus(status, message) {
    try {
      await setStatus(status)
      showToast(message)
    } catch {
      showToast('Couldn’t update the form. Please try again.')
    }
  }

  async function makeCopy() {
    try {
      const id = await createForm(user.uid, {
        title: `Copy of ${draft.title || 'Untitled form'}`,
        description: draft.description,
        settings: draft.settings,
        // Fresh ids so the copy's answers never mix with the original's.
        questions: draft.questions.map((q) => ({ ...q, id: crypto.randomUUID() })),
      })
      navigate(`/forms/${id}/edit`)
    } catch {
      showToast('Couldn’t copy the form. Please try again.')
    }
  }

  async function onConfirm() {
    setBusy(true)
    try {
      if (confirm === 'delete') {
        await deleteForm(form.id)
        navigate('/')
        return
      }
      await setStatus('draft')
      showToast('Form unpublished')
    } catch {
      showToast('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  const statusItems =
    form.status === 'published'
      ? [
          {
            label: 'Stop accepting responses',
            onSelect: () => changeStatus('closed', 'No longer accepting responses'),
          },
          { label: 'Unpublish', danger: true, onSelect: () => setConfirm('unpublish') },
        ]
      : [
          {
            label: 'Accept responses again',
            onSelect: () => changeStatus('published', 'Accepting responses'),
          },
          { label: 'Unpublish', danger: true, onSelect: () => setConfirm('unpublish') },
        ]

  const moreItems = [
    { label: 'Preview', icon: Eye, onSelect: () => window.open(link, '_blank', 'noopener') },
    { label: 'Copy link', icon: Link2, onSelect: copyLink },
    { label: 'Collaborators', icon: UserPlus, onSelect: () => setCollabOpen(true) },
    { label: 'Make a copy', icon: Copy, onSelect: makeCopy },
  ]
  if (isOwner) {
    moreItems.push({
      label: 'Delete form',
      icon: Trash2,
      danger: true,
      onSelect: () => setConfirm('delete'),
    })
  }

  return (
    <>
      <div className="builder-actions">
        <button
          type="button"
          className="icon-btn desktop-only"
          onClick={undo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={18} />
        </button>
        <button
          type="button"
          className="icon-btn desktop-only"
          onClick={redo}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 size={18} />
        </button>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="icon-btn desktop-only"
          aria-label="Preview"
          title="Preview"
        >
          <Eye size={18} />
        </a>
        <button
          type="button"
          className="icon-btn desktop-only"
          onClick={copyLink}
          aria-label="Copy link"
          title="Copy link"
        >
          <Link2 size={18} />
        </button>
        <button
          type="button"
          className="icon-btn desktop-only"
          onClick={() => setCollabOpen(true)}
          aria-label="Collaborators"
          title="Collaborators"
        >
          <UserPlus size={18} />
        </button>

        {form.status === 'draft' ? (
          <button
            type="button"
            className="btn btn-primary publish-btn"
            onClick={() => changeStatus('published', 'Form published')}
          >
            Publish
          </button>
        ) : (
          <StatusMenu status={form.status} items={statusItems} />
        )}

        <MenuButton icon={<MoreVertical size={18} />} label="More" items={moreItems} />
      </div>

      <ConfirmModal
        open={Boolean(confirm)}
        title={
          confirm === 'delete'
            ? `Delete “${draft.title || 'Untitled form'}”?`
            : 'Unpublish this form?'
        }
        message={
          confirm === 'delete'
            ? 'This permanently deletes the form and all of its responses. This can’t be undone.'
            : 'The link will stop working and nobody will be able to see or answer the form until you publish it again. Existing responses are kept.'
        }
        confirmLabel={confirm === 'delete' ? 'Delete' : 'Unpublish'}
        busy={busy}
        onConfirm={onConfirm}
        onCancel={() => setConfirm(null)}
      />
      <CollaboratorsDialog
        formId={form.id}
        open={collabOpen}
        onClose={() => setCollabOpen(false)}
        showToast={showToast}
      />
      {toast}
    </>
  )
}

// "Published ▾" / "Closed ▾" pill that opens the status options.
function StatusMenu({ status, items }) {
  return (
    <MenuButton
      className="status-menu"
      label={status === 'published' ? 'Published — change status' : 'Closed — change status'}
      icon={
        <span className={`status-pill status-pill-${status}`}>
          {status === 'published' ? 'Published' : 'Closed'}
          <ChevronDown size={14} />
        </span>
      }
      items={items}
    />
  )
}
