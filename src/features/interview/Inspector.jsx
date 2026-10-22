import { ArrowDownToLine, ArrowUpToLine, Copy, Eye, EyeOff, Trash2 } from 'lucide-react'
import ColorPicker from '../../lib/ColorPicker.jsx'
import { youtubeId } from '../../lib/formModel.js'
import { BUTTON_ACTIONS, COLOR_TOKENS, DEVICES, NODE_TYPES, frameOf } from '../../lib/interview.js'
import { THEME_FONTS } from '../../lib/theme.js'
import ImagePicker from '../builder/ImagePicker.jsx'
import { triggerKindFor } from '../../lib/actions.js'
import ActionsEditor from './ActionsEditor.jsx'

// Colour choices on the canvas: transparent, the theme's own colours (so the
// design follows theme changes), black and white — plus any custom colour.
const COLOR_PRESETS = [
  { value: 'transparent', label: 'Transparent', swatch: 'transparent' },
  ...Object.entries(COLOR_TOKENS).map(([value, t]) => ({ value, label: t.label, swatch: t.css })),
  { value: '#ffffff', label: 'White', swatch: '#ffffff' },
  { value: '#000000', label: 'Black', swatch: '#000000' },
]

function NumberField({ label, value, onChange, min, max, step = 1, suffix }) {
  return (
    <label className="insp-num">
      <span>{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : ''}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          if (e.target.value === '') return
          let v = Number(e.target.value)
          if (min !== undefined) v = Math.max(min, v)
          if (max !== undefined) v = Math.min(max, v)
          onChange(v)
        }}
      />
      {suffix && <em>{suffix}</em>}
    </label>
  )
}

