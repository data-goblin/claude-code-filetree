import type { EngineInterface, Register, RenderElement, RenderSurface, Timer } from 'claude-code'
import { herdrError, herdrOpenCommand, herdrPane, herdrSplit, isBinaryPath, LINUX_LAUNCH, openCommand, openWithCommand, terminalTarget, tmuxCommand, tmuxOpenCommand } from './open'
import type { ButtonProps } from './button'
import { bindKeys } from './keybind'
import { CLEAN, fitCells, pictureKind, picture, pngOf } from './peek'

import type { Activity, FileNode, FileTree, Theme } from '../types'
import { BRANCH_ICON, gitActions, LIGHT_TONES, readOnly, readTargets, resolve, TONES } from './git'
import type { RowSpec, RowsProps, Seg } from './rows'
import { diffGroups, diffWindow, GROUP } from './diff'
import { jumpKey, jumpOpen, jumpClose, jumpTo, jumpBlurCancel, jumpInput } from './jump'
import { shellPaths, shellWrites, noteWork, considerWork } from './work'
import { counted, formatLoc, locArgv, locUsage, parseLocIn } from './loc'
import { draw, layout, layoutPixels, parseDu, REST, type Tile, type Usage } from './treemap'
import { boxLook, fitPixels, inkOn, over, paint, type PixelLook, png, readable, type Rgb, rgbOf, textHeight } from './pixmap'
import { colorOf, narrowEmoji, finePointerOk, cellPixels, ghosttyColors, fontState, NERD_PROBE } from './term'
import type { ZoneProps } from './zone'
import type { HitProps } from './hit'
import { fileRefs, markdownSplit, refHref, refsIn, openRef } from './refs'
import { activityIcon, barSvg, lineSvg, selectionOn, DESK, DESK_GIT, DESK_GIT_TEXT, GAP_PX, iconSvg, type IconName, ink, lighten, nodeIcon, ROW_PX, rowSvg, STEP_PX, toolSvg } from './svg'
import { ADD_COLOR, DEL_COLOR, JUMP_COLOR, parsePalette } from './palette'
import { BRAIN, CHEVRON_CLOSED, CHEVRON_OPEN, fileIcon, GIT_COLOR, GUARD, isMemory } from './icons'
import { allGuards, GUARD_TOOLS, guardIn, guardOver, outsideOf, parseGuards, toggled } from './guard'
import {
  age,
  ancestorsOf,
  DEFAULT_THEME,
  dirname,
  emptyTree,
  formatSize,
  humanSize,
  badPattern,
  inside,
  join,
  matchSpans,
  highlight,
  posix,
  relative,
  dropBelow,
  useDrives,
  stamp,
  dateFormat,
  clockSetting,
  underAny,
} from './tree'
import { SCROLL_KEYS, shortcutGroups, shortcutRows } from './keys'
import { settings, machine, tree, vcs, flashing, marking, ui, previewing, pics, working, linking, guarding, mapping, metrics, grep, zjump } from './state'
import { PANE, BRANCH_ROW, OUTSIDE, DOUBLE_MS, SPIN_MS, ROOT_PRESS } from './consts'
import { exists, shortPath, osName, stopStream, cwdOf, has, messageOf, focusPane, strings, faint, toHex, clean, weigh } from './util'
import { get, patch, setActivities, saveShimmer, activities, readConfig, SHIMMER_KEY } from './store'
import { isIgnored, loadDirs, pruneArgs, realOf, revealPaths, watchTree, sinceNow } from './listing'
import { type Job, detectRepo, refreshGit, gitChanged, headOf, type Pending, startGit, finishGit, failAll, bashOutputOf, outcomes, proven, sync, settleBackground, ACTIVITY_TTL_MS } from './gitstate'
import { staleSizes, takeLoc, walkSize, wantTimes, wantSizes, wantCounts, wantLoc } from './sizes'
import { claimMarks, autoCollapseOn, armCollapse, scheduleScan, touched, reveal } from './activity'
import { reset, followCwd, settleRoot } from './root'
import { picks, copyPaths, markRow, anchorAt, addMarks, clearMarks, copyPath, pickOnly, markRange, pickRow } from './select'
import { classifyLink, linkNote } from './links'
import { scopeSearch, searchFlag, search, jump } from './search'
import { openHit, grepOn, grepNav, grepAct, grepId, grepKey, grepRun, GREP_LIMIT, type GrepHit } from './grep'
import { isGhost, rowsOf, sortBy, ghostsOf } from './order'
import { showPreview, diffFile, peekTarget, toggleSplit, turnPage, scrollSplit, loadPreview, parkPreview, closePreview, editPreview, jumpDiff, scrollPreview, previewLines, readPreview } from './preview'

const TREE = { plugin: 'filetree', key: 'tree' } as const
const JUMP_BLUR_MS = 400
const SHIMMER = Object.fromEntries(Object.entries(TONES).map(([k, v]) => [k, { bright: v.bright, dim: v.dim }]))
const LIGHT_SHIMMER = Object.fromEntries(Object.entries(LIGHT_TONES).map(([k, v]) => [k, { bright: v.bright, dim: v.dim }]))
const RUNNING_MAX_MS = 600_000
const IMAGE_BYTES = 2_097_152
const ROWS_BUDGET = 80_000
const DESK_ROWS = 150
const DESK_PAGE_CHARS = 200_000
const DESK_ROW_PAGE = 1_000
const DESK_TREE_CHARS = 180_000
const DESK_TREE_NODES = 1_400
const DESK_SHIMMER_MAX = 4
const NAME_MIN = 10
const COLS = ['+', '-', '?', 'M', 'D', 'metric'] as const
const GIT_COLS = ['+', '-', '?', 'M', 'D'] as const
type Col = (typeof COLS)[number]
const DESK_ICON_COLS = 3
const HINT_MS = 5_000
const TOGGLES = ['cwd', 'hidden', 'size', 'split', 'autocollapse', 'shimmer']
const DESK_ROW_CHARS = 40
const EXPAND_MAX = 150
const GIT_POLL_MS = 2000
const AGE_TICK_MS = 60_000
const GUARDS = 'guards'

let gitPoll: Timer | null = null
let ageTick: Timer | null = null
const WORDS: Record<string, string> = { up: 'up', cwd: 'cwd', refresh: 'sync', hidden: 'dots', size: 'size', collapse: 'fold', autocollapse: 'auto', split: 'split', unselect: 'clear' }
let deskKeysAt = 0
export type Column = FileTree['column']

export type Scan = { dir: string; loc: boolean; items: Usage[]; total: number; done: boolean; stale: boolean; stopped: boolean; stop: () => void }
const SCAN_KEEP = 24
const SCAN_DRAW_MS = 100
const STALE_MS = 1500
const staleQueue = new Set<string>()
let staleTimer: Timer | null = null

const DU_DARWIN_SH = 'du -kxH -d 2 -- "$1"; find -x "$1" -mindepth 1 -maxdepth 2 -type f -exec du -kH -- {} +'

function headerMessage(data: unknown): { over: unknown; press: unknown } {
  return { over: has(data, 'over') ? data.over : undefined, press: has(data, 'press') ? data.press : undefined }
}

function peekMessage(data: unknown): { key: unknown; over: unknown; scrollTo: unknown } {
  return { key: has(data, 'key') ? data.key : undefined, over: has(data, 'over') ? data.over : undefined, scrollTo: has(data, 'scrollTo') ? data.scrollTo : undefined }
}

function rowsMessage(data: unknown): { press: unknown; key: unknown; ctrl: unknown; alt: unknown; shift: unknown; scrollTo: unknown; copy: unknown } {
  const at = <K extends string>(key: K): unknown => (has(data, key) ? data[key] : undefined)
  return { press: at('press'), key: at('key'), ctrl: at('ctrl'), alt: at('alt'), shift: at('shift'), scrollTo: at('scrollTo'), copy: at('copy') }
}

function stopScans(keep = ''): void {
  for (const scan of mapping.scans.values()) {
    if (scan.done || scan.dir === keep) continue
    scan.stopped = true
    scan.stop()
    mapping.scans.delete(`${scan.loc ? 'loc:' : ''}${scan.dir}`)
  }
}

function usageOf($: EngineInterface, dir: string, loc: boolean): Scan {
  const key = `${loc ? 'loc:' : ''}${dir}`
  const known = mapping.scans.get(key)
  if (known && (!known.stale || !known.done)) {
    mapping.scans.delete(key)
    mapping.scans.set(key, known)
    return known
  }
  const scan: Scan = { dir, loc, items: known?.items ?? [], total: known?.total ?? 0, done: false, stale: false, stopped: false, stop: () => undefined }
  mapping.scans.delete(key)
  mapping.scans.set(key, scan)
  for (const [old, s] of mapping.scans) if (mapping.scans.size > SCAN_KEEP && s.done) mapping.scans.delete(old)
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
      if (mapping.scans.get(key) === scan) mapping.scans.delete(key)
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
  mapping.mapLock = { anchor: dirname(anchor), pick: anchor, cursor: t.cursor }
  void $.ui.invalidate('ui.render')
}

