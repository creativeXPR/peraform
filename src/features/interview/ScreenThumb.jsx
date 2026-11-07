import { DEVICES, backgroundCss, colorCss, frameOf, resolveNode } from '../../lib/interview.js'

// A screen as a tiny phone (Layers → Screens): its background and blocks
// drawn as simple shapes at the phone design's positions: cards, words as
// bars, questions as boxes, buttons, pictures. Display only.
const W = 34 // screen width in px; the phone design is scaled to it

function Shape({ node, nodes, scale }) {
  const f = frameOf(node, 'phone')
  if (f.hidden) return null
  const s = resolveNode(node, 'phone').style ?? {}
  const box = { left: f.x * scale, top: f.y * scale, width: f.w * scale, height: f.h * scale }
  if (node.type === 'card') {
    const kids = Object.values(nodes).filter((n) => n.parentId === node.id)
    return (
      <span
        className="st-card"
        style={{ ...box, background: backgroundCss(s.bg, s.bgAlpha) ?? 'transparent', borderRadius: (s.radius ?? 0) * scale }}
      >
        {kids.map((k) => (
          <Shape key={k.id} node={k} nodes={nodes} scale={scale} />
        ))}
      </span>
    )
  }
  if (node.type === 'image' && node.image?.url) return <img className="st-img" style={box} src={node.image.url} alt="" />
  if (node.type === 'text') {
    return <span className="st-text" style={{ ...box, height: Math.min(box.height, 3), background: colorCss(s.color) ?? 'currentColor' }} />
  }
  if (node.type === 'button') {
    return <span className="st-btn" style={{ ...box, background: colorCss(s.bg) ?? 'var(--accent)' }} />
  }
  return <span className={`st-${node.type}`} style={box} />
}

export default function ScreenThumb({ design }) {
  const scale = W / DEVICES.phone.width
  const tops = Object.values(design.nodes).filter((n) => !n.parentId)
  return (
    <span className="st-phone" aria-hidden="true">
      <span className="st-screen" style={{ background: backgroundCss(design.bg) ?? 'var(--bg)' }}>
        {tops.map((n) => (
          <Shape key={n.id} node={n} nodes={design.nodes} scale={scale} />
        ))}
      </span>
    </span>
  )
}