function Group({ title, children }) {
  return (
    <section className="insp-group">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

const hasText = (type) => ['text', 'button', 'question', 'card'].includes(type)

// The menu for the selected block: where it sits (on this device), how it
// looks, and what it holds.
export default function Inspector({
  node,
  device,
  screens,
  pageQuestions,
  questions,
  actionTargets, // [{ id, label }] other blocks on this screen
  onFrame,
  onStyle,
  onContent,
  onDuplicate,
  onDelete,
  onLevel,
}) {
  const f = frameOf(node, device)
  const s = node.style ?? {}
  const type = NODE_TYPES[node.type].label
  const otherDevice = device === 'phone' ? 'desktop' : 'phone'
  // Question blocks react to answers: choosing an option, or matching text.
  const question = node.type === 'question' ? questions.find((q) => q.id === node.questionId) : null
  const trigger = triggerKindFor(question)

  return (
    <div className="inspector">
      <div className="insp-head">
        <strong>{type}</strong>
        <div className="insp-tools">
          <button type="button" className="icon-btn" onClick={() => onLevel(1)} title="Bring forward" aria-label="Bring forward">
            <ArrowUpToLine size={16} />
          </button>
          <button type="button" className="icon-btn" onClick={() => onLevel(-1)} title="Send backward" aria-label="Send backward">
            <ArrowDownToLine size={16} />
          </button>
          <button type="button" className="icon-btn" onClick={onDuplicate} title="Duplicate" aria-label="Duplicate">
            <Copy size={16} />
          </button>
          <button type="button" className="icon-btn insp-danger" onClick={onDelete} title="Delete" aria-label="Delete">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <Group title={`Position · ${DEVICES[device].label}`}>
        <div className="insp-grid">
          <NumberField label="X" value={f.x} onChange={(x) => onFrame({ x })} />
          <NumberField label="Y" value={f.y} onChange={(y) => onFrame({ y })} />
          <NumberField label="W" value={f.w} min={16} onChange={(w) => onFrame({ w })} />
          <NumberField label="H" value={f.h} min={16} onChange={(h) => onFrame({ h })} />
          <NumberField label="Rotate" value={f.r || 0} min={-180} max={180} suffix="°" onChange={(r) => onFrame({ r })} />
          <NumberField label="Level" value={f.z || 0} min={0} max={99} onChange={(z) => onFrame({ z })} />
        </div>
        <button
          type="button"
          className={`insp-toggle${f.hidden ? '' : ' is-on'}`}
          aria-pressed={!f.hidden}
          onClick={() => onFrame({ hidden: !f.hidden })}
        >
          {f.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
          {f.hidden ? `Hidden on ${DEVICES[device].label.toLowerCase()}` : `Shown on ${DEVICES[device].label.toLowerCase()}`}
        </button>
        <p className="insp-note">
          Position, size and visibility are set per device — switch to {DEVICES[otherDevice].label} to
          lay it out there.
        </p>
      </Group>

      <Group title="Content">
        {node.type === 'text' && (
          <textarea
            className="insp-input"
            rows={3}
            value={node.text ?? ''}
            onChange={(e) => onContent({ text: e.target.value })}
            placeholder="Write something"
            aria-label="Text"
          />
        )}
        {node.type === 'button' && (
          <>
            <input
              className="insp-input"
              value={node.label ?? ''}
              onChange={(e) => onContent({ label: e.target.value })}
              placeholder="Button label"
              aria-label="Button label"
            />
            <label className="insp-field">
              <span>When clicked</span>
              <select
                value={node.action?.type ?? 'next'}
                onChange={(e) => onContent({ action: { type: e.target.value, screen: node.action?.screen ?? null } })}
              >
                {Object.entries(BUTTON_ACTIONS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {node.action?.type === 'goto' && (
              <label className="insp-field">
                <span>Screen</span>
                <select
                  value={node.action.screen ?? ''}
                  onChange={(e) => onContent({ action: { type: 'goto', screen: e.target.value } })}
                >
                  <option value="">Choose a screen</option>
                  {screens.map((sc) => (
                    <option key={sc.key} value={sc.key}>
                      {sc.index + 1}. {sc.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}
        {node.type === 'image' && (
          <>
            <ImagePicker
              variant="button"
              label={node.image ? 'Change image' : 'Choose image'}
              onPicked={(image) => onContent({ image })}
            />
            <input
              className="insp-input"
              value={node.alt ?? ''}
              onChange={(e) => onContent({ alt: e.target.value })}
              placeholder="Describe the image (for screen readers)"
              aria-label="Image description"
            />
          </>
        )}
        {node.type === 'video' && (
          <>
            <input
              className="insp-input"
              defaultValue={node.videoId ? `https://youtu.be/${node.videoId}` : ''}
              onBlur={(e) => {
                const id = youtubeId(e.target.value)
                if (id) onContent({ videoId: id })
              }}
              placeholder="YouTube link"
              aria-label="YouTube link"
            />
            <p className="insp-note">Paste a YouTube link, then click away.</p>
          </>
        )}
        {node.type === 'embed' && (
          <>
            <input
              className="insp-input"
              defaultValue={node.url ?? ''}
              onBlur={(e) => {
                const url = e.target.value.trim()
                if (/^https:\/\/\S+$/i.test(url)) onContent({ url })
              }}
              placeholder="https://…"
              aria-label="Web page address"
            />
            <p className="insp-note">
              Any https page that allows embedding (maps, slides, calendars…). Some sites block it.
            </p>
          </>
        )}
        {node.type === 'question' && (
          <label className="insp-field">
            <span>Question</span>
            <select value={node.questionId ?? ''} onChange={(e) => onContent({ questionId: e.target.value })}>
              {pageQuestions.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title || 'Untitled question'}
                </option>
              ))}
            </select>
          </label>
        )}
        {node.type === 'card' && (
          <label className="insp-check">
            <input
              type="checkbox"
              checked={Boolean(s.clip)}
              onChange={(e) => onStyle({ clip: e.target.checked })}
            />
            Clip contents to the card
          </label>
        )}
      </Group>

      {(node.type === 'button' || trigger) && (
        <Group title="Actions">
          <ActionsEditor
            actions={node.actions}
            onChange={(actions) => onContent({ actions })}
            trigger={node.type === 'button' ? 'click' : trigger}
            options={question?.options ?? []}
            targets={actionTargets}
            allowSet
            colorPresets={COLOR_PRESETS}
          />
        </Group>
      )}

      <Group title="Appearance">
        <span className="insp-label">Background</span>
        <ColorPicker
          value={s.bg ?? 'transparent'}
          presets={COLOR_PRESETS}
          onChange={(bg) => onStyle({ bg })}
          label="Background"
        />
        <div className="insp-grid">
          <NumberField label="Radius" value={s.radius ?? 0} min={0} max={999} onChange={(radius) => onStyle({ radius })} />
          {node.type !== 'card' && (
            <NumberField label="Padding" value={s.padding ?? 0} min={0} max={200} onChange={(padding) => onStyle({ padding })} />
          )}
          <NumberField
            label="Opacity"
            value={Math.round((s.opacity ?? 1) * 100)}
            min={0}
            max={100}
            suffix="%"
            onChange={(v) => onStyle({ opacity: v / 100 })}
          />
        </div>
      </Group>

      {hasText(node.type) && (
        <Group title="Text">
          <div className="insp-grid">
            <label className="insp-field">
              <span>Font</span>
              <select value={s.font ?? ''} onChange={(e) => onStyle({ font: e.target.value || null })}>
                <option value="">Theme font</option>
                {Object.entries(THEME_FONTS).map(([key, font]) => (
                  <option key={key} value={key}>
                    {font.label}
                  </option>
                ))}
              </select>
            </label>
            <NumberField label="Size" value={s.size ?? 16} min={8} max={200} onChange={(size) => onStyle({ size })} />
            <label className="insp-field">
              <span>Weight</span>
              <select value={s.weight ?? 400} onChange={(e) => onStyle({ weight: Number(e.target.value) })}>
                <option value={400}>Regular</option>
                <option value={500}>Medium</option>
                <option value={600}>Semibold</option>
                <option value={700}>Bold</option>
              </select>
            </label>
            <label className="insp-field">
              <span>Align</span>
              <select value={s.align ?? 'left'} onChange={(e) => onStyle({ align: e.target.value })}>
                <option value="left">Left</option>
                <option value="center">Centre</option>
                <option value="right">Right</option>
              </select>
            </label>
          </div>
          <span className="insp-label">Text colour</span>
          <ColorPicker
            value={s.color ?? 'text'}
            presets={COLOR_PRESETS.filter((p) => p.value !== 'transparent')}
            onChange={(color) => onStyle({ color })}
            label="Text colour"
          />
        </Group>
      )}
    </div>
  )
}
