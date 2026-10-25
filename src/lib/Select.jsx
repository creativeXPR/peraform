import { Children, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { placeMenu } from './placeMenu.js'
import './MenuButton.css'
import './Select.css'

// The app's dropdown, in place of the browser's own <select> (whose open
// list ignores the design: fonts, colours, dark mode). Same props and
// <option> children as <select>, so swapping is one word:
//   <Select value onChange={(e) => …e.target.value} aria-label className disabled>
//     <option value="a">A</option> <option value="b" disabled>B</option>
//   </Select>
// onChange gets { target: { value } }, like a <select>'s change event.
// Keyboard: arrows, Home/End, Enter/Space, Escape, Tab, and typing a
// letter jumps to the next option starting with it.

// <option> children (through fragments, arrays and false/null) as a list.
function readOptions(children) {
  const out = []
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    if (child.type === 'option') {
      const label = Children.toArray(child.props.children).join('')
      out.push({ value: String(child.props.value ?? label), label, disabled: Boolean(child.props.disabled) })
    } else if (child.props?.children) out.push(...readOptions(child.props.children))
  })
  return out
}

// Like MenuButton: drawn outside any scrolling panel, inside the themed frame.
function portalTarget(el) {
  const full = document.fullscreenElement
  if (full?.contains(el)) return full
  return el.closest('.shell, .respond') ?? document.body
}

export default function Select({ value, onChange, children, className = '', disabled = false, title, ...aria }) {
  const options = readOptions(children)
  const current = String(value ?? '')
  const selected = options.find((o) => o.value === current)
  const [target, setTarget] = useState(null) // portal target while open
  const [active, setActive] = useState(-1) // highlighted option index
  const open = Boolean(target)
  const buttonRef = useRef(null)
  const listRef = useRef(null)
  const listId = useId()

  const enabled = (i) => i >= 0 && i < options.length && !options[i].disabled
  const step = (from, dir) => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) if (enabled(i)) return i
    return from
  }

  function show() {
    if (disabled) return
    setActive(Math.max(0, options.findIndex((o) => o.value === current)))
    setTarget(portalTarget(buttonRef.current))
  }
  function close(refocus = true) {
    setTarget(null)
    if (refocus) buttonRef.current?.focus()
  }
  function choose(i) {
    if (!enabled(i)) return
    if (options[i].value !== current) onChange?.({ target: { value: options[i].value } })
    close()
  }

  // Placed against the button (below, or above when there's more room),
  // at least as wide as it; the list then takes the keyboard.
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const b = buttonRef.current.getBoundingClientRect()
    list.style.minWidth = `${Math.round(b.width)}px`
    placeMenu(list, b, 'left')
    list.focus({ preventScroll: true })
  }, [open])

  // Keep the highlighted option in view.
  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  // Close on a click elsewhere, or when the page scrolls or resizes.
  useEffect(() => {
    if (!open) return
    const inside = (node) => buttonRef.current?.contains(node) || listRef.current?.contains(node)
    const onPointer = (e) => !inside(e.target) && close(false)
    const onMove = (e) => !listRef.current?.contains(e.target) && close(false)
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open])

  function onButtonKey(e) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault()
      show()
    }
  }

  function onListKey(e) {
    const k = e.key
    if (k === 'ArrowDown' || k === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => step(i, k === 'ArrowDown' ? 1 : -1))
    } else if (k === 'Home' || k === 'End') {
      e.preventDefault()
      setActive(k === 'Home' ? step(-1, 1) : step(options.length, -1))
    } else if (k === 'Enter' || k === ' ') {
      e.preventDefault()
      choose(active)
    } else if (k === 'Escape') {
      e.preventDefault()
      e.stopPropagation() // not the dialog around it
      close()
    } else if (k === 'Tab') {
      close(false)
    } else if (k.length === 1 && /\S/.test(k)) {
      // Type-ahead: the next option starting with that letter.
      const letter = k.toLowerCase()
      for (let n = 1; n <= options.length; n++) {
        const i = (active + n) % options.length
        if (enabled(i) && options[i].label.trim().toLowerCase().startsWith(letter)) {
          setActive(i)
          break
        }
      }
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`ui-select${current === '' ? ' is-placeholder' : ''} ${className}`}
        onClick={() => (open ? close() : show())}
        onKeyDown={onButtonKey}
        disabled={disabled}
        title={title}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        {...aria}
      >
        <span className="ui-select-label">{selected?.label ?? ''}</span>
        <ChevronDown size={15} className="ui-select-chevron" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            className="menu-pop ui-select-list"
            role="listbox"
            tabIndex={-1}
            aria-label={aria['aria-label']}
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            onKeyDown={onListKey}
          >
            {options.map((o, i) => (
              <div
                key={`${o.value}-${i}`}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={o.value === current}
                aria-disabled={o.disabled || undefined}
                className={`menu-item ui-select-option${i === active ? ' is-active' : ''}${o.disabled ? ' is-disabled' : ''}`}
                onPointerEnter={() => enabled(i) && setActive(i)}
                onClick={() => choose(i)}
              >
                <Check size={15} className={o.value === current ? '' : 'menu-check-off'} aria-hidden="true" />
                <span>{o.label}</span>
              </div>
            ))}
          </div>,
          target,
        )}
    </>
  )
}
