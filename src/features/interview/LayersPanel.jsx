import {
  AppWindow,
  CircleHelp,
  Copy,
  Eye,
  EyeOff,
  FolderInput,
  Image,
  MoreHorizontal,
  MousePointerClick,
  Square,
  Trash2,
  Type,
  Video,
} from 'lucide-react'
import MenuButton from '../../lib/MenuButton.jsx'
import { NODE_TYPES, childrenOf, frameOf, nodeLabel } from '../../lib/interview.js'

const NODE_ICONS = {
  card: Square,
  text: Type,
  image: Image,
  video: Video,
  embed: AppWindow,
  question: CircleHelp,
  button: MousePointerClick,
}

function Tree({ nodes, parentId, device, depth, ctx }) {
  // Top of the list = top level, like design tools.
  const items = childrenOf(nodes, parentId, device).reverse()
  if (!items.length) return null
  return (
    <ul className="layers-tree">
      {items.map((node) => {
        const Icon = NODE_ICONS[node.type]
        const hidden = frameOf(node, device).hidden
        return (
          <li key={node.id}>
            <div
              className={`layer${ctx.selectedIds.includes(node.id) ? ' is-selected' : ''}${hidden ? ' is-hidden' : ''}`}
              style={{ paddingLeft: 8 + depth * 14 }}
            >
              <button
                type="button"
                className="layer-name"
                // Shift or Ctrl/⌘: add to (or take out of) the selection.
                onClick={(e) => ctx.onSelect(node.id, e.shiftKey || e.ctrlKey || e.metaKey)}
              >
                <Icon size={14} />
                <span>{nodeLabel(node, ctx.questions)}</span>
              </button>
              <button
                type="button"
                className="icon-btn layer-eye"
                onClick={() => ctx.onToggleHidden(node)}
                aria-label={hidden ? 'Show' : 'Hide'}
                title={hidden ? 'Show on this device' : 'Hide on this device'}
              >
                {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <MenuButton
                className="layer-menu"
                icon={<MoreHorizontal size={14} />}
                label={`More for ${nodeLabel(node, ctx.questions)}`}
                items={[
                  { label: 'Duplicate', icon: Copy, onSelect: () => ctx.onDuplicate(node.id) },
                  { label: 'Move to…', icon: FolderInput, onSelect: () => ctx.onMove(node.id) },
                  { label: 'Delete', icon: Trash2, danger: true, onSelect: () => ctx.onDelete(node.id) },
                ]}
              />
            </div>
            {node.type === 'card' && (
              <Tree nodes={nodes} parentId={node.id} device={device} depth={depth + 1} ctx={ctx} />
            )}
          </li>
        )
      })}
    </ul>
  )
}

// Left panel: the screens, the current screen's layers, and Add.
export default function LayersPanel({
  screens,
  screenKey,
  onScreen,
  design,
  device,
  questions,
  unplaced, // this screen's questions not on the canvas yet
  targetCard, // the card new blocks go into, or null
  selectedIds, // [id] — several with Shift/Ctrl-click
  onSelect, // (id, add)
  onToggleHidden,
  onAdd, // (type, extra?)
  onDuplicate, // (id)
  onMove, // (id) opens "Move to…"
  onDelete, // (id) asks first
}) {
  const needsCard = !targetCard
  const addItems = [
    { label: targetCard ? 'Card (inside the selected card)' : 'Card', icon: Square, onSelect: () => onAdd('card') },
    ...['text', 'image', 'video', 'embed', 'button'].map((type) => ({
      label: NODE_TYPES[type].label,
      icon: NODE_ICONS[type],
      onSelect: () => onAdd(type),
    })),
  ]
  return (
    <aside className="layers">
      <section className="layers-section">
        <h3>Screens</h3>
        <ol className="screens-list">
          {screens.map((sc) => (
            <li key={sc.key}>
              <button
                type="button"
                className={sc.key === screenKey ? 'is-current' : ''}
                aria-current={sc.key === screenKey ? 'true' : undefined}
                onClick={() => onScreen(sc.key)}
              >
                <span className="screen-num">{sc.index + 1}</span>
                <span className="screen-title">{sc.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section className="layers-section">
        <div className="layers-head">
          <h3>Layers</h3>
          <MenuButton
            icon={<span className="layers-add">+ Add</span>}
            label="Add a block"
            align="right"
            items={needsCard ? addItems.slice(0, 1) : addItems}
          />
        </div>
        {needsCard && Object.keys(design.nodes).length > 0 && (
          <p className="layers-note">Select a card to add text, images, buttons and more inside it.</p>
        )}
        <Tree
          nodes={design.nodes}
          parentId={null}
          device={device}
          depth={0}
          ctx={{ selectedIds, onSelect, onToggleHidden, questions, onDuplicate, onMove, onDelete }}
        />
        {!Object.keys(design.nodes).length && (
          <p className="layers-note">This screen is empty. Add a card to start.</p>
        )}
      </section>

      {unplaced.length > 0 && (
        <section className="layers-section layers-unplaced">
          <h3>Not on this screen</h3>
          <p className="layers-note">
            Respondents only answer questions placed on the screen.
            {needsCard && ' Select a card to place them.'}
          </p>
          <ul>
            {unplaced.map((q) => (
              <li key={q.id}>
                <span>{q.title || 'Untitled question'}</span>
                <button
                  type="button"
                  className="link-btn"
                  disabled={needsCard}
                  onClick={() => onAdd('question', { questionId: q.id })}
                >
                  Place
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  )
}
