import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import ColorPicker from '../../lib/ColorPicker.jsx'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import {
  THEME_BACKGROUNDS,
  THEME_COLORS,
  THEME_FONTS,
  loadThemeFont,
  themeOf,
} from '../../lib/theme.js'
import { useTheme } from '../../lib/useTheme.js'
import { useFormEditor } from './editorContext.js'
import ImagePicker from './ImagePicker.jsx'

// "Theme" side panel (Google Forms' palette): header image, colour,
// background and font. Changes go through the editor, so they autosave and
// undo like any other edit, and the builder canvas previews them live.
export default function ThemePanel({ open, onClose }) {
  const ref = useRef(null)
  const { draft, edit } = useFormEditor()
  const { theme: mode } = useTheme()
  const [removingHeader, setRemovingHeader] = useState(false)
  const theme = themeOf(draft)

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Show each font option in its own face.
  useEffect(() => {
    if (open) Object.keys(THEME_FONTS).forEach(loadThemeFont)
  }, [open])

  const set = (key, value) =>
    edit(`theme:${key}`, (d) => ({ ...d, theme: { ...themeOf(d), [key]: value } }))

  return (
    <dialog
      ref={ref}
      className="theme-panel"
      aria-label="Theme"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="theme-body">
        <div className="collab-head">
          <h2>Theme</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <section className="theme-group">
          <h3>Header</h3>
          {theme.headerImage ? (
            <div className="theme-header-preview">
              <img src={theme.headerImage.url} alt="" />
              <div className="theme-header-actions">
                <ImagePicker variant="button" label="Change image" onPicked={(img) => set('headerImage', img)} />
                <button type="button" className="link-btn" onClick={() => setRemovingHeader(true)}>
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <ImagePicker variant="button" label="Choose header image" onPicked={(img) => set('headerImage', img)} />
          )}
          <p className="key-note">Wide images work best, around 1600 × 400.</p>
        </section>

        <section className="theme-group">
          <h3>Colour</h3>
          <ColorPicker
            value={theme.color}
            presets={Object.entries(THEME_COLORS).map(([key, c]) => ({
              value: key,
              label: c.label,
              swatch: mode === 'dark' ? c.dark : c.light,
            }))}
            onChange={(color) => set('color', color)}
          />
          {!THEME_COLORS[theme.color] && (
            <p className="key-note">
              Custom colours are adjusted slightly where needed so button text stays readable.
            </p>
          )}
        </section>

        <section className="theme-group">
          <h3>Background</h3>
          <div className="segmented" role="radiogroup" aria-label="Background">
            {Object.entries(THEME_BACKGROUNDS).map(([key, { label }]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={theme.background === key}
                className={theme.background === key ? 'active' : ''}
                onClick={() => set('background', key)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="theme-group">
          <h3>Font</h3>
          <div className="theme-fonts" role="radiogroup" aria-label="Font">
            {Object.entries(THEME_FONTS).map(([key, f]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={theme.font === key}
                className={`theme-font${theme.font === key ? ' active' : ''}`}
                style={{ fontFamily: f.family }}
                onClick={() => set('font', key)}
              >
                <span className="theme-font-sample">Aa</span>
                <span>{f.label}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <ConfirmModal
        open={removingHeader}
        title="Remove the header image?"
        message="You can undo this right after."
        confirmLabel="Remove"
        onConfirm={() => {
          set('headerImage', null)
          setRemovingHeader(false)
        }}
        onCancel={() => setRemovingHeader(false)}
      />
    </dialog>
  )
}
