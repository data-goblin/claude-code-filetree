import { type BuiltinToolResults, type EngineInterface, type Register, type RenderElement, type Timer, update } from 'claude-code'
import { herdrError, herdrOpenCommand, herdrPane, isBinaryPath, LINUX_LAUNCH, openCommand, openWithCommand, type Target, terminalTarget, tmuxCommand, tmuxOpenCommand, words } from './open'
import type { ButtonProps } from './button'
import { CACHE_KEEP, cacheName, CLEAN, coderFor, EXIT_FAILED, EXIT_LOCKED, EXIT_MISSING, fitCells, PNG_DIRECT_BYTES, PNG_DIRECT_PIXELS, pictureKind, pngSize, POLICY, POSTER } from './peek'

import type { Activity, FileNode, FileTree, Theme } from '../types'
import { BRANCH_ICON, chainOf, type GitAction, gitActions, LIGHT_TONES, readOnly, readTargets, resolve, TONES } from './git'
import type { RowSpec, RowsProps, Seg } from './rows'
import { type DiffLine, diffWindow, splitPatch } from './diff'
import { counted, formatLoc, locArgv, locUsage, parseLoc, sumDirs } from './loc'
import { draw, layout, layoutPixels, parseDu, REST, type Tile, type Usage } from './treemap'
import { boxLook, fitPixels, inkOn, over, paint, type PixelLook, png, readable, type Rgb, textHeight } from './pixmap'
import { CELL_PROBE, colorOf, GHOSTTY_ARGS, parseGhostty, type TermColors } from './term'
import type { ZoneProps } from './zone'
import { ADD_COLOR, DEL_COLOR, type Palette, parsePalette } from './palette'
import { CHEVRON_CLOSED, CHEVRON_OPEN, fileIcon, GIT_COLOR } from './icons'
import {
  age,
  ancestorsOf,
  type Change,
  DEFAULT_THEME,
  dirname,
  emptyTree,
  formatSize,
  inside,
  isAbsolute,
  join,
  mapper,
  parseGit,
  parseNumstat,
  posix,
  relative,
  dropBelow,
  useDrives,
  rollCounts,
  replaceChildren,
  rollUp,
  stamp,
  toNodes,
  underAny,
  visibleRows,
} from './tree'

const TREE = { plugin: 'filetree', key: 'tree' } as const
const ACTIVITY = { plugin: 'filetree', key: 'activity' } as const
const PANE = 'filetree'
const SHIMMER = Object.fromEntries(Object.entries(TONES).map(([k, v]) => [k, { bright: v.bright, dim: v.dim }]))
const LIGHT_SHIMMER = Object.fromEntries(Object.entries(LIGHT_TONES).map(([k, v]) => [k, { bright: v.bright, dim: v.dim }]))
const BRANCH_ROW = '#branch'
const FLASH_MS = 2700
const RUNNING_MAX_MS = 600_000
const NO_REPO_DEPTH = 4
const DOUBLE_MS = 450
const SHORTCUTS_MS = 10_000
const FIND_LIMIT = 200
const ROWS_BUDGET = 80_000
const READ_REVEAL_LIMIT = 12
const SEARCH_REVEAL_LIMIT = 60
const ACTIVITY_TTL_MS = 45_000
const GIT_POLL_MS = 2000
const FONT_SCRIPT =
  'if command -v fc-list >/dev/null 2>&1; then f=$(fc-list ":charset=$1" file | grep -vi lastresort | head -n1 | cut -d: -f1); fi; ' +
  '[ -n "$f" ] || f=$(ls "$HOME"/Library/Fonts/*Nerd* /Library/Fonts/*Nerd* 2>/dev/null | head -n1); ' +
  '[ -n "$f" ] || { echo missing; exit 0; }; m=$(stat -c %Z "$f" 2>/dev/null || stat -f %c "$f"); p=$PPID; ' +
  'while [ -n "$p" ] && [ "$p" -gt 1 ]; do c=$(ps -o comm= -p "$p" 2>/dev/null); c=$(basename "$c" 2>/dev/null | tr -d " "); case "$c" in ' +
  'ghostty|kitty|alacritty|Alacritty|foot|footclient|wezterm-gui|konsole|gnome-terminal-|xterm|urxvt|st|Terminal|iTerm2) ' +
  'e=$(ps -o etime= -p "$p" 2>/dev/null | awk -F\'[-:]\' \'{n=NF; s=$n+60*$(n-1); if (n>2) s+=3600*$(n-2); if (n>3) s+=86400*$(n-3); print s}\'); [ -n "$e" ] && [ $(( $(date +%s) - e )) -lt "$m" ] && echo stale || echo ok; exit 0;; esac; ' +
  'p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d " "); done; echo ok'
const PRUNE = ['.git', 'node_modules', 'target', '.venv', '__pycache__', 'dist', '.next']
const HOME_PRUNE = ['Library', 'AppData', '.Trash']
const SIZE_TIMEOUT_MS = 15_000
const SIZE_JOBS = 2
const SIZE_WALK_LIMIT = 50_000
const AGE_TICK_MS = 60_000

let blink: Timer | null = null
let cached: FileTree | null = null
let snapshot: Timer | null = null
let gitPoll: Timer | null = null
let gitStamp: string | null = null
let gitDirOf = { root: '', dir: '' }
let ageTick: Timer | null = null
let lightTerminal = false
let generation = 0
let lastPress = { key: '', at: 0 }
let noNerd = false
let glyphSetting = 'auto'
const WORDS: Record<string, string> = { up: 'up', cwd: 'cwd', refresh: 'sync', hidden: 'dots', size: 'size', collapse: 'fold', split: 'split', unselect: 'clear' }
let openWithSetting = ''
let binariesInDefaultApp = false
let editWithSetting = ''
let diffWithSetting = ''
let targetSetting: Target = 'auto'
let palette: Palette = parsePalette('')
let inTmux = false
let inHerdr = false
let previewLine = 1
let previewed: Preview | null = null
let previewRows = 20
let splitAt: 'bottom' | 'top' = 'bottom'
let peeked: Preview | null = null
let peekPath = ''
let peekRows = 8
let peekTop = 0
let overPeek = false
let pictureBase = ''
let pictureSession = ''
let sessionDir = ''
let splitShown = false
let converting = false
let nextJob: PictureJob | null = null
let current: { job: PictureJob; stop: () => void } | null = null
const docPages = new Map<string, number>()
const docCounts = new Map<string, number>()
let docReading = ''
const pictures = new Map<string, { sig: string; picture: Picture; retried?: boolean }>()
let follow = true
let followClaude = true
let scanning: Promise<void> | null = null
let scanJobs: Job[] = []
let gitRun: Promise<void> | null = null
let gitNext: Promise<void> | null = null
let queuedReads: string[] = []
let showReads = true
let showWrites = true
let searchIndex: { root: string; paths: Promise<Indexed> } | null = null
let activityId = 0
let pointer = true
let hovered = ''
let view = { from: 0, max: 0 }
let nativeScroll = false
let lastSync = 0
let watcher: { key: string; stop: () => void } | null = null
let watchMissing = false
let watchTimer: Timer | null = null
const watchQueue = new Set<string>()
const WATCH_MS = 150
let noDock = false
let home = ''
let platform: Promise<'linux' | 'darwin' | 'win32'> | null = null
let dirty: { root: string; files: Record<string, Change> } = { root: '', files: {} }
let markId = 0
let listSeq = 0
let lastRoot = ''
let columnDefault: Column = 'date'
let showAge = false
let showHints = true
let ignoreNames: string[] = []
let searchGap = true
let shortcutsSetting: 'auto' | 'always' | 'off' = 'auto'
let shortcutsShown = false
let shortcutsTimer = 0
let treemapSetting: 'auto' | 'image' | 'cells' | 'off' = 'auto'
let kittyTerm = false
let imageDenied = false
let imageChecked = false
let cellPx: { cw: number; ch: number } | null = null
let termColors: TermColors = { palette: {} }
let mapImage: { key: string; png: string } | null = null
let sizeEpoch = 0
let sizeActive = 0
let sizeQueue: string[] = []
type Column = FileTree['column']
const locCache = new Map<string, number>()
const locListed = new Set<string>()
const locBusy = new Set<string>()
let locQueue: [string, boolean][] = []
let locActive = 0
const sizing = new Set<string>()
const listLatest = new Map<string, number>()
const unreadable = new Set<string>()
const background = new Map<string, Background>()

type Preview = { path: string; text: string; note: string; diff?: DiffLine[]; page?: number }
type Scan = { dir: string; loc: boolean; items: Usage[]; total: number; done: boolean; stale: boolean; stopped: boolean; stop: () => void }
const scans = new Map<string, Scan>()
let mapLock: { anchor: string; pick: string; cursor: string } | null = null
let mapAnchor = ''
let mapPick = ''
const SCAN_KEEP = 24
const SCAN_DRAW_MS = 100
const STALE_MS = 1500
const staleQueue = new Set<string>()
let staleTimer: Timer | null = null
type PictureJob = { path: string; key: string; kind: 'png' | 'image' | 'video' | 'pdf' | 'office'; sig: string; mtime: number; size: number; page: number; px: number; pdf: string }
type Picture = { state: 'pending' } | { state: 'ready'; file: string; generation: number; width: number; height: number; pages?: number } | { state: 'failed'; note: string; missing?: boolean }

function osName($: EngineInterface): Promise<'linux' | 'darwin' | 'win32'> {
  platform ??= (async () => {
    if ((await $.env.get('OS')) === 'Windows_NT') return 'win32'
    try {
      return (await $.process.run(['uname', '-s'], { timeoutMs: 3_000 })).stdout.trim() === 'Darwin' ? 'darwin' : 'linux'
    } catch {
      return 'linux'
    }
  })()
  return platform
}

async function cwdOf($: EngineInterface): Promise<string> {
  return posix(await $.session.cwd())
}

function clean(segs: Seg[]): Seg[] {
  for (const seg of segs) for (const k of Object.keys(seg) as (keyof Seg)[]) if (seg[k] === undefined) delete seg[k]
  return segs
}

function faint(hex: string): string {
  const v = parseInt(hex.slice(1), 16)
  const ch = (shift: number) => Math.round(0x26 + (((v >> shift) & 255) - 0x26) * 0.3)
  return `#${[16, 8, 0].map(x => ch(x).toString(16).padStart(2, '0')).join('')}`
}

async function readThemeSetting($: EngineInterface): Promise<void> {
  const row = (await $.config.list()).find(r => r.key === 'theme')
  const light = typeof row?.value === 'string' && row.value.startsWith('light')
  if (light === lightTerminal) return
  lightTerminal = light
  void $.ui.invalidate('ui.render')
}

async function get(_$: EngineInterface): Promise<FileTree> {
  cached ??= emptyTree('')
  return cached
}

async function put($: EngineInterface, fn: (t: FileTree) => FileTree): Promise<void> {
  cached = fn(cached ?? emptyTree(''))
  snapshot ??= $.clock.after(1_000, () => {
    snapshot = null
    if (cached) void $.state.set(TREE, cached)
  })
  await $.ui.invalidate('ui.render')
}

function patch($: EngineInterface, fn: (t: FileTree) => Partial<FileTree>) {
  return put($, t => ({ ...t, ...fn(t) }))
}

async function activities($: EngineInterface): Promise<Activity[]> {
  return (await $.state.get(ACTIVITY)).value ?? []
}

async function setActivities($: EngineInterface, fn: (list: Activity[]) => Activity[]): Promise<void> {
  await update($, ACTIVITY, cur => fn(cur ?? []).slice(-6))
}

async function list($: EngineInterface, dir: string): Promise<FileNode[] | null> {
  try {
    const entries = await $.fs.list(dir)
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
    return toNodes(dir, resolved.filter(e => !ignoreNames.includes(e.name)))
  } catch (err) {
    if (!(await exists($, dir))) return []
    if (!unreadable.has(dir)) {
      unreadable.add(dir)
      $.ui.toast(`could not list ${shortPath(dir)}: ${err instanceof Error ? err.message : String(err)}`)
    }
    return null
  }
}

async function loadDirs($: EngineInterface, dirs: string[]): Promise<Map<string, FileNode[]>> {
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
    return lost ? { nodes, cursor: up === root ? '' : up } : { nodes }
  })
  void watchTree($)
  return listed
}

async function watchTree($: EngineInterface): Promise<void> {
  const t = await get($)
  const dirs = t.root ? [t.root, ...openDirs(t)] : []
  const key = dirs.join('\0')
  if (watchMissing || watcher?.key === key) return
  watcher?.stop()
  watcher = null
  if (!dirs.length || (await osName($)) !== 'linux') return
  const stream = $.process.spawn({ argv: ['inotifywait', '-mq', '-e', 'create,delete,moved_to,moved_from,close_write', '--format', '%w%f', '--', ...dirs] })
  const own = { key, stop: () => void stream.return(undefined as never).catch(() => undefined) }
  watcher = own
  let rest = ''
  try {
    for await (const chunk of stream) {
      if (watcher !== own) return
      if (chunk.stream !== 'stdout') continue
      const lines = (rest + chunk.text).split('\n')
      rest = lines.pop() ?? ''
      for (const line of lines) if (line) watchQueue.add(posix(line))
      if (watchQueue.size && !watchTimer) watchTimer = $.clock.after(WATCH_MS, () => void watched($))
    }
  } catch {
    if (watcher === own) watchMissing = true
  }
}

async function watched($: EngineInterface): Promise<void> {
  watchTimer = null
  const paths = [...watchQueue]
  watchQueue.clear()
  dropPreviews(paths)
  const t = await get($)
  const open = new Set([t.root, ...openDirs(t)])
  const dirs = [...new Set(paths.map(p => dirname(p)).filter(d => open.has(d)))]
  if (!dirs.length) return
  markStale($, paths)
  await staleSizes($, paths)
  await loadDirs($, dirs)
  if (t.top) await refreshGit($)
}

async function git($: EngineInterface, cwd: string, args: string[], timeoutMs = 20_000, stdin?: string) {
  return $.process.run(['git', '--no-optional-locks', '-C', cwd, ...args], { timeoutMs, env: { GIT_OPTIONAL_LOCKS: '0' }, ...(stdin === undefined ? {} : { stdin }) })
}

async function detectRepo($: EngineInterface): Promise<void> {
  const t = await get($)
  if (!t.root) return
  let top = ''
  let prefix = ''
  try {
    const run = await git($, t.root, ['rev-parse', '--show-prefix', '--show-toplevel'], 5_000)
    const [p = '', tl = ''] = run.exitCode === 0 ? run.stdout.split('\n') : []
    prefix = p.trim()
    top = tl.trim()
  } catch {
    top = ''
  }
  await patch($, cur => (cur.root === t.root ? { top, prefix } : {}))
}

async function readGit($: EngineInterface): Promise<void> {
  const t = await get($)
  if (!t.root || !t.top) return
  const root = t.root
  try {
    const [status, head] = await Promise.all([
      git($, root, ['status', '--porcelain=v1', '-b', '-z', '--ignored=traditional', '--untracked-files=normal', '--', '.']),
      git($, root, ['diff', 'HEAD', '--numstat', '-z', '--', '.']),
    ])
    if (status.exitCode !== 0) return
    const parsed = parseGit(status.stdout, root, t.prefix)
    const diff: Record<string, [number, number]> = {}
    if (head.exitCode === 0) parseNumstat(head.stdout, root, t.prefix, diff)
    const files = { ...parsed.files }
    if (parsed.untrackedDirs.length) {
      const others = await git($, root, ['ls-files', '-o', '--exclude-standard', '-z', '--', ...parsed.untrackedDirs.map(d => d.slice(root.length + 1) || '.')])
      if (others.exitCode === 0) for (const rel of others.stdout.split('\0').filter(Boolean)) files[join(root, rel)] = 'new'
    }
    for (const path of Object.keys(diff)) if (files[path] === 'new') delete diff[path]
    dirty = { root, files }
    await patch($, cur =>
      cur.root === root
        ? {
            git: parsed.git,
            ignored: parsed.ignored,
            untrackedDirs: parsed.untrackedDirs,
            branch: parsed.branch,
            counts: rollCounts(files, root),
            diff: rollUp(diff, root),
          }
        : {},
    )
  } catch {
    return
  }
}

function refreshGit($: EngineInterface): Promise<void> {
  if (!gitRun) {
    gitRun = readGit($).finally(() => {
      gitRun = null
    })
    return gitRun
  }
  const rerun = () => {
    gitNext = null
    return refreshGit($)
  }
  gitNext ??= gitRun.then(rerun, rerun)
  return gitNext
}

