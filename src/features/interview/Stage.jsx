import { THEME_FONTS } from '../../lib/theme.js'
import { DEVICES, childrenOf, colorCss, frameOf, stageHeight } from '../../lib/interview.js'
// Question fields look exactly as on the normal form, in the editor too.
import '../respond/RespondPage.css'
import './interview.css'

// Properties an action changes, with how each animates.
const ANIMATED = ['transform', 'background-color', 'color', 'font-size', 'border-radius']

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
    // Questions and text may need more room than planned; they grow.
    [node.type === 'question' || node.type === 'text' ? 'minHeight' : 'height']: frame.h,
    transform: transform || undefined,
    zIndex: frame.z || undefined,
    background: colorCss(p.bg ?? s.bg),
    color: colorCss(p.color ?? s.color),
    borderRadius: p.radius ?? s.radius ?? undefined,
    padding: node.type === 'card' ? undefined : s.padding || undefined,
    opacity: p.opacity !== undefined ? p.opacity / 100 : (s.opacity ?? undefined),
    fontFamily: s.font ? THEME_FONTS[s.font]?.family : undefined,
    fontSize: p.size ?? (s.size || undefined),
    fontWeight: s.weight || undefined,
    textAlign: s.align || undefined,
  }
  const hidden = editing ? frame.hidden : (override?.hidden ?? frame.hidden)
  if (hidden) {
    if (editing) style.opacity = 0.35
    else {
      // Faded out rather than removed, so showing it again can fade in
      // (every block is positioned on its own, so nothing else moves).
      style.opacity = 0
      style.visibility = 'hidden'
      style.pointerEvents = 'none'
    }
  }
  const t = !editing && override?.transition
  if (t) {
    const props = [...ANIMATED]
    if (t.display || p.opacity !== undefined) props.push('opacity')
    if (t.display) props.push('visibility')
    style.transition = props.map((prop) => `${prop} ${t.duration}ms ${t.easing}`).join(', ')
  }
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
    renderHandles,
    renderGuides,
    overrides,
  } = ctx
  const frame = frameOf(node, device)
  const editing = mode === 'edit'
  const className = [
    'stage-node',
    `stage-${node.type}`,
    frame.hidden ? 'is-hidden' : '',
    editing && selectedId === node.id ? 'is-selected' : '',
  ]
    .filter(Boolean)
    .join(' ')

  let content = null
  if (node.type === 'card') {
    // Children live in an inner layer, which does the clipping — so the
    // card's own selection handles (edit mode) are never clipped away.
    content = (
      <div className={`stage-card-inner${node.style?.clip ? ' is-clipped' : ''}`}>
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
      className={className}
      data-node-id={node.id}
      style={nodeStyle(node, frame, editing, overrides?.[node.id])}
      onPointerDown={editing ? (e) => onNodePointerDown?.(e, node) : undefined}
    >
      {content}
      {editing && selectedId === node.id && renderHandles?.(node)}
    </div>
  )
}

// A whole screen at design size. The caller scales it to fit.
export default function Stage({ design, device, children, ...ctx }) {
  const full = { design, device, ...ctx }
  return (
    <div
      className="stage"
      style={{
        width: DEVICES[device].width,
        height: stageHeight(design, device),
        background: colorCss(design.bg) ?? 'var(--bg)',
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
