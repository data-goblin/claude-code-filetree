import type { Timer, EngineInterface } from 'claude-code'
import type { FileNode, FileTree } from '../types'
import { join, toNodes, replaceChildren, dirname, posix, ancestorsOf, relative, inside, type Change, isAbsolute } from './tree'
import { linking, settings, tree, machine, vcs } from './state'
import { exists, shortPath, osName, stopStream } from './util'
import { get, patch } from './store'
import { markStale } from './register'
import { refreshGit, git } from './gitstate'
import { staleSizes } from './sizes'
import { dropPreviews } from './activity'
import { staleGrep } from './grep'

export const PRUNE = ['.git', 'node_modules', 'target', '.venv', '__pycache__', 'dist', '.next']
export const HOME_PRUNE = ['Library', 'AppData', '.Trash']
let watchMissing = false
let watchTimer: Timer | null = null
const watchQueue = new Set<string>()
const WATCH_MS = 150
let markId = 0
let listSeq = 0
const listLatest = new Map<string, number>()
const unreadable = new Set<string>()

async function list($: EngineInterface, dir: string): Promise<FileNode[] | null> {
  try {
    const entries = await $.fs.list(dir)
    for (const e of entries) {
      const id = join(dir, e.name)
      linking.linkStates.delete(id)
      if (e.isLink) linking.links.add(id)
      else linking.links.delete(id)
    }
    const resolved = await Promise.all(
      entries.map(async e => {
        if (!e.isLink) return { name: e.name, kind: e.kind, mtimeMs: e.mtimeMs, size: e.size, isLink: false }
        try {
          const target = await $.fs.stat(join(dir, e.name))
          return target.kind === 'dir'
            ? { name: e.name, kind: 'dir' as const, mtimeMs: target.mtimeMs, size: 0, isLink: false }
            : { name: e.name, kind: 'file' as const, mtimeMs: target.mtimeMs, size: target.size, isLink: true }
        } catch {
          return { name: e.name, kind: 'other' as const, mtimeMs: 0, size: 0, isLink: true }
        }
      }),
    )
    unreadable.delete(dir)
    return toNodes(dir, resolved.filter(e => !settings.ignoreNames.includes(e.name)))
  } catch (err) {
    if (!(await exists($, dir))) return []
    if (!unreadable.has(dir)) {
      unreadable.add(dir)
      $.ui.toast(`could not list ${shortPath(dir)}: ${err instanceof Error ? err.message : String(err)}`)
    }
    return null
  }
}

export async function loadDirs($: EngineInterface, dirs: string[]): Promise<Map<string, FileNode[]>> {
  const root = (await get($)).root
  const seq = ++listSeq
  for (const dir of dirs) listLatest.set(dir, seq)
  const results = await Promise.all(dirs.map(async dir => [dir, await list($, dir)] as const))
  const listed = new Map<string, FileNode[]>()
  for (const [dir, kids] of results) {
    if (listLatest.get(dir) !== seq) continue
    listLatest.delete(dir)
    if (kids) listed.set(dir, kids)
  }
  await patch($, t => {
    if (t.root !== root) return {}
    const nodes = replaceChildren(t.nodes, listed)
    const up = dirname(t.cursor)
    const lost = t.cursor && listed.has(up) && !nodes.some(n => n.id === t.cursor)
    return lost ? { nodes, cursor: up === root ? '' : up, ...(t.selected === t.cursor ? { selected: '' } : {}) } : { nodes }
  })
  void watchTree($)
  return listed
}

