import { describe, expect, it } from 'vitest'
import { darkDesign, darkOverrides, flipHex, isLightDesign } from '../../src/lib/darkMode.js'
import { applyStyle } from '../../src/lib/designStyles.js'
import { screensOf, starterScreen } from '../../src/lib/interview.js'

const form = { title: 'Welcome', questions: [{ id: 'q1', type: 'shortText', title: 'Name' }] }
const start = starterScreen(form, screensOf(form)[0], true)
const light = (hex) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16)

describe('dark mode for designed screens', () => {
  it('flips lightness and keeps the hue', () => {
    expect(light(flipHex('#e0f2fe'))).toBeLessThan(150) // pale blue → deep
    expect(light(flipHex('#1e3a8a'))).toBeGreaterThan(450) // navy → pale
    const navy = flipHex('#e0f2fe')
    expect(parseInt(navy.slice(5, 7), 16)).toBeGreaterThan(parseInt(navy.slice(1, 3), 16)) // still blue
  })

  it('darkens light styles (gradients, cards, text) and leaves dark ones', () => {
    for (const key of ['classroom', 'official', 'flow', 'playful']) {
      const styled = applyStyle(start, key)
      expect(isLightDesign(styled)).toBe(true)
      const dark = darkDesign(styled)
      expect(dark.dark).toBe(true)
      expect(dark.bg).not.toBe(styled.bg)
      for (const n of Object.values(dark.nodes)) {
        if (n.style?.scheme) expect(n.style.scheme).toBe(styled.nodes[n.id].style.scheme === 'light' ? 'dark' : 'light')
      }
    }
    const midnight = applyStyle(start, 'midnight')
    expect(darkDesign(midnight)).toBe(midnight)
    expect(darkDesign(start)).toBe(start) // theme colours only: already follows dark mode
  })

  it('flips colours set by actions', () => {
    const out = darkOverrides({ a: { hidden: false, props: { bg: '#ffffff' } }, b: { hidden: true } })
    expect(light(out.a.props.bg)).toBeLessThan(100)
    expect(out.b).toEqual({ hidden: true })
  })
})
