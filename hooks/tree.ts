import type { Branch, FileNode, FileTree, Theme } from '../types'
import { stronger } from './icons'
import { compileRegex, compileSpans } from './regex'

export type Entry = { name: string; kind: 'file' | 'dir' | 'other'; mtimeMs: number; size: number; isLink: boolean }
export type Row = { node: FileNode; depth: number; open: boolean }

export const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export const DEFAULT_THEME: Theme = {
  fg: '',
  accent: 'ansi256(4)',
  muted: '',
  urgent: 'ansi256(1)',
  selection: 'ansi256(0)',
  bg: '',
}

export function emptyTree(root: string): FileTree {
  return {
    root,
    nodes: [],
    expanded: [],
    cursor: '',
    selected: '',
    query: '',
    searchCase: false,
    searchRegex: false,
    searchContent: false,
    searchScope: '',
    sortCol: '',
    sortDir: 'desc',
    showHidden: true,
    column: 'date',
    dirSizes: {},
    git: {},
    diff: {},
    ignored: [],
    untrackedDirs: [],
    top: '',
    prefix: '',
    branch: null,
    counts: {},
    flash: [],
    flashDim: [],
    flashOn: false,
    flashTones: {},
    scroll: null,
    preview: '',
    previewTop: 0,
    split: false,
  }
}

export function join(dir: string, name: string): string {
  return dir.endsWith('/') ? dir + name : `${dir}/${name}`
}

let drives = false

export function dirname(path: string): string {
  if (drives && /^[A-Za-z]:\/[^/]*$/.test(path)) return path.slice(0, 3)
  const i = path.lastIndexOf('/')
  return i <= 0 ? '/' : path.slice(0, i)
}

export function useDrives(on: boolean): void {
  drives = on
}

export function drivesOn(): boolean {
  return drives
}

export function posix(path: string): string {
  if (!drives) return path
  return path.replace(/\\/g, '/').replace(/^\/([A-Za-z])(\/|$)/, (_, d: string) => `${d.toUpperCase()}:/`)
}

export function dropBelow(nodes: FileNode[], dirs: string[]): FileNode[] {
  if (dirs.length === 0) return nodes
  const under = (id: string) => dirs.some(d => id !== d && inside(d, id))
  const gone = new Set(dirs)
  return nodes.filter(n => !under(n.id)).map(n => (gone.has(n.id) && n.loaded ? { ...n, loaded: false } : n))
}

