import { useEffect, useRef, useState } from 'react'
import { Bookmark, ClipboardPaste, Copy, FileText, LayoutTemplate, Link2, ListChecks, Pencil, Trash2, X } from 'lucide-react'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import { KEEP_KINDS, keepSummary, keepText, readPayload, visibleHere } from '../../lib/keep.js'
import { TYPE_INFO } from '../builder/questionTypes.js'
import { useKeep } from './keepContext.js'
import { deleteKeep, renameKeep, saveKeep, watchKeeps } from './keepStore.js'
import './keep.css'
import Spinner from '../../lib/Spinner.jsx'

const ICONS = { field: ListChecks, block: LayoutTemplate, text: FileText, link: Link2 }
const typeLabel = (t) => TYPE_INFO[t]?.label ?? { section: 'Section', text: 'Title and description', image: 'Image', video: 'Video' }[t] ?? t

// Which page target pastes this kind (keepContext.js → useKeepTargets).
const targetFor = (targets, kind) => (kind === 'text' || kind === 'link' ? targets?.text : targets?.[kind])

// The Keep: everything you kept, by kind, with Paste (where this page can
// take it), Copy (text and links), Rename and Delete. Kept items from
// other Quality Tools apps only show here when this app can use them.
export default function KeepDialog({ open, onClose, uid }) {
  const ref = useRef(null)
  const { targetsRef, showToast } = useKeep()
  const [items, setItems] = useState(null) // null = loading
  const [error, setError] = useState('')
  const [tab, setTab] = useState('all')
  const [draft, setDraft] = useState('')
  const [renaming, setRenaming] = useState(null) // { id, label }
  const [removing, setRemoving] = useState(null) // item
  const [targets, setTargets] = useState(null)

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Listen while open (the list stays fresh across apps and tabs).
  useEffect(() => {
    if (!open) return
    return watchKeeps(
      uid,
      (list) => {
        setItems(list.filter(visibleHere))
        setError('')
      },
      () => setError('Couldn’t load your Keep. Check your connection.'),
    )
  }, [open, uid])

  // What this page can take, read each time the Keep opens.
  useEffect(() => {
    if (open) setTargets(targetsRef.current)
  }, [open, targetsRef])

  const kinds = Object.keys(KEEP_KINDS)
  const shown = (items ?? []).filter((i) => tab === 'all' || i.kind === tab)

  async function addText(e) {
    e.preventDefault()
    const item = keepText(draft)
    if (!item) return
    try {
      await saveKeep(uid, item)
      setDraft('')
    } catch {
      setError('Couldn’t keep that. Try again.')
    }
  }

  function paste(item) {
    const target = targetFor(targets, item.kind)
    const data = readPayload(item)
    if (!target || !data) return
    target(data, item.kind)
    onClose()
    showToast(`Pasted “${item.label}”`)
  }

  async function copy(item) {
    const data = readPayload(item)
    try {
      await navigator.clipboard.writeText(data?.url ?? data?.text ?? '')
      showToast('Copied')
    } catch {
      showToast('Couldn’t copy. Select the text and copy it instead.')
    }
  }

  return (
    <dialog
      ref={ref}
      className="confirm keep-dialog"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="confirm-body">
        <div className="collab-head">
          <h2>
            <Bookmark size={18} /> Keep
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className="keep-intro">
          Things you keep, to paste later. Text and links work in every Quality Tools app; form fields and design
          blocks are PeraForm’s.
        </p>

        <form className="keep-add" onSubmit={addText}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            maxLength={20000}
            placeholder="Keep some text or a link…"
            aria-label="Text or link to keep"
          />
          <button type="submit" className="btn btn-outline" disabled={!draft.trim()}>
            Keep it
          </button>
        </form>

        <div className="keep-tabs" role="tablist" aria-label="Kinds">
          {['all', ...kinds].map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              className={tab === k ? 'active' : ''}
              onClick={() => setTab(k)}
            >
              {k === 'all' ? 'All' : KEEP_KINDS[k].label}
              <span className="keep-count">{(items ?? []).filter((i) => k === 'all' || i.kind === k).length}</span>
            </button>
          ))}
        </div>
        {tab !== 'all' && <p className="keep-where">{KEEP_KINDS[tab].where}</p>}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <ul className="keep-list">
          {items === null && !error && <li><Spinner fill="box" label="Loading your Keep" /></li>}
          {items !== null && !shown.length && (
            <li className="keep-empty">
              Nothing kept here yet. Use <Bookmark size={13} aria-hidden="true" /> Keep on a question card or a design
              block, or keep some text above.
            </li>
          )}
          {shown.map((item) => {
            const Icon = ICONS[item.kind] ?? FileText
            const target = targetFor(targets, item.kind)
            return (
              <li key={item.id} className="keep-item">
                <Icon size={18} className="keep-icon" aria-hidden="true" />
                <div className="keep-main">
                  {renaming?.id === item.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        if (renaming.label.trim()) renameKeep(uid, item.id, renaming.label.trim()).catch(() => {})
                        setRenaming(null)
                      }}
                    >
                      <input
                        autoFocus
                        value={renaming.label}
                        maxLength={200}
                        onChange={(e) => setRenaming({ ...renaming, label: e.target.value })}
                        onBlur={(e) => e.currentTarget.form.requestSubmit()}
                        aria-label="Name"
                      />
                    </form>
                  ) : (
                    <strong>{item.label}</strong>
                  )}
                  <span className="keep-sub">
                    {KEEP_KINDS[item.kind]?.label ?? item.kind} · {keepSummary(item, typeLabel)}
                  </span>
                </div>
                <div className="keep-actions">
                  <button
                    type="button"
                    className="btn btn-outline keep-paste"
                    onClick={() => paste(item)}
                    disabled={!target}
                    title={target ? 'Paste it here' : KEEP_KINDS[item.kind]?.where}
                  >
                    <ClipboardPaste size={15} /> Paste
                  </button>
                  {(item.kind === 'text' || item.kind === 'link') && (
                    <button type="button" className="icon-btn" onClick={() => copy(item)} aria-label="Copy" title="Copy">
                      <Copy size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setRenaming({ id: item.id, label: item.label })}
                    aria-label="Rename"
                    title="Rename"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setRemoving(item)}
                    aria-label="Delete"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <ConfirmModal
        open={Boolean(removing)}
        title={`Delete “${removing?.label ?? ''}” from your Keep?`}
        message="It’s gone from every Quality Tools app. Anything you already pasted stays."
        confirmLabel="Delete"
        onConfirm={() => {
          deleteKeep(uid, removing.id).catch(() => setError('Couldn’t delete it. Try again.'))
          setRemoving(null)
        }}
        onCancel={() => setRemoving(null)}
      />
    </dialog>
  )
}
