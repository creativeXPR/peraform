import { describe, expect, it } from 'vitest'
import {
  PRESETS,
  designedProps,
  endDuration,
  keyframesFor,
  newAnimation,
  timingFor,
} from '../../src/lib/animations.js'

const node = { type: 'card', style: { opacity: 1, radius: 20, bg: 'surface' } }

describe('keyframes', () => {
  it('fills the unset side from the block as designed', () => {
    const anim = newAnimation('fadeIn')
    const [from, to] = keyframesFor(anim, { r: 0 }, designedProps(node))
    expect(from).toEqual({ opacity: 0 })
    expect(to).toEqual({ opacity: 1 })
  })

  it('keeps the block’s own rotation inside the transform', () => {
    const [from, to] = keyframesFor(newAnimation('slideUp'), { r: 15 }, designedProps(node))
    expect(from.transform).toBe('translate(0px, 40px) rotate(15deg) scale(1)')
    expect(to.transform).toBe('translate(0px, 0px) rotate(15deg) scale(1)')
  })

  it('animates colours through theme tokens', () => {
    const anim = { ...newAnimation('fadeIn'), from: { bg: '#ff0000' }, to: { bg: 'accent' } }
    const [from, to] = keyframesFor(anim, { r: 0 }, designedProps(node))
    expect(from.backgroundColor).toBe('#ff0000')
    expect(to.backgroundColor).toBe('var(--accent)')
  })
})

describe('timing', () => {
  it('loops forever, back and forth when asked', () => {
    expect(timingFor(newAnimation('pulse'))).toMatchObject({ iterations: Infinity, direction: 'alternate' })
    expect(timingFor(newAnimation('spin'))).toMatchObject({ iterations: Infinity, direction: 'normal' })
  })

  it('holds entrances before their delay and exits at their end', () => {
    expect(timingFor(newAnimation('fadeIn')).fill).toBe('backwards')
    expect(timingFor(newAnimation('fadeOut')).fill).toBe('forwards')
  })

  it('waits for the longest exit, but never more than 3 seconds', () => {
    const design = {
      nodes: {
        a: { animations: [{ ...newAnimation('fadeOut'), delay: 100 }] },
        b: { animations: [newAnimation('pulse')] },
      },
    }
    expect(endDuration(design)).toBe(450)
    design.nodes.a.animations[0].duration = 9000
    expect(endDuration(design)).toBe(3000)
  })

  it('every preset is complete', () => {
    for (const key of Object.keys(PRESETS)) {
      const a = newAnimation(key)
      expect(a.name && a.when && a.duration > 0).toBeTruthy()
    }
  })
})
