import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  ArrowDownAZ,
  ChevronRight,
  Filter,
  Folder,
  FolderPlus,
  LayoutGrid,
  List,
  MoreVertical,
  Plus,
  Sparkles,
  Star,
  Upload,
} from 'lucide-react'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import { callAcceptInvites } from '../../lib/firebase.js'
import {
  createFolder,
  deleteFolder,
  moveToFolder,
  renameFolder,
  setStarred,
  useOrganize,
} from '../../lib/organize.js'
import PromptDialog from '../../lib/PromptDialog.jsx'
import MoveDialog from './MoveDialog.jsx'
import MenuButton from '../../lib/MenuButton.jsx'
import { useToast } from '../../lib/useToast.jsx'
import GenerateFormDialog from '../ai/GenerateFormDialog.jsx'
import { resendVerification } from '../auth/authActions.js'
import { useAuth } from '../auth/useAuth.js'
import FormCard from './FormCard.jsx'
import FormThumbnail from './FormThumbnail.jsx'
import { createForm, deleteForm, parseImportFile } from './formActions.js'
import { saveRecentTemplateKey, TEMPLATES } from './templates.js'
import TemplateGallery from './TemplateGallery.jsx'
import { useMyForms } from './useMyForms.js'
import './DashboardPage.css'

const VIEW_KEY = 'peraform-dashboard-view'

// Users we've already checked for pending invites this session.
const invitesChecked = new Set()

const FILTERS = {
  anyone: { label: 'Owned by anyone', test: () => true },
  me: { label: 'Owned by me', test: (form, uid) => form.ownerId === uid },
  others: { label: 'Not owned by me', test: (form, uid) => form.ownerId !== uid },
}

const SORTS = {
  edited: { label: 'Last edited', compare: null }, // query order already
  title: {
    label: 'Title A–Z',
    compare: (a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }),
  },
}

// Starter templates shown in the 5-card row on the dashboard.
const STARTER_TEMPLATES = TEMPLATES.filter((t) => ['contact', 'rsvp'].includes(t.key)).map((t) => ({
  ...t,
  preview: t.build(),
}))

