import type { FileNode } from '../types'

import { isMemory } from './icons'
import { type Rgb, ratio, rgbOf } from './pixmap'

const NS = 'http://www.w3.org/2000/svg'

const FILE = 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6'
const FOLDER = 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z'

export const ICONS = {
  'chevron-right': 'm9 18 6-6-6-6',
  'chevron-down': 'm6 9 6 6 6-6',
  folder: FOLDER,
  'folder-line': FOLDER,
  'folder-open': 'm6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2',
  'folder-up': `${FOLDER}M12 10v6M9 13l3-3 3 3`,
  'root-folder': `${FOLDER}M12 11a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5`,
  'folder-up-line': `${FOLDER}M12 17v-6M9 13.5l3-3 3 3`,
  fold: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M12 7v5l4 2',
  'folder-minus': `${FOLDER}M9 13h6`,
  'square-plus': 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2M8 12h8M12 8v8',
  'square-minus': 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2M8 12h8',
  'folder-git': `${FOLDER}M12 11a2 2 0 1 0 0 4 2 2 0 1 0 0-4M8 13h2M14 13h2`,
  file: FILE,
  'file-text': `${FILE}M8 13h8M8 17h5`,
  'file-code': `${FILE}M10 12.5l-2 2 2 2M14 16.5l2-2-2-2`,
  'file-json': `${FILE}M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1`,
  'file-config': `${FILE}M8 13h8M8 17h8M10.5 12v2M13.5 16v2`,
  'file-terminal': `${FILE}M8 13l2 2-2 2M12 17h4`,
  'file-data': `${FILE}M8 12h8v6H8zM8 15h8M12 12v6`,
  'file-image': `${FILE}M10 11.5a1.5 1.5 0 1 0 0 .01M20 16l-2.3-2.3a1.5 1.5 0 0 0-2.1 0L9 20`,
  'file-video': `${FILE}M10 12l5 3-5 3z`,
  'file-audio': `${FILE}M12 18v-6l3 1M10 16.5a1.5 1.5 0 1 0 2 1.5`,
  'file-archive': `${FILE}M11 4v1M11 7v1M11 10v1M10 13h2v3h-2z`,
  'file-lock': `${FILE}M9 14h6v5H9zM10 14v-1.5a2 2 0 0 1 4 0V14`,
  'file-package': `${FILE}M12 11.5l3.5 1.75v3.5L12 18.5l-3.5-1.75v-3.5zM8.5 13.25L12 15l3.5-1.75M12 15v3.5`,
  'file-git': `${FILE}M12 11v2.5M12 16.5V19M12 13.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 1 0 0-3`,
  'file-link': `${FILE}M11 18l3-3-3-3M14 15H8`,
  ban: 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20M4.9 4.9l14.2 14.2',
  cursor: 'M12.586 12.586 19 19M3.688 3.037a.497.497 0 0 0-.651.651l6.5 15.999a.501.501 0 0 0 .947-.062l1.569-6.083a2 2 0 0 1 1.448-1.479l6.124-1.579a.5.5 0 0 0 .063-.947z',
  crosshair: 'M12 4a8 8 0 1 0 0 16 8 8 0 1 0 0-16M12 2v4M12 18v4M2 12h4M18 12h4',
  refresh: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6',
  'eye-off': 'M10.7 5.1A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a13 13 0 0 1-1.7 2.7M14.1 14.2a3 3 0 0 1-4.2-4.2M17.5 17.5A10.7 10.7 0 0 1 12 19c-6.5 0-10-7-10-7a13 13 0 0 1 4.5-5.5M2 2l20 20',
  columns: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2M15 3v18',
  collapse: 'm7 20 5-5 5 5M7 4l5 5 5-5',
  panel: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2M3 15h18',
  keyboard: 'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2M6 9h.01M10 9h.01M14 9h.01M18 9h.01M8 13h.01M12 13h.01M16 13h.01M7 16h10',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 1 0 0-14M20 20l-4-4',
  x: 'M18 6 6 18M6 6l12 12',
  'git-branch': 'M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18 9a9 9 0 0 1-9 9',
  'git-commit': 'M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6M3 12h6M15 12h6',
  'git-merge': 'M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 21V9a9 9 0 0 0 9 9',
  'git-pr': 'M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6M13 6h3a2 2 0 0 1 2 2v7M6 9v12',
  'arrow-up': 'm5 12 7-7 7 7M12 19V5',
  'chevron-left': 'm15 18-6-6 6-6',
  'page-down': 'm7 6 5 5 5-5M7 13l5 5 5-5',
  'page-up': 'm17 18-5-5-5 5M17 11l-5-5-5 5',
  diff: 'M12 3v14M5 10h14M5 21h14',
  pencil: 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z',
  'external-link': 'M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
  'arrow-down': 'M12 5v14M19 12l-7 7-7-7',
  cloud: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z',
  globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
  archive: 'M3 3h18v5H3zM4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4',
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  brain: 'M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18ZM12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18ZM15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4M17.599 6.5a3 3 0 0 0 .399-1.375M6.003 5.125A3 3 0 0 0 6.401 6.5M3.477 10.896a4 4 0 0 1 .585-.396M19.938 10.5a4 4 0 0 1 .585.396M6 18a4 4 0 0 1-1.967-.516M19.967 17.484A4 4 0 0 1 18 18',
  warning: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01',
  mark: 'M12 7a5 5 0 1 0 0 10 5 5 0 1 0 0-10',
  tag: 'M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4zM7.5 6.5a1 1 0 1 0 0 2 1 1 0 1 0 0-2',
} as const

