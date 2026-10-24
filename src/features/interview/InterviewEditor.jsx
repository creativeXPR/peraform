import { useState } from 'react'
import { Monitor, RotateCcw, Smartphone } from 'lucide-react'
import ColorPicker from '../../lib/ColorPicker.jsx'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import { isQuestion } from '../../lib/formLogic.js'
import {
  COLOR_TOKENS,
  DEVICES,
  addNode,
  canHoldChildren,
  deleteNode,
  duplicateBlock,
  frameOf,
  moveBlock,
  moveTargets,
  growToFit,
  interviewOf,
  nodeLabel,
  placeNew,
  placedQuestionIds,
  questionHeight,
  screenDesign,
  screensOf,
  setContent,
  setFrame,
  setStyle,
  starterScreen,
} from '../../lib/interview.js'
import QuestionField from '../respond/QuestionField.jsx'
import { useFormEditor } from '../builder/editorContext.js'
import Canvas from './Canvas.jsx'
import Inspector from './Inspector.jsx'
import LayersPanel from './LayersPanel.jsx'
import MoveBlockDialog from './MoveBlockDialog.jsx'

const SCREEN_BG_PRESETS = [
  { value: 'bg', label: 'Page (theme)', swatch: COLOR_TOKENS.bg.css },
  { value: 'surface', label: 'Card (theme)', swatch: COLOR_TOKENS.surface.css },
  { value: 'accent', label: 'Theme colour', swatch: COLOR_TOKENS.accent.css },
  { value: 'accent-soft', label: 'Soft theme colour', swatch: COLOR_TOKENS['accent-soft'].css },
  { value: '#ffffff', label: 'White', swatch: '#ffffff' },
  { value: '#000000', label: 'Black', swatch: '#000000' },
]

