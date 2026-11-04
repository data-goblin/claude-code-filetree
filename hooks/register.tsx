import { type EngineInterface, type HookStream, type ProcessSpawnResult, type Register, type RenderElement, type RenderSurface, type Timer, update } from 'claude-code'
import { herdrError, herdrOpenCommand, herdrPane, herdrSplit, isBinaryPath, LINUX_LAUNCH, openCommand, openWithCommand, type Target, terminalTarget, tmuxCommand, tmuxOpenCommand, words } from './open'
import type { ButtonProps } from './button'
import { bindKeys } from './keybind'
import { CACHE_KEEP, cacheName, CLEAN, coderFor, EXIT_FAILED, EXIT_LOCKED, EXIT_MISSING, fitCells, PNG_DIRECT_BYTES, PNG_DIRECT_PIXELS, pictureKind, pngSize, POLICY, POSTER } from './peek'

import type { Activity, FileNode, FileTree, Theme } from '../types'
import { BRANCH_ICON, chainOf, type GitAction, gitActions, LIGHT_TONES, readOnly, readTargets, resolve, TONES } from './git'
import type { RowSpec, RowsProps, Seg } from './rows'
import { type DiffGroups, type DiffLine, diffGroups, diffWindow, GROUP, groupFiles, splitPatch } from './diff'
import { type Candidate, type Visit, frecency, parseZoxide, rankJump } from './jump'
import { pickRepo, shellPaths, shellWrites, type Touch, workIgnored } from './work'
import { counted, formatLoc, locArgv, locUsage, parseLocIn, scanFrom, scanned, sumDirs } from './loc'
import { draw, layout, layoutPixels, parseDu, REST, type Tile, type Usage } from './treemap'
import { boxLook, fitPixels, inkOn, over, paint, type PixelLook, png, readable, type Rgb, rgbOf, textHeight } from './pixmap'
import { CELL_PROBE, colorOf, GHOSTTY_ARGS, parseGhostty, type TermColors } from './term'
import type { ZoneProps } from './zone'
import type { HitProps } from './hit'
import { type FileRef, fileRefs, markdownSplit, parseHref, refHref } from './refs'
import { activityIcon, barSvg, lineSvg, selectionOn, DESK, DESK_GIT, DESK_GIT_TEXT, GAP_PX, iconSvg, type IconName, ink, lighten, nodeIcon, ROW_PX, rowSvg, STEP_PX, toolSvg } from './svg'
import { ADD_COLOR, DEL_COLOR, type Palette, parsePalette } from './palette'
import { BRAIN, CHEVRON_CLOSED, CHEVRON_OPEN, fileIcon, GIT_COLOR, GUARD, isMemory } from './icons'
import { allGuards, GUARD_TOOLS, guardIn, guardOver, type Guards, outsideOf, parseGuards, toggled } from './guard'
import {
  age,
  ancestorsOf,
  type Change,
  DEFAULT_THEME,
  dirname,
  emptyTree,
  formatSize,
  humanSize,
  badPattern,
  inside,
  isAbsolute,
  join,
  mapper,
  matcher,
  matchSpans,
  highlight,
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
  dateFormat,
  clockSetting,
  type DateFormat,
  type Clock,
  toNodes,
  underAny,
  visibleRows,
  collator,
  type Row,
} from './tree'
import { compileRegex, toEre } from './regex'
import { SCROLL_KEYS, shortcutGroups, shortcutRows } from './keys'

const TREE = { plugin: 'filetree', key: 'tree' } as const
const ACTIVITY = { plugin: 'filetree', key: 'activity' } as const
const VISITS = { plugin: 'filetree', key: 'visits' } as const
const ZOXIDE_TTL_MS = 10_000
const JUMP_INDEX_LIMIT = 4000
const PANE = 'filetree'
const SHIMMER = Object.fromEntries(Object.entries(TONES).map(([k, v]) => [k, { bright: v.bright, dim: v.dim }]))
const LIGHT_SHIMMER = Object.fromEntries(Object.entries(LIGHT_TONES).map(([k, v]) => [k, { bright: v.bright, dim: v.dim }]))
const BRANCH_ROW = '#branch'
const FLASH_MS = 2700
const RUNNING_MAX_MS = 600_000
const NO_REPO_DEPTH = 4
const DOUBLE_MS = 450
const FIND_LIMIT = 200
const GREP_LIMIT = 200
const MARK_LIMIT = 100
const GREP_MS = 15_000
const GREP_WAIT_MS = 150
const GREP_TEXT = 300
const GREP_WORK = 50_000_000
const GREP_LINE = 10_000
const IMAGE_BYTES = 2_097_152
const ROWS_BUDGET = 80_000
const DESK_ROWS = 400
const NAME_MIN = 10
const COLS = ['+', '-', '?', 'M', 'D', 'metric'] as const
const GIT_COLS = ['+', '-', '?', 'M', 'D'] as const
type Col = (typeof COLS)[number]
const DESK_ICON_COLS = 3
const HINT_MS = 5_000
const TOGGLES = ['cwd', 'hidden', 'size', 'split', 'autocollapse']
const SPIN_MS = 400
const DESK_ROW_CHARS = 40
const READ_REVEAL_LIMIT = 12
const SEARCH_REVEAL_LIMIT = 60
const ACTIVITY_TTL_MS = 45_000
const COLLAPSE_MS = 10_000
const EXPAND_MAX = 150
const GIT_POLL_MS = 2000
const FONT_SCRIPT =
  'if command -v fc-list >/dev/null 2>&1; then f=$(fc-list ":charset=$1" file | grep -vi lastresort | head -n1 | cut -d: -f1); fi; ' +
  '[ -n "$f" ] || for g in "$HOME"/Library/Fonts/*Nerd* /Library/Fonts/*Nerd*; do [ -f "$g" ] && LC_ALL=C grep -aqE "Nerd Fonts (3\\.([2-9]|[1-9][0-9])|[4-9]|[1-9][0-9]+)\\." "$g" && { f=$g; break; }; done; ' +
  '[ -n "$f" ] || { echo missing; exit 0; }; m=$(stat -c %Z "$f" 2>/dev/null || stat -f %c "$f"); p=$PPID; ' +
  'while [ -n "$p" ] && [ "$p" -gt 1 ]; do c=$(ps -o comm= -p "$p" 2>/dev/null); c=$(basename "$c" 2>/dev/null | tr -d " "); case "$c" in ' +
  'ghostty|kitty|alacritty|Alacritty|foot|footclient|wezterm-gui|konsole|gnome-terminal-|xterm|urxvt|st|Terminal|iTerm2) ' +
  'e=$(ps -o etime= -p "$p" 2>/dev/null | awk -F\'[-:]\' \'{n=NF; s=$n+60*$(n-1); if (n>2) s+=3600*$(n-2); if (n>3) s+=86400*$(n-3); print s}\'); [ -n "$e" ] && [ $(( $(date +%s) - e )) -lt "$m" ] && echo stale || echo ok; exit 0;; esac; ' +
  'p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d " "); done; echo ok'
const NERD_PROBE = 'f04eb ebff ebf6 ec01'
const PRUNE = ['.git', 'node_modules', 'target', '.venv', '__pycache__', 'dist', '.next']
const HOME_PRUNE = ['Library', 'AppData', '.Trash']
const SIZE_TIMEOUT_MS = 15_000
const SIZE_JOBS = 2
const SIZE_WALK_LIMIT = 50_000
const AGE_TICK_MS = 60_000
const GUARDS = 'guards'
const OUTSIDE = 'writes outside the repo'

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
const WORDS: Record<string, string> = { up: 'up', cwd: 'cwd', refresh: 'sync', hidden: 'dots', size: 'size', collapse: 'fold', autocollapse: 'auto', split: 'split', unselect: 'clear' }
let openWithSetting = ''
let binariesInDefaultApp = false
let editWithSetting = ''
let diffWithSetting = ''
let groupSetting: DiffGroups = 'folder'
let targetSetting: Target = 'auto'
let palette: Palette = parsePalette('')
let inTmux = false
let inHerdr = false
let previewLine = 1
let previewed: Preview | null = null
let previewRows = 20
let splitAt: 'bottom' | 'top' = 'bottom'
let jumpMovesClaude = true
let followWork = true
let workTouches: Touch[] = []
let workLast = 0
let mainBusy = false
let workDeciding = false
const workRepos = new Map<string, Promise<string | null>>()
let peeked: Preview | null = null
let marks: string[] = []
let markAnchor = ''
type LinkState = { kind: 'ok' | 'outside' | 'broken' | 'circular'; target: string }
const links = new Set<string>()
const linkStates = new Map<string, LinkState | null>()
let peekWant: { path: string; top: number } | null = null
let peekAt: { path: string; line: number; jumped: boolean } | null = null
let deskLine: { path: string; top: number; scrolled: boolean; line: number } | null = null
type GrepHit = { path: string; line: number; text: string }
type SearchFlag = 'searchCase' | 'searchRegex' | 'searchContent'
const grep = { key: '', rows: [] as GrepHit[], sel: 0, seq: 0, capped: false, busy: false, note: '', stop: null as (() => void) | null }
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
let dateSetting: DateFormat = 'year-month-day'
let clock: Clock = '24h'
let showHints = true
let showRemote = false
const ROOT_PRESS = '\u0000root'
let hintRoot = ''
let reloading = 0
let previewActs = new Map<string, () => void>()
let reloadSpin = 0
let hintUntil = 0
let focusOnOpen = true
let ignoreNames: string[] = []
let searchGap = true
let sortHeader = true
let longFile = 500
let guards: Guards = {}
let guardsLoaded: Promise<void> | null = null
let outside: string[] = []
const zjump = { on: false, query: '', sel: 0, rows: [] as string[], seq: 0, held: false }
let zoxideCache: { at: number; rows: Candidate[] } | null = null
let visitsCache: Record<string, Visit> | null = null
let autoCollapseDefault = false
const autoOpened = new Map<string, number>()
let collapseTimer: { cancel: () => void } | null = null
let collapseAt = 0
let shortcutsSetting: 'auto' | 'always' | 'off' = 'auto'
let shortcutsShown = false
let shortcutsTop = 0
let deskKeysAt = 0
let deskGrepShown = Infinity
let shortcutsMax = 0
let shortcutsPage = 1
let treemapSetting: 'auto' | 'image' | 'cells' | 'off' = 'auto'
let kittyTerm = false
let imageDenied = false
let imageChecked = false
let cellPx: { cw: number; ch: number } | null = null
let termColors: TermColors = { palette: {} }
let mapImage: { key: string; png: string } | null = null
let sizeEpoch = 0
let sizeActive = 0
let timeActive = 0
let timeQueue: [string, number][] = []
const timing = new Set<string>()
const timeFailed = new Set<string>()
const timeTries = new Map<string, number>()
const locTries = new Map<string, number>()
const TIME_TRIES = 3
const dirTimes = new Map<string, [number, number]>()
let sizeQueue: string[] = []
type Column = FileTree['column']
const locCache = new Map<string, number>()
const fileCounts = new Map<string, number>()
const counting = new Set<string>()
const countTries = new Map<string, number>()
let countQueue: string[] = []
const locListed = new Set<string>()
const locBusy = new Set<string>()
let locQueue: [string, boolean][] = []
let locActive = 0
const sizing = new Set<string>()
const listLatest = new Map<string, number>()
const unreadable = new Set<string>()
const background = new Map<string, Background>()

type Preview = { path: string; text: string; note: string; diff?: DiffLine[]; page?: number; first?: number }
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
  for (const seg of segs) for (const [k, v] of Object.entries(seg)) if (v === undefined) Reflect.deleteProperty(seg, k)
  return segs
}