export function isAbsolute(path: string): boolean {
  return path.startsWith('/') || (drives && /^[A-Za-z]:\//.test(path))
}

export function inside(root: string, path: string): boolean {
  return path === root || path.startsWith(root.endsWith('/') ? root : `${root}/`)
}

export function toNodes(dir: string, list: Entry[]): FileNode[] {
  return list
    .map(e => ({
      id: join(dir, e.name),
      parent: dir,
      name: e.name,
      kind: e.isLink ? ('link' as const) : e.kind === 'dir' ? ('dir' as const) : ('file' as const),
      hidden: e.name.startsWith('.'),
      mtime: e.mtimeMs,
      size: e.size,
      loaded: false,
    }))
    .sort((a, b) => (a.kind === 'dir' ? 0 : 1) - (b.kind === 'dir' ? 0 : 1) || collator.compare(a.name, b.name))
}

export function replaceChildren(nodes: FileNode[], listed: Map<string, FileNode[]>): FileNode[] {
  if (listed.size === 0) return nodes
  const keep = new Map<string, FileNode>()
  for (const n of nodes) if (listed.has(n.parent)) keep.set(n.id, n)
  const freshIds = new Set<string>()
  for (const kids of listed.values()) for (const k of kids) freshIds.add(k.id)
  const gone = new Set([...keep.keys()].filter(id => !freshIds.has(id)))
  const under = (id: string) => {
    if (gone.size === 0) return false
    for (let dir = dirname(id), prev = id; dir !== prev; prev = dir, dir = dirname(dir)) if (gone.has(dir)) return true
    return false
  }
  const fresh: FileNode[] = []
  for (const kids of listed.values()) {
    for (const k of kids) {
      if (under(k.id)) continue
      const old = keep.get(k.id)
      fresh.push(old && old.kind === 'dir' && k.kind === 'dir' ? { ...k, loaded: old.loaded } : k)
    }
  }
  const out = nodes.filter(n => !listed.has(n.parent) && !under(n.id))
  return [...out.map(n => (listed.has(n.id) ? { ...n, loaded: true } : n)), ...fresh]
}

export type GitStatus = {
  git: Record<string, string>
  ignored: string[]
  untrackedDirs: string[]
  branch: Branch | null
  files: Record<string, Change>
}

export type Change = 'new' | 'mod' | 'del'

export function parseBranch(record: string): Branch {
  const body = record.replace(/^## /, '')
  if (body.startsWith('HEAD (no branch)')) return { head: 'detached', upstream: '', ahead: 0, behind: 0 }
  const head = body.match(/^(?:No commits yet on |Initial commit on )?(.+?)(?:\.\.\.|\s|$)/)?.[1] ?? body
  const upstream = body.match(/\.\.\.(\S+)/)?.[1] ?? ''
  const ahead = Number(body.match(/ahead (\d+)/)?.[1] ?? 0)
  const behind = Number(body.match(/behind (\d+)/)?.[1] ?? 0)
  return { head, upstream, ahead, behind }
}

export function mapper(root: string, prefix: string): (rel: string) => string | null {
  return rel => (rel.startsWith(prefix) ? join(root, rel.slice(prefix.length).replace(/\/$/, '')).replace(/\/$/, '') : null)
}

export function parseGit(stdout: string, root: string, prefix: string): GitStatus {
  const map = mapper(root, prefix)
  const git: Record<string, string> = {}
  const ignored: string[] = []
  const untrackedDirs: string[] = []
  const files: Record<string, Change> = {}
  let branch: Branch | null = null
  const parts = stdout.split('\0')
  for (let i = 0; i < parts.length; i++) {
    const rec = parts[i] ?? ''
    if (rec.startsWith('## ')) {
      branch = parseBranch(rec)
      continue
    }
    if (rec.length < 4) continue
    const xy = rec.slice(0, 2)
    const raw = rec.slice(3)
    if (xy[0] === 'R' || xy[0] === 'C') i++
    const path = map(raw)
    if (!path) continue
    if (xy === '!!') {
      ignored.push(path)
      continue
    }
    if (xy === '??' && raw.endsWith('/')) untrackedDirs.push(path)
    else files[path] = xy === '??' || (xy.includes('A') && !xy.includes('D')) ? 'new' : xy.includes('D') && !/U/.test(xy) ? 'del' : 'mod'
    const letter =
      xy === '??'
        ? '?'
        : /U/.test(xy) || xy === 'AA' || xy === 'DD'
          ? 'U'
          : (['D', 'M', 'R', 'C', 'A', 'T'].find(c => xy.includes(c)) ?? '')
    if (!letter) continue
    git[path] = stronger(git[path], letter)
    let dir = dirname(path)
    while (dir.length >= root.length && dir !== '/') {
      git[dir] = stronger(git[dir], letter)
      if (dir === root) break
      dir = dirname(dir)
    }
  }
  return { git, ignored, untrackedDirs, branch, files }
}

export function parseNumstat(stdout: string, root: string, prefix: string, into: Record<string, [number, number]>): void {
  const map = mapper(root, prefix)
  const parts = stdout.split('\0')
  for (let i = 0; i < parts.length; i++) {
    const rec = parts[i] ?? ''
    if (!rec) continue
    const m = rec.match(/^(-|\d+)\t(-|\d+)\t(.*)$/s)
    if (!m) continue
    let path = m[3] ?? ''
    if (path === '') {
      i += 2
      path = parts[i] ?? ''
    }
    if (!path) continue
    const add = m[1] === '-' ? 0 : Number(m[1])
    const del = m[2] === '-' ? 0 : Number(m[2])
    const abs = map(path)
    if (!abs) continue
    const prev = into[abs] ?? [0, 0]
    into[abs] = [prev[0] + add, prev[1] + del]
  }
}

export function rollUp(diff: Record<string, [number, number]>, root: string): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = { ...diff }
  for (const [path, [add, del]] of Object.entries(diff)) {
    let dir = dirname(path)
    while (dir.length >= root.length && dir !== '/') {
      const prev = out[dir] ?? [0, 0]
      out[dir] = [prev[0] + add, prev[1] + del]
      if (dir === root) break
      dir = dirname(dir)
    }
  }
  return out
}

export function rollCounts(files: Record<string, Change>, root: string): Record<string, [number, number, number]> {
  const out: Record<string, [number, number, number]> = {}
  const slot = { new: 0, mod: 1, del: 2 } as const
  for (const [path, change] of Object.entries(files)) {
    let dir = dirname(path)
    while (dir.length >= root.length && dir !== '/') {
      const cur = out[dir] ?? [0, 0, 0]
      cur[slot[change]] += 1
      out[dir] = cur
      if (dir === root) break
      dir = dirname(dir)
    }
  }
  return out
}

export function underAny(id: string, set: Set<string>, root: string): boolean {
  if (set.size === 0) return false
  let cur = id
  while (cur.length >= root.length) {
    if (set.has(cur)) return true
    const up = dirname(cur)
    if (up === cur) break
    cur = up
  }
  return false
}

export function ancestorsOf(id: string, root: string): string[] {
  const out: string[] = []
  if (!root) return out
  for (let dir = dirname(id), prev = id; dir !== prev && dir !== root && inside(root, dir); prev = dir, dir = dirname(dir)) out.push(dir)
  return out
}

export function relative(root: string, path: string): string {
  return path === root ? '' : path.slice(root.endsWith('/') ? root.length : root.length + 1)
}

const MAX_QUERY = 200
const MATCH_BUDGET_MS = 40

export function badPattern(query: string, regex: boolean): boolean {
  const q = query.trim()
  if (!q) return false
  if (q.length > MAX_QUERY) return true
  if (!regex) return false
  return compileRegex(q, false) === null
}

export type Matcher = ((text: string) => boolean) & { partial: boolean }

export function matcher(query: string, cased: boolean, regex: boolean): Matcher | null {
  const q = query.trim()
  if (!q) return null
  const make = (test: (text: string) => boolean): Matcher => Object.assign(test, { partial: false })
  if (badPattern(q, regex)) return make(() => false)
  if (regex) {
    const test = compileRegex(q, !cased)
    if (!test) return make(() => false)
    let deadline = 0
    const m: Matcher = make(text => {
      if (m.partial) return false
      const now = Date.now()
      if (!deadline) deadline = now + MATCH_BUDGET_MS
      else if (now > deadline) {
        m.partial = true
        return false
      }
      return test(text)
    })
    return m
  }
  if (cased) return make(text => text.includes(q))
  const lower = q.toLowerCase()
  return make(text => text.toLowerCase().includes(lower))
}

export function matchSpans(query: string, cased: boolean, regex: boolean, text: string): [number, number][] {
  const q = query.trim()
  if (!q || badPattern(q, regex)) return []
  if (regex) return compileSpans(q, !cased)?.(text) ?? []
  const hay = cased ? text : text.toLowerCase()
  const needle = cased ? q : q.toLowerCase()
  const out: [number, number][] = []
  for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + needle.length)) out.push([at, at + needle.length])
  return out
}

