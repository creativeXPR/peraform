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
import HeaderPickerDialog from './HeaderPickerDialog.jsx'
import HeaderBanner from '../../lib/HeaderBanner.jsx'
import { headerOf } from '../../lib/header.js'
import Select from '../../lib/Select.jsx'

// Overlay colours for the header (any custom colour works too).
const OVERLAY_PRESETS = [
  { value: '#000000', label: 'Black', swatch: '#000000' },
  { value: '#ffffff', label: 'White', swatch: '#ffffff' },
  { value: '#0b1f4d', label: 'Deep navy', swatch: '#0b1f4d' },
  { value: '#0f3d2e', label: 'Deep green', swatch: '#0f3d2e' },
  { value: '#3b0764', label: 'Deep purple', swatch: '#3b0764' },
]

// "Theme" side panel (Google Forms' palette): header image, colour,
// background and font. Changes go through the editor, so they autosave and
// undo like any other edit, and the builder canvas previews them live.
export default function ThemePanel({ open, onClose }) {
  const ref = useRef(null)
  const { draft, edit } = useFormEditor()
  const { theme: mode } = useTheme()
  const [removingHeader, setRemovingHeader] = useState(false)
  const [removingLogo, setRemovingLogo] = useState(false)
  const [picking, setPicking] = useState(false) // Select header
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
  // Overlay, logo and text on the header image (lib/HeaderBanner.jsx).
  const header = headerOf(theme)
  const setHeader = (patch) =>
    edit(`theme:header:${Object.keys(patch).join()}`, (d) => {
      const t = themeOf(d)
      return { ...d, theme: { ...t, header: { ...headerOf(t), ...patch } } }
    })

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
              <HeaderBanner theme={theme} />
              <div className="theme-header-actions">
                <button type="button" className="btn btn-outline" onClick={() => setPicking(true)}>
                  Change image
                </button>
                <button type="button" className="link-btn" onClick={() => setRemovingHeader(true)}>
                  Remove
                </button>
              </div>

              <div className="theme-header-layers">
                <span className="theme-sub">Overlay</span>
                <div className="theme-overlay">
                  <ColorPicker
                    value={header.overlay}
                    presets={OVERLAY_PRESETS}
                    onChange={(overlay) => setHeader({ overlay })}
                    label="Overlay colour"
                  />
                  <label className="theme-range">
                    <input
                      type="range"
                      min="0"
                      max="90"
                      step="5"
                      value={header.overlayOpacity}
                      onChange={(e) => setHeader({ overlayOpacity: Number(e.target.value) })}
                      aria-label="Overlay strength"
                    />
                    <span>{header.overlayOpacity}%</span>
                  </label>
                </div>

                <span className="theme-sub">Logo</span>
                {header.logo ? (
                  <div className="theme-logo">
                    <img src={header.logo.url} alt="" />
                    <ImagePicker variant="button" label="Change" onPicked={(img) => setHeader({ logo: img })} />
                    <button type="button" className="link-btn" onClick={() => setRemovingLogo(true)}>
                      Remove
                    </button>
                  </div>
                ) : (
                  <ImagePicker variant="button" label="Add a logo" onPicked={(img) => setHeader({ logo: img })} />
                )}

                <span className="theme-sub">Text on the header</span>
                <input
                  className="theme-text"
                  value={header.title}
                  maxLength={120}
                  onChange={(e) => setHeader({ title: e.target.value })}
                  placeholder="Title, e.g. University of Ibadan"
                  aria-label="Header title"
                />
                <input
                  className="theme-text"
                  value={header.subtitle}
                  maxLength={200}
                  onChange={(e) => setHeader({ subtitle: e.target.value })}
                  placeholder="Subtitle or tagline (optional)"
                  aria-label="Header subtitle"
                />

                <div className="theme-header-row">
                  <label className="theme-field">
                    <span className="theme-sub">Position</span>
                    <Select value={header.align} onChange={(e) => setHeader({ align: e.target.value })} aria-label="Text position">
                      <option value="center">Centre</option>
                      <option value="left">Left</option>
                    </Select>
                  </label>
                  <label className="theme-field">
                    <span className="theme-sub">Height</span>
                    <Select value={header.height} onChange={(e) => setHeader({ height: e.target.value })} aria-label="Header height">
                      <option value="short">Short</option>
                      <option value="medium">Medium</option>
                      <option value="tall">Tall</option>
                    </Select>
                  </label>
                </div>
                <p className="key-note">A darker overlay makes white text and logos easier to read.</p>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-outline" onClick={() => setPicking(true)}>
              Choose header image
            </button>
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

      <HeaderPickerDialog open={picking} onClose={() => setPicking(false)} onPicked={(img) => set('headerImage', img)} />

      <ConfirmModal
        open={removingLogo}
        title="Remove the logo?"
        message="You can undo this right after."
        confirmLabel="Remove"
        onConfirm={() => {
          setHeader({ logo: null })
          setRemovingLogo(false)
        }}
        onCancel={() => setRemovingLogo(false)}
      />

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
