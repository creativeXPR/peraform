import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDownToLine,
  ArrowUpToLine,
  BookmarkPlus,
  Copy,
  Eye,
  EyeOff,
  FolderInput,
  Info,
  Shrink,
  Sparkle,
  Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import ColorPicker from '../../lib/ColorPicker.jsx'
import { GRADIENT_PRESETS } from '../../lib/gradient.js'
import { youtubeId } from '../../lib/formModel.js'
import {
  BUTTON_ACTIONS,
  COLOR_TOKENS,
  DEVICES,
  GLASS,
  MIN_SIZE,
  NODE_TYPES,
  OVERFLOW,
  SHADOWS,
  embedSrc,
  frameOf,
  overflowOf,
} from '../../lib/interview.js'
import { THEME_FONTS } from '../../lib/theme.js'
import ImagePicker from '../builder/ImagePicker.jsx'
import { triggerKindFor } from '../../lib/actions.js'
import ActionsEditor from './ActionsEditor.jsx'
import AnimationsEditor from './AnimationsEditor.jsx'

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

const ALIGN = [
  ['left', AlignStartVertical, 'Align left edges'],
  ['center', AlignCenterVertical, 'Align centres (across)'],
  ['right', AlignEndVertical, 'Align right edges'],
  ['top', AlignStartHorizontal, 'Align top edges'],
  ['middle', AlignCenterHorizontal, 'Align middles (down)'],
  ['bottom', AlignEndHorizontal, 'Align bottom edges'],
]

// "Hidden until an action shows it": hidden on both devices, so a Show
// action (or an answer) is what brings it in.
function StartHidden({ node, onStartHidden }) {
  const both = DEVICES_LIST.every((d) => frameOf(node, d).hidden)
  return (
    <label className="insp-check">
      <input type="checkbox" checked={both} onChange={(e) => onStartHidden(e.target.checked)} />
      Hidden until an action shows it
    </label>
  )
}
const DEVICES_LIST = Object.keys(DEVICES)

// What each Overflow choice does with content that doesn't fit.
const OVERFLOW_HELP = {
  scroll: 'Scroll: it scrolls inside the block (a scrollbar shows only when needed)',
  hidden: 'Hidden: whatever doesn’t fit is cut off at the block’s edge',
  visible: 'Visible: it spills out past the block’s edge, over what’s around it',
}

// Why a size won't go lower, so it never looks broken: the smallest size,
// text or a question needing more room than its box (it scrolls inside
// the box; "Fit height" makes room), contents wider than the box, or
// blocks reaching past a card. Measured on the canvas after each change.
// Blocks never resize themselves: every fix is a button.
function SizeLimits({ node, frame, onFitHeight }) {
  const [notes, setNotes] = useState([]) // [{ text, fitH? }]
  const measure = () => {
    const el = document.querySelector(`.canvas-stage [data-node-id="${node.id}"]`)
    const out = []
    if (frame.w <= MIN_SIZE || frame.h <= MIN_SIZE) out.push({ text: `${MIN_SIZE}px is the smallest a block can be.` })
    const box = el?.querySelector(':scope > .stage-scroll')
    if (box && box.scrollHeight > box.clientHeight + 1) {
      const kind = node.type === 'text' ? 'text' : 'question'
      const needed = box.scrollHeight + (el.offsetHeight - box.clientHeight)
      out.push({
        text: `This ${kind} needs ${needed}px of height to show everything; at ${Math.round(frame.h)}px ${{ scroll: 'it scrolls inside its box', hidden: 'the rest is cut off', visible: 'the rest spills over what’s below' }[overflowOf(node)]}. ${kind === 'text' ? 'A smaller font, a wider block or' : 'A wider block or'} “Fit height” makes room (the blocks below move down).`,
        fitH: needed,
      })
    }
    if (el && node.type !== 'card' && el.scrollWidth > el.clientWidth + 1) {
      out.push({ text: `Its contents need about ${el.scrollWidth}px of width; narrower than that, they spill over.` })
    }
    if (el && node.type === 'card') {
      const inner = el.querySelector(':scope > .stage-card-inner')
      const past = [...(inner?.children ?? [])].some(
        (k) => k.dataset.nodeId && (k.offsetTop + k.offsetHeight > el.clientHeight + 1 || k.offsetLeft + k.offsetWidth > el.clientWidth + 1),
      )
      if (past) out.push({ text: 'Some blocks reach past this card’s edge. “Fit to blocks” below makes room for them.' })
    }
    const key = (list) => list.map((n) => n.text).join('|')
    setNotes((prev) => (key(prev) === key(out) ? prev : out))
  }
  // After each render, once the canvas has drawn the change (a card's note
  // also depends on the blocks inside it, so no dependency list).
  useEffect(() => {
    const raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  })
  if (!notes.length) return null
  return (
    <div className="insp-limits" role="status">
      {notes.map((n) => (
        <p key={n.text}>
          <Info size={14} aria-hidden="true" /> {n.text}
          {n.fitH && (
            <button
              type="button"
              className="link-btn insp-fit-h"
              onClick={() => onFitHeight(n.fitH)}
              title="Make room for it: the blocks below move down, the card grows"
            >
              Fit height
            </button>
          )}
        </p>
      ))}
    </div>
  )
}

