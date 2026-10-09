import { Link } from 'react-router-dom'
import { BarChart3, FileText, Link2, MoreVertical, PencilLine, Trash2, Users } from 'lucide-react'
import MenuButton from '../../lib/MenuButton.jsx'
import { timeAgo } from '../../lib/timeAgo.js'
import FormThumbnail from './FormThumbnail.jsx'

const STATUS_LABELS = { draft: 'Draft', published: 'Published', closed: 'Closed' }

// One form in "Recent forms", as a grid card or a list row. The title link
// stretches over the whole card, so the menu button isn't nested in a link.
export default function FormCard({ form, uid, view, onOpen, onCopyLink, onDelete }) {
  const isOwner = form.ownerId === uid
  const shared = form.memberIds.length > 1

  const actions = [
    { label: 'Open', icon: PencilLine, onSelect: () => onOpen(form.id, 'edit') },
    { label: 'View responses', icon: BarChart3, onSelect: () => onOpen(form.id, 'responses') },
  ]
  if (form.status !== 'draft') {
    actions.push({ label: 'Copy link', icon: Link2, onSelect: () => onCopyLink(form.id) })
  }
  if (isOwner) {
    actions.push({ label: 'Delete', icon: Trash2, danger: true, onSelect: () => onDelete(form) })
  }

  const meta = (
    <>
      <span className={`status status-${form.status}`}>{STATUS_LABELS[form.status]}</span>
      {shared && <Users size={14} aria-label="Shared" />}
      <span>Edited {timeAgo(form.updatedAt)}</span>
    </>
  )

  if (view === 'list') {
    return (
      <div className="form-row">
        <FileText size={18} className="form-row-icon" />
        <Link to={`/forms/${form.id}/edit`} className="form-link form-row-title">
          {form.title || 'Untitled form'}
        </Link>
        <span className="form-row-owner">{isOwner ? 'me' : 'shared with me'}</span>
        <span className="form-meta">{meta}</span>
        <MenuButton icon={<MoreVertical size={18} />} label="Form actions" items={actions} />
      </div>
    )
  }

  return (
    <div className="form-card">
      <FormThumbnail title={form.title} questions={form.questions} />
      <div className="form-card-info">
        <div className="form-card-text">
          <Link to={`/forms/${form.id}/edit`} className="form-link form-card-title">
            {form.title || 'Untitled form'}
          </Link>
          <span className="form-meta">{meta}</span>
        </div>
        <MenuButton icon={<MoreVertical size={18} />} label="Form actions" items={actions} />
      </div>
    </div>
  )
}
