import { expect, test } from 'claude-code/testing'

import { TONES } from '../hooks/git'
import { GIT_COLOR } from '../hooks/icons'
import { DEFAULT_THEME, faint } from '../hooks/tree'

const BASE = '#1d2021'
const FG = '#ebdbb2'

const channel = (value: number) => {
  const v = value / 255

  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))

  return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!)
}

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)

  return (hi! + 0.05) / (lo! + 0.05)
}

test('the tones keep their seven names, so every git verb still finds its ramp', () => {
  expect(Object.keys(TONES).sort()).toEqual(['blue', 'cyan', 'green', 'orange', 'purple', 'red', 'teal'])
  for (const tone of Object.values(TONES)) {
    expect(tone.bright).toHaveLength(4)
    expect(tone.dim).toHaveLength(4)
  }
})

test('every shimmer step and solid tone reads at least 3:1 on Gruvbox Dark Hard', () => {
  for (const [name, tone] of Object.entries(TONES)) {
    for (const step of [...tone.bright, ...tone.dim, tone.solid]) {
      expect({ name, step, ok: contrast(step, BASE) >= 3 }).toEqual({ name, step, ok: true })
    }
  }
})

test('git status colours read at least 3:1 on the background and on a selected row', () => {
  for (const [status, colour] of Object.entries(GIT_COLOR)) {
    expect({ status, ok: contrast(colour, BASE) >= 3 }).toEqual({ status, ok: true })
    expect({ status, ok: contrast(colour, DEFAULT_THEME.selection) >= 3 }).toEqual({ status, ok: true })
  }
})

test('the default theme is Gruvbox with its own background, leaves fg to the terminal, and its text reads on a selected row', () => {
  expect(DEFAULT_THEME).toEqual({ fg: '', accent: '#83a598', muted: '#928374', urgent: '#fb4934', selection: '#3c3836', bg: BASE })
  for (const text of [FG, DEFAULT_THEME.accent, DEFAULT_THEME.muted, DEFAULT_THEME.urgent]) {
    expect({ text, ok: contrast(text, DEFAULT_THEME.selection) >= 3 }).toEqual({ text, ok: true })
  }
  for (const text of [DEFAULT_THEME.accent, DEFAULT_THEME.muted, DEFAULT_THEME.urgent]) {
    expect({ text, ok: contrast(text, BASE) >= 3 }).toEqual({ text, ok: true })
  }
})

test('the hover highlight stays visible against the background and subtler than the selection', () => {
  const hover = faint(DEFAULT_THEME.selection)

  expect(contrast(hover, BASE)).toBeGreaterThanOrEqual(1.2)
  expect(contrast(hover, BASE)).toBeLessThan(contrast(DEFAULT_THEME.selection, BASE))
})
