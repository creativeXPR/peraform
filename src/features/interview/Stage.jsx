import { useEffect, useLayoutEffect, useRef } from 'react'
import { designedProps, play, prefersReducedMotion } from '../../lib/animations.js'
import { fontsUsed } from '../../lib/designStyles.js'
import { THEME_FONTS, loadThemeFont } from '../../lib/theme.js'
import {
  DEVICES,
  SHADOWS,
  backgroundCss,
  childrenOf,
  colorCss,
  frameOf,
  liveLayout,
  overflowCss,
  overflowOf,
  stageHeight,
} from '../../lib/interview.js'
// Question fields look exactly as on the normal form, in the editor too.
import '../respond/RespondPage.css'
import './interview.css'

// A card's text scheme: inside it, labels, answer fields and lines use
// colours that read on its background (a dark or a glass card), whatever
// the respondent's own light/dark setting.
const SCHEMES = {
  dark: {
    '--text': '#f1f2f6',
    '--text-muted': '#c4c7d0',
    '--line': 'rgb(255 255 255 / 0.18)',
    '--fill': 'rgb(255 255 255 / 0.08)',
    '--bg': 'rgb(255 255 255 / 0.06)',
    '--surface': 'rgb(255 255 255 / 0.08)',
  },
  light: {
    '--text': '#14151a',
    '--text-muted': '#5f6370',
    '--line': 'rgb(0 0 0 / 0.1)',
    '--fill': 'rgb(0 0 0 / 0.05)',
    '--bg': '#fbfcff',
    '--surface': '#ffffff',
  },
}

// Properties an action changes, with how each animates.
const ANIMATED = ['transform', 'background-color', 'color', 'font-size', 'border-radius']
// Live: blocks glide to close (or reopen) the space of a hidden block.
const REFLOW = ['top', 'height', 'min-height'].map((p) => `${p} 320ms cubic-bezier(0.4, 0, 0.2, 1)`)

//   override: live only — the block's state from actions (lib/actions.js):
//   { hidden, props, transition }
function nodeStyle(node, frame, editing, override) {
  const s = node.style ?? {}
  const p = (!editing && override?.props) || {}
  const r = p.rotate ?? frame.r ?? 0
  const transform = [
    p.moveX || p.moveY ? `translate(${p.moveX || 0}px, ${p.moveY || 0}px)` : '',
    r ? `rotate(${r}deg)` : '',
    p.scale !== undefined && p.scale !== 100 ? `scale(${p.scale / 100})` : '',
  ]
    .filter(Boolean)
    .join(' ')
  const style = {
    left: frame.x,
    top: frame.y,
    width: frame.w,
    // Exactly the size the creator set: blocks never grow over the ones
    // around them (that blocked taps on phones). Text or a question that
    // needs more room scrolls inside its block (.stage-scroll); the
    // Inspector says so.
    height: frame.h,
    transform: transform || undefined,
    zIndex: frame.z || undefined,
    background: backgroundCss(p.bg ?? s.bg, s.bgAlpha ?? 100),
    boxShadow: s.shadow && s.shadow !== 'none' ? SHADOWS[s.shadow]?.css : undefined,
    // Glass: blur whatever is behind the block.
    backdropFilter: s.blur ? `blur(${s.blur}px)` : undefined,
    WebkitBackdropFilter: s.blur ? `blur(${s.blur}px)` : undefined,
    border: s.borderWidth ? `${s.borderWidth}px solid ${colorCss(s.borderColor ?? 'text')}` : undefined,
    color: colorCss(p.color ?? s.color),
    borderRadius: p.radius ?? s.radius ?? undefined,
    padding: node.type === 'card' ? undefined : s.padding || undefined,
    opacity: p.opacity !== undefined ? p.opacity / 100 : (s.opacity ?? undefined),
    fontFamily: s.font ? THEME_FONTS[s.font]?.family : undefined,
    fontSize: p.size ?? (s.size || undefined),
    fontWeight: s.weight || undefined,
    textAlign: s.align || undefined,
    ...SCHEMES[s.scheme],
  }
  if (s.scheme && !style.color) style.color = 'var(--text)'
  const hidden = editing ? frame.hidden : (override?.hidden ?? frame.hidden)
  if (hidden) {
    if (editing) style.opacity = 0.35
    else {
      // Faded out rather than removed, so showing it again can fade in.
      // The blocks below close up its space (Stage → collapseHidden).
      style.opacity = 0
      style.visibility = 'hidden'
      style.pointerEvents = 'none'
    }
  }
  const t = !editing && override?.transition
  const transitions = !editing && !prefersReducedMotion() ? [...REFLOW] : []
  if (t) {
    const props = [...ANIMATED]
    if (t.display || p.opacity !== undefined) props.push('opacity')
    if (t.display) props.push('visibility')
    transitions.push(...props.map((prop) => `${prop} ${t.duration}ms ${t.easing}`))
  }
  if (transitions.length) style.transition = transitions.join(', ')
  return style
}

