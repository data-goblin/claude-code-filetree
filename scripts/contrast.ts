import { LIGHT_TONES, TONES } from '../hooks/git'
import { GIT_COLOR, LIGHT_GIT_COLOR } from '../hooks/icons'
import { ADD_COLOR, DEL_COLOR, LIGHT_ADD_COLOR, LIGHT_DEL_COLOR, LIGHT_HOVER } from '../hooks/palette'
import { DEFAULT_THEME, LIGHT_THEME } from '../hooks/tree'

type Check = { name: string; color: string; min: number }

const DARK_BACKGROUNDS = { black: '#000000', 'vscode dark': '#1e1e1e', 'one dark': '#282c34' }
const LIGHT_BACKGROUNDS = { white: '#ffffff', 'near white': '#fafafa', hover: LIGHT_HOVER, selection: LIGHT_THEME.selection }
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

function checks(theme: typeof DEFAULT_THEME, tones: typeof TONES, git: Record<string, string>, add: string, del: string, text: number, dim: number): Check[] {
  const out: Check[] = [
    { name: 'accent', color: theme.accent, min: text },
    { name: 'muted', color: theme.muted, min: text },
    { name: 'urgent', color: theme.urgent, min: text },
    { name: 'add', color: add, min: text },
    { name: 'del', color: del, min: text },
    ...Object.entries(git).map(([k, color]) => ({ name: `git ${k}`, color, min: text })),
  ]
  for (const [tone, t] of Object.entries(tones)) {
    out.push({ name: `${tone} solid`, color: t.solid, min: text })
    t.bright.forEach((color, i) => out.push({ name: `${tone} bright ${i}`, color, min: text }))
    t.dim.forEach((color, i) => out.push({ name: `${tone} dim ${i}`, color, min: dim }))
  }
  return out
}

const suites = [
  { name: 'dark', backgrounds: DARK_BACKGROUNDS, checks: checks(DEFAULT_THEME, TONES, GIT_COLOR, ADD_COLOR, DEL_COLOR, TEXT, DIM) },
  { name: 'light', backgrounds: LIGHT_BACKGROUNDS, checks: checks(LIGHT_THEME, LIGHT_TONES, LIGHT_GIT_COLOR, LIGHT_ADD_COLOR, LIGHT_DEL_COLOR, AAA, AAA) },
]

let failed = 0
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
console.log(failed ? `\n${failed} color${failed === 1 ? '' : 's'} below the contrast gate` : '\nevery color passes')
process.exit(failed ? 1 : 0)
