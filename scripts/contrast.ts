import { LIGHT_TONES, TONES } from '../hooks/git'
import { GIT_COLOR } from '../hooks/icons'
import { ADD_COLOR, DEL_COLOR } from '../hooks/palette'
import { DEFAULT_THEME } from '../hooks/tree'
import { boxLook, ratio, rgbOf, type Rgb } from '../hooks/pixmap'

type Check = { name: string; color: string; min: number }

const DARK_BACKGROUNDS = { black: '#000000', 'vscode dark': '#1e1e1e', 'one dark': '#282c34' }
const LIGHT_BACKGROUNDS = { white: '#ffffff', 'near white': '#fafafa' }
const TEXT = 3
const DIM = 2
const AAA = 7

function luminance(hex: string): number {
  const v = parseInt(hex.slice(1).replace(/^(.)(.)(.)$/, '$1$1$2$2$3$3'), 16)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = [16, 8, 0].map(s => lin(((v >> s) & 255) / 255))
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05)
}

const PALETTE = [
  ['accent', DEFAULT_THEME.accent],
  ['muted', DEFAULT_THEME.muted],
  ['urgent', DEFAULT_THEME.urgent],
  ['selection', DEFAULT_THEME.selection],
  ['add', ADD_COLOR],
  ['del', DEL_COLOR],
  ...Object.entries(GIT_COLOR).map(([k, color]) => [`git ${k}`, color]),
]

function checks(tones: typeof TONES, text: number, dim: number): Check[] {
  const out: Check[] = []
  for (const [tone, t] of Object.entries(tones)) {
    out.push({ name: `${tone} solid`, color: t.solid, min: text })
    t.bright.forEach((color, i) => out.push({ name: `${tone} bright ${i}`, color, min: text }))
    t.dim.forEach((color, i) => out.push({ name: `${tone} dim ${i}`, color, min: dim }))
  }
  return out
}

const suites = [
  { name: 'dark', backgrounds: DARK_BACKGROUNDS, checks: checks(TONES, TEXT, DIM) },
  { name: 'light', backgrounds: LIGHT_BACKGROUNDS, checks: checks(LIGHT_TONES, AAA, AAA) },
]

let failed = 0
const owned = PALETTE.filter(([, color]) => !/^ansi256\(\d+\)$/.test(color ?? '') && color !== '')
for (const [name] of owned) console.log(`FAIL ${name} is a fixed color; defaults must be terminal palette indices or empty for dimColor`)
failed += owned.length
console.log(`palette indices: ${PALETTE.map(([n, c]) => `${n}=${c || 'dimColor'}`).join(', ')} (the terminal theme owns these)`)
for (const suite of suites) {
  console.log(`\n${suite.name} palette`)
  for (const c of suite.checks) {
    const ratios = Object.entries(suite.backgrounds).map(([bg, hex]) => [bg, contrast(c.color, hex)] as const)
    const worst = ratios.reduce((a, b) => (b[1] < a[1] ? b : a))
    const ok = worst[1] >= c.min
    if (!ok) failed++
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${c.name.padEnd(16)} ${c.color}  worst ${worst[1].toFixed(2)}:1 on ${worst[0]} (needs ${c.min}:1)`)
  }
}
const THEMES: Record<string, string[]> = {
  xterm: ['#000000', '#e5e5e5', '#0000ee', '#7f7f7f', '#ffffff', '#cd0000', '#00cd00', '#cdcd00'],
  'tokyo-night': ['#1a1b26', '#a9b1d6', '#7aa2f7', '#414868', '#c0caf5', '#f7768e', '#9ece6a', '#e0af68'],
  catppuccin: ['#1e1e2e', '#cdd6f4', '#89b4fa', '#585b70', '#cdd6f4', '#f38ba8', '#a6e3a1', '#f9e2af'],
  gruvbox: ['#282828', '#d4be98', '#7daea3', '#665c54', '#d4be98', '#ea6962', '#a9b665', '#d8a657'],
  nord: ['#2e3440', '#d8dee9', '#81a1c1', '#4c566a', '#d8dee9', '#bf616a', '#a3be8c', '#ebcb8b'],
  everforest: ['#2d353b', '#d3c6aa', '#7fbbb3', '#475258', '#d3c6aa', '#e67e80', '#a7c080', '#dbbc7f'],
  'catppuccin-latte': ['#eff1f5', '#4c4f69', '#1e66f5', '#acb0be', '#4c4f69', '#d20f39', '#40a02b', '#df8e1d'],
  'rose-pine': ['#faf4ed', '#575279', '#56949f', '#cecacd', '#575279', '#b4637a', '#286983', '#ea9d34'],
  'flexoki-light': ['#fffcf0', '#100f0f', '#205ea6', '#b7b5ac', '#100f0f', '#d14d41', '#879a39', '#d0a215'],
}
console.log('\ntheme-owned colors, reported not gated (dim is the Claude theme inactive grey that dimColor draws, #999999 dark and #666666 light)')
console.log(`${'theme'.padEnd(17)}${['fg', 'red 1', 'green 2', 'yellow 3', 'blue 4', 'bright black 8', 'dim'].map(h => h.padStart(15)).join('')}`)
for (const [name, [bg = '', fg = '', blue = '', black = '', , red = '', green = '', yellow = '']] of Object.entries(THEMES)) {
  const dim = contrast(bg, '#000000') > contrast(bg, '#ffffff') ? '#666666' : '#999999'
  console.log(`${name.padEnd(17)}${[fg, red, green, yellow, blue, black, dim].map(c => `${contrast(c, bg).toFixed(2)}:1`.padStart(15)).join('')}`)
}
const LABEL = 4.5
const EDGE = 1.4
console.log('\ntreemap boxes (background, foreground, blue, bright black, bright white)')
for (const [name, hexes] of Object.entries(THEMES)) {
  const [paper, fg, blue, , white] = hexes.map(h => rgbOf(h) as Rgb) as Rgb[]
  const inks = [fg, paper, white, paper] as Rgb[]
  const looks = [0, 0.05, 0.3, 1].map(share => boxLook(paper as Rgb, blue as Rgb, inks, 0, share))
  const nested = boxLook(paper as Rgb, blue as Rgb, inks, 1, 0.1)
  const label = Math.min(...[...looks, nested].map(l => ratio(l.ink, l.fill)))
  const edge = Math.min(...looks.map(l => ratio(l.fill, paper as Rgb)))
  const nest = Math.min(...looks.map(l => ratio(l.fill, nested.fill)))
  const ok = label >= LABEL && edge >= EDGE && nest >= EDGE
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(16)} label ${label.toFixed(2)}:1 (needs ${LABEL}), box on background ${edge.toFixed(2)}:1, nested box ${nest.toFixed(2)}:1 (need ${EDGE})`)
}
console.log(failed ? `\n${failed} color${failed === 1 ? '' : 's'} below the contrast gate` : '\nevery color passes')
process.exit(failed ? 1 : 0)