export async function watchTree($: EngineInterface): Promise<void> {
  const t = await get($)
  const dirs = t.root ? [t.root, ...openDirs(t)] : []
  const key = dirs.join('\0')
  if (watchMissing || tree.watcher?.key === key) return
  tree.watcher?.stop()
  tree.watcher = null
  if (!dirs.length || (await osName($)) !== 'linux') return
  const stream = $.process.spawn({ argv: ['inotifywait', '-mq', '-e', 'create,delete,moved_to,moved_from,close_write', '--format', '%w%f', '--', ...dirs] })
  const own = { key, stop: () => stopStream(stream) }
  tree.watcher = own
  let rest = ''
  try {
    for await (const chunk of stream) {
      if (tree.watcher !== own) return
      if (chunk.stream !== 'stdout') continue
      const lines = (rest + chunk.text).split('\n')
      rest = lines.pop() ?? ''
      for (const line of lines) if (line) watchQueue.add(posix(line))
      if (watchQueue.size && !watchTimer) watchTimer = $.clock.after(WATCH_MS, () => void watched($))
    }
  } catch {
    if (tree.watcher === own) watchMissing = true
  }
}

async function watched($: EngineInterface): Promise<void> {
  watchTimer = null
  const paths = [...watchQueue]
  watchQueue.clear()
  dropPreviews(paths)
  if (paths.length) staleGrep($)
  const t = await get($)
  const open = new Set([t.root, ...openDirs(t)])
  const dirs = [...new Set(paths.map(p => dirname(p)).filter(d => open.has(d)))]
  await staleSizes($, paths)
  if (!dirs.length) return
  markStale($, paths)
  await loadDirs($, dirs)
  if (t.top) await refreshGit($)
}

export async function revealPaths($: EngineInterface, paths: string[]): Promise<void> {
  const tried = new Set<string>()
  for (let pass = 0; pass < 32; pass++) {
    const t = await get($)
    const loaded = new Set(t.nodes.filter(n => n.loaded).map(n => n.id))
    if (t.nodes.some(n => n.parent === t.root)) loaded.add(t.root)
    const need = new Set<string>()
    for (const p of paths) {
      for (const dir of [t.root, ...ancestorsOf(p, t.root).reverse()]) {
        if (!loaded.has(dir)) {
          if (!tried.has(dir)) need.add(dir)
          break
        }
      }
    }
    if (need.size === 0) return
    for (const dir of need) tried.add(dir)
    await loadDirs($, [...need])
  }
}

export function isIgnored(root: string, path: string): boolean {
  return settings.ignoreNames.length > 0 && relative(root, path).split('/').some(name => settings.ignoreNames.includes(name))
}

export function globLiteral(name: string): string {
  return name.replace(/[*?[\]\\]/g, '\\$&')
}

export function pruneArgs(root: string, ignored: string[] = []): string[] {
  const names = [...PRUNE, ...(broad(root) ? HOME_PRUNE : []), ...settings.ignoreNames.map(globLiteral)]
  return ['(', ...names.flatMap((name, i) => (i === 0 ? ['-name', name] : ['-o', '-name', name])), ...ignored.flatMap(p => ['-o', '-path', p]), ')', '-prune', '-o']
}

async function newer($: EngineInterface, paths: string[], sinceMs: number): Promise<string[]> {
  const stats = await Promise.all(
    paths.map(async p => {
      try {
        return (await $.fs.stat(p)).mtimeMs > sinceMs ? p : ''
      } catch {
        return ''
      }
    }),
  )
  return stats.filter(Boolean)
}

export function broad(root: string): boolean {
  return root === machine.home || root === '/' || /^[A-Za-z]:\/$/.test(root)
}

export function rootOfDisk(root: string): boolean {
  return root === '/' || /^[A-Za-z]:\/$/.test(root)
}

export async function changedSince($: EngineInterface, root: string, since: Since, depth: number, ignored: string[] = []): Promise<string[]> {
  if (rootOfDisk(root)) return []
  const test = since.mark ? ['-newer', since.mark] : ['-newermt', `@${(since.ms / 1000).toFixed(3)}`]
  try {
    const run = await $.process.run(['find', '-H', root, '-xdev', ...(depth ? ['-maxdepth', String(depth)] : []), ...pruneArgs(root, ignored.filter(p => inside(root, p)).slice(0, 40)), ...test, '-print0'], { timeoutMs: 8_000 })
    return run.stdout.split('\0').filter(p => p && p !== root)
  } catch {
    return []
  }
}

