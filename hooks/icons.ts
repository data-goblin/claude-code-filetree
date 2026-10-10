import type { FileNode } from '../types'

const cp = (n: number) => String.fromCodePoint(n)

export const CHEVRON_OPEN = cp(0xf47c)
export const CHEVRON_CLOSED = cp(0xf460)

const NAMES: Record<string, number> = {
  'agents.md': 0xf0354,
  'changelog.md': 0xf0354,
  'contributing.md': 0xf0354,
  'todo.md': 0xf0354,
  'readme.md': 0xf0354,
  license: 0xe60a,
  dockerfile: 0xf0868,
  makefile: 0xf1064,
  'cmakelists.txt': 0xf1064,
  justfile: 0xf05b7,
  gemfile: 0xf0d2d,
  rakefile: 0xf0d2d,
  'cargo.toml': 0xe6b2,
  'cargo.lock': 0xe6b2,
  'pyproject.toml': 0xe6b2,
  'requirements.txt': 0xf160e,
  'go.mod': 0xf0afa,
  'go.sum': 0xf07d3,
  'package.json': 0xf0626,
  'package-lock.json': 0xf0626,
  'tsconfig.json': 0xf0626,
  '.prettierrc': 0xf0626,
  '.eslintrc': 0xf0626,
  'pnpm-lock.yaml': 0xe6a8,
  'yarn.lock': 0xe6a8,
  '.gitignore': 0xf02a2,
  '.gitmodules': 0xf0493,
  '.editorconfig': 0xe652,
}

const EXTS: Record<string, number> = {
  lua: 0xe620,
  py: 0xe606,
  pyi: 0xe606,
  js: 0xe60c,
  mjs: 0xe60c,
  cjs: 0xe60c,
  ts: 0xe628,
  jsx: 0xe625,
  tsx: 0xe7ba,
  json: 0xe60b,
  jsonc: 0xe60b,
  yaml: 0xe6a8,
  yml: 0xe6a8,
  sh: 0xe795,
  bash: 0xe795,
  zsh: 0xe795,
  fish: 0xe795,
  md: 0xf0354,
  markdown: 0xf0354,
  css: 0xe6b8,
  scss: 0xf031c,
  html: 0xe736,
  htm: 0xe736,
  go: 0xe627,
  rs: 0xe68b,
  rb: 0xe791,
  php: 0xe608,
  java: 0xe738,
  cs: 0xf031b,
  sql: 0xe706,
  graphql: 0xf20e,
  gql: 0xf20e,
  xml: 0xf05c0,
  toml: 0xe6b2,
  ini: 0xf0bc2,
  conf: 0xf0493,
  pdf: 0xeaeb,
  svg: 0xf0721,
  jpg: 0xf0225,
  jpeg: 0xf0225,
  png: 0xe60d,
  gif: 0xf0d78,
  webp: 0xf021f,
  mp4: 0xf022b,
  mkv: 0xf022b,
  mov: 0xf022b,
  mp3: 0xf0223,
  wav: 0xf0223,
  flac: 0xf0223,
  zip: 0xf05c4,
  gz: 0xf05c4,
  xz: 0xf05c4,
  tar: 0xf05c4,
  qml: 0xf375,
  cpp: 0xe61d,
  cc: 0xe61d,
  cxx: 0xe61d,
  c: 0xe61e,
  h: 0xf0af5,
  hpp: 0xf0af5,
  vue: 0xe6a0,
  svelte: 0xe697,
  csv: 0xe64a,
  txt: 0xf09aa,
}

export function fileIcon(n: FileNode, open: boolean, isRepo: boolean): string {
  if (n.kind === 'link') return cp(0xf481)
  if (n.kind === 'dir') return cp(isRepo ? 0xf02a2 : open ? 0xe5fe : 0xe5ff)
  const lower = n.name.toLowerCase()
  const named = NAMES[lower]
  if (named) return cp(named)
  const dot = lower.lastIndexOf('.')
  const ext = dot >= 0 ? lower.slice(dot + 1) : ''
  return cp(EXTS[ext] ?? 0xf0214)
}

export const GIT_COLOR: Record<string, string> = {
  A: '#98c379',
  '?': '#98c379',
  R: '#61afef',
  C: '#61afef',
  M: '#e5c07b',
  T: '#e5c07b',
}

export const LIGHT_GIT_COLOR: Record<string, string> = {
  A: '#14532d',
  '?': '#14532d',
  R: '#1e3a8a',
  C: '#1e3a8a',
  M: '#78350f',
  T: '#78350f',
}

const PRIORITY = ['U', 'D', 'M', 'T', 'R', 'C', 'A', '?']

export function stronger(a: string | undefined, b: string): string {
  if (!a) return b
  return PRIORITY.indexOf(b) < PRIORITY.indexOf(a) ? b : a
}