// One node and, for cards, everything inside it.
//   mode: 'edit' (canvas — nothing interactive) | 'live' (respondent)
//   renderQuestion(question) → the answer field (live) or a preview (edit)
//   onButton(action, node) — live buttons
//   overrides — live: each block's state from actions (lib/actions.js)
//   onNodePointerDown(e, node) — edit: select / start dragging
export function StageNode({ node, ctx }) {
  const {
    design,
    device,
    mode,
    questions,
    renderQuestion,
    onButton,
    onNodePointerDown,
    selectedId,
    selectedIds,
    renderHandles,
    renderGuides,
    overrides,
    preview, // edit: { nodeId, anim, nonce } plays one animation on the canvas
  } = ctx
  const editing = mode === 'edit'
  // Live, a block may sit higher (or a card be shorter) while something
  // above it is hidden; the design itself is unchanged.
  const frame = ctx.layout?.[node.id] ?? frameOf(node, device)
  const override = overrides?.[node.id]
  const elRef = useRef(null)
  const playedRef = useRef({}) // animation id → plays seen (action triggers)
  const animations = node.animations

  // Live: entrances and loops start with the screen (not for respondents who
  // asked their device for reduced motion). Before the first paint, so an
  // entrance never flashes the block in its final place first.
  useLayoutEffect(() => {
    if (editing || !animations?.length || prefersReducedMotion()) return
    const el = elRef.current
    for (const a of animations) {
      if (a.when === 'start' || a.when === 'loop') play(el, a, { r: frame.r ?? 0 }, designedProps(node))
    }
    return () => el?.getAnimations?.().forEach((a) => a.cancel())
    // Once per screen: `animations` only changes when the design does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, animations])

  // Live: an action asked for an animation (its play count went up).
  const plays = override?.plays
  useEffect(() => {
    if (editing || !plays) return
    for (const [id, count] of Object.entries(plays)) {
      const anim = animations?.find((a) => a.id === id)
      if (anim && count > (playedRef.current[id] ?? 0) && !prefersReducedMotion()) {
        // From the block as it is now: designed look plus action changes.
        const r = override?.props?.rotate ?? frame.r ?? 0
        play(elRef.current, anim, { ...override?.props, r, rotate: 0 }, designedProps(node, override))
      }
      playedRef.current[id] = count
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, plays])

  // Canvas: the Inspector's Preview button.
  useEffect(() => {
    if (!editing || preview?.nodeId !== node.id) return
    play(elRef.current, preview.anim, { r: frame.r ?? 0 }, designedProps(node))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, preview?.nonce])
  const className = [
    'stage-node',
    `stage-${node.type}`,
    frame.hidden ? 'is-hidden' : '',
    editing && (selectedIds ?? [selectedId]).includes(node.id) ? 'is-selected' : '',
  ]
    .filter(Boolean)
    .join(' ')

  // Content that doesn't fit (Inspector → Overflow): cards and text or
  // questions apply it to their inner box, so the block's own edges and
  // handles stay put; other blocks apply it to themselves.
  const overflow = overflowOf(node)
  let content = null
  if (node.type === 'card') {
    // Children live in an inner layer, which does the clipping — so the
    // card's own selection handles (edit mode) are never clipped away.
    content = (
      <div className="stage-card-inner" style={{ overflow: overflowCss(overflow) }}>
        {childrenOf(design.nodes, node.id, device).map((child) => (
          <StageNode key={child.id} node={child} ctx={ctx} />
        ))}
        {renderGuides?.(node.id)}
      </div>
    )
  } else if (node.type === 'text') {
    content = node.text || (editing ? <span className="stage-placeholder">Text</span> : null)
  } else if (node.type === 'image') {
    content = node.image ? (
      <img src={node.image.url} alt={node.alt || ''} draggable={false} />
    ) : (
      editing && <span className="stage-placeholder">Image</span>
    )
  } else if (node.type === 'video') {
    content = node.videoId ? (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${node.videoId}`}
        title={node.alt || 'Video'}
        loading="lazy"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    ) : (
      editing && <span className="stage-placeholder">Video</span>
    )
  } else if (node.type === 'embed') {
    content = node.url ? (
      <iframe
        src={node.url}
        title={node.alt || 'Embedded page'}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        referrerPolicy="no-referrer"
      />
    ) : (
      editing && <span className="stage-placeholder">Web page</span>
    )
  } else if (node.type === 'question') {
    const q = questions.find((x) => x.id === node.questionId)
    content = q ? (
      renderQuestion(q)
    ) : (
      editing && <span className="stage-placeholder">Question removed — delete this block</span>
    )
  } else if (node.type === 'button') {
    content = (
      <button
        type="button"
        className="stage-button-el"
        tabIndex={editing ? -1 : undefined}
        onClick={editing ? undefined : () => onButton?.(node.action ?? { type: 'next' }, node)}
      >
        {node.label || 'Button'}
      </button>
    )
  }

  return (
    <div
      ref={elRef}
      className={className}
      data-node-id={node.id}
      style={nodeStyle(node, frame, editing, override)}
      onPointerDown={editing ? (e) => onNodePointerDown?.(e, node) : undefined}
    >
      {/* Text and questions scroll inside an inner box when they need more
          room, so the block's own edges (and its selection handles) never
          scroll or get clipped. */}
      {node.type === 'text' || node.type === 'question' ? (
        <div className="stage-scroll" style={{ overflowY: overflowCss(overflow) }}>
          {content}
        </div>
      ) : node.type !== 'card' && overflow !== 'visible' ? (
        <div className="stage-scroll" style={{ overflow: overflowCss(overflow) }}>
          {content}
        </div>
      ) : (
        content
      )}
      {editing && selectedId === node.id && (selectedIds?.length ?? 1) <= 1 && renderHandles?.(node)}
    </div>
  )
}

// A whole screen at design size. The caller scales it to fit.
export default function Stage({ design, device, children, ...ctx }) {
  // The fonts the blocks use (each loads once).
  const fonts = fontsUsed(design).join()
  useEffect(() => {
    for (const f of fonts.split(',')) if (f) loadThemeFont(f)
  }, [fonts])
  // Live: hidden blocks (by design or by an action) give their space back.
  const live = ctx.mode === 'edit' ? null : liveLayout(design, device, ctx.overrides)
  const full = { design, device, layout: live?.layout, ...ctx }
  const height = live ? live.height : stageHeight(design, device)
  return (
    <div
      className="stage"
      style={{
        width: DEVICES[device].width,
        height,
        // Respondents: the page behind takes the background (it fills the
        // window), so the screen itself is see-through.
        background: ctx.transparentBg ? 'transparent' : (backgroundCss(design.bg) ?? 'var(--bg)'),
      }}
    >
      {childrenOf(design.nodes, null, device).map((node) => (
        <StageNode key={node.id} node={node} ctx={full} />
      ))}
      {ctx.renderGuides?.(null)}
      {children}
    </div>
  )
}

