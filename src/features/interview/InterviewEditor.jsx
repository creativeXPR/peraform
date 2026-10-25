import { useState } from 'react'
import { Monitor, RotateCcw, Smartphone, Sparkles } from 'lucide-react'
import ColorPicker from '../../lib/ColorPicker.jsx'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import { isQuestion } from '../../lib/formLogic.js'
import { fieldPaddingStyle } from '../../lib/formModel.js'
import { applyStyle, restoreOriginal } from '../../lib/designStyles.js'
import { GRADIENT_PRESETS } from '../../lib/gradient.js'
import {
  COLOR_TOKENS,
  DEVICES,
  addNode,
  alignFrames,
  canHoldChildren,
  deleteNode,
  duplicateBlock,
  fitBlockHeight,
  fitCard,
  frameOf,
  moveBlock,
  moveTargets,
  interviewOf,
  keepBlockData,
  pasteBlock,
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
import { makeKeep } from '../../lib/keep.js'
import { useKeep, useKeepTargets } from '../keep/keepContext.js'
import Canvas from './Canvas.jsx'
import Inspector from './Inspector.jsx'
import LayersPanel from './LayersPanel.jsx'
import MoveBlockDialog from './MoveBlockDialog.jsx'
import StylePicker from './StylePicker.jsx'
import DesignScreensDialog from '../ai/DesignScreensDialog.jsx'

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
  // Selected blocks, in the order picked; the last one is shown in the
  // Inspector (and gets the resize handles when it's the only one).
  const [selection, setSelection] = useState([])
  const [pending, setPending] = useState(null) // { kind: 'delete', ids } | { kind: 'reset' }
  // Inspector → Preview: { nodeId, anim, nonce } plays it on the canvas.
  const [preview, setPreview] = useState(null)
  const [moving, setMoving] = useState(null) // block id for "Move to…"
  const [designing, setDesigning] = useState(false) // "Design with AI"

  const screens = screensOf(draft)
  const screen = screens.find((s) => s.key === screenKey) ?? screens[0]
  const design = screenDesign(draft, screen, screens)
  const questions = draft.questions.filter(isQuestion)
  const pageQuestions = screen.page.items.filter(isQuestion)
  const placed = placedQuestionIds(design)
  const unplaced = pageQuestions.filter((q) => !placed.has(q.id))
  const selectedIds = selection.filter((id) => design.nodes[id])
  const selectedId = selectedIds.at(-1) ?? null
  const selected = selectedId ? design.nodes[selectedId] : null

  // id → select just it; add → toggle it in the selection; null → none.
  function select(id, add = false) {
    if (!id) return setSelection([])
    setSelection((sel) => (add ? (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]) : [id]))
  }

  // Frame patches for several blocks, as one undo step.
  function changeFrames(patches) {
    const ids = Object.keys(patches)
    if (!ids.length) return
    change(`frames:${ids.join()}:${device}`, (dsn) =>
      ids.reduce((d, id) => setFrame(d, id, device, patches[id]), dsn),
    )
  }

  // Hidden on both devices (or shown on both), for every selected block.
  function startHidden(ids, hidden) {
    change(`start-hidden:${ids.join()}`, (dsn) =>
      ids.reduce(
        (d, id) => Object.keys(DEVICES).reduce((dd, dev) => setFrame(dd, id, dev, { hidden }), d),
        dsn,
      ),
    )
  }

  // A design style on this screen, or on every screen (one undo step).
  function applyDesignStyle(styleKey, where, palette) {
    edit(`interview:style:${where}:${Date.now()}`, (d) => {
      const all = screensOf(d)
      const iv = interviewOf(d)
      const targets = where === 'all' ? all : all.filter((s) => s.key === screen.key)
      const screensNext = { ...iv.screens }
      for (const s of targets) screensNext[s.key] = applyStyle(screenDesign(d, s, all), styleKey, palette)
      return { ...d, interview: { ...iv, screens: screensNext } }
    })
  }

  // Back to how screens looked before any style (one undo step).
  function restoreDesignStyle(where) {
    edit(`interview:unstyle:${where}:${Date.now()}`, (d) => {
      const all = screensOf(d)
      const iv = interviewOf(d)
      const screensNext = { ...iv.screens }
      for (const s of where === 'all' ? all : all.filter((x) => x.key === screen.key)) {
        if (screensNext[s.key]?.original) screensNext[s.key] = restoreOriginal(screensNext[s.key])
      }
      return { ...d, interview: { ...iv, screens: screensNext } }
    })
  }

  // A whole screen skipped until an action shows it (not the first).
  function setScreenHidden(key, hidden) {
    edit(`interview:${key}:hidden`, (d) => {
      const all = screensOf(d)
      const target = all.find((s) => s.key === key)
      if (!target) return d
      const iv = interviewOf(d)
      return {
        ...d,
        interview: { ...iv, screens: { ...iv.screens, [key]: { ...screenDesign(d, target, all), hidden } } },
      }
    })
  }

  // Lines up the selected blocks that share the last-picked block's card.
  function align(how) {
    const parentId = selected?.parentId ?? null
    const frames = Object.fromEntries(
      selectedIds
        .filter((id) => (design.nodes[id].parentId ?? null) === parentId)
        .map((id) => [id, frameOf(design.nodes[id], device)]),
    )
    changeFrames(alignFrames(frames, how))
  }

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
    change(`add:${node.id}`, (dsn) => addNode(dsn, node))
    setSelection([node.id])
  }

  function remove(ids) {
    change(`delete:${ids.join()}`, (dsn) => ids.reduce((d, id) => (d.nodes[id] ? deleteNode(d, id) : d), dsn))
    setSelection([])
  }

  // Copies blocks (question blocks get their own new question). Worked out
  // once, here, so the copies' ids are known and can be selected.
  function duplicate(ids) {
    let next = draft
    const copies = []
    for (const id of ids) {
      const result = duplicateBlock(next, screen.key, id)
      if (!result.id) continue
      next = result.form
      copies.push(result.id)
    }
    if (!copies.length) return
    edit(`interview:${screen.key}:duplicate:${copies.join()}`, (d) => ({
      ...d,
      questions: next.questions,
      interview: next.interview,
    }))
    setSelection(copies)
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
    setSelection([id])
  }

  // Keep: the selected block (with what's inside it and its questions).
  // Kept blocks paste into the selected card (cards: onto the screen when
  // none is selected); text and links become a text block.
  const keepStore = useKeep()
  function keepBlock() {
    if (!selected) return
    keepStore?.keep(makeKeep('block', keepBlockData(design, selected.id, draft.questions), nodeLabel(selected, questions)))
  }
  function pasteKeptBlock(data) {
    const result = pasteBlock(draft, screen.key, data, selectedId)
    if (!result.id) return keepStore?.showToast('Add a card to this screen first, then paste into it.')
    edit(`interview:${screen.key}:paste:${result.id}`, (d) => ({
      ...d,
      questions: result.form.questions,
      interview: result.form.interview,
    }))
    setSelection([result.id])
  }
  function pasteKeptText(data) {
    const parent =
      targetCard ??
      Object.values(design.nodes)
        .filter((n) => n.type === 'card' && !n.parentId)
        .sort((a, b) => a.seq - b.seq)[0]
    if (!parent) return keepStore?.showToast('Add a card to this screen first, then paste into it.')
    const node = placeNew(design, 'text', parent)
    node.text = data.url ?? data.text ?? ''
    change(`paste-text:${node.id}`, (dsn) => addNode(dsn, node))
    setSelection([node.id])
  }
  useKeepTargets({ block: pasteKeptBlock, text: pasteKeptText })

  const renderQuestion = (q) => (
    <QuestionField question={q} formId={draft.id} value={undefined} onChange={() => {}} />
  )

  return (
    <div className="interview-editor" style={fieldPaddingStyle(draft)}>
      <div className="ie-toolbar">
        {viewSwitch}
        <button type="button" className="btn btn-outline ie-ai" onClick={() => setDesigning(true)}>
          <Sparkles size={15} />
          Design with AI
        </button>
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
            setSelection([])
          }}
          design={design}
          device={device}
          questions={questions}
          unplaced={unplaced}
          targetCard={targetCard}
          selectedIds={selectedIds}
          onSelect={select}
          onToggleHidden={(node) =>
            change(`hidden:${node.id}:${device}`, (dsn) =>
              setFrame(dsn, node.id, device, { hidden: !frameOf(node, device).hidden }),
            )
          }
          onAdd={add}
          onDuplicate={(id) => duplicate([id])}
          onMove={setMoving}
          onDelete={(id) => setPending({ kind: 'delete', ids: [id] })}
        />

        <Canvas
          // A fresh view (fitted) when switching between phone and desktop.
          key={device}
          design={design}
          device={device}
          questions={questions}
          renderQuestion={renderQuestion}
          selectedIds={selectedIds}
          onSelect={select}
          onSelectMany={setSelection}
          preview={preview}
          onFrames={changeFrames}
          onKey={(e, nodes) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
              e.preventDefault()
              setPending({ kind: 'delete', ids: nodes.map((n) => n.id) })
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
              e.preventDefault()
              duplicate(nodes.map((n) => n.id))
            }
          }}
        />

        <div className="ie-side">
          {selected ? (
            <Inspector
              key={selectedIds.join()}
              node={selected}
              multi={selectedIds.length > 1 ? selectedIds.length : 0}
              onAlign={align}
              onStartHidden={(hidden) => startHidden(selectedIds, hidden)}
              onTargetVisibility={(id, hidden) =>
                screens.some((s) => s.key === id) ? setScreenHidden(id, hidden) : startHidden([id], hidden)
              }
              device={device}
              screens={screens}
              pageQuestions={pageQuestions}
              questions={questions}
              actionTargets={[
                // Whole screens (every one but the first): show, hide, recolour.
                ...screens.slice(1).map((s) => ({
                  id: s.key,
                  label: `Screen ${s.index + 1}: ${s.title}`,
                  screen: true,
                  shownAtStart: !interviewOf(draft).screens?.[s.key]?.hidden,
                })),
                ...Object.values(design.nodes)
                .filter((n) => n.id !== selected.id)
                .map((n) => ({
                  id: n.id,
                  label: nodeLabel(n, questions),
                  // Shown when the screen opens (on either device).
                  shownAtStart: Object.keys(DEVICES).some((dev) => !frameOf(n, dev).hidden),
                  animations: (n.animations ?? []).map((a) => ({ id: a.id, name: a.name })),
                })),
              ]}
              // Frame and style changes apply to every selected block.
              onFrame={(patch) => changeFrames(Object.fromEntries(selectedIds.map((id) => [id, patch])))}
              onStyle={(patch) =>
                change(`style:${selectedIds.join()}:${Object.keys(patch).join()}`, (dsn) =>
                  selectedIds.reduce((d, id) => setStyle(d, id, patch), dsn),
                )
              }
              onContent={(patch) =>
                change(`content:${selected.id}:${Object.keys(patch).join()}`, (dsn) =>
                  setContent(dsn, selected.id, patch),
                )
              }
              onPreview={(anim) => setPreview({ nodeId: selected.id, anim, nonce: Date.now() })}
              onDuplicate={() => duplicate(selectedIds)}
              onKeep={keepBlock}
              onMove={() => setMoving(selected.id)}
              onDelete={() => setPending({ kind: 'delete', ids: selectedIds })}
              onFitHeight={(h) =>
                change(`fit-h:${selected.id}:${device}:${Date.now()}`, (dsn) => fitBlockHeight(dsn, selected.id, device, h))
              }
              onFit={(pad) =>
                change(`fit:${selected.id}:${device}:${Date.now()}`, (dsn) =>
                  setStyle(fitCard(dsn, selected.id, device, pad), selected.id, { fitPad: pad }),
                )
              }
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
                <h3>Style</h3>
                <StylePicker
                  key={screen.key}
                  current={design.style}
                  onApply={(key, where) => applyDesignStyle(key, where)}
                  restorable={Object.values(interviewOf(draft).screens ?? {}).some((s) => s?.original)}
                  onRestore={restoreDesignStyle}
                />
              </section>
              {screen.index > 0 && (
                <section className="insp-group">
                  <h3>Visibility</h3>
                  <label className="insp-check">
                    <input
                      type="checkbox"
                      checked={Boolean(design.hidden)}
                      onChange={(e) => setScreenHidden(screen.key, e.target.checked)}
                    />
                    Skip this screen until an action shows it
                  </label>
                  <p className="insp-note">
                    A button or an answer on any screen can show it (or hide it, or change its background): pick
                    “Screen {screen.index + 1}” as the action’s target.
                  </p>
                </section>
              )}
              <section className="insp-group">
                <h3>Background</h3>
                <ColorPicker
                  value={design.bg ?? 'bg'}
                  presets={SCREEN_BG_PRESETS}
                  gradients={GRADIENT_PRESETS}
                  onChange={(bg) => change('bg', (dsn) => ({ ...dsn, bg: bg === 'bg' ? null : bg }))}
                  label="Screen background"
                />
              </section>
              <section className="insp-group">
                <h3>Design</h3>
                <p className="insp-note">
                  Click a block to edit it. Drag to move: it snaps to the card’s edges and centre
                  and to the other blocks (hold Alt to place freely). Shift-click, or drag a box on
                  empty space, to select several and move or style them together. Drag the corners
                  to resize and the round knob to rotate. Ctrl + scroll zooms; hold Space (or press
                  H) and drag to move around.
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

      <DesignScreensDialog
        open={designing}
        onClose={() => setDesigning(false)}
        screenKey={screen.key}
        device={device}
      />

      <ConfirmModal
        open={Boolean(pending)}
        title={
          pending?.kind === 'reset'
            ? 'Start this screen over?'
            : pending?.ids?.length > 1
              ? `Delete these ${pending.ids.length} blocks?`
              : `Delete this ${design.nodes[pending?.ids?.[0]]?.type === 'card' ? 'card' : 'block'}?`
        }
        message={
          pending?.kind === 'reset'
            ? 'Its design is replaced by a fresh starter layout on both devices. You can undo this.'
            : pending?.ids?.some((id) => design.nodes[id]?.type === 'card')
              ? 'Cards go with everything inside them. They’re removed from this screen on both devices. You can undo this.'
              : 'Removed from this screen on both devices. You can undo this.'
        }
        confirmLabel={pending?.kind === 'reset' ? 'Start over' : 'Delete'}
        onConfirm={() => {
          if (pending.kind === 'reset') {
            const isLast = screen.index === screens.length - 1
            change('reset', () => starterScreen(draft, screen, isLast))
            setSelection([])
          } else remove(pending.ids)
          setPending(null)
        }}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}

