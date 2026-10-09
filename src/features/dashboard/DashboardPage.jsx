import { useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { ArrowDownAZ, Filter, LayoutGrid, List, Plus, Upload } from 'lucide-react'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import MenuButton from '../../lib/MenuButton.jsx'
import { useToast } from '../../lib/useToast.jsx'
import { useAuth } from '../auth/useAuth.js'
import FormCard from './FormCard.jsx'
import FormThumbnail from './FormThumbnail.jsx'
import { createForm, deleteForm, parseImportFile } from './formActions.js'
import { TEMPLATES } from './templates.js'
import { useMyForms } from './useMyForms.js'
import './DashboardPage.css'

const VIEW_KEY = 'peraform-dashboard-view'

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

// Template previews are rendered from one build so they stay stable.
const TEMPLATE_PREVIEWS = TEMPLATES.map((t) => ({ ...t, preview: t.build() }))

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
  const [actionError, setActionError] = useState('')
  const [toast, showToast] = useToast()
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const fileRef = useRef(null)

  const visible = useMemo(() => {
    const list = forms.filter(
      (f) => FILTERS[filter].test(f, user.uid) && (f.title || '').toLowerCase().includes(search),
    )
    const compare = SORTS[sort].compare
    return compare ? [...list].sort(compare) : list
  }, [forms, filter, sort, search, user.uid])

  function toggleView() {
    const next = view === 'grid' ? 'list' : 'grid'
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // Storage blocked — the view just won't be remembered.
    }
  }

  async function startForm(getContent) {
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
      <section className="dash-start" aria-label="Start a new form">
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

        {TEMPLATE_PREVIEWS.map((t) => (
          <button
            key={t.key}
            type="button"
            className="start-card"
            onClick={() => startForm(t.build)}
            disabled={creating}
          >
            <span className="start-visual">
              <FormThumbnail title={t.preview.title} questions={t.preview.questions} />
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

      {toast}
    </div>
  )
}
