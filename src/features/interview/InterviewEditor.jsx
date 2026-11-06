import { useLayoutEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Monitor, RotateCcw, Smartphone } from 'lucide-react'
import ColorPicker from '../../lib/ColorPicker.jsx'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import { isQuestion, isSection } from '../../lib/formLogic.js'
import { fieldPaddingStyle, newSection } from '../../lib/formModel.js'
import { showIfProps } from '../../lib/showIf.js'
import ShowIf from '../builder/ShowIf.jsx'
import TargetSelect from '../builder/TargetSelect.jsx'
import { buildTargets } from '../builder/questionTypes.js'
import { applyLook, applyStyle, captureLook, restoreOriginal } from '../../lib/designStyles.js'
import { GRADIENT_PRESETS } from '../../lib/gradient.js'
import {
  COLOR_TOKENS,
  DEVICES,
  addNode,
  alignFrames,
  canHoldChildren,
  copyPhoneToDesktop,
  duplicateBlock,
  fitBlockHeight,
  fitCard,
  frameOf,
  moveBlock,
  moveTargets,
  interviewOf,
  isDesktopUntouched,
  keepBlockData,
  pasteBlock,
  fixButton,
  moveStrayBlock,
  placeQuestions,
  screenIssues,
  removeBlocks,
  unremove,
  nodeLabel,
  placeNew,
  placedQuestionIds,
  questionHeight,
  screenDesign,
  screensOf,
  differsByDevice,
  overflowOf,
  resolveNode,
  setContentOn,
  setSplit,
  setStyle,
  setStyleOn,
  setFrame,
  starterScreen,
} from '../../lib/interview.js'
import QuestionField from '../respond/QuestionField.jsx'
import { useFormEditor } from '../builder/editorContext.js'
import { makeKeep } from '../../lib/keep.js'
import { useKeep, useKeepTargets } from '../keep/keepContext.js'
import Canvas from './Canvas.jsx'
import ScreenIssues from './ScreenIssues.jsx'
import Inspector from './Inspector.jsx'
import LayersPanel from './LayersPanel.jsx'
import MoveBlockDialog from './MoveBlockDialog.jsx'
import StylePicker from './StylePicker.jsx'
import LayoutPicker from './LayoutPicker.jsx'
import { keepScreenData, pasteScreen } from '../../lib/keptScreens.js'
import { LAYOUTS, SAMPLE_PHOTOS, applyLayout } from '../../lib/screenLayouts.js'
import DesignScreensDialog from '../ai/DesignScreensDialog.jsx'
import DawnOrb from '../ai/DawnOrb.jsx'

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
export default function InterviewEditor({ viewSwitch, viewHint }) {
  const { draft, edit } = useFormEditor()
  // The editor fits the space below its toolbar (screens, canvas and panel
  // scroll on their own), so nothing needs the page scrolled to reach it.
  const bodyRef = useRef(null)
  useFitBelow(bodyRef)
  // The screen being designed is in the address (?screen=), so it's kept
  // across Edit questions and back.
  const [params, setParams] = useSearchParams()
  const screenKey = params.get('screen')
  const setScreenKey = (key) => setParams({ screen: key }, { replace: true })
  const [device, setDevice] = useState('phone')
  // Selected blocks, in the order picked; the last one is shown in the
  // Inspector (and gets the resize handles when it's the only one).
  const [selection, setSelection] = useState([])
  const [pending, setPending] = useState(null) // { kind: 'delete' | 'share', ids } | { kind: 'reset' } | { kind: 'layout', key }
  const [applyAll, setApplyAll] = useState(false)
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
  // Out of step with the question list: flagged with buttons, never fixed
  // by itself (lib/interview.js → screenIssues).
  const issues = screenIssues(draft, screen, design, screens)
  const issueKeys = new Set(screens.filter((s) => screenIssues(draft, s, screenDesign(draft, s, screens), screens).length).map((s) => s.key))
  const selectedIds = selection.filter((id) => design.nodes[id])
  const selectedId = selectedIds.at(-1) ?? null
  const selected = selectedId ? design.nodes[selectedId] : null
  const setQuestions = (key, update) => edit(key, (d) => ({ ...d, questions: update(d.questions) }))
  // Where this screen leads: its section's "After section N" (the same
  // setting as in Edit questions), and any answers that branch from it.
  const section = screen.page.section
  const sections = draft.questions.filter(isSection)
  const branching = pageQuestions.filter((q) => q.branching)
  // Answer conditions that show questions or screens are "Show only if…"
  // (one store, lib/showIf.js), so a question block's actions only reach
  // the other blocks, plus anything an older action already points at.
  const answerBlock = selected?.type === 'question'
  const keepTarget = (id) => (selected?.actions ?? []).some((a) => a.target === id)

  function addScreen() {
    const s = newSection()
    setQuestions('add-screen', (qs) => [...qs, s])
    setScreenKey(s.id)
    setSelection([])
  }

  // "Edit this question": to it in Edit questions, keeping this screen.
  const editQuestion = (id) => setParams({ view: 'questions', q: id, screen: screen.key }, { replace: true })

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
    change(`add:${node.id}`, (dsn) => addNode(q ? unremove(dsn, q.id) : dsn, node))
    setSelection([node.id])
  }

  function remove(ids) {
    change(`delete:${ids.join()}`, (dsn) => removeBlocks(dsn, ids))
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

  // The old question is "removed" from this screen unless another block
  // still shows it; the new one isn't.
  const removedSwap = (dsn, from, to) => {
    const d = unremove(dsn, to)
    if (placedQuestionIds(d).has(from) || d.removed?.includes(from)) return d
    return { ...d, removed: [...(d.removed ?? []), from] }
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
  // A kept screen or look replaces what's here, so it asks first.
  useKeepTargets({
    block: pasteKeptBlock,
    text: pasteKeptText,
    screen: (data) => setPending({ kind: 'keep-screen', data }),
    look: (data) => setPending({ kind: 'keep-look', data }),
  })

  const renderQuestion = (q) => (
    <QuestionField question={q} formId={draft.id} value={undefined} onChange={() => {}} />
  )

  return (
    <div className="interview-editor" style={fieldPaddingStyle(draft)}>
      <div className="ie-toolbar">
        {viewSwitch}
        <button type="button" className="btn btn-outline ie-ai" onClick={() => setDesigning(true)}>
          <DawnOrb size={22} />
          Design with Dawn
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
      {viewHint}

      <ScreenIssues
        issues={issues}
        questions={questions}
        design={design}
        onPlace={(qs) => change(`place:${qs.map((q) => q.id).join()}`, (dsn) => placeQuestions(dsn, qs))}
        onMoveThere={(issue) =>
          edit(`interview:stray:${issue.nodeId}`, (d) => {
            const next = moveStrayBlock(d, screen.key, issue.nodeId, issue.to.key)
            return next === d ? d : { ...d, interview: next.interview }
          })
        }
        onRemove={(id) => setPending({ kind: 'delete', ids: [id] })}
        onFixButton={(issue) => change(`fix-button:${issue.nodeId}`, (dsn) => fixButton(dsn, issue.nodeId, issue.want))}
      />

      <div className="ie-body" ref={bodyRef}>
        <LayersPanel
          issueKeys={issueKeys}
          screens={screens}
          screenKey={screen.key}
          onScreen={(key) => {
            setScreenKey(key)
            setSelection([])
          }}
          onAddScreen={addScreen}
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
              node={resolveNode(selected, device)}
              parentOverflow={selected.parentId && design.nodes[selected.parentId] ? overflowOf(resolveNode(design.nodes[selected.parentId], device)) : undefined}
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
              onEditQuestion={editQuestion}
              showIf={
                selected.type === 'question' && draft.questions.some((q) => q.id === selected.questionId)
                  ? showIfProps(draft.questions, draft.questions.find((q) => q.id === selected.questionId), setQuestions)
                  : null
              }
              actionTargets={[
                // Whole screens (every one but the first): show, hide, recolour.
                ...screens.slice(1).filter((s) => !answerBlock || keepTarget(s.key)).map((s) => ({
                  id: s.key,
                  label: `Screen ${s.index + 1}: ${s.title}`,
                  screen: true,
                  shownAtStart: !interviewOf(draft).screens?.[s.key]?.hidden,
                })),
                ...Object.values(design.nodes)
                .filter((n) => n.id !== selected.id)
                .filter((n) => !answerBlock || n.type !== 'question' || keepTarget(n.id))
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
                  selectedIds.reduce((d, id) => setStyleOn(d, id, device, patch), dsn),
                )
              }
              onContent={(patch) =>
                change(`content:${selected.id}:${Object.keys(patch).join()}`, (dsn) =>
                  // A block switched to another question: the old one counts as
                  // taken off this screen, the new one as put on it.
                  patch.questionId && selected.questionId && patch.questionId !== selected.questionId
                    ? removedSwap(setContentOn(dsn, selected.id, device, patch), selected.questionId, patch.questionId)
                    : setContentOn(dsn, selected.id, device, patch),
                )
              }
              onPreview={(anim) => setPreview({ nodeId: selected.id, anim, nonce: Date.now() })}
              // Shared look on both devices, or each its own. Sharing again
              // when they differ asks first (the other device's look goes).
              onSplit={(split) => {
                if (!split && selectedIds.some((id) => differsByDevice(design.nodes[id]))) {
                  setPending({ kind: 'share', ids: selectedIds })
                } else change(`split:${selectedIds.join()}:${split}`, (dsn) => selectedIds.reduce((d, id) => setSplit(d, id, split, device), dsn))
              }}
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
                <h3>Layout</h3>
                <LayoutPicker current={design.layout} onPick={(key) => setPending({ kind: 'layout', key })} />
              </section>
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
                  <ShowIf {...showIfProps(draft.questions, section, setQuestions)} noun="screen" />
                  <p className="insp-note">
                    A button or an answer on any screen can show it (or hide it, or change its background): pick
                    “Screen {screen.index + 1}” as the action’s target.
                  </p>
                </section>
              )}
              <section className="insp-group">
                <h3>After this screen</h3>
                {section ? (
                  <TargetSelect
                    value={section.next}
                    targets={buildTargets(sections).filter((t) => t.value !== section.id)}
                    onChange={(next) =>
                      setQuestions(`q:${section.id}:next`, (qs) => qs.map((q) => (q.id === section.id ? { ...q, next } : q)))
                    }
                    label="After this screen"
                  />
                ) : (
                  <p className="insp-note">{screens.length > 1 ? 'Goes on to the next screen.' : 'The only screen: Next submits.'}</p>
                )}
                {branching.length > 0 && (
                  <p className="insp-note">
                    Answers to {branching.map((q) => `“${q.title || 'Untitled question'}”`).join(', ')} can send people
                    elsewhere (set on the question in Edit questions).
                  </p>
                )}
                <p className="insp-note">
                  {section ? `The same setting as “After section ${screen.index + 1}” in Edit questions. ` : ''}Next buttons
                  follow it; a button set to “Jump to a screen…” goes straight there.
                </p>
              </section>
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
                <div className="insp-keep">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() =>
                      keepStore?.keep(makeKeep('screen', keepScreenData(design, draft.questions), `Screen · ${screen.title}`))
                    }
                    title="Save this screen's design to your Keep, to use on a screen of any form"
                  >
                    Keep this screen
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => keepStore?.keep(makeKeep('look', captureLook(design), `Look · ${draft.title || 'Untitled form'}`))}
                    title="Save this screen's colours, fonts and entrance to your Keep, to give another form the same look"
                  >
                    Keep this look
                  </button>
                </div>
                <button type="button" className="btn btn-outline" onClick={() => setPending({ kind: 'reset' })}>
                  <RotateCcw size={15} />
                  Start this screen over
                </button>
                {device === 'desktop' &&
                  isDesktopUntouched(design, starterScreen(draft, screen, screen.index === screens.length - 1)) && (
                    <p className="insp-note">
                      Desktop hasn't been designed yet: people on computers see the starter layout.
                    </p>
                  )}
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setApplyAll(false)
                    setPending({ kind: 'copy-phone' })
                  }}
                >
                  Copy phone design to desktop
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
          pending?.kind === 'keep-screen'
            ? 'Use the kept screen here?'
            : pending?.kind === 'keep-look'
            ? 'Give every screen the kept look?'
            : pending?.kind === 'layout'
            ? `Use the “${LAYOUTS[pending.key].label}” layout?`
            : pending?.kind === 'reset'
            ? 'Start this screen over?'
            : pending?.kind === 'copy-phone'
            ? 'Copy phone design to desktop?'
            : pending?.kind === 'share'
              ? `Use the ${DEVICES[device].label.toLowerCase()} look on both devices?`
              : pending?.ids?.length > 1
              ? `Delete these ${pending.ids.length} blocks?`
              : `Delete this ${design.nodes[pending?.ids?.[0]]?.type === 'card' ? 'card' : 'block'}?`
        }
        message={
          pending?.kind === 'keep-screen'
            ? 'This screen’s design is replaced by the kept one, on both devices. Its question blocks show this screen’s questions in order, and its heading takes this screen’s title. You can undo this.'
            : pending?.kind === 'keep-look'
            ? 'Every screen takes its colours, fonts and entrance. Your layouts, words and questions stay. You can undo this.'
            : pending?.kind === 'layout'
            ? `This screen’s blocks are rearranged into it on both devices; their words, questions, actions and animations stay. Extra cards are merged into one.${['side', 'photo'].includes(pending.key) && !Object.values(design.nodes).some((n) => ['image', 'video', 'embed'].includes(n.type)) ? ' A sample photo is added: click it to choose your own.' : ''} You can undo this.`
            : pending?.kind === 'reset'
            ? 'Its design is replaced by a fresh starter layout on both devices. You can undo this.'
            : pending?.kind === 'copy-phone'
            ? "Desktop's own layout for this screen is replaced. You can undo this."
            : pending?.kind === 'share'
              ? `The ${DEVICES[device === 'phone' ? 'desktop' : 'phone'].label.toLowerCase()} design’s own colours, fonts and words for this block are replaced by the ${DEVICES[device].label.toLowerCase()} ones. Position and size stay per device. You can undo this.`
              : pending?.ids?.some((id) => design.nodes[id]?.type === 'card')
              ? 'Cards go with everything inside them. They’re removed from this screen on both devices. You can undo this.'
              : 'Removed from this screen on both devices. You can undo this.'
        }
        confirmLabel={
          pending?.kind === 'keep-screen' || pending?.kind === 'keep-look' ? 'Use it' : pending?.kind === 'layout' ? 'Use this layout' : pending?.kind === 'reset' ? 'Start over' : pending?.kind === 'copy-phone' ? 'Copy to desktop' : pending?.kind === 'share' ? 'Share' : 'Delete'
        }
        tone={['share', 'layout', 'keep-screen', 'keep-look', 'copy-phone'].includes(pending?.kind) ? 'neutral' : 'danger'}
        extra={
          pending?.kind === 'copy-phone' && (
            <label className="insp-check">
              <input
                type="checkbox"
                checked={applyAll}
                onChange={(e) => setApplyAll(e.target.checked)}
              />
              Apply to every screen
            </label>
          )
        }
        onConfirm={() => {
          if (pending.kind === 'keep-screen') {
            const key = screen.key
            edit(`interview:${key}:kept-screen:${Date.now()}`, (d) => pasteScreen(d, key, pending.data))
            setSelection([])
          } else if (pending.kind === 'keep-look') {
            edit(`interview:kept-look:${Date.now()}`, (d) => {
              const all = screensOf(d)
              const iv = interviewOf(d)
              const next = { ...iv.screens }
              for (const s of all) next[s.key] = applyLook(screenDesign(d, s, all), pending.data)
              return { ...d, interview: { ...iv, screens: next } }
            })
          } else if (pending.kind === 'layout') {
            const photo = SAMPLE_PHOTOS[pending.key === 'photo' ? 1 : 0].url
            change(`layout:${pending.key}`, (dsn) => applyLayout(dsn, pending.key, { questions, photo }))
            setSelection([])
          } else if (pending.kind === 'reset') {
            const isLast = screen.index === screens.length - 1
            change('reset', () => starterScreen(draft, screen, isLast))
            setSelection([])
          } else if (pending.kind === 'copy-phone') {
            if (applyAll) {
              edit(`interview:copy-phone-all:${Date.now()}`, (d) => {
                const all = screensOf(d)
                const iv = interviewOf(d)
                const next = { ...iv.screens }
                for (const s of all) next[s.key] = copyPhoneToDesktop(screenDesign(d, s, all))
                return { ...d, interview: { ...iv, screens: next } }
              })
            } else {
              change(`copy-phone:${Date.now()}`, (dsn) => copyPhoneToDesktop(dsn))
            }
            setSelection([])
          } else if (pending.kind === 'share') {
            change(`split:${pending.ids.join()}:false`, (dsn) => pending.ids.reduce((d, id) => setSplit(d, id, false, device), dsn))
          } else remove(pending.ids)
          setPending(null)
        }}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}

// Sets --ie-fit on the element: the height left from its top to the bottom
// of the scrolling page area it sits in (at least 420px). Kept up to date
// as the window or anything above it (e.g. notices) changes size.
function useFitBelow(ref) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let scroller = el.parentElement
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement
    const measure = () => {
      const box = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight }
      const pad = scroller ? parseFloat(getComputedStyle(scroller).paddingBottom) || 0 : 16
      const top = el.getBoundingClientRect().top + (scroller ? scroller.scrollTop : 0)
      const fit = Math.max(420, Math.floor(box.bottom - pad - top))
      el.style.setProperty('--ie-fit', `${fit}px`)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(document.documentElement)
    if (el.parentElement) ro.observe(el.parentElement)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [ref])
}