async function reset($: EngineInterface, root: string, focus = false, ready?: Promise<void>): Promise<void> {
  const prev = await get($)
  generation += 1
  blink?.cancel()
  blink = null
  lastRoot = root
  searchIndex = null
  sizeEpoch += 1
  sizeQueue = []
  await put($, () => ({ ...emptyTree(root), showHidden: prev.showHidden, column: prev.root ? prev.column : columnDefault, split: prev.split }))
  const title = `Files: ${root.split('/').pop() || root}`
  const listed = loadDirs($, [root])
  const repo = detectRepo($)
  await ready
  if (focus) await $.ui.open({ id: PANE, title, focus: true })
  else if (!noDock) await $.ui.open({ id: PANE, title })
  await listed
  await repo
  await refreshGit($)
}

async function revealPaths($: EngineInterface, paths: string[]): Promise<void> {
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

function isIgnored(root: string, path: string): boolean {
  return ignoreNames.length > 0 && relative(root, path).split('/').some(name => ignoreNames.includes(name))
}

function pruneArgs(root: string, ignored: string[] = []): string[] {
  const names = [...PRUNE, ...(broad(root) ? HOME_PRUNE : []), ...ignoreNames.map(n => n.replace(/[*?[\]\\]/g, '\\$&'))]
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

function broad(root: string): boolean {
  return root === home || root === '/' || /^[A-Za-z]:\/$/.test(root)
}

function rootOfDisk(root: string): boolean {
  return root === '/' || /^[A-Za-z]:\/$/.test(root)
}

async function changedSince($: EngineInterface, root: string, since: Since, depth: number, ignored: string[] = []): Promise<string[]> {
  if (rootOfDisk(root)) return []
  const test = since.mark ? ['-newer', since.mark] : ['-newermt', `@${(since.ms / 1000).toFixed(3)}`]
  try {
    const run = await $.process.run(['find', '-H', root, '-xdev', ...(depth ? ['-maxdepth', String(depth)] : []), ...pruneArgs(root, ignored.filter(p => inside(root, p)).slice(0, 40)), ...test, '-print0'], { timeoutMs: 8_000 })
    return run.stdout.split('\0').filter(p => p && p !== root)
  } catch {
    return []
  }
}

async function changedInRepo($: EngineInterface, root: string, since: Since, before: Record<string, Change>, ignored: string[]): Promise<{ hits: string[]; gone: string[] }> {
  if (since.os !== 'win32') return { hits: await changedSince($, root, since, 0, ignored), gone: [] }
  if (dirty.root !== root) return { hits: [], gone: [] }
  const entries = Object.entries(dirty.files)
  const gone = entries.filter(([p, c]) => c === 'del' && before[p] !== 'del').map(([p]) => p)
  const live = entries.filter(([, c]) => c !== 'del').map(([p]) => p)
  return { hits: await newer($, live.filter(p => !isIgnored(root, p)).slice(0, 4_000), since.ms), gone }
}

type Since = { ms: number; mark: string; os: 'linux' | 'darwin' | 'win32' }

async function sinceNow($: EngineInterface, writes: boolean): Promise<Since> {
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

async function walkSize($: EngineInterface, dir: string): Promise<number> {
  let total = 0
  let seen = 0
  let level = [dir]
  while (level.length) {
    const next: string[] = []
    for (const d of level) {
      let entries
      try {
        entries = await $.fs.list(d)
      } catch {
        continue
      }
      for (const e of entries) {
        if (++seen > SIZE_WALK_LIMIT) return -1
        if (e.kind === 'dir' && !e.isLink) next.push(join(d, e.name))
        else if (e.kind === 'file') total += e.size
      }
    }
    level = next
  }
  return total
}

async function dirSize($: EngineInterface, dir: string): Promise<number> {
  if (rootOfDisk(dir)) return -1
  if ((await osName($)) === 'win32') return walkSize($, dir)
  try {
    const run = await $.process.run(['du', '-skxH', dir], { timeoutMs: SIZE_TIMEOUT_MS })
    const kb = Number(run.stdout.trim().split(/\s/)[0] || NaN)
    return Number.isFinite(kb) ? kb * 1024 : -1
  } catch {
    return -1
  }
}

function pumpSizes($: EngineInterface): void {
  while (sizeActive < SIZE_JOBS && sizeQueue.length) {
    const dir = sizeQueue.shift() ?? ''
    const epoch = sizeEpoch
    sizing.add(dir)
    sizeActive += 1
    void dirSize($, dir)
      .then(async bytes => {
        if (epoch === sizeEpoch) return patch($, cur => (inside(cur.root, dir) ? { dirSizes: { ...cur.dirSizes, [dir]: bytes } } : {}))
        const cur = await get($)
        if (cur.column === 'size' && inside(cur.root, dir) && !(dir in cur.dirSizes) && !sizeQueue.includes(dir)) sizeQueue.push(dir)
      })
      .catch(() => undefined)
      .finally(() => {
        sizing.delete(dir)
        sizeActive -= 1
        pumpSizes($)
      })
  }
}

function takeLoc(files: Map<string, number>, dir: string, deep: boolean): void {
  for (const [path, n] of files) locCache.set(path, n)
  if (deep) {
    for (const [d, n] of sumDirs(files, dir)) {
      locCache.set(d, n)
      locListed.add(d)
    }
  }
  locListed.add(dir)
}

function pumpLoc($: EngineInterface): void {
  while (locActive < SIZE_JOBS && locQueue.length) {
    const [dir, deep] = locQueue.shift() ?? ['', false]
    const epoch = sizeEpoch
    const key = `${deep ? 'd' : 's'}${dir}`
    locBusy.add(key)
    locActive += 1
    void (async () => {
      if ((await osName($)) === 'win32') return
      const t = await get($)
      const argv = locArgv(dir, pruneArgs(t.root))
      const run = await $.process.run(deep ? argv : [argv[0] ?? 'find', dir, '-maxdepth', '1', ...argv.slice(2)], { timeoutMs: SIZE_TIMEOUT_MS })
      if (epoch !== sizeEpoch) return
      takeLoc(parseLoc(run.stdout), dir, deep)
      void $.ui.invalidate('ui.render')
    })()
      .catch(() => undefined)
      .finally(() => {
        locBusy.delete(key)
        locActive -= 1
        pumpLoc($)
      })
  }
}

function wantLoc($: EngineInterface, dirs: string[], deep: boolean): void {
  for (const dir of dirs) {
    if (locBusy.has(`${deep ? 'd' : 's'}${dir}`) || locQueue.some(([d, k]) => d === dir && k === deep)) continue
    locQueue.push([dir, deep])
  }
  pumpLoc($)
}

function wantSizes($: EngineInterface, dirs: string[]): void {
  for (const dir of dirs) if (!sizing.has(dir) && !sizeQueue.includes(dir)) sizeQueue.push(dir)
  pumpSizes($)
}

async function staleSizes($: EngineInterface, paths?: string[]): Promise<void> {
  sizeEpoch += 1
  sizeQueue = []
  locQueue = []
  if (!paths) {
    locCache.clear()
    locListed.clear()
  }
  for (const p of paths ?? []) {
    locCache.delete(p)
    locListed.delete(p)
    for (let d = dirname(p), prev = p; d !== prev; prev = d, d = dirname(d)) {
      locCache.delete(d)
      locListed.delete(d)
    }
  }
  await patch($, cur => {
    if (!paths) return { dirSizes: {} }
    const keep: Record<string, number> = {}
    for (const [dir, bytes] of Object.entries(cur.dirSizes)) if (!paths.some(p => inside(dir, p))) keep[dir] = bytes
    return { dirSizes: keep }
  })
}

function openDirs(t: FileTree): string[] {
  const open = new Set(t.expanded)
  return t.nodes.filter(n => n.kind === 'dir' && n.loaded && open.has(n.id)).map(n => n.id)
}

function keepTop(cur: FileTree, expanded: string[]): Partial<FileTree> {
  if (followClaude) return { scroll: null }
  const top = visibleRows(cur)[cur.scroll ?? view.from]?.node.id
  const at = top ? visibleRows({ ...cur, expanded }).findIndex(r => r.node.id === top) : -1
  return at < 0 ? {} : { scroll: at }
}

async function flash($: EngineInterface, tones: Record<string, string>): Promise<void> {
  const unique = Object.keys(tones)
  if (unique.length === 0) return
  const mine = ++generation
  const root = (await get($)).root
  blink?.cancel()
  blink = null
  await patch($, cur => {
    if (cur.root !== root) return {}
    const open = new Set(cur.expanded)
    const bright = new Set([...(cur.flashOn ? cur.flash.filter(id => !unique.includes(id)) : []), ...unique])
    const dim = new Set<string>()
    const all: Record<string, string> = cur.flashOn ? { ...cur.flashTones } : {}
    if (cur.flashOn) {
      for (const id of cur.flashDim) dim.add(id)
    }
    for (const id of unique) {
      const tone = tones[id] ?? 'orange'
      all[id] = tone
      if (id === BRANCH_ROW) continue
      const chain = ancestorsOf(id, cur.root)
      if (!chain.some(a => !open.has(a))) continue
      for (const a of chain) {
        if (!open.has(a)) {
          dim.add(a)
          all[a] = all[a] ?? tone
        }
        open.add(a)
      }
    }
    for (const id of bright) dim.delete(id)
    return {
      flash: [...bright],
      flashDim: [...dim],
      flashOn: true,
      flashTones: all,
      expanded: [...open],
      ...keepTop(cur, [...open]),
    }
  })
  if (generation !== mine) return
  blink = $.clock.after(FLASH_MS, () => {
    if (generation !== mine) return
    blink = null
    void patch($, cur => (generation === mine ? { flash: [], flashDim: [], flashOn: false, flashTones: {} } : {}))
  })
}

async function followCwd($: EngineInterface): Promise<boolean> {
  if (!follow) return false
  const cwd = await cwdOf($)
  const t = await get($)
  if (t.root === cwd) return false
  await reset($, cwd)
  return true
}

type Pending = { actions: GitAction[]; ids: number[]; command: string; head: string }
type Job = { actions: GitAction[]; since: Since; initRepo: boolean; readOnly: boolean }
type Background = { p: Pending | null; job: Job; reads: string[] }
type GitOperation = NonNullable<BuiltinToolResults['Bash']['gitOperation']>
type Outcome = { state: 'done' | 'failed'; label: string; detail: string }

const PROOF: Record<string, (op: GitOperation) => boolean> = {
  push: op => Boolean(op.push),
  merge: op => op.branch?.action === 'merged',
  rebase: op => op.branch?.action === 'rebased',
  'pr create': op => op.pr?.action === 'created',
  'pr merge': op => op.pr?.action === 'merged',
  'pr comment': op => op.pr?.action === 'commented',
}

async function startGit($: EngineInterface, actions: GitAction[]): Promise<number[]> {
  const now = await $.clock.now()
  const ids = actions.map(() => ++activityId)
  await setActivities($, cur => [
    ...cur.filter(a => a.state === 'running' || now - a.at < ACTIVITY_TTL_MS),
    ...actions.map((a, i) => ({
      id: ids[i] ?? 0,
      kind: a.kind,
      label: a.running,
      state: 'running' as const,
      detail: '',
      at: now,
      tone: a.tone,
      nerd: a.icon.nerd,
      plain: a.icon.plain,
    })),
  ])
  return ids
}

async function headOf($: EngineInterface, cwd: string): Promise<string> {
  try {
    const run = await git($, cwd, ['rev-parse', 'HEAD'], 5_000)
    return run.exitCode === 0 ? run.stdout.trim() : ''
  } catch {
    return ''
  }
}

async function outcomes($: EngineInterface, p: Pending, ok: boolean, op: GitOperation | undefined): Promise<Outcome[]> {
  const chain = chainOf(p.command)
  const after = p.actions.some(a => a.verb === 'commit') && !op?.commit ? await headOf($, (await get($)).root || (await cwdOf($))) : ''
  return p.actions.map(a => {
    if (a.verb === 'commit') {
      const sha = op?.commit?.sha || (after && after !== p.head ? after : '')
      return sha ? { state: 'done', label: a.done, detail: sha.slice(0, 7) } : { state: 'failed', label: `${a.verb} failed`, detail: '' }
    }
    if ((op && PROOF[a.verb]?.(op)) || (ok && chain.and)) return { state: 'done', label: a.done, detail: '' }
    if (!ok && chain.and && chain.size === 1) return { state: 'failed', label: `${a.verb} failed`, detail: '' }
    return { state: 'done', label: `ran ${a.kind}`, detail: '' }
  })
}

async function finishGit($: EngineInterface, p: Pending, results: Outcome[]): Promise<void> {
  const now = await $.clock.now()
  await setActivities($, cur =>
    cur.map(a => {
      const i = p.ids.indexOf(a.id)
      const result = i < 0 ? undefined : results[i]
      return result ? { ...a, ...result, at: now } : a
    }),
  )
  $.clock.after(ACTIVITY_TTL_MS + 500, () => void setActivities($, cur => cur.filter(a => a.state === 'running' || a.at > now)))
}

function failAll(p: Pending): Outcome[] {
  return p.actions.map(a => ({ state: 'failed', label: `${a.verb} failed`, detail: '' }))
}

function proven(p: Pending | null, results: Outcome[]): GitAction[] {
  return p ? p.actions.filter((_, i) => results[i]?.state !== 'failed') : []
}

function taskEnds(text: string): [string, string][] {
  return [...text.matchAll(/<task-notification>([\s\S]*?)<\/task-notification>/g)].flatMap(m => {
    const id = /<task-id>([^<]*)<\/task-id>/.exec(m[1] ?? '')?.[1]?.trim()
    const status = /<status>([^<]*)<\/status>/.exec(m[1] ?? '')?.[1]?.trim()
    return id && status ? [[id, status] as [string, string]] : []
  })
}

async function settleBackground($: EngineInterface, text: string): Promise<void> {
  if (background.size === 0 || !text.includes('<task-notification>')) return
  for (const [id, status] of taskEnds(text)) {
    const task = background.get(id)
    if (!task) continue
    background.delete(id)
    const ok = status === 'completed'
    const results = task.p ? await outcomes($, task.p, ok, undefined) : []
    if (task.p) await finishGit($, task.p, results)
    if (showReads) queuedReads.push(...task.reads)
    scheduleScan($, { ...task.job, actions: proven(task.p, results) })
  }
}

async function gitPaths($: EngineInterface, root: string, prefix: string, committed: boolean): Promise<string[]> {
  const map = mapper(root, prefix)
  try {
    const run = committed
      ? await git($, root, ['diff-tree', '--root', '--no-commit-id', '--name-only', '-r', '-z', 'HEAD'], 5_000)
      : await git($, root, ['diff', '--cached', '--name-only', '-z'], 5_000)
    return run.exitCode === 0 ? run.stdout.split('\0').filter(Boolean).flatMap(rel => map(rel) ?? []) : []
  } catch {
    return []
  }
}

async function gitChanged($: EngineInterface): Promise<void> {
  const root = (await get($)).root
  if (gitDirOf.root !== root || !gitDirOf.dir) gitDirOf = { root, dir: await gitDir($, root) }
  const gd = gitDirOf.dir
  const stamps = gd ? await Promise.all(['index', 'HEAD'].map(f => $.fs.stat(join(gd, f)).then(st => st.mtimeMs, () => 0))) : []
  const stamp = gd ? `${gd}:${stamps.join(':')}` : ''
  const before = gitStamp
  gitStamp = stamp
  if (before === '' && stamp) {
    await detectRepo($)
    void sync($, true)
  } else if (before && stamp && before !== stamp) void sync($, true)
}

async function settleRoot($: EngineInterface): Promise<void> {
  const root = follow || !lastRoot ? await cwdOf($) : lastRoot
  const t = await get($)
  if (t.root !== root || t.nodes.length === 0) await reset($, root)
}

async function gitDir($: EngineInterface, cwd: string): Promise<string> {
  for (let dir = cwd, i = 0; i < 64; i++) {
    try {
      const dot = join(dir, '.git')
      const st = await $.fs.stat(dot)
      if (st.kind === 'dir') return dot
      const ref = /^gitdir:\s*(.+)$/m.exec(String(await $.fs.read(dot)))?.[1]?.trim()
      if (ref) return resolve(dir, ref, home)
    } catch {
      const up = dirname(dir)
      if (up === dir) return ''
      dir = up
      continue
    }
    return ''
  }
  return ''
}

async function sync($: EngineInterface, force = false): Promise<void> {
  const now = await $.clock.now()
  if (!force && now - lastSync < 2_000) return
  lastSync = now
  searchIndex = null
  const t = await get($)
  if (!t.root) return
  await loadDirs($, [t.root, ...openDirs(t)])
  if (t.top) await refreshGit($)
}

async function copyPath($: EngineInterface, id: string, absolute: boolean, surface?: string): Promise<void> {
  const t = await get($)
  const text = !absolute && id !== t.root && inside(t.root, id) ? id.slice(t.root.endsWith('/') ? t.root.length : t.root.length + 1) : id
  const done = await $.ui.copy({ text, ...(surface ? { surface: surface as 'terminal' } : {}) })
  $.ui.toast(done.isCopied ? `Copied ${text}` : 'Could not copy the path')
}

async function exists($: EngineInterface, path: string): Promise<boolean> {
  try {
    await $.fs.stat(path)
    return true
  } catch {
    return false
  }
}

async function afterBash($: EngineInterface, jobs: Job[]): Promise<void> {
  const reads = queuedReads
  queuedReads = []
  if (await followCwd($)) return
  const t = await get($)
  if (!t.root) return
  const actions = jobs.flatMap(j => j.actions)
  const writers = jobs.filter(j => !j.readOnly)
  const since = (writers.length ? writers : jobs).reduce((a, j) => (j.since.ms < a.ms ? j.since : a), (writers[0] ?? jobs[0])?.since ?? { ms: 0, mark: '', os: 'linux' as const })
  const writes = !jobs.every(j => j.readOnly)
  const before = dirty.root === t.root ? dirty.files : {}
  if (jobs.some(j => j.initRepo)) await detectRepo($)
  else if (!t.top && (await exists($, join(t.root, '.git')))) await detectRepo($)
  const probed = await get($)
  if (probed.top && (writes || probed.top !== t.top)) await refreshGit($)
  if (writes) {
    searchIndex = null
    await staleSizes($)
  }
  const fresh = await get($)
  const ignored = new Set(fresh.ignored)
  const tones: Record<string, string> = {}
  if (writes) {
    const found = fresh.top
      ? await changedInRepo($, t.root, since, before, fresh.ignored)
      : { hits: since.os === 'win32' ? [] : await changedSince($, t.root, since, NO_REPO_DEPTH), gone: [] }
    const hits = found.hits.filter(x => inside(t.root, x) && !underAny(x, ignored, t.root) && !isIgnored(t.root, x)).slice(0, FIND_LIMIT)
    await revealPaths($, hits)
    const loaded = await get($)
    const dirs = [...new Set([loaded.root, ...openDirs(loaded), ...hits.map(dirname), ...found.gone.map(dirname)])].filter(d => inside(loaded.root, d))
    const listed = await loadDirs($, dirs)
    if (!fresh.top && since.os === 'win32')
      for (const kids of listed.values()) for (const n of kids) if (n.mtime > since.ms && hits.length < FIND_LIMIT) hits.push(n.id)
    await patch($, cur => {
      const ids = new Set(cur.nodes.map(n => n.id))
      return { expanded: cur.expanded.filter(id => ids.has(id)) }
    })
    const present = new Set((await get($)).nodes.map(n => n.id))
    const touchTone = actions.find(a => !['commit', 'push', 'add'].includes(a.verb))?.tone ?? 'orange'
    if (showWrites) for (const id of hits) if (present.has(id)) tones[id] = touchTone
  }
  if (showReads) {
    const found: string[] = []
    for (const r of reads) {
      if (found.length >= READ_REVEAL_LIMIT) break
      if (r !== t.root && inside(t.root, r) && !underAny(r, ignored, t.root) && !isIgnored(t.root, r) && (await exists($, r))) found.push(r)
    }
    if (found.length) {
      await revealPaths($, found)
      const shown = new Set((await get($)).nodes.map(n => n.id))
      for (const r of found) if (shown.has(r) && !tones[r]) tones[r] = 'purple'
    }
  }
  if (showWrites && actions.length) {
    const final = await get($)
    const committed = actions.some(a => a.verb === 'commit')
    if ((committed || actions.some(a => a.verb === 'add')) && final.top) {
      const paths = (await gitPaths($, final.root, final.prefix, committed)).filter(x => !underAny(x, ignored, final.root) && !isIgnored(final.root, x)).slice(0, READ_REVEAL_LIMIT)
      await revealPaths($, paths)
      const shown = new Set((await get($)).nodes.map(n => n.id))
      for (const x of paths) if (shown.has(x)) tones[x] = 'green'
    }
    const pushLike = actions.find(a => ['push', 'pull', 'fetch', 'checkout', 'switch', 'branch', 'merge', 'rebase', 'tag'].includes(a.verb) || a.kind.startsWith('gh '))
    if (pushLike) tones[BRANCH_ROW] = pushLike.tone
    else if (committed) tones[BRANCH_ROW] = 'green'
  }
  await flash($, tones)
}

function scheduleScan($: EngineInterface, job: Job): void {
  scanJobs.push(job)
  if (scanning) return
  scanning = (async () => {
    while (scanJobs.length) {
      const jobs = scanJobs
      scanJobs = []
      try {
        await afterBash($, jobs)
      } finally {
        const marks = jobs.map(j => j.since.mark).filter(Boolean)
        if (marks.length) await $.process.run(['rm', '-f', ...marks], { timeoutMs: 3_000 }).catch(() => undefined)
      }
    }
  })().finally(() => {
    scanning = null
  })
}

function dropPreviews(paths: string[]): void {
  const changed = new Set(paths.map(posix))
  if (previewed && changed.has(previewed.path)) previewed = null
  if (peeked && changed.has(peeked.path)) peeked = null
}

async function touched($: EngineInterface, paths: string[], tone: string, show: boolean): Promise<void> {
  if (tone !== 'purple') dropPreviews(paths)
  if (tone !== 'purple') markStale($, paths)
  if (await followCwd($)) return
  const t = await get($)
  if (!t.root) return
  const within = paths.map(posix).filter(p => inside(t.root, p) && !isIgnored(t.root, p)).slice(0, SEARCH_REVEAL_LIMIT)
  if (within.length === 0) return
  if (tone !== 'purple') {
    searchIndex = null
    await staleSizes($, within)
    await revealPaths($, within.map(dirname))
    await loadDirs($, [...new Set(within.map(dirname))].filter(d => inside(t.root, d)))
    await refreshGit($)
  } else await revealPaths($, within)
  if (!show) return
  const tones: Record<string, string> = {}
  for (const p of within) tones[p] = tone
  await flash($, tones)
}

async function reveal($: EngineInterface, paths: string[]): Promise<void> {
  if (await followCwd($)) return
  await revealPaths($, paths)
  await patch($, cur => {
    const open = new Set(cur.expanded)
    for (const p of paths) for (const a of ancestorsOf(p, cur.root)) open.add(a)
    return { expanded: [...open], cursor: paths[paths.length - 1] ?? cur.cursor, scroll: null }
  })
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

async function listAll($: EngineInterface, t: FileTree): Promise<string[] | null> {
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

type Indexed = { paths: string[]; lower: string[] }

function indexPaths($: EngineInterface, t: FileTree): Promise<Indexed> {
  if (searchIndex?.root !== t.root) {
    const index: { root: string; paths: Promise<Indexed> } = {
      root: t.root,
      paths: listAll($, t).then(paths => {
        if (paths === null && searchIndex === index) searchIndex = null
        return { paths: paths ?? [], lower: (paths ?? []).map(p => relative(t.root, p).toLowerCase()) }
      }),
    }
    searchIndex = index
  }
  return searchIndex.paths
}

async function search($: EngineInterface, query: string): Promise<string[]> {
  if (!(await get($)).query.trim()) searchIndex = null
  await patch($, () => ({ query }))
  const q = query.trim().toLowerCase()
  if (!q) return []
  const t = await get($)
  const index = await indexPaths($, t)
  const hits: string[] = []
  for (let i = 0; i < index.lower.length && hits.length < SEARCH_REVEAL_LIMIT; i++) if (index.lower[i]?.includes(q)) hits.push(index.paths[i] ?? '')
  if ((await get($)).query !== query) return []
  await revealPaths($, hits)
  const shown = await get($)
  const ids = new Set(shown.nodes.map(n => n.id))
  const stale = [...new Set(hits.filter(p => !ids.has(p)).map(dirname))].filter(d => inside(shown.root, d))
  if (stale.length) await loadDirs($, stale)
  return hits
}

async function jump($: EngineInterface, query: string): Promise<void> {
  const hits = (await search($, query)).slice(0, 10)
  await patch($, cur => {
    const open = new Set(cur.expanded)
    for (const p of hits) for (const a of ancestorsOf(p, cur.root)) open.add(a)
    return { query: '', expanded: [...open], cursor: hits[0] ?? cur.cursor, scroll: null }
  })
}

async function fontState($: EngineInterface, charset: string): Promise<'ok' | 'stale' | 'missing'> {
  try {
    const out = (await $.process.run(['sh', '-c', FONT_SCRIPT, 'sh', charset], { timeoutMs: 5_000 })).stdout.trim()
    return out === 'stale' || out === 'missing' ? out : 'ok'
  } catch {
    return 'missing'
  }
}

async function finePointerOk($: EngineInterface): Promise<boolean> {
  if (!(await $.env.get('HERDR_ENV'))) return true
  try {
    const out = (await $.process.run([(await $.env.get('HERDR_BIN_PATH')) || 'herdr', '--version'], { timeoutMs: 3_000 })).stdout
    const [major = 0, minor = 0, fix = 0] = (/(\d+)\.(\d+)\.(\d+)/.exec(out) ?? []).slice(1).map(Number)
    return major * 1e6 + minor * 1e3 + fix >= 9_001
  } catch {
    return false
  }
}

const PREVIEW_CHARS = 90_000
const PREVIEW_LINE = 2_000

function fitSerialized(lines: string[], max: number): string[] {
  let size = 0
  for (let i = 0; i < lines.length; i++) {
    size += JSON.stringify(lines[i]).length
    if (size > max) return lines.slice(0, i)
  }
  return lines
}

async function loadPreview($: EngineInterface, path: string): Promise<void> {
  previewed = await readPreview($, path)
}

function unlessAborted(err: unknown): null {
  if (/aborted/.test(String((err as Error)?.message ?? err))) throw err
  return null
}

async function docText($: EngineInterface, path: string, page: number): Promise<string> {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
  const argv = ext === 'pdf' ? ['timeout', '10', 'pdftotext', '-f', String(page), '-l', String(page), '-layout', '--', path, '-'] : ext === 'docx' || ext === 'odt' || ext === 'rtf' ? ['timeout', '10', 'pandoc', '-t', 'gfm', '--wrap=none', '--', path] : []
  if (!argv.length) return ''
  if (ext === 'pdf' && !docCounts.has(path)) {
    const info = await $.process.run(['timeout', '10', 'pdfinfo', '--', path], { timeoutMs: 15_000 }).catch(unlessAborted)
    const all = `${info?.stdout ?? ''}${info?.stderr ?? ''}`
    if (/Incorrect password/.test(all)) return '\0encrypted'
    const pages = Number(/^Pages:\s*(\d+)/m.exec(all)?.[1] ?? 0)
    if (pages) docCounts.set(path, pages)
  }
  const run = await $.process.run(argv, { timeoutMs: 15_000 }).catch(unlessAborted)
  return run?.exitCode === 0 ? run.stdout.replace(/\f/g, '\n').trimEnd() : ''
}

async function readPreview($: EngineInterface, path: string, page = 1): Promise<Preview> {
  let text = ''
  let note = ''
  try {
    const stat = await $.fs.stat(path)
    const kind = pictureKind(path)
    if (stat.kind !== 'file') note = 'not a regular file'
    else if (kind === 'pdf' || kind === 'office') {
      text = await docText($, path, page)
      if (text === '\0encrypted') {
        text = ''
        note = 'encrypted'
      } else if (!text) note = kind === 'pdf' && docCounts.has(path) ? `no text on page ${page}` : `${path.split('/').pop()}, ${formatSize(stat.size)}`
    }
    else if (stat.size > 4_000_000) note = `${formatSize(stat.size)}, too large to preview`
    else {
      text = await $.fs.read(path)
      if (text.slice(0, 8000).includes('\0')) {
        text = ''
        note = `binary file, ${formatSize(stat.size)}`
      }
    }
  } catch (err) {
    unlessAborted(err)
    note = `could not read: ${String((err as Error)?.message ?? err).split('\n')[0]}`
  }
  const total = text.length
  let lines = text.slice(0, PREVIEW_CHARS).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').split('\n')
  if (lines.length > 1 && (total > PREVIEW_CHARS || lines.at(-1) === '')) lines.pop()
  lines = lines.map(l => (l.length > PREVIEW_LINE ? `${l.slice(0, PREVIEW_LINE)}…` : l))
  const fit = fitSerialized(lines, PREVIEW_CHARS)
  if (total > PREVIEW_CHARS || fit.length < lines.length) note = `first ${fit.length.toLocaleString('en')} lines of ${total.toLocaleString('en')} characters`
  return { path, text: fit.join('\n'), note, page }
}

async function loadDiff($: EngineInterface, path: string, folder: boolean): Promise<boolean> {
  const cwd = folder ? path : dirname(path)
  const born = await git($, cwd, ['rev-parse', '--verify', '--quiet', 'HEAD']).then(r => r.exitCode === 0, () => false)
  const base = born ? 'HEAD' : await git($, cwd, ['hash-object', '-t', 'tree', '--stdin'], 10_000, '').then(r => r.stdout.trim(), () => '')
  if (!base) return false
  const tracked = await git($, cwd, ['diff', base, '--no-color', '--no-ext-diff', '--src-prefix=a/', '--dst-prefix=b/', '--', path]).then(r => r.stdout, () => '')
  const others = await git($, cwd, ['ls-files', '--others', '--exclude-standard', '--full-name', '-z', '--', path]).then(r => r.stdout.split('\0').filter(Boolean), () => [] as string[])
  const top = (await get($)).top || cwd
  const files = splitPatch(tracked.slice(0, PREVIEW_CHARS))
  for (const rel of others.slice(0, 50)) {
    const run = await git($, top, ['diff', '--no-index', '--no-color', '--no-ext-diff', '--src-prefix=a/', '--dst-prefix=b/', '--', '/dev/null', rel]).catch(() => null)
    const file = run ? splitPatch(run.stdout.slice(0, PREVIEW_CHARS))[0] : undefined
    if (file) files.push({ path: rel, lines: file.lines })
  }
  if (!files.length) return false
  const many = folder || files.length > 1
  const lines = files.flatMap(f => (many ? [{ kind: '@' as const, text: f.path, old: 0, new: 0 }, ...f.lines] : f.lines))
  const note = many ? `${files.length} changed file${files.length === 1 ? '' : 's'} against HEAD` : others.length ? 'untracked file' : 'changes against HEAD'
  previewed = { path, text: '', note, diff: lines }
  return true
}

async function diffFile($: EngineInterface, path: string): Promise<void> {
  if (!diffWithSetting) {
    const t = await get($)
    const folder = t.nodes.find(n => n.id === path)?.kind === 'dir'
    if (t.preview === path && previewed?.path === path && previewed.diff) return folder ? closePreview($) : showPreview($, path)
    if (!(await loadDiff($, path, folder))) {
      $.ui.toast(`no changes in ${shortPath(path)}`)
      return
    }
    await patch($, () => ({ preview: path, previewTop: 0, selected: path }))
    $.clock.after(100, () => parkPreview($))
    return
  }
  const os = await osName($)
  const host = await editorHost($, os)
  try {
    if (host === 'herdr') return await openInHerdr($, diffWithSetting, path)
    if (host === 'tmux') {
      const run = await $.process.run(tmuxCommand(targetSetting, dirname(path), [...words(diffWithSetting), path]), { timeoutMs: 10_000 })
      if (run.exitCode !== 0) $.ui.toast(`could not diff ${shortPath(path)} with ${diffWithSetting}: ${run.stderr.trim().split('\n')[0] || `exit ${run.exitCode}`}`)
      return
    }
    if (os === 'linux') {
      const argv = ['sh', '-c', LINUX_LAUNCH, 'sh', 'xdg-terminal-exec', 'sh', '-c', 'cd "$1" && shift && exec "$@"', 'sh', dirname(path), ...words(diffWithSetting), path]
      const run = await $.process.run(argv, { timeoutMs: 10_000 })
      if (run.exitCode !== 0) $.ui.toast(`could not diff ${shortPath(path)} with ${diffWithSetting}: ${run.stderr.trim().split('\n')[0] || `exit ${run.exitCode}`}`)
      return
    }
    $.ui.toast('Diff with: a terminal command needs tmux, herdr or Linux. Clear Diff with to see the diff in the pane.')
  } catch {
    $.ui.toast(`could not diff ${shortPath(path)} with ${diffWithSetting}`)
  }
}

async function pngHeader($: EngineInterface, file: string): Promise<{ width: number; height: number } | null> {
  const run = await $.process.run(['od', '-An', '-tu1', '-N24', '--', file], { timeoutMs: 5_000 })
  return run.exitCode === 0 ? pngSize(Uint8Array.from(run.stdout.trim().split(/\s+/).map(Number))) : null
}

async function makePicture($: EngineInterface, job: PictureJob): Promise<Picture> {
  try {
    if ((await osName($)) === 'win32') return { state: 'failed', note: 'image preview needs Linux or macOS' }
    let file = job.path
    let size = job.kind === 'png' && job.size <= PNG_DIRECT_BYTES ? await pngHeader($, job.path) : null
    if (size && (size.width > PNG_DIRECT_PIXELS || size.height > PNG_DIRECT_PIXELS)) size = null
    let pages = 0
    if (!size) {
      const doc = job.kind === 'pdf' || job.kind === 'office'
      const argv = ['sh', '-c', POSTER, 'sh', job.path, pictureBase, pictureSession, job.sig, doc ? job.kind : job.kind === 'video' ? 'video' : 'image', coderFor(job.path), String(CACHE_KEEP), POLICY, ...(doc ? [String(job.page), String(job.px), job.pdf] : [])]
      const made = doc ? await spawnRun($, job, argv) : await $.process.run(argv, { timeoutMs: 30_000 })
      if (!made) return { state: 'failed', note: 'cancelled' }
      const why = made.stderr.trim().split('\n').filter(Boolean)[0] ?? ''
      if (made.exitCode === EXIT_MISSING) return { state: 'failed', note: why || 'no decoder on PATH', missing: true }
      if (made.exitCode === EXIT_LOCKED) return { state: 'failed', note: 'encrypted' }
      if (made.exitCode === EXIT_FAILED) return { state: 'failed', note: `could not decode${why ? `: ${why}` : ''}` }
      const [out = '', count = ''] = made.stdout.trim().split('\n')
      if (made.exitCode !== 0 || !out.startsWith('/')) return { state: 'failed', note: why || `could not decode, exit ${made.exitCode}` }
      file = out
      pages = Number(count) || 0
      sessionDir = dirname(file)
      size = await pngHeader($, file)
    }
    return size ? { state: 'ready', file, generation: Math.floor(job.mtime) + job.page * 7 + job.px, ...size, ...(pages ? { pages } : {}) } : { state: 'failed', note: 'could not read the picture size' }
  } catch (err) {
    return { state: 'failed', note: String((err as Error)?.message ?? err).split('\n')[0] ?? 'could not decode' }
  }
}

function forget($: EngineInterface, path: string): void {
  const old = pictures.get(path)
  pictures.delete(path)
  if (old?.picture.state === 'ready' && old.picture.file !== path) void $.process.run(['rm', '-f', '--', old.picture.file], { timeoutMs: 5_000 }).catch(() => undefined)
}

async function spawnRun($: EngineInterface, job: PictureJob, argv: string[]): Promise<{ exitCode: number; stdout: string; stderr: string } | null> {
  const stream = $.process.spawn({ argv })
  let stopped = false
  current = { job, stop: () => { stopped = true; void stream.return(undefined as never).catch(() => undefined) } }
  let stdout = ''
  let stderr = ''
  let exitCode = 1
  try {
    for (;;) {
      const step = await stream.next()
      if (step.done) {
        exitCode = step.value?.code ?? 1
        break
      }
      if (step.value.stream === 'stdout') stdout += step.value.text
      else stderr += step.value.text
    }
  } catch {
    if (!stopped) throw new Error('could not start sh')
  } finally {
    current = null
  }
  return stopped ? null : { exitCode, stdout, stderr }
}

async function convert($: EngineInterface, job: PictureJob): Promise<void> {
  if (converting) {
    if (nextJob && pictures.get(nextJob.key)?.sig === nextJob.sig) pictures.delete(nextJob.key)
    if (current && current.job.path !== job.path && (current.job.kind === 'pdf' || current.job.kind === 'office')) current.stop()
    nextJob = job
    return
  }
  converting = true
  let cur: PictureJob | null = job
  while (cur) {
    const made = await makePicture($, cur)
    const entry = pictures.get(cur.key)
    if (entry?.sig === cur.sig && made.state === 'failed' && made.note === 'cancelled') pictures.delete(cur.key)
    else if (entry?.sig === cur.sig) entry.picture = made
    else if (made.state === 'ready' && made.file !== cur.path) void $.process.run(['rm', '-f', '--', made.file], { timeoutMs: 5_000 }).catch(() => undefined)
    void $.ui.invalidate('ui.render')
    cur = nextJob
    nextJob = null
  }
  converting = false
}

async function picture($: EngineInterface, path: string, page = 0, px = 0): Promise<Picture | null> {
  const kind = pictureKind(path)
  if (!kind) return null
  const stat = await $.fs.stat(path).catch(() => null)
  if (!stat) return { state: 'failed', note: 'could not read' }
  if (stat.kind !== 'file') return { state: 'failed', note: 'not a regular file' }
  const doc = kind === 'pdf' || kind === 'office'
  const at = doc ? Math.max(1, page) : 0
  const wide = doc ? Math.max(200, Math.min(1600, Math.round(px / 100) * 100)) : 0
  const key = doc ? `${path}\0${at}` : path
  const sig = cacheName(path, stat.mtimeMs, stat.size, at, wide)
  const pdf = kind === 'office' ? cacheName(path, stat.mtimeMs, stat.size, 0, 0, 'pdf') : ''
  const known = pictures.get(key)
  const gone = known?.sig === sig && known.picture.state === 'ready' && known.picture.file !== path && !(await $.fs.stat(known.picture.file).then(f => f.kind === 'file', () => false))
  if (gone && known.retried) known.picture = { state: 'failed', note: 'the preview cache was cleared' }
  if (gone && !known.retried) pictures.delete(key)
  else if (known?.sig === sig) {
    pictures.delete(key)
    pictures.set(key, known)
    return known.picture
  }
  if (known && pictures.has(key)) forget($, key)
  pictures.set(key, { sig, picture: { state: 'pending' }, retried: gone })
  for (const old of pictures.keys()) {
    if (pictures.size <= CACHE_KEEP) break
    forget($, old)
  }
  void convert($, { path, key, kind, sig, mtime: stat.mtimeMs, size: stat.size, page: at, px: wide, pdf })
  return { state: 'pending' }
}

function stopScans(keep = ''): void {
  for (const scan of scans.values()) {
    if (scan.done || scan.dir === keep) continue
    scan.stopped = true
    scan.stop()
    scans.delete(`${scan.loc ? 'loc:' : ''}${scan.dir}`)
  }
}

function usageOf($: EngineInterface, dir: string, loc: boolean): Scan {
  const key = `${loc ? 'loc:' : ''}${dir}`
  const known = scans.get(key)
  if (known && (!known.stale || !known.done)) {
    scans.delete(key)
    scans.set(key, known)
    return known
  }
  const scan: Scan = { dir, loc, items: known?.items ?? [], total: known?.total ?? 0, done: false, stale: false, stopped: false, stop: () => undefined }
  scans.delete(key)
  scans.set(key, scan)
  for (const [old, s] of scans) if (scans.size > SCAN_KEEP && s.done) scans.delete(old)
  $.clock.after(0, () => void runScan($, scan, Boolean(known)))
  return scan
}

async function runScan($: EngineInterface, scan: Scan, seeded: boolean): Promise<void> {
  let out: Usage[] = seeded ? [] : scan.items
  let total = 0
  try {
    if (scan.loc) {
      if ((await osName($)) === 'win32') throw new Error('no find')
      const stream = $.process.spawn({ argv: locArgv(scan.dir, pruneArgs((await get($)).root)) })
      scan.stop = () => void stream.return(undefined as never).catch(() => undefined)
      let text = ''
      let drawn = 0
      for await (const chunk of stream) {
        if (scan.stopped) return
        if (chunk.stream !== 'stdout') continue
        text += chunk.text
        if (seeded || Date.now() - drawn < SCAN_DRAW_MS) continue
        drawn = Date.now()
        out = locUsage(parseLoc(text.slice(0, text.lastIndexOf('\n') + 1)), scan.dir).items
        scan.items = out
        void $.ui.invalidate('ui.render')
      }
      if (scan.stopped) return
      const files = parseLoc(text)
      takeLoc(files, scan.dir, true)
      const got = locUsage(files, scan.dir)
      out = got.items
      total = got.total
    } else if ((await osName($)) === 'win32') {
      for (const entry of await $.fs.list(scan.dir)) {
        if (scan.stopped) return
        const path = join(scan.dir, entry.name)
        out.push({ path, name: entry.name, bytes: entry.kind === 'dir' && !entry.isLink ? Math.max(0, await walkSize($, path)) : entry.kind === 'file' ? entry.size : 0 })
        if (!seeded) void $.ui.invalidate('ui.render')
      }
    } else {
      const stream = $.process.spawn({ argv: ['du', '-akxH', '-d', '2', '--', scan.dir] })
      scan.stop = () => void stream.return(undefined as never).catch(() => undefined)
      let text = ''
      let drawn = 0
      for await (const chunk of stream) {
        if (scan.stopped) return
        if (chunk.stream !== 'stdout') continue
        text += chunk.text
        if (seeded || Date.now() - drawn < SCAN_DRAW_MS) continue
        drawn = Date.now()
        out = parseDu(text.slice(0, text.lastIndexOf('\n') + 1), scan.dir).items
        scan.items = out
        void $.ui.invalidate('ui.render')
      }
      if (scan.stopped) return
      const got = parseDu(text, scan.dir)
      out = got.items
      total = got.total ?? 0
    }
  } catch (err) {
    if (scan.stopped) return
    if (/aborted/.test(String((err as Error)?.message ?? err))) {
      const key = `${scan.loc ? 'loc:' : ''}${scan.dir}`
      if (scans.get(key) === scan) scans.delete(key)
      void $.ui.invalidate('ui.render')
      return
    }
  }
  scan.items = out
  scan.total = total || out.reduce((a, u) => a + u.bytes, 0)
  scan.done = true
  void $.ui.invalidate('ui.render')
}

async function mapUp($: EngineInterface, anchor: string): Promise<void> {
  const t = await get($)
  mapLock = { anchor: dirname(anchor), pick: anchor, cursor: t.cursor }
  void $.ui.invalidate('ui.render')
}

function markStale($: EngineInterface, paths: string[]): void {
  for (const p of paths) staleQueue.add(posix(p))
  if (staleTimer) return
  staleTimer = $.clock.after(STALE_MS, () => {
    staleTimer = null
    const hit = [...staleQueue]
    staleQueue.clear()
    let any = false
    for (const scan of scans.values()) {
      if (!hit.some(p => inside(scan.dir, p))) continue
      scan.stale = true
      any = true
    }
    if (any) void $.ui.invalidate('ui.render')
  })
}

async function pickTile($: EngineInterface, id: string): Promise<void> {
  if (id.startsWith(REST)) return
  const now = await $.clock.now()
  const isDouble = lastPress.key === `tile:${id}` && now - lastPress.at < DOUBLE_MS
  lastPress = { key: isDouble ? '' : `tile:${id}`, at: now }
  const t = await get($)
  const kind = t.nodes.find(n => n.id === id)?.kind ?? (await $.fs.stat(id).then(s => s.kind, () => 'file'))
  if (isDouble && kind === 'dir') {
    drillTile($, id, t.cursor)
    return
  }
  const shows = inside(t.root, id) && !isIgnored(t.root, id) && (t.showHidden || !id.slice(id.lastIndexOf('/') + 1).startsWith('.'))
  mapLock = { anchor: mapAnchor, pick: id, cursor: shows ? id : t.cursor }
  if (!shows) {
    void $.ui.invalidate('ui.render')
    return
  }
  await patch($, cur => ({ expanded: [...new Set([...cur.expanded, ...ancestorsOf(id, cur.root)])], cursor: id, selected: id, scroll: null }))
  await revealPaths($, [id])
}

function drillTile($: EngineInterface, id: string, cursor: string): void {
  mapLock = { anchor: id, pick: '', cursor }
  void $.ui.invalidate('ui.render')
}

async function mapKey($: EngineInterface, key: string): Promise<boolean> {
  const t = await get($)
  if (!mapLock || mapLock.cursor !== t.cursor || !mapLock.pick || (key !== 'return' && key !== 'l' && key !== 'right')) return false
  const pick = mapLock.pick
  const kind = t.nodes.find(n => n.id === pick)?.kind ?? (await $.fs.stat(pick).then(s => s.kind, () => 'file'))
  if (kind !== 'dir') return false
  drillTile($, pick, t.cursor)
  return true
}

function treeKey(): string {
  return shortcutsSetting === 'always' ? 'nav-o' : 'hk-tree'
}

function focusPane($: EngineInterface, root: string, key: string): void {
  void $.ui.open({ id: PANE, title: `Files: ${root.split('/').pop() || root}`, focus: true }).then(() => (key ? $.ui.focus({ requestId: PANE, key }) : undefined)).catch(() => {})
}

function toggleShortcuts($: EngineInterface): void {
  if (shortcutsSetting !== 'auto') return
  const mine = ++shortcutsTimer
  shortcutsShown = !shortcutsShown
  if (shortcutsShown) $.clock.after(SHORTCUTS_MS, () => {
    if (mine !== shortcutsTimer) return
    shortcutsShown = false
    void $.ui.invalidate('ui.render')
  })
  void $.ui.invalidate('ui.render')
}

async function toggleSplit($: EngineInterface): Promise<void> {
  overPeek = false
  peekTop = 0
  await patch($, cur => ({ split: !cur.split }))
}

function scrollSplit($: EngineInterface, to: number): void {
  const last = Math.max(0, (peeked?.text.split('\n').length ?? 1) - peekRows)
  const top = Math.max(0, Math.min(last, to))
  if (top === peekTop) return
  peekTop = top
  void $.ui.invalidate('ui.render')
}

function peekTarget(t: FileTree): string {
  const cur = t.nodes.find(n => n.id === t.cursor)
  if (cur) return cur.kind === 'dir' ? '' : cur.id
  const sel = t.selected ? t.nodes.find(n => n.id === t.selected) : undefined
  return sel && sel.kind !== 'dir' ? sel.id : ''
}

async function showPreview($: EngineInterface, path: string): Promise<void> {
  await loadPreview($, path)
  await patch($, () => ({ preview: path, previewTop: 0, selected: path }))
  $.clock.after(100, () => parkPreview($))
}

function parkPreview($: EngineInterface): void {
  void $.ui.focus({ requestId: PANE, key: editWithSetting || inTmux || inHerdr ? 'edit' : 'back' }).catch(() => {})
}

async function closePreview($: EngineInterface): Promise<void> {
  await patch($, () => ({ preview: '', previewTop: 0 }))
  $.clock.after(100, async () => focusPane($, (await get($)).root, treeKey()))
}

async function jumpDiff($: EngineInterface, dir: 1 | -1): Promise<void> {
  const lines = previewed?.diff
  if (!lines) return
  const files = lines.some(l => l.kind === '@')
  const marks = lines.flatMap((l, i) => {
    if (files) return l.kind === '@' ? [i] : []
    const prev = lines[i - 1]
    const gap = !prev || l.old !== prev.old + (prev.kind === '+' ? 0 : 1) || l.new !== prev.new + (prev.kind === '-' ? 0 : 1)
    return gap ? [i] : []
  })
  const t = await get($)
  const to = dir > 0 ? marks.find(i => i > t.previewTop) : [...marks].reverse().find(i => i < t.previewTop)
  if (to !== undefined) await patch($, () => ({ previewTop: to }))
}

async function scrollPreview($: EngineInterface, by: number): Promise<void> {
  const t = await get($)
  const last = Math.max(0, (previewed?.diff?.length ?? previewed?.text.split('\n').length ?? 1) - previewRows)
  const top = Math.max(0, Math.min(last, t.previewTop + by))
  if (top !== t.previewTop) await patch($, () => ({ previewTop: top }))
}

function directPreview(elements: any, win: { text: string; top: number } | { segments: { title: string; source: string }[]; top: number }, path: string, markdown: boolean, accent: string) {
  const { Box, Text, Markdown, Code } = elements
  if ('segments' in win) {
    return (
      <Box flexDirection="column">
        {win.segments.map((g, i) => (
          <Box key={`seg-${i}`} flexDirection="column">
            {g.title ? <Text bold color={accent || undefined}>{g.title}</Text> : null}
            {g.source ? <Code source={g.source} path={g.title || path} format="diff" wrap="truncate-end" /> : null}
          </Box>
        ))}
      </Box>
    )
  }
  return markdown ? <Markdown text={win.text} /> : <Code source={win.text} path={path} startLine={win.top + 1} wrap="truncate-end" />
}

function previewLines(text: string, top: number, rows: number, markdown: boolean): { text: string; top: number } {
  const lines = text.split('\n')
  const from = Math.max(0, Math.min(top, lines.length - 1))
  let shown = lines.slice(from, from + rows)
  if (markdown) {
    let fence = ''
    let opener = ''
    for (const line of lines.slice(0, from)) {
      const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
      if (!m) continue
      const mark = m[1] ?? ''
      if (!fence) {
        fence = mark
        opener = line.trimStart()
      } else if (mark[0] === fence[0] && mark.length >= fence.length && !(m[2] ?? '').trim()) fence = ''
    }
    if (fence) shown = [opener, ...shown]
  }
  return { text: shown.join('\n'), top: from }
}

async function openFile($: EngineInterface, path: string, how: { mode?: string; line?: number } = {}): Promise<void> {
  const chosen = (how.mode ?? openWithSetting).trim()
  const mode = how.mode === undefined && binariesInDefaultApp && chosen !== 'preview' && isBinaryPath(path) ? '' : chosen
  if (mode === 'preview') return showPreview($, path)
  const os = await osName($)
  const host = mode === 'editor' ? await editorHost($, os) : ''
  if (mode === 'editor' && !host) {
    $.ui.toast('Open with: editor requires tmux or herdr on Linux or macOS. Clear Open with to use the default app, or set a custom command.')
    return
  }
  const native = (p: string) => (os === 'win32' ? p.replace(/\//g, '\\') : p)
  const custom = mode === 'editor' ? null : openWithCommand(mode, native(path), native(dirname(path)), how.line)
  const editor = mode === 'editor' ? (await $.env.get('VISUAL')) || (await $.env.get('EDITOR')) || 'vi' : undefined
  try {
    if (editor && host === 'herdr') return await openInHerdr($, editor, path, how.line)
    const { argv, init } = editor ? tmuxOpenCommand(editor, path, how.line, targetSetting) : custom ? { argv: os === 'linux' ? ['sh', '-c', LINUX_LAUNCH, 'sh', ...custom] : custom, init: { timeoutMs: 10_000 } } : openCommand(os, path)
    const run = await $.process.run(argv, init)
    if (run.exitCode !== 0) $.ui.toast(`could not open ${path} with ${editor ?? custom?.[0] ?? argv[0]}: ${run.stderr.trim().split('\n')[0] || `exit ${run.exitCode}`}`)
  } catch {
    $.ui.toast(`could not open ${path} with ${editor ?? custom?.[0] ?? 'the default app'}`)
  }
}

async function editorHost($: EngineInterface, os: 'linux' | 'darwin' | 'win32'): Promise<'tmux' | 'herdr' | ''> {
  if (os === 'win32') return ''
  if (await $.env.get('TMUX')) return 'tmux'
  return (await $.env.get('HERDR_ENV')) ? 'herdr' : ''
}

async function openInHerdr($: EngineInterface, editor: string, path: string, line?: number): Promise<void> {
  const { split, run, init } = herdrOpenCommand((await $.env.get('HERDR_BIN_PATH')) || 'herdr', editor, path, line, targetSetting, (await $.env.get('HERDR_WORKSPACE_ID')) || '')
  const made = await $.process.run(split, init)
  const sent = made.exitCode === 0 ? await $.process.run(run(herdrPane(made.stdout)), init) : made
  if (sent.exitCode !== 0) $.ui.toast(`could not open ${path} with ${editor}: ${herdrError(sent.stderr) || `exit ${sent.exitCode}`}`)
}

async function editPreview($: EngineInterface, path: string): Promise<void> {
  if (editWithSetting || inTmux || inHerdr) await openFile($, path, { mode: editWithSetting || 'editor', line: previewLine })
}

async function quickLook($: EngineInterface, path: string): Promise<void> {
  try {
    await $.process.run(['sh', '-c', '(nohup qlmanage -p "$1" >/dev/null 2>&1 &); sleep 0.4; osascript -e \'tell application "System Events" to set frontmost of first process whose name is "qlmanage" to true\' >/dev/null 2>&1 || true', 'sh', path], { timeoutMs: 10_000 })
  } catch {
    $.ui.toast(`could not preview ${path} with Quick Look`)
  }
}

async function toggle($: EngineInterface, n: FileNode): Promise<void> {
  if (n.kind === 'dir' && !(await get($)).expanded.includes(n.id)) await loadDirs($, [n.id])
  await patch($, t => {
    const open = new Set(t.expanded)
    if (n.kind === 'dir') open.has(n.id) ? open.delete(n.id) : open.add(n.id)
    return { expanded: [...open], cursor: n.id, selected: n.id }
  })
  void watchTree($)
}

async function press($: EngineInterface, n: FileNode): Promise<void> {
  const now = await $.clock.now()
  const isDouble = lastPress.key === n.id && now - lastPress.at < DOUBLE_MS
  lastPress = { key: isDouble ? '' : n.id, at: now }
  if (!isDouble) {
    await toggle($, n)
    return
  }
  await openNode($, n)
}

async function openNode($: EngineInterface, n: FileNode): Promise<void> {
  if (n.kind === 'dir') {
    follow = false
    await reset($, n.id)
  } else await openFile($, n.id)
}

function turnPage($: EngineInterface, by: number): boolean {
  const kind = peekPath ? pictureKind(peekPath) : ''
  if (kind !== 'pdf' && kind !== 'office') return false
  if (kind === 'office' && !pictures.has(`${peekPath}\0${docPages.get(peekPath) ?? 1}`)) return true
  const now = docPages.get(peekPath) ?? 1
  const next = Math.max(1, Math.min(docCounts.get(peekPath) ?? now + 1, now + by))
  if (next !== now) {
    docPages.set(peekPath, next)
    void $.ui.invalidate('ui.render')
  }
  return true
}

async function cellPixels($: EngineInterface): Promise<{ cw: number; ch: number } | null> {
  try {
    const [cw = 0, ch = 0] = (await $.process.run(['python3', '-I', '-c', CELL_PROBE], { timeoutMs: 3_000 })).stdout.trim().split(/\s+/).map(Number)
    return cw > 2 && ch > 4 ? { cw, ch } : null
  } catch {
    return null
  }
}

async function ghosttyColors($: EngineInterface): Promise<TermColors> {
  const args = (await $.process.run(['sh', '-c', GHOSTTY_ARGS], { timeoutMs: 3_000 }).catch(() => ({ stdout: '' }))).stdout.split('\n')
  const files = args.filter(a => a.startsWith('--config-file=')).map(a => a.slice('--config-file='.length).replace(/^\?/, ''))
  const own = args.includes('--config-default-files=false') ? '' : (await $.process.run(['ghostty', '+show-config'], { timeoutMs: 3_000 }).catch(() => ({ stdout: '' }))).stdout
  const read = await Promise.all(files.map(f => $.fs.read(f).then(String, () => '')))
  return parseGhostty([own, ...read, ...args.filter(a => a.startsWith('--'))].join('\n'))
}

async function navigate($: EngineInterface, key: string, shift = false, surface?: string): Promise<void> {
  const t = await get($)
  const rows = visibleRows(t)
  const at = rows.findIndex(r => r.node.id === t.cursor)
  const cur = rows[at]?.node
  const onRoot = Boolean(t.root) && t.cursor === t.root
  const move = (d: number) => {
    const to = onRoot ? (d < 0 ? -1 : Math.min(rows.length - 1, d - 1)) : at === 0 && d === -1 ? -1 : Math.max(0, Math.min(rows.length - 1, (at < 0 ? 0 : at) + d))
    const id = to < 0 ? t.root : rows[to]?.node.id
    return id ? patch($, () => ({ cursor: id, selected: id, scroll: null })) : Promise.resolve()
  }
  const page = Math.max(1, peekRows - 1)
  const peek: Record<string, number> = { f: page, b: -page, pageup: -page, pagedown: page }
  if (key === 'p' && surface !== 'desktop' && t.split && mapLock?.cursor === t.cursor && mapLock.pick === t.cursor && peekTarget(t)) {
    mapLock = null
    void $.ui.invalidate('ui.render')
  } else if (key === 'p' && surface !== 'desktop') await toggleSplit($)
  else if (t.split && splitShown && surface !== 'desktop' && (key === '[' || key === ']') && turnPage($, key === ']' ? 1 : -1)) return
  else if (t.split && splitShown && surface !== 'desktop' && key in peek) scrollSplit($, peekTop + (peek[key] ?? 0))
  else if (key === 'up' || key === 'k') await move(-1)
  else if (key === 'down' || key === 'j') await move(1)
  else if (key === 'pageup') await move(-10)
  else if (key === 'pagedown') await move(10)
  else if (key === 'home') await move(-rows.length)
  else if (key === 'end') await move(rows.length)
  else if (key === '?') toggleShortcuts($)
  else if (key === 's') $.clock.after(50, () => focusPane($, t.root, 'q'))
  else if (cur && key === 'd') await diffFile($, cur.id)
  else if (cur && (key === 'y' || key === 'Y')) await copyPath($, cur.id, key === 'Y' || shift, surface)
  else if (cur && (key === 'right' || key === 'l') && cur.kind === 'dir' && !t.expanded.includes(cur.id)) await toggle($, cur)
  else if (cur && (key === 'left' || key === 'h')) {
    if (cur.kind === 'dir' && t.expanded.includes(cur.id)) await toggle($, cur)
    else if (cur.parent !== t.root) await patch($, () => ({ cursor: cur.parent, selected: cur.parent }))
  } else if (cur && (key === 'return' || key === 'o')) await (cur.kind !== 'dir' ? openNode($, cur) : toggle($, cur))
  else if (cur && (key === ' ' || key === 'space')) await (cur.kind !== 'dir' && (await osName($)) === 'darwin' ? quickLook($, cur.id) : toggle($, cur))
}

async function pressHeader($: EngineInterface, id: string): Promise<void> {
  const t = await get($)
  if (id === 'up') {
    follow = false
    await reset($, dirname(t.root))
  } else if (id === 'cwd') {
    follow = true
    await reset($, await cwdOf($))
  } else if (id === 'refresh') {
    searchIndex = null
    for (const scan of scans.values()) scan.stale = true
    await staleSizes($)
    await loadDirs($, [t.root, ...t.expanded])
    await detectRepo($)
    await refreshGit($)
    if (t.query.trim()) await search($, t.query)
  } else if (id === 'hidden') await patch($, cur => ({ showHidden: !cur.showHidden }))
  else if (id === 'size') await patch($, cur => ({ column: cur.column === 'date' ? 'size' : cur.column === 'size' ? 'loc' : 'date' }))
  else if (id === 'collapse') await patch($, cur => ({ expanded: [], nodes: dropBelow(cur.nodes, cur.nodes.filter(x => x.parent === cur.root && x.kind === 'dir').map(x => x.id)) }))
  else if (id === 'unselect') await patch($, () => ({ selected: '', cursor: '' }))
  else if (id === 'external' && t.preview) await openFile($, t.preview, { mode: '' })
  else if (id === 'split') await toggleSplit($)
}

async function selectRoot($: EngineInterface): Promise<void> {
  mapLock = null
  await patch($, cur => ({ cursor: cur.root, selected: cur.root, scroll: null }))
}

function shortPath(path: string): string {
  return home && inside(home, path) ? `~${path.slice(home.length)}` : path
}

export const register: Register = (on, options) => {
  glyphSetting = typeof options?.glyphs === 'string' ? options.glyphs : 'auto'
  const activity = typeof options?.activity === 'string' ? options.activity : 'reads and writes'
  showReads = activity.includes('reads')
  showWrites = activity.includes('writes')
  followClaude = options?.follow !== 'off'
  columnDefault = options?.column === 'size' || options?.column === 'loc' ? options.column : 'date'
  showAge = options?.column === 'age'
  showHints = options?.hints !== 'off'
  ignoreNames = typeof options?.ignore === 'string' ? options.ignore.split(/[\s,]+/).filter(Boolean) : []
  searchGap = options?.spacing !== 'off'
  shortcutsSetting = options?.shortcuts === 'always' || options?.shortcuts === 'off' ? options.shortcuts : 'auto'
  shortcutsShown = shortcutsSetting === 'always'
  treemapSetting = options?.treemap === 'image' || options?.treemap === 'cells' || options?.treemap === 'off' ? options.treemap : 'auto'
  openWithSetting = typeof options?.open === 'string' ? options.open : ''
  binariesInDefaultApp = options?.binaries === 'default app'
  editWithSetting = typeof options?.edit === 'string' ? options.edit.trim() : ''
  palette = parsePalette(options?.palette)
  diffWithSetting = typeof options?.diff === 'string' ? options.diff.trim() : ''
  targetSetting = terminalTarget(options?.target)
  noDock = options?.start === 'off'
  splitAt = options?.split === 'top' ? 'top' : 'bottom'
  on('session.start', async ($, e, next) => {
    cached ??= { ...emptyTree(''), ...(await $.state.get(TREE)).value }
    await $.command.register({ name: 'filetree', description: 'Show or hide the file tree; args: [path | open] (no path = cwd, open = never hide)' })
    if (palette.unknown.length) void $.ui.toast(`filetree palette: ignored ${palette.unknown.join(' ')}; use key=#hex with fg, bg, accent, muted, urgent, selection, hover, added, modified, renamed, add or del`)
    const windows = (await $.env.get('OS')) === 'Windows_NT'
    useDrives(windows)
    inTmux = !windows && Boolean(await $.env.get('TMUX'))
    inHerdr = !windows && Boolean(await $.env.get('HERDR_ENV'))
    pictureSession = (await $.session.id()).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64) || 'session'
    pictureBase = ((await $.env.get('XDG_RUNTIME_DIR')) || (await $.env.get('TMPDIR')) || '/tmp').replace(/\/+$/, '') || '/'
    home = posix(((await $.env.get('HOME')) || (await $.env.get('USERPROFILE')) || '').replace(/[\\/]+$/, ''))
    activityId = Math.max(activityId, ...(await activities($)).map(a => a.id))
    void (async () => {
      const ready = (async () => {
        pointer = await finePointerOk($)
        const termProgram = await $.env.get('TERM_PROGRAM')
        kittyTerm = !windows && !inTmux && !inHerdr && (termProgram === 'ghostty' || Boolean(await $.env.get('KITTY_WINDOW_ID')) || /kitty|ghostty/.test((await $.env.get('TERM')) ?? ''))
        if (treemapSetting === 'image' || (treemapSetting === 'auto' && kittyTerm)) {
          cellPx = await cellPixels($)
          if (termProgram === 'ghostty') termColors = await ghosttyColors($)
        }
        try {
          const remote = Boolean((await $.env.get('SSH_CONNECTION')) || (await $.env.get('SSH_TTY')))
          noNerd = !remote && (windows || (await fontState($, 'f04eb')) !== 'ok')
        } catch {
          noNerd = true
        }
        await readThemeSetting($).catch(() => undefined)
      })()
      const t = await get($)
      if (t.flashOn) await patch($, () => ({ flash: [], flashDim: [], flashOn: false, flashTones: {} }))
      if (t.preview) await patch($, () => ({ preview: '', previewTop: 0 }))
      await setActivities($, cur => cur.map(a => (a.state === 'running' ? { ...a, state: 'failed', label: `${a.kind} interrupted` } : a)))
      const cwd = await cwdOf($)
      const shown = !t.root || t.nodes.length === 0 || (follow && t.root !== cwd) ? reset($, cwd, false, ready) : ready.then(() => (noDock ? undefined : $.ui.open({ id: PANE, title: `Files: ${t.root.split('/').pop() || t.root}` })))
      await ready
      ageTick?.cancel()
      ageTick = showAge ? $.clock.every(AGE_TICK_MS, () => $.ui.invalidate('ui.render')) : null
      gitPoll?.cancel()
      gitStamp = null
      gitPoll = $.clock.every(GIT_POLL_MS, () => void followCwd($).then(moved => moved || gitChanged($)).then(() => watchTree($)))
      await shown
    })()
    return next(e)
  })

  on('config.set', { key: 'theme' }, async ($, e, next) => {
    const result = await next(e)
    await readThemeSetting($).catch(() => undefined)
    return result
  })

  on('command.run', { command: 'filetree' }, async ($, e) => {
    const given = (e.args ?? '').trim()
    if (!given && (await $.ui.panes().catch(() => [])).some(p => p.id === PANE && p.isShown)) {
      noDock = true
      await $.ui.close({ id: PANE }).catch(() => undefined)
      return { text: 'File tree closed.' }
    }
    const terminal = await $.session.surfaces().then(s => s.includes('terminal'), () => true)
    if (terminal && !e.presentation.isFullscreen) return { text: 'filetree shows in the sidebar, which needs the fullscreen layout. Run /tui fullscreen, then /filetree.' }
    if (terminal && e.presentation.columns < 110) return { text: 'filetree shows in the sidebar, which needs a terminal at least 110 columns wide. Widen it, then run /filetree.' }
    noDock = false
    const arg = given === 'open' ? '' : given
    const cwd = await cwdOf($)
    follow = !arg
    const root = arg ? resolve(cwd, arg, home) : cwd
    await reset($, root, true)
    return { text: `File tree on ${shortPath(root)}${follow ? ' (follows the cwd)' : ''}.` }
  })

  on('tool.call', async ($, e, next) => {
    const shell = e.tool === 'Bash' || e.tool === 'PowerShell'
    if (e.tool !== 'Edit' && e.tool !== 'Write' && e.tool !== 'NotebookEdit' && !shell) return next(e)
    const command = e.tool === 'Bash' || e.tool === 'PowerShell' ? e.command : ''
    const cwd = shell ? await cwdOf($) : ''
    const actions = gitActions(command)
    const quiet = !actions.length && readOnly(command)
    const since = await sinceNow($, shell && !quiet)
    const before = actions.some(a => a.verb === 'commit') ? await get($) : null
    const head = before?.top ? await headOf($, before.root) : ''
    const pending: Pending | null = actions.length ? { actions, ids: await startGit($, actions), command, head } : null
    let result: Awaited<ReturnType<typeof next>>
    try {
      result = await next(e)
    } catch (err) {
      if (pending) await finishGit($, pending, failAll(pending))
      if (since.mark) void $.process.run(['rm', '-f', since.mark], { timeoutMs: 3_000 }).catch(() => undefined)
      throw err
    }
    if (pending && result.deny) {
      const ids = pending.ids
      void setActivities($, cur => cur.filter(a => !ids.includes(a.id)))
    }
    if (result.deny || (result.isError && !shell)) {
      if (since.mark) void $.process.run(['rm', '-f', since.mark], { timeoutMs: 3_000 }).catch(() => undefined)
      return result
    }
    if (shell) {
      const out: Partial<BuiltinToolResults['Bash']> = !result.isError && result.result && typeof result.result === 'object' ? (result.result as Partial<BuiltinToolResults['Bash']>) : {}
      const reads = showReads ? readTargets(command, cwd, typeof out.stdout === 'string' ? out.stdout : '', home) : []
      const job: Job = { actions: [], since, initRepo: actions.some(a => a.init), readOnly: quiet || result.isReadOnly === true }
      if (out.backgroundTaskId) background.set(out.backgroundTaskId, { p: pending, job, reads })
      else void (async () => {
        const results = pending ? await outcomes($, pending, !result.isError, out.gitOperation) : []
        if (pending) await finishGit($, pending, results)
        queuedReads.push(...reads)
        scheduleScan($, { ...job, actions: proven(pending, results) })
      })()
      if (follow && /(^|[;&|\s])(cd|pushd|popd)(\s|$)/.test(command)) $.clock.after(400, () => void followCwd($))
    } else {
      const file =
        'file_path' in e && typeof e.file_path === 'string'
          ? e.file_path
          : 'notebook_path' in e && typeof e.notebook_path === 'string'
            ? e.notebook_path
            : ''
      if (file) void touched($, [file], 'orange', showWrites)
    }
    return result
  })

  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    const result = await next(e)
    if (result.deny || result.isError || e.tool !== 'Read' || !showReads) return result
    void touched($, [posix(e.file_path)], 'purple', true)
    return result
  })

  for (const tool of ['Grep', 'Glob'] as const)
    on('tool.call', { tool }, async ($, e, next) => {
      const result = await next(e)
      if (result.deny || result.isError || !showReads) return result
      const names = (result.result as Partial<BuiltinToolResults['Grep']> | undefined)?.filenames
      if (!Array.isArray(names) || names.length === 0) return result
      const cwd = await cwdOf($)
      void touched($, names.map(f => resolve(cwd, posix(f), home)), 'purple', true)
      return result
    })

  on('ui.message', async ($, e, next) => {
    if (e.requestId === PANE && e.element.startsWith('button-') && e.data && typeof e.data === 'object') {
      const id = e.element.slice('button-'.length)
      const data = e.data as { over?: unknown; press?: unknown }
      if (data.press) await pressHeader($, id)
      else if (data.over === true || hovered === id) {
        hovered = data.over === true ? id : ''
        void $.ui.invalidate('ui.render')
      }
      return {}
    }
    if (e.requestId === PANE && e.element === 'peek' && e.data && typeof e.data === 'object') {
      const data = e.data as { key?: unknown; over?: unknown; scrollTo?: unknown }
      if (typeof data.over === 'boolean') overPeek = data.over
      else if (typeof data.scrollTo === 'number') {
        const last = Math.max(0, (peeked?.text.split('\n').length ?? 1) - peekRows)
        scrollSplit($, Math.round(Math.max(0, Math.min(1, data.scrollTo)) * last))
      } else if (typeof data.key === 'string') {
        const page = Math.max(1, peekRows - 1)
        const by: Record<string, number> = { up: -1, k: -1, down: 1, j: 1, f: page, b: -page, pageup: -page, pagedown: page, space: page, ' ': page, home: -Infinity, end: Infinity }
        if (data.key === 'p') await toggleSplit($)
        else if (data.key === '[' || data.key === ']') turnPage($, data.key === ']' ? 1 : -1)
        else if (data.key in by) scrollSplit($, peekTop + (by[data.key] ?? 0))
      }
      return {}
    }
    if (e.requestId === PANE && e.element === 'treemap' && e.data && typeof (e.data as { tab?: unknown }).tab === 'string') {
      await pickTile($, (e.data as { tab: string }).tab)
      return {}
    }
    if (e.requestId !== PANE || (e.element !== 'rows' && e.element !== 'treemap') || !e.data || typeof e.data !== 'object') return next(e)
    const data = e.data as { press?: unknown; key?: unknown; ctrl?: unknown; shift?: unknown; scrollTo?: unknown; copy?: unknown }
    void sync($)
    const t = await get($)
    if (typeof data.copy === 'string') {
      await copyPath($, data.copy, Boolean(data.shift), e.surface)
      return {}
    }
    if (typeof data.scrollTo === 'number') {
      const to = Math.round(Math.max(0, Math.min(1, data.scrollTo)) * view.max)
      if (to !== t.scroll) await patch($, () => ({ scroll: to }))
      return {}
    }
    if (typeof data.press === 'string') {
      const n = t.nodes.find(x => x.id === data.press)
      if (!n) return {}
      if (t.scroll === null) await patch($, () => ({ scroll: view.from }))
      if (data.ctrl || data.shift) await openNode($, n)
      else await press($, n)
      return {}
    }
    if (typeof data.key !== 'string') return {}
    if (t.preview) {
      const page = Math.max(1, previewRows - 2)
      const by: Record<string, number> = { up: -1, k: -1, down: 1, j: 1, f: page, b: -page, pageup: -page, pagedown: page, home: -Infinity, end: Infinity }
      if (data.key === 'left' || data.key === 'h') await closePreview($)
      else if (data.key === 'e') await editPreview($, t.preview)
      else if (data.key === 'd') await diffFile($, t.preview)
      else if (previewed?.diff && (data.key === 'j' || data.key === 'k')) await jumpDiff($, data.key === 'j' ? 1 : -1)
      else if (data.key in by) await scrollPreview($, by[data.key] ?? 0)
      return {}
    }
    if (e.element === 'treemap' && (await mapKey($, data.key))) return {}
    await navigate($, data.key, Boolean(data.shift), e.surface)
    return {}
  })

  on('session.end', async ($, e, next) => {
    cached = null
    watcher?.stop()
    watcher = null
    snapshot?.cancel()
    snapshot = null
    const result = await next(e)
    if (sessionDir) {
      const dir = sessionDir
      sessionDir = ''
      pictures.clear()
      await $.process.run(['sh', '-c', CLEAN, 'sh', dir], { timeoutMs: 10_000 }).catch(() => undefined)
    }
    if (e.reason === 'clear' || e.reason === 'resume' || e.reason === 'other') $.clock.after(0, () => void settleRoot($))
    return result
  })

  on('ui.focus', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    const result = await next(e)
    void sync($)
    return result
  })

  on('ui.scroll', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (nativeScroll) return next(e)
    const t = await get($)
    if (t.preview) {
      await scrollPreview($, Math.sign(e.by) * Math.max(3, Math.abs(e.by)))
      return {}
    }
    if (t.split && overPeek) {
      scrollSplit($, peekTop + Math.sign(e.by) * Math.max(3, Math.abs(e.by)))
      return {}
    }
    const to = Math.max(0, Math.min(view.max, (t.scroll ?? view.from) + Math.sign(e.by) * Math.max(3, Math.abs(e.by))))
    if (to !== t.scroll) await patch($, () => ({ scroll: to }))
    return {}
  })

  on('prompt.submit', async ($, e, next) => {
    void settleBackground($, e.text)
    if (!(await followCwd($))) void sync($)
    const t = await get($)
    const context = [...(e.context ?? [])]
    if (t.selected && (await exists($, t.selected))) context.push(`The user has this file selected in the file tree; "this" or "it" in the prompt likely refers to it: ${t.selected}`)
    const mentions = [...e.text.matchAll(/@([^\s"'`]+)/g)]
      .map(m => (m[1] ?? '').replace(/[.,;:!?)]+$/, ''))
      .filter(Boolean)
      .map(p => resolve(t.root, p, home))
      .filter(p => inside(t.root, p))
    if (mentions.length) {
      void (async () => {
        const found: string[] = []
        for (const p of mentions) {
          try {
            await $.fs.stat(p)
            found.push(p.replace(/\/$/, ''))
          } catch {
            continue
          }
        }
        if (found.length) await reveal($, found)
      })()
    }
    return next(context.length ? { ...e, context } : e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (e.surface !== 'terminal' && e.surface !== 'desktop') return next(e)
    if (e.surface === 'terminal' && e.props.placement === 'inline') {
      noDock = true
      void $.ui.close({ id: PANE }).catch(() => undefined)
      const { Box: Empty } = $.ui.resolve(e)
      return <Empty />
    }
    const unicode = glyphSetting === 'plain' || glyphSetting === 'text' || (glyphSetting === 'auto' && (noNerd || e.surface === 'desktop'))
    const elements = $.ui.resolve(e)
    const { Box, Text, Button, Input, Client } = elements
    const Image = 'Image' in elements ? elements.Image : undefined
    const t = await get($)
    const light = e.surface !== 'desktop' && lightTerminal
    const theme: Theme = { ...DEFAULT_THEME, ...palette.theme }
    const tones = light ? LIGHT_TONES : TONES
    const mutedText = theme.muted ? { color: theme.muted } : { dimColor: true }
    const gitColors = { ...GIT_COLOR, ...palette.git }
    const addColor = palette.add ?? ADD_COLOR
    const delColor = palette.del ?? DEL_COLOR
    const rowColors = { activeBg: theme.selection, hoverBg: palette.hover ?? (theme.selection.startsWith('#') ? faint(theme.selection) : ''), tones: light ? LIGHT_SHIMMER : SHIMMER }
    nativeScroll = e.surface === 'desktop'
    const button = (b: ButtonProps) => <Client key={`button-${b.id}`} module="./button.tsx" props={{ id: b.id, label: b.label, dim: b.dim } satisfies ButtonProps} />
    const hint = (buttons: { id: string; label: string; hint: string }[], title: number) => {
      const text = buttons.find(b => b.id === hovered)?.hint
      if (!text) return null
      const room = e.props.bodyColumns - title - buttons.reduce((w, b) => w + b.label.length + (e.surface === 'desktop' ? 2 : 1), 0) - 2
      return text.length <= room ? <Text {...mutedText}>{`${text} `}</Text> : null
    }
    if (t.preview) {
      if (previewed?.path !== t.preview) await loadPreview($, t.preview)
      const p = previewed
      const markdown = /\.(md|markdown|mdx|docx|odt|rtf)$/i.test(t.preview)
      const all = p?.diff?.length ?? (p?.text ?? '').split('\n').length
      previewRows = nativeScroll ? all : Math.max(4, (e.props.scroll?.bodyRows ?? 40) - (p?.note ? 3 : 2))
      const start = nativeScroll ? 0 : p?.diff ? Math.min(t.previewTop, Math.max(0, all - 1)) : Math.min(t.previewTop, Math.max(0, all - previewRows))
      const win = p?.diff ? diffWindow(p.diff, start, previewRows) : previewLines(p?.text ?? '', start, previewRows, markdown)
      previewLine = win.top + 1
      const name = t.preview !== t.root && inside(t.root, t.preview) ? relative(t.root, t.preview) : shortPath(t.preview)
      const external = { id: 'external', label: glyphSetting === 'text' ? 'open' : unicode ? '↗' : '\u{eb14}', dim: true, hint: 'open in default app' }
      return (
        <Box flexDirection="column" minHeight={Math.max(1, e.props.scroll?.bodyRows ?? 1)} backgroundColor={theme.bg || undefined}>
          <Box flexDirection="row">
            <Button key="back" plain hotkey="h" autoFocus={editWithSetting || inTmux || inHerdr ? undefined : true} label={unicode ? '← files' : '\u{ea9b} files'} onPress={() => void closePreview($)} />
            <Text> </Text>
            <Box flexShrink={1} flexGrow={1}>
              <Text bold wrap="truncate-start">{name}</Text>
            </Box>
            {hint([external], 8 + name.length)}
            {button(external)}
          </Box>
          <Box flexDirection="row" gap={2}>
            {([['j', '↓', '\u{ea9a}', 1], ['k', '↑', '\u{eaa1}', -1], ['f', 'page ↓', '\u{ea9a} page', previewRows - 2], ['b', 'page ↑', '\u{eaa1} page', 2 - previewRows]] as const).map(([k, plain, nerd, by]) => {
              const step = p?.diff && (k === 'j' || k === 'k') ? (p.diff.some(l => l.kind === '@') ? 'file' : 'hunk') : ''
              const label = step ? `${unicode ? plain : nerd} ${step}` : unicode ? plain : nerd
              return <Button key={`pv-${k}`} plain dimColor hotkey={k} label={label} onPress={() => void (step ? jumpDiff($, by > 0 ? 1 : -1) : scrollPreview($, by)).then(() => parkPreview($))} />
            })}
            <Button key="pv-d" plain dimColor hotkey="d" label={p?.diff ? (t.nodes.find(n => n.id === t.preview)?.kind === 'dir' ? 'tree' : 'file') : 'diff'} onPress={() => void diffFile($, t.preview)} />
            {editWithSetting || inTmux || inHerdr ? <Button key="edit" plain dimColor autoFocus hotkey="e" label={`${unicode ? 'edit' : '\u{ea73} edit'} :${previewLine}`} onPress={() => void editPreview($, t.preview)} /> : null}
          </Box>
          {p?.note ? <Text {...mutedText}>{p.note}</Text> : null}
          {nativeScroll ? directPreview(elements, win, t.preview, markdown, theme.accent) : (
            <Client
              key="rows"
              module="./rows.tsx"
              props={{ rows: [], active: '', ...rowColors, pointer: false, preview: 'segments' in win ? { text: '', path: t.preview, startLine: win.top + 1, markdown: false, segments: win.segments, titleColor: theme.accent } : { text: win.text, path: t.preview, startLine: win.top + 1, markdown } } satisfies RowsProps}
            />
          )}
        </Box>
      )
    }
    const now = await $.clock.now()
    const live = (await activities($)).filter(a => now - a.at < (a.state === 'running' ? RUNNING_MAX_MS : ACTIVITY_TTL_MS))
    const latest = [...live].reverse().find(a => a.state === 'running') ?? live[live.length - 1]
    const bright = new Set(t.flashOn ? t.flash : [])
    const dimmed = new Set(t.flashOn ? t.flashDim : [])
    const ignored = new Set(t.ignored)
    const untracked = new Set(t.untrackedDirs)
    const width = Math.max(24, e.props.bodyColumns)
    const rows = visibleRows(t)
    const body = e.props.scroll?.bodyRows ?? 40
    const footer = t.nodes.find(n => n.id === t.cursor)?.id ?? (t.selected || '')
    const chrome = 1 + (searchGap ? 2 : 0) + 1 + (t.top ? (t.branch ? 1 : 0) : showHints ? 1 : 0) + (footer || latest || shortcutsShown || shortcutsSetting === 'auto' ? 1 : 0)
    const spare = body - chrome - 5
    const splitRows = t.split && !nativeScroll && spare >= 6 && (treemapSetting !== 'off' || Boolean(peekTarget(t))) ? Math.min(Math.max(6, Math.floor(body * 0.45)), spare) : 0
    splitShown = splitRows > 0
    if (!splitShown) overPeek = false
    const fixed = splitRows + 1 + (searchGap ? 2 : 0) + 1 + (t.top ? (t.branch ? 1 : 0) : showHints ? 1 : 0) + (footer || latest || shortcutsShown || shortcutsSetting === 'auto' ? 1 : 0)
    const room = nativeScroll ? Math.max(1, rows.length) : Math.max(5, (e.props.scroll?.bodyRows ?? 40) - fixed)
    const isLit = (id: string) => bright.has(id) || dimmed.has(id)
    const focus = followClaude && t.flashOn ? ([...t.flash].reverse().find(id => id !== BRANCH_ROW) ?? t.cursor) : t.cursor
    const at = Math.max(0, rows.findIndex(r => r.node.id === focus))
    const lit = followClaude && t.flashOn ? rows.findIndex(r => isLit(r.node.id)) : -1
    const cap = Math.max(1, Math.floor(room / 3))
    let from = Math.max(0, Math.min(lit >= 0 && at - lit < room - 2 ? Math.max(0, lit - 1) : at - Math.floor(room / 2), rows.length - room))
    let pinned = !nativeScroll && followClaude && t.flashOn ? rows.slice(0, from).filter(r => isLit(r.node.id)).slice(-cap) : []
    if (pinned.length) {
      const rest = Math.max(3, room - pinned.length)
      from = Math.max(0, Math.min(at - Math.floor(rest / 2), rows.length - rest))
      pinned = rows.slice(0, from).filter(r => isLit(r.node.id)).slice(-cap)
    }
    const max = Math.max(0, rows.length - room)
    if (t.scroll !== null) {
      from = Math.max(0, Math.min(t.scroll, max))
      pinned = []
    }
    view = { from, max }
    const shown = rows.slice(from, from + room - pinned.length)
    if (t.column === 'size') wantSizes($, [...pinned, ...shown].filter(r => r.node.kind === 'dir' && !(r.node.id in t.dirSizes)).map(r => r.node.id))
    if (t.column === 'loc') {
      const seen = [...pinned, ...shown].map(r => r.node)
      wantLoc($, seen.filter(n => n.kind === 'dir' && !locCache.has(n.id)).map(n => n.id), true)
      wantLoc($, [...new Set(seen.filter(n => n.kind === 'file' && counted(n.name) && !locListed.has(n.parent)).map(n => n.parent))], false)
    }
    const totals: [number, number] = t.top ? (t.diff[t.root] ?? [0, 0]) : [0, 0]
    const countSegs = (c: [number, number, number] | undefined): Seg[] => {
      if (!c) return []
      const out: Seg[] = []
      if (c[0] > 0) out.push({ t: ` ?:${c[0]}`, c: gitColors['?'] ?? addColor })
      if (c[1] > 0) out.push({ t: ` M:${c[1]}`, c: gitColors.M ?? 'ansi256(3)' })
      if (c[2] > 0) out.push({ t: ` D:${c[2]}`, c: theme.urgent })
      return out
    }
    const rootCounts = t.top ? countSegs(t.counts[t.root]) : []
    const plainButtons = [
      ...(t.selected ? [{ id: 'unselect', label: unicode ? '⊘' : '\u{eabd}', dim: false, hint: 'clear selection' }] : []),
      { id: 'up', label: unicode ? '△' : '\u{ebff}', dim: true, hint: 'parent folder' },
      { id: 'cwd', label: unicode ? '◎' : '\u{eb06}', dim: !follow, hint: 'follow the cwd' },
      { id: 'refresh', label: unicode ? '⮌' : '\u{eb37}', dim: true, hint: 'reload tree and git' },
      { id: 'hidden', label: unicode ? (t.showHidden ? '⊙' : '○') : t.showHidden ? '\u{f0b95}' : '\u{eae7}', dim: !t.showHidden, hint: t.showHidden ? 'hide hidden files' : 'show hidden files' },
      { id: 'size', label: unicode ? '◫' : '\u{ea90}', dim: t.column === 'date', hint: t.column === 'date' ? 'show sizes' : t.column === 'size' ? 'show lines of code' : 'show dates' },
      { id: 'collapse', label: unicode ? '⊟' : '\u{eac5}', dim: true, hint: 'collapse all' },
      ...(nativeScroll ? [] : [{ id: 'split', label: unicode ? '⊡' : splitAt === 'top' ? '\u{ebf6}' : '\u{ec01}', dim: !t.split, hint: t.split ? 'hide preview' : 'show preview' }]),
    ]
    const wordButtons = plainButtons.map(b => ({ ...b, label: WORDS[b.id] ?? b.label }))
    const wordWidth = wordButtons.reduce((w, b) => w + b.label.length + 1, 1)
    const buttons = glyphSetting === 'text' && e.props.bodyColumns - wordWidth >= 8 ? wordButtons : plainButtons
    const rootGlyph = unicode ? '■' : t.top === t.root ? '\u{f02a2}' : '\u{e5fe}'
    const header = t.top ? [t.top.split('/').pop() ?? t.top, t.prefix.replace(/\/$/, '')].filter(Boolean).join('/') : t.root.split('/').pop() || t.root

    const rowSpec = (r: (typeof rows)[number]): RowSpec => {
      const n = r.node
      const own = t.git[n.id]
      const status = own ?? (underAny(dirname(n.id), untracked, t.root) ? '?' : undefined)
      const isIgnored = !status && underAny(n.id, ignored, t.root)
      const gitColor = status === 'D' || status === 'U' ? theme.urgent : status ? (gitColors[status] ?? theme.muted) : undefined
      const isBright = bright.has(n.id)
      const isDim = !isBright && dimmed.has(n.id)
      const tone = t.flashTones[n.id] ?? 'orange'
      const iconColor = isIgnored ? theme.muted : (gitColor ?? (n.hidden ? theme.muted : n.kind === 'dir' ? theme.accent : theme.muted))
      const nameColor = isIgnored ? theme.muted : (gitColor ?? (n.hidden ? theme.muted : theme.fg || undefined))
      const loc = t.diff[n.id]
      const meta = t.column === 'loc'
        ? n.kind === 'dir'
          ? locCache.has(n.id)
            ? (locCache.get(n.id) ?? 0) > 0 ? formatLoc(locCache.get(n.id) ?? 0) : ''
            : '…'
          : n.kind === 'file' && counted(n.name)
            ? locCache.has(n.id)
              ? formatLoc(locCache.get(n.id) ?? 0)
              : locListed.has(n.parent) ? '' : '…'
            : ''
        : t.column === 'size'
        ? n.kind === 'dir'
          ? n.id in t.dirSizes
            ? formatSize(t.dirSizes[n.id] ?? -1)
            : '…'
          : n.kind === 'file' || (n.kind === 'link' && n.size > 0)
            ? formatSize(n.size)
            : ''
        : loc
          ? ''
          : n.kind === 'file'
            ? showAge
              ? age(n.mtime, now)
              : stamp(n.mtime)
            : ''
      const locText = loc ? `${loc[0] ? ` +${loc[0]}` : ''}${loc[1] ? ` -${loc[1]}` : ''}` : ''
      const dirCounts = n.kind === 'dir' ? countSegs(t.counts[n.id]) : []
      const badge = dirCounts.length ? '' : status ? ` ${status}` : isIgnored ? (unicode ? ' ⊘' : ' \u{f05e}') : '  '
      const countsText = dirCounts.map(c => c.t).join('')
      const cols = Math.max(4, width - r.depth * 2 - 6 - (meta ? meta.length + 1 : 0) - locText.length - badge.length - countsText.length)
      const name = n.name.length > cols ? n.name.slice(0, cols - 1) + '…' : n.name
      const caret = n.kind === 'dir' ? (unicode ? (r.open ? '▾' : '▸') : r.open ? CHEVRON_OPEN : CHEVRON_CLOSED) + ' ' : '  '
      const isRepo = n.kind === 'dir' && n.id === t.top
      const glyph = unicode ? (n.kind === 'dir' ? '■' : '∙') : fileIcon(n, r.open, isRepo)
      const lit = isBright || isDim
      const left: Seg[] = [
        { t: '  '.repeat(r.depth) },
        { t: caret, c: theme.muted },
        lit ? { t: glyph + ' ', sh: tone, dim: isDim, one: true } : { t: glyph + ' ', c: iconColor },
        lit ? { t: name, sh: tone, dim: isDim, b: isBright } : { t: name, c: nameColor, b: n.id === t.selected, s: status === 'D' && n.kind !== 'dir' },
      ]
      const right: Seg[] = []
      if (meta) right.push({ t: ` ${meta}`, c: theme.muted })
      if (loc && loc[0] > 0) right.push({ t: ` +${loc[0]}`, c: addColor })
      if (loc && loc[1] > 0) right.push({ t: ` -${loc[1]}`, c: delColor })
      right.push(...dirCounts)
      if (badge) right.push({ t: badge, c: status ? gitColor : theme.muted, b: true })
      return { id: n.id, left: clean(left), right: clean(right) }
    }

    const note = (text: string): RowSpec => ({ id: '', left: [{ t: text, c: theme.muted }], right: [] })
    const specs: RowSpec[] = [
      ...(rows.length === 0 ? [note('empty')] : []),
      ...pinned.map(rowSpec),
      ...(pinned.length > 0 ? [note('  ⋮')] : []),
      ...shown.map(rowSpec),
    ]
    if (nativeScroll) {
      let size = 0
      const cut = specs.findIndex(r => (size += JSON.stringify(r).length + 1) > ROWS_BUDGET)
      if (cut >= 0) specs.splice(cut, specs.length - cut, note(`  … ${specs.length - cut} more rows, collapse folders or use search`))
    }
    const barSize = Math.max(1, Math.round((specs.length * shown.length) / Math.max(1, rows.length)))
    const bar =
      !nativeScroll && rows.length > shown.length + pinned.length
        ? { pos: max ? Math.round((from / max) * (specs.length - barSize)) : 0, size: barSize, thumb: theme.accent, track: theme.muted }
        : undefined

    const branchRow = () => {
      if (!t.top || !t.branch) return null
      const b = t.branch
      const isFlash = bright.has(BRANCH_ROW)
      const tone = t.flashTones[BRANCH_ROW] ?? 'teal'
      const label = b.head
      return (
        <Box flexDirection="row" height={1} overflow="hidden">
          <Box flexDirection="row" flexShrink={0}>
            <Text color={isFlash ? (tones[tone]?.solid ?? theme.accent) : theme.accent}>{(unicode ? BRANCH_ICON.plain : BRANCH_ICON.nerd) + ' '}</Text>
            <Text bold color={isFlash ? (tones[tone]?.solid ?? (theme.fg || undefined)) : theme.fg || undefined}>
              {label}
            </Text>
            {b.ahead > 0 && <Text color={tones.teal?.solid}>{` ↑${b.ahead}`}</Text>}
            {b.behind > 0 && <Text color={tones.blue?.solid}>{` ↓${b.behind}`}</Text>}
          </Box>
          {b.upstream && (
            <Box flexShrink={1} overflow="hidden">
              <Text {...mutedText} wrap="truncate-end">
                {` ${b.upstream}`}
              </Text>
            </Box>
          )}
          <Box flexGrow={1} />
          <Box flexDirection="row" flexShrink={0}>
            {totals[0] > 0 && <Text color={addColor}>{` +${totals[0]}`}</Text>}
            {totals[1] > 0 && <Text color={delColor}>{` -${totals[1]}`}</Text>}
            {rootCounts.map(c => (
              <Text color={c.c}>{c.t}</Text>
            ))}
            {rootCounts.length === 0 && totals[0] === 0 && totals[1] === 0 && <Text {...mutedText}> clean</Text>}
          </Box>
        </Box>
      )
    }

    const chip = (a: Activity) => {
      const tone = a.state === 'failed' ? 'red' : a.tone
      const color = tones[tone]?.solid ?? theme.accent
      const icon = unicode ? a.plain : a.nerd
      const hash = a.state === 'done' && a.kind === 'git commit' ? a.detail.split(' ')[0] ?? '' : ''
      return (
        <Box flexDirection="row" marginLeft={2}>
          <Text color={color}>{icon + ' '}</Text>
          <Text bold={a.state === 'running'} color={color}>
            {a.state === 'running' ? `${a.label}…` : a.label}
          </Text>
          {hash && <Text {...mutedText}>{` ${hash}`}</Text>}
        </Box>
      )
    }

    const peek = async () => {
      if (!splitRows) {
        stopScans()
        return null
      }
      peekRows = splitRows - 2
      const lock = mapLock?.cursor === t.cursor ? mapLock : null
      if (mapLock && !lock) mapLock = null
      const target = lock ? '' : peekTarget(t)
      const anchor = target ? '' : (lock?.anchor ?? (t.nodes.find(n => n.id === t.cursor)?.kind === 'dir' ? t.cursor : t.root))
      mapPick = lock?.pick ?? ''
      stopScans(anchor)
      if (target !== peekPath) {
        peekPath = target
        peeked = null
        peekTop = 0
        overPeek = false
      }
      let start = peekTop
      const rule = <Text key="peek-rule" {...mutedText}>{'─'.repeat(Math.max(1, e.props.bodyColumns))}</Text>
      const shown = target || anchor
      const name = shown ? (shown === t.root ? shown.split('/').pop() || shown : inside(t.root, shown) ? relative(t.root, shown) : shortPath(shown)) : ''
      const docKind = target ? pictureKind(target) : ''
      const isDoc = docKind === 'pdf' || docKind === 'office'
      const docPixels = Boolean(Image) && !imageDenied && !inTmux && !inHerdr
      const page = isDoc ? (docPages.get(target) ?? 1) : 0
      const px = Math.round(Math.max(1, e.props.bodyColumns - 1) * (cellPx?.cw ?? 10))
      const raw = target && (!isDoc || docPixels) ? await picture($, target, page, px) : null
      const pic = isDoc && raw && raw.state !== 'ready' && !(raw.state === 'failed' && raw.note === 'encrypted') ? null : raw
      if (isDoc && raw?.state === 'ready' && raw.pages) {
        docCounts.set(target, raw.pages)
        if (page < raw.pages) void picture($, target, page + 1, px)
      }
      if (!target || pic) overPeek = false
      let content: RenderElement
      let status = ''
      if (!target && anchor) {
        mapAnchor = anchor
        const scan = usageOf($, anchor, t.column === 'loc')
        const cols = Math.max(8, e.props.bodyColumns - 1)
        const tiles = layout(scan.items, cols, peekRows)
        const total = scan.done ? scan.total : scan.items.reduce((a, u) => a + u.bytes, 0)
        const lit = t.flashOn ? t.flash : []
        const pick = tiles.find(x => x.path === mapPick)
        const ground = theme.bg
        const shade = ground.startsWith('#') && theme.accent.startsWith('#')
        const pct = (bytes: number) => { const p = total ? Math.round((bytes / total) * 100) : 0; return bytes && !p ? '<1%' : `${p}%` }
        const accent = colorOf(theme.accent, termColors, light)
        const ink = colorOf(theme.fg, termColors, light)
        const paper = termColors.bg ?? (theme.bg ? colorOf(theme.bg, termColors, light) : light ? [255, 255, 255] as Rgb : [24, 24, 24] as Rgb)
        const muted = colorOf(theme.muted || 'ansi256(8)', termColors, light)
        const hex = (c: Rgb) => `#${c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`
        const inks = [ink, paper, colorOf('ansi256(15)', termColors, light), colorOf('ansi256(0)', termColors, light)]
        const known = shade || Boolean(termColors.bg)
        const dimmed = (tile: Tile) => tile.path.startsWith(REST) || (!t.showHidden && tile.name.startsWith('.')) || isIgnored(t.root, tile.path)
        const boxOf = (tile: Tile) => {
          if (!dimmed(tile)) return boxLook(paper, accent, inks, tile.depth, total ? tile.bytes / total : 0)
          const fill = over(paper, muted, 0.3)
          return { fill, ink: inkOn(fill, inks) }
        }
        const heat = (tile: Tile, picked: boolean) => {
          const hot = lit.find(f => inside(tile.path, f))
          const warm = !hot && tile.parent ? lit.find(f => inside(tile.parent?.path ?? '', f)) : undefined
          const from = hot ?? warm
          const tone = from ? colorOf(tones[t.flashTones[from] ?? 'orange']?.solid ?? theme.accent, termColors, light) : undefined
          const lift: [Rgb, number] | undefined = picked ? [ink, 0.85] : hot && tone ? [tone, 0.8] : tone ? [paper, 0.35] : undefined
          return { tone, lift }
        }
        const look = (tile: Tile) => {
          const picked = tile === pick
          const { tone, lift } = heat(tile, picked)
          if (lift) {
            const fill = over(lift[0] === paper && tone ? over(paper, tone, 0.8) : paper, lift[0], lift[1])
            const c = hex(readable(fill, 1, ink, paper))
            return { name: c, size: c, bold: true, bg: hex(fill), rank: picked ? 2 : 1 }
          }
          if (known) {
            const box = boxOf(tile)
            const c = hex(box.ink)
            return { name: c, size: c, bold: true, bg: hex(box.fill), rank: 0 }
          }
          const top = !dimmed(tile) && !(tile.depth % 2)
          return { name: top ? 'ansi256(0)' : 'ansi256(15)', size: top ? 'ansi256(0)' : 'ansi256(15)', bold: true, bg: top ? 'ansi256(4)' : 'ansi256(8)', rank: 0 }
        }
        const amount = scan.loc ? formatLoc : formatSize
        status = pick ? `${pick.name} ${amount(pick.bytes)} ${pct(pick.bytes)}` : `${amount(total)}${scan.loc ? ' lines' : ''}${scan.done ? '' : ' …'}`
        const sized = (x: Tile) => `${amount(x.bytes)} ${pct(x.bytes)}`
        const pixels = Image && !imageDenied && (treemapSetting === 'image' || (treemapSetting === 'auto' && kittyTerm))
        if (pixels && tiles.length) {
          const cell = cellPx ?? { cw: 10, ch: 20 }
          const k = (Math.max(1, Math.round((cell.ch * 0.75) / 16)) * 16) / 0.75 / cell.ch
          const fit = fitPixels(cols, peekRows, cell.cw * k, cell.ch * k)
          const cw = (cell.cw * k) / fit.scale
          const ch = (cell.ch * k) / fit.scale
          const boxes = layoutPixels(scan.items, fit.width, fit.height, cw, ch, textHeight(ch))
          const under = new Map<Tile, Rgb>()
          const pixelLook = (tile: Tile): PixelLook => {
            const picked = tile.path === mapPick
            const { lift } = heat(tile, picked)
            const dim = dimmed(tile)
            const box = lift ? null : boxOf(tile)
            const seen = box ? box.fill : over((tile.parent && under.get(tile.parent)) || paper, lift?.[0] ?? accent, lift?.[1] ?? 1)
            under.set(tile, seen)
            return { fill: seen, alpha: 1, ink: box ? box.ink : readable(seen, 1, ink, paper), bold: true, rank: lift ? (picked ? 2 : 1) : 0, dim }
          }
          const looks = boxes.map(pixelLook)
          const key = JSON.stringify([fit, ink, boxes.map((b, i) => [b.path, b.x0, b.y0, b.x1, b.y1, sized(b), looks[i]])])
          if (mapImage?.key !== key) {
            const byTile = new Map(boxes.map((b, i) => [b, looks[i] as PixelLook]))
            mapImage = { key, png: png(paint(boxes, fit.width, fit.height, ch, b => byTile.get(b) as PixelLook, sized), fit.width, fit.height).toBase64() }
          }
          const zone: ZoneProps = { columns: cols, rows: peekRows, boxes: boxes.map(b => [b.path, b.x0 / cw, b.y0 / ch, b.x1 / cw, b.y1 / ch]) }
          if (!imageChecked) {
            imageChecked = true
            $.clock.after(300, () => void $.ui.blit({ requestId: PANE, key: 'treemap-image', source: { png: mapImage?.png ?? '' } }).then(r => {
              if (r.deny && /alt/i.test(r.deny)) {
                imageDenied = true
                $.ui.invalidate('ui.render')
              }
              if (r.deny) imageChecked = false
            }))
          }
          content = (
            <Box key="treemap-box" position="relative" height={peekRows} width={cols}>
              <Image key="treemap-image" source={{ png: mapImage.png }} columns={cols} rows={peekRows} alt=" " />
              <Box position="absolute" top={0} left={0}>
                <Client key="treemap" module="./zone.tsx" props={zone} />
              </Box>
            </Box>
          )
        } else content = tiles.length
          ? <Client key="treemap" module="./rows.tsx" props={{ rows: draw(tiles, cols, peekRows, look, sized), active: '', ...rowColors, pointer } satisfies RowsProps} />
          : <Text {...mutedText}>{scan.done ? 'empty' : 'sizing…'}</Text>
      } else if (!target) content = <Text {...mutedText}>no file selected</Text>
      else if (pic) {
        if (pic.state === 'ready' && Image) {
          const fit = fitCells(pic, Math.max(1, e.props.bodyColumns - 1), peekRows)
          status = isDoc ? `p ${page}/${pic.pages ?? '?'}` : `${pic.width}×${pic.height}`
          content = <Image key="peek-image" source={{ file: pic.file, format: 'png', generation: pic.generation }} columns={fit.columns} rows={fit.rows} alt={name} />
        } else content = <Text {...mutedText}>{pic.state === 'pending' ? 'decoding…' : pic.state === 'failed' ? pic.note : 'images show in the terminal'}</Text>
      } else {
        if (isDoc && (peeked?.path !== target || (docKind === 'pdf' && peeked.page !== page))) {
          const want = `${target}\0${page}`
          if (docReading !== want) {
            docReading = want
            $.clock.after(0, () => void readPreview($, target, page).then(p => {
              if (docReading !== want) return
              docReading = ''
              if (peekPath === target) {
                peeked = p
                peekTop = 0
              }
              void $.ui.invalidate('ui.render')
            }, () => {
              if (docReading === want) docReading = ''
            }))
          }
          if (peeked?.path !== target) peeked = { path: target, text: '', note: 'reading…', page }
        } else if (peeked?.path !== target) peeked = await readPreview($, target)
        const lines = peeked.text.split('\n')
        const last = Math.max(0, lines.length - peekRows)
        start = Math.min(start, last)
        const markdown = /\.(md|markdown|mdx|docx|odt|rtf)$/i.test(target)
        const win = previewLines(peeked.text, start, peekRows, markdown)
        status = `${docKind === 'pdf' ? `p ${page}${docCounts.has(target) ? `/${docCounts.get(target)}` : ''} ` : ''}${peeked.text ? `${start + 1}–${Math.min(lines.length, start + peekRows)}/${lines.length}` : ''}`.trim()
        const size = Math.max(1, Math.round((peekRows * peekRows) / Math.max(1, lines.length)))
        const bar = lines.length > peekRows ? { pos: last ? Math.round((start / last) * (peekRows - size)) : 0, size, thumb: theme.accent, track: theme.muted } : undefined
        if (!peeked.text) overPeek = false
        content = peeked.text
          ? <Client key="peek" module="./rows.tsx" props={{ rows: [], active: '', ...rowColors, pointer, ...(bar ? { bar } : {}), preview: { text: win.text, path: target, startLine: win.top + 1, markdown, rows: peekRows } } satisfies RowsProps} />
          : <Text {...mutedText}>{raw?.state === 'pending' ? 'converting…' : peeked.note || 'empty file'}</Text>
      }
      const title = (
        <Box key="peek-title" flexDirection="row" height={1} overflow="hidden">
          <Box flexShrink={1} flexGrow={1} overflow="hidden">
            {anchor && anchor !== t.root && !target ? (
              <Button key="map-up" plain label={`${glyphSetting === 'text' ? 'up ' : unicode ? '↑ ' : '\u{eaa1} '}${name}`} onPress={() => void mapUp($, anchor)} />
            ) : (
              <Text bold wrap="truncate-start">{name}</Text>
            )}
          </Box>
          {status ? <Box flexShrink={0}><Text {...mutedText}>{` ${status}`}</Text></Box> : null}
          {peeked?.note && peeked.text && !pic ? <Text {...mutedText}>{' partial'}</Text> : null}
        </Box>
      )
      const box = <Box key="peek-body" flexDirection="column" height={peekRows} overflow="hidden">{content}</Box>
      return splitAt === 'top'
        ? <Box key="peek-split" flexDirection="column" flexShrink={0}>{title}{box}{rule}</Box>
        : <Box key="peek-split" flexDirection="column" flexShrink={0}>{rule}{title}{box}</Box>
    }
    const split = await peek()

    const paging = splitShown && Boolean(peekPath) && (pictureKind(peekPath) === 'pdf' || (pictureKind(peekPath) === 'office' && Boolean(Image) && !imageDenied && !inTmux && !inHerdr))
    const park = () => focusPane($, t.root, paging ? 'rows' : treeKey())
    const footerName = footer === t.root ? t.root.split('/').filter(Boolean).pop() || t.root : footer ? (inside(t.root, footer) ? footer.slice(t.root.endsWith('/') ? t.root.length : t.root.length + 1) : shortPath(footer)) : ''
    const allKeys: { key: string; label: string; act: () => void }[] = [
      { key: 'jkhl', label: 'move', act: () => undefined },
      { key: 'o', label: 'open', act: () => void navigate($, 'return') },
      { key: 'd', label: 'diff', act: () => void navigate($, 'd') },
      { key: 's', label: 'search', act: () => focusPane($, t.root, 'q') },
      ...(e.surface === 'desktop' ? [] : [{ key: 'p', label: 'preview', act: () => void navigate($, 'p', false, e.surface).then(park) }]),
      { key: 'y', label: 'copy path', act: () => void navigate($, 'y', false, e.surface).then(park) },
      ...(paging ? [{ key: '[ ]', label: 'page', act: () => void (turnPage($, 1), park()) }] : []),
      ...(shortcutsSetting === 'auto' ? [{ key: '?', label: 'hide', act: () => undefined }] : []),
    ]
    const picked = new Set<string>()
    if (shortcutsShown) {
      let room = width - (footerName ? 12 + Math.min(footerName.length, 6) : 0) - (latest ? 6 + latest.label.length : 0)
      for (const key of ['?', 'jkhl', '[ ]', 'd', 'o', 's', 'p', 'y']) {
        const k = allKeys.find(x => x.key === key)
        if (!k) continue
        const w = (key === 'jkhl' ? 7 : key.length) + k.label.length + 4
        if (w > room) continue
        room -= w
        picked.add(key)
      }
    }
    const keys = allKeys.filter(k => picked.has(k.key))
    const hidden: [string, () => void][] = [
      ...(['j', 'k', 'h', 'l'] as const).map(k => [k, () => void navigate($, k).then(park)] as [string, () => void]),
      ...allKeys.filter(k => k.key.length === 1 && k.key !== '?' && !picked.has(k.key)).map(k => [k.key, k.act] as [string, () => void]),
    ]

    return (
      <Box flexDirection="column" minHeight={Math.max(1, e.props.scroll?.bodyRows ?? 1)} backgroundColor={theme.bg || undefined}>
        <Box flexDirection="row">
          <Box flexDirection="row" flexShrink={1} overflow="hidden" backgroundColor={t.cursor === t.root ? rowColors.activeBg || undefined : undefined}>
            <Button key="root" plain onPress={() => void selectRoot($).then(() => focusPane($, t.root, treeKey()))}>
              <Text color={theme.accent}>{`${rootGlyph} `}</Text>
              <Text bold color={theme.accent}>{header}</Text>
            </Button>
          </Box>
          <Box flexGrow={1} />
          {hint(buttons, header.length + 2)}
          <Box flexDirection="row" gap={1}>
            {buttons.map(button)}
            <Text> </Text>
          </Box>
        </Box>
        {splitAt === 'top' ? split : null}
        {branchRow()}
        {!t.top && showHints && <Text {...mutedText}>{unicode ? '± ' : '\u{e702} '}no git repo, git status starts after git init</Text>}
        {searchGap ? <Text key="gap-above"> </Text> : null}
        <Box flexDirection="row">
          {glyphSetting === 'text' ? null : <Text {...mutedText}>{unicode ? '⌕ ' : '\u{ea6d} '}</Text>}
          <Box flexGrow={1}>
            <Input
              key="q"
              placeholder="search"
              submitLabel="jump"
              value={t.query}
              onInput={(v: string) => void search($, v)}
              onSubmit={(v: string) => void jump($, v).then(() => $.clock.after(100, park))}
            />
          </Box>
          {t.query ? <Button key="clear" plain dimColor label={unicode ? '×' : '\u{ea76}'} onPress={() => void search($, '')} /> : null}
        </Box>
        {searchGap ? <Text key="gap-below"> </Text> : null}
        <Client
          key="rows"
          module="./rows.tsx"
          props={{ rows: specs, active: t.cursor, ...rowColors, pointer, ...(bar ? { bar } : {}) } satisfies RowsProps}
        />
        <Box flexGrow={1} />
        {splitAt === 'bottom' ? split : null}
        {(footer || latest || shortcutsShown || shortcutsSetting === 'auto') && (
          <Box flexDirection="row" height={1} overflow="hidden">
            {keys.length ? (
              <Box flexDirection="row" flexShrink={0} gap={2}>
                {keys.map(k => k.key === 'jkhl'
                  ? <Text key="nav-move" dimColor><Text color={theme.accent}>j k h l</Text>: move</Text>
                  : k.key === '[ ]'
                  ? <Button key="nav-page" plain dimColor label={`[ ]: ${k.label}`} onPress={k.act}><Text color={theme.accent}>[ ]</Text>{`: ${k.label}`}</Button>
                  : k.key === '?'
                  ? <Button key="nav-help" plain dimColor label={`?: ${k.label}`} onPress={() => { toggleShortcuts($); park() }}><Text color={theme.accent}>?</Text>{`: ${k.label}`}</Button>
                  : <Button key={`nav-${k.key}`} plain dimColor autoFocus={k.key === 'o' && shortcutsSetting === 'always' ? true : undefined} hotkey={k.key} label={k.label} onPress={k.act} />)}
              </Box>
            ) : shortcutsSetting === 'auto' ? (
              <Box flexShrink={0}>
                <Button key="nav-help" plain dimColor label="?: shortcuts" onPress={() => { toggleShortcuts($); park() }}><Text color={theme.accent}>?</Text>: shortcuts</Button>
              </Box>
            ) : null}
            <Box flexGrow={1} />
            {latest && chip(latest)}
            {footerName ? <Box flexShrink={0} marginLeft={2}><Text {...mutedText}>selected: </Text></Box> : null}
            {footerName ? (
              <Box flexShrink={1}>
                <Text {...mutedText} wrap="truncate-start">{footerName}</Text>
              </Box>
            ) : null}
          </Box>
        )}
        <Box key="hotkeys" height={0} overflow="hidden" flexDirection="row">
          {shortcutsSetting === 'always' ? null : <Button key="hk-tree" plain autoFocus label="o" onPress={() => void navigate($, 'return')} />}
          {hidden.map(([k, act]) => <Button key={`hk-${k}`} plain hotkey={k} label={k} onPress={act} />)}
        </Box>
      </Box>
    )
  })
}