export async function changedInRepo($: EngineInterface, root: string, since: Since, before: Record<string, Change>, ignored: string[]): Promise<{ hits: string[]; gone: string[] }> {
  if (since.os !== 'win32') return { hits: await changedSince($, root, since, 0, ignored), gone: [] }
  if (vcs.dirty.root !== root) return { hits: [], gone: [] }
  const entries = Object.entries(vcs.dirty.files)
  const gone = entries.filter(([p, c]) => c === 'del' && before[p] !== 'del').map(([p]) => p)
  const live = entries.filter(([, c]) => c !== 'del').map(([p]) => p)
  return { hits: await newer($, live.filter(p => !isIgnored(root, p)).slice(0, 4_000), since.ms), gone }
}

export type Since = { ms: number; mark: string; os: 'linux' | 'darwin' | 'win32' }

export async function sinceNow($: EngineInterface, writes: boolean): Promise<Since> {
  const ms = await $.clock.now()
  const os = await osName($)
  if (os !== 'darwin' || !writes) return { ms, mark: '', os }
  const mark = `${((await $.env.get('TMPDIR')) || '/tmp').replace(/\/+$/, '')}/filetree-${await $.session.id()}-${++markId}.mark`
  try {
    await $.process.run(['touch', mark], { timeoutMs: 3_000 })
    return { ms, mark, os }
  } catch {
    return { ms, mark: '', os }
  }
}

export function openDirs(t: FileTree): string[] {
  const open = new Set(t.expanded)
  return t.nodes.filter(n => n.kind === 'dir' && n.loaded && open.has(n.id)).map(n => n.id)
}

async function walk($: EngineInterface, root: string, depth: number, limit: number): Promise<string[]> {
  const out: string[] = []
  let level = [root]
  for (let d = 0; d < depth && level.length && out.length < limit; d++) {
    const next: string[] = []
    for (const dir of level) {
      for (const n of (await list($, dir)) ?? []) {
        if (n.kind === 'dir') {
          if (!PRUNE.includes(n.name)) next.push(n.id)
        } else out.push(n.id)
      }
      if (out.length >= limit) break
    }
    level = next
  }
  return out
}

export async function listAll($: EngineInterface, t: FileTree): Promise<string[] | null> {
  try {
    if (!t.top && (await osName($)) === 'win32') return await walk($, t.root, rootOfDisk(t.root) ? 3 : 6, 20_000)
    const run = t.top
      ? await git($, t.root, ['ls-files', '-co', '--exclude-standard', '-z'], 10_000)
      : await $.process.run(['find', '-H', t.root, '-xdev', '-maxdepth', rootOfDisk(t.root) ? '3' : '6', ...pruneArgs(t.root), '-type', 'f', '-print0'], { timeoutMs: 10_000 })
    if (t.top && run.exitCode !== 0) return null
    const paths = run.stdout.split('\0').filter(Boolean)
    if (run.isStdoutTruncated) paths.pop()
    return paths.map(p => (isAbsolute(p) ? p : join(t.root, p))).filter(p => !isIgnored(t.root, p))
  } catch {
    return null
  }
}

export async function realOf($: EngineInterface, path: string): Promise<string> {
  const rest: string[] = []
  for (let dir = path; ; ) {
    const st = await $.fs.stat(dir, { resolve: true }).catch(() => undefined)
    if (st?.realPath) return rest.length ? join(posix(st.realPath), rest.join('/')) : posix(st.realPath)
    const up = dirname(dir)
    if (up === dir || rest.length > 64) return path
    rest.unshift(dir.slice(dir.lastIndexOf('/') + 1))
    dir = up
  }
}
