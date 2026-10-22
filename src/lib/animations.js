import { colorCss } from './interview.js'

// Animations on interview blocks (node.animations), played with the Web
// Animations API.
//
// Animation = {
//   id, name,
//   when: 'start' (screen opens) | 'loop' (continuously)
//       | 'action' (an action plays it) | 'end' (before leaving the screen),
//   from: Props, to: Props   — empty side = the block as designed
//   duration, delay (ms), easing, alternate (loop: back and forth)
// }
// Props: opacity (%), moveX/moveY (px), scale (%), rotate (°, added to the
// block's own rotation), radius (px), bg, color, size (font px)

export const WHEN = {
  start: 'When the screen opens',
  loop: 'Continuously',
  action: 'When an action plays it',
  end: 'Before leaving the screen',
}

export const ANIM_PROPS = {
  opacity: { label: 'Opacity', unit: '%', min: 0, max: 100, start: 100 },
  moveX: { label: 'Move right', unit: 'px', min: -2000, max: 2000, start: 0 },
  moveY: { label: 'Move down', unit: 'px', min: -2000, max: 2000, start: 0 },
  scale: { label: 'Scale', unit: '%', min: 0, max: 400, start: 100 },
  rotate: { label: 'Rotate', unit: '°', min: -1080, max: 1080, start: 0 },
  radius: { label: 'Radius', unit: 'px', min: 0, max: 999, start: 0 },
  size: { label: 'Font size', unit: 'px', min: 8, max: 200, start: 16 },
  bg: { label: 'Background', color: true, start: 'accent' },
  color: { label: 'Text colour', color: true, start: 'text' },
}

const BOUNCE = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

export const PRESETS = {
  fadeIn: { name: 'Fade in', when: 'start', from: { opacity: 0 }, to: {}, duration: 500, easing: 'ease-out' },
  slideUp: { name: 'Slide up', when: 'start', from: { opacity: 0, moveY: 40 }, to: {}, duration: 600, easing: 'ease-out' },
  slideRight: { name: 'Slide in from left', when: 'start', from: { opacity: 0, moveX: -60 }, to: {}, duration: 600, easing: 'ease-out' },
  pop: { name: 'Pop in', when: 'start', from: { opacity: 0, scale: 60 }, to: {}, duration: 500, easing: BOUNCE },
  pulse: { name: 'Pulse', when: 'loop', from: {}, to: { scale: 106 }, duration: 900, easing: 'ease-in-out', alternate: true },
  float: { name: 'Float', when: 'loop', from: {}, to: { moveY: -10 }, duration: 1600, easing: 'ease-in-out', alternate: true },
  spin: { name: 'Spin', when: 'loop', from: {}, to: { rotate: 360 }, duration: 4000, easing: 'linear', alternate: false },
  wiggle: { name: 'Wiggle', when: 'action', from: { rotate: -6 }, to: { rotate: 6 }, duration: 120, easing: 'ease-in-out', alternate: true },
  jump: { name: 'Jump', when: 'action', from: {}, to: { moveY: -24, scale: 105 }, duration: 220, easing: 'ease-out', alternate: true },
  fadeOut: { name: 'Fade out', when: 'end', from: {}, to: { opacity: 0 }, duration: 350, easing: 'ease-in' },
  slideAway: { name: 'Slide away up', when: 'end', from: {}, to: { opacity: 0, moveY: -40 }, duration: 400, easing: 'ease-in' },
}

export function newAnimation(presetKey = 'fadeIn') {
  const p = PRESETS[presetKey]
  return {
    id: Math.random().toString(36).slice(2, 10),
    preset: presetKey,
    name: p.name,
    when: p.when,
    from: { ...p.from },
    to: { ...p.to },
    duration: p.duration,
    delay: 0,
    easing: p.easing,
    alternate: Boolean(p.alternate),
  }
}

const TRANSFORM_KEYS = ['moveX', 'moveY', 'scale', 'rotate']

// One keyframe for a side of an animation. Leaves out what the side doesn't
// set, so the browser fills it from the block as it is (designed look plus
// any action changes).
//   base: { r (designed rotation), moveX, moveY, scale, rotate } currently
export function keyframe(side, base) {
  const out = {}
  if (side.opacity !== undefined) out.opacity = side.opacity / 100
  if (TRANSFORM_KEYS.some((k) => side[k] !== undefined)) {
    const mx = side.moveX ?? base.moveX ?? 0
    const my = side.moveY ?? base.moveY ?? 0
    const r = (base.r ?? 0) + (side.rotate ?? base.rotate ?? 0)
    const s = (side.scale ?? base.scale ?? 100) / 100
    out.transform = `translate(${mx}px, ${my}px) rotate(${r}deg) scale(${s})`
  }
  if (side.radius !== undefined) out.borderRadius = `${side.radius}px`
  if (side.bg !== undefined) out.backgroundColor = colorCss(side.bg)
  if (side.color !== undefined) out.color = colorCss(side.color)
  if (side.size !== undefined) out.fontSize = `${side.size}px`
  return out
}

// The two keyframes, each completed with what the other side animates, so
// "from opacity 0" ends at the block's own opacity, and so on.
export function keyframesFor(anim, base, designed) {
  const from = { ...anim.from }
  const to = { ...anim.to }
  for (const key of Object.keys(ANIM_PROPS)) {
    if (from[key] !== undefined && to[key] === undefined) to[key] = designed[key]
    if (to[key] !== undefined && from[key] === undefined) from[key] = designed[key]
  }
  return [keyframe(from, base), keyframe(to, base)]
}

// The block's own values, for the side of an animation that isn't set.
export function designedProps(node, override = {}) {
  const s = node.style ?? {}
  const p = override.props ?? {}
  return {
    opacity: p.opacity ?? Math.round((s.opacity ?? 1) * 100),
    moveX: p.moveX ?? 0,
    moveY: p.moveY ?? 0,
    scale: p.scale ?? 100,
    rotate: 0,
    radius: p.radius ?? s.radius ?? 0,
    size: p.size ?? s.size ?? 16,
    bg: p.bg ?? s.bg ?? 'transparent',
    color: p.color ?? s.color ?? 'text',
  }
}

export function timingFor(anim) {
  const loop = anim.when === 'loop'
  return {
    duration: Math.max(0, anim.duration ?? 500),
    delay: Math.max(0, anim.delay ?? 0),
    easing: anim.easing || 'ease',
    iterations: loop ? Infinity : anim.alternate ? 2 : 1,
    direction: anim.alternate ? 'alternate' : 'normal',
    // Entrances hold their first frame through the delay; exits hold their
    // last frame until the screen changes.
    fill: anim.when === 'start' ? 'backwards' : anim.when === 'end' ? 'forwards' : 'none',
  }
}

// Plays one animation on an element; resolves when it has finished.
export function play(el, anim, base, designed) {
  if (!el?.animate) return Promise.resolve()
  const a = el.animate(keyframesFor(anim, base, designed), timingFor(anim))
  return a.finished.catch(() => {})
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// How long the "before leaving" animations on a screen take (ms), capped so
// a slow animation can't trap respondents.
export const MAX_END_WAIT = 3000
export function endDuration(design) {
  let longest = 0
  for (const node of Object.values(design.nodes)) {
    for (const anim of node.animations ?? []) {
      if (anim.when === 'end') longest = Math.max(longest, (anim.delay ?? 0) + (anim.duration ?? 0))
    }
  }
  return Math.min(longest, MAX_END_WAIT)
}