// Cards: "Fit to blocks" — removes the extra space around what's inside,
// leaving `pad` px to each edge (remembered on the card), on this device.
function FitCard({ pad: saved, device, onFit }) {
  const [pad, setPad] = useState(saved)
  return (
    <div className="insp-fit">
      <NumberField label="Space" value={pad} min={0} max={200} suffix="px" onChange={setPad} />
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => onFit(pad)}
        title={`Shrink or grow the card to its blocks, ${pad}px from each edge (${DEVICES[device].label.toLowerCase()} design)`}
      >
        <Shrink size={15} /> Fit to blocks
      </button>
    </div>
  )
}

// The menu for the selected block: where it sits (on this device), how it
// looks, and what it holds. With several selected (multi = how many), it
// shows what can apply to all of them: alignment, visibility and looks;
// `node` is the last one picked, whose values are shown.
export default function Inspector({
  node,
  multi = 0,
  onAlign, // (how) — several selected
  onStartHidden, // (hidden) — on both devices
  onTargetVisibility, // (id, hidden) — another block, from an action
  device,
  screens,
  pageQuestions,
  questions,
  actionTargets, // [{ id, label }] other blocks on this screen
  onFrame,
  onStyle,
  onContent,
  onDuplicate,
  onKeep, // saves the block (and what's inside) to the Keep
  onMove, // opens "Move to…"
  onDelete,
  onLevel,
  onFit, // (pad) cards: hug the blocks inside, pad px from each edge
  onFitHeight, // (h) text/questions: this tall, blocks below move down
  onPreview, // (animation) plays it on the canvas
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
        <strong>{multi ? `${multi} blocks selected` : type}</strong>
        <div className="insp-tools">
          {!multi && (
            <>
              <button
                type="button"
                className="icon-btn"
                onClick={() => onLevel(1)}
                title="Bring forward"
                aria-label="Bring forward"
              >
                <ArrowUpToLine size={16} />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => onLevel(-1)}
                title="Send backward"
                aria-label="Send backward"
              >
                <ArrowDownToLine size={16} />
              </button>
            </>
          )}
          <button
            type="button"
            className="icon-btn"
            onClick={onDuplicate}
            title="Duplicate (Ctrl+D)"
            aria-label="Duplicate"
          >
            <Copy size={16} />
          </button>
          {!multi && (
            <button
              type="button"
              className="icon-btn"
              onClick={onKeep}
              title="Keep: save it to paste later, on any screen or form"
              aria-label="Keep (save it to paste later)"
            >
              <BookmarkPlus size={16} />
            </button>
          )}
          {!multi && (
            <button
              type="button"
              className="icon-btn"
              onClick={onMove}
              title="Move to another card or screen"
              aria-label="Move to…"
            >
              <FolderInput size={16} />
            </button>
          )}
          <button type="button" className="icon-btn insp-danger" onClick={onDelete} title="Delete" aria-label="Delete">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {multi > 0 && (
        <Group title={`Arrange · ${DEVICES[device].label}`}>
          <div className="insp-align">
            {ALIGN.map(([how, Icon, label]) => (
              <button
                key={how}
                type="button"
                className="icon-btn"
                onClick={() => onAlign(how)}
                title={label}
                aria-label={label}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
          <p className="insp-note">Aligns the blocks that share a card with the last one you picked.</p>
          <button
            type="button"
            className={`insp-toggle${f.hidden ? '' : ' is-on'}`}
            aria-pressed={!f.hidden}
            onClick={() => onFrame({ hidden: !f.hidden })}
          >
            {f.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
            {f.hidden
              ? `Hidden on ${DEVICES[device].label.toLowerCase()}`
              : `Shown on ${DEVICES[device].label.toLowerCase()}`}
          </button>
          <StartHidden node={node} onStartHidden={onStartHidden} />
        </Group>
      )}

      {!multi && (
        <Group title={`Position · ${DEVICES[device].label}`}>
          <div className="insp-grid">
            <NumberField label="X" value={f.x} onChange={(x) => onFrame({ x })} />
            <NumberField label="Y" value={f.y} onChange={(y) => onFrame({ y })} />
            <NumberField label="W" value={f.w} min={MIN_SIZE} onChange={(w) => onFrame({ w })} />
            <NumberField label="H" value={f.h} min={MIN_SIZE} onChange={(h) => onFrame({ h })} />
            <NumberField
              label="Rotate"
              value={f.r || 0}
              min={-180}
              max={180}
              suffix="°"
              onChange={(r) => onFrame({ r })}
            />
            <NumberField label="Level" value={f.z || 0} min={0} max={99} onChange={(z) => onFrame({ z })} />
          </div>
          <SizeLimits node={node} frame={f} onFitHeight={onFitHeight} />
          <button
            type="button"
            className={`insp-toggle${f.hidden ? '' : ' is-on'}`}
            aria-pressed={!f.hidden}
            onClick={() => onFrame({ hidden: !f.hidden })}
          >
            {f.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
            {f.hidden
              ? `Hidden on ${DEVICES[device].label.toLowerCase()}`
              : `Shown on ${DEVICES[device].label.toLowerCase()}`}
          </button>
          <StartHidden node={node} onStartHidden={onStartHidden} />
          <p className="insp-note">
            Position, size and visibility are set per device — switch to {DEVICES[otherDevice].label} to lay it out
            there. A hidden block gives its space back: the blocks below move up until it’s shown.
          </p>
        </Group>
      )}

      {!multi && (
        <>
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
                    onChange={(e) =>
                      onContent({ action: { type: e.target.value, screen: node.action?.screen ?? null } })
                    }
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
                <textarea
                  className="insp-input"
                  rows={3}
                  defaultValue={node.url ?? ''}
                  onBlur={(e) => {
                    const url = embedSrc(e.target.value)
                    if (url) onContent({ url })
                  }}
                  placeholder={'https://…  or  <iframe src="https://…"></iframe>'}
                  aria-label="Web page address or iframe embed code"
                />
                <p className="insp-note">
                  A web address, or the embed code a site gives you (“&lt;iframe …&gt;” from YouTube, Google Maps,
                  Slides, Canva, Calendly…). Any https page that allows embedding; some sites block it.
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
            {node.type === 'card' && <FitCard key={node.id} pad={s.fitPad ?? 16} device={device} onFit={onFit} />}
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
                onTargetVisibility={onTargetVisibility}
              />
            </Group>
          )}

          <Group title="Animations">
            <AnimationsEditor
              animations={node.animations}
              onChange={(animations) => onContent({ animations })}
              onPreview={onPreview}
              colorPresets={COLOR_PRESETS}
            />
          </Group>
        </>
      )}

      <Group title="Appearance">
        <span className="insp-label">Background</span>
        <ColorPicker
          value={s.bg ?? 'transparent'}
          presets={COLOR_PRESETS}
          gradients={GRADIENT_PRESETS}
          onChange={(bg) => onStyle({ bg })}
          label="Background"
        />
        <div className="insp-grid">
          <NumberField
            label="Radius"
            value={s.radius ?? 0}
            min={0}
            max={999}
            onChange={(radius) => onStyle({ radius })}
          />
          {node.type !== 'card' && (
            <NumberField
              label="Padding"
              value={s.padding ?? 0}
              min={0}
              max={200}
              onChange={(padding) => onStyle({ padding })}
            />
          )}
          <NumberField
            label="Opacity"
            value={Math.round((s.opacity ?? 1) * 100)}
            min={0}
            max={100}
            suffix="%"
            onChange={(v) => onStyle({ opacity: v / 100 })}
          />
          <NumberField
            label="Background opacity"
            value={s.bgAlpha ?? 100}
            min={0}
            max={100}
            suffix="%"
            onChange={(bgAlpha) => onStyle({ bgAlpha })}
          />
          <NumberField
            label="Blur behind"
            value={s.blur ?? 0}
            min={0}
            max={60}
            suffix="px"
            onChange={(blur) => onStyle({ blur })}
          />
          <label className="insp-field">
            <span>Shadow</span>
            <select value={s.shadow ?? 'none'} onChange={(e) => onStyle({ shadow: e.target.value })}>
              {Object.entries(SHADOWS).map(([key, sh]) => (
                <option key={key} value={key}>
                  {sh.label}
                </option>
              ))}
            </select>
          </label>
          <label className="insp-field" title={OVERFLOW_HELP[overflowOf(node)]}>
            <span>Overflow</span>
            <select
              value={overflowOf(node)}
              // Cards also keep the older "clip" flag in step.
              onChange={(e) =>
                onStyle({ overflow: e.target.value, ...(node.type === 'card' && { clip: e.target.value === 'hidden' }) })
              }
            >
              {Object.entries(OVERFLOW).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <NumberField
            label="Border"
            value={s.borderWidth ?? 0}
            min={0}
            max={20}
            suffix="px"
            onChange={(borderWidth) => onStyle({ borderWidth })}
          />
        </div>
        {(s.borderWidth ?? 0) > 0 && (
          <>
            <span className="insp-label">Border colour</span>
            <ColorPicker
              value={s.borderColor ?? 'text'}
              presets={COLOR_PRESETS.filter((p) => p.value !== 'transparent')}
              onChange={(borderColor) => onStyle({ borderColor })}
              label="Border colour"
            />
          </>
        )}
        <button
          type="button"
          className="btn btn-outline insp-glass"
          onClick={() => onStyle({ ...GLASS, bg: s.bg && s.bg !== 'transparent' ? s.bg : '#ffffff' })}
          title="See-through background, blur behind, a light edge and a soft shadow"
        >
          <Sparkle size={15} />
          Glass effect
        </button>
        <p className="insp-note">
          Blur behind frosts whatever sits underneath (glassmorphism). Lower the background opacity to see it.
        </p>
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