export function highlight(text: string, spans: [number, number][], from = 0): { t: string; hit: boolean }[] {
  const out: { t: string; hit: boolean }[] = []
  let at = 0
  for (const [a, b] of spans) {
    const s = Math.max(0, Math.min(text.length, a - from))
    const e = Math.max(0, Math.min(text.length, b - from))
    if (e <= s || s < at) continue
    if (s > at) out.push({ t: text.slice(at, s), hit: false })
    out.push({ t: text.slice(s, e), hit: true })
    at = e
  }
  if (at < text.length) out.push({ t: text.slice(at), hit: false })
  return out
}

export function visibleRows(t: FileTree, order?: (a: FileNode, b: FileNode) => number): Row[] {
  const kids = new Map<string, FileNode[]>()
  for (const n of t.nodes) {
    if (!t.showHidden && n.hidden) continue
    const list = kids.get(n.parent)
    if (list) list.push(n)
    else kids.set(n.parent, [n])
  }
  if (order) for (const list of kids.values()) list.sort((a, b) => Number(b.kind === 'dir') - Number(a.kind === 'dir') || order(a, b))
  const scope = t.searchScope ? `${t.searchScope.replace(/\/$/, '')}/` : ''
  const match = t.searchContent ? null : matcher(t.query, Boolean(t.searchCase), Boolean(t.searchRegex))
  let keep: Set<string> | null = null
  if (match) {
    keep = new Set()
    for (const n of t.nodes) {
      if (scope && !n.id.startsWith(scope)) continue
      if (!match(relative(t.root, n.id))) continue
      keep.add(n.id)
      for (const a of ancestorsOf(n.id, t.root)) keep.add(a)
    }
  }
  const open = new Set(t.expanded)
  const rows: Row[] = []
  const walk = (dir: string, depth: number) => {
    for (const n of kids.get(dir) ?? []) {
      if (keep && !keep.has(n.id)) continue
      const isOpen = n.kind === 'dir' && (keep ? kids.has(n.id) : open.has(n.id))
      rows.push({ node: n, depth, open: isOpen })
      if (isOpen) walk(n.id, depth + 1)
    }
  }
  walk(t.root, 0)
  return rows
}