export type IconName = keyof typeof ICONS

const FILLED: ReadonlySet<IconName> = new Set(['folder', 'mark'])

const NAMES: Record<string, IconName> = {
  'agents.md': 'file-text',
  'changelog.md': 'file-text',
  'contributing.md': 'file-text',
  'readme.md': 'file-text',
  'todo.md': 'file-text',
  license: 'file-lock',
  'license.md': 'file-lock',
  'license.txt': 'file-lock',
  dockerfile: 'file-config',
  makefile: 'file-config',
  'cmakelists.txt': 'file-config',
  justfile: 'file-config',
  gemfile: 'file-package',
  rakefile: 'file-code',
  'cargo.toml': 'file-package',
  'cargo.lock': 'file-lock',
  'pyproject.toml': 'file-package',
  'requirements.txt': 'file-package',
  'go.mod': 'file-package',
  'go.sum': 'file-lock',
  'package.json': 'file-package',
  'package-lock.json': 'file-lock',
  'tsconfig.json': 'file-config',
  'pnpm-lock.yaml': 'file-lock',
  'yarn.lock': 'file-lock',
  'bun.lock': 'file-lock',
  'uv.lock': 'file-lock',
  '.gitignore': 'file-git',
  '.gitmodules': 'file-git',
  '.gitattributes': 'file-git',
  '.editorconfig': 'file-config',
  '.prettierrc': 'file-config',
  '.eslintrc': 'file-config',
}

const EXT_GROUPS: [IconName, string][] = [
  ['file-code', 'lua py pyi js mjs cjs ts mts cts jsx tsx go rs rb php java kt swift cs c h cpp cc cxx hpp vue svelte qml html htm css scss graphql gql xml'],
  ['file-json', 'json jsonc json5'],
  ['file-config', 'yaml yml toml ini conf cfg env'],
  ['file-terminal', 'sh bash zsh fish ps1'],
  ['file-text', 'md markdown mdx txt rst pdf doc docx odt rtf'],
  ['file-data', 'sql csv tsv parquet db sqlite xlsx'],
  ['file-image', 'svg jpg jpeg png gif webp ico bmp avif'],
  ['file-video', 'mp4 mkv mov webm avi'],
  ['file-audio', 'mp3 wav flac ogg m4a'],
  ['file-archive', 'zip gz xz tar tgz bz2 7z rar'],
  ['file-lock', 'lock pem key crt'],
]

const EXTS: Record<string, IconName> = Object.fromEntries(EXT_GROUPS.flatMap(([icon, list]) => list.split(' ').map(ext => [ext, icon])))

export function nodeIcon(n: FileNode, isRepo: boolean): IconName {
  if (n.kind === 'dir') return isRepo ? 'folder-git' : n.hidden ? 'folder-line' : 'folder'
  if (n.kind === 'link') return 'file-link'
  if (isMemory(n)) return 'brain'
  const lower = n.name.toLowerCase()
  const named = NAMES[lower]
  if (named) return named
  const dot = lower.lastIndexOf('.')
  return (dot >= 0 ? EXTS[lower.slice(dot + 1)] : undefined) ?? 'file'
}

const GIT_ICONS: Record<string, IconName> = {
  '●': 'git-commit',
  '↑': 'arrow-up',
  '↓': 'arrow-down',
  '⑂': 'git-branch',
  '⑃': 'git-merge',
  '⇄': 'git-pr',
  '◎': 'globe',
  '≡': 'archive',
  '↶': 'undo',
  '⌖': 'tag',
  '±': 'git-commit',
}

export const activityIcon = (plain: string): IconName => GIT_ICONS[plain] ?? 'git-commit'

export const DESK = {
  accent: '#3b82f6',
  muted: '#85858c',
  guide: '#808080',
  urgent: '#e5484d',
  selection: '#80808066',
  hover: '#8080801f',
  field: '#8080801a',
  edge: '#80808040',
  toolOn: '#3b82f633',
  addBg: '#3fb9502e',
  delBg: '#ef53502e',
} as const