export function markStale($: EngineInterface, paths: string[]): void {
  for (const p of paths) staleQueue.add(posix(p))
  if (staleTimer) return
  staleTimer = $.clock.after(STALE_MS, () => {
    staleTimer = null
    const hit = [...staleQueue]
    staleQueue.clear()
    let any = false
    for (const scan of mapping.scans.values()) {
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
  const isDouble = ui.lastPress.key === `tile:${id}` && now - ui.lastPress.at < DOUBLE_MS
  ui.lastPress = { key: isDouble ? '' : `tile:${id}`, at: now }
  const t = await get($)
  const kind = t.nodes.find(n => n.id === id)?.kind ?? (await $.fs.stat(id).then(s => s.kind, () => 'file'))
  if (isDouble && kind === 'dir') {
    drillTile($, id, t.cursor)
    return
  }
  const shows = inside(t.root, id) && !isIgnored(t.root, id) && (t.showHidden || !id.slice(id.lastIndexOf('/') + 1).startsWith('.'))
  mapping.mapLock = { anchor: mapping.mapAnchor, pick: id, cursor: shows ? id : t.cursor }
  if (!shows) {
    void $.ui.invalidate('ui.render')
    return
  }
  await patch($, cur => ({ expanded: [...new Set([...cur.expanded, ...ancestorsOf(id, cur.root)])], cursor: id, selected: id, scroll: null }))
  await revealPaths($, [id])
}

function drillTile($: EngineInterface, id: string, cursor: string): void {
  mapping.mapLock = { anchor: id, pick: '', cursor }
  void $.ui.invalidate('ui.render')
}

async function mapKey($: EngineInterface, key: string): Promise<boolean> {
  const t = await get($)
  if (!mapping.mapLock || mapping.mapLock.cursor !== t.cursor || !mapping.mapLock.pick || (key !== 'return' && key !== 'l' && key !== 'right')) return false
  const pick = mapping.mapLock.pick
  const kind = t.nodes.find(n => n.id === pick)?.kind ?? (await $.fs.stat(pick).then(s => s.kind, () => 'file'))
  if (kind !== 'dir') return false
  drillTile($, pick, t.cursor)
  return true
}

function toggleShortcuts($: EngineInterface, open = !ui.shortcutsShown): void {
  ui.shortcutsShown = open
  ui.shortcutsTop = 0
  deskKeysAt = 0
  void $.ui.invalidate('ui.render')
}

function scrollShortcuts($: EngineInterface, by: number): void {
  const top = Math.max(0, Math.min(ui.shortcutsMax, ui.shortcutsTop + by))
  if (top === ui.shortcutsTop) return
  ui.shortcutsTop = top
  void $.ui.invalidate('ui.render')
}

function shortcutKey($: EngineInterface, key: string, surface?: RenderSurface): boolean {
  if (key === '?') {
    toggleShortcuts($)
    return true
  }
  if (!ui.shortcutsShown) return false
  if (SCROLL_KEYS.has(key)) {
    const page = Math.max(1, ui.shortcutsPage - 1)
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

export async function openFile($: EngineInterface, path: string, how: { mode?: string; line?: number } = {}): Promise<void> {
  const chosen = (how.mode ?? settings.openWithSetting).trim()
  const mode = how.mode === undefined && settings.binariesInDefaultApp && chosen !== 'preview' && isBinaryPath(path) ? '' : chosen
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
    const { argv, init } = editor ? tmuxOpenCommand(editor, path, how.line, settings.targetSetting) : custom ? { argv: os === 'linux' ? ['sh', '-c', LINUX_LAUNCH, 'sh', ...custom] : custom, init: { timeoutMs: 10_000 } } : openCommand(os, path)
    const run = await $.process.run(argv, init)
    if (run.exitCode !== 0) $.ui.toast(`could not open ${path} with ${editor ?? custom?.[0] ?? argv[0]}: ${run.stderr.trim().split('\n')[0] || `exit ${run.exitCode}`}`)
  } catch {
    $.ui.toast(`could not open ${path} with ${editor ?? custom?.[0] ?? 'the default app'}`)
  }
}

export async function editorHost($: EngineInterface, os: 'linux' | 'darwin' | 'win32'): Promise<'tmux' | 'herdr' | ''> {
  if (os === 'win32') return ''
  if (await $.env.get('TMUX')) return 'tmux'
  return (await $.env.get('HERDR_ENV')) ? 'herdr' : ''
}

export async function openInHerdr($: EngineInterface, editor: string, path: string, line?: number): Promise<void> {
  const { split, run, init } = herdrOpenCommand((await $.env.get('HERDR_BIN_PATH')) || 'herdr', editor, path, line, settings.targetSetting, (await $.env.get('HERDR_WORKSPACE_ID')) || '')
  const made = await $.process.run(split, init)
  const sent = made.exitCode === 0 ? await $.process.run(run(herdrPane(made.stdout)), init) : made
  if (sent.exitCode !== 0) $.ui.toast(`could not open ${path} with ${editor}: ${herdrError(sent.stderr) || `exit ${sent.exitCode}`}`)
}

export async function openTerminal($: EngineInterface, dir: string): Promise<void> {
  const host = await editorHost($, await osName($))
  if (!host) {
    $.ui.toast('t opens a shell in a new tmux or herdr pane; run Claude Code inside tmux or herdr to use it')
    return
  }
  try {
    const argv = host === 'tmux' ? tmuxCommand(settings.targetSetting, dir, [(await $.env.get('SHELL')) || 'sh']) : herdrSplit((await $.env.get('HERDR_BIN_PATH')) || 'herdr', dir, settings.targetSetting, (await $.env.get('HERDR_WORKSPACE_ID')) || '')
    const run = await $.process.run(argv, { timeoutMs: 10_000 })
    if (run.exitCode !== 0) $.ui.toast(`could not open a terminal in ${shortPath(dir)}: ${(host === 'herdr' ? herdrError(run.stderr) : run.stderr.trim().split('\n')[0]) || `exit ${run.exitCode}`}`)
  } catch (err) {
    $.ui.toast(`could not open a terminal in ${shortPath(dir)}: ${messageOf(err).split('\n')[0]}`)
  }
}

async function quickLook($: EngineInterface, path: string): Promise<void> {
  try {
    await $.process.run(['sh', '-c', '(nohup qlmanage -p "$1" >/dev/null 2>&1 &); sleep 0.4; osascript -e \'tell application "System Events" to set frontmost of first process whose name is "qlmanage" to true\' >/dev/null 2>&1 || true', 'sh', path], { timeoutMs: 10_000 })
  } catch {
    $.ui.toast(`could not preview ${path} with Quick Look`)
  }
}

async function toggle($: EngineInterface, n: FileNode): Promise<void> {
  flashing.autoOpened.delete(n.id)
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
  for (const d of open) flashing.autoOpened.delete(d)
  await patch($, t => ({ expanded: [...new Set([...t.expanded, ...open])] }))
  void watchTree($)
}

async function press($: EngineInterface, n: FileNode): Promise<void> {
  const now = await $.clock.now()
  const isDouble = ui.lastPress.key === n.id && now - ui.lastPress.at < DOUBLE_MS
  ui.lastPress = { key: isDouble ? '' : n.id, at: now }
  if (!isDouble) {
    await toggle($, n)
    return
  }
  await openNode($, n)
}

async function openNode($: EngineInterface, n: FileNode): Promise<void> {
  if (isGhost(await get($), n.id)) await diffFile($, n.id)
  else if (n.kind === 'dir') {
    tree.follow = false
    await reset($, n.id)
  } else await openFile($, n.id)
}

async function navigate($: EngineInterface, key: string, shift = false, surface?: RenderSurface): Promise<void> {
  if (zjump.on) return jumpKey($, shift && [...key].length === 1 ? key.toUpperCase() : key)
  if (shortcutKey($, key, surface)) return
  if (key === 'z') return jumpOpen($)
  if (grepOn(await get($)) && ((await grepNav($, key, surface)) || (await grepAct($, key, shift, surface)))) return
  await steer($, key, shift, surface)
  if (flashing.autoOpened.size) claimMarks((await get($)).cursor)
}

async function steer($: EngineInterface, key: string, shift = false, surface?: RenderSurface): Promise<void> {
  const t = await get($)
  const rows = rowsOf(t)
  const at = rows.findIndex(r => r.node.id === t.cursor)
  const cur = rows[at]?.node
  const picked = picks(t).ids
  const onRoot = Boolean(t.root) && t.cursor === t.root
  const move = (d: number) => {
    const top = surface === 'desktop' && rows.length ? 0 : -1
    const to = onRoot ? (d < 0 ? top : Math.min(rows.length - 1, d - 1)) : at === 0 && d === -1 ? top : Math.max(0, Math.min(rows.length - 1, (at < 0 ? 0 : at) + d))
    const id = to < 0 ? t.root : rows[to]?.node.id
    if (!id) return Promise.resolve()
    anchorAt(id)
    return patch($, () => ({ cursor: id, selected: id, scroll: null }))
  }
  const page = Math.max(1, previewing.peekRows - 1)
  const peek: Record<string, number> = { f: page, b: -page, pageup: -page, pagedown: page }
  if (key === 'p' && surface !== 'desktop' && t.split && mapping.mapLock?.cursor === t.cursor && mapping.mapLock.pick === t.cursor && peekTarget(t)) {
    mapping.mapLock = null
    void $.ui.invalidate('ui.render')
  } else if (key === 'p' && surface !== 'desktop') await toggleSplit($)
  else if (t.split && previewing.splitShown && surface !== 'desktop' && (key === '[' || key === ']') && turnPage($, key === ']' ? 1 : -1)) return
  else if (t.split && previewing.splitShown && surface !== 'desktop' && key in peek) scrollSplit($, previewing.peekTop + (peek[key] ?? 0))
  else if ((shift && ['up', 'k', 'down', 'j'].includes(key)) || key === 'J' || key === 'K') {
    if (cur) addMarks($, [cur.id])
    await move(key === 'up' || key === 'k' || key === 'K' ? -1 : 1)
    const next = (await get($)).cursor
    if (next && next !== t.root) addMarks($, [next])
    if (next) anchorAt(next)
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
  else if (cur && key === 'v') await markRow($, cur.id)
  else if (key === 't') await openTerminal($, cur ? (cur.kind === 'dir' ? cur.id : cur.parent) : t.root)
  else if (picked.length && (key === 'y' || key === 'Y')) await copyPaths($, picked, key === 'Y' || shift ? 'absolute' : 'relative', surface)
  else if (picked.length && key === 'u') await copyPaths($, picked, 'name', surface)
  else if (cur && (key === 'right' || key === 'l') && cur.kind === 'dir' && !t.expanded.includes(cur.id)) await toggle($, cur)
  else if (cur && (key === 'left' || key === 'h')) {
    if (cur.kind === 'dir' && t.expanded.includes(cur.id)) await toggle($, cur)
    else if (cur.parent !== t.root) {
      anchorAt(cur.parent)
      await patch($, () => ({ cursor: cur.parent, selected: cur.parent }))
    }
  } else if (cur && (key === 'return' || key === 'o')) await (cur.kind !== 'dir' ? openNode($, cur) : toggle($, cur))
  else if (cur && (key === ' ' || key === 'space') && isGhost(t, cur.id)) await diffFile($, cur.id)
  else if (cur && (key === ' ' || key === 'space')) await (cur.kind !== 'dir' && (await osName($)) === 'darwin' ? quickLook($, cur.id) : toggle($, cur))
}

async function pressHeader($: EngineInterface, id: string): Promise<void> {
  const t = await get($)
  if (id === 'up') {
    tree.follow = false
    await reset($, dirname(t.root))
  } else if (id === 'cwd') {
    tree.follow = true
    await reset($, await cwdOf($))
  } else if (id === 'refresh') {
    const spin = ++ui.reloading
    const began = await $.clock.now()
    void $.ui.invalidate('ui.render')
    try {
      tree.searchIndex = null
      for (const scan of mapping.scans.values()) scan.stale = true
      await staleSizes($)
      await loadDirs($, [t.root, ...t.expanded])
      await detectRepo($)
      await refreshGit($)
      if (t.query.trim()) await search($, t.query)
    } finally {
      const took = (await $.clock.now()) - began
      const left = Math.max(1, Math.ceil(took / SPIN_MS)) * SPIN_MS - took
      const settle = () => {
        if (spin !== ui.reloading) return
        ui.reloading = 0
        ui.reloadSpin += 1
        void $.ui.invalidate('ui.render')
      }
      if (left > 0) $.clock.after(left, settle)
      else settle()
    }
  } else if (id === 'hidden') await patch($, cur => ({ showHidden: !cur.showHidden }))
  else if (id === 'size') await patch($, cur => ({ column: cur.column === 'date' ? 'size' : cur.column === 'size' ? 'loc' : cur.column === 'loc' ? 'files' : 'date' }))
  else if (id === 'collapse' && !(await get($)).expanded.length) await expandAll($)
  else if (id === 'collapse') await patch($, cur => ({ expanded: [], nodes: dropBelow(cur.nodes, cur.nodes.filter(x => x.parent === cur.root && x.kind === 'dir').map(x => x.id)) }))
  else if (id === 'unselect') {
    marking.marks = []
    marking.markBase = []
    marking.markAnchor = ''
    await patch($, () => ({ selected: '', cursor: '' }))
  }
  else if (id === 'external' && t.preview) await openFile($, t.preview, { mode: '' })
  else if (id === 'split') await toggleSplit($)
  else if (id === 'shimmer') {
    const lit = !settings.shimmerOn
    settings.shimmerOn = lit
    void $.ui.invalidate('ui.render')
    const deny = await saveShimmer($, lit)
    if (deny) {
      settings.shimmerOn = !lit
      void $.ui.invalidate('ui.render')
      $.ui.toast(`Activity shimmer stays ${settings.shimmerOn ? 'on' : 'off'}: ${deny}`)
    }
  }
  else if (id === 'outside') await showOutside($)
  else if (id === 'autocollapse') {
    await patch($, cur => ({ autoCollapse: !autoCollapseOn(cur) }))
    if (autoCollapseOn(await get($))) {
      const open = new Set((await get($)).expanded)
      for (const d of [...flashing.autoOpened.keys()]) if (!open.has(d)) flashing.autoOpened.delete(d)
      armCollapse($)
    } else {
      flashing.collapseTimer?.cancel()
      flashing.collapseTimer = null
      flashing.collapseAt = 0
    }
  }
  else if (previewing.previewActs.has(id) && id !== 'external') previewing.previewActs.get(id)?.()
  else if (id === 'scope') await scopeSearch($, '')
  else if (id === 'sort-name') await sortBy($, 'name')
  else if (id === 'sort-git') await sortBy($, 'git')
  else if (id === 'sort-metric') await sortBy($, 'metric')
  else if (id === 'case') await searchFlag($, 'searchCase')
  else if (id === 'regex') await searchFlag($, 'searchRegex')
  else if (id === 'content') await searchFlag($, 'searchContent')
}

function loadGuards($: EngineInterface): Promise<void> {
  guarding.guardsLoaded ??= $.store.get(GUARDS).then(v => {
    guarding.guards = parseGuards(v)
  }, () => undefined)
  return guarding.guardsLoaded
}

export async function toggleGuard($: EngineInterface, path: string): Promise<void> {
  await loadGuards($)
  const t = await get($)
  const over = guardOver(allGuards(guarding.guards), path)
  if (over && over !== path) {
    $.ui.toast(`${shortPath(path)} is already guarded by ${shortPath(over)}`)
    return
  }
  const owner = over === path ? Object.keys(guarding.guards).find(k => guarding.guards[k]?.includes(path)) : undefined
  const key = owner ?? (t.top && inside(t.top, path) ? t.top : t.root)
  const own = toggled(guarding.guards[key] ?? [], path)
  const next = { ...guarding.guards }
  if (own.length) next[key] = own
  else delete next[key]
  guarding.guards = next
  void $.ui.invalidate('ui.render')
  await $.store.set(GUARDS, guarding.guards)
}

async function guardFor($: EngineInterface, path: string): Promise<string | undefined> {
  const list = allGuards(guarding.guards)
  const hit = guardOver(list, path)
  if (hit) return hit
  const real = await realOf($, path)
  for (const g of list) if (inside(g, real) || inside(await realOf($, g), real)) return g
  return undefined
}

async function noteOutside($: EngineInterface, file: string): Promise<void> {
  const t = await get($)
  const abs = resolve(await cwdOf($), posix(file), machine.home)
  if (!outsideOf(t.top || t.root, abs) || guarding.outside.includes(abs)) return
  guarding.outside = [...guarding.outside, abs]
  if (guarding.outside.length === 1) $.ui.toast(`Claude wrote outside ${shortPath(t.top || t.root)}: ${shortPath(abs)}. w lists these writes.`)
  if (previewing.previewed?.path === OUTSIDE) previewing.previewed = null
  void $.ui.invalidate('ui.render')
}

async function showOutside($: EngineInterface): Promise<void> {
  if (!guarding.outside.length) return
  await loadPreview($, OUTSIDE)
  await patch($, () => ({ preview: OUTSIDE, previewTop: 0 }))
  $.clock.after(100, () => parkPreview($))
}

async function selectRoot($: EngineInterface): Promise<void> {
  mapping.mapLock = null
  await patch($, cur => ({ cursor: cur.root, selected: cur.root, scroll: null }))
}

export const register: Register = (on, options) => {
  settings.glyphSetting = typeof options?.glyphs === 'string' ? options.glyphs : 'auto'
  settings.shimmerOn = options?.shimmer !== 'off'
  const activity = typeof options?.activity === 'string' ? options.activity : 'reads and writes'
  settings.showReads = activity.includes('reads')
  settings.showWrites = activity.includes('writes')
  settings.followClaude = options?.follow !== 'off'
  settings.followWork = options?.work !== 'off'
  settings.columnDefault = options?.column === 'size' || options?.column === 'loc' || options?.column === 'files' ? options.column : 'date'
  settings.showAge = options?.column === 'age'
  settings.dateSetting = dateFormat(options?.dates)
  settings.clock = clockSetting(options?.clock)
  settings.showHints = options?.hints !== 'off'
  settings.showRemote = options?.remote === 'on'
  settings.focusOnOpen = options?.focus !== 'off'
  settings.ignoreNames = typeof options?.ignore === 'string' ? options.ignore.split(/[\s,]+/).filter(Boolean) : []
  settings.searchGap = options?.spacing !== 'off'
  settings.sortHeader = options?.headers !== 'off'
  settings.longFile = options?.long === 'off' ? 0 : typeof options?.long === 'string' && /^\d+$/.test(options.long.trim()) ? Number(options.long.trim()) : 500
  settings.autoCollapseDefault = options?.collapse === 'on'
  settings.shortcutsSetting = options?.shortcuts === 'always' || options?.shortcuts === 'off' ? options.shortcuts : 'auto'
  ui.shortcutsShown = settings.shortcutsSetting === 'always'
  settings.treemapSetting = options?.treemap === 'image' || options?.treemap === 'cells' || options?.treemap === 'off' ? options.treemap : 'auto'
  settings.openWithSetting = typeof options?.open === 'string' ? options.open : ''
  settings.binariesInDefaultApp = options?.binaries === 'default app'
  settings.editWithSetting = typeof options?.edit === 'string' ? options.edit.trim() : ''
  settings.palette = parsePalette(options?.palette)
  settings.diffWithSetting = typeof options?.diff === 'string' ? options.diff.trim() : ''
  settings.groupSetting = diffGroups(options?.groups)
  settings.targetSetting = terminalTarget(options?.target)
  settings.noDock = options?.start === 'off'
  settings.splitAt = options?.split === 'top' ? 'top' : 'bottom'
  settings.jumpMovesClaude = options?.jump !== 'tree'
  on('session.start', async ($, e, next) => {
    guarding.outside = []
    working.workTouches = []
    working.workLast = 0
    guarding.guardsLoaded = null
    void loadGuards($)
    tree.cached ??= { ...emptyTree(''), ...(await $.state.get(TREE)).value }
    await $.command.register({ name: 'filetree', description: 'Show or hide the file tree; args: [path | open | keys] (no path = cwd, open = never hide, keys = bind alt+l / alt+h to move the keys to and from the tree)', immediate: true })
    if (settings.palette.unknown.length) void $.ui.toast(`filetree palette: ignored ${settings.palette.unknown.join(' ')}; use key=#hex with fg, bg, accent, muted, urgent, selection, hover, jump, added, modified, renamed, add or del`)
    const windows = (await $.env.get('OS')) === 'Windows_NT'
    useDrives(windows)
    machine.inTmux = !windows && Boolean(await $.env.get('TMUX'))
    machine.inHerdr = !windows && Boolean(await $.env.get('HERDR_ENV'))
    pics.pictureSession = (await $.session.id()).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64) || 'session'
    pics.pictureBase = ((await $.env.get('XDG_RUNTIME_DIR')) || (await $.env.get('TMPDIR')) || '/tmp').replace(/\/+$/, '') || '/'
    machine.home = posix(((await $.env.get('HOME')) || (await $.env.get('USERPROFILE')) || '').replace(/[\\/]+$/, ''))
    vcs.activityId = Math.max(vcs.activityId, ...(await activities($)).map(a => a.id))
    void (async () => {
      const ready = (async () => {
        machine.pointer = await finePointerOk($)
        const termProgram = await $.env.get('TERM_PROGRAM')
        machine.kittyTerm = !windows && !machine.inTmux && !machine.inHerdr && (termProgram === 'ghostty' || Boolean(await $.env.get('KITTY_WINDOW_ID')) || /kitty|ghostty/.test((await $.env.get('TERM')) ?? ''))
        if (settings.treemapSetting === 'image' || (settings.treemapSetting === 'auto' && machine.kittyTerm)) {
          machine.cellPx = await cellPixels($)
          if (termProgram === 'ghostty') machine.termColors = await ghosttyColors($)
        }
        try {
          const remote = Boolean((await $.env.get('SSH_CONNECTION')) || (await $.env.get('SSH_TTY')))
          machine.noNerd = !remote && (windows || (await fontState($, NERD_PROBE)) !== 'ok')
        } catch {
          machine.noNerd = true
        }
        await readConfig($).catch(() => undefined)
      })()
      const t = await get($)
      if (t.flashOn) await patch($, () => ({ flash: [], flashDim: [], flashOn: false, flashTones: {} }))
      if (t.preview) await patch($, () => ({ preview: '', previewTop: 0 }))
      await setActivities($, cur => cur.map(a => (a.state === 'running' ? { ...a, state: 'failed', label: `${a.kind} interrupted` } : a)))
      const cwd = await cwdOf($)
      const shown = !t.root || t.nodes.length === 0 || (tree.follow && t.root !== cwd) ? reset($, cwd, false, ready) : ready.then(() => (settings.noDock ? undefined : $.ui.open({ id: PANE, title: `Files: ${t.root.split('/').pop() || t.root}` })))
      await ready
      ageTick?.cancel()
      ageTick = settings.showAge ? $.clock.every(AGE_TICK_MS, () => $.ui.invalidate('ui.render')) : null
      gitPoll?.cancel()
      vcs.gitStamp = null
      gitPoll = $.clock.every(GIT_POLL_MS, () => void followCwd($).then(moved => (moved ? undefined : gitChanged($))).then(() => watchTree($)))
      await shown
    })()
    return next(e)
  })

  on('config.set', async ($, e, next) => {
    const result = await next(e)
    if (e.key === 'theme' || SHIMMER_KEY.test(e.key)) await readConfig($).catch(() => undefined)
    return result
  })

  on('command.run', { command: 'filetree' }, async ($, e) => {
    const given = (e.args ?? '').trim()
    if (given === 'keys') return { text: await bindKeys($, machine.home) }
    const mine = given ? undefined : (await $.ui.panes().catch(() => [])).find(p => p.id === PANE)
    if (mine?.isShown) {
      settings.noDock = true
      if (zjump.on) jumpClose($)
      await $.ui.close({ id: PANE }).catch(() => undefined)
      return { text: 'File tree closed.' }
    }
    const terminal = await $.session.surfaces().then(s => s.includes('terminal'), () => true)
    if (terminal && !e.presentation.isFullscreen) return { text: 'filetree shows in the sidebar, which needs the fullscreen layout. Run /tui fullscreen, then /filetree.' }
    if (terminal && e.presentation.columns < 110) return { text: 'filetree shows in the sidebar, which needs a terminal at least 110 columns wide. Widen it, then run /filetree.' }
    settings.noDock = false
    const arg = given === 'open' ? '' : given
    const cwd = await cwdOf($)
    tree.follow = !arg
    const root = arg ? resolve(cwd, arg, machine.home) : cwd
    await reset($, root, settings.focusOnOpen || given !== '' || mine?.isPlaced === true)
    return { text: `File tree on ${shortPath(root)}${tree.follow ? ' (follows the cwd)' : ''}.` }
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
      const reads = settings.showReads ? readTargets(command, cwd, out.stdout, machine.home) : []
      const job: Job = { actions: [], since, initRepo: actions.some(a => a.init), readOnly: quiet || result.isReadOnly === true }
      if (out.backgroundTaskId) vcs.background.set(out.backgroundTaskId, { p: pending, job, reads })
      else void (async () => {
        const results = pending ? await outcomes($, pending, !result.isError, out.gitOperation) : []
        if (pending) await finishGit($, pending, results)
        vcs.queuedReads.push(...reads)
        scheduleScan($, { ...job, actions: proven(pending, results) })
      })()
      if (tree.follow && /(^|[;&|\s])(cd|pushd|popd)(\s|$)/.test(command)) $.clock.after(400, () => void followCwd($))
      if (!result.isError) void noteWork($, shellPaths(command, cwd, machine.home), shellWrites(command))
    } else {
      const file =
        'file_path' in e && typeof e.file_path === 'string'
          ? e.file_path
          : 'notebook_path' in e && typeof e.notebook_path === 'string'
            ? e.notebook_path
            : ''
      if (file) void touched($, [file], 'orange', settings.showWrites)
      if (file) void noteWork($, [file], true)
      if (file) void noteOutside($, file)
    }
    return result
  })

  on('tool.check', { tool: /^(Edit|Write|NotebookEdit|Bash|PowerShell)$/ }, async ($, e, next) => {
    await loadGuards($)
    const list = allGuards(guarding.guards)
    if (!list.length) return next(e)
    const input = has(e.input, 'file_path') ? e.input.file_path : has(e.input, 'notebook_path') ? e.input.notebook_path : has(e.input, 'command') ? e.input.command : undefined
    if (typeof input !== 'string' || !input) return next(e)
    const cwd = await cwdOf($)
    if ((GUARD_TOOLS as readonly string[]).includes(e.tool)) {
      const path = resolve(cwd, posix(input), machine.home)
      const hit = await guardFor($, path)
      if (!hit) return next(e)
      return { decision: 'deny', reason: `${shortPath(hit)} is guarded in the file tree, so ${e.tool} on ${shortPath(path)} is refused. Leave it alone, or ask the user to unguard it with x in the tree.` }
    }
    const hit = guardIn(input, list, cwd, machine.home)
    if (!hit) return next(e)
    const verdict = await next(e)
    if (verdict.decision === 'deny') return verdict
    return { decision: 'ask', decider: 'person', reason: `This command names ${shortPath(hit)}, which is guarded in the file tree. The check only reads the command text, so it can be a false alarm and can miss a path the command builds itself.` }
  })

  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    const result = await next(e)
    if (result.deny || result.isError || e.tool !== 'Read') return result
    void noteWork($, [posix(e.file_path)], false)
    if (!settings.showReads) return result
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
      void noteWork($, names.slice(0, 40).map(f => resolve(cwd, posix(f), machine.home)), false)
      if (!settings.showReads) return result
      void touched($, names.map(f => resolve(cwd, posix(f), machine.home)), 'purple', true)
      return result
    })

  on('turn.start', async (_$, e, next) => {
    if (!e.agentId) working.mainBusy = true
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId) {
      working.mainBusy = false
      void considerWork($)
    }
    return result
  })

  on('ui.message', async ($, e, next) => {
    if (e.requestId === PANE && e.element.startsWith('button-') && e.data && typeof e.data === 'object') {
      const id = e.element.slice('button-'.length)
      const data = headerMessage(e.data)
      if (data.press) await pressHeader($, id)
      else if (data.over === true || ui.hovered === id) {
        ui.hovered = data.over === true ? id : ''
        void $.ui.invalidate('ui.render')
      }
      return {}
    }
    if (e.requestId === PANE && e.element === 'peek' && e.data && typeof e.data === 'object') {
      const data = peekMessage(e.data)
      if (typeof data.over === 'boolean') previewing.overPeek = data.over
      else if (typeof data.scrollTo === 'number') {
        const last = Math.max(0, (previewing.peeked?.text.split('\n').length ?? 1) - previewing.peekRows)
        scrollSplit($, Math.round(Math.max(0, Math.min(1, data.scrollTo)) * last))
      } else if (typeof data.key === 'string') {
        const page = Math.max(1, previewing.peekRows - 1)
        const by: Record<string, number> = { up: -1, k: -1, down: 1, j: 1, f: page, b: -page, pageup: -page, pagedown: page, space: page, ' ': page, home: -Infinity, end: Infinity }
        if (data.key === 'p') await toggleSplit($)
        else if (data.key === '[' || data.key === ']') turnPage($, data.key === ']' ? 1 : -1)
        else if (data.key in by) scrollSplit($, previewing.peekTop + (by[data.key] ?? 0))
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
      const to = Math.round(Math.max(0, Math.min(1, data.scrollTo)) * ui.view.max)
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
      if (e.surface === 'desktop') return {}
      pickOnly(t.root)
      await selectRoot($)
      focusPane($, (await get($)).root, 'hk-tree')
      return {}
    }
    if (typeof data.press === 'string') {
      const ghost = ghostsOf(t).find(x => x.id === data.press)
      const n = t.nodes.find(x => x.id === data.press)
      if (!ghost && !n) return {}
      const flip = data.ctrl === true || (data.alt === true && (await osName($)) === 'darwin')
      if (data.shift === true || flip) {
        if (t.scroll === null) await patch($, () => ({ scroll: ui.view.from }))
        await (data.shift === true ? markRange($, data.press) : pickRow($, data.press))
        if (flashing.autoOpened.size) claimMarks((await get($)).cursor)
        return {}
      }
      pickOnly(data.press)
      if (ghost) {
        await patch($, () => ({ cursor: ghost.id, selected: ghost.id }))
        await diffFile($, ghost.id)
        return {}
      }
      if (!n) return {}
      if (t.scroll === null) await patch($, () => ({ scroll: ui.view.from }))
      await press($, n)
      if (flashing.autoOpened.size) claimMarks((await get($)).cursor)
      return {}
    }
    if (typeof data.key !== 'string') return {}
    if (t.preview) {
      const page = Math.max(1, previewing.previewRows - 2)
      const by: Record<string, number> = { up: -1, k: -1, down: 1, j: 1, f: page, b: -page, pageup: -page, pagedown: page, home: -Infinity, end: Infinity }
      if (data.key === 'left' || data.key === 'h') await closePreview($)
      else if (t.preview === OUTSIDE && (data.key === 'e' || data.key === 'd')) return {}
      else if (data.key === 'e') await editPreview($, t.preview)
      else if (data.key === 'd') await diffFile($, t.preview)
      else if (previewing.previewed?.diff && (data.key === 'j' || data.key === 'k')) await jumpDiff($, data.key === 'j' ? 1 : -1)
      else if (data.key in by) await scrollPreview($, by[data.key] ?? 0)
      return {}
    }
    if (e.element === 'treemap' && (await mapKey($, data.key))) return {}
    await navigate($, data.key, Boolean(data.shift), e.surface)
    return {}
  })

  on('session.end', async ($, e, next) => {
    tree.cached = null
    guarding.guards = {}
    guarding.guardsLoaded = null
    tree.watcher?.stop()
    tree.watcher = null
    tree.snapshot?.cancel()
    tree.snapshot = null
    const result = await next(e)
    if (pics.sessionDir) {
      const dir = pics.sessionDir
      pics.sessionDir = ''
      pics.pictures.clear()
      await $.process.run(['sh', '-c', CLEAN, 'sh', dir], { timeoutMs: 10_000 }).catch(() => undefined)
    }
    if (e.reason === 'clear' || e.reason === 'resume' || e.reason === 'other') $.clock.after(0, () => void settleRoot($))
    return result
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE && zjump.on) jumpClose($)
    if (e.id === PANE) {
      ui.shortcutsShown = settings.shortcutsSetting === 'always'
      ui.shortcutsTop = 0
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
    if (ui.nativeScroll) return next(e)
    const t = await get($)
    if (t.preview) {
      await scrollPreview($, Math.sign(e.by) * Math.max(3, Math.abs(e.by)))
      return {}
    }
    if (t.split && previewing.overPeek) {
      scrollSplit($, previewing.peekTop + Math.sign(e.by) * Math.max(3, Math.abs(e.by)))
      return {}
    }
    if (ui.shortcutsShown && !zjump.on) {
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
    const to = Math.max(0, Math.min(ui.view.max, (t.scroll ?? ui.view.from) + Math.sign(e.by) * Math.max(3, Math.abs(e.by))))
    if (to !== t.scroll) await patch($, () => ({ scroll: to }))
    return {}
  })

  on('prompt.submit', async ($, e, next) => {
    void settleBackground($, e.text)
    if (!(await followCwd($))) void sync($)
    const t = await get($)
    const context = [...(e.context ?? [])]
    const picked = picks(t)
    const live = (await Promise.all(picked.ids.map(async p => ((await exists($, p)) ? p : '')))).filter(Boolean)
    if (picked.marked && live.length) context.push(`The user has marked these entries in the file tree; "these" or "them" in the prompt likely refers to them:\n${live.join('\n')}`)
    else if (!picked.marked && live[0]) context.push(`The user has this file selected in the file tree; "this" or "it" in the prompt likely refers to it: ${live[0]}`)
    const mentions = [...e.text.matchAll(/@([^\s"'`]+)/g)]
      .map(m => (m[1] ?? '').replace(/[.,;:!?)]+$/, ''))
      .filter(Boolean)
      .map(p => resolve(t.root, p, machine.home))
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
    const narrow = e.component === 'AssistantMessage' && e.surface === 'terminal' ? narrowEmoji(e.props.text) : null
    const drawn = await next(narrow !== null && e.component === 'AssistantMessage' && narrow !== e.props.text ? { ...e, props: { ...e.props, text: narrow } } : e)
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
        settings.noDock = true
        void $.ui.close({ id: PANE }).catch(() => undefined)
      }
      const { Box: Empty } = $.ui.resolve(e)
      return <Empty />
    }
    if (zjump.on) {
      zjump.focused = Boolean(e.props.isFocused)
      if (e.props.isFocused) {
        zjump.held = true
        jumpBlurCancel()
      } else if (zjump.held && !ui.jumpBlur) ui.jumpBlur = $.clock.after(JUMP_BLUR_MS, () => {
        ui.jumpBlur = null
        if (zjump.on && zjump.held && !zjump.focused) jumpClose($)
      })
    }
    const unicode = settings.glyphSetting === 'plain' || settings.glyphSetting === 'text' || (settings.glyphSetting === 'auto' && (machine.noNerd || e.surface === 'desktop'))
    const elements = $.ui.resolve(e)
    const { Box, Text, Button, Input, Client } = elements
    const Svg = 'Svg' in elements ? elements.Svg : undefined
    const desk = e.surface === 'desktop' && Boolean(Svg)
    const Image = 'Image' in elements ? elements.Image : undefined
    const t = await get($)
    const light = e.surface !== 'desktop' && machine.lightTerminal
    const theme: Theme = { ...DEFAULT_THEME, ...settings.palette.theme }
    const tones = light ? LIGHT_TONES : TONES
    const mutedText = theme.muted ? { color: theme.muted } : { dimColor: true }
    const gitColors = { ...(desk ? DESK_GIT_TEXT : GIT_COLOR), ...settings.palette.git }
    const addColor = settings.palette.add ?? ADD_COLOR
    const delColor = settings.palette.del ?? DEL_COLOR
    const warnColor = gitColors.M ?? 'ansi256(3)'
    await loadGuards($)
    const guarded = new Set(allGuards(guarding.guards))
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
            <Box key={`${key}-h${j}`} flexDirection="row" alignItems="center" paddingLeft={1} backgroundColor={DESK.hover}>
              <Text dimColor size="footnote" tabular wrap="truncate-end">{r.text}</Text>
            </Box>
          ) : (
            <Box key={`${key}-l${j}`} flexDirection="row" alignItems="center" backgroundColor={tintOf(r.kind)}>
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
    const rowColors = { activeBg: selBg, hoverBg: settings.palette.hover ?? (theme.selection.startsWith('#') ? faint(theme.selection) : ''), tones: light ? LIGHT_SHIMMER : SHIMMER }
    ui.nativeScroll = e.surface === 'desktop'
    const accentInk = ink(theme.accent, DESK.accent)
    const accentText = desk ? 'suggestion' : accentInk
    const mutedInk = ink(theme.muted, DESK.muted)
    const dc = (c: string | undefined) => (desk && c ? ink(c, c) : c)
    const tint = (c: string | undefined) => (c === '' ? { dimColor: true } : c === undefined ? {} : !desk ? { color: c } : c === theme.muted ? { dimColor: true } : c === theme.accent ? { color: 'suggestion' } : c === theme.urgent ? { color: 'error' } : { color: ink(c, c) })
    const bgRgb = rgbOf(theme.bg)
    const searchBg = bgRgb ? toHex(over(bgRgb, rgbOf(theme.fg) ?? (light ? [0, 0, 0] : [255, 255, 255]), 0.07)) : light ? 'ansi256(254)' : 'ansi256(236)'
    const glow = (color: string, id: string) => (ui.hovered === id ? lighten(color) : color)
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
    const deskSel = settings.palette.theme.selection ?? DESK.selection
    const deskHover = settings.palette.hover ?? DESK.hover
    const deskCur = e.props.isFocused ? deskSel : deskHover
    const deskCursor = settings.palette.theme.accent ? `${accentInk}1f` : DESK.cursor
    const jumpSel = settings.palette.jump ? `${settings.palette.jump}1f` : DESK.jumpSel
    const button = (b: ButtonProps & { icon?: IconName; hint?: string }) => desk && Svg && b.icon ? (
      <Box key={`tool-${b.id}`} position="relative" flexDirection="row" alignItems="center" flexShrink={0}>
        <Svg key={`tool-icon-${b.id}${b.id === 'refresh' ? `-${ui.reloading ? 'spin' : ui.reloadSpin}` : ''}`} source={toolSvg(b.icon, glow(b.id === 'outside' ? ink(warnColor, DESK_GIT.M ?? DESK.accent) : b.dim && !(b.id === 'refresh' && ui.reloading) ? mutedInk : accentInk, b.id), b.id === 'refresh' && ui.reloading ? SPIN_MS : 0)} alt={`${WORDS[b.id] ?? b.id} button`} width={24} height={24} />
        {b.id === 'outside' ? <Text key="outside-count" color={glow(ink(warnColor, DESK_GIT.M ?? DESK.accent), b.id)} tabular>{`${guarding.outside.length} `}</Text> : null}
        <Box position="absolute" top={0} left={0} right={0} bottom={0}>
          <Client key={`button-${b.id}`} module="./button.tsx" props={{ id: b.id, label: '', dim: b.dim } satisfies ButtonProps} width="100%" height="100%" />
        </Box>
      </Box>
    ) : <Client key={`button-${b.id}`} module="./button.tsx" props={{ id: b.id, label: b.label, dim: b.dim, ...(TOGGLES.includes(b.id) ? { color: theme.accent } : b.id === 'outside' ? { color: warnColor } : {}) } satisfies ButtonProps} />
    const hint = (buttons: { id: string; label: string; hint: string; dim: boolean }[], title: number) => {
      const over = buttons.find(b => b.id === ui.hovered)
      const text = over?.hint
      if (!text) return null
      const tint = over && !over.dim ? accentInk : theme.fg ? ink(theme.fg, 'text') : 'text'
      const room = e.props.bodyColumns - title - buttons.reduce((w, b) => w + (desk ? DESK_ICON_COLS : b.label.length + 1), 0) - 2
      return text.length <= room ? <Text color={tint} wrap="truncate-end">{`${text} `}</Text> : null
    }
    if (t.preview) {
      if (previewing.previewed?.path !== t.preview) await loadPreview($, t.preview, previewing.deskLine?.path === t.preview ? previewing.deskLine.line : undefined)
      const p = previewing.previewed
      const first = p?.diff ? 0 : (p?.first ?? 0)
      const markdown = /\.(md|markdown|mdx|docx|odt|rtf)$/i.test(t.preview)
      const all = p?.diff?.length ?? (p?.text ?? '').split('\n').length
      previewing.previewRows = ui.nativeScroll ? all : Math.max(4, (e.props.scroll?.bodyRows ?? 40) - (p?.note ? 3 : 2))
      const start = ui.nativeScroll ? 0 : p?.diff ? Math.min(t.previewTop, Math.max(0, all - 1)) : Math.min(t.previewTop, Math.max(0, all - previewing.previewRows))
      const win = p?.diff ? diffWindow(p.diff, start, previewing.previewRows) : previewLines(p?.text ?? '', start, previewing.previewRows, markdown)
      previewing.previewLine = first + win.top + 1
      const name = t.preview !== t.root && inside(t.root, t.preview) ? relative(t.root, t.preview) : shortPath(t.preview)
      const listing = t.preview === OUTSIDE
      const external = { id: 'external', label: settings.glyphSetting === 'text' ? 'open' : unicode ? '↗' : '\u{eb14}', dim: true, hint: 'open in default app' }
      if (desk && Svg) {
        const step = p?.diff ? (p.diff.some(l => l.kind === '@') ? 'file' : 'hunk') : ''
        const toTree = t.nodes.find(n => n.id === t.preview)?.kind === 'dir'
        const edits = !listing && (settings.editWithSetting || machine.inTmux || machine.inHerdr)
        previewing.previewDesk = true
        const acts: { id: string; key: string; icon: IconName; hint: string; run: () => Promise<void> }[] = [
          { id: 'pv-k', key: 'k', icon: 'arrow-up', hint: step ? `previous ${step}` : 'up a line', run: () => (step ? jumpDiff($, -1) : scrollPreview($, -1)) },
          { id: 'pv-j', key: 'j', icon: 'arrow-down', hint: step ? `next ${step}` : 'down a line', run: () => (step ? jumpDiff($, 1) : scrollPreview($, 1)) },
          { id: 'pv-b', key: 'b', icon: 'page-up', hint: 'page up', run: () => scrollPreview($, 2 - previewing.previewRows) },
          { id: 'pv-f', key: 'f', icon: 'page-down', hint: 'page down', run: () => scrollPreview($, previewing.previewRows - 2) },
          ...(listing ? [] : [{ id: 'pv-d', key: 'd', icon: (p?.diff ? (toTree ? 'folder' : 'file') : 'diff') as IconName, hint: p?.diff ? (toTree ? 'back to the tree' : 'back to the file') : 'diff against HEAD', run: () => diffFile($, t.preview) }]),
          ...(edits ? [{ id: 'pv-e', key: 'e', icon: 'pencil' as const, hint: `edit at line ${previewing.previewLine}`, run: () => editPreview($, t.preview) }] : []),
          ...(listing ? [] : [{ id: 'external', key: '', icon: 'external-link' as const, hint: 'open in default app', run: () => pressHeader($, 'external') }]),
        ]
        previewing.previewActs = new Map(acts.map(a => [a.id, () => void a.run().then(() => (a.id === 'external' ? undefined : parkPreview($)))]))
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
            ) : previewing.deskLine?.path === t.preview && previewing.deskLine.top > 0 && !p?.diff ? (() => {
              const lines = (p?.text ?? '').split('\n')
              const at = Math.max(0, Math.min(previewing.deskLine.top - first, lines.length - 1))
              if (!previewing.deskLine.scrolled) {
                previewing.deskLine.scrolled = true
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
              {acts.filter(a => a.key).map(a => <Button key={`pv-hk-${a.key}`} plain hotkey={a.key} label={a.key} onPress={() => previewing.previewActs.get(a.id)?.()} />)}
            </Box>
          </Box>
        )
      }
      previewing.previewDesk = false
      return (
        <Box flexDirection="column" minHeight={Math.max(1, e.props.scroll?.bodyRows ?? 1)} backgroundColor={theme.bg || undefined}>
          <Box flexDirection="row">
            <Button key="back" plain hotkey="h" autoFocus={settings.editWithSetting || machine.inTmux || machine.inHerdr ? undefined : true} label={unicode ? '← files' : '\u{ea9b} files'} onPress={() => void closePreview($)} />
            <Text> </Text>
            <Box flexShrink={1} flexGrow={1}>
              <Text bold wrap="truncate-start">{name}</Text>
            </Box>
            {listing ? null : hint([external], 8 + name.length)}
            {listing ? null : button(external)}
          </Box>
          <Box flexDirection="row" gap={2}>
            {([['j', '↓', '\u{ea9a}', 1], ['k', '↑', '\u{eaa1}', -1], ['f', 'page ↓', '\u{ea9a} page', previewing.previewRows - 2], ['b', 'page ↑', '\u{eaa1} page', 2 - previewing.previewRows]] as const).map(([k, plain, nerd, by]) => {
              const step = p?.diff && (k === 'j' || k === 'k') ? (p.diff.some(l => l.kind === '@') ? 'file' : 'hunk') : ''
              const label = step ? `${unicode ? plain : nerd} ${step}` : unicode ? plain : nerd
              return <Button key={`pv-${k}`} plain dimColor hotkey={k} label={label} onPress={() => void (step ? jumpDiff($, by > 0 ? 1 : -1) : scrollPreview($, by)).then(() => parkPreview($))} />
            })}
            {listing ? null : <Button key="pv-d" plain dimColor hotkey="d" label={p?.diff ? (t.nodes.find(n => n.id === t.preview)?.kind === 'dir' ? 'tree' : 'file') : 'diff'} onPress={() => void diffFile($, t.preview)} />}
            {!listing && (settings.editWithSetting || machine.inTmux || machine.inHerdr) ? <Button key="edit" plain dimColor autoFocus hotkey="e" label={`${unicode ? 'edit' : '\u{ea73} edit'} :${previewing.previewLine}`} onPress={() => void editPreview($, t.preview)} /> : null}
          </Box>
          {p?.note ? <Text {...mutedText}>{p.note}</Text> : null}
          {ui.nativeScroll ? directPreview(elements, { ...win, top: first + win.top }, t.preview, markdown, theme.accent) : (
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
    if (t.top) ui.hintRoot = ''
    else if (settings.showHints && ui.hintRoot !== t.root) {
      ui.hintRoot = t.root
      ui.hintUntil = now + HINT_MS
      $.clock.after(HINT_MS, () => void $.ui.invalidate('ui.render'))
    }
    const hintOn = now < ui.hintUntil
    const live = (await activities($)).filter(a => now - a.at < (a.state === 'running' ? RUNNING_MAX_MS : ACTIVITY_TTL_MS))
    const latest = [...live].reverse().find(a => a.state === 'running') ?? live[live.length - 1]
    const bright = new Set(t.flashOn ? t.flash : [])
    const dimmed = new Set(t.flashOn ? t.flashDim : [])
    const ignored = new Set(t.ignored)
    const untracked = new Set(t.untrackedDirs)
    const width = Math.max(24, e.props.bodyColumns)
    const rows = rowsOf(t)
    const picked = picks(t)
    const inSet = new Set(picked.ids)
    const grepping = !zjump.on && grepOn(t)
    if (grepping && grep.key !== grepKey(t)) grepRun($, t)
    const body = e.props.scroll?.bodyRows ?? 40
    const footer = t.nodes.find(n => n.id === t.cursor)?.id ?? (t.selected || '')
    const chrome = 1 + (settings.searchGap ? 2 : settings.sortHeader ? 1 : 0) + 1 + (t.top ? (t.branch ? 1 : 0) : settings.showHints ? 1 : 0) + (latest ? 1 : 0) + (!desk || footer || settings.shortcutsSetting === 'auto' ? 1 : 0)
    const spare = body - chrome - 5
    const splitRows = t.split && !ui.nativeScroll && spare >= 6 && (settings.treemapSetting !== 'off' || Boolean(peekTarget(t))) ? Math.min(Math.max(6, Math.floor(body * 0.45)), spare) : 0
    previewing.splitShown = splitRows > 0
    if (!previewing.splitShown) previewing.overPeek = false
    const fixed = splitRows + chrome
    const room = ui.nativeScroll ? Math.max(1, rows.length) : Math.max(5, (e.props.scroll?.bodyRows ?? 40) - fixed)
    const isLit = (id: string) => bright.has(id) || dimmed.has(id)
    const focus = settings.followClaude && t.flashOn ? ([...t.flash].reverse().find(id => id !== BRANCH_ROW) ?? t.cursor) : t.cursor
    const at = Math.max(0, rows.findIndex(r => r.node.id === focus))
    const lit = settings.followClaude && t.flashOn ? rows.findIndex(r => isLit(r.node.id)) : -1
    const cap = Math.max(1, Math.floor(room / 3))
    let from = Math.max(0, Math.min(lit >= 0 && at - lit < room - 2 ? Math.max(0, lit - 1) : at - Math.floor(room / 2), rows.length - room))
    let pinned = !ui.nativeScroll && settings.shimmerOn && settings.followClaude && t.flashOn ? rows.slice(0, from).filter(r => isLit(r.node.id)).slice(-cap) : []
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
    ui.view = { from, max }
    const shown = rows.slice(from, from + room - pinned.length)
    const deskFrom = ui.nativeScroll && shown.length > DESK_ROWS + 2 ? Math.max(0, Math.min(at - from - Math.floor(DESK_ROWS / 2) - 1, shown.length - DESK_ROWS - 2)) : 0
    const drawn = ui.nativeScroll ? shown.slice(deskFrom, deskFrom + DESK_ROWS + 2) : shown
    if (t.column === 'date') wantTimes($, [...pinned, ...drawn].filter(r => r.node.kind === 'dir').map(r => r.node))
    if (t.column === 'size') wantSizes($, [...pinned, ...drawn].filter(r => r.node.kind === 'dir' && !(r.node.id in t.dirSizes)).map(r => r.node.id))
    if (t.column === 'files') wantCounts($, [...pinned, ...drawn].filter(r => r.node.kind === 'dir' && !metrics.fileCounts.has(r.node.id)).map(r => r.node.id))
    if (t.column === 'loc') {
      const seen = [...pinned, ...drawn].map(r => r.node)
      wantLoc($, seen.filter(n => n.kind === 'dir' && !metrics.locCache.has(n.id)).map(n => n.id), true)
      wantLoc($, [...new Set(seen.filter(n => n.kind === 'file' && counted(n.name) && !metrics.locListed.has(n.parent)).map(n => n.parent))], false)
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
      ...(guarding.outside.length ? [{ id: 'outside', label: `${unicode ? '⚠' : '\u{ea6c}'} ${guarding.outside.length}`, dim: false, hint: `${guarding.outside.length} file${guarding.outside.length === 1 ? '' : 's'} written outside the repo`, icon: 'warning' as const }] : []),
      ...(picked.ids.length ? [{ id: 'unselect', label: unicode ? '⊘' : '\u{eabd}', dim: false, hint: 'clear selection', icon: 'ban' as const }] : []),
      { id: 'up', label: unicode ? '↑' : '\u{f19f3}', dim: true, hint: 'parent folder', icon: 'folder-up-line' as const },
      { id: 'cwd', label: unicode ? '⌂' : '\u{eb46}', dim: !tree.follow, hint: 'go to cwd', icon: 'root-folder' as const },
      { id: 'hidden', label: unicode ? (t.showHidden ? '⊙' : '○') : t.showHidden ? '\u{ea70}' : '\u{eae7}', dim: !t.showHidden, hint: t.showHidden ? 'hide hidden files' : 'show hidden files', icon: t.showHidden ? ('eye' as const) : ('eye-off' as const) },
      { id: 'size', label: unicode ? '◫' : '\u{ea90}', dim: t.column === 'date', hint: t.column === 'date' ? 'show sizes' : t.column === 'size' ? 'show lines of code' : t.column === 'loc' ? 'show file counts' : 'show dates', icon: 'columns' as const },
      { id: 'collapse', label: unicode ? '⊟' : '\u{eac5}', dim: true, hint: t.expanded.length ? 'collapse all' : 'expand all', icon: t.expanded.length ? 'square-minus' as const : 'square-plus' as const },
      { id: 'autocollapse', label: unicode ? '◷' : '\u{ea82}', dim: !autoCollapseOn(t), hint: 'auto-collapse opened folders', icon: 'folder-minus' as const },
      ...(ui.nativeScroll ? [] : [{ id: 'split', label: unicode ? '⊡' : '\u{eb57}', dim: !t.split, hint: t.split ? 'hide preview' : 'show preview', icon: 'panel' as const }]),
      ...(desk ? [{ id: 'shimmer', label: '', dim: !settings.shimmerOn, hint: settings.shimmerOn ? 'disable agent activity shimmer effect' : 'enable agent activity shimmer effect', icon: 'clawd' as const }] : []),
      { id: 'refresh', label: unicode ? '↻' : '\u{eb37}', dim: !ui.reloading, hint: 'reload tree and git', icon: 'refresh' as const },
    ]
    const wordButtons = plainButtons.map(b => ({ ...b, label: b.id === 'outside' ? `outside ${guarding.outside.length}` : (WORDS[b.id] ?? b.label) }))
    const wordWidth = wordButtons.reduce((w, b) => w + b.label.length + 1, 1)
    const buttons = settings.glyphSetting === 'text' && e.props.bodyColumns - wordWidth >= 8 ? wordButtons : plainButtons
    const rootGlyph = unicode ? '■' : t.top === t.root ? '\u{f02a2}' : '\u{e5fe}'
    const header = t.top ? [t.top.split('/').pop() ?? t.top, t.prefix.replace(/\/$/, '')].filter(Boolean).join('/') : t.root.split('/').pop() || t.root
    const toolRoom = e.props.bodyColumns - header.length - 4
    const toolWidth = (list: typeof buttons, gap: number) => list.reduce((w, b) => w + (desk ? DESK_ICON_COLS : [...b.label].length), 0) + gap * Math.max(0, list.length - 1) + 1
    let toolButtons = buttons
    for (const drop of ['autocollapse', 'size', 'collapse', 'shimmer', 'refresh']) {
      if (toolWidth(toolButtons, 1) <= toolRoom) break
      toolButtons = toolButtons.filter(b => b.id !== drop)
    }
    const toolGap = desk ? 0 : toolWidth(toolButtons, 2) <= toolRoom ? 2 : 1
    const tipButton = buttons.find(b => b.id === ui.hovered)
    const tipText = tipButton?.hint ?? ''
    const tipProps = tipButton && !tipButton.dim ? { color: desk ? accentText : theme.accent } : desk ? { color: theme.fg ? ink(theme.fg, 'text') : 'text' } : theme.fg ? { color: theme.fg } : {}

    const sizePad = desk ? '\u2007' : ' '
    const isLong = (n: FileNode): boolean => settings.longFile > 0 && t.column === 'loc' && n.kind === 'file' && (metrics.locCache.get(n.id) ?? 0) > settings.longFile
    const cellsOf = (n: FileNode): Partial<Record<Col, Seg>> => {
      const loc = t.diff[n.id]
      const metric = t.column === 'loc'
        ? n.kind === 'dir'
          ? metrics.locCache.has(n.id)
            ? (metrics.locCache.get(n.id) ?? 0) >= 0 ? formatLoc(metrics.locCache.get(n.id) ?? 0) : ''
            : '…'
          : n.kind === 'file' && counted(n.name)
            ? metrics.locCache.has(n.id)
              ? formatLoc(metrics.locCache.get(n.id) ?? 0)
              : metrics.locListed.has(n.parent) ? '' : '…'
            : ''
        : t.column === 'files'
        ? n.kind === 'dir'
          ? metrics.fileCounts.has(n.id)
            ? (metrics.fileCounts.get(n.id) ?? -1) >= 0 ? formatLoc(metrics.fileCounts.get(n.id) ?? 0) : ''
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
          ? (when => (when ? (settings.showAge ? age(when, now) : stamp(when, settings.dateSetting, settings.clock)) : ''))(n.kind === 'dir' ? (metrics.dirTimes.get(n.id)?.[1] ?? 0) : n.mtime)
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
      const isBright = settings.shimmerOn && bright.has(n.id)
      const isDim = settings.shimmerOn && !isBright && dimmed.has(n.id)
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
      const isPicked = inSet.has(n.id)
      const isLink = linking.links.has(n.id)
      const link = isLink ? linking.linkStates.get(n.id) : undefined
      if (isLink && !linking.linkStates.has(n.id)) void classifyLink($, n.id)
      const linkColor = link?.kind === 'broken' || link?.kind === 'circular' ? theme.urgent : link?.kind === 'outside' ? warnColor : theme.muted
      const cols = Math.max(4, width - r.depth * 2 - 6 - tailCells - badge.length - (isLink ? 2 : 0))
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
      ]
      const right: Seg[] = COLS.filter(c => widths[c]).map(c => {
        const cell = cells[c]
        const pad = ' ' + (cell?.t ?? '').padStart(widths[c] ?? 0)
        return cell ? { t: pad, c: cell.c } : { t: pad }
      })
      right.push({ t: badge, c: status && !hasCounts ? gitColor : theme.muted, b: true })
      return { spec: { id: n.id, left: clean(left), right: clean(right), ...(isPicked ? { on: true as const } : {}) }, n, r, cells, status: hasCounts ? '' : (status ?? ''), gitColor, isIgnored: isIgnored && !hasCounts && !status, iconColor, nameColor, lit, tone, isDim, isBright, isRepo, isGuard, isPicked, isLink, link, linkColor, parts: hl(n.name) }
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
    const jumpWhen = (dir: string) => (at => (at ? (settings.showAge ? age(at, now) : stamp(at, settings.dateSetting, settings.clock)) : ''))(zjump.when[dir] ?? 0)
    const jumpDate = zjump.on ? zjump.rows.reduce((m, dir) => Math.max(m, [...jumpWhen(dir)].length), 0) : 0
    const gitSpan = zjump.on ? 0 : GIT_COLS.reduce((w, c) => w + (widths[c] ? (widths[c] ?? 0) + 1 : 0), 0)
    const metricSpan = zjump.on ? (jumpDate ? jumpDate + 1 : 0) : widths.metric ? (widths.metric ?? 0) + 1 : 0
    const gitLabel = e.props.bodyColumns - Math.max(metricSpan, 11) - 20 >= 12 ? 'Git (LOC)' : 'Git'
    const metricLabel = zjump.on ? 'Last accessed' : t.column === 'size' ? 'Size' : t.column === 'loc' ? 'LOC' : t.column === 'files' ? '# Files' : 'Modified'
    const headCell = (col: 'name' | 'git' | 'metric', label: string) => (!zjump.on ? sortCell(col, label) : desk ? <Text key={`head-${col}`} color={mutedInk}>{label}</Text> : <Text key={`head-${col}`} dimColor>{label}</Text>)
    const headerRow = () => (
      <Box key="sort-header" flexDirection="row" alignItems="center" {...(desk ? {} : { width: e.props.bodyColumns, height: 1 })}>
        {desk && Svg ? <Svg key="sort-indent" source={rowSvg(0, null, null, mutedInk)} alt="column headers" width={STEP_PX * 2 + GAP_PX} height={ROW_PX} /> : <Text>{'    '}</Text>}
        {headCell('name', 'Name')}
        <Box flexGrow={1} />
        {gitSpan ? <Box key="sort-git-cell" width={Math.max(gitSpan, gitLabel.length + 3)} flexShrink={0} flexDirection="row" justifyContent="flex-end">{headCell('git', gitLabel)}</Box> : null}
        {metricSpan ? <Box key="sort-metric-cell" width={Math.max(metricSpan, metricLabel.length + 3)} flexShrink={0} flexDirection="row" justifyContent="flex-end">{headCell('metric', metricLabel)}</Box> : null}
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

    const deskRow = (p: ReturnType<typeof rowParts>, deskShimmer: boolean) => {
      const r = p.r
      const n = p.n
      const icon = p.isGuard ? 'x' : nodeIcon(n, p.isRepo)
      const tone = tones[p.tone]
      const iconInk = p.lit ? (tone?.solid ?? accentInk) : p.isGuard ? ink(theme.urgent, DESK.urgent) : ink(p.iconColor, n.kind === 'dir' ? accentInk : mutedInk)
      const strike = p.status === 'D' && n.kind !== 'dir'
      const name = p.lit && deskShimmer
        ? <Client key={`lit:${n.id}`} module="./rows.tsx" props={{ rows: [{ id: '', left: clean([{ t: n.name, sh: p.tone, b: p.isBright }]), right: [] }], active: '', activeBg: '', hoverBg: '', tones: rowColors.tones, pointer: false } satisfies RowsProps} />
        : p.lit
        ? <Text color={tone?.solid ?? accentText} bold={p.isBright || undefined} strikethrough={strike || undefined} wrap="truncate-end">{n.name}</Text>
        : <Text {...tint(p.nameColor)} strikethrough={strike || undefined} wrap="truncate-end">{p.parts.some(x => x.hit) ? p.parts.map((x, i) => (x.hit ? <Text key={`hl-${i}`} color={accentText} weight="semibold">{x.t}</Text> : x.t)) : n.name}</Text>
      return (
        <Box key={`row:${n.id}`} position="relative" flexDirection="row" alignItems="center" backgroundColor={n.id === t.cursor && !p.isPicked ? deskCursor : p.isPicked ? deskCur : undefined} hover={{ backgroundColor: n.id === t.cursor && !p.isPicked ? deskCursor : p.isPicked ? deskCur : deskHover }}>
          {n.id === t.cursor && (e.props.isFocused || !p.isPicked) && Svg ? <Box key={`bar:${n.id}`} position="absolute" top={0} left={0} bottom={0}><Svg key={`bar-svg:${n.id}`} source={barSvg(accentInk)} alt="cursor" width={2} height={ROW_PX} /></Box> : null}
          {Svg ? <Svg key={`icon:${n.id}`} source={rowSvg(r.depth, n.kind === 'dir' ? (r.open ? 'open' : 'closed') : null, icon, iconInk)} alt={`${p.isGuard ? 'guarded ' : ''}${n.kind === 'dir' ? 'folder' : n.kind === 'link' ? 'link' : 'file'} ${n.name}`} width={r.depth * STEP_PX + STEP_PX * 2 + GAP_PX} height={ROW_PX} /> : null}
          <Box flexGrow={p.isLink ? 0 : 1} flexShrink={1} overflow="hidden">{name}</Box>
          {p.isLink ? <Text key={`link:${n.id}`} {...tint(p.linkColor)}>{` → `}</Text> : null}
          {p.isLink ? <Box flexGrow={1} /> : null}
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
      ? zjump.rows.map(dir => ({ id: dir, left: clean([{ t: unicode ? '■ ' : '\u{e5ff} ', c: settings.palette.jump ?? JUMP_COLOR }, { t: dir.split('/').filter(Boolean).pop() ?? dir, c: theme.fg || undefined }, { t: `  ${shortPath(dirname(dir))}`, c: theme.muted }]), right: jumpWhen(dir) ? [{ t: ` ${jumpWhen(dir)} `, c: theme.muted }] : [] }))
      : [note('no matching folder')]
    const grepDigits = Math.max(2, ...grep.rows.map(h => String(h.line).length))
    const grepName = (path: string) => (inside(t.root, path) ? relative(t.root, path) : shortPath(path))
    const grepNode = (path: string): FileNode => ({ id: path, parent: dirname(path), name: path.slice(path.lastIndexOf('/') + 1), kind: 'file', hidden: false, mtime: 0, size: 0, loaded: true })
    const grepNote = !grepping ? '' : grep.rows.length === 0 ? (grep.busy ? 'searching…' : grep.note || 'no matches') : grep.capped ? `first ${GREP_LIMIT} matches; keep typing to narrow` : grep.note
    const grepRoom = Math.max(1, room - (grepNote ? 1 : 0))
    const grepFrom = ui.nativeScroll ? 0 : Math.max(0, Math.min(grep.sel - Math.floor(grepRoom / 2), grep.rows.length - grepRoom))
    const grepSpecs: RowSpec[] = !grepping ? [] : [
      ...grep.rows.slice(grepFrom, ui.nativeScroll ? undefined : grepFrom + grepRoom).map((h): RowSpec => h.line
        ? { id: grepId(h), left: clean([{ t: `    ${String(h.line).padStart(grepDigits)}  `, c: theme.muted }, { t: h.text, c: theme.fg || undefined }]), right: [] }
        : { id: grepId(h), left: clean([{ t: `${unicode ? '∙' : fileIcon(grepNode(h.path), false, false)} `, c: theme.muted }, { t: grepName(h.path), c: theme.fg || undefined, b: true }]), right: [{ t: ` ${h.text} `, c: theme.muted }] }),
      ...(grepNote ? [note(grepNote)] : []),
    ]
    const specs: RowSpec[] = zjump.on ? jumpSpecs : grepping ? grepSpecs : desk ? [] : [
      ...(rows.length === 0 ? [note('empty')] : []),
      ...pinned.map(rowSpec),
      ...(pinned.length > 0 ? [note('  ⋮')] : []),
      ...shown.map(rowSpec),
    ]
    if (ui.nativeScroll) {
      let size = 0
      const cut = specs.findIndex(r => (size += JSON.stringify(r).length + 1) > ROWS_BUDGET)
      if (cut >= 0) specs.splice(cut, specs.length - cut, note(`  … ${specs.length - cut} more rows, collapse folders or use search`))
    }
    const deskParts: ReturnType<typeof rowParts>[] = []
    let deskStart = deskFrom
    if (desk && !grepping && !zjump.on && drawn.length) {
      const parts = new Map<number, ReturnType<typeof rowParts>>()
      const part = (k: number) => {
        const known = parts.get(k)
        if (known) return known
        const made = rowParts(drawn[k] as (typeof drawn)[number])
        parts.set(k, made)
        return made
      }
      let chars = 0
      let nodes = 0
      const fits = (k: number) => {
        const [c, n] = weigh(deskRow(part(k), true))
        if (chars + c > DESK_TREE_CHARS || nodes + n > DESK_TREE_NODES) return false
        chars += c
        nodes += n
        return true
      }
      const focusAt = Math.min(drawn.length - 1, Math.max(0, at - from - deskFrom))
      let lo = focusAt
      let hi = focusAt - 1
      let down = true
      let up = true
      while (hi - lo + 1 < DESK_ROWS && (down || up)) {
        if (down) down = hi + 1 < drawn.length && fits(hi + 1) ? (hi++, true) : false
        if (up && hi - lo + 1 < DESK_ROWS && hi >= lo) up = lo - 1 >= 0 && fits(lo - 1) ? (lo--, true) : false
        if (hi < lo) break
      }
      for (let k = lo; k <= hi; k++) deskParts.push(part(k))
      deskStart = deskFrom + lo
    }
    const deskShimmer = deskParts.filter(x => x.lit).length <= DESK_SHIMMER_MAX
    const deskGrep: GrepHit[] = []
    if (desk && grepping) {
      let size = 0
      let page = 0
      for (const g of grep.rows) {
        size += DESK_ROW_CHARS + 7 * grepId(g).length + g.text.length
        page += DESK_ROW_PAGE + 5 * grepId(g).length + g.text.length
        if (size > ROWS_BUDGET || page > DESK_PAGE_CHARS || deskGrep.length >= DESK_ROWS) break
        deskGrep.push(g)
      }
    }
    if (desk && grepping) ui.deskGrepShown = deskGrep.length
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
            <Box key="grep-note" position="relative" flexDirection="row" alignItems="center">
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
            <Box key={`jump:${dir}`} position="relative" flexDirection="row" alignItems="center" overflow="hidden" backgroundColor={k === zjump.sel ? jumpSel : undefined} hover={{ backgroundColor: k === zjump.sel ? jumpSel : deskHover }}>
              {Svg ? <Svg key={`jump-icon:${dir}`} source={rowSvg(0, null, 'folder', settings.palette.jump ?? DESK.jump)} alt={`folder ${dir}`} width={STEP_PX * 2 + GAP_PX} height={ROW_PX} /> : null}
              <Box flexShrink={1} overflow="hidden"><Text wrap="truncate-end">{dir.split('/').filter(Boolean).pop() ?? dir}</Text></Box>
              <Box flexGrow={1} flexShrink={3} overflow="hidden" marginLeft={1}><Text {...mutedText} wrap="truncate-start">{shortPath(dirname(dir))}</Text></Box>
              {metricSpan ? <Box width={Math.max(metricSpan, metricLabel.length + 3)} flexShrink={0} flexDirection="row" justifyContent="flex-end"><Text {...mutedText}>{jumpWhen(dir)}</Text></Box> : null}
              <Box width={2} flexShrink={0} />
              <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                <Client key={`hit:${dir}`} module="./hit.tsx" props={{ id: dir } satisfies HitProps} width="100%" height="100%" />
              </Box>
            </Box>
          )) : (
            <Box key="jump-none" position="relative" flexDirection="row" alignItems="center">
              <Text {...mutedText}>no matching folder</Text>
              <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                <Client key="hit:jump-none" module="./hit.tsx" props={{ id: '' } satisfies HitProps} width="100%" height="100%" />
              </Box>
            </Box>
          )}
        </Box>
      )
      const out: RenderElement[] = rows.length === 0 ? [<Text key="empty" {...mutedText}>empty</Text>] : []
      for (const p of deskParts) out.push(deskRow(p, deskShimmer))
      if (deskStart > 0) out.unshift(<Text key="above" {...mutedText}>{`  … ${deskStart} rows above, collapse folders or use search`}</Text>)
      const below = shown.length - deskStart - deskParts.length
      if (below > 0) out.push(<Text key="more" {...mutedText}>{`  … ${below} more rows, collapse folders or use search`}</Text>)
      return <Box key="tree" flexDirection="column">{out}</Box>
    }
    const barSize = Math.max(1, Math.round((specs.length * shown.length) / Math.max(1, rows.length)))
    const bar =
      !ui.nativeScroll && !grepping && rows.length > shown.length + pinned.length
        ? { pos: max ? Math.round((from / max) * (specs.length - barSize)) : 0, size: barSize, thumb: theme.accent, track: theme.muted }
        : undefined

    const branchRow = () => {
      if (!t.top || !t.branch) return null
      const b = t.branch
      const isFlash = settings.shimmerOn && bright.has(BRANCH_ROW)
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
          {b.upstream && settings.showRemote ? (
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
      previewing.peekRows = splitRows - 2
      const lock = mapping.mapLock?.cursor === t.cursor ? mapping.mapLock : null
      if (mapping.mapLock && !lock) mapping.mapLock = null
      const target = lock ? '' : peekTarget(t)
      const anchor = target ? '' : (lock?.anchor ?? (t.nodes.find(n => n.id === t.cursor)?.kind === 'dir' ? t.cursor : t.root))
      mapping.mapPick = lock?.pick ?? ''
      stopScans(anchor)
      if (target !== previewing.peekPath) {
        previewing.peekPath = target
        previewing.peeked = null
        previewing.peekTop = previewing.peekWant?.path === target ? previewing.peekWant.top : 0
        previewing.peekWant = null
        if (previewing.peekAt?.path !== target) previewing.peekAt = null
        previewing.overPeek = false
      }
      let start = previewing.peekTop
      const rule = <Text key="peek-rule" {...mutedText}>{'─'.repeat(Math.max(1, e.props.bodyColumns))}</Text>
      const shown = target || anchor
      const name = shown ? (shown === t.root ? shown.split('/').pop() || shown : inside(t.root, shown) ? relative(t.root, shown) : shortPath(shown)) : ''
      const docKind = target ? pictureKind(target) : ''
      const isDoc = docKind === 'pdf' || docKind === 'office'
      const docPixels = Boolean(Image) && !machine.imageDenied && !machine.inTmux && !machine.inHerdr
      const page = isDoc ? (previewing.docPages.get(target) ?? 1) : 0
      const px = Math.round(Math.max(1, e.props.bodyColumns - 1) * (machine.cellPx?.cw ?? 10))
      const raw = target && (!isDoc || docPixels) ? await picture($, target, page, px) : null
      const pic = isDoc && raw && raw.state !== 'ready' && !(raw.state === 'failed' && raw.note === 'encrypted') ? null : raw
      if (isDoc && raw?.state === 'ready' && raw.pages) {
        previewing.docCounts.set(target, raw.pages)
        if (page < raw.pages) void picture($, target, page + 1, px)
      }
      if (!target || pic) previewing.overPeek = false
      let content: RenderElement
      let status = ''
      if (!target && anchor) {
        mapping.mapAnchor = anchor
        const scan = usageOf($, anchor, t.column === 'loc')
        const cols = Math.max(8, e.props.bodyColumns - 1)
        const tiles = layout(scan.items, cols, previewing.peekRows)
        const total = scan.done ? scan.total : scan.items.reduce((a, u) => a + u.bytes, 0)
        const lit = settings.shimmerOn && t.flashOn ? t.flash : []
        const pick = tiles.find(x => x.path === mapping.mapPick)
        const ground = theme.bg
        const shade = ground.startsWith('#') && theme.accent.startsWith('#')
        const pct = (bytes: number) => { const p = total ? Math.round((bytes / total) * 100) : 0; return bytes && !p ? '<1%' : `${p}%` }
        const accent = colorOf(theme.accent, machine.termColors, light)
        const ink = colorOf(theme.fg, machine.termColors, light)
        const paper = machine.termColors.bg ?? (theme.bg ? colorOf(theme.bg, machine.termColors, light) : light ? ([255, 255, 255] satisfies Rgb) : ([24, 24, 24] satisfies Rgb))
        const muted = colorOf(theme.muted || 'ansi256(8)', machine.termColors, light)
        const hex = (c: Rgb) => `#${c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`
        const inks = [ink, paper, colorOf('ansi256(15)', machine.termColors, light), colorOf('ansi256(0)', machine.termColors, light)]
        const known = shade || Boolean(machine.termColors.bg)
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
          const tone = from ? colorOf(tones[t.flashTones[from] ?? 'orange']?.solid ?? theme.accent, machine.termColors, light) : undefined
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
        const pixels = Image && !machine.imageDenied && (settings.treemapSetting === 'image' || (settings.treemapSetting === 'auto' && machine.kittyTerm))
        if (pixels && tiles.length) {
          const cell = machine.cellPx ?? { cw: 10, ch: 20 }
          const k = (Math.max(1, Math.round((cell.ch * 0.75) / 16)) * 16) / 0.75 / cell.ch
          const fit = fitPixels(cols, previewing.peekRows, cell.cw * k, cell.ch * k)
          const cw = (cell.cw * k) / fit.scale
          const ch = (cell.ch * k) / fit.scale
          const boxes = layoutPixels(scan.items, fit.width, fit.height, cw, ch, textHeight(ch))
          const under = new Map<Tile, Rgb>()
          const pixelLook = (tile: Tile): PixelLook => {
            const picked = tile.path === mapping.mapPick
            const { lift } = heat(tile, picked)
            const dim = dimmed(tile)
            const box = lift ? null : boxOf(tile)
            const seen = box ? box.fill : over((tile.parent && under.get(tile.parent)) || paper, lift?.[0] ?? accent, lift?.[1] ?? 1)
            under.set(tile, seen)
            return { fill: seen, alpha: 1, ink: box ? box.ink : readable(seen, 1, ink, paper), bold: true, rank: lift ? (picked ? 2 : 1) : 0, dim }
          }
          const looked = boxes.map(tile => ({ tile, look: pixelLook(tile) }))
          const key = JSON.stringify([fit, ink, looked.map(({ tile: b, look }) => [b.path, b.x0, b.y0, b.x1, b.y1, sized(b), look])])
          if (mapping.mapImage?.key !== key) {
            mapping.mapImage = { key, png: png(paint(looked, fit.width, fit.height, ch, sized), fit.width, fit.height).toBase64() }
          }
          const zone: ZoneProps = { columns: cols, rows: previewing.peekRows, boxes: boxes.map(b => [b.path, b.x0 / cw, b.y0 / ch, b.x1 / cw, b.y1 / ch]) }
          if (!machine.imageChecked) {
            machine.imageChecked = true
            $.clock.after(300, () => void $.ui.blit({ requestId: PANE, key: 'treemap-image', source: { png: mapping.mapImage?.png ?? '' } }).then(r => {
              if (r.deny && /alt/i.test(r.deny)) {
                machine.imageDenied = true
                $.ui.invalidate('ui.render')
              }
              if (r.deny) machine.imageChecked = false
            }))
          }
          content = (
            <Box key="treemap-box" position="relative" height={previewing.peekRows} width={cols}>
              <Image key="treemap-image" source={{ png: mapping.mapImage.png }} columns={cols} rows={previewing.peekRows} alt=" " />
              <Box position="absolute" top={0} left={0}>
                <Client key="treemap" module="./zone.tsx" props={zone} />
              </Box>
            </Box>
          )
        } else content = tiles.length
          ? <Client key="treemap" module="./rows.tsx" props={{ rows: draw(tiles, cols, previewing.peekRows, look, sized), active: '', ...rowColors, pointer: machine.pointer } satisfies RowsProps} />
          : <Text {...mutedText}>{scan.done ? 'empty' : 'sizing…'}</Text>
      } else if (!target) content = <Text {...mutedText}>no file selected</Text>
      else if (pic) {
        if (pic.state === 'ready' && Image) {
          const fit = fitCells(pic, Math.max(1, e.props.bodyColumns - 1), previewing.peekRows)
          status = isDoc ? `p ${page}/${pic.pages ?? '?'}` : `${pic.width}×${pic.height}`
          const raw = await pngOf($, pic)
          const big = Math.floor(raw.length * 3 / 4) > IMAGE_BYTES
          const png = big ? '' : raw
          content = big ? <Text {...mutedText}>{`${name}: too large to preview here`}</Text> : png ? <Image key="peek-image" source={{ png }} columns={fit.columns} rows={fit.rows} alt={name} /> : <Text {...mutedText}>{name}</Text>
        } else content = <Text {...mutedText}>{pic.state === 'pending' ? 'decoding…' : pic.state === 'failed' ? pic.note : 'images show in the terminal'}</Text>
      } else {
        if (isDoc && (previewing.peeked?.path !== target || (docKind === 'pdf' && previewing.peeked.page !== page))) {
          const want = `${target}\0${page}`
          if (previewing.docReading !== want) {
            previewing.docReading = want
            $.clock.after(0, () => void readPreview($, target, page).then(p => {
              if (previewing.docReading !== want) return
              previewing.docReading = ''
              if (previewing.peekPath === target) {
                previewing.peeked = p
                previewing.peekTop = 0
              }
              void $.ui.invalidate('ui.render')
            }, () => {
              if (previewing.docReading === want) previewing.docReading = ''
            }))
          }
          if (previewing.peeked?.path !== target) previewing.peeked = { path: target, text: '', note: 'reading…', page }
        } else if (previewing.peeked?.path !== target) {
          const at = previewing.peekAt?.path === target ? previewing.peekAt : null
          previewing.peeked = await readPreview($, target, 1, at?.line)
          if (at && !at.jumped) {
            at.jumped = true
            start = previewing.peekTop = Math.max(0, at.line - 3 - (previewing.peeked.first ?? 0))
          }
        }
        const first = previewing.peeked.first ?? 0
        const lines = previewing.peeked.text.split('\n')
        const last = Math.max(0, lines.length - previewing.peekRows)
        start = Math.min(start, last)
        const markdown = /\.(md|markdown|mdx|docx|odt|rtf)$/i.test(target)
        const win = previewLines(previewing.peeked.text, start, previewing.peekRows, markdown)
        status = `${docKind === 'pdf' ? `p ${page}${previewing.docCounts.has(target) ? `/${previewing.docCounts.get(target)}` : ''} ` : ''}${previewing.peeked.text ? `${first + start + 1}–${first + Math.min(lines.length, start + previewing.peekRows)}/${first + lines.length}` : ''}`.trim()
        const size = Math.max(1, Math.round((previewing.peekRows * previewing.peekRows) / Math.max(1, lines.length)))
        const bar = lines.length > previewing.peekRows ? { pos: last ? Math.round((start / last) * (previewing.peekRows - size)) : 0, size, thumb: theme.accent, track: theme.muted } : undefined
        if (!previewing.peeked.text) previewing.overPeek = false
        content = previewing.peeked.text
          ? <Client key="peek" module="./rows.tsx" props={{ rows: [], active: '', ...rowColors, pointer: machine.pointer, ...(bar ? { bar } : {}), preview: { text: win.text, path: target, startLine: first + win.top + 1, markdown, rows: previewing.peekRows } } satisfies RowsProps} />
          : <Text {...mutedText}>{raw?.state === 'pending' ? 'converting…' : previewing.peeked.note || 'empty file'}</Text>
      }
      const title = (
        <Box key="peek-title" flexDirection="row" height={1} overflow="hidden">
          <Box flexShrink={1} flexGrow={1} overflow="hidden">
            {anchor && anchor !== t.root && !target ? (
              <Button key="map-up" plain label={`${settings.glyphSetting === 'text' ? 'up ' : unicode ? '↑ ' : '\u{eaa1} '}${name}`} onPress={() => void mapUp($, anchor)} />
            ) : (
              <Text bold wrap="truncate-start">{name}</Text>
            )}
          </Box>
          {status ? <Box flexShrink={0}><Text {...mutedText}>{` ${status}`}</Text></Box> : null}
          {previewing.peeked?.note && previewing.peeked.text && !pic ? <Text {...mutedText}>{' partial'}</Text> : null}
        </Box>
      )
      const box = <Box key="peek-body" flexDirection="column" height={previewing.peekRows} overflow="hidden">{content}</Box>
      return settings.splitAt === 'top'
        ? <Box key="peek-split" flexDirection="column" flexShrink={0}>{title}{box}{rule}</Box>
        : <Box key="peek-split" flexDirection="column" flexShrink={0}>{rule}{title}{box}</Box>
    }
    const split = await peek()

    const paging = previewing.splitShown && Boolean(previewing.peekPath) && (pictureKind(previewing.peekPath) === 'pdf' || (pictureKind(previewing.peekPath) === 'office' && Boolean(Image) && !machine.imageDenied && !machine.inTmux && !machine.inHerdr))
    const park = () => focusPane($, t.root, paging ? 'rows' : 'hk-tree')
    const footerLink = footer && linking.links.has(footer) ? linking.linkStates.get(footer) : undefined
    if (footer && linking.links.has(footer) && !linking.linkStates.has(footer)) void classifyLink($, footer)
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
      ...(guarding.outside.length ? [{ key: 'w', label: 'outside writes', act: () => void navigate($, 'w', false, e.surface) }] : []),
      { key: 'c', label: 'match case', act: () => void navigate($, 'c', false, e.surface).then(park) },
      { key: 'r', label: 'regex', act: () => void navigate($, 'r', false, e.surface).then(park) },
      { key: 'q', label: 'contents', act: () => void navigate($, 'q', false, e.surface).then(park) },
      ...(paging ? [{ key: '[ ]', label: 'page', act: () => void (turnPage($, 1), park()) }] : []),
    ]
    const overlay = ui.shortcutsShown && !zjump.on
    const keyRows = overlay && !desk ? shortcutRows(theme.accent, theme.muted) : []
    ui.shortcutsPage = room
    ui.shortcutsMax = Math.max(0, keyRows.length - room)
    ui.shortcutsTop = Math.min(ui.shortcutsTop, ui.shortcutsMax)
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
      ...(['j', 'k', 'h', 'l'] as const).map((k): [string, () => void] => [k, () => void navigate($, k, false, ui.shortcutsShown || grepping ? e.surface : undefined).then(park)]),
      ...allKeys.filter(k => /^[a-z]$/.test(k.key)).map((k): [string, () => void] => [k.key, k.act]),
      ...(previewing.splitShown && e.surface !== 'desktop' ? (['f', 'b'] as const).map((k): [string, () => void] => [k, () => void navigate($, k, false, e.surface).then(park)]) : []),
    ]

    return (
      <Box flexDirection="column" minHeight={Math.max(1, e.props.scroll?.bodyRows ?? 1)} backgroundColor={theme.bg || undefined}>
        {desk && Svg ? (
          <Box key="head" flexDirection="row" alignItems="center">
            <Box flexDirection="row" alignItems="center" flexShrink={1} overflow="hidden" position="relative">
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
        {settings.splitAt === 'top' ? split : null}
        {branchRow()}
        {!t.top && settings.showHints && (!hintOn ? (desk && Svg ? <Svg key="git-hint" source={rowSvg(0, null, null, mutedInk)} alt="git status" width={STEP_PX * 2 + GAP_PX} height={ROW_PX} /> : <Text key="git-hint">{' '}</Text>) : desk && Svg ? (
          <Box key="git-hint" flexDirection="row" alignItems="center">
            <Svg key="git-hint-icon" source={rowSvg(0, null, 'git-branch', mutedInk)} alt="no git repo" width={STEP_PX * 2 + GAP_PX} height={ROW_PX} />
            <Text {...mutedText}>not a Git repo</Text>
          </Box>
        ) : <Text key="git-hint" {...mutedText}>{unicode ? '± ' : '\u{ea68} '}not a Git repo</Text>)}
        {settings.searchGap ? <Text key="gap-above"> </Text> : null}
        {desk && Svg ? (
          <Box key="search-bar" flexDirection="row" alignItems="center" backgroundColor={DESK.field} paddingX={1}>
            <Svg key="search-icon" source={iconSvg('search', mutedInk, 14)} alt="search" width={14} height={14} />
            {zjump.on ? (
              <Box key="jump-chip" flexShrink={0} flexDirection="row" marginLeft={1} paddingX={1} backgroundColor={settings.palette.jump ? `${settings.palette.jump}0f` : DESK.jumpOn}><Text color={settings.palette.jump ?? DESK.jump}>jump</Text></Box>
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
            {settings.glyphSetting === 'text' ? null : <Text {...mutedText}>{unicode ? '⌕ ' : '\u{ea6d} '}</Text>}
            {zjump.on ? <Text key="jump-chip" color={settings.palette.jump ?? JUMP_COLOR} bold>{'jump '}</Text> : scopeChip()}
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
              {toggle('content', settings.glyphSetting === 'text' ? 'in' : unicode ? '≡' : '\u{f09aa}', Boolean(t.searchContent), false)}
              <Text> </Text>
            </Box>
          </Box>
        )}
        {settings.sortHeader ? headerRow() : null}{settings.sortHeader ? headerRule() : settings.searchGap ? <Text key="gap-below"> </Text> : null}
        {desk ? (overlay ? deskShortcuts() : deskTree()) : (
          <Client
            key="rows"
            module="./rows.tsx"
            props={overlay ? { rows: keyRows.slice(ui.shortcutsTop, ui.shortcutsTop + room), active: '', ...rowColors, pointer: machine.pointer } satisfies RowsProps : { rows: specs, active: zjump.on ? (zjump.rows[zjump.sel] ?? "") : grepping ? (grep.rows[grep.sel] ? grepId(grep.rows[grep.sel] as GrepHit) : '') : inSet.has(t.cursor) ? t.cursor : '', ...rowColors, pointer: machine.pointer, ...(bar ? { bar } : {}) } satisfies RowsProps}
          />
        )}
        <Box flexGrow={1} />
        {settings.splitAt === 'bottom' ? split : null}
        {latest ? (
          <Box key="activity" flexDirection="row" height={1} overflow="hidden">
            <Box flexGrow={1} />
            {chip(latest)}
          </Box>
        ) : null}
        {(footer || tipText || settings.shortcutsSetting === 'auto') && (
          <Box flexDirection="row" height={1} overflow="hidden">
            {settings.shortcutsSetting === 'auto' ? (
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
            {picked.marked && !tipText ? <Box key="marked" flexShrink={0} marginLeft={2}><Button key="marked-clear" plain label={`${picked.ids.length} marked`} onPress={() => { clearMarks($); park() }}><Text color={desk ? accentInk : theme.accent}>{`${picked.ids.length} marked`}</Text></Button></Box> : null}
            {footerName && (desk || !tipText) ? (
              <Box flexShrink={1} marginLeft={2}>
                <Text {...mutedText} wrap="truncate-start">{footer && linking.links.has(footer) ? footerName + linkNote(footerLink) : footerName}</Text>
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