// Questions tab in interview mode: design each screen (section) on a canvas.
// Every change goes through the editor (autosave + undo); a screen that was
// never edited shows its starter design until the first change saves it.
export default function InterviewEditor({ viewSwitch }) {
  const { draft, edit } = useFormEditor()
  const [screenKey, setScreenKey] = useState(null)
  const [device, setDevice] = useState('phone')
  const [selectedId, setSelectedId] = useState(null)
  const [pending, setPending] = useState(null) // { kind: 'delete', id } | { kind: 'reset' }
  // Inspector → Preview: { nodeId, anim, nonce } plays it on the canvas.
  const [preview, setPreview] = useState(null)
  const [moving, setMoving] = useState(null) // block id for "Move to…"

  const screens = screensOf(draft)
  const screen = screens.find((s) => s.key === screenKey) ?? screens[0]
  const design = screenDesign(draft, screen, screens)
  const questions = draft.questions.filter(isQuestion)
  const pageQuestions = screen.page.items.filter(isQuestion)
  const placed = placedQuestionIds(design)
  const unplaced = pageQuestions.filter((q) => !placed.has(q.id))
  const selected = selectedId ? design.nodes[selectedId] : null

  // Applies fn(design) → design to the current screen, starting from its
  // saved design or, the first time, its starter design.
  function change(key, fn) {
    const k = screen.key
    edit(`interview:${k}:${key}`, (d) => {
      const all = screensOf(d)
      const target = all.find((s) => s.key === k)
      if (!target) return d
      const iv = interviewOf(d)
      return {
        ...d,
        interview: { ...iv, screens: { ...iv.screens, [k]: fn(screenDesign(d, target, all)) } },
      }
    })
  }

  // New blocks go into the selected card, or the card around the selected block.
  const targetCard = selected
    ? canHoldChildren(selected)
      ? selected
      : selected.parentId
        ? design.nodes[selected.parentId]
        : null
    : null

  function add(type, extra = {}) {
    const parent = type === 'card' ? (targetCard ?? null) : targetCard
    if (type !== 'card' && !parent) return
    const q = type === 'question' ? questions.find((x) => x.id === extra.questionId) : null
    const node = placeNew(design, type, parent, q ? { ...extra, height: questionHeight(q) } : extra)
    if (type === 'text') node.text = 'New text'
    if (type === 'button') {
      node.label = 'Next'
      node.action = { type: 'next' }
    }
    change(`add:${node.id}`, (dsn) => growToFit(addNode(dsn, node), node.id))
    setSelectedId(node.id)
  }

  function remove(id) {
    change(`delete:${id}`, (dsn) => deleteNode(dsn, id))
    setSelectedId(null)
  }

  // Copies a block (question blocks get their own new question). Worked out
  // once, here, so the copy's id is known and can be selected.
  function duplicate(id) {
    const { form: next, id: copyId } = duplicateBlock(draft, screen.key, id)
    if (!copyId) return
    edit(`interview:${screen.key}:duplicate:${copyId}`, (d) => ({
      ...d,
      questions: next.questions,
      interview: next.interview,
    }))
    setSelectedId(copyId)
  }

  // "Move to…": into another card here or on another screen.
  function move(toKey, parentId) {
    const id = moving
    const from = screen.key
    edit(`interview:move:${id}`, (d) => {
      const next = moveBlock(d, from, id, toKey, parentId)
      return next === d ? d : { ...d, questions: next.questions, interview: next.interview }
    })
    setMoving(null)
    if (toKey !== from) setScreenKey(toKey)
    setSelectedId(id)
  }

  const renderQuestion = (q) => (
    <QuestionField question={q} formId={draft.id} value={undefined} onChange={() => {}} />
  )

  return (
    <div className="interview-editor">
      <div className="ie-toolbar">
        {viewSwitch}
        <div className="segmented" role="radiogroup" aria-label="Device">
          {Object.entries(DEVICES).map(([key, d]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={device === key}
              className={device === key ? 'active' : ''}
              onClick={() => setDevice(key)}
            >
              {key === 'phone' ? <Smartphone size={15} /> : <Monitor size={15} />}
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ie-body">
        <LayersPanel
          screens={screens}
          screenKey={screen.key}
          onScreen={(key) => {
            setScreenKey(key)
            setSelectedId(null)
          }}
          design={design}
          device={device}
          questions={questions}
          unplaced={unplaced}
          targetCard={targetCard}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onToggleHidden={(node) =>
            change(`hidden:${node.id}:${device}`, (dsn) =>
              setFrame(dsn, node.id, device, { hidden: !frameOf(node, device).hidden }),
            )
          }
          onAdd={add}
          onDuplicate={duplicate}
          onMove={setMoving}
          onDelete={(id) => setPending({ kind: 'delete', id })}
        />

        <Canvas
          // A fresh view (fitted) when switching between phone and desktop.
          key={device}
          design={design}
          device={device}
          questions={questions}
          renderQuestion={renderQuestion}
          selectedId={selectedId}
          onSelect={setSelectedId}
          preview={preview}
          onFrame={(id, patch) => change(`frame:${id}:${device}`, (dsn) => setFrame(dsn, id, device, patch))}
          onKey={(e, node) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
              e.preventDefault()
              setPending({ kind: 'delete', id: node.id })
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
              e.preventDefault()
              duplicate(node.id)
            }
          }}
        />

        <div className="ie-side">
          {selected ? (
            <Inspector
              key={selected.id}
              node={selected}
              device={device}
              screens={screens}
              pageQuestions={pageQuestions}
              questions={questions}
              actionTargets={Object.values(design.nodes)
                .filter((n) => n.id !== selected.id)
                .map((n) => ({
                  id: n.id,
                  label: nodeLabel(n, questions),
                  animations: (n.animations ?? []).map((a) => ({ id: a.id, name: a.name })),
                }))}
              onFrame={(patch) =>
                change(`frame:${selected.id}:${device}`, (dsn) => setFrame(dsn, selected.id, device, patch))
              }
              onStyle={(patch) =>
                change(`style:${selected.id}:${Object.keys(patch).join()}`, (dsn) => setStyle(dsn, selected.id, patch))
              }
              onContent={(patch) =>
                change(`content:${selected.id}:${Object.keys(patch).join()}`, (dsn) =>
                  setContent(dsn, selected.id, patch),
                )
              }
              onPreview={(anim) => setPreview({ nodeId: selected.id, anim, nonce: Date.now() })}
              onDuplicate={() => duplicate(selected.id)}
              onMove={() => setMoving(selected.id)}
              onDelete={() => setPending({ kind: 'delete', id: selected.id })}
              onLevel={(delta) => {
                const z = Math.max(0, (frameOf(selected, device).z || 0) + delta)
                change(`frame:${selected.id}:${device}`, (dsn) => setFrame(dsn, selected.id, device, { z }))
              }}
            />
          ) : (
            <div className="inspector">
              <div className="insp-head">
                <strong>Screen {screen.index + 1}</strong>
              </div>
              <section className="insp-group">
                <h3>Background</h3>
                <ColorPicker
                  value={design.bg ?? 'bg'}
                  presets={SCREEN_BG_PRESETS}
                  onChange={(bg) => change('bg', (dsn) => ({ ...dsn, bg: bg === 'bg' ? null : bg }))}
                  label="Screen background"
                />
              </section>
              <section className="insp-group">
                <h3>Design</h3>
                <p className="insp-note">
                  Click a block to edit it. Drag to move — it snaps to the left, centre, right, top
                  and bottom (hold Alt to place freely). Drag the corners to resize and the round
                  knob to rotate. Ctrl + scroll zooms; hold Space (or press H) and drag to move
                  around.
                </p>
                <button type="button" className="btn btn-outline" onClick={() => setPending({ kind: 'reset' })}>
                  <RotateCcw size={15} />
                  Start this screen over
                </button>
              </section>
            </div>
          )}
        </div>
      </div>

      {moving && design.nodes[moving] && (
        <MoveBlockDialog
          open
          blockLabel={nodeLabel(design.nodes[moving], questions)}
          targets={moveTargets(draft, screen.key, moving)}
          currentKey={screen.key}
          currentParent={design.nodes[moving].parentId}
          onMove={move}
          onClose={() => setMoving(null)}
        />
      )}

      <ConfirmModal
        open={Boolean(pending)}
        title={
          pending?.kind === 'reset'
            ? 'Start this screen over?'
            : `Delete this ${design.nodes[pending?.id]?.type === 'card' ? 'card' : 'block'}?`
        }
        message={
          pending?.kind === 'reset'
            ? 'Its design is replaced by a fresh starter layout on both devices. You can undo this.'
            : design.nodes[pending?.id]?.type === 'card'
              ? 'The card and everything inside it are removed from this screen on both devices. You can undo this.'
              : 'It’s removed from this screen on both devices. You can undo this.'
        }
        confirmLabel={pending?.kind === 'reset' ? 'Start over' : 'Delete'}
        onConfirm={() => {
          if (pending.kind === 'reset') {
            const isLast = screen.index === screens.length - 1
            change('reset', () => starterScreen(draft, screen, isLast))
            setSelectedId(null)
          } else remove(pending.id)
          setPending(null)
        }}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}

