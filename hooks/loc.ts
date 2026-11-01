import type { Usage } from './treemap'

const CODE = [
  'ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs', 'vue', 'svelte', 'astro',
  'py', 'pyi', 'rs', 'go', 'java', 'kt', 'kts', 'scala', 'groovy', 'gradle', 'c', 'h', 'cc', 'cpp', 'cxx', 'hh', 'hpp', 'hxx', 'm', 'mm',
  'cs', 'fs', 'fsx', 'vb', 'swift', 'dart', 'rb', 'php', 'pl', 'pm', 'lua', 'r', 'jl', 'ex', 'exs', 'erl', 'hrl', 'clj', 'cljs', 'hs', 'ml', 'mli', 'elm', 'nim', 'zig', 'v', 'sol',
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'psm1', 'bat', 'cmd', 'nu',
  'sql', 'dax', 'tmdl', 'pq', 'graphql', 'gql', 'proto', 'tf', 'hcl', 'nix',
  'html', 'htm', 'css', 'scss', 'sass', 'less', 'xml', 'xsl', 'svg',
  'md', 'mdx', 'markdown', 'rst', 'adoc', 'tex', 'txt',
  'json', 'jsonc', 'json5', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'properties',
  'qml', 'glsl', 'hlsl', 'wgsl', 'gd', 'cmake', 'mk', 'ipynb',
]
const NAMES = ['Makefile', 'Dockerfile', 'Containerfile', 'Justfile', 'Rakefile', 'Gemfile', 'CMakeLists.txt', 'Vagrantfile']
const EXT = new Set(CODE)
const SKIP = [/\.min\.(js|css)$/i, /-lock\.json$/i, /\.lock$/i, /lock\.yaml$/i]
const BLANK = '^[[:space:]]*$'

export function counted(name: string): boolean {
  if (NAMES.includes(name)) return true
  if (SKIP.some(r => r.test(name))) return false
  const dot = name.lastIndexOf('.')
  return dot > 0 && EXT.has(name.slice(dot + 1).toLowerCase())
}

export function locArgv(dir: string, prune: string[]): string[] {
  const names = [...CODE.map(e => `*.${e}`), ...NAMES]
  const match = names.flatMap((n, i) => (i ? ['-o', '-iname', n] : ['-iname', n]))
  const skip = ['*.min.js', '*.min.css', '*-lock.json', '*.lock', '*lock.yaml'].flatMap(n => ['!', '-iname', n])
  return ['find', dir, ...prune, '-type', 'f', '(', ...match, ')', ...skip, '-exec', 'grep', '-cvH', '-e', BLANK, '--', '{}', '+']
}

export function parseLoc(text: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const line of text.split('\n')) {
    const at = line.lastIndexOf(':')
    if (at < 1) continue
    const n = Number(line.slice(at + 1))
    if (Number.isInteger(n)) out.set(line.slice(0, at), n)
  }
  return out
}

export function sumDirs(files: Map<string, number>, dir: string): Map<string, number> {
  const dirs = new Map<string, number>([[dir, 0]])
  for (const [path, n] of files) {
    for (let d = path.slice(0, path.lastIndexOf('/')); d.length >= dir.length; d = d.slice(0, d.lastIndexOf('/'))) {
      dirs.set(d, (dirs.get(d) ?? 0) + n)
      if (d === dir) break
    }
  }
  return dirs
}

export function locUsage(files: Map<string, number>, dir: string): { total: number; items: Usage[] } {
  const base = dir.endsWith('/') ? dir : `${dir}/`
  const top = new Map<string, Usage>()
  let total = 0
  for (const [path, n] of files) {
    if (!path.startsWith(base) || !n) continue
    total += n
    const parts = path.slice(base.length).split('/')
    const name = parts[0] ?? ''
    const own = top.get(name) ?? { path: base + name, name, bytes: 0 }
    own.bytes += n
    top.set(name, own)
    if (parts.length < 2) continue
    const sub = parts[1] ?? ''
    own.kids ??= []
    const kid = own.kids.find(k => k.name === sub)
    if (kid) kid.bytes += n
    else own.kids.push({ path: `${own.path}/${sub}`, name: sub, bytes: n })
  }
  const items = [...top.values()].sort((a, b) => b.bytes - a.bytes)
  for (const u of items) u.kids?.sort((a, b) => b.bytes - a.bytes)
  return { total, items }
}

export function formatLoc(n: number): string {
  if (n < 0) return ''
  if (n < 1000) return `${n}`
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 2 : n < 100_000 ? 1 : 0)}k`
  return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 2 : n < 100_000_000 ? 1 : 0)}M`
}