function readSavedView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { forms, loading, error } = useMyForms(user.uid)
  const navigate = useNavigate()
  const { search: rawSearch } = useOutletContext()
  const search = rawSearch.trim().toLowerCase()

  const [filter, setFilter] = useState('anyone')
  const [sort, setSort] = useState('edited')
  const [view, setView] = useState(readSavedView)
  const [creating, setCreating] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [actionError, setActionError] = useState('')
  const [toast, showToast] = useToast()
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const fileRef = useRef(null)
  // Where the list is looking: 'all', 'starred', or a folder id.
  const [place, setPlace] = useState('all')
  const { meta, folders } = useOrganize(user.uid)
  const [moving, setMoving] = useState(null) // form being moved
  const [naming, setNaming] = useState(null) // { kind: 'new' | 'rename', folder?, then? }
  const [deletingFolder, setDeletingFolder] = useState(null)
  const activeFolder = folders.find((f) => f.id === place)
  // A deleted folder that was being viewed falls back to "All forms".
  const where = place === 'all' || place === 'starred' || activeFolder ? place : 'all'
  const [verifySent, setVerifySent] = useState(false)
  // Email/password accounts must verify their address before invites to it
  // can be accepted; Google accounts are verified already.
  const needsVerify =
    !user.emailVerified && user.providerData.some((p) => p.providerId === 'password')

  // Forms shared with this email before the account existed join the list.
  useEffect(() => {
    if (invitesChecked.has(user.uid)) return
    invitesChecked.add(user.uid)
    ;(async () => {
      try {
        // Pick up a just-completed email verification.
        await user.reload()
        if (user.emailVerified) await user.getIdToken(true)
        const { data } = await callAcceptInvites()
        if (data.joined) {
          showToast(
            `You were added to ${data.joined} shared ${data.joined === 1 ? 'form' : 'forms'}`,
          )
        }
      } catch {
        // Not critical — invites stay pending and are retried next session.
      }
    })()
  }, [user, showToast])

  const visible = useMemo(() => {
    const list = forms.filter(
      (f) =>
        FILTERS[filter].test(f, user.uid) &&
        (f.title || '').toLowerCase().includes(search) &&
        (where === 'all' ||
          (where === 'starred' ? meta[f.id]?.starred : meta[f.id]?.folderId === where)),
    )
    const compare = SORTS[sort].compare
    return compare ? [...list].sort(compare) : list
  }, [forms, filter, sort, search, user.uid, where, meta])

  function toggleView() {
    const next = view === 'grid' ? 'list' : 'grid'
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // Storage blocked — the view just won't be remembered.
    }
  }

  async function startForm(getContent, templateKey) {
    if (templateKey) saveRecentTemplateKey(templateKey, user?.uid)
    setCreating(true)
    setActionError('')
    try {
      const id = await createForm(user.uid, await getContent())
      navigate(`/forms/${id}/edit`)
    } catch (err) {
      setActionError(err.message || 'Couldn’t create the form. Please try again.')
      setCreating(false)
    }
  }

  function handleImport(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // so picking the same file again still fires
    if (file) startForm(() => parseImportFile(file))
  }

  async function copyLink(formId) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/f/${formId}`)
      showToast('Link copied')
    } catch {
      showToast('Couldn’t copy the link')
    }
  }

  async function confirmDelete() {
    setDeleting(true)
    try {
      await deleteForm(pendingDelete.id)
      showToast('Form deleted')
      setPendingDelete(null)
    } catch {
      setActionError('Couldn’t delete the form. Please try again.')
      setPendingDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="dash">
      {needsVerify && (
        <p className="form-notice dash-verify" role="status">
          Verify your email ({user.email}) so collaborators can share forms with you.{' '}
          {verifySent ? (
            'Sent — check your inbox, then refresh this page.'
          ) : (
            <button
              type="button"
              className="link-btn"
              onClick={() => resendVerification().then(() => setVerifySent(true), () => {})}
            >
              Resend email
            </button>
          )}
        </p>
      )}
      <div className="dash-start-header">
        <span className="dash-start-title">Start a new form</span>
        <button
          type="button"
          className="link-btn dash-gallery-btn"
          onClick={() => setGalleryOpen(true)}
        >
          <span>Template gallery</span>
          <ChevronRight size={16} />
        </button>
      </div>
      <section className="dash-start" aria-label="Start a new form">
        <button
          type="button"
          className="start-card start-card-ai"
          onClick={() => setAiOpen(true)}
          disabled={creating}
        >
          <span className="start-visual start-visual-icon start-visual-ai">
            <Sparkles size={32} strokeWidth={1.5} />
          </span>
          <span className="start-label">Create with AI</span>
        </button>
        <button
          type="button"
          className="start-card"
          onClick={() => startForm(() => ({}))}
          disabled={creating}
        >
          <span className="start-visual start-visual-icon">
            <Plus size={36} strokeWidth={1.5} />
          </span>
          <span className="start-label">Blank form</span>
        </button>

        {STARTER_TEMPLATES.map((t) => (
          <button
            key={t.key}
            type="button"
            className="start-card"
            onClick={() => startForm(t.build, t.key)}
            disabled={creating}
          >
            <span className="start-visual">
              <FormThumbnail title={t.preview.title} questions={t.preview.questions} theme={t.theme} />
            </span>
            <span className="start-label">{t.name}</span>
          </button>
        ))}

        <button
          type="button"
          className="start-card"
          onClick={() => fileRef.current.click()}
          disabled={creating}
        >
          <span className="start-visual start-visual-icon">
            <Upload size={30} strokeWidth={1.5} />
          </span>
          <span className="start-label">Import</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={handleImport}
        />
      </section>

      <GenerateFormDialog open={aiOpen} onClose={() => setAiOpen(false)} />
      <TemplateGallery
        open={galleryOpen}
        uid={user?.uid}
        onClose={() => setGalleryOpen(false)}
        onSelect={(getContent, key) => {
          setGalleryOpen(false)
          startForm(getContent, key)
        }}
        creating={creating}
      />

      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}

      <section className="dash-recent">
        <header className="dash-recent-head">
          <h2>Recent forms</h2>
          <div className="dash-tools">
            <MenuButton
              icon={<Filter size={18} />}
              label={FILTERS[filter].label}
              items={Object.entries(FILTERS).map(([key, f]) => ({
                label: f.label,
                checked: key === filter,
                onSelect: () => setFilter(key),
              }))}
            />
            <MenuButton
              icon={<ArrowDownAZ size={18} />}
              label={`Sort: ${SORTS[sort].label}`}
              items={Object.entries(SORTS).map(([key, s]) => ({
                label: s.label,
                checked: key === sort,
                onSelect: () => setSort(key),
              }))}
            />
            <button
              type="button"
              className="icon-btn"
              onClick={toggleView}
              aria-label={view === 'grid' ? 'List view' : 'Grid view'}
              title={view === 'grid' ? 'List view' : 'Grid view'}
            >
              {view === 'grid' ? <List size={18} /> : <LayoutGrid size={18} />}
            </button>
          </div>
        </header>

        <nav className="places" aria-label="Show forms from">
          <button
            type="button"
            className={`place${where === 'all' ? ' on' : ''}`}
            onClick={() => setPlace('all')}
          >
            All forms
          </button>
          <button
            type="button"
            className={`place${where === 'starred' ? ' on' : ''}`}
            onClick={() => setPlace('starred')}
          >
            <Star size={14} /> Starred
          </button>
          {folders.map((f) => (
            <span key={f.id} className={`place-wrap${where === f.id ? ' on' : ''}`}>
              <button
                type="button"
                className={`place${where === f.id ? ' on' : ''}`}
                onClick={() => setPlace(f.id)}
              >
                <Folder size={14} /> {f.name}
              </button>
              {where === f.id && (
                <MenuButton
                  className="place-menu"
                  icon={<MoreVertical size={14} />}
                  label={`Folder ${f.name} options`}
                  items={[
                    { label: 'Rename', onSelect: () => setNaming({ kind: 'rename', folder: f }) },
                    { label: 'Delete folder', danger: true, onSelect: () => setDeletingFolder(f) },
                  ]}
                />
              )}
            </span>
          ))}
          <button type="button" className="place place-new" onClick={() => setNaming({ kind: 'new' })}>
            <FolderPlus size={14} /> New folder
          </button>
        </nav>

        {loading ? (
          <div className={`forms forms-${view}`} aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" />
            ))}
          </div>
        ) : error ? (
          <p className="form-error" role="alert">
            Couldn’t load your forms. Check your connection and refresh.
          </p>
        ) : visible.length === 0 ? (
          <p className="dash-empty">
            {forms.length === 0
              ? 'No forms yet. Start with a blank form or a template above.'
              : search
                ? `No forms match “${rawSearch.trim()}”.`
                : where === 'starred'
                ? 'No starred forms yet. Use the ☆ on a form to star it.'
                : activeFolder
                  ? 'This folder is empty. Use “Move to folder…” on a form to add it here.'
                  : 'No forms match this filter.'}
          </p>
        ) : (
          <div className={`forms forms-${view}`}>
            {visible.map((form) => (
              <FormCard
                key={form.id}
                form={form}
                uid={user.uid}
                view={view}
                onOpen={(id, page) => navigate(`/forms/${id}/${page}`)}
                onCopyLink={copyLink}
                onDelete={setPendingDelete}
                starred={Boolean(meta[form.id]?.starred)}
                onToggleStar={(id, on) => setStarred(user.uid, id, on).catch(() => {})}
                onMove={setMoving}
              />
            ))}
          </div>
        )}
      </section>

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title={`Delete “${pendingDelete?.title || 'Untitled form'}”?`}
        message="This permanently deletes the form and all of its responses. This can’t be undone."
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <MoveDialog
        form={moving}
        folders={folders}
        currentId={moving ? meta[moving.id]?.folderId : null}
        onClose={() => setMoving(null)}
        onNewFolder={() => setNaming({ kind: 'new', then: moving })}
        onMove={async (folderId, name) => {
          const form = moving
          setMoving(null)
          try {
            await moveToFolder(user.uid, form.id, folderId)
            showToast(folderId ? `Moved to ${name}` : 'Moved to My forms')
          } catch {
            showToast('Couldn’t move the form. Please try again.')
          }
        }}
      />

      <PromptDialog
        open={Boolean(naming)}
        title={naming?.kind === 'rename' ? 'Rename folder' : 'New folder'}
        label="Folder name"
        initial={naming?.folder?.name ?? ''}
        confirmLabel={naming?.kind === 'rename' ? 'Rename' : 'Create'}
        onCancel={() => setNaming(null)}
        onSubmit={async (name) => {
          const job = naming
          setNaming(null)
          try {
            if (job.kind === 'rename') {
              await renameFolder(user.uid, job.folder.id, name)
              return
            }
            const id = await createFolder(user.uid, name)
            if (job.then) {
              await moveToFolder(user.uid, job.then.id, id)
              setMoving(null)
              showToast(`Moved to ${name}`)
            } else {
              setPlace(id)
            }
          } catch {
            showToast('Couldn’t save the folder. Please try again.')
          }
        }}
      />

      <ConfirmModal
        open={Boolean(deletingFolder)}
        title={`Delete the folder “${deletingFolder?.name}”?`}
        message="The forms inside aren’t deleted — they move back to My forms."
        confirmLabel="Delete folder"
        onConfirm={async () => {
          const f = deletingFolder
          setDeletingFolder(null)
          setPlace('all')
          try {
            await deleteFolder(user.uid, f.id)
            showToast('Folder deleted')
          } catch {
            showToast('Couldn’t delete the folder. Please try again.')
          }
        }}
        onCancel={() => setDeletingFolder(null)}
      />
      {toast}
    </div>
  )
}
