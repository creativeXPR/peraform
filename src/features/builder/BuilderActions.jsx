import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  Code2,
  Copy,
  Download,
  Eye,
  Keyboard,
  Link2,
  ListChecks,
  MoreVertical,
  Palette,
  Printer,
  Redo2,
  Sparkles,
  Trash2,
  Undo2,
  UserPlus,
} from 'lucide-react'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import MenuButton from '../../lib/MenuButton.jsx'
import { useToast } from '../../lib/useToast.jsx'
import { useAuth } from '../auth/useAuth.js'
import { createImportedForm, deleteForm } from '../dashboard/formActions.js'
import { fileName, fileToForm, formToFile } from '../../lib/formFile.js'
import EditFormDialog from '../ai/EditFormDialog.jsx'
import EmbedDialog from './EmbedDialog.jsx'
import ShareDialog from './ShareDialog.jsx'
import ShortcutsDialog from './ShortcutsDialog.jsx'
import ThemePanel from './ThemePanel.jsx'
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
  const [themeOpen, setThemeOpen] = useState(false)
  const [embedOpen, setEmbedOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const isOwner = form.ownerId === user.uid
  const link = `${window.location.origin}/f/${form.id}`

  // A one-off note from the page that sent us here (e.g. "Made with AI ·
  // used 6 credits"), shown once and then cleared from history.
  const location = useLocation()
  const notice = location.state?.notice
  useEffect(() => {
    if (!notice) return
    showToast(notice)
    navigate(location.pathname, { replace: true, state: null })
  }, [notice, showToast, navigate, location.pathname])

  useEffect(() => {
    const onKey = (e) => {
      // Ctrl + / : the shortcuts sheet (works anywhere in the editor).
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        setShortcutsOpen(true)
        return
      }
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

  // A full copy — theme, answer key and screen designs too — through the
  // same path as a downloaded file, so every id is fresh and every
  // reference follows (lib/formFile.js).
  async function makeCopy() {
    try {
      const { content, answerKey } = fileToForm(formToFile(draft))
      const id = await createImportedForm(user.uid, {
        content: { ...content, title: `Copy of ${draft.title || 'Untitled form'}` },
        answerKey,
      })
      navigate(`/forms/${id}/edit`)
    } catch {
      showToast('Couldn’t copy the form. Please try again.')
    }
  }

  // The whole form as a file on this computer (Dashboard → Import opens it).
  function downloadFile() {
    const blob = new Blob([JSON.stringify(formToFile(draft), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName(draft.title)
    a.click()
    URL.revokeObjectURL(url)
    showToast('Saved to your downloads')
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
    { label: 'Share', icon: UserPlus, onSelect: () => setCollabOpen(true) },
    { label: 'Theme', icon: Palette, onSelect: () => setThemeOpen(true) },
    { label: 'Edit with AI', icon: Sparkles, onSelect: () => setAiOpen(true) },
    { label: 'Make a copy', icon: Copy, onSelect: makeCopy },
    { label: 'Download as PeraForm file', icon: Download, onSelect: downloadFile },
    {
      label: 'Get pre-filled link',
      icon: ListChecks,
      onSelect: () => window.open(`${link}?mode=prefill`, '_blank', 'noopener'),
    },
    { label: 'Embed HTML', icon: Code2, onSelect: () => setEmbedOpen(true) },
    { label: 'Print', icon: Printer, onSelect: () => window.open(`${link}?print=1`, '_blank', 'noopener') },
    { label: 'Keyboard shortcuts', icon: Keyboard, onSelect: () => setShortcutsOpen(true) },
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
          className="icon-btn desktop-only builder-ai"
          onClick={() => setAiOpen(true)}
          aria-label="Edit with AI"
          title="Edit with AI"
        >
          <Sparkles size={18} />
        </button>
        <button
          type="button"
          className="icon-btn desktop-only"
          onClick={() => setThemeOpen(true)}
          aria-label="Theme"
          title="Theme"
        >
          <Palette size={18} />
        </button>
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
          aria-label="Share"
          title="Share"
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

        {/* Phones: the top bar has no room for Undo/Redo, so they float at
            the bottom-left (opposite the add toolbar), once there's
            something to undo or redo. */}
        {(canUndo || canRedo) && (
          <div className="mobile-undo" role="group" aria-label="Undo and redo">
            <button type="button" className="icon-btn" onClick={undo} disabled={!canUndo} aria-label="Undo">
              <Undo2 size={20} />
            </button>
            <button type="button" className="icon-btn" onClick={redo} disabled={!canRedo} aria-label="Redo">
              <Redo2 size={20} />
            </button>
          </div>
        )}
      </div>

      <EmbedDialog open={embedOpen} link={link} onClose={() => setEmbedOpen(false)} showToast={showToast} />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <EditFormDialog open={aiOpen} onClose={() => setAiOpen(false)} />

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
      <ThemePanel open={themeOpen} onClose={() => setThemeOpen(false)} />
      <ShareDialog
        formId={form.id}
        open={collabOpen}
        onClose={() => setCollabOpen(false)}
        showToast={showToast}
        onPublish={() => changeStatus('published', 'Form published')}
        onCopyLink={copyLink}
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