function toHex(c: Rgb): string {
  return `#${c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`
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

function get(_$: EngineInterface): Promise<FileTree> {
  cached ??= emptyTree('')
  return Promise.resolve(cached)
}

function put($: EngineInterface, fn: (t: FileTree) => FileTree): Promise<void> {
  cached = fn(cached ?? emptyTree(''))
  snapshot ??= $.clock.after(1_000, () => {
    snapshot = null
    if (cached) void $.state.set(TREE, cached)
  })
  $.ui.invalidate('ui.render')
  return Promise.resolve()
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
    for (const e of entries) {
      const id = join(dir, e.name)
      linkStates.delete(id)
      if (e.isLink) links.add(id)
      else links.delete(id)
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
  const own = { key, stop: () => stopStream(stream) }
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

function staleGrep($: EngineInterface): void {
  if (!grep.key) return
  grep.key = ''
  void $.ui.invalidate('ui.render')
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
    for (const path of Object.keys(diff)) if (files[path] === 'new' || isIgnored(root, path)) delete diff[path]
    for (const path of Object.keys(files)) if (isIgnored(root, path)) delete files[path]
    const gitShown = Object.fromEntries(Object.entries(parsed.git).filter(([path]) => !isIgnored(root, path)))
    dirty = { root, files }
    await patch($, cur =>
      cur.root === root
        ? {
            git: gitShown,
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
  if (root) void recordVisit($, root)
  clearAutoCollapse()
  dirTimes.clear()
  timeFailed.clear()
  timeTries.clear()
  locTries.clear()
  fileCounts.clear()
  countTries.clear()
  countQueue = []
  timeQueue = []
  lastRoot = root
  hintRoot = ''
  marks = []
  markAnchor = ''
  linkStates.clear()
  searchIndex = null
  grepClear()
  sizeEpoch += 1
  sizeQueue = []
  await put($, () => ({ ...emptyTree(root), showHidden: prev.showHidden, column: prev.root ? prev.column : columnDefault, split: prev.split, searchCase: Boolean(prev.searchCase), searchRegex: Boolean(prev.searchRegex), searchContent: Boolean(prev.searchContent) }))
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

function globLiteral(name: string): string {
  return name.replace(/[*?[\]\\]/g, '\\$&')
}

function pruneArgs(root: string, ignored: string[] = []): string[] {
  const names = [...PRUNE, ...(broad(root) ? HOME_PRUNE : []), ...ignoreNames.map(globLiteral)]
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
    const giveUp = () => {
      if (epoch !== sizeEpoch) return
      if (deep && !locCache.has(dir)) locCache.set(dir, -1)
      locListed.add(dir)
      void $.ui.invalidate('ui.render')
    }
    void (async () => {
      if ((await osName($)) === 'win32') return giveUp()
      const t = await get($)
      const argv = locArgv(dir, pruneArgs(t.root))
      const run = await $.process.run(deep ? argv : [argv[0] ?? 'find', argv[1] ?? scanFrom(dir), '-maxdepth', '1', ...argv.slice(2)], { timeoutMs: SIZE_TIMEOUT_MS })
      if (epoch !== sizeEpoch) return
      takeLoc(parseLocIn(run.stdout, dir), dir, deep)
      locTries.delete(key)
      void $.ui.invalidate('ui.render')
    })()
      .catch(() => {
        if (epoch !== sizeEpoch) return
        const tries = (locTries.get(key) ?? 0) + 1
        locTries.set(key, tries)
        if (tries < TIME_TRIES) {
          if (!locQueue.some(([d, k]) => d === dir && k === deep)) locQueue.push([dir, deep])
          return
        }
        giveUp()
      })
      .finally(() => {
        locBusy.delete(key)
        locActive -= 1
        if (epoch !== sizeEpoch) {
          if (!(deep ? locCache.has(dir) : locListed.has(dir)) && !locQueue.some(([d, k]) => d === dir && k === deep)) locQueue.push([dir, deep])
          void $.ui.invalidate('ui.render')
        }
        pumpLoc($)
      })
  }
}

function takeCounts(text: string, dir: string): void {
  const counts = new Map<string, number>([[dir, 0]])
  const base = `${dir.replace(/\/+$/, '')}/`
  for (const line of scanned(text, dir).split('\n')) {
    if (!line.startsWith(base)) continue
    for (let d = dirname(line); d.length >= dir.length; d = dirname(d)) {
      counts.set(d, (counts.get(d) ?? 0) + 1)
      if (d === dir) break
    }
  }
  for (const [d, n] of counts) fileCounts.set(d, n)
}

function pumpCounts($: EngineInterface): void {
  while (counting.size < SIZE_JOBS && countQueue.length) {
    const dir = countQueue.shift() ?? ''
    const epoch = sizeEpoch
    counting.add(dir)
    void (async () => {
      if ((await osName($)) === 'win32') {
        fileCounts.set(dir, -1)
        return
      }
      const t = await get($)
      const run = await $.process.run(['find', scanFrom(dir), ...pruneArgs(t.root), '-type', 'f', '-print'], { timeoutMs: SIZE_TIMEOUT_MS })
      if (epoch !== sizeEpoch) return
      takeCounts(run.stdout, dir)
      countTries.delete(dir)
    })()
      .catch(() => {
        if (epoch !== sizeEpoch) return
        const tries = (countTries.get(dir) ?? 0) + 1
        countTries.set(dir, tries)
        if (tries < TIME_TRIES) countQueue.push(dir)
        else fileCounts.set(dir, -1)
      })
      .finally(() => {
        counting.delete(dir)
        void $.ui.invalidate('ui.render')
        pumpCounts($)
      })
  }
}

function wantCounts($: EngineInterface, dirs: string[]): void {
  for (const dir of dirs) if (!counting.has(dir) && !countQueue.includes(dir)) countQueue.push(dir)
  pumpCounts($)
}

function wantLoc($: EngineInterface, dirs: string[], deep: boolean): void {
  for (const dir of dirs) {
    if (locBusy.has(`${deep ? 'd' : 's'}${dir}`) || locQueue.some(([d, k]) => d === dir && k === deep)) continue
    locQueue.push([dir, deep])
  }
  pumpLoc($)
}

const DU_DARWIN_SH = 'du -kxH -d 2 -- "$1"; find -x "$1" -mindepth 1 -maxdepth 2 -type f -exec du -kH -- {} +'

const NEWEST_SH = 'd=$1; s=$2; shift 2; find "$d" "$@" -type f -exec stat "$s" {} + 2>/dev/null | awk -v d="$d" \'{ t = $1 + 0; p = substr($0, index($0, " ") + 1); while (1) { i = match(p, /\\/[^\\/]*$/); if (!i) break; p = substr(p, 1, i - 1); if (length(p) < length(d)) break; if (t > m[p]) m[p] = t; if (p == d) break } } END { for (k in m) print m[k], k }\''

async function newestUnder($: EngineInterface, dir: string, prune: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>([[dir, 0]])
  const fold = (file: string, ms: number) => {
    for (let d = dirname(file); d.length >= dir.length; d = dirname(d)) {
      if ((out.get(d) ?? 0) < ms) out.set(d, ms)
      if (d === dir) break
    }
  }
  const os = await osName($)
  if (os === 'win32') {
    let seen = 0
    let level = [dir]
    while (level.length) {
      const next: string[] = []
      for (const d of level) {
        const entries = await $.fs.list(d)
        out.set(d, out.get(d) ?? 0)
        for (const e of entries) {
          if (++seen > SIZE_WALK_LIMIT) throw new Error('walk limit')
          if (e.kind === 'dir' && !e.isLink && !PRUNE.includes(e.name)) next.push(join(d, e.name))
          else if (e.kind === 'file') fold(join(d, e.name), e.mtimeMs)
        }
      }
      level = next
    }
    return out
  }
  const shallow = PRUNE.includes(dir.split('/').pop() ?? '')
  const run = await $.process.run(['sh', '-c', NEWEST_SH, 'sh', dir, os === 'darwin' ? '-f%m %N' : '-c%Y %n', ...(shallow ? ['-maxdepth', '1'] : prune)], { timeoutMs: SIZE_TIMEOUT_MS })
  if (run.exitCode !== 0) throw new Error(run.stderr || 'find failed')
  for (const line of run.stdout.split('\n')) {
    const at = line.indexOf(' ')
    const secs = Number(line.slice(0, at))
    if (at > 0 && Number.isFinite(secs)) out.set(line.slice(at + 1), secs * 1000)
  }
  return out
}

function pumpTimes($: EngineInterface): void {
  while (timeActive < SIZE_JOBS && timeQueue.length) {
    const [dir] = timeQueue.shift() ?? ['', 0]
    if (dirTimes.has(dir) || [...timing].some(w => inside(w, dir))) continue
    const epoch = sizeEpoch
    timeActive += 1
    timing.add(dir)
    void (async () => {
      const t = await get($)
      const found = await newestUnder($, dir, pruneArgs(t.root))
      if (epoch !== sizeEpoch) return
      for (const [d, ms] of found) dirTimes.set(d, [0, ms])
      timeTries.delete(dir)
      void $.ui.invalidate('ui.render')
    })()
      .catch(() => {
        if (epoch !== sizeEpoch) return
        const tries = (timeTries.get(dir) ?? 0) + 1
        timeTries.set(dir, tries)
        if (tries < TIME_TRIES) {
          if (!timeQueue.some(([d]) => d === dir)) timeQueue.push([dir, 0])
          return
        }
        timeFailed.add(dir)
        void $.ui.invalidate('ui.render')
      })
      .finally(() => {
        timeActive -= 1
        timing.delete(dir)
        if (epoch !== sizeEpoch) {
          if (!dirTimes.has(dir) && !timeQueue.some(([d]) => d === dir)) timeQueue.push([dir, 0])
          void $.ui.invalidate('ui.render')
        }
        pumpTimes($)
      })
  }
}

function wantTimes($: EngineInterface, dirs: FileNode[]): void {
  for (const n of dirs) {
    if (dirTimes.has(n.id) || timeFailed.has(n.id) || timing.has(n.id) || timeQueue.some(([d]) => d === n.id)) continue
    timeQueue.push([n.id, 0])
  }
  timeQueue.sort(([a], [b]) => a.length - b.length)
  pumpTimes($)
}

function wantSizes($: EngineInterface, dirs: string[]): void {
  for (const dir of dirs) if (!sizing.has(dir) && !sizeQueue.includes(dir)) sizeQueue.push(dir)
  pumpSizes($)
}

async function staleSizes($: EngineInterface, paths?: string[]): Promise<void> {
  sizeEpoch += 1
  sizeQueue = []
  locQueue = []
  timeQueue = []
  if (!paths) {
    locCache.clear()
    locListed.clear()
    dirTimes.clear()
    timeFailed.clear()
    timeTries.clear()
    locTries.clear()
  }
  if (!paths) {
    fileCounts.clear()
    countTries.clear()
  }
  countQueue = []
  for (const p of paths ?? []) {
    locCache.delete(p)
    locListed.delete(p)
    for (let d = dirname(p), prev = p; d !== prev; prev = d, d = dirname(d)) fileCounts.delete(d)
    for (const d of [...fileCounts.keys()]) if (inside(p, d)) fileCounts.delete(d)
    for (let d = p, prev = ''; d !== prev; prev = d, d = dirname(d)) {
      dirTimes.delete(d)
      timeFailed.delete(d)
    }
    for (const d of [...dirTimes.keys()]) if (inside(p, d)) dirTimes.delete(d)
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
  const top = rowsOf(cur)[cur.scroll ?? view.from]?.node.id
  const at = top ? rowsOf({ ...cur, expanded }).findIndex(r => r.node.id === top) : -1
  return at < 0 ? {} : { scroll: at }
}

async function flash($: EngineInterface, tones: Record<string, string>): Promise<void> {
  const unique = Object.keys(tones)
  if (unique.length === 0) return
  const mine = ++generation
  const root = (await get($)).root
  blink?.cancel()
  blink = null
  const opened: string[] = []
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
          opened.push(a)
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
  await markOpened($, opened, unique)
  if (generation !== mine) return
  blink = $.clock.after(FLASH_MS, () => {
    if (generation !== mine) return
    blink = null
    void patch($, () => (generation === mine ? { flash: [], flashDim: [], flashOn: false, flashTones: {} } : {}))
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
type GitOperation = { commit?: { sha: string }; push: boolean; branch?: { action: string }; pr?: { action: string } }
type Outcome = { state: 'done' | 'failed'; label: string; detail: string }

const PROOF: Record<string, (op: GitOperation) => boolean> = {
  push: op => Boolean(op.push),
  merge: op => op.branch?.action === 'merged',
  rebase: op => op.branch?.action === 'rebased',
  'pr create': op => op.pr?.action === 'created',
  'pr merge': op => op.pr?.action === 'merged',
  'pr comment': op => op.pr?.action === 'commented',
}

function actionOf(v: unknown): { action: string } | undefined {
  return has(v, 'action') && typeof v.action === 'string' ? { action: v.action } : undefined
}

function gitOperationOf(v: unknown): GitOperation | undefined {
  if (typeof v !== 'object' || v === null) return undefined
  return {
    commit: has(v, 'commit') && has(v.commit, 'sha') && typeof v.commit.sha === 'string' ? { sha: v.commit.sha } : undefined,
    push: has(v, 'push') && Boolean(v.push),
    branch: has(v, 'branch') ? actionOf(v.branch) : undefined,
    pr: has(v, 'pr') ? actionOf(v.pr) : undefined,
  }
}

function bashOutputOf(v: unknown): { stdout: string; backgroundTaskId: string; gitOperation: GitOperation | undefined } {
  return {
    stdout: has(v, 'stdout') && typeof v.stdout === 'string' ? v.stdout : '',
    backgroundTaskId: has(v, 'backgroundTaskId') && typeof v.backgroundTaskId === 'string' ? v.backgroundTaskId : '',
    gitOperation: has(v, 'gitOperation') ? gitOperationOf(v.gitOperation) : undefined,
  }
}

function headerMessage(data: unknown): { over: unknown; press: unknown } {
  return { over: has(data, 'over') ? data.over : undefined, press: has(data, 'press') ? data.press : undefined }
}

function peekMessage(data: unknown): { key: unknown; over: unknown; scrollTo: unknown } {
  return { key: has(data, 'key') ? data.key : undefined, over: has(data, 'over') ? data.over : undefined, scrollTo: has(data, 'scrollTo') ? data.scrollTo : undefined }
}

function rowsMessage(data: unknown): { press: unknown; key: unknown; ctrl: unknown; shift: unknown; scrollTo: unknown; copy: unknown } {
  const at = <K extends string>(key: K): unknown => (has(data, key) ? data[key] : undefined)
  return { press: at('press'), key: at('key'), ctrl: at('ctrl'), shift: at('shift'), scrollTo: at('scrollTo'), copy: at('copy') }
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
    return id && status ? [[id, status]] : []
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

async function copyPaths($: EngineInterface, ids: string[], how: 'relative' | 'absolute' | 'name', surface?: RenderSurface): Promise<void> {
  const t = await get($)
  const one = (id: string) => (how === 'name' ? id.slice(id.lastIndexOf('/') + 1) || id : how === 'relative' && id !== t.root && inside(t.root, id) ? id.slice(t.root.endsWith('/') ? t.root.length : t.root.length + 1) : id)
  const text = ids.map(one).join('\n')
  const done = await $.ui.copy({ text, ...(surface ? { surface } : {}) })
  $.ui.toast(!done.isCopied ? `Could not copy the ${how === 'name' ? 'name' : 'path'}${ids.length > 1 ? 's' : ''}` : ids.length > 1 ? `Copied ${ids.length} ${how === 'name' ? 'names' : 'paths'}` : `Copied ${text}`)
}

function copyPath($: EngineInterface, id: string, absolute: boolean, surface?: RenderSurface): Promise<void> {
  return copyPaths($, [id], absolute ? 'absolute' : 'relative', surface)
}

async function linkTarget($: EngineInterface, id: string): Promise<string> {
  if ((await osName($)) === 'win32') return ''
  try {
    const run = await $.process.run(['readlink', '--', id], { timeoutMs: 3_000 })
    return run.exitCode === 0 ? run.stdout.trim() : ''
  } catch {
    return ''
  }
}

async function loops($: EngineInterface, id: string, first: string): Promise<boolean> {
  const seen = new Set([id])
  let cur = id
  let to = first
  for (let hop = 0; hop < 16; hop++) {
    if (!to) return false
    const next = isAbsolute(to) ? to : join(dirname(cur), to.replace(/^\.\//, ''))
    if (seen.has(next)) return true
    seen.add(next)
    cur = next
    to = await linkTarget($, cur)
  }
  return true
}

async function classifyLink($: EngineInterface, id: string): Promise<void> {
  if (linkStates.has(id)) return
  linkStates.set(id, null)
  const root = (await get($)).root
  let state: LinkState
  try {
    const real = (await $.fs.stat(id, { resolve: true })).realPath
    if (real) state = { kind: inside(await realOf($, root), posix(real)) ? 'ok' : 'outside', target: posix(real) }
    else {
      const target = await linkTarget($, id)
      state = { kind: (await loops($, id, target)) ? 'circular' : 'broken', target }
    }
  } catch (err) {
    const target = await linkTarget($, id)
    state = { kind: /ELOOP|too many|loop/i.test(messageOf(err)) || (await loops($, id, target)) ? 'circular' : 'broken', target }
  }
  if (linkStates.get(id) !== null) return
  linkStates.set(id, state)
  void $.ui.invalidate('ui.render')
}

function linkNote(state: LinkState | null | undefined): string {
  if (!state) return ' →'
  const to = state.target ? ` ${shortPath(state.target)}` : ''
  return ` →${to}${state.kind === 'outside' ? ' (outside the tree)' : state.kind === 'broken' ? ' (broken: target missing)' : state.kind === 'circular' ? ' (circular link)' : ''}`
}

function toggleMark($: EngineInterface, id: string): void {
  markAnchor = id
  if (marks.includes(id)) marks = marks.filter(m => m !== id)
  else if (marks.length >= MARK_LIMIT) $.ui.toast(`filetree: at most ${MARK_LIMIT} marks; V clears them`)
  else marks = [...marks, id]
  void $.ui.invalidate('ui.render')
}

function addMarks($: EngineInterface, ids: string[]): void {
  const fresh = ids.filter(id => id && !marks.includes(id))
  const room = Math.max(0, MARK_LIMIT - marks.length)
  if (fresh.length > room) $.ui.toast(`filetree: at most ${MARK_LIMIT} marks; V clears them`)
  marks = [...marks, ...fresh.slice(0, room)]
  void $.ui.invalidate('ui.render')
}

async function markRange($: EngineInterface, id: string): Promise<void> {
  const ids = rowsOf(await get($)).map(r => r.node.id)
  const to = ids.indexOf(id)
  const from = markAnchor ? ids.indexOf(markAnchor) : -1
  addMarks($, from < 0 || to < 0 ? [id] : ids.slice(Math.min(from, to), Math.max(from, to) + 1))
  markAnchor = id
  await patch($, () => ({ cursor: id, selected: id }))
}

function clearMarks($: EngineInterface): void {
  marks = []
  void $.ui.invalidate('ui.render')
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
  if (jobs.some(j => !j.readOnly)) staleGrep($)
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
  if (tone !== 'purple') staleGrep($)
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
  const opened: string[] = []
  await patch($, cur => {
    const open = new Set(cur.expanded)
    for (const p of paths) for (const a of ancestorsOf(p, cur.root)) if (!open.has(a)) {
      open.add(a)
      opened.push(a)
    }
    return { expanded: [...open], cursor: paths[paths.length - 1] ?? cur.cursor, scroll: null }
  })
  await markOpened($, opened, paths)
}

async function markOpened($: EngineInterface, opened: string[], touched: string[]): Promise<void> {
  const until = (await $.clock.now()) + COLLAPSE_MS
  for (const d of opened) if (!autoOpened.has(d)) autoOpened.set(d, until)
  for (const d of autoOpened.keys()) if (touched.some(p => p === d || inside(d, p))) autoOpened.set(d, until)
  if (autoCollapseOn(await get($))) armCollapse($)
}

function armCollapse($: EngineInterface): void {
  if (!autoOpened.size) return
  const next = Math.min(...autoOpened.values())
  if (collapseTimer && collapseAt <= next) return
  collapseTimer?.cancel()
  collapseAt = next
  void $.clock.now().then(now => {
    collapseTimer = $.clock.after(Math.max(1, next - now + 50), () => {
      collapseTimer = null
      collapseAt = 0
      void autoCollapse($)
    })
  })
}

function clearAutoCollapse(): void {
  autoOpened.clear()
  collapseTimer?.cancel()
  collapseTimer = null
  collapseAt = 0
}

function claimMarks(cursor: string): void {
  for (const d of [...autoOpened.keys()]) if (cursor === d || inside(d, cursor)) autoOpened.delete(d)
}

function autoCollapseOn(t: FileTree): boolean {
  return t.autoCollapse ?? autoCollapseDefault
}

async function autoCollapse($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  const t = await get($)
  if (!autoCollapseOn(t)) return
  const shut: string[] = []
  for (const [dir, until] of [...autoOpened]) {
    if (until > now) continue
    autoOpened.delete(dir)
    shut.push(dir)
  }
  armCollapse($)
  if (!shut.length) return
  const gone = new Set(shut)
  await patch($, cur => {
    const keep = cur.expanded.filter(d => !gone.has(d))
    const hidden = cur.cursor && shut.some(d => inside(d, cur.cursor) && cur.cursor !== d)
    const top = shut.filter(d => !shut.some(o => o !== d && inside(o, d)))
    const to = hidden ? (top.find(d => inside(d, cur.cursor)) ?? cur.cursor) : cur.cursor
    return { expanded: keep, cursor: to, selected: hidden ? to : cur.selected }
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

type Indexed = { paths: string[]; rel: string[] }

function indexPaths($: EngineInterface, t: FileTree): Promise<Indexed> {
  if (searchIndex?.root !== t.root) {
    const index: { root: string; paths: Promise<Indexed> } = {
      root: t.root,
      paths: listAll($, t).then(paths => {
        if (paths === null && searchIndex === index) searchIndex = null
        return { paths: paths ?? [], rel: (paths ?? []).map(p => relative(t.root, p)) }
      }),
    }
    searchIndex = index
  }
  return searchIndex.paths
}

async function search($: EngineInterface, query: string): Promise<string[]> {
  if (!(await get($)).query.trim()) searchIndex = null
  await patch($, () => ({ query }))
  const t = await get($)
  if (t.searchContent) {
    if (!query.trim()) grepClear()
    grep.key = ''
    return []
  }
  if (grep.key) grepClear()
  if (!query.trim()) return []
  const index = await indexPaths($, t)
  const match = matcher(query, Boolean(t.searchCase), Boolean(t.searchRegex))
  if (!match) return []
  const hits: string[] = []
  const scope = t.searchScope ? `${t.searchScope.replace(/\/$/, '')}/` : ''
  for (let i = 0; i < index.rel.length && hits.length < SEARCH_REVEAL_LIMIT; i++) if ((!scope || (index.paths[i] ?? '').startsWith(scope)) && match(index.rel[i] ?? '')) hits.push(index.paths[i] ?? '')
  if ((await get($)).query !== query) return []
  if (match.partial) void $.ui.toast(`filetree: regex search stopped after ${hits.length} match${hits.length === 1 ? '' : 'es'}; the pattern is too slow to check every path`)
  await revealPaths($, hits)
  const shown = await get($)
  const ids = new Set(shown.nodes.map(n => n.id))
  const stale = [...new Set(hits.filter(p => !ids.has(p)).map(dirname))].filter(d => inside(shown.root, d))
  if (stale.length) await loadDirs($, stale)
  return hits
}

function grepOn(t: FileTree): boolean {
  return Boolean(t.searchContent) && Boolean(t.query.trim())
}

function grepKey(t: FileTree): string {
  return JSON.stringify([t.root, t.top, t.query.trim(), Boolean(t.searchCase), Boolean(t.searchRegex), t.searchScope, t.showHidden])
}

function grepId(h: GrepHit): string {
  return `grep:${h.line}:${h.path}`
}

function grepStop(): void {
  grep.stop?.()
  grep.stop = null
}

function grepClear(): void {
  grepStop()
  grep.seq += 1
  grep.key = ''
  grep.rows = []
  grep.sel = 0
  grep.capped = false
  grep.busy = false
  grep.note = ''
}

function grepSkip(t: FileTree): string[] {
  return [...PRUNE, ...(broad(t.root) ? HOME_PRUNE : []), ...ignoreNames, ...(t.showHidden ? [] : ['.*'])]
}

async function grepTargets($: EngineInterface, t: FileTree): Promise<string[]> {
  const dir = t.searchScope || t.root
  const skip = new Set(grepSkip(t))
  const kids = await $.fs.list(dir).catch(() => [])
  return kids.filter(k => !skip.has(k.name) && (t.showHidden || !k.name.startsWith('.'))).map(k => join(dir, k.name))
}

function ereFor(t: FileTree, q: string): string | null {
  return t.searchCase ? toEre(q) : null
}

function grepArgv(t: FileTree, q: string, targets: string[]): string[] {
  const how = [...(t.searchCase ? [] : ['-i']), t.searchRegex ? '-E' : '-F', '-e', t.searchRegex ? (ereFor(t, q) ?? '^') : q]
  if (t.top) return ['git', '--no-optional-locks', '-C', t.root, 'grep', '-n', '-I', '-z', '--no-color', '--no-column', '--no-full-name', '--untracked', ...how, '--', t.searchScope ? relative(t.root, t.searchScope) : '.']
  return ['grep', '-rnIH', '--null', ...grepSkip(t).map(n => `--exclude-dir=${n === '.*' ? n : globLiteral(n)}`), ...(t.showHidden ? [] : ['--exclude=.*']), ...how, '--', ...targets]
}

function grepRun($: EngineInterface, t: FileTree): void {
  grepClear()
  grep.key = grepKey(t)
  const mine = grep.seq
  const q = t.query.trim()
  if (!q) return
  if (badPattern(q, Boolean(t.searchRegex))) {
    grep.note = 'not a valid pattern'
    return
  }
  grep.busy = true
  $.clock.after(GREP_WAIT_MS, () => {
    if (mine === grep.seq) void grepSpawn($, t, q, mine)
  })
}

async function grepSpawn($: EngineInterface, t: FileTree, q: string, mine: number): Promise<void> {
  const targets = t.top ? [] : await grepTargets($, t)
  if (grep.seq !== mine) return
  if (!t.top && targets.length === 0) {
    grep.busy = false
    void $.ui.invalidate('ui.render')
    return
  }
  const ascii = t.searchRegex && ereFor(t, q) !== null
  const stream = $.process.spawn({ argv: grepArgv(t, q, targets), ...(t.top || ascii ? { env: { ...(t.top ? { GIT_OPTIONAL_LOCKS: '0' } : {}), ...(ascii ? { LC_ALL: 'C' } : {}) } } : {}) })
  const stop = () => stopStream(stream)
  grep.stop = stop
  let note = ''
  const timer = $.clock.after(GREP_MS, () => {
    if (grep.seq !== mine) return
    note = `search stopped after ${GREP_MS / 1000} seconds`
    stop()
  })
  const files = new Map<string, GrepHit[]>()
  const work = { left: GREP_WORK }
  const fits = t.searchRegex ? compileRegex(q, !t.searchCase, work) : null
  const exact = t.searchRegex && ereFor(t, q) !== null
  let count = 0
  let capped = false
  let costly = false
  let rest = ''
  let err = ''
  const take = (line: string) => {
    if (costly) return
    const cut = line.indexOf('\0')
    const m = cut < 0 ? null : /^(\d+)[\0:](.*)$/s.exec(line.slice(cut + 1))
    if (!m) return
    const raw = posix(line.slice(0, cut))
    const path = isAbsolute(raw) ? raw : join(t.root, raw.replace(/^\.\//, ''))
    if (isIgnored(t.root, path) || (!t.showHidden && relative(t.root, path).split('/').some(x => x.startsWith('.')))) return
    const body = m[2] ?? ''
    if (fits && !(exact && body.length > GREP_LINE)) {
      const ok = fits(body)
      if (work.left < 0) {
        note ||= 'search stopped: the pattern is too costly'
        costly = true
        stop()
        return
      }
      if (!ok) return
    }
    if (count >= GREP_LIMIT) {
      capped = true
      return
    }
    count += 1
    const text = (m[2] ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim()
    const hit = { path, line: Number(m[1]), text: text.length > GREP_TEXT ? `${text.slice(0, GREP_TEXT)}…` : text }
    const list = files.get(path)
    if (list) list.push(hit)
    else files.set(path, [hit])
  }
  try {
    for await (const chunk of stream) {
      if (grep.seq !== mine) return
      if (chunk.stream !== 'stdout') {
        err ||= chunk.text.trim().split('\n')[0] ?? ''
        continue
      }
      const lines = (rest + chunk.text).split('\n')
      rest = lines.pop() ?? ''
      for (const line of lines) take(line)
      if (capped || costly) break
    }
    if (rest && !capped) take(rest)
  } catch (error) {
    err = /ENOENT|not found|no such file/i.test(messageOf(error)) ? `${t.top ? 'git' : 'grep'} is not installed` : messageOf(error).split('\n')[0] ?? ''
  } finally {
    timer.cancel()
    if (grep.seq === mine) {
      grep.stop = null
      grep.busy = false
      grep.capped = capped
      grep.rows = [...files.entries()].flatMap(([path, hits]) => [{ path, line: 0, text: String(hits.length) }, ...hits])
      grep.note = note || (count ? '' : err)
      void $.ui.invalidate('ui.render')
      const row = grep.rows[grep.sel] ?? grep.rows[0]
      if (row) void patch($, () => ({ selected: row.path }))
    }
  }
}

async function openHit($: EngineInterface, h: GrepHit, surface?: RenderSurface): Promise<void> {
  mapLock = null
  const line = h.line || (grep.rows.find(r => r.path === h.path && r.line)?.line ?? 1)
  const top = Math.max(0, line - 3)
  if (surface === 'desktop' || nativeScroll) {
    await revealPaths($, [h.path])
    await loadPreview($, h.path, line)
    deskLine = { path: h.path, top, scrolled: false, line }
    await patch($, cur => ({ preview: h.path, previewTop: Math.max(0, top - (previewed?.first ?? 0)), cursor: h.path, selected: h.path, expanded: [...new Set([...cur.expanded, ...ancestorsOf(h.path, cur.root)])] }))
    $.clock.after(100, () => parkPreview($))
    return
  }
  await revealPaths($, [h.path])
  peekAt = { path: h.path, line, jumped: false }
  if (peekPath === h.path) peeked = null
  else peekWant = { path: h.path, top }
  overPeek = false
  await patch($, cur => ({ split: true, preview: '', previewTop: 0, cursor: h.path, selected: h.path, expanded: [...new Set([...cur.expanded, ...ancestorsOf(h.path, cur.root)])] }))
}

const refCache = new Map<string, Promise<FileRef[]>>()

function refsIn($: EngineInterface, text: string, root: string, cwd: string): Promise<FileRef[]> {
  const key = `${root}\0${cwd}\0${text}`
  const known = refCache.get(key)
  if (known) return known
  const found = (async () => {
    const out: FileRef[] = []
    for (const r of fileRefs(text)) {
      const path = resolve(cwd, r.path, home)
      if (!inside(root, path) || path === root || out.some(o => o.path === path && o.line === r.line && o.end === r.end)) continue
      const kind = await $.fs.stat(path).then(st => st.kind, () => '')
      if (kind === 'file') out.push({ ...r, path })
    }
    return out
  })()
  refCache.set(key, found)
  if (refCache.size > 200) refCache.delete(refCache.keys().next().value ?? key)
  return found
}

async function openRef($: EngineInterface, href: string, surface: RenderSurface): Promise<void> {
  const ref = parseHref(href)
  if (!ref) return
  const t = await get($)
  if (!inside(t.root, ref.path)) return
  void $.ui.open({ id: PANE, title: `Files: ${t.root.split('/').pop() || t.root}` }).catch(() => undefined)
  await openHit($, { path: ref.path, line: ref.line, text: '' }, surface)
}

async function grepNav($: EngineInterface, key: string, surface?: RenderSurface): Promise<boolean> {
  const last = Math.min(grep.rows.length, surface === 'desktop' ? deskGrepShown : Infinity) - 1
  const by: Record<string, number> = { up: -1, k: -1, down: 1, j: 1, pageup: -10, pagedown: 10, home: -Infinity, end: Infinity }
  if (key in by) {
    grep.sel = Math.max(0, Math.min(last, grep.sel + (by[key] ?? 0)))
    void $.ui.invalidate('ui.render')
    const row = grep.rows[grep.sel]
    if (row) await patch($, () => ({ selected: row.path }))
    if (surface === 'desktop' && row) void $.ui.scroll({ to: { key: `grep-row:${grepId(row)}` }, in: PANE, block: 'nearest' }).catch(() => undefined)
    return true
  }
  if (key !== 'return' && key !== 'enter' && key !== 'o') return false
  const hit = grep.rows[grep.sel]
  if (hit) await openHit($, hit, surface)
  return true
}

async function grepAct($: EngineInterface, key: string, shift: boolean, surface?: RenderSurface): Promise<boolean> {
  if (!['x', 'd', 'v', 't', 'y', 'Y', 'u', 'i'].includes(key) || (key === 'v' && shift)) return false
  const path = grep.rows[grep.sel]?.path
  if (!path) {
    if ((key === 'y' || key === 'Y' || key === 'u') && marks.length) await copyPaths($, marks, key === 'u' ? 'name' : key === 'Y' || shift ? 'absolute' : 'relative', surface)
    return true
  }
  if (key === 'i') {
    const t = await get($)
    const dir = dirname(path)
    await scopeSearch($, dir === t.root ? '' : dir)
    $.clock.after(50, () => focusPane($, t.root, 'q'))
  } else if (key === 'x') await toggleGuard($, path)
  else if (key === 'd') await diffFile($, path)
  else if (key === 'v') toggleMark($, path)
  else if (key === 't') await openTerminal($, dirname(path))
  else await copyPaths($, marks.length ? marks : [path], key === 'u' ? 'name' : key === 'Y' || shift ? 'absolute' : 'relative', surface)
  return true
}

const GIT_RANK: Record<string, number> = { D: 5, M: 4, T: 4, R: 3, C: 3, A: 2, '?': 1 }
function metricOf(t: FileTree, n: FileNode): number {
  if (t.column === 'loc') return locCache.get(n.id) ?? -1
  if (t.column === 'files') return n.kind === 'dir' ? (fileCounts.get(n.id) ?? -1) : -1
  if (t.column === 'size') return n.kind === 'dir' ? (t.dirSizes[n.id] ?? -1) : n.size
  return n.kind === 'dir' ? (dirTimes.get(n.id)?.[1] ?? 0) : n.mtime
}
function metricWorking(t: FileTree, n: FileNode): boolean {
  if (n.kind !== 'dir' && t.column !== 'loc') return false
  if (t.column === 'files') return counting.has(n.id) || countQueue.includes(n.id)
  if (t.column === 'loc') return locBusy.has(`d${n.id}`) || locBusy.has(`s${n.id}`) || locQueue.some(([d]) => d === n.id) || locBusy.has(`s${n.parent}`) || locQueue.some(([d]) => d === n.parent)
  if (t.column === 'size') return sizing.has(n.id) || sizeQueue.includes(n.id)
  return timing.has(n.id) || timeQueue.some(([d]) => d === n.id) || [...timing].some(w => inside(w, n.id))
}
function metricKnown(t: FileTree, n: FileNode): boolean {
  if (t.column === 'loc') return n.kind === 'link' || locCache.has(n.id) || (n.kind === 'file' && (!counted(n.name) || locListed.has(n.parent)))
  if (t.column === 'size') return n.kind !== 'dir' || n.id in t.dirSizes
  if (t.column === 'files') return n.kind !== 'dir' || fileCounts.has(n.id)
  return n.kind !== 'dir' || dirTimes.has(n.id)
}
function gitOf(t: FileTree, n: FileNode): [number, number] {
  const d = t.diff[n.id]
  const c = t.counts[n.id]
  const rank = n.kind === 'dir' ? (c ? c[0] + c[1] + c[2] : 0) : (GIT_RANK[t.git[n.id] ?? ''] ?? 0)
  return [d ? d[0] + d[1] : 0, rank]
}
let ghostMemo: { nodes: FileNode[]; git: FileTree['git']; root: string; out: FileNode[] } | null = null
function ghostsOf(t: FileTree): FileNode[] {
  if (ghostMemo && ghostMemo.nodes === t.nodes && ghostMemo.git === t.git && ghostMemo.root === t.root) return ghostMemo.out
  ghostMemo = { nodes: t.nodes, git: t.git, root: t.root, out: ghostScan(t) }
  return ghostMemo.out
}
function ghostScan(t: FileTree): FileNode[] {
  const have = new Set(t.nodes.map(n => n.id))
  const loaded = new Set(t.nodes.filter(n => n.loaded).map(n => n.id))
  loaded.add(t.root)
  const out: FileNode[] = []
  for (const [id, status] of Object.entries(t.git)) {
    if (status !== 'D' || have.has(id) || isIgnored(t.root, id)) continue
    const parent = dirname(id)
    if (!loaded.has(parent) || !inside(t.root, id)) continue
    const name = id.slice(parent.length + 1)
    out.push({ id, parent, name, kind: 'file', hidden: name.startsWith('.'), mtime: 0, size: 0, loaded: true })
  }
  return out
}

function isGhost(t: FileTree, id: string): boolean {
  return t.git[id] === 'D' && ghostsOf(t).some(n => n.id === id)
}

function rowsOf(base: FileTree): Row[] {
  const ghosts = ghostsOf(base)
  const t = ghosts.length ? { ...base, nodes: [...base.nodes, ...ghosts] } : base
  if (!t.sortCol) return visibleRows(t, ghosts.length ? (a, b) => collator.compare(a.name, b.name) : undefined)
  const sign = t.sortDir === 'asc' ? 1 : -1
  const order = t.sortCol === 'name'
    ? (a: FileNode, b: FileNode) => sign * collator.compare(a.name, b.name)
    : t.sortCol === 'git'
    ? (a: FileNode, b: FileNode) => {
        const [x, y] = [gitOf(t, a), gitOf(t, b)]
        return sign * (x[0] - y[0] || x[1] - y[1])
      }
    : (() => {
        const pending = new Set<string>()
        for (const r of visibleRows(t)) if (!pending.has(r.node.parent) && !metricKnown(t, r.node) && metricWorking(t, r.node)) pending.add(r.node.parent)
        return (a: FileNode, b: FileNode) => {
          if (pending.has(a.parent)) return collator.compare(a.name, b.name)
          const ka = metricKnown(t, a)
          const kb = metricKnown(t, b)
          if (ka !== kb) return ka ? -1 : 1
          return (ka ? sign * (metricOf(t, a) - metricOf(t, b)) : 0) || collator.compare(a.name, b.name)
        }
      })()
  return visibleRows(t, order)
}

async function sortBy($: EngineInterface, col: 'name' | 'git' | 'metric'): Promise<void> {
  await patch($, cur => (cur.sortCol !== col ? { sortCol: col, sortDir: 'desc' } : cur.sortDir === 'desc' ? { sortDir: 'asc' } : { sortCol: '', sortDir: 'desc' }))
}

async function scopeSearch($: EngineInterface, scope: string): Promise<void> {
  await patch($, () => ({ searchScope: scope }))
  const t = await get($)
  if (t.query.trim()) await search($, t.query)
}

async function zoxideRows($: EngineInterface): Promise<Candidate[]> {
  const now = await $.clock.now()
  if (zoxideCache && now - zoxideCache.at < ZOXIDE_TTL_MS) return zoxideCache.rows
  let rows: Candidate[] = []
  try {
    const run = await $.process.run(['zoxide', 'query', '--list', '--score'], { timeoutMs: 3_000 })
    if (run.exitCode === 0) rows = parseZoxide(run.stdout).map(c => ({ path: posix(c.path).replace(/([^:])\/+$/, '$1'), score: c.score }))
  } catch {
    rows = []
  }
  zoxideCache = { at: now, rows }
  return rows
}

async function visits($: EngineInterface): Promise<Record<string, Visit>> {
  visitsCache ??= ((await $.state.get(VISITS)).value as Record<string, Visit> | undefined) ?? {}
  return visitsCache
}

async function recordVisit($: EngineInterface, dir: string): Promise<void> {
  const all = { ...(await visits($)) }
  const prev = all[dir]
  all[dir] = { n: (prev?.n ?? 0) + 1, at: await $.clock.now() }
  const keep = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, 500)
  visitsCache = Object.fromEntries(keep)
  await $.state.set(VISITS, visitsCache)
}

async function jumpRefresh($: EngineInterface): Promise<void> {
  const mine = ++zjump.seq
  const t = await get($)
  const now = await $.clock.now()
  const [zox, seen, index] = await Promise.all([zoxideRows($), visits($), indexPaths($, t)])
  if (mine !== zjump.seq || !zjump.on) return
  const cands: Candidate[] = [...zox]
  for (const [path, v] of Object.entries(seen)) cands.push({ path: posix(path), score: frecency(v, now) })
  const dirs = new Set<string>([t.root])
  for (const n of t.nodes) if (n.kind === 'dir') dirs.add(n.id)
  for (const p of index.paths) {
    if (dirs.size >= JUMP_INDEX_LIMIT) break
    for (let d = dirname(p); d.length > t.root.length && !dirs.has(d); d = dirname(d)) dirs.add(d)
  }
  for (const d of dirs) cands.push({ path: d, score: 0 })
  zjump.rows = rankJump(cands, zjump.query).filter(p => p !== t.root || zjump.query.trim() !== '')
  zjump.sel = Math.min(zjump.sel, Math.max(0, zjump.rows.length - 1))
  void $.ui.invalidate('ui.render')
}

function jumpOpen($: EngineInterface): void {
  zjump.on = true
  zjump.held = false
  zjump.query = ''
  zjump.sel = 0
  zjump.rows = []
  void jumpRefresh($)
  $.clock.after(50, async () => focusPane($, (await get($)).root, 'jump'))
}

async function jumpInput($: EngineInterface, value: string): Promise<void> {
  if (!zjump.on) return
  zjump.query = value
  zjump.sel = 0
  await jumpRefresh($)
}

function jumpClose($: EngineInterface, refocus = false): void {
  zjump.on = false
  zjump.query = ''
  zjump.rows = []
  zjump.seq += 1
  void $.ui.invalidate('ui.render')
  if (refocus) $.clock.after(50, async () => focusPane($, (await get($)).root, 'hk-tree'))
}

async function repoOf($: EngineInterface, path: string): Promise<string | null> {
  const known = workRepos.get(path)
  if (known) return known
  const found = (async () => {
    for (const dir of [path, dirname(path)]) {
      try {
        const run = await git($, dir, ['rev-parse', '--show-toplevel'], 3_000)
        if (run.exitCode === 0 && run.stdout.trim()) return posix(run.stdout.trim())
      } catch {}
    }
    return null
  })()
  workRepos.set(path, found)
  if (workRepos.size > 2_000) workRepos.delete(workRepos.keys().next().value ?? path)
  return found
}

async function noteWork($: EngineInterface, paths: string[], write: boolean): Promise<void> {
  if (!followWork || paths.length === 0) return
  const vault = home ? [`${home}/Git/agents`, `${home}/Desktop/Git/agents`, `${home}/git/agents`, `${home}/vault`] : []
  const kept = [...new Set(paths.map(posix))].filter(p => isAbsolute(p) && !workIgnored(p, home, vault)).slice(0, 40)
  const repos = new Set((await Promise.all(kept.map(p => repoOf($, p)))).filter((r): r is string => Boolean(r) && !workIgnored(r ?? '', home, vault)))
  if (repos.size === 0) return
  const now = await $.clock.now()
  workTouches = [...workTouches.filter(t => now - t.at < 180_000), ...[...repos].map(repo => ({ repo, write, at: now }))].slice(-400)
  if (!mainBusy) void considerWork($)
}

async function considerWork($: EngineInterface): Promise<void> {
  if (!followWork || workDeciding) return
  workDeciding = true
  try {
    const base = jumpMovesClaude ? await cwdOf($) : (await get($)).root
    const current = (await repoOf($, base)) ?? base
    const now = await $.clock.now()
    const repo = pickRepo(workTouches, current, now, workLast)
    if (!repo || inside(repo, base)) return
    workLast = now
    if (!jumpMovesClaude) {
      follow = false
      await reset($, repo)
      return
    }
    $.clock.after(0, async () => {
      try {
        await $.command.run({ command: 'cd', args: repo })
        void $.ui.toast(`filetree: followed the work to ${shortPath(repo)}`)
        $.clock.after(400, () => void (follow ? followCwd($) : reset($, repo)))
      } catch (error) {
        void $.ui.toast(`filetree: could not move Claude to ${shortPath(repo)}: ${error instanceof Error ? error.message : String(error)}`)
      }
    })
  } finally {
    workDeciding = false
  }
}

async function jumpTo($: EngineInterface, dir: string): Promise<void> {
  jumpClose($, true)
  workLast = await $.clock.now()
  follow = false
  await reset($, dir)
  if (!jumpMovesClaude || (await cwdOf($)) === dir) return
  $.clock.after(0, async () => {
    try {
      await $.command.run({ command: 'cd', args: dir })
    } catch (error) {
      void $.ui.toast(`filetree: could not move Claude to ${dir}: ${error instanceof Error ? error.message : String(error)}`)
    }
  })
}

async function jumpKey($: EngineInterface, key: string): Promise<void> {
  if (key === 'escape') jumpClose($, true)
  else if (key === 'return' || key === 'enter') {
    const dir = zjump.rows[zjump.sel]
    if (dir) await jumpTo($, dir)
  } else if (key === 'up' || key === 'down') {
    zjump.sel = Math.max(0, Math.min(zjump.rows.length - 1, zjump.sel + (key === 'up' ? -1 : 1)))
    void $.ui.invalidate('ui.render')
  } else if (key === 'backspace' || key === 'delete') {
    zjump.query = zjump.query.slice(0, -1)
    zjump.sel = 0
    await jumpRefresh($)
  } else if (key === 'space' || key === ' ' || [...key].length === 1) {
    zjump.query += key === 'space' ? ' ' : key
    zjump.sel = 0
    await jumpRefresh($)
  }
}

async function searchFlag($: EngineInterface, flag: SearchFlag): Promise<void> {
  await patch($, cur => (flag === 'searchCase' ? { searchCase: !cur.searchCase } : flag === 'searchRegex' ? { searchRegex: !cur.searchRegex } : { searchContent: !cur.searchContent }))
  const t = await get($)
  if (t.query.trim()) await search($, t.query)
}

async function jump($: EngineInterface, query: string, surface?: RenderSurface): Promise<void> {
  if ((await get($)).searchContent) {
    const hit = grep.rows[grep.sel]
    if (hit) await openHit($, hit, surface)
    return
  }
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

async function loadPreview($: EngineInterface, path: string, line?: number): Promise<void> {
  previewed = await readPreview($, path, 1, line)
}

function stopStream(stream: HookStream<unknown, ProcessSpawnResult>): void {
  void stream.return({ code: null, signal: null }).catch(() => undefined)
}

function has<K extends string>(v: unknown, key: K): v is Record<K, unknown> {
  return typeof v === 'object' && v !== null && key in v
}

function messageOf(err: unknown): string {
  return String((has(err, 'message') ? err.message : undefined) ?? err)
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x: unknown): x is string => typeof x === 'string') : []
}

function unlessAborted(err: unknown): null {
  if (/aborted/.test(messageOf(err))) throw err
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

function previewWindow(text: string, line: number): { text: string; first: number } {
  const clean = text.replace(/\r\n?/g, '\n')
  let at = 0
  for (let n = 1; n < line && at >= 0; n++) at = clean.indexOf('\n', at) + 1 || -1
  if (at <= 0) return { text, first: 0 }
  const min = Math.max(0, at - Math.floor(PREVIEW_CHARS / 4))
  const back = min === 0 ? 0 : clean.indexOf('\n', min - 1) + 1 || at
  const from = Math.min(back, at)
  let first = 0
  for (let i = clean.indexOf('\n'); i >= 0 && i < from; i = clean.indexOf('\n', i + 1)) first++
  return { text: clean.slice(from), first }
}

async function readPreview($: EngineInterface, path: string, page = 1, line?: number): Promise<Preview> {
  if (path === OUTSIDE) return { path, text: outside.map(shortPath).join('\n'), note: `${outside.length} file${outside.length === 1 ? '' : 's'} Claude wrote outside the repo this session` }
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
    note = `could not read: ${messageOf(err).split('\n')[0]}`
  }
  const total = text.length
  const win = line && total > PREVIEW_CHARS ? previewWindow(text, line) : { text, first: 0 }
  const first = win.first
  text = win.text
  let lines = text.slice(0, PREVIEW_CHARS).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').split('\n')
  if (lines.length > 1 && (text.length > PREVIEW_CHARS || lines.at(-1) === '')) lines.pop()
  lines = lines.map(l => (l.length > PREVIEW_LINE ? `${l.slice(0, PREVIEW_LINE)}…` : l))
  const fit = fitSerialized(lines, PREVIEW_CHARS)
  if (first) note = `lines ${(first + 1).toLocaleString('en')}–${(first + fit.length).toLocaleString('en')} of ${total.toLocaleString('en')} characters`
  else if (total > PREVIEW_CHARS || fit.length < lines.length) note = `first ${fit.length.toLocaleString('en')} lines of ${total.toLocaleString('en')} characters`
  return { path, text: fit.join('\n'), note, page, ...(first ? { first } : {}) }
}

async function loadDiff($: EngineInterface, path: string, folder: boolean): Promise<boolean> {
  const cwd = folder ? path : dirname(path)
  const born = await git($, cwd, ['rev-parse', '--verify', '--quiet', 'HEAD']).then(r => r.exitCode === 0, () => false)
  const base = born ? 'HEAD' : await git($, cwd, ['hash-object', '-t', 'tree', '--stdin'], 10_000, '').then(r => r.stdout.trim(), () => '')
  if (!base) return false
  const tracked = await git($, cwd, ['diff', base, '--no-color', '--no-ext-diff', '--src-prefix=a/', '--dst-prefix=b/', '--', path]).then(r => r.stdout, () => '')
  const others = await git($, cwd, ['ls-files', '--others', '--exclude-standard', '--full-name', '-z', '--', path]).then(r => r.stdout.split('\0').filter(Boolean), (): string[] => [])
  const top = (await get($)).top || cwd
  const files = splitPatch(tracked.slice(0, PREVIEW_CHARS))
  for (const rel of others.slice(0, 50)) {
    const run = await git($, top, ['diff', '--no-index', '--no-color', '--no-ext-diff', '--src-prefix=a/', '--dst-prefix=b/', '--', '/dev/null', rel]).catch(() => null)
    const file = run ? splitPatch(run.stdout.slice(0, PREVIEW_CHARS))[0] : undefined
    if (file) files.push({ path: rel, lines: file.lines })
  }
  if (!files.length) return false
  const many = folder || files.length > 1
  const lines = many ? groupFiles(files, folder ? groupSetting : 'off').flatMap(g => ('group' in g ? [{ kind: '@' as const, text: g.group, old: 0, new: 0 }] : [{ kind: '@' as const, text: g.file.path, old: 0, new: 0 }, ...g.file.lines])) : files.flatMap(f => f.lines)
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
      if (made.exitCode !== 0 || !isAbsolute(out)) return { state: 'failed', note: why || `could not decode, exit ${made.exitCode}` }
      file = out
      pages = Number(count) || 0
      sessionDir = dirname(file)
      size = await pngHeader($, file)
    }
    return size ? { state: 'ready', file, generation: Math.floor(job.mtime) + job.page * 7 + job.px, ...size, ...(pages ? { pages } : {}) } : { state: 'failed', note: 'could not read the picture size' }
  } catch (err) {
    return { state: 'failed', note: messageOf(err).split('\n')[0] ?? 'could not decode' }
  }
}

function forget($: EngineInterface, path: string): void {
  const old = pictures.get(path)
  pictures.delete(path)
  if (old?.picture.state === 'ready' && old.picture.file !== path) void $.process.run(['rm', '-f', '--', old.picture.file], { timeoutMs: 5_000 }).catch(() => undefined)
}

let shownPng: { file: string; generation: number; png: string } | null = null

async function pngOf($: EngineInterface, pic: { file: string; generation: number }): Promise<string> {
  if (shownPng?.file === pic.file && shownPng.generation === pic.generation) return shownPng.png
  shownPng = null
  const { base64 } = await $.fs.read(pic.file, { as: 'bytes' }).catch(() => ({ base64: '' }))
  if (base64) shownPng = { file: pic.file, generation: pic.generation, png: base64 }
  return base64
}

async function spawnRun($: EngineInterface, job: PictureJob, argv: string[]): Promise<{ exitCode: number; stdout: string; stderr: string } | null> {
  const stream = $.process.spawn({ argv })
  let stopped = false
  current = { job, stop: () => { stopped = true; stopStream(stream) } }
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
      scan.stop = () => stopStream(stream)
      let text = ''
      let drawn = 0
      for await (const chunk of stream) {
        if (scan.stopped) return
        if (chunk.stream !== 'stdout') continue
        text += chunk.text
        if (seeded || Date.now() - drawn < SCAN_DRAW_MS) continue
        drawn = Date.now()
        out = locUsage(parseLocIn(text.slice(0, text.lastIndexOf('\n') + 1), scan.dir), scan.dir).items
        scan.items = out
        void $.ui.invalidate('ui.render')
      }
      if (scan.stopped) return
      const files = parseLocIn(text, scan.dir)
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
      const argv = (await osName($)) === 'darwin' ? ['sh', '-c', DU_DARWIN_SH, 'sh', scan.dir] : ['du', '-akxH', '-d', '2', '--', scan.dir]
      const stream = $.process.spawn({ argv })
      scan.stop = () => stopStream(stream)
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
    if (/aborted/.test(messageOf(err))) {
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

function focusPane($: EngineInterface, root: string, key: string): void {
  void $.ui.open({ id: PANE, title: `Files: ${root.split('/').pop() || root}`, focus: true }).then(() => (key ? $.ui.focus({ requestId: PANE, key }) : undefined)).catch(() => {})
}

function toggleShortcuts($: EngineInterface, open = !shortcutsShown): void {
  shortcutsShown = open
  shortcutsTop = 0
  deskKeysAt = 0
  void $.ui.invalidate('ui.render')
}

function scrollShortcuts($: EngineInterface, by: number): void {
  const top = Math.max(0, Math.min(shortcutsMax, shortcutsTop + by))
  if (top === shortcutsTop) return
  shortcutsTop = top
  void $.ui.invalidate('ui.render')
}

function shortcutKey($: EngineInterface, key: string, surface?: RenderSurface): boolean {
  if (key === '?') {
    toggleShortcuts($)
    return true
  }
  if (!shortcutsShown) return false
  if (SCROLL_KEYS.has(key)) {
    const page = Math.max(1, shortcutsPage - 1)
    const by: Record<string, number> = { up: -1, k: -1, down: 1, j: 1, pageup: -page, b: -page, pagedown: page, f: page, home: -Infinity, end: Infinity }
    if (surface !== 'desktop') scrollShortcuts($, by[key] ?? 0)
    else {
      const titles = shortcutGroups(true).map(g => g.title)
      const step = by[key] ?? 0
      deskKeysAt = Math.max(0, Math.min(titles.length - 1, deskKeysAt + (Number.isFinite(step) ? Math.sign(step) * (Math.abs(step) > 1 ? 3 : 1) : step)))
      void $.ui.scroll({ to: { key: `keys-${titles[deskKeysAt]}` }, in: PANE, block: 'start' }).catch(() => undefined)
    }
    return true
  }
  toggleShortcuts($, false)
  return false
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

let previewDesk = false

function previewFocusKey(): 'edit' | 'back' {
  return !previewDesk && (editWithSetting || inTmux || inHerdr) ? 'edit' : 'back'
}

function parkPreview($: EngineInterface): void {
  void $.ui.focus({ requestId: PANE, key: previewFocusKey() }).catch(() => {})
}

async function closePreview($: EngineInterface): Promise<void> {
  await patch($, () => ({ preview: '', previewTop: 0 }))
  $.clock.after(100, async () => focusPane($, (await get($)).root, 'hk-tree'))
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

function diffCounts(source: string): [number, number] {
  let add = 0
  let del = 0
  let inHunk = false
  for (const line of source.split('\n')) {
    if (line.startsWith('diff --git ')) inHunk = false
    else if (line.startsWith('@@')) inHunk = true
    else if (!inHunk) continue
    else if (line.startsWith('+')) add++
    else if (line.startsWith('-')) del++
  }
  return [add, del]
}

function directPreview(elements: ReturnType<EngineInterface['ui']['resolve']>, win: { text: string; top: number } | { segments: { title: string; source: string }[]; top: number }, path: string, markdown: boolean, accent: string) {
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

async function openTerminal($: EngineInterface, dir: string): Promise<void> {
  const host = await editorHost($, await osName($))
  if (!host) {
    $.ui.toast('t opens a shell in a new tmux or herdr pane; run Claude Code inside tmux or herdr to use it')
    return
  }
  try {
    const argv = host === 'tmux' ? tmuxCommand(targetSetting, dir, [(await $.env.get('SHELL')) || 'sh']) : herdrSplit((await $.env.get('HERDR_BIN_PATH')) || 'herdr', dir, targetSetting, (await $.env.get('HERDR_WORKSPACE_ID')) || '')
    const run = await $.process.run(argv, { timeoutMs: 10_000 })
    if (run.exitCode !== 0) $.ui.toast(`could not open a terminal in ${shortPath(dir)}: ${(host === 'herdr' ? herdrError(run.stderr) : run.stderr.trim().split('\n')[0]) || `exit ${run.exitCode}`}`)
  } catch (err) {
    $.ui.toast(`could not open a terminal in ${shortPath(dir)}: ${messageOf(err).split('\n')[0]}`)
  }
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
  autoOpened.delete(n.id)
  if (n.kind === 'dir' && !(await get($)).expanded.includes(n.id)) await loadDirs($, [n.id])
  await patch($, t => {
    const open = new Set(t.expanded)
    if (n.kind === 'dir' && !open.delete(n.id)) open.add(n.id)
    return { expanded: [...open], cursor: n.id, selected: n.id }
  })
  void watchTree($)
}

async function expandAll($: EngineInterface): Promise<void> {
  const open: string[] = []
  const t = await get($)
  let level = t.nodes.filter(x => x.kind === 'dir' && x.parent === t.root && x.name !== '.git').map(x => x.id)
  for (let depth = 0; depth < 3 && level.length && open.length < EXPAND_MAX; depth++) {
    const take = level.slice(0, EXPAND_MAX - open.length)
    const listed = await loadDirs($, take)
    open.push(...take)
    level = [...listed.values()].flat().filter(x => x.kind === 'dir' && x.name !== '.git').map(x => x.id)
  }
  for (const d of open) autoOpened.delete(d)
  await patch($, t => ({ expanded: [...new Set([...t.expanded, ...open])] }))
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
  if (isGhost(await get($), n.id)) await diffFile($, n.id)
  else if (n.kind === 'dir') {
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

async function navigate($: EngineInterface, key: string, shift = false, surface?: RenderSurface): Promise<void> {
  if (zjump.on) return jumpKey($, shift && [...key].length === 1 ? key.toUpperCase() : key)
  if (shortcutKey($, key, surface)) return
  if (key === 'z') return jumpOpen($)
  if (grepOn(await get($)) && ((await grepNav($, key, surface)) || (await grepAct($, key, shift, surface)))) return
  await steer($, key, shift, surface)
  if (autoOpened.size) claimMarks((await get($)).cursor)
}

async function steer($: EngineInterface, key: string, shift = false, surface?: RenderSurface): Promise<void> {
  const t = await get($)
  const rows = rowsOf(t)
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
  else if ((shift && ['up', 'k', 'down', 'j'].includes(key)) || key === 'J' || key === 'K') {
    if (cur) addMarks($, [cur.id])
    await move(key === 'up' || key === 'k' || key === 'K' ? -1 : 1)
    const next = (await get($)).cursor
    if (next && next !== t.root) addMarks($, [next])
    if (next) markAnchor = next
  } else if (key === 'up' || key === 'k') await move(-1)
  else if (key === 'down' || key === 'j') await move(1)
  else if (key === 'pageup') await move(-10)
  else if (key === 'pagedown') await move(10)
  else if (key === 'home') await move(-rows.length)
  else if (key === 'end') await move(rows.length)
  else if (key === 'i') {
    const dir = cur ? (cur.kind === 'dir' ? cur.id : cur.parent) : t.root
    await scopeSearch($, dir === t.root ? '' : dir)
    $.clock.after(50, () => focusPane($, t.root, 'q'))
  } else if (key === 's') $.clock.after(50, () => focusPane($, t.root, 'q'))
  else if (key === 'backspace' && t.searchScope && !t.query) await scopeSearch($, '')
  else if (key === 'a') await pressHeader($, 'autocollapse')
  else if (key === 'n') await sortBy($, 'name')
  else if (key === 'g') await sortBy($, 'git')
  else if (key === 'm') await sortBy($, 'metric')
  else if (key === 'c') await searchFlag($, 'searchCase')
  else if (key === 'r') await searchFlag($, 'searchRegex')
  else if (key === 'q') await searchFlag($, 'searchContent')
  else if (key === 'w') await showOutside($)
  else if (cur && key === 'x') await toggleGuard($, cur.id)
  else if (cur && key === 'd') await diffFile($, cur.id)
  else if (key === 'V' || (key === 'v' && shift)) clearMarks($)
  else if (cur && key === 'v') toggleMark($, cur.id)
  else if (key === 't') await openTerminal($, cur ? (cur.kind === 'dir' ? cur.id : cur.parent) : t.root)
  else if ((cur || marks.length) && (key === 'y' || key === 'Y')) await copyPaths($, marks.length ? marks : [cur?.id ?? ''], key === 'Y' || shift ? 'absolute' : 'relative', surface)
  else if ((cur || marks.length) && key === 'u') await copyPaths($, marks.length ? marks : [cur?.id ?? ''], 'name', surface)
  else if (cur && (key === 'right' || key === 'l') && cur.kind === 'dir' && !t.expanded.includes(cur.id)) await toggle($, cur)
  else if (cur && (key === 'left' || key === 'h')) {
    if (cur.kind === 'dir' && t.expanded.includes(cur.id)) await toggle($, cur)
    else if (cur.parent !== t.root) await patch($, () => ({ cursor: cur.parent, selected: cur.parent }))
  } else if (cur && (key === 'return' || key === 'o')) await (cur.kind !== 'dir' ? openNode($, cur) : toggle($, cur))
  else if (cur && (key === ' ' || key === 'space') && isGhost(t, cur.id)) await diffFile($, cur.id)
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
    const spin = ++reloading
    const began = await $.clock.now()
    void $.ui.invalidate('ui.render')
    try {
      searchIndex = null
      for (const scan of scans.values()) scan.stale = true
      await staleSizes($)
      await loadDirs($, [t.root, ...t.expanded])
      await detectRepo($)
      await refreshGit($)
      if (t.query.trim()) await search($, t.query)
    } finally {
      const took = (await $.clock.now()) - began
      const left = Math.max(1, Math.ceil(took / SPIN_MS)) * SPIN_MS - took
      const settle = () => {
        if (spin !== reloading) return
        reloading = 0
        reloadSpin += 1
        void $.ui.invalidate('ui.render')
      }
      if (left > 0) $.clock.after(left, settle)
      else settle()
    }
  } else if (id === 'hidden') await patch($, cur => ({ showHidden: !cur.showHidden }))
  else if (id === 'size') await patch($, cur => ({ column: cur.column === 'date' ? 'size' : cur.column === 'size' ? 'loc' : cur.column === 'loc' ? 'files' : 'date' }))
  else if (id === 'collapse' && !(await get($)).expanded.length) await expandAll($)
  else if (id === 'collapse') await patch($, cur => ({ expanded: [], nodes: dropBelow(cur.nodes, cur.nodes.filter(x => x.parent === cur.root && x.kind === 'dir').map(x => x.id)) }))
  else if (id === 'unselect') await patch($, () => ({ selected: '', cursor: '' }))
  else if (id === 'external' && t.preview) await openFile($, t.preview, { mode: '' })
  else if (id === 'split') await toggleSplit($)
  else if (id === 'outside') await showOutside($)
  else if (id === 'autocollapse') {
    await patch($, cur => ({ autoCollapse: !autoCollapseOn(cur) }))
    if (autoCollapseOn(await get($))) {
      const open = new Set((await get($)).expanded)
      for (const d of [...autoOpened.keys()]) if (!open.has(d)) autoOpened.delete(d)
      armCollapse($)
    } else {
      collapseTimer?.cancel()
      collapseTimer = null
      collapseAt = 0
    }
  }
  else if (previewActs.has(id) && id !== 'external') previewActs.get(id)?.()
  else if (id === 'scope') await scopeSearch($, '')
  else if (id === 'sort-name') await sortBy($, 'name')
  else if (id === 'sort-git') await sortBy($, 'git')
  else if (id === 'sort-metric') await sortBy($, 'metric')
  else if (id === 'case') await searchFlag($, 'searchCase')
  else if (id === 'regex') await searchFlag($, 'searchRegex')
  else if (id === 'content') await searchFlag($, 'searchContent')
}

function loadGuards($: EngineInterface): Promise<void> {
  guardsLoaded ??= $.store.get(GUARDS).then(v => {
    guards = parseGuards(v)
  }, () => undefined)
  return guardsLoaded
}

async function toggleGuard($: EngineInterface, path: string): Promise<void> {
  await loadGuards($)
  const t = await get($)
  const over = guardOver(allGuards(guards), path)
  if (over && over !== path) {
    $.ui.toast(`${shortPath(path)} is already guarded by ${shortPath(over)}`)
    return
  }
  const owner = over === path ? Object.keys(guards).find(k => guards[k]?.includes(path)) : undefined
  const key = owner ?? (t.top && inside(t.top, path) ? t.top : t.root)
  const own = toggled(guards[key] ?? [], path)
  const next = { ...guards }
  if (own.length) next[key] = own
  else delete next[key]
  guards = next
  void $.ui.invalidate('ui.render')
  await $.store.set(GUARDS, guards)
}

async function realOf($: EngineInterface, path: string): Promise<string> {
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

async function guardFor($: EngineInterface, path: string): Promise<string | undefined> {
  const list = allGuards(guards)
  const hit = guardOver(list, path)
  if (hit) return hit
  const real = await realOf($, path)
  for (const g of list) if (inside(g, real) || inside(await realOf($, g), real)) return g
  return undefined
}

async function noteOutside($: EngineInterface, file: string): Promise<void> {
  const t = await get($)
  const abs = resolve(await cwdOf($), posix(file), home)
  if (!outsideOf(t.top || t.root, abs) || outside.includes(abs)) return
  outside = [...outside, abs]
  if (outside.length === 1) $.ui.toast(`Claude wrote outside ${shortPath(t.top || t.root)}: ${shortPath(abs)}. w lists these writes.`)
  if (previewed?.path === OUTSIDE) previewed = null
  void $.ui.invalidate('ui.render')
}

async function showOutside($: EngineInterface): Promise<void> {
  if (!outside.length) return
  await loadPreview($, OUTSIDE)
  await patch($, () => ({ preview: OUTSIDE, previewTop: 0 }))
  $.clock.after(100, () => parkPreview($))
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
  followWork = options?.work !== 'off'
  columnDefault = options?.column === 'size' || options?.column === 'loc' || options?.column === 'files' ? options.column : 'date'
  showAge = options?.column === 'age'
  dateSetting = dateFormat(options?.dates)
  clock = clockSetting(options?.clock)
  showHints = options?.hints !== 'off'
  showRemote = options?.remote === 'on'
  focusOnOpen = options?.focus !== 'off'
  ignoreNames = typeof options?.ignore === 'string' ? options.ignore.split(/[\s,]+/).filter(Boolean) : []
  searchGap = options?.spacing !== 'off'
  sortHeader = options?.headers !== 'off'
  longFile = options?.long === 'off' ? 0 : typeof options?.long === 'string' && /^\d+$/.test(options.long.trim()) ? Number(options.long.trim()) : 500
  autoCollapseDefault = options?.collapse === 'on'
  shortcutsSetting = options?.shortcuts === 'always' || options?.shortcuts === 'off' ? options.shortcuts : 'auto'
  shortcutsShown = shortcutsSetting === 'always'
  treemapSetting = options?.treemap === 'image' || options?.treemap === 'cells' || options?.treemap === 'off' ? options.treemap : 'auto'
  openWithSetting = typeof options?.open === 'string' ? options.open : ''
  binariesInDefaultApp = options?.binaries === 'default app'
  editWithSetting = typeof options?.edit === 'string' ? options.edit.trim() : ''
  palette = parsePalette(options?.palette)
  diffWithSetting = typeof options?.diff === 'string' ? options.diff.trim() : ''
  groupSetting = diffGroups(options?.groups)
  targetSetting = terminalTarget(options?.target)
  noDock = options?.start === 'off'
  splitAt = options?.split === 'top' ? 'top' : 'bottom'
  jumpMovesClaude = options?.jump !== 'tree'
  on('session.start', async ($, e, next) => {
    outside = []
    workTouches = []
    workLast = 0
    guardsLoaded = null
    void loadGuards($)
    cached ??= { ...emptyTree(''), ...(await $.state.get(TREE)).value }
    await $.command.register({ name: 'filetree', description: 'Show or hide the file tree; args: [path | open | keys] (no path = cwd, open = never hide, keys = bind alt+l / alt+h to move the keys to and from the tree)', immediate: true })
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
          noNerd = !remote && (windows || (await fontState($, NERD_PROBE)) !== 'ok')
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
      gitPoll = $.clock.every(GIT_POLL_MS, () => void followCwd($).then(moved => (moved ? undefined : gitChanged($))).then(() => watchTree($)))
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
    if (given === 'keys') return { text: await bindKeys($, home) }
    const mine = given ? undefined : (await $.ui.panes().catch(() => [])).find(p => p.id === PANE)
    if (mine?.isShown) {
      noDock = true
      if (zjump.on) jumpClose($)
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
    await reset($, root, focusOnOpen || given !== '' || mine?.isPlaced === true)
    return { text: `File tree on ${shortPath(root)}${follow ? ' (follows the cwd)' : ''}.` }
  })

  on('tool.call', async ($, e, next) => {
    const tool: string = e.tool
    const shell = tool === 'Bash' || tool === 'PowerShell'
    if (e.tool !== 'Edit' && e.tool !== 'Write' && e.tool !== 'NotebookEdit' && !shell) return next(e)
    const command = shell && has(e, 'command') && typeof e.command === 'string' ? e.command : ''
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
      const out = bashOutputOf(result.isError ? undefined : result.result)
      const reads = showReads ? readTargets(command, cwd, out.stdout, home) : []
      const job: Job = { actions: [], since, initRepo: actions.some(a => a.init), readOnly: quiet || result.isReadOnly === true }
      if (out.backgroundTaskId) background.set(out.backgroundTaskId, { p: pending, job, reads })
      else void (async () => {
        const results = pending ? await outcomes($, pending, !result.isError, out.gitOperation) : []
        if (pending) await finishGit($, pending, results)
        queuedReads.push(...reads)
        scheduleScan($, { ...job, actions: proven(pending, results) })
      })()
      if (follow && /(^|[;&|\s])(cd|pushd|popd)(\s|$)/.test(command)) $.clock.after(400, () => void followCwd($))
      if (!result.isError) void noteWork($, shellPaths(command, cwd, home), shellWrites(command))
    } else {
      const file =
        'file_path' in e && typeof e.file_path === 'string'
          ? e.file_path
          : 'notebook_path' in e && typeof e.notebook_path === 'string'
            ? e.notebook_path
            : ''
      if (file) void touched($, [file], 'orange', showWrites)
      if (file) void noteWork($, [file], true)
      if (file) void noteOutside($, file)
    }
    return result
  })

  on('tool.check', { tool: /^(Edit|Write|NotebookEdit|Bash|PowerShell)$/ }, async ($, e, next) => {
    await loadGuards($)
    const list = allGuards(guards)
    if (!list.length) return next(e)
    const input = has(e.input, 'file_path') ? e.input.file_path : has(e.input, 'notebook_path') ? e.input.notebook_path : has(e.input, 'command') ? e.input.command : undefined
    if (typeof input !== 'string' || !input) return next(e)
    const cwd = await cwdOf($)
    if ((GUARD_TOOLS as readonly string[]).includes(e.tool)) {
      const path = resolve(cwd, posix(input), home)
      const hit = await guardFor($, path)
      if (!hit) return next(e)
      return { decision: 'deny', reason: `${shortPath(hit)} is guarded in the file tree, so ${e.tool} on ${shortPath(path)} is refused. Leave it alone, or ask the user to unguard it with x in the tree.` }
    }
    const hit = guardIn(input, list, cwd, home)
    if (!hit) return next(e)
    const verdict = await next(e)
    if (verdict.decision === 'deny') return verdict
    return { decision: 'ask', decider: 'person', reason: `This command names ${shortPath(hit)}, which is guarded in the file tree. The check only reads the command text, so it can be a false alarm and can miss a path the command builds itself.` }
  })

  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    const result = await next(e)
    if (result.deny || result.isError || e.tool !== 'Read') return result
    void noteWork($, [posix(e.file_path)], false)
    if (!showReads) return result
    void touched($, [posix(e.file_path)], 'purple', true)
    return result
  })

  for (const tool of [/^Grep$/, /^Glob$/])
    on('tool.call', { tool }, async ($, e, next) => {
      const result = await next(e)
      if (result.deny || result.isError) return result
      const names = strings(has(result.result, 'filenames') ? result.result.filenames : undefined)
      if (names.length === 0) return result
      const cwd = await cwdOf($)
      void noteWork($, names.slice(0, 40).map(f => resolve(cwd, posix(f), home)), false)
      if (!showReads) return result
      void touched($, names.map(f => resolve(cwd, posix(f), home)), 'purple', true)
      return result
    })

  on('turn.start', async (_$, e, next) => {
    if (!e.agentId) mainBusy = true
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId) {
      mainBusy = false
      void considerWork($)
    }
    return result
  })

  on('ui.message', async ($, e, next) => {
    if (e.requestId === PANE && e.element.startsWith('button-') && e.data && typeof e.data === 'object') {
      const id = e.element.slice('button-'.length)
      const data = headerMessage(e.data)
      if (data.press) await pressHeader($, id)
      else if (data.over === true || hovered === id) {
        hovered = data.over === true ? id : ''
        void $.ui.invalidate('ui.render')
      }
      return {}
    }
    if (e.requestId === PANE && e.element === 'peek' && e.data && typeof e.data === 'object') {
      const data = peekMessage(e.data)
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
    if (e.requestId === PANE && e.element === 'treemap' && has(e.data, 'tab') && typeof e.data.tab === 'string') {
      await pickTile($, e.data.tab)
      return {}
    }
    if (e.requestId !== PANE || (e.element !== 'rows' && e.element !== 'treemap' && !e.element.startsWith('hit:')) || !e.data || typeof e.data !== 'object') return next(e)
    const data = rowsMessage(e.data)
    void sync($)
    const t = await get($)
    if (typeof data.copy === 'string') {
      await copyPath($, data.copy === ROOT_PRESS ? t.root : data.copy.replace(/^grep:\d+:/, ''), Boolean(data.shift), e.surface)
      return {}
    }
    if (typeof data.scrollTo === 'number') {
      const to = Math.round(Math.max(0, Math.min(1, data.scrollTo)) * view.max)
      if (to !== t.scroll) await patch($, () => ({ scroll: to }))
      return {}
    }
    if (typeof data.press === 'string' && zjump.on) {
      if (zjump.rows.includes(data.press)) await jumpTo($, data.press)
      return {}
    }
    if (typeof data.press === 'string' && data.press.startsWith('grep:')) {
      const at = grep.rows.findIndex(h => grepId(h) === data.press)
      const hit = grep.rows[at]
      if (hit) {
        grep.sel = at
        await openHit($, hit, e.surface)
      }
      return {}
    }
    if (data.press === ROOT_PRESS) {
      await selectRoot($)
      focusPane($, (await get($)).root, 'hk-tree')
      return {}
    }
    if (typeof data.press === 'string') {
      const ghost = ghostsOf(t).find(x => x.id === data.press)
      const n = t.nodes.find(x => x.id === data.press)
      if (data.shift && !data.ctrl && (ghost || n)) {
        if (t.scroll === null) await patch($, () => ({ scroll: view.from }))
        await markRange($, data.press)
        if (autoOpened.size) claimMarks((await get($)).cursor)
        return {}
      }
      if (ghost) {
        markAnchor = ghost.id
        await patch($, () => ({ cursor: ghost.id, selected: ghost.id }))
        await diffFile($, ghost.id)
        return {}
      }
      if (!n) return {}
      if (t.scroll === null) await patch($, () => ({ scroll: view.from }))
      if (data.ctrl) await openNode($, n)
      else {
        markAnchor = n.id
        await press($, n)
      }
      if (autoOpened.size) claimMarks((await get($)).cursor)
      return {}
    }
    if (typeof data.key !== 'string') return {}
    if (t.preview) {
      const page = Math.max(1, previewRows - 2)
      const by: Record<string, number> = { up: -1, k: -1, down: 1, j: 1, f: page, b: -page, pageup: -page, pagedown: page, home: -Infinity, end: Infinity }
      if (data.key === 'left' || data.key === 'h') await closePreview($)
      else if (t.preview === OUTSIDE && (data.key === 'e' || data.key === 'd')) return {}
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
    guards = {}
    guardsLoaded = null
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

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE && zjump.on) jumpClose($)
    if (e.id === PANE) {
      shortcutsShown = shortcutsSetting === 'always'
      shortcutsTop = 0
    }
    return next(e)
  })

  on('ui.focus', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (zjump.on && e.origin.kind === 'person' && (e.element === 'jump-up' || e.element === 'jump-down')) {
      await jumpKey($, e.element === 'jump-up' ? 'up' : 'down')
      return {}
    }
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
    if (shortcutsShown && !zjump.on) {
      scrollShortcuts($, Math.sign(e.by) * Math.max(3, Math.abs(e.by)))
      return {}
    }
    if (grepOn(t) && grep.rows.length) {
      grep.sel = Math.max(0, Math.min(grep.rows.length - 1, grep.sel + Math.sign(e.by) * Math.max(3, Math.abs(e.by))))
      void $.ui.invalidate('ui.render')
      const row = grep.rows[grep.sel]
      if (row) await patch($, () => ({ selected: row.path }))
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
    const marked = (await Promise.all(marks.map(async p => ((await exists($, p)) ? p : '')))).filter(Boolean)
    if (marked.length) context.push(`The user has marked these entries in the file tree; "these" or "them" in the prompt likely refers to them:\n${marked.join('\n')}`)
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

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const drawn = await next(e)
    if (e.component !== 'AssistantMessage' || e.props.isSummary || (e.surface !== 'terminal' && e.surface !== 'desktop') || !fileRefs(e.props.text).length) return drawn
    const t = await get($)
    if (!t.root) return drawn
    const refs = await refsIn($, e.props.text, t.root, await cwdOf($))
    if (!refs.length) return drawn
    const { Box, Markdown } = $.ui.resolve(e)
    const links = refs.map(r => ({ href: refHref(r), label: `${relative(t.root, r.path)}:${r.line}${r.end > r.line ? `-${r.end}` : ''}` }))
    return (
      <Box flexDirection="column">
        {drawn}
        <Markdown key="filetree-refs" dimColor text={`in the file tree: ${links.map(l => `[${l.label.replace(/[[\]]/g, '\\$&')}](${l.href})`).join('  ')}`} pressableLinks={links.map(l => l.href)} onLinkPress={(link, p) => void openRef($, link.href, p.surface)} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (e.surface !== 'terminal' && e.surface !== 'desktop') return next(e)
    if (e.surface === 'terminal' && e.props.placement === 'inline') {
      if (e.viewport?.isFullscreen === false) {
        noDock = true
        void $.ui.close({ id: PANE }).catch(() => undefined)
      }
      const { Box: Empty } = $.ui.resolve(e)
      return <Empty />
    }
    if (zjump.on) {
      if (e.props.isFocused) zjump.held = true
      else if (zjump.held) $.clock.after(0, () => (zjump.on && zjump.held ? jumpClose($) : undefined))
    }
    const unicode = glyphSetting === 'plain' || glyphSetting === 'text' || (glyphSetting === 'auto' && (noNerd || e.surface === 'desktop'))
    const elements = $.ui.resolve(e)
    const { Box, Text, Button, Input, Client } = elements
    const Svg = 'Svg' in elements ? elements.Svg : undefined
    const desk = e.surface === 'desktop' && Boolean(Svg)
    const Image = 'Image' in elements ? elements.Image : undefined
    const t = await get($)
    const light = e.surface !== 'desktop' && lightTerminal
    const theme: Theme = { ...DEFAULT_THEME, ...palette.theme }
    const tones = light ? LIGHT_TONES : TONES
    const mutedText = theme.muted ? { color: theme.muted } : { dimColor: true }
    const gitColors = { ...(desk ? DESK_GIT_TEXT : GIT_COLOR), ...palette.git }
    const addColor = palette.add ?? ADD_COLOR
    const delColor = palette.del ?? DEL_COLOR
    const warnColor = gitColors.M ?? 'ansi256(3)'
    await loadGuards($)
    const guarded = new Set(allGuards(guards))
    const deskDiff = (source: string, key: string) => {
      const rows: { kind: ' ' | '+' | '-' | '@'; text: string; old: number; new: number }[] = []
      let old = 0
      let cur = 0
      let inHunk = false
      for (const line of source.split('\n')) {
        const head = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
        if (head) {
          old = Number(head[1])
          cur = Number(head[2])
          inHunk = true
          rows.push({ kind: '@', text: line, old, new: cur })
          continue
        }
        if (!inHunk) continue
        const kind = line[0]
        if (kind === '+') rows.push({ kind, text: line.slice(1), old: 0, new: cur++ })
        else if (kind === '-') rows.push({ kind, text: line.slice(1), old: old++, new: 0 })
        else if (kind === ' ') rows.push({ kind, text: line.slice(1), old: old++, new: cur++ })
      }
      const digits = Math.max(2, ...rows.map(r => String(Math.max(r.old, r.new)).length))
      const add = ink(addColor, DESK_GIT.A ?? DESK.accent)
      const del = ink(delColor, DESK.urgent)
      const tintOf = (kind: string) => (kind === '+' ? DESK.addBg : kind === '-' ? DESK.delBg : undefined)
      return (
        <Box key={`${key}-diff`} flexDirection="column">
          {rows.map((r, j) => r.kind === '@' ? (
            <Box key={`${key}-h${j}`} flexDirection="row" alignItems="center" height={ROW_PX} paddingLeft={1} backgroundColor={DESK.hover}>
              <Text dimColor size="footnote" tabular wrap="truncate-end">{r.text}</Text>
            </Box>
          ) : (
            <Box key={`${key}-l${j}`} flexDirection="row" alignItems="center" height={ROW_PX} backgroundColor={tintOf(r.kind)}>
              <Box width={digits + 1} flexShrink={0} flexDirection="row" justifyContent="flex-end"><Text dimColor tabular mono>{r.old ? String(r.old) : ''}</Text></Box>
              <Box width={digits + 1} flexShrink={0} flexDirection="row" justifyContent="flex-end"><Text dimColor tabular mono>{r.new ? String(r.new) : ''}</Text></Box>
              <Box width={2} flexShrink={0} flexDirection="row" justifyContent="center"><Text color={r.kind === '+' ? add : r.kind === '-' ? del : mutedInk} mono>{r.kind === ' ' ? '' : r.kind}</Text></Box>
              <Box flexGrow={1} flexShrink={1} overflow="hidden"><Text mono wrap="truncate-end">{r.text.replace(/\t/g, '  ') || ' '}</Text></Box>
            </Box>
          ))}
        </Box>
      )
    }
    const selBg = selectionOn(theme.selection, theme.bg, light)
    const rowColors = { activeBg: selBg, hoverBg: palette.hover ?? (theme.selection.startsWith('#') ? faint(theme.selection) : ''), tones: light ? LIGHT_SHIMMER : SHIMMER }
    nativeScroll = e.surface === 'desktop'
    const accentInk = ink(theme.accent, DESK.accent)
    const accentText = desk ? 'suggestion' : accentInk
    const mutedInk = ink(theme.muted, DESK.muted)
    const dc = (c: string | undefined) => (desk && c ? ink(c, c) : c)
    const tint = (c: string | undefined) => (c === '' ? { dimColor: true } : c === undefined ? {} : !desk ? { color: c } : c === theme.muted ? { dimColor: true } : c === theme.accent ? { color: 'suggestion' } : c === theme.urgent ? { color: 'error' } : { color: ink(c, c) })
    const bgRgb = rgbOf(theme.bg)
    const searchBg = bgRgb ? toHex(over(bgRgb, rgbOf(theme.fg) ?? (light ? [0, 0, 0] : [255, 255, 255]), 0.07)) : light ? 'ansi256(254)' : 'ansi256(236)'
    const glow = (color: string, id: string) => (hovered === id ? lighten(color) : color)
    const flagOf = { case: 'searchCase', regex: 'searchRegex', content: 'searchContent' } as const
    const toggle = (id: keyof typeof flagOf, label: string, active: boolean, bad: boolean) => {
      const color = bad ? ink(theme.urgent, DESK.urgent) : active ? accentInk : mutedInk
      return desk ? (
        <Box key={`tool-${id}`} position="relative" flexShrink={0} flexDirection="row" alignItems="center">
          {id === 'content' && Svg
            ? <Svg key={`search-${id}-icon-${active ? 'on' : 'off'}`} source={iconSvg('file-text', glow(color, id), 16)} alt={`search file contents ${active ? 'on' : 'off'}`} width={16} height={16} />
            : <Text color={glow(color, id)} hover={{ color: lighten(color) }} weight={active ? 'semibold' : 'regular'}>{label}</Text>}
          <Box position="absolute" top={0} left={0} right={0} bottom={0}>
            <Client key={`button-${id}`} module="./button.tsx" props={{ id, label: '', dim: !active } satisfies ButtonProps} width="100%" height="100%" />
          </Box>
        </Box>
      ) : (
        <Button key={`search-${id}`} plain label={label} onPress={() => void searchFlag($, flagOf[id])}>
          <Text {...(bad ? { color: theme.urgent } : active ? { color: theme.accent } : { dimColor: true })}>{label}</Text>
        </Button>
      )
    }
    const deskSel = palette.theme.selection ?? DESK.selection
    const deskHover = palette.hover ?? DESK.hover
    const deskCur = e.props.isFocused ? deskSel : deskHover
    const button = (b: ButtonProps & { icon?: IconName; hint?: string }) => desk && Svg && b.icon ? (
      <Box key={`tool-${b.id}`} position="relative" flexDirection="row" alignItems="center" flexShrink={0}>
        <Svg key={`tool-icon-${b.id}${b.id === 'refresh' ? `-${reloading ? 'spin' : reloadSpin}` : ''}`} source={toolSvg(b.icon, glow(b.id === 'outside' ? ink(warnColor, DESK_GIT.M ?? DESK.accent) : b.dim && !(b.id === 'refresh' && reloading) ? mutedInk : accentInk, b.id), b.id === 'refresh' && reloading ? SPIN_MS : 0)} alt={`${WORDS[b.id] ?? b.id} button`} width={24} height={24} />
        {b.id === 'outside' ? <Text key="outside-count" color={glow(ink(warnColor, DESK_GIT.M ?? DESK.accent), b.id)} tabular>{`${outside.length} `}</Text> : null}
        <Box position="absolute" top={0} left={0} right={0} bottom={0}>
          <Client key={`button-${b.id}`} module="./button.tsx" props={{ id: b.id, label: '', dim: b.dim } satisfies ButtonProps} width="100%" height="100%" />
        </Box>
      </Box>
    ) : <Client key={`button-${b.id}`} module="./button.tsx" props={{ id: b.id, label: b.label, dim: b.dim, ...(TOGGLES.includes(b.id) ? { color: theme.accent } : b.id === 'outside' ? { color: warnColor } : {}) } satisfies ButtonProps} />
    const hint = (buttons: { id: string; label: string; hint: string; dim: boolean }[], title: number) => {
      const over = buttons.find(b => b.id === hovered)
      const text = over?.hint
      if (!text) return null
      const tint = over && !over.dim ? accentInk : theme.fg ? ink(theme.fg, 'text') : 'text'
      const room = e.props.bodyColumns - title - buttons.reduce((w, b) => w + (desk ? DESK_ICON_COLS : b.label.length + 1), 0) - 2
      return text.length <= room ? <Text color={tint} wrap="truncate-end">{`${text} `}</Text> : null
    }
    if (t.preview) {
      if (previewed?.path !== t.preview) await loadPreview($, t.preview, deskLine?.path === t.preview ? deskLine.line : undefined)
      const p = previewed
      const first = p?.diff ? 0 : (p?.first ?? 0)
      const markdown = /\.(md|markdown|mdx|docx|odt|rtf)$/i.test(t.preview)
      const all = p?.diff?.length ?? (p?.text ?? '').split('\n').length
      previewRows = nativeScroll ? all : Math.max(4, (e.props.scroll?.bodyRows ?? 40) - (p?.note ? 3 : 2))
      const start = nativeScroll ? 0 : p?.diff ? Math.min(t.previewTop, Math.max(0, all - 1)) : Math.min(t.previewTop, Math.max(0, all - previewRows))
      const win = p?.diff ? diffWindow(p.diff, start, previewRows) : previewLines(p?.text ?? '', start, previewRows, markdown)
      previewLine = first + win.top + 1
      const name = t.preview !== t.root && inside(t.root, t.preview) ? relative(t.root, t.preview) : shortPath(t.preview)
      const listing = t.preview === OUTSIDE
      const external = { id: 'external', label: glyphSetting === 'text' ? 'open' : unicode ? '↗' : '\u{eb14}', dim: true, hint: 'open in default app' }
      if (desk && Svg) {
        const step = p?.diff ? (p.diff.some(l => l.kind === '@') ? 'file' : 'hunk') : ''
        const toTree = t.nodes.find(n => n.id === t.preview)?.kind === 'dir'
        const edits = !listing && (editWithSetting || inTmux || inHerdr)
        previewDesk = true
        const acts: { id: string; key: string; icon: IconName; hint: string; run: () => Promise<void> }[] = [
          { id: 'pv-k', key: 'k', icon: 'arrow-up', hint: step ? `previous ${step}` : 'up a line', run: () => (step ? jumpDiff($, -1) : scrollPreview($, -1)) },
          { id: 'pv-j', key: 'j', icon: 'arrow-down', hint: step ? `next ${step}` : 'down a line', run: () => (step ? jumpDiff($, 1) : scrollPreview($, 1)) },
          { id: 'pv-b', key: 'b', icon: 'page-up', hint: 'page up', run: () => scrollPreview($, 2 - previewRows) },
          { id: 'pv-f', key: 'f', icon: 'page-down', hint: 'page down', run: () => scrollPreview($, previewRows - 2) },
          ...(listing ? [] : [{ id: 'pv-d', key: 'd', icon: (p?.diff ? (toTree ? 'folder' : 'file') : 'diff') as IconName, hint: p?.diff ? (toTree ? 'back to the tree' : 'back to the file') : 'diff against HEAD', run: () => diffFile($, t.preview) }]),
          ...(edits ? [{ id: 'pv-e', key: 'e', icon: 'pencil' as const, hint: `edit at line ${previewLine}`, run: () => editPreview($, t.preview) }] : []),
          ...(listing ? [] : [{ id: 'external', key: '', icon: 'external-link' as const, hint: 'open in default app', run: () => pressHeader($, 'external') }]),
        ]
        previewActs = new Map(acts.map(a => [a.id, () => void a.run().then(() => (a.id === 'external' ? undefined : parkPreview($)))]))
        const tools = acts.map(a => ({ id: a.id, label: '', dim: true, hint: a.hint, icon: a.icon }))
        return (
          <Box flexDirection="column" minHeight={Math.max(1, e.props.scroll?.bodyRows ?? 1)} backgroundColor={theme.bg || undefined}>
            <Box key="pv-head" flexDirection="row" alignItems="center">
              <Box key="pv-back" flexDirection="row" alignItems="center" flexShrink={0}>
                <Svg key="pv-back-icon" source={rowSvg(0, null, 'chevron-left', mutedInk, DESK.muted, 0)} alt="back to files" width={STEP_PX * 2} height={ROW_PX} />
                <Button key="back" plain dimColor hover={{ dimColor: false }} hotkey="h" autoFocus label="Files" onPress={() => void closePreview($)} />
              </Box>
              <Text {...mutedText}>{' / '}</Text>
              <Box flexShrink={1} flexGrow={1} overflow="hidden">
                <Text weight="semibold" wrap="truncate-start">{name}</Text>
              </Box>
              {hint(tools, 12 + name.length)}
              <Box flexDirection="row" alignItems="center" flexShrink={0}>{tools.map(button)}</Box>
            </Box>
            {p?.note ? (
              <Box key="pv-note" flexDirection="row" marginLeft={4} marginBottom={1}>
                <Text {...mutedText} size="footnote">{p.note}</Text>
              </Box>
            ) : null}
            {'segments' in win ? (
              <Box key="pv-files" flexDirection="column">
                {win.segments.map((g, i) => {
                  const node: FileNode = { id: g.title, parent: '', name: g.title.split('/').pop() ?? g.title, kind: 'file', hidden: false, mtime: 0, size: 0, loaded: true }
                  const counts = p?.diff ? diffCounts(g.source) : [0, 0]
                  if (g.title.startsWith(GROUP)) return (
                    <Box key={`pv-seg-${i}`} flexDirection="row" alignItems="center" marginBottom={1}>
                      <Svg key={`pv-group-icon-${i}`} source={rowSvg(0, null, 'folder', accentInk)} alt={`group ${g.title.slice(GROUP.length)}`} width={STEP_PX * 2 + GAP_PX} height={ROW_PX} />
                      <Text weight="semibold" color={accentText}>{g.title.slice(GROUP.length)}</Text>
                    </Box>
                  )
                  return (
                    <Box key={`pv-seg-${i}`} flexDirection="column" marginBottom={1}>
                      {g.title ? (
                        <Box key={`pv-seg-head-${i}`} flexDirection="row" alignItems="center">
                          <Svg key={`pv-seg-icon-${i}`} source={rowSvg(0, null, nodeIcon(node, false), mutedInk)} alt={`file ${g.title}`} width={STEP_PX * 2 + GAP_PX} height={ROW_PX} />
                          <Box flexGrow={1} flexShrink={1} overflow="hidden"><Text weight="semibold" wrap="truncate-start">{g.title}</Text></Box>
                          {counts[0] ? <Text color={dc(addColor)} tabular>{` +${counts[0]}`}</Text> : null}
                          {counts[1] ? <Text color={dc(delColor)} tabular>{` -${counts[1]}`}</Text> : null}
                          <Box width={2} flexShrink={0} />
                        </Box>
                      ) : null}
                      {g.source ? deskDiff(g.source, `pv-seg-${i}`) : null}
                    </Box>
                  )
                })}
              </Box>
            ) : deskLine?.path === t.preview && deskLine.top > 0 && !p?.diff ? (() => {
              const lines = (p?.text ?? '').split('\n')
              const at = Math.max(0, Math.min(deskLine.top - first, lines.length - 1))
              if (!deskLine.scrolled) {
                deskLine.scrolled = true
                $.clock.after(50, () => void $.ui.scroll({ to: { key: 'pv-line' }, in: PANE, block: 'start' }).catch(() => undefined))
              }
              const { Markdown, Code } = elements
              const [above, below] = markdown ? markdownSplit(p?.text ?? '', at) : [lines.slice(0, at).join('\n'), lines.slice(at).join('\n')]
              return (
                <Box key="pv-split" flexDirection="column">
                  {markdown ? <Markdown key="pv-above" text={above} /> : <Code key="pv-above" source={above} path={t.preview} startLine={first + 1} wrap="truncate-end" />}
                  {markdown ? <Markdown key="pv-line" text={below} /> : <Code key="pv-line" source={below} path={t.preview} startLine={first + at + 1} wrap="truncate-end" />}
                </Box>
              )
            })() : directPreview(elements, { ...win, top: first + win.top }, t.preview, markdown, theme.accent)}
            <Box key="pv-hotkeys" height={0} overflow="hidden" flexDirection="row">
              {acts.filter(a => a.key).map(a => <Button key={`pv-hk-${a.key}`} plain hotkey={a.key} label={a.key} onPress={() => previewActs.get(a.id)?.()} />)}
            </Box>
          </Box>
        )
      }
      previewDesk = false
      return (
        <Box flexDirection="column" minHeight={Math.max(1, e.props.scroll?.bodyRows ?? 1)} backgroundColor={theme.bg || undefined}>
          <Box flexDirection="row">
            <Button key="back" plain hotkey="h" autoFocus={editWithSetting || inTmux || inHerdr ? undefined : true} label={unicode ? '← files' : '\u{ea9b} files'} onPress={() => void closePreview($)} />
            <Text> </Text>
            <Box flexShrink={1} flexGrow={1}>
              <Text bold wrap="truncate-start">{name}</Text>
            </Box>
            {listing ? null : hint([external], 8 + name.length)}
            {listing ? null : button(external)}
          </Box>
          <Box flexDirection="row" gap={2}>
            {([['j', '↓', '\u{ea9a}', 1], ['k', '↑', '\u{eaa1}', -1], ['f', 'page ↓', '\u{ea9a} page', previewRows - 2], ['b', 'page ↑', '\u{eaa1} page', 2 - previewRows]] as const).map(([k, plain, nerd, by]) => {
              const step = p?.diff && (k === 'j' || k === 'k') ? (p.diff.some(l => l.kind === '@') ? 'file' : 'hunk') : ''
              const label = step ? `${unicode ? plain : nerd} ${step}` : unicode ? plain : nerd
              return <Button key={`pv-${k}`} plain dimColor hotkey={k} label={label} onPress={() => void (step ? jumpDiff($, by > 0 ? 1 : -1) : scrollPreview($, by)).then(() => parkPreview($))} />
            })}
            {listing ? null : <Button key="pv-d" plain dimColor hotkey="d" label={p?.diff ? (t.nodes.find(n => n.id === t.preview)?.kind === 'dir' ? 'tree' : 'file') : 'diff'} onPress={() => void diffFile($, t.preview)} />}
            {!listing && (editWithSetting || inTmux || inHerdr) ? <Button key="edit" plain dimColor autoFocus hotkey="e" label={`${unicode ? 'edit' : '\u{ea73} edit'} :${previewLine}`} onPress={() => void editPreview($, t.preview)} /> : null}
          </Box>
          {p?.note ? <Text {...mutedText}>{p.note}</Text> : null}
          {nativeScroll ? directPreview(elements, { ...win, top: first + win.top }, t.preview, markdown, theme.accent) : (
            <Client
              key="rows"
              module="./rows.tsx"
              props={{ rows: [], active: '', ...rowColors, pointer: false, preview: 'segments' in win ? { text: '', path: t.preview, startLine: win.top + 1, markdown: false, segments: win.segments, titleColor: theme.accent } : { text: win.text, path: t.preview, startLine: first + win.top + 1, markdown } } satisfies RowsProps}
            />
          )}
        </Box>
      )
    }
    const now = await $.clock.now()
    if (t.top) hintRoot = ''
    else if (showHints && hintRoot !== t.root) {
      hintRoot = t.root
      hintUntil = now + HINT_MS
      $.clock.after(HINT_MS, () => void $.ui.invalidate('ui.render'))
    }
    const hintOn = now < hintUntil
    const live = (await activities($)).filter(a => now - a.at < (a.state === 'running' ? RUNNING_MAX_MS : ACTIVITY_TTL_MS))
    const latest = [...live].reverse().find(a => a.state === 'running') ?? live[live.length - 1]
    const bright = new Set(t.flashOn ? t.flash : [])
    const dimmed = new Set(t.flashOn ? t.flashDim : [])
    const ignored = new Set(t.ignored)
    const untracked = new Set(t.untrackedDirs)
    const width = Math.max(24, e.props.bodyColumns)
    const rows = rowsOf(t)
    const grepping = !zjump.on && grepOn(t)
    if (grepping && grep.key !== grepKey(t)) grepRun($, t)
    const body = e.props.scroll?.bodyRows ?? 40
    const footer = t.nodes.find(n => n.id === t.cursor)?.id ?? (t.selected || '')
    const chrome = 1 + (searchGap ? 2 : sortHeader ? 1 : 0) + 1 + (t.top ? (t.branch ? 1 : 0) : showHints ? 1 : 0) + (latest ? 1 : 0) + (!desk || footer || shortcutsSetting === 'auto' ? 1 : 0)
    const spare = body - chrome - 5
    const splitRows = t.split && !nativeScroll && spare >= 6 && (treemapSetting !== 'off' || Boolean(peekTarget(t))) ? Math.min(Math.max(6, Math.floor(body * 0.45)), spare) : 0
    splitShown = splitRows > 0
    if (!splitShown) overPeek = false
    const fixed = splitRows + chrome
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
    const deskFrom = nativeScroll && shown.length > DESK_ROWS ? Math.max(0, Math.min(at - Math.floor(DESK_ROWS / 2), shown.length - DESK_ROWS)) : 0
    const drawn = nativeScroll ? shown.slice(deskFrom, deskFrom + DESK_ROWS) : shown
    if (t.column === 'date') wantTimes($, [...pinned, ...drawn].filter(r => r.node.kind === 'dir').map(r => r.node))
    if (t.column === 'size') wantSizes($, [...pinned, ...drawn].filter(r => r.node.kind === 'dir' && !(r.node.id in t.dirSizes)).map(r => r.node.id))
    if (t.column === 'files') wantCounts($, [...pinned, ...drawn].filter(r => r.node.kind === 'dir' && !fileCounts.has(r.node.id)).map(r => r.node.id))
    if (t.column === 'loc') {
      const seen = [...pinned, ...drawn].map(r => r.node)
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
      ...(outside.length ? [{ id: 'outside', label: `${unicode ? '⚠' : '\u{ea6c}'} ${outside.length}`, dim: false, hint: `${outside.length} file${outside.length === 1 ? '' : 's'} written outside the repo`, icon: 'warning' as const }] : []),
      ...(t.selected ? [{ id: 'unselect', label: unicode ? '⊘' : '\u{eabd}', dim: false, hint: 'clear selection', icon: 'ban' as const }] : []),
      { id: 'up', label: unicode ? '↑' : '\u{f19f3}', dim: true, hint: 'parent folder', icon: 'folder-up-line' as const },
      { id: 'cwd', label: unicode ? '⌂' : '\u{eb46}', dim: !follow, hint: 'go to cwd', icon: 'root-folder' as const },
      { id: 'hidden', label: unicode ? (t.showHidden ? '⊙' : '○') : t.showHidden ? '\u{ea70}' : '\u{eae7}', dim: !t.showHidden, hint: t.showHidden ? 'hide hidden files' : 'show hidden files', icon: t.showHidden ? ('eye' as const) : ('eye-off' as const) },
      { id: 'size', label: unicode ? '◫' : '\u{ea90}', dim: t.column === 'date', hint: t.column === 'date' ? 'show sizes' : t.column === 'size' ? 'show lines of code' : t.column === 'loc' ? 'show file counts' : 'show dates', icon: 'columns' as const },
      { id: 'collapse', label: unicode ? '⊟' : '\u{eac5}', dim: true, hint: t.expanded.length ? 'collapse all' : 'expand all', icon: t.expanded.length ? 'square-minus' as const : 'square-plus' as const },
      { id: 'autocollapse', label: unicode ? '◷' : '\u{ea82}', dim: !autoCollapseOn(t), hint: 'auto-collapse opened folders', icon: 'folder-minus' as const },
      ...(nativeScroll ? [] : [{ id: 'split', label: unicode ? '⊡' : '\u{eb57}', dim: !t.split, hint: t.split ? 'hide preview' : 'show preview', icon: 'panel' as const }]),
      { id: 'refresh', label: unicode ? '↻' : '\u{eb37}', dim: !reloading, hint: 'reload tree and git', icon: 'refresh' as const },
    ]
    const wordButtons = plainButtons.map(b => ({ ...b, label: b.id === 'outside' ? `outside ${outside.length}` : (WORDS[b.id] ?? b.label) }))
    const wordWidth = wordButtons.reduce((w, b) => w + b.label.length + 1, 1)
    const buttons = glyphSetting === 'text' && e.props.bodyColumns - wordWidth >= 8 ? wordButtons : plainButtons
    const rootGlyph = unicode ? '■' : t.top === t.root ? '\u{f02a2}' : '\u{e5fe}'
    const header = t.top ? [t.top.split('/').pop() ?? t.top, t.prefix.replace(/\/$/, '')].filter(Boolean).join('/') : t.root.split('/').pop() || t.root
    const toolRoom = e.props.bodyColumns - header.length - 4
    const toolWidth = (list: typeof buttons, gap: number) => list.reduce((w, b) => w + (desk ? DESK_ICON_COLS : [...b.label].length), 0) + gap * Math.max(0, list.length - 1) + 1
    let toolButtons = buttons
    for (const drop of ['autocollapse', 'size', 'collapse', 'refresh']) {
      if (toolWidth(toolButtons, 1) <= toolRoom) break
      toolButtons = toolButtons.filter(b => b.id !== drop)
    }
    const toolGap = desk ? 0 : toolWidth(toolButtons, 2) <= toolRoom ? 2 : 1
    const tipButton = buttons.find(b => b.id === hovered)
    const tipText = tipButton?.hint ?? ''
    const tipProps = tipButton && !tipButton.dim ? { color: desk ? accentText : theme.accent } : desk ? { color: theme.fg ? ink(theme.fg, 'text') : 'text' } : theme.fg ? { color: theme.fg } : {}

    const sizePad = desk ? '\u2007' : ' '
    const isLong = (n: FileNode): boolean => longFile > 0 && t.column === 'loc' && n.kind === 'file' && (locCache.get(n.id) ?? 0) > longFile
    const cellsOf = (n: FileNode): Partial<Record<Col, Seg>> => {
      const loc = t.diff[n.id]
      const metric = t.column === 'loc'
        ? n.kind === 'dir'
          ? locCache.has(n.id)
            ? (locCache.get(n.id) ?? 0) >= 0 ? formatLoc(locCache.get(n.id) ?? 0) : ''
            : '…'
          : n.kind === 'file' && counted(n.name)
            ? locCache.has(n.id)
              ? formatLoc(locCache.get(n.id) ?? 0)
              : locListed.has(n.parent) ? '' : '…'
            : ''
        : t.column === 'files'
        ? n.kind === 'dir'
          ? fileCounts.has(n.id)
            ? (fileCounts.get(n.id) ?? -1) >= 0 ? formatLoc(fileCounts.get(n.id) ?? 0) : ''
            : '…'
          : ''
        : t.column === 'size'
        ? n.kind === 'dir'
          ? n.id in t.dirSizes
            ? humanSize(t.dirSizes[n.id] ?? -1, sizePad)
            : '…'
          : n.kind === 'file' || (n.kind === 'link' && n.size > 0)
            ? humanSize(n.size, sizePad)
            : ''
        : n.kind === 'file' || n.kind === 'dir'
          ? (when => (when ? (showAge ? age(when, now) : stamp(when, dateSetting, clock)) : ''))(n.kind === 'dir' ? (dirTimes.get(n.id)?.[1] ?? 0) : n.mtime)
          : ''
      const counts = n.kind === 'dir' ? t.counts[n.id] : undefined
      const cells: Partial<Record<Col, Seg>> = {}
      if (loc && loc[0] > 0) cells['+'] = { t: `+${loc[0]}`, c: addColor }
      if (loc && loc[1] > 0) cells['-'] = { t: `-${loc[1]}`, c: delColor }
      if (counts && counts[0] > 0) cells['?'] = { t: `?:${counts[0]}`, c: gitColors['?'] ?? addColor }
      if (counts && counts[1] > 0) cells.M = { t: `M:${counts[1]}`, c: gitColors.M ?? 'ansi256(3)' }
      if (counts && counts[2] > 0) cells.D = { t: `D:${counts[2]}`, c: theme.urgent }
      if (metric) cells.metric = { t: metric, c: isLong(n) ? delColor : theme.muted }
      return cells
    }
    const tailRows = desk ? drawn : [...pinned, ...shown]
    const allCells = tailRows.map(r => cellsOf(r.node))
    const branchCells: Partial<Record<Col, Seg>> = {}
    if (totals[0] > 0) branchCells['+'] = { t: `+${totals[0]}`, c: addColor }
    if (totals[1] > 0) branchCells['-'] = { t: `-${totals[1]}`, c: delColor }
    const rootC = t.top ? t.counts[t.root] : undefined
    if (rootC && rootC[0] > 0) branchCells['?'] = { t: `?:${rootC[0]}`, c: gitColors['?'] ?? addColor }
    if (rootC && rootC[1] > 0) branchCells.M = { t: `M:${rootC[1]}`, c: gitColors.M ?? 'ansi256(3)' }
    if (rootC && rootC[2] > 0) branchCells.D = { t: `D:${rootC[2]}`, c: theme.urgent }
    const widths: Partial<Record<Col, number>> = {}
    for (const cells of [...allCells, branchCells]) for (const c of COLS) {
      const cell = cells[c]
      if (cell) widths[c] = Math.max(widths[c] ?? 0, [...cell.t].length)
    }
    const maxDepth = tailRows.reduce((m, r) => Math.max(m, r.depth), 0)
    const tailSum = () => COLS.reduce((w, c) => w + (widths[c] ? (widths[c] ?? 0) + 1 : 0), 0)
    if (width - 6 - maxDepth * 2 - tailSum() - 2 < NAME_MIN) delete widths.metric
    if (width - 6 - maxDepth * 2 - tailSum() - 2 < NAME_MIN) for (const c of GIT_COLS) delete widths[c]
    const tailCells = tailSum()
    const searching = Boolean(t.query.trim()) && !grepping
    const rowParts = (r: (typeof rows)[number]) => {
      const n = r.node
      const own = t.git[n.id]
      const status = own ?? (underAny(dirname(n.id), untracked, t.root) ? '?' : undefined)
      const isIgnored = !status && underAny(n.id, ignored, t.root)
      const gitColor = status === 'D' || status === 'U' ? theme.urgent : status ? (gitColors[status] ?? theme.muted) : undefined
      const isBright = bright.has(n.id)
      const isDim = !isBright && dimmed.has(n.id)
      const tone = t.flashTones[n.id] ?? 'orange'
      const isGuard = guarded.has(n.id)
      const iconColor = isGuard ? theme.urgent : isIgnored ? theme.muted : (gitColor ?? (n.hidden ? theme.muted : n.kind === 'dir' ? theme.accent : theme.muted))
      const nameColor = isIgnored ? theme.muted : (gitColor ?? (n.hidden ? theme.muted : theme.fg || undefined))
      const cells = cellsOf(n)
      if (cells.metric && gitColor && !isIgnored && !isLong(n)) cells.metric = { ...cells.metric, c: gitColor }
      const hasCounts = Boolean(cells['?'] || cells.M || cells.D)
      const badge = hasCounts ? '  ' : status ? ` ${status}` : isIgnored ? ' ⊘' : '  '
      const rel = relative(t.root, n.id)
      const spans = searching ? matchSpans(t.query, Boolean(t.searchCase), Boolean(t.searchRegex), rel) : []
      const hl = (text: string) => (spans.length ? highlight(text, spans, rel.length - n.name.length) : [{ t: text, hit: false }])
      const isMarked = marks.includes(n.id)
      const isLink = links.has(n.id)
      const link = isLink ? linkStates.get(n.id) : undefined
      if (isLink && !linkStates.has(n.id)) void classifyLink($, n.id)
      const linkColor = link?.kind === 'broken' || link?.kind === 'circular' ? theme.urgent : link?.kind === 'outside' ? warnColor : theme.muted
      const cols = Math.max(4, width - r.depth * 2 - 6 - tailCells - badge.length - (isMarked ? 2 : 0) - (isLink ? 2 : 0))
      const name = n.name.length > cols ? n.name.slice(0, cols - 1) + '…' : n.name
      const isCur = n.id === t.cursor
      const caret = n.kind === 'dir' ? (unicode ? (r.open ? '▾' : '▸') : r.open ? CHEVRON_OPEN : CHEVRON_CLOSED) + ' ' : isCur ? '▎ ' : '  '
      const isRepo = n.kind === 'dir' && n.id === t.top
      const glyph = isGuard ? (unicode ? GUARD.plain : GUARD.nerd) : unicode ? (n.kind === 'dir' ? '■' : isMemory(n) ? BRAIN.plain : '∙') : fileIcon(n, r.open, isRepo)
      const lit = isBright || isDim
      const left: Seg[] = [
        { t: '  '.repeat(r.depth) },
        { t: caret, c: isCur ? theme.accent : theme.muted, b: isCur || undefined },
        lit ? { t: glyph + ' ', sh: tone, dim: isDim, one: true } : { t: glyph + ' ', c: iconColor },
        ...(lit ? [{ t: name, sh: tone, dim: isDim, b: isBright }] : hl(name).map(x => ({ t: x.t, c: x.hit ? theme.accent : nameColor, b: x.hit || n.id === t.selected || isCur, s: status === 'D' && n.kind !== 'dir' }))),
        ...(isLink ? [{ t: ' →', c: linkColor }] : []),
        ...(isMarked ? [{ t: ' ●', c: theme.accent }] : []),
      ]
      const right: Seg[] = COLS.filter(c => widths[c]).map(c => {
        const cell = cells[c]
        const pad = ' ' + (cell?.t ?? '').padStart(widths[c] ?? 0)
        return cell ? { t: pad, c: cell.c } : { t: pad }
      })
      right.push({ t: badge, c: status && !hasCounts ? gitColor : theme.muted, b: true })
      return { spec: { id: n.id, left: clean(left), right: clean(right) }, n, r, cells, status: hasCounts ? '' : (status ?? ''), gitColor, isIgnored: isIgnored && !hasCounts && !status, iconColor, nameColor, lit, tone, isDim, isBright, isRepo, isGuard, isMarked, isLink, link, linkColor, parts: hl(n.name) }
    }
    const rowSpec = (r: (typeof rows)[number]): RowSpec => rowParts(r).spec
    const scopeName = t.searchScope ? `${relative(t.root, t.searchScope)}/` : ''
    const scopeChip = () => !scopeName ? null : desk ? (
      <Box key="scope-chip" position="relative" flexShrink={0} flexDirection="row" alignItems="center" marginLeft={1} paddingX={1} backgroundColor={DESK.toolOn}>
        <Text color={accentText}>{`in ${scopeName}`}</Text>
        <Text color={glow(mutedInk, 'scope')} hover={{ color: lighten(mutedInk) }}>{' ×'}</Text>
        <Box position="absolute" top={0} left={0} right={0} bottom={0}>
          <Client key="button-scope" module="./button.tsx" props={{ id: 'scope', label: '', dim: false } satisfies ButtonProps} width="100%" height="100%" />
        </Box>
      </Box>
    ) : (
      <Button key="scope-chip" plain label={`in ${scopeName} × `} onPress={() => void scopeSearch($, '')}>
        <Text color={theme.accent}>{`in ${scopeName}`}</Text>
        <Text dimColor>{' × '}</Text>
      </Button>
    )
    const onQuery = (v: string) => void (v === '' && t.query === '' && t.searchScope ? scopeSearch($, '') : search($, v))
    const sortCell = (col: 'name' | 'git' | 'metric', label: string) => {
      const active = t.sortCol === col
      const mark = active ? (t.sortDir === 'desc' ? ' ▾' : ' ▴') : ''
      const color = active ? accentInk : mutedInk
      return desk ? (
        <Box key={`sort-${col}`} position="relative" flexShrink={0} flexDirection="row" alignItems="center">
          <Text color={glow(color, `sort-${col}`)} hover={{ color: lighten(color) }} weight={active ? 'semibold' : 'regular'}>{label}</Text>
          {mark ? <Text dimColor>{mark}</Text> : null}
          <Box position="absolute" top={0} left={0} right={0} bottom={0}>
            <Client key={`button-sort-${col}`} module="./button.tsx" props={{ id: `sort-${col}`, label: '', dim: !active } satisfies ButtonProps} width="100%" height="100%" />
          </Box>
        </Box>
      ) : (
        <Button key={`sort-${col}`} plain label={label + mark} onPress={() => void sortBy($, col)}>
          <Text {...(active ? { color: theme.accent } : { dimColor: true })}>{label}</Text>
          {mark ? <Text dimColor>{mark}</Text> : null}
        </Button>
      )
    }
    const gitSpan = GIT_COLS.reduce((w, c) => w + (widths[c] ? (widths[c] ?? 0) + 1 : 0), 0)
    const metricSpan = widths.metric ? (widths.metric ?? 0) + 1 : 0
    const gitLabel = e.props.bodyColumns - Math.max(metricSpan, 11) - 20 >= 12 ? 'Git (LOC)' : 'Git'
    const metricLabel = t.column === 'size' ? 'Size' : t.column === 'loc' ? 'LOC' : t.column === 'files' ? '# Files' : 'Modified'
    const headerRow = () => (
      <Box key="sort-header" flexDirection="row" alignItems="center" {...(desk ? {} : { width: e.props.bodyColumns, height: 1 })}>
        {desk && Svg ? <Svg key="sort-indent" source={rowSvg(0, null, null, mutedInk)} alt="column headers" width={STEP_PX * 2 + GAP_PX} height={ROW_PX} /> : <Text>{'    '}</Text>}
        {sortCell('name', 'Name')}
        <Box flexGrow={1} />
        {gitSpan ? <Box key="sort-git-cell" width={Math.max(gitSpan, gitLabel.length + 3)} flexShrink={0} flexDirection="row" justifyContent="flex-end">{sortCell('git', gitLabel)}</Box> : null}
        {metricSpan ? <Box key="sort-metric-cell" width={Math.max(metricSpan, metricLabel.length + 3)} flexShrink={0} flexDirection="row" justifyContent="flex-end">{sortCell('metric', metricLabel)}</Box> : null}
        <Box width={2} flexShrink={0} />
      </Box>
    )
    const headerRule = () => desk && Svg
      ? <Box key="sort-rule" overflow="hidden"><Svg key="sort-rule-svg" source={lineSvg(DESK.edge, 1)} alt="column header rule" width={4000} height={1} /></Box>
      : null
    const tailCols = (cells: Partial<Record<Col, Seg>>, key: string, cols: readonly Col[] = COLS) => cols.filter(c => widths[c]).map(c => {
      const seg = cells[c]
      return (
        <Box key={`${key}-${c}`} width={(widths[c] ?? 0) + 1} flexShrink={0} flexDirection="row" justifyContent="flex-end">
          {seg ? <Text {...tint(seg.c)} tabular>{seg.t}</Text> : null}
        </Box>
      )
    })

    const deskRow = (p: ReturnType<typeof rowParts>) => {
      const r = p.r
      const n = p.n
      const icon = p.isGuard ? 'x' : nodeIcon(n, p.isRepo)
      const tone = tones[p.tone]
      const iconInk = p.lit ? (tone?.solid ?? accentInk) : p.isGuard ? ink(theme.urgent, DESK.urgent) : ink(p.iconColor, n.kind === 'dir' ? accentInk : mutedInk)
      const strike = p.status === 'D' && n.kind !== 'dir'
      const name = p.lit
        ? <Client key={`lit:${n.id}`} module="./rows.tsx" props={{ rows: [{ id: '', left: clean([{ t: n.name, sh: p.tone, b: p.isBright }]), right: [] }], active: '', activeBg: '', hoverBg: '', tones: rowColors.tones, pointer: false } satisfies RowsProps} />
        : <Text {...tint(p.nameColor)} strikethrough={strike || undefined} wrap="truncate-end">{p.parts.some(x => x.hit) ? p.parts.map((x, i) => (x.hit ? <Text key={`hl-${i}`} color={accentText} weight="semibold">{x.t}</Text> : x.t)) : n.name}</Text>
      return (
        <Box key={`row:${n.id}`} position="relative" flexDirection="row" alignItems="center" backgroundColor={n.id === t.cursor ? deskCur : undefined} hover={{ backgroundColor: n.id === t.cursor ? deskCur : deskHover }}>
          {n.id === t.cursor && e.props.isFocused && Svg ? <Box key={`bar:${n.id}`} position="absolute" top={0} left={0} bottom={0}><Svg key={`bar-svg:${n.id}`} source={barSvg(accentInk)} alt="cursor" width={2} height={ROW_PX} /></Box> : null}
          {Svg ? <Svg key={`icon:${n.id}`} source={rowSvg(r.depth, n.kind === 'dir' ? (r.open ? 'open' : 'closed') : null, icon, iconInk)} alt={`${p.isGuard ? 'guarded ' : ''}${n.kind === 'dir' ? 'folder' : n.kind === 'link' ? 'link' : 'file'} ${n.name}`} width={r.depth * STEP_PX + STEP_PX * 2 + GAP_PX} height={ROW_PX} /> : null}
          <Box flexGrow={p.isLink ? 0 : 1} flexShrink={1} overflow="hidden">{name}</Box>
          {p.isLink ? <Text key={`link:${n.id}`} {...tint(p.linkColor)}>{` → `}</Text> : null}
          {p.isLink ? <Box flexGrow={1} /> : null}
          {p.isMarked && Svg ? <Svg key={`mark:${n.id}`} source={iconSvg('mark', accentInk, 12)} alt={`marked ${n.name}`} width={12} height={12} /> : null}
          {tailCols(p.cells, `tail:${n.id}`)}
          <Box width={2} flexShrink={0} flexDirection="row" justifyContent="flex-end" alignItems="center">
            {p.status ? <Text {...tint(p.gitColor)} bold>{p.status}</Text> : p.isIgnored && Svg ? <Svg key={`ignored:${n.id}`} source={iconSvg('ban', mutedInk, 12)} alt="ignored by git" width={12} height={12} /> : null}
          </Box>
          <Box position="absolute" top={0} left={0} right={0} bottom={0}>
            <Client key={`hit:${n.id}`} module="./hit.tsx" props={{ id: n.id } satisfies HitProps} width="100%" height="100%" />
          </Box>
        </Box>
      )
    }

    const note = (text: string): RowSpec => ({ id: '', left: [{ t: text, c: theme.muted }], right: [] })
    const jumpSpecs: RowSpec[] = zjump.rows.length
      ? zjump.rows.map(dir => ({ id: dir, left: clean([{ t: unicode ? '■ ' : '\u{e5ff} ', c: theme.accent }, { t: dir.split('/').filter(Boolean).pop() ?? dir, c: theme.fg || undefined }, { t: `  ${shortPath(dirname(dir))}`, c: theme.muted }]), right: [] }))
      : [note('no matching folder')]
    const grepDigits = Math.max(2, ...grep.rows.map(h => String(h.line).length))
    const grepName = (path: string) => (inside(t.root, path) ? relative(t.root, path) : shortPath(path))
    const grepNode = (path: string): FileNode => ({ id: path, parent: dirname(path), name: path.slice(path.lastIndexOf('/') + 1), kind: 'file', hidden: false, mtime: 0, size: 0, loaded: true })
    const grepNote = !grepping ? '' : grep.rows.length === 0 ? (grep.busy ? 'searching…' : grep.note || 'no matches') : grep.capped ? `first ${GREP_LIMIT} matches; keep typing to narrow` : grep.note
    const grepRoom = Math.max(1, room - (grepNote ? 1 : 0))
    const grepFrom = nativeScroll ? 0 : Math.max(0, Math.min(grep.sel - Math.floor(grepRoom / 2), grep.rows.length - grepRoom))
    const grepSpecs: RowSpec[] = !grepping ? [] : [
      ...grep.rows.slice(grepFrom, nativeScroll ? undefined : grepFrom + grepRoom).map((h): RowSpec => h.line
        ? { id: grepId(h), left: clean([{ t: `    ${String(h.line).padStart(grepDigits)}  `, c: theme.muted }, { t: h.text, c: theme.fg || undefined }]), right: [] }
        : { id: grepId(h), left: clean([{ t: `${unicode ? '∙' : fileIcon(grepNode(h.path), false, false)} `, c: theme.muted }, { t: grepName(h.path), c: theme.fg || undefined, b: true }]), right: [{ t: ` ${h.text} `, c: theme.muted }] }),
      ...(grepNote ? [note(grepNote)] : []),
    ]
    const specs: RowSpec[] = zjump.on ? jumpSpecs : grepping ? grepSpecs : [
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
    const deskParts: ReturnType<typeof rowParts>[] = []
    if (desk) {
      let size = 0
      for (const r of drawn) {
        size += r.node.name.length + DESK_ROW_CHARS
        if (size > ROWS_BUDGET) break
        deskParts.push(rowParts(r))
      }
    }
    const deskGrep: GrepHit[] = []
    if (desk && grepping) {
      let size = 0
      for (const g of grep.rows) {
        size += DESK_ROW_CHARS + 6 * grepId(g).length + g.text.length
        if (size > ROWS_BUDGET) break
        deskGrep.push(g)
      }
    }
    if (desk && grepping) deskGrepShown = deskGrep.length
    const deskGrepNote = deskGrep.length < grep.rows.length ? `first ${deskGrep.length} of ${grep.rows.length} rows; keep typing to narrow` : grepNote
    const deskTree = () => {
      if (grepping) return (
        <Box key="grep-list" flexDirection="column">
          {deskGrep.map((g, k) => (
            <Box key={`grep-row:${grepId(g)}`} position="relative" flexDirection="row" alignItems="center" backgroundColor={k === grep.sel ? deskSel : undefined} hover={{ backgroundColor: k === grep.sel ? deskSel : deskHover }}>
              {g.line ? <Box key={`grep-line:${grepId(g)}`} flexDirection="row" alignItems="center" flexGrow={1} flexShrink={1} overflow="hidden">
                {Svg ? <Svg key={`grep-guide:${grepId(g)}`} source={rowSvg(1, null, null, mutedInk)} alt={`line ${g.line}`} width={STEP_PX * 3 + GAP_PX} height={ROW_PX} /> : null}
                <Text dimColor tabular mono>{`${String(g.line).padStart(grepDigits)} `}</Text>
                <Box flexGrow={1} flexShrink={1} overflow="hidden"><Text mono wrap="truncate-end">{g.text}</Text></Box>
              </Box> : <Box key={`grep-file:${grepId(g)}`} flexDirection="row" alignItems="center" flexGrow={1} flexShrink={1} overflow="hidden">
                {Svg ? <Svg key={`grep-icon:${grepId(g)}`} source={rowSvg(0, null, nodeIcon(grepNode(g.path), false), mutedInk)} alt={`file ${grepName(g.path)}`} width={STEP_PX * 2 + GAP_PX} height={ROW_PX} /> : null}
                <Box flexGrow={1} flexShrink={1} overflow="hidden"><Text weight="semibold" wrap="truncate-start">{grepName(g.path)}</Text></Box>
                <Text dimColor tabular>{g.text}</Text>
                <Box width={2} flexShrink={0} />
              </Box>}
              <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                <Client key={`hit:${grepId(g)}`} module="./hit.tsx" props={{ id: grepId(g) } satisfies HitProps} width="100%" height="100%" />
              </Box>
            </Box>
          ))}
          {deskGrepNote ? (
            <Box key="grep-note" position="relative" flexDirection="row" height={ROW_PX} alignItems="center">
              <Text {...mutedText}>{deskGrepNote}</Text>
              <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                <Client key="hit:grep-note" module="./hit.tsx" props={{ id: '' } satisfies HitProps} width="100%" height="100%" />
              </Box>
            </Box>
          ) : null}
        </Box>
      )
      if (zjump.on) return (
        <Box key="jump-list" flexDirection="column">
          {zjump.rows.length ? zjump.rows.map((dir, k) => (
            <Box key={`jump:${dir}`} position="relative" flexDirection="row" alignItems="center" backgroundColor={k === zjump.sel ? deskSel : undefined} hover={{ backgroundColor: k === zjump.sel ? deskSel : deskHover }}>
              {Svg ? <Svg key={`jump-icon:${dir}`} source={rowSvg(0, null, 'folder', accentInk)} alt={`folder ${dir}`} width={STEP_PX * 2 + GAP_PX} height={ROW_PX} /> : null}
              <Text>{dir.split('/').filter(Boolean).pop() ?? dir}</Text>
              <Box flexGrow={1} flexShrink={1} overflow="hidden" marginLeft={1}><Text {...mutedText} wrap="truncate-start">{shortPath(dirname(dir))}</Text></Box>
              <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                <Client key={`hit:${dir}`} module="./hit.tsx" props={{ id: dir } satisfies HitProps} width="100%" height="100%" />
              </Box>
            </Box>
          )) : (
            <Box key="jump-none" position="relative" flexDirection="row" height={ROW_PX} alignItems="center">
              <Text {...mutedText}>no matching folder</Text>
              <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                <Client key="hit:jump-none" module="./hit.tsx" props={{ id: '' } satisfies HitProps} width="100%" height="100%" />
              </Box>
            </Box>
          )}
        </Box>
      )
      const out: RenderElement[] = rows.length === 0 ? [<Text key="empty" {...mutedText}>empty</Text>] : []
      for (const p of deskParts) out.push(deskRow(p))
      if (deskFrom > 0) out.unshift(<Text key="above" {...mutedText}>{`  … ${deskFrom} rows above, collapse folders or use search`}</Text>)
      const below = shown.length - deskFrom - deskParts.length
      if (below > 0) out.push(<Text key="more" {...mutedText}>{`  … ${below} more rows, collapse folders or use search`}</Text>)
      return <Box key="tree" flexDirection="column">{out}</Box>
    }
    const barSize = Math.max(1, Math.round((specs.length * shown.length) / Math.max(1, rows.length)))
    const bar =
      !nativeScroll && !grepping && rows.length > shown.length + pinned.length
        ? { pos: max ? Math.round((from / max) * (specs.length - barSize)) : 0, size: barSize, thumb: theme.accent, track: theme.muted }
        : undefined

    const branchRow = () => {
      if (!t.top || !t.branch) return null
      const b = t.branch
      const isFlash = bright.has(BRANCH_ROW)
      const tone = t.flashTones[BRANCH_ROW] ?? 'teal'
      const label = b.head
      return (
        <Box flexDirection="row" height={desk ? undefined : 1} overflow="hidden" alignItems={desk ? 'center' : undefined}>
          <Box flexDirection="row" flexShrink={0} alignItems={desk ? 'center' : undefined}>
            {desk && Svg
              ? <Svg key="branch-icon" source={rowSvg(0, null, 'git-branch', isFlash ? (tones[tone]?.solid ?? accentInk) : e.props.isFocused ? accentInk : mutedInk)} alt="git branch" width={STEP_PX * 2 + GAP_PX} height={ROW_PX} />
              : <Text color={isFlash ? (tones[tone]?.solid ?? theme.accent) : theme.accent}>{(unicode ? BRANCH_ICON.plain : BRANCH_ICON.nerd) + ' '}</Text>}
            <Text {...(desk && !e.props.isFocused && !isFlash ? mutedText : { bold: true, color: isFlash ? (tones[tone]?.solid ?? (theme.fg || undefined)) : theme.fg || undefined })}>
              {label}
            </Text>
          </Box>
          <Box flexGrow={1} />
          {desk && tipText ? (
            <Box key="branch-tip" flexShrink={1} overflow="hidden"><Text {...tipProps} wrap="truncate-end">{tipText}</Text></Box>
          ) : <Box key="branch-git" flexDirection="row" flexShrink={1} alignItems={desk ? 'center' : undefined}>
          <Box flexDirection="row" flexShrink={0} alignItems={desk ? 'center' : undefined}>
            {rootCounts.length === 0 && totals[0] === 0 && totals[1] === 0 ? (
              desk && Svg
                ? <Box key="clean" flexDirection="row" alignItems="center"><Svg key="clean-icon" source={iconSvg('git-commit', mutedInk, 14)} alt="git" width={14} height={14} /><Text {...mutedText}> no changes</Text></Box>
                : <Text {...mutedText}>{unicode ? '± no changes' : '\u{e702} no changes'}</Text>
            ) : null}
            {desk ? tailCols(branchCells, 'branch', GIT_COLS) : null}
            {!desk && totals[0] > 0 && <Text color={addColor}>{` +${totals[0]}`}</Text>}
            {!desk && totals[1] > 0 && <Text color={delColor}>{` -${totals[1]}`}</Text>}
            {desk ? null : rootCounts.map((c, i) => (
              <Text key={`root-count-${i}`} color={c.c}>{c.t}</Text>
            ))}
          </Box>
          {b.upstream && showRemote ? (
            <Box flexDirection="row" flexShrink={1} overflow="hidden" marginLeft={2} alignItems={desk ? 'center' : undefined}>
              {desk && Svg
                ? <Svg key="remote-icon" source={iconSvg('cloud', mutedInk, 14)} alt="remote branch" width={14} height={14} />
                : <Text {...mutedText}>{unicode ? '☁' : '\u{f0c2}'}</Text>}
              <Text {...mutedText} wrap="truncate-end">{` ${b.upstream}`}</Text>
            </Box>
          ) : null}
          {desk && widths.metric ? (
            <Box key="branch-sync" width={(widths.metric ?? 0) + 1} flexShrink={0} flexDirection="row" justifyContent="flex-end">{<Box flexDirection="row">{b.upstream ? <Text {...(b.ahead > 0 ? { color: tones.blue?.solid } : mutedText)}>{` ↑${b.ahead}`}</Text> : null}{b.upstream ? <Text {...(b.behind > 0 ? { color: tones.red?.solid ?? theme.urgent } : mutedText)}>{` ↓${b.behind}`}</Text> : null}</Box>}</Box>
          ) : <Box flexDirection="row">{b.upstream ? <Text {...(b.ahead > 0 ? { color: tones.blue?.solid } : mutedText)}>{` ↑${b.ahead}`}</Text> : null}{b.upstream ? <Text {...(b.behind > 0 ? { color: tones.red?.solid ?? theme.urgent } : mutedText)}>{` ↓${b.behind}`}</Text> : null}</Box>}
          </Box>}
          <Box key="branch-tail" width={desk ? 2 : 1} flexShrink={0} />
        </Box>
      )
    }

    const chip = (a: Activity) => {
      const tone = a.state === 'failed' ? 'red' : a.tone
      const color = desk && tone === 'green' ? 'success' : desk && tone === 'red' ? 'error' : tones[tone]?.solid ?? theme.accent
      const icon = unicode ? a.plain : a.nerd
      const hash = a.state === 'done' && a.kind === 'git commit' ? a.detail.split(' ')[0] ?? '' : ''
      return (
        <Box flexDirection="row" marginLeft={2} alignItems={desk ? 'center' : undefined}>
          {desk && Svg
            ? <Svg key={`chip-${a.id}`} source={iconSvg(activityIcon(a.plain), tone === 'green' ? (DESK_GIT.A ?? accentInk) : tone === 'red' ? DESK.urgent : (tones[tone]?.solid ?? accentInk), 14)} alt={a.kind} width={14} height={14} />
            : <Text color={color}>{icon + ' '}</Text>}
          {desk ? <Text> </Text> : null}
          <Text bold={a.state === 'running'} color={color}>
            {a.state === 'running' ? `${a.label}…` : a.label}
          </Text>
          {hash && <Text color={color}>{` ${hash}`}</Text>}
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
        peekTop = peekWant?.path === target ? peekWant.top : 0
        peekWant = null
        if (peekAt?.path !== target) peekAt = null
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
        const paper = termColors.bg ?? (theme.bg ? colorOf(theme.bg, termColors, light) : light ? ([255, 255, 255] satisfies Rgb) : ([24, 24, 24] satisfies Rgb))
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
          const looked = boxes.map(tile => ({ tile, look: pixelLook(tile) }))
          const key = JSON.stringify([fit, ink, looked.map(({ tile: b, look }) => [b.path, b.x0, b.y0, b.x1, b.y1, sized(b), look])])
          if (mapImage?.key !== key) {
            mapImage = { key, png: png(paint(looked, fit.width, fit.height, ch, sized), fit.width, fit.height).toBase64() }
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
          const raw = await pngOf($, pic)
          const big = Math.floor(raw.length * 3 / 4) > IMAGE_BYTES
          const png = big ? '' : raw
          content = big ? <Text {...mutedText}>{`${name}: too large to preview here`}</Text> : png ? <Image key="peek-image" source={{ png }} columns={fit.columns} rows={fit.rows} alt={name} /> : <Text {...mutedText}>{name}</Text>
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
        } else if (peeked?.path !== target) {
          const at = peekAt?.path === target ? peekAt : null
          peeked = await readPreview($, target, 1, at?.line)
          if (at && !at.jumped) {
            at.jumped = true
            start = peekTop = Math.max(0, at.line - 3 - (peeked.first ?? 0))
          }
        }
        const first = peeked.first ?? 0
        const lines = peeked.text.split('\n')
        const last = Math.max(0, lines.length - peekRows)
        start = Math.min(start, last)
        const markdown = /\.(md|markdown|mdx|docx|odt|rtf)$/i.test(target)
        const win = previewLines(peeked.text, start, peekRows, markdown)
        status = `${docKind === 'pdf' ? `p ${page}${docCounts.has(target) ? `/${docCounts.get(target)}` : ''} ` : ''}${peeked.text ? `${first + start + 1}–${first + Math.min(lines.length, start + peekRows)}/${first + lines.length}` : ''}`.trim()
        const size = Math.max(1, Math.round((peekRows * peekRows) / Math.max(1, lines.length)))
        const bar = lines.length > peekRows ? { pos: last ? Math.round((start / last) * (peekRows - size)) : 0, size, thumb: theme.accent, track: theme.muted } : undefined
        if (!peeked.text) overPeek = false
        content = peeked.text
          ? <Client key="peek" module="./rows.tsx" props={{ rows: [], active: '', ...rowColors, pointer, ...(bar ? { bar } : {}), preview: { text: win.text, path: target, startLine: first + win.top + 1, markdown, rows: peekRows } } satisfies RowsProps} />
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
    const park = () => focusPane($, t.root, paging ? 'rows' : 'hk-tree')
    const footerLink = footer && links.has(footer) ? linkStates.get(footer) : undefined
    if (footer && links.has(footer) && !linkStates.has(footer)) void classifyLink($, footer)
    const footerName = footer === t.root ? t.root.split('/').filter(Boolean).pop() || t.root : footer ? (inside(t.root, footer) ? footer.slice(t.root.endsWith('/') ? t.root.length : t.root.length + 1) : shortPath(footer)) : ''
    const allKeys: { key: string; label: string; act: () => void }[] = [
      { key: 'jkhl', label: 'move', act: () => undefined },
      { key: 'o', label: 'open', act: () => void navigate($, 'return') },
      { key: 'd', label: 'diff', act: () => void navigate($, 'd') },
      { key: 's', label: 'search', act: () => void navigate($, 's', false, e.surface) },
      { key: 'i', label: 'in folder', act: () => void navigate($, 'i', false, e.surface) },
      { key: 'a', label: 'auto-collapse', act: () => void navigate($, 'a', false, e.surface).then(park) },
      { key: 'z', label: 'jump', act: () => void navigate($, 'z', false, e.surface) },
      { key: 'n', label: 'sort name', act: () => void navigate($, 'n', false, e.surface).then(park) },
      { key: 'g', label: 'sort git', act: () => void navigate($, 'g', false, e.surface).then(park) },
      { key: 'm', label: 'sort value', act: () => void navigate($, 'm', false, e.surface).then(park) },
      ...(e.surface === 'desktop' ? [] : [{ key: 'p', label: 'preview', act: () => void navigate($, 'p', false, e.surface).then(park) }]),
      { key: 'y', label: 'copy path', act: () => void navigate($, 'y', false, e.surface).then(park) },
      { key: 'u', label: 'copy name', act: () => void navigate($, 'u', false, e.surface).then(park) },
      { key: 'v', label: 'mark', act: () => void navigate($, 'v', false, e.surface).then(park) },
      { key: 't', label: 'terminal', act: () => void navigate($, 't', false, e.surface) },
      { key: 'x', label: 'guard', act: () => void navigate($, 'x', false, e.surface).then(park) },
      ...(outside.length ? [{ key: 'w', label: 'outside writes', act: () => void navigate($, 'w', false, e.surface) }] : []),
      { key: 'c', label: 'match case', act: () => void navigate($, 'c', false, e.surface).then(park) },
      { key: 'r', label: 'regex', act: () => void navigate($, 'r', false, e.surface).then(park) },
      { key: 'q', label: 'contents', act: () => void navigate($, 'q', false, e.surface).then(park) },
      ...(paging ? [{ key: '[ ]', label: 'page', act: () => void (turnPage($, 1), park()) }] : []),
    ]
    const overlay = shortcutsShown && !zjump.on
    const keyRows = overlay && !desk ? shortcutRows(theme.accent, theme.muted) : []
    shortcutsPage = room
    shortcutsMax = Math.max(0, keyRows.length - room)
    shortcutsTop = Math.min(shortcutsTop, shortcutsMax)
    const deskShortcuts = () => {
      const groups = shortcutGroups(true)
      const keyCols = Math.max(...groups.flatMap(g => g.keys.map(k => k.key.length))) + 2
      return (
        <Box key="keys-panel" flexDirection="column" marginTop={1} marginX={1} paddingX={1} paddingY={1} backgroundColor={DESK.field}>
          <Box key="keys-head" flexDirection="row" alignItems="center">
            {Svg ? <Svg key="keys-panel-icon" source={iconSvg('keyboard', accentInk, 16)} alt="keyboard shortcuts" width={16} height={16} /> : null}
            <Box marginLeft={1} flexShrink={1}><Text bold>Keyboard shortcuts</Text></Box>
            <Box flexGrow={1} />
            <Button key="keys-close" plain dimColor hover={{ dimColor: false }} label="Close" onPress={() => { toggleShortcuts($, false); park() }} />
          </Box>
          {groups.map(g => (
            <Box key={`keys-${g.title}`} flexDirection="column" marginTop={1}>
              <Text key={`keys-title-${g.title}`} bold dimColor>{g.title}</Text>
              {g.keys.map(k => (
                <Box key={`keys-${g.title}-${k.key}`} flexDirection="row">
                  <Box width={keyCols} flexShrink={0}><Text mono color={accentText}>{k.key}</Text></Box>
                  <Box flexShrink={1} overflow="hidden"><Text wrap="truncate-end">{k.label}</Text></Box>
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      )
    }
    const hidden: [string, () => void][] = zjump.on ? [] : [
      ...(['j', 'k', 'h', 'l'] as const).map((k): [string, () => void] => [k, () => void navigate($, k, false, shortcutsShown || grepping ? e.surface : undefined).then(park)]),
      ...allKeys.filter(k => /^[a-z]$/.test(k.key)).map((k): [string, () => void] => [k.key, k.act]),
      ...(splitShown && e.surface !== 'desktop' ? (['f', 'b'] as const).map((k): [string, () => void] => [k, () => void navigate($, k, false, e.surface).then(park)]) : []),
    ]

    return (
      <Box flexDirection="column" minHeight={Math.max(1, e.props.scroll?.bodyRows ?? 1)} backgroundColor={theme.bg || undefined}>
        {desk && Svg ? (
          <Box key="head" flexDirection="row" alignItems="center">
            <Box flexDirection="row" alignItems="center" flexShrink={1} overflow="hidden" position="relative" backgroundColor={t.cursor === t.root ? deskSel : undefined}>
              <Svg key="root-icon" source={rowSvg(0, null, t.top === t.root ? 'folder-git' : 'folder-open', e.props.isFocused ? accentInk : mutedInk)} alt="root folder" width={STEP_PX * 2 + GAP_PX} height={ROW_PX} />
              {e.props.isFocused ? <Text bold color={accentText}>{header}</Text> : <Text {...mutedText}>{header}</Text>}
              <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                <Client key="hit:root" module="./hit.tsx" props={{ id: ROOT_PRESS, keys: false } satisfies HitProps} width="100%" height="100%" />
              </Box>
            </Box>
            <Box flexGrow={1} />
            <Box flexDirection="row" alignItems="center" flexShrink={0}>
              {toolButtons.map(button)}
            </Box>
          </Box>
        ) : (
          <Box flexDirection="row">
            <Box flexDirection="row" flexShrink={1} overflow="hidden" backgroundColor={t.cursor === t.root ? rowColors.activeBg || undefined : undefined}>
              <Button key="root" plain onPress={() => void selectRoot($).then(() => focusPane($, t.root, 'hk-tree'))}>
                <Text color={theme.accent}>{`${rootGlyph} `}</Text>
                <Text bold color={theme.accent}>{header}</Text>
              </Button>
            </Box>
            <Box flexGrow={1} />
            <Box flexDirection="row" gap={toolGap}>
              {toolButtons.map(button)}
              <Text> </Text>
            </Box>
          </Box>
        )}
        {splitAt === 'top' ? split : null}
        {branchRow()}
        {!t.top && showHints && (!hintOn ? (desk && Svg ? <Svg key="git-hint" source={rowSvg(0, null, null, mutedInk)} alt="git status" width={STEP_PX * 2 + GAP_PX} height={ROW_PX} /> : <Text key="git-hint">{' '}</Text>) : desk && Svg ? (
          <Box key="git-hint" flexDirection="row" alignItems="center">
            <Svg key="git-hint-icon" source={rowSvg(0, null, 'git-branch', mutedInk)} alt="no git repo" width={STEP_PX * 2 + GAP_PX} height={ROW_PX} />
            <Text {...mutedText}>not a Git repo</Text>
          </Box>
        ) : <Text key="git-hint" {...mutedText}>{unicode ? '± ' : '\u{ea68} '}not a Git repo</Text>)}
        {searchGap ? <Text key="gap-above"> </Text> : null}
        {desk && Svg ? (
          <Box key="search-bar" flexDirection="row" alignItems="center" backgroundColor={DESK.field} paddingX={1}>
            <Svg key="search-icon" source={iconSvg('search', mutedInk, 14)} alt="search" width={14} height={14} />
            {zjump.on ? (
              <Box key="jump-chip" flexShrink={0} flexDirection="row" marginLeft={1} paddingX={1} backgroundColor={DESK.toolOn}><Text color={accentText}>jump</Text></Box>
            ) : scopeChip()}
            <Box flexGrow={1} flexShrink={1} marginLeft={1} flexDirection="column" width={Math.max(10, e.props.bodyColumns - (t.query ? 18 : 16))}>
              {zjump.on ? <>
                <Box key="jump-up-box" height={0} overflow="hidden"><Button key="jump-up" plain label="up" onPress={() => void jumpKey($, 'up')} /></Box>
                <Input key="jump" autoFocus placeholder="folder name…" value={zjump.query} onInput={(v: string) => void jumpInput($, v)} onSubmit={() => void jumpKey($, 'return')} />
                <Box key="jump-down-box" height={0} overflow="hidden"><Button key="jump-down" plain label="down" onPress={() => void jumpKey($, 'down')} /></Box>
              </> : <Input
                key="q"
                placeholder={t.searchContent ? 'Search file contents...' : 'Search files...'}
                value={t.query}
                onInput={onQuery}
                onSubmit={(v: string) => void jump($, v, e.surface).then(() => $.clock.after(100, park))}
              />}
            </Box>
            {t.query ? <Button key="clear" plain dimColor label="×" onPress={() => void search($, '')} /> : null}
            <Box flexShrink={0} flexDirection="row" gap={2} marginLeft={1} marginRight={1}>
              {toggle('case', 'Aa', Boolean(t.searchCase), false)}
              {toggle('regex', '.*', Boolean(t.searchRegex), badPattern(t.query, Boolean(t.searchRegex)))}
              {toggle('content', 'contents', Boolean(t.searchContent), false)}
            </Box>
          </Box>
        ) : (
          <Box flexDirection="row" width={e.props.bodyColumns} backgroundColor={searchBg}>
            {glyphSetting === 'text' ? null : <Text {...mutedText}>{unicode ? '⌕ ' : '\u{ea6d} '}</Text>}
            {zjump.on ? <Text key="jump-chip" color={theme.accent} bold>{'jump '}</Text> : scopeChip()}
            <Box flexGrow={1}>
              {zjump.on ? <>
                <Box key="jump-up-box" height={0} overflow="hidden"><Button key="jump-up" plain label="up" onPress={() => void jumpKey($, 'up')} /></Box>
                <Input key="jump" autoFocus placeholder="folder name…" value={zjump.query} onInput={(v: string) => void jumpInput($, v)} onSubmit={() => void jumpKey($, 'return')} />
                <Box key="jump-down-box" height={0} overflow="hidden"><Button key="jump-down" plain label="down" onPress={() => void jumpKey($, 'down')} /></Box>
              </> : <Input
                key="q"
                placeholder={t.searchContent ? 'search contents' : 'search'}
                submitLabel="go"
                value={t.query}
                onInput={onQuery}
                onSubmit={(v: string) => void jump($, v, e.surface).then(() => $.clock.after(100, park))}
              />}
            </Box>
            {t.query ? <Button key="clear" plain dimColor label={unicode ? '×' : '\u{ea76}'} onPress={() => void search($, '')} /> : null}
            <Box flexShrink={0} flexDirection="row" gap={1} marginLeft={1}>
              {toggle('case', 'Aa', Boolean(t.searchCase), false)}
              {toggle('regex', '.*', Boolean(t.searchRegex), badPattern(t.query, Boolean(t.searchRegex)))}
              {toggle('content', glyphSetting === 'text' ? 'in' : unicode ? '≡' : '\u{f09aa}', Boolean(t.searchContent), false)}
              <Text> </Text>
            </Box>
          </Box>
        )}
        {sortHeader ? headerRow() : null}{sortHeader ? headerRule() : searchGap ? <Text key="gap-below"> </Text> : null}
        {desk ? (overlay ? deskShortcuts() : deskTree()) : (
          <Client
            key="rows"
            module="./rows.tsx"
            props={overlay ? { rows: keyRows.slice(shortcutsTop, shortcutsTop + room), active: '', ...rowColors, pointer } satisfies RowsProps : { rows: specs, active: zjump.on ? (zjump.rows[zjump.sel] ?? "") : grepping ? (grep.rows[grep.sel] ? grepId(grep.rows[grep.sel] as GrepHit) : '') : t.cursor, ...rowColors, pointer, ...(bar ? { bar } : {}) } satisfies RowsProps}
          />
        )}
        <Box flexGrow={1} />
        {splitAt === 'bottom' ? split : null}
        {latest ? (
          <Box key="activity" flexDirection="row" height={1} overflow="hidden">
            <Box flexGrow={1} />
            {chip(latest)}
          </Box>
        ) : null}
        {(footer || tipText || shortcutsSetting === 'auto') && (
          <Box flexDirection="row" height={1} overflow="hidden">
            {shortcutsSetting === 'auto' ? (
              desk && Svg ? (
                <Box key="keys" flexShrink={0} flexDirection="row" alignItems="center">
                  <Svg key="keys-icon" source={rowSvg(0, null, 'keyboard', mutedInk)} alt="keyboard shortcuts" width={STEP_PX * 2 + GAP_PX} height={ROW_PX} />
                  <Button key="nav-help" plain dimColor hover={{ dimColor: false }} label="Shortcuts" onPress={() => { toggleShortcuts($); park() }} />
                </Box>
              ) : (
                <Box flexShrink={0}>
                  <Button key="nav-help" plain dimColor label="?: shortcuts" onPress={() => { toggleShortcuts($); park() }}><Text color={theme.accent}>?</Text>: shortcuts</Button>
                </Box>
              )
            ) : null}
            <Box flexGrow={1} />
            {tipText && !desk ? (
              <Box flexShrink={1} marginLeft={2}>
                <Text {...tipProps} wrap="truncate-end">{tipText}</Text>
              </Box>
            ) : null}
            {marks.length > 0 && !tipText ? <Box key="marked" flexShrink={0} marginLeft={2}><Button key="marked-clear" plain label={`${marks.length} marked`} onPress={() => { clearMarks($); park() }}><Text color={desk ? accentInk : theme.accent}>{`${marks.length} marked`}</Text></Button></Box> : null}
            {footerName && (desk || !tipText) ? (
              <Box flexShrink={1} marginLeft={2}>
                <Text {...mutedText} wrap="truncate-start">{footer && links.has(footer) ? footerName + linkNote(footerLink) : footerName}</Text>
              </Box>
            ) : null}
            {footerName && (desk || !tipText) ? (
              desk && Svg
                ? <Box key="cursor" flexShrink={0} flexDirection="row" alignItems="center" marginLeft={1}><Svg key="cursor-icon" source={iconSvg('cursor', mutedInk, 14)} alt="cursor" width={14} height={14} /></Box>
                : <Box key="cursor" flexShrink={0}><Text {...mutedText}>{unicode ? ' ↖' : ' \u{f01bf}'}</Text></Box>
            ) : null}
          </Box>
        )}
        <Box key="hotkeys" height={0} overflow="hidden" flexDirection="row">
          <Button key="hk-tree" plain autoFocus label="o" onPress={() => void navigate($, 'return')} />
          {hidden.map(([k, act]) => <Button key={`hk-${k}`} plain hotkey={k} label={k} onPress={act} />)}
        </Box>
      </Box>
    )
  })
}
