import { describe, expect, it } from 'vitest'
import { accentPair, contrast, normalizeHex } from '../../src/lib/color.js'
import { colorOf, themeOf, themeStyle } from '../../src/lib/theme.js'

describe('normalizeHex', () => {
  it('accepts #rrggbb, rrggbb and #rgb in any case', () => {
    expect(normalizeHex('#4F46E5')).toBe('#4f46e5')
    expect(normalizeHex('4f46e5')).toBe('#4f46e5')
    expect(normalizeHex('#fA0')).toBe('#ffaa00')
  })

  it('rejects anything else', () => {
    for (const bad of ['', 'red', '#12345', '#ggg000', null, 42]) expect(normalizeHex(bad)).toBeNull()
  })
})

describe('accentPair', () => {
  // A spread of colours, including the hard ones: near-white, near-black,
  // bright yellow and lime.
  const samples = ['#ffffff', '#000000', '#ffff00', '#a3e635', '#22d3ee', '#7c3aed', '#f43f5e', '#808080']

  it.each(samples)('%s keeps button text readable in both modes', (hex) => {
    const { light, dark } = accentPair(hex)
    expect(contrast(light, '#ffffff')).toBeGreaterThanOrEqual(4.6)
    expect(contrast(dark, '#0e0f13')).toBeGreaterThanOrEqual(6.4)
  })

  it('leaves colours that already pass unchanged', () => {
    expect(accentPair('#4f46e5').light).toBe('#4f46e5')
  })
})

describe('custom theme colours', () => {
  it('keeps a valid custom colour and drops an invalid one', () => {
    expect(themeOf({ theme: { color: '#0EA5E9' } }).color).toBe('#0ea5e9')
    expect(themeOf({ theme: { color: 'not-a-colour' } }).color).toBe('indigo')
    expect(themeOf({ theme: { color: 'teal' } }).color).toBe('teal')
  })

  it('derives the accent from a custom colour', () => {
    const style = themeStyle(themeOf({ theme: { color: '#0ea5e9' } }), false)
    expect(style['--accent']).toBe(colorOf('#0ea5e9').light)
    expect(contrast(style['--accent'], '#ffffff')).toBeGreaterThanOrEqual(4.6)
  })
})