const ANSI: Record<number, string> = {
  1: '#ef5350',
  2: '#3fb950',
  3: '#d99a1e',
  4: '#4b8ef0',
  5: '#b07ce8',
  6: '#2ab3a6',
  8: '#85858c',
}

export const DESK_GIT: Record<string, string> = {
  A: '#339641',
  '?': '#339641',
  R: '#4583dd',
  C: '#4583dd',
  M: '#ab7a18',
  T: '#ab7a18',
}

export const DESK_GIT_TEXT: Record<string, string> = {
  A: 'success',
  '?': 'success',
  R: 'suggestion',
  C: 'suggestion',
  M: '#a67c00',
  T: '#a67c00',
}

export function lighten(color: string, by = 0.3): string {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color
  const v = parseInt(color.slice(1), 16)
  return `#${[16, 8, 0].map(sh => Math.round(((v >> sh) & 255) + (255 - ((v >> sh) & 255)) * by).toString(16).padStart(2, '0')).join('')}`
}

export function ink(color: string | undefined, fallback: string = DESK.muted): string {
  if (!color) return fallback
  if (/^#[0-9a-f]{6}$/i.test(color)) return color
  const n = /^ansi256\((\d+)\)$/.exec(color)
  return (n ? ANSI[Number(n[1])] : undefined) ?? fallback
}

const glyph = (name: IconName, color: string, x: number, y: number, size: number, stroke?: number): string => {
  const k = size / 24
  const paint = FILLED.has(name) ? `fill="${color}" stroke="${color}"` : `fill="none" stroke="${color}"`
  const width = stroke ? ` stroke-width="${stroke}"` : ''
  return `<path transform="translate(${x} ${y}) scale(${+k.toFixed(4)})" ${paint}${width} d="${ICONS[name]}"/>`
}

const frame = (w: number, h: number, body: string): string =>
  `<svg xmlns="${NS}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`

export function iconSvg(name: IconName, color: string, size = 16): string {
  return frame(size, size, glyph(name, color, 0, 0, size))
}

export function toolSvg(name: IconName, color: string, spinMs = 0): string {
  const body = glyph(name, color, 4, 4, 16)
  if (!spinMs) return frame(24, 24, body)
  return frame(24, 24, `<g>${body}<animateTransform attributeName="transform" type="rotate" from="0 12 12" to="180 12 12" dur="${spinMs}ms" repeatCount="indefinite"/></g>`)
}

export const ROW_PX = 24
export const GAP_PX = 6
export const CHEVRON_PX = 9
export const STEP_PX = 16

export function rowSvg(depth: number, chevron: 'open' | 'closed' | null, icon: IconName | null, color: string, chevronColor: string = DESK.muted, gap: number = GAP_PX): string {
  const w = depth * STEP_PX + STEP_PX * 2 + gap
  const guides = Array.from({ length: depth }, (_, i) => `<rect x="${i * STEP_PX + 7.5}" y="0" width="1" height="${ROW_PX}" fill="${DESK.guide}" fill-opacity="0.35" stroke="none"/>`).join('')
  const x = depth * STEP_PX
  const chev = chevron ? glyph(chevron === 'open' ? 'chevron-down' : 'chevron-right', chevronColor, x + (STEP_PX - CHEVRON_PX) / 2, (ROW_PX - CHEVRON_PX) / 2, CHEVRON_PX, 3.2) : ''
  const pic = icon ? glyph(icon, color, x + STEP_PX, (ROW_PX - 16) / 2, 16) : ''
  return frame(w, ROW_PX, guides + chev + pic)
}

export function lineSvg(color: string, h: number): string {
  return `<svg xmlns="${NS}" width="4000" height="${h}"><rect width="4000" height="${h}" fill="${color}"/></svg>`
}

export function barSvg(color: string): string {
  return `<svg xmlns="${NS}" width="2" height="${ROW_PX}"><rect width="2" height="${ROW_PX}" fill="${color}"/></svg>`
}

const SELECTION_MIN = 1.3

function shade(bg: string, rgb: Rgb, light: boolean): string {
  if (!light) return lighten(bg, 0.14)
  return `#${rgb.map(c => Math.round(c * 0.86).toString(16).padStart(2, '0')).join('')}`
}

export function selectionOn(selection: string, bg: string, light: boolean): string {
  const fallback = light ? 'ansi256(252)' : 'ansi256(238)'
  const back = rgbOf(bg)
  if (!selection || selection === 'ansi256(0)') return back ? shade(bg, back, light) : fallback
  const sel = rgbOf(selection)
  if (!sel || !back) return selection
  return ratio(sel, back) >= SELECTION_MIN ? selection : shade(bg, back, light)
}
