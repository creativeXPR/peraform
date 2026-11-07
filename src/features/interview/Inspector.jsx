import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  AppWindow,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpToLine,
  BookmarkPlus,
  Check,
  CircleHelp,
  Copy,
  Eye,
  EyeOff,
  FolderInput,
  Image,
  Info,
  Link2,
  MoreHorizontal,
  MousePointerClick,
  Redo2,
  Shrink,
  Sparkle,
  Square,
  Trash2,
  Type,
  Video,
  Zap,
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
import ShowIf from '../builder/ShowIf.jsx'
import ActionsEditor from './ActionsEditor.jsx'
import AnimationsEditor from './AnimationsEditor.jsx'
import Select from '../../lib/Select.jsx'
import MenuButton from '../../lib/MenuButton.jsx'
import PanelGroup, { InfoTip } from './PanelGroup.jsx'
import { SoftTiles } from './Tiles.jsx'
import './inspector.css'

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

// A folding group (PanelGroup), remembered per block-panel group.
function Group({ id, title, value, tip, open = false, children }) {
  return (
    <PanelGroup id={`blk-${id}`} title={title} value={value} tip={tip} defaultOpen={open}>
      {children}
    </PanelGroup>
  )
}

// Each block type's icon and colour (as in Layers).
const TYPE_LOOK = {
  card: [Square, '#64748b'],
  text: [Type, '#f59e0b'],
  image: [Image, '#0ea5e9'],
  video: [Video, '#0ea5e9'],
  embed: [AppWindow, '#0ea5e9'],
  question: [CircleHelp, '#10b981'],
  button: [MousePointerClick, '#8b5cf6'],
}

// What a button does, as soft tiles (BUTTON_ACTIONS).
const DOES = [
  { value: 'next', label: 'Next', icon: ArrowRight, color: '#6d55d8', title: BUTTON_ACTIONS.next },
  { value: 'back', label: 'Back', icon: ArrowLeft, color: '#64748b', title: BUTTON_ACTIONS.back },
  { value: 'submit', label: 'Submit', icon: Check, color: '#16a34a', title: BUTTON_ACTIONS.submit },
  { value: 'goto', label: 'Jump to…', icon: Redo2, color: '#0ea5e9', title: BUTTON_ACTIONS.goto },
  { value: 'url', label: 'Open link', icon: Link2, color: '#f59e0b', title: BUTTON_ACTIONS.url },
  { value: 'none', label: 'Effects only', icon: Zap, color: '#a855f7', title: BUTTON_ACTIONS.none },
]

