import { ArrowRight, Bookmark, ChevronDown, MonitorSmartphone, MoreHorizontal, Palette, RotateCcw } from 'lucide-react'
import ColorPicker from '../../lib/ColorPicker.jsx'
import MenuButton from '../../lib/MenuButton.jsx'
import { DESIGN_STYLES } from '../../lib/designStyles.js'
import { GRADIENT_PRESETS } from '../../lib/gradient.js'
import ShowIf from '../builder/ShowIf.jsx'
import LayoutPicker from './LayoutPicker.jsx'
import PanelGroup, { InfoTip } from './PanelGroup.jsx'
import StylePicker from './StylePicker.jsx'

// Design screens → the right panel when no block is selected: this screen's
// layout, style, where Next goes, when it shows and its background. Groups
// fold (Layout and Background open at first); the screen's actions are in
// the ⋯ menu; longer notes are ⓘ tips. (mockups/interview-editor-mockup.html)
const SHORT = { card: 'Card', focus: 'Big question', side: 'Picture', photo: 'Photo', cover: 'Cover' }
const HOW_TO =
  'Click a block to edit it. Drag to move: it snaps to edges, centres and other blocks (hold Alt to place freely). Shift-click, or drag a box on empty space, to select several. Drag corners to resize, the round knob to rotate. Ctrl + scroll zooms; hold Space (or press H) and drag to move around.'

export default function ScreenPanel({
  screen,
  screens,
  design,
  section, // this screen's section (none on the first screen)
  sections,
  branching, // questions here whose answers pick the next section
  showIf, // the screen's "Show only if…" (lib/showIf.js), or null on the first
  desktopUntouched,
  bgPresets,
  styleRestorable,
  onLayout, // (key) asks first
  onStyle, // (key, 'screen' | 'all')
  onRestoreStyle,
  onNext, // (target) section.next: 'next' | 'submit' | section id
  onHidden, // (hidden)
  onBackground,
  onKeepScreen,
  onKeepLook,
  onCopyToDesktop,
  onStartOver,
}) {
  const visibility = design.hidden ? 'Skipped' : showIf?.rules.length ? 'Only when…' : 'In the flow'
  return (
    <div className="inspector screen-panel">
      <div className="sp-head">
        <strong>Screen {screen.index + 1}</strong>
        <InfoTip text={HOW_TO} label="How to design" />
        <MenuButton
          icon={<MoreHorizontal size={17} />}
          label="More for this screen"
          items={[
            { label: 'Keep this screen', icon: Bookmark, onSelect: onKeepScreen },
            { label: 'Keep this look', icon: Palette, onSelect: onKeepLook },
            { label: 'Copy phone design to desktop', icon: MonitorSmartphone, onSelect: onCopyToDesktop },
            { label: 'Start this screen over', icon: RotateCcw, danger: true, onSelect: onStartOver },
          ]}
        />
      </div>
      {desktopUntouched && (
        <p className="sp-note">
          Desktop isn’t designed yet: computers show the starter layout.{' '}
          <button type="button" className="link-btn" onClick={onCopyToDesktop}>
            Copy the phone design
          </button>
        </p>
      )}

      <PanelGroup id="screen-layout" title="Layout" value={SHORT[design.layout]} defaultOpen>
        <LayoutPicker current={design.layout} onPick={onLayout} />
      </PanelGroup>

      <PanelGroup id="screen-style" title="Style" value={DESIGN_STYLES[design.style]?.label ?? 'Your own'}>
        <StylePicker key={screen.key} current={design.style} onApply={onStyle} restorable={styleRestorable} onRestore={onRestoreStyle} />
      </PanelGroup>

      <PanelGroup
        id="screen-next"
        title="After this screen"
        tip={`${section ? `The same setting as “After section ${screen.index + 1}” in Edit questions. ` : ''}Next buttons follow it; a button set to “Jump to a screen…” goes straight there.`}
      >
        <Destination screen={screen} screens={screens} section={section} sections={sections} onNext={onNext} />
        {branching.length > 0 && (
          <p className="sp-note">
            Answers to {branching.map((q) => `“${q.title || 'Untitled question'}”`).join(', ')} can send people elsewhere
            (set in Edit questions).
          </p>
        )}
      </PanelGroup>

      {screen.index > 0 && (
        <PanelGroup id="screen-visibility" title="Visibility" value={visibility}>
          <div className="vis-grid" role="radiogroup" aria-label="When this screen shows">
            <VisCard on={!design.hidden} onClick={() => onHidden(false)} title="In the flow" text="Everyone sees it" />
            <VisCard on={Boolean(design.hidden)} onClick={() => onHidden(true)} title="Skipped" text="Until a button or answer shows it" ghost />
          </div>
          {showIf && <ShowIf {...showIf} noun="screen" />}
        </PanelGroup>
      )}

      <PanelGroup id="screen-background" title="Background" defaultOpen>
        <ColorPicker value={design.bg ?? 'bg'} presets={bgPresets} gradients={GRADIENT_PRESETS} onChange={onBackground} label="Screen background" />
      </PanelGroup>

      <p className="panel-foot">
        <kbd>Ctrl</kbd>+<kbd>/</kbd> all shortcuts
      </p>
    </div>
  )
}

// "Next goes to": the destination as a card; the list of screens opens below.
function Destination({ screen, screens, section, sections, onNext }) {
  const name = (s) => `Screen ${s.index + 1} · ${s.title}`
  const following = screens[screen.index + 1]
  if (!section) {
    return (
      <div className="dest is-fixed">
        <span className="dest-go">
          <ArrowRight size={16} />
        </span>
        <span className="dest-what">
          <small>Next goes to</small>
          <span>{following ? name(following) : 'Submit the form'}</span>
        </span>
      </div>
    )
  }
  const value = section.next ?? 'next'
  const known = value === 'next' || value === 'submit' || sections.some((s) => s.id === value)
  const current = known ? value : 'next'
  const label = (v) =>
    v === 'next'
      ? following
        ? `${name(following)} (the next)`
        : 'Submit the form (last screen)'
      : v === 'submit'
        ? 'Submit the form'
        : name(screens.find((s) => s.key === v))
  const options = ['next', ...screens.filter((s) => s.index > 0 && s.key !== screen.key).map((s) => s.key), 'submit']
  return (
    <MenuButton
      className="dest-menu"
      align="left"
      label="Where Next goes"
      icon={
        <span className="dest">
          <span className="dest-go">
            <ArrowRight size={16} />
          </span>
          <span className="dest-what">
            <small>Next goes to</small>
            <span>{label(current).replace(' (the next)', '')}</span>
          </span>
          <ChevronDown size={16} className="dest-chev" />
        </span>
      }
      items={options.map((v) => ({ label: label(v), checked: v === current, onSelect: () => onNext(v) }))}
    />
  )
}

function VisCard({ on, onClick, title, text, ghost = false }) {
  return (
    <button type="button" role="radio" aria-checked={on} className={`vis-card${on ? ' is-on' : ''}`} onClick={onClick}>
      <span className="vis-dot" aria-hidden="true" />
      <span className="vis-pic" aria-hidden="true">
        <i />›<i className={ghost ? 'is-ghost' : 'is-lit'} />›<i />
      </span>
      <strong>{title}</strong>
      <small>{text}</small>
    </button>
  )
}