export type DateFormat = 'year-month-day' | 'day-month' | 'month-day'
export type Clock = '24h' | '12h'

export function dateFormat(value: unknown): DateFormat {
  return value === 'day-month' || value === 'month-day' ? value : 'year-month-day'
}

export function clockSetting(value: unknown): Clock {
  return value === '12h' ? '12h' : '24h'
}

export function stamp(ms: number, format: DateFormat = 'year-month-day', clock: Clock = '24h'): string {
  if (!ms) return ''
  const d = new Date(ms)
  const p = (v: number) => String(v).padStart(2, '0')
  const day = format === 'day-month'
    ? `${p(d.getDate())}-${p(d.getMonth() + 1)}`
    : format === 'month-day'
      ? `${p(d.getMonth() + 1)}-${p(d.getDate())}`
      : `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  const hours = d.getHours()
  const time = clock === '12h'
    ? `${String(hours % 12 || 12).padStart(2, ' ')}:${p(d.getMinutes())} ${hours < 12 ? 'AM' : 'PM'}`
    : `${p(hours)}:${p(d.getMinutes())}`
  return `${day} ${time}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function age(ms: number, now: number): string {
  if (!ms) return ''
  const s = (now - ms) / 1000
  if (s < 60 && s > -60) return 'now'
  if (s > 0 && s < 3600) return `${Math.floor(s / 60)}m`
  if (s > 0 && s < 86_400) return `${Math.floor(s / 3600)}h`
  if (s > 0 && s < 7 * 86_400) return `${Math.floor(s / 86_400)}d`
  const d = new Date(ms)
  return Math.abs(s) < 365 * 86_400 ? `${MONTHS[d.getMonth()]} ${d.getDate()}` : String(d.getFullYear())
}

export function humanSize(bytes: number, pad: string): string {
  if (bytes < 0) return '?'
  if (bytes < 1024) return `${bytes} B${pad}`
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`
  return `${(bytes / 1_073_741_824).toFixed(1)} GB`
}

export function formatSize(bytes: number): string {
  if (bytes < 0) return '?'
  const units = ['B', 'K', 'M', 'G', 'T']
  let v = bytes
  let i = 0
  while (Math.round(v) >= 1000 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${i && v < 9.95 ? v.toFixed(1) : Math.round(v)}${units[i]}`
}