// One-click button looks: the style changes they make.
const BUTTON_LOOKS = [
  ['Glow pill', { bg: 'accent', color: 'on-accent', radius: 999, borderWidth: 0, shadow: 'glow', bgAlpha: 100 }],
  ['Solid', { bg: 'accent', color: 'on-accent', radius: 8, borderWidth: 0, shadow: 'none', bgAlpha: 100 }],
  ['Outline', { bg: 'transparent', color: 'accent', radius: 999, borderWidth: 2, borderColor: 'accent', shadow: 'none' }],
  ['Link', { bg: 'transparent', color: 'accent', radius: 0, borderWidth: 0, shadow: 'none' }],
]
const lookOn = (s, look) => Object.entries(look).every(([k, v]) => (s[k] ?? (k === 'bgAlpha' ? 100 : undefined)) === v)

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
function SizeLimits({ node, frame, onFitHeight, parentOverflow }) {
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
    // Visible here, but the card around it decides what shows past its edge.
    if (overflowOf(node) === 'visible' && parentOverflow && parentOverflow !== 'visible') {
      out.push({
        text: `This block is set to Visible, but the card around it is set to ${parentOverflow === 'hidden' ? 'Hidden, so anything past the card’s edge is cut off there' : 'Scroll, so anything past the card’s edge scrolls inside the card'}. To let it show, select the card and set its Overflow to Visible, or use Fit to blocks on the card.`,
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
  onEditQuestion, // (questionId) opens it in Edit questions
  showIf, // question blocks: the question's "Show only if…" (lib/showIf.js)
  onFrame,
  onStyle,
  onContent,
  onDuplicate,
  onSplit, // (split) its own look and words per device, or shared
  onKeep, // saves the block (and what's inside) to the Keep
  onMove, // opens "Move to…"
  onDelete,
  onLevel,
  onFit, // (pad) cards: hug the blocks inside, pad px from each edge
  onFitHeight, // (h) text/questions: this tall, blocks below move down
  parentOverflow, // the Overflow of the card it's in (scroll | hidden | visible), if any
  onPreview, // (animation) plays it on the canvas
  where, // the card it's in (its name), if any
  label, // the block's name (as in Layers)
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
      <div className="blk-head">
        <span className="blk-tile" style={{ '--c': TYPE_LOOK[node.type][1] }} aria-hidden="true">
          {(() => {
            const Icon = TYPE_LOOK[node.type][0]
            return <Icon size={15} />
          })()}
        </span>
        <strong>
          {multi ? `${multi} blocks selected` : label || type}
          {!multi && <small>{where ? `${type} · in ${where}` : type}</small>}
        </strong>
        <MenuButton
          icon={<MoreHorizontal size={17} />}
          label={multi ? 'More for these blocks' : 'More for this block'}
          items={[
            ...(multi
              ? []
              : [
                  { label: 'Bring forward', icon: ArrowUpToLine, onSelect: () => onLevel(1) },
                  { label: 'Send backward', icon: ArrowDownToLine, onSelect: () => onLevel(-1) },
                ]),
            { label: 'Duplicate (Ctrl+D)', icon: Copy, onSelect: onDuplicate },
            ...(multi
              ? []
              : [
                  { label: 'Keep (paste it later)', icon: BookmarkPlus, onSelect: onKeep },
                  { label: 'Move to…', icon: FolderInput, onSelect: onMove },
                ]),
            { label: 'Delete', icon: Trash2, danger: true, onSelect: onDelete },
          ]}
        />
      </div>

      {!multi && <SizeLimits node={node} frame={f} onFitHeight={onFitHeight} parentOverflow={parentOverflow} />}

      {multi > 0 && (
        <Group id="arrange" title="Arrange" value={DEVICES[device].label} open tip="Aligns the blocks that share a card with the last one you picked.">
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
        <>
          <Group id={`content-${node.type}`} title={node.type === 'question' ? 'Question' : 'Content'} open>
            {node.type === 'text' && (
              <>
                <textarea
                  className="insp-input"
                  rows={3}
                  value={node.text ?? ''}
                  onChange={(e) => onContent({ text: e.target.value })}
                  placeholder="Write something"
                  aria-label="Text"
                />
                <label className="insp-field">
                  <span>Link web address (optional)</span>
                  <input
                    className="insp-input"
                    type="url"
                    value={node.url ?? ''}
                    onChange={(e) => onContent({ url: e.target.value })}
                    placeholder="https://example.com"
                    aria-label="Link URL"
                  />
                </label>
                {Boolean(node.url?.trim()) && (
                  <label className="insp-field">
                    <span>Open in</span>
                    <Select
                      value={node.target ?? '_blank'}
                      onChange={(e) => onContent({ target: e.target.value })}
                    >
                      <option value="_blank">New tab</option>
                      <option value="_self">Same window</option>
                    </Select>
                  </label>
                )}
              </>
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
                <span className="mini-h">Does</span>
                <SoftTiles
                  label="When clicked"
                  options={DOES}
                  value={node.action?.type ?? 'next'}
                  onChange={(type) =>
                    // chosen: the creator's pick. It's never flagged as out of
                    // step with the screen order (screenIssues).
                    onContent({
                      action: {
                        ...node.action,
                        type,
                        screen: node.action?.screen ?? null,
                        url: node.action?.url ?? '',
                        target: node.action?.target ?? '_blank',
                        chosen: true,
                      },
                    })
                  }
                />
                {node.action?.type === 'goto' && (
                  <label className="insp-field">
                    <span>Screen</span>
                    <Select
                      value={node.action.screen ?? ''}
                      onChange={(e) => onContent({ action: { type: 'goto', screen: e.target.value, chosen: true } })}
                    >
                      <option value="">Choose a screen</option>
                      {screens.map((sc) => (
                        <option key={sc.key} value={sc.key}>
                          {sc.index + 1}. {sc.title}
                        </option>
                      ))}
                    </Select>
                  </label>
                )}
                {node.action?.type === 'url' && (
                  <>
                    <label className="insp-field">
                      <span>Web address (URL)</span>
                      <input
                        className="insp-input"
                        type="url"
                        value={node.action?.url ?? ''}
                        onChange={(e) =>
                          onContent({
                            action: {
                              ...node.action,
                              type: 'url',
                              url: e.target.value,
                              target: node.action?.target ?? '_blank',
                              chosen: true,
                            },
                          })
                        }
                        placeholder="https://example.com"
                        aria-label="Web address"
                      />
                    </label>
                    <label className="insp-field">
                      <span>Open in</span>
                      <Select
                        value={node.action?.target ?? '_blank'}
                        onChange={(e) =>
                          onContent({
                            action: {
                              ...node.action,
                              type: 'url',
                              target: e.target.value,
                              chosen: true,
                            },
                          })
                        }
                      >
                        <option value="_blank">New tab</option>
                        <option value="_self">Same window</option>
                      </Select>
                    </label>
                  </>
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
                <p className="insp-note insp-tipline">
                  Web address or embed code
                  <InfoTip text="A web address, or the embed code a site gives you (“<iframe …>” from YouTube, Google Maps, Slides, Canva, Calendly…). Any https page that allows embedding; some sites block it." />
                </p>
              </>
            )}
            {node.type === 'question' && (
              <label className="insp-field">
                <span>Question</span>
                <Select value={node.questionId ?? ''} onChange={(e) => onContent({ questionId: e.target.value })}>
                  {pageQuestions.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title || 'Untitled question'}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            {node.type === 'question' && node.questionId && (
              <button type="button" className="link-btn" onClick={() => onEditQuestion(node.questionId)}>
                Edit this question (words, answers, rules)
              </button>
            )}
            {node.type === 'card' && <FitCard key={node.id} pad={s.fitPad ?? 16} device={device} onFit={onFit} />}
          </Group>

          {node.type === 'button' && (
            <Group id="look" title="Look" value={BUTTON_LOOKS.find(([, l]) => lookOn(s, l))?.[0] ?? 'Your own'} open>
              <div className="btn-looks">
                {BUTTON_LOOKS.map(([name, look]) => (
                  <button
                    key={name}
                    type="button"
                    className={`btn-look${lookOn(s, look) ? ' is-on' : ''}`}
                    onClick={() => onStyle(look)}
                    title={name}
                    aria-label={`${name} look`}
                  >
                    <span className={`btn-look-${name.split(' ')[0].toLowerCase()}`}>{node.label || 'Next'}</span>
                  </button>
                ))}
              </div>
              <div className="insp-grid insp-grid-4">
                <NumberField label="Width" value={f.w} min={MIN_SIZE} onChange={(w) => onFrame({ w })} />
                <NumberField label="Height" value={f.h} min={MIN_SIZE} onChange={(h) => onFrame({ h })} />
                <NumberField label="Radius" value={s.radius ?? 0} min={0} max={999} onChange={(radius) => onStyle({ radius })} />
                <NumberField label="Text" value={s.size ?? 16} min={8} max={200} onChange={(size) => onStyle({ size })} />
              </div>
              <ColorPicker value={s.bg ?? 'accent'} presets={COLOR_PRESETS} onChange={(bg) => onStyle({ bg })} label="Button colour" />
            </Group>
          )}

          {showIf && (
            <Group id="showif" title="Show only if" value={showIf.rules.length ? 'Only when…' : 'Always'} tip="The same rule as on the question in Edit questions.">
              <ShowIf {...showIf} />
            </Group>
          )}

          {(node.type === 'button' || trigger) && (
            <Group
              id="actions"
              title={node.type === 'button' ? 'When clicked' : 'When answered'}
              value={node.actions?.length ? `${node.actions.length} effect${node.actions.length > 1 ? 's' : ''}` : 'Nothing'}
              tip={node.type === 'question' ? 'To show a question or a whole screen only for some answers, use “Show only if…” on it.' : undefined}
            >
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

          <Group
            id="animations"
            title="Animation"
            value={
              node.animations?.length
                ? node.animations.length > 1
                  ? `${node.animations.length} animations`
                  : node.animations[0].name
                : 'None'
            }
          >
            <AnimationsEditor
              animations={node.animations}
              onChange={(animations) => onContent({ animations })}
              onPreview={onPreview}
              colorPresets={COLOR_PRESETS}
            />
          </Group>
        </>
      )}

      {!multi && (
        <Group
          id="position"
          title="Position and size"
          value={DEVICES[device].label}
          tip={`Position, size and visibility are set per device: switch to ${DEVICES[otherDevice].label} to lay it out there. A hidden block gives its space back: the blocks below move up until it’s shown.`}
        >
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

      <Group
        id="devices"
        title="Phone and desktop"
        value={node.split ? 'Each its own' : 'Shared'}
        tip={
          node.split
            ? `Its own look and words on each device: colours, fonts, sizes and text you change here apply to the ${DEVICES[device].label.toLowerCase()} design only.`
            : `Colours, fonts, sizes and text are shared; turn this off to give the ${DEVICES[otherDevice].label.toLowerCase()} design its own. Position and size are always per device.`
        }
      >
        <label className="insp-check">
          <input type="checkbox" checked={!node.split} onChange={(e) => onSplit(!e.target.checked)} />
          Same look and words on both
        </label>
      </Group>

      <Group id="appearance" title={node.type === 'button' ? 'More looks' : 'Appearance'} value={s.shadow && s.shadow !== 'none' ? SHADOWS[s.shadow]?.label : undefined}>
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
            <Select value={s.shadow ?? 'none'} onChange={(e) => onStyle({ shadow: e.target.value })}>
              {Object.entries(SHADOWS).map(([key, sh]) => (
                <option key={key} value={key}>
                  {sh.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="insp-field" title={OVERFLOW_HELP[overflowOf(node)]}>
            <span>Overflow</span>
            <Select
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
            </Select>
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
        <p className="insp-note insp-tipline">
          About blur
          <InfoTip text="Blur behind frosts whatever sits underneath (glassmorphism). Lower the background opacity to see it." />
        </p>
      </Group>

      {hasText(node.type) && (
        <Group id="text" title="Text" value={THEME_FONTS[s.font]?.label ?? 'Theme font'}>
          <div className="insp-grid">
            <label className="insp-field">
              <span>Font</span>
              <Select value={s.font ?? ''} onChange={(e) => onStyle({ font: e.target.value || null })}>
                <option value="">Theme font</option>
                {Object.entries(THEME_FONTS).map(([key, font]) => (
                  <option key={key} value={key}>
                    {font.label}
                  </option>
                ))}
              </Select>
            </label>
            <NumberField label="Size" value={s.size ?? 16} min={8} max={200} onChange={(size) => onStyle({ size })} />
            <label className="insp-field">
              <span>Weight</span>
              <Select value={s.weight ?? 400} onChange={(e) => onStyle({ weight: Number(e.target.value) })}>
                <option value={400}>Regular</option>
                <option value={500}>Medium</option>
                <option value={600}>Semibold</option>
                <option value={700}>Bold</option>
              </Select>
            </label>
            <label className="insp-field">
              <span>Align</span>
              <Select value={s.align ?? 'left'} onChange={(e) => onStyle({ align: e.target.value })}>
                <option value="left">Left</option>
                <option value="center">Centre</option>
                <option value="right">Right</option>
              </Select>
            </label>
            {node.type !== 'card' && (
              <label className="insp-field">
                <span>Vertical</span>
                <Select
                  value={s.valign ?? (node.type === 'button' ? 'middle' : 'top')}
                  onChange={(e) => onStyle({ valign: e.target.value })}
                >
                  <option value="top">Top</option>
                  <option value="middle">Middle</option>
                  <option value="bottom">Bottom</option>
                </Select>
              </label>
            )}
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
