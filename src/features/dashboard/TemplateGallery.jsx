import { useMemo } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import FormThumbnail from './FormThumbnail.jsx'
import { saveRecentTemplateKey, TEMPLATES, useRecentTemplateKeys } from './templates.js'
import './TemplateGallery.css'

const CATEGORIES = [
  { id: 'personal', title: 'Personal' },
  { id: 'work', title: 'Work' },
  { id: 'education', title: 'Education' },
]

export default function TemplateGallery({ open, onClose, onSelect, creating, uid }) {
  const recentKeys = useRecentTemplateKeys(uid)

  // Stable previews for thumbnails
  const previewsByKey = useMemo(() => {
    const map = new Map()
    for (const t of TEMPLATES) {
      map.set(t.key, { ...t, preview: t.build() })
    }
    return map
  }, [])

  const recents = useMemo(() => {
    return recentKeys
      .map((k) => previewsByKey.get(k))
      .filter(Boolean)
  }, [recentKeys, previewsByKey])

  if (!open) return null

  function handlePick(template) {
    saveRecentTemplateKey(template.key, uid)
    onSelect(template.build, template.key)
  }

  return (
    <div className="gallery-overlay" role="dialog" aria-modal="true" aria-label="Template gallery">
      <div className="gallery-sheet">
        <header className="gallery-head">
          <div className="gallery-head-left">
            <button
              type="button"
              className="icon-btn gallery-back"
              onClick={onClose}
              aria-label="Back to dashboard"
            >
              <ArrowLeft size={20} />
            </button>
            <h1>Template gallery</h1>
          </div>
          <button
            type="button"
            className="icon-btn gallery-close"
            onClick={onClose}
            aria-label="Close template gallery"
          >
            <X size={20} />
          </button>
        </header>

        <div className="gallery-body">
          {recents.length > 0 && (
            <section className="gallery-section" aria-labelledby="cat-recent">
              <h2 id="cat-recent" className="gallery-section-title">
                Recently used
              </h2>
              <div className="gallery-grid">
                {recents.map((t) => (
                  <button
                    key={`recent-${t.key}`}
                    type="button"
                    className="start-card gallery-card"
                    onClick={() => handlePick(t)}
                    disabled={creating}
                    aria-label={`Start with ${t.name} template`}
                  >
                    <span className="start-visual gallery-visual">
                      <FormThumbnail
                        title={t.preview.title}
                        questions={t.preview.questions}
                        theme={t.theme}
                      />
                    </span>
                    <span className="start-label">{t.name}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {CATEGORIES.map((cat) => {
            const items = TEMPLATES.filter((t) => t.category === cat.id).map((t) =>
              previewsByKey.get(t.key),
            )
            return (
              <section
                key={cat.id}
                className="gallery-section"
                aria-labelledby={`cat-${cat.id}`}
              >
                <h2 id={`cat-${cat.id}`} className="gallery-section-title">
                  {cat.title}
                </h2>
                <div className="gallery-grid">
                  {items.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      className="start-card gallery-card"
                      onClick={() => handlePick(t)}
                      disabled={creating}
                      aria-label={`Start with ${t.name} template`}
                    >
                      <span className="start-visual gallery-visual">
                        <FormThumbnail
                          title={t.preview.title}
                          questions={t.preview.questions}
                          theme={t.theme}
                        />
                      </span>
                      <span className="start-label">{t.name}</span>
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
