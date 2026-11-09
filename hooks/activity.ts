import { type Job, detectRepo, refreshGit, gitPaths } from './gitstate'
import type { FileTree } from '../types'
import { settings, ui, flashing, vcs, tree, previewing } from './state'
import type { EngineInterface } from 'claude-code'
import { get, patch } from './store'
import { BRANCH_ROW } from './consts'
import { ancestorsOf, join, inside, underAny, dirname, posix } from './tree'
import { exists } from './util'
import { staleSizes } from './sizes'
import { changedInRepo, changedSince, isIgnored, revealPaths, openDirs, loadDirs } from './listing'
import { followCwd } from './root'
import { anchorAt } from './select'
import { SEARCH_REVEAL_LIMIT } from './search'
import { staleGrep } from './grep'
import { rowsOf } from './order'
import { markStale } from './scans'

const FLASH_MS = 2700
const NO_REPO_DEPTH = 4
const FIND_LIMIT = 200
const READ_REVEAL_LIMIT = 12
const COLLAPSE_MS = 10_000
let scanning: Promise<void> | null = null
let scanJobs: Job[] = []

function keepTop(cur: FileTree, expanded: string[]): Partial<FileTree> {
  if (settings.followClaude) return { scroll: null }
  const top = rowsOf(cur)[cur.scroll ?? ui.view.from]?.node.id
  const at = top ? rowsOf({ ...cur, expanded }).findIndex(r => r.node.id === top) : -1
  return at < 0 ? {} : { scroll: at }
}

async function flash($: EngineInterface, tones: Record<string, string>): Promise<void> {
  const unique = Object.keys(tones)
  if (unique.length === 0) return
  const mine = ++flashing.generation
  const root = (await get($)).root
  flashing.blink?.cancel()
  flashing.blink = null
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
  if (flashing.generation !== mine) return
  flashing.blink = $.clock.after(FLASH_MS, () => {
    if (flashing.generation !== mine) return
    flashing.blink = null
    void patch($, () => (flashing.generation === mine ? { flash: [], flashDim: [], flashOn: false, flashTones: {} } : {}))
  })
}

async function afterBash($: EngineInterface, jobs: Job[]): Promise<void> {
  const reads = vcs.queuedReads
  vcs.queuedReads = []
  if (jobs.some(j => !j.readOnly)) staleGrep($)
  if (await followCwd($)) return
  const t = await get($)
  if (!t.root) return
  const actions = jobs.flatMap(j => j.actions)
  const writers = jobs.filter(j => !j.readOnly)
  const since = (writers.length ? writers : jobs).reduce((a, j) => (j.since.ms < a.ms ? j.since : a), (writers[0] ?? jobs[0])?.since ?? { ms: 0, mark: '', os: 'linux' as const })
  const writes = !jobs.every(j => j.readOnly)
  const before = vcs.dirty.root === t.root ? vcs.dirty.files : {}
  if (jobs.some(j => j.initRepo)) await detectRepo($)
  else if (!t.top && (await exists($, join(t.root, '.git')))) await detectRepo($)
  const probed = await get($)
  if (probed.top && (writes || probed.top !== t.top)) await refreshGit($)
  if (writes) {
    tree.searchIndex = null
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
    if (settings.showWrites) for (const id of hits) if (present.has(id)) tones[id] = touchTone
  }
  if (settings.showReads) {
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
  if (settings.showWrites && actions.length) {
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

export function scheduleScan($: EngineInterface, job: Job): void {
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

export function dropPreviews(paths: string[]): void {
  const changed = new Set(paths.map(posix))
  if (previewing.previewed && changed.has(previewing.previewed.path)) previewing.previewed = null
  if (previewing.peeked && changed.has(previewing.peeked.path)) previewing.peeked = null
}

export async function touched($: EngineInterface, paths: string[], tone: string, show: boolean): Promise<void> {
  if (tone !== 'purple') dropPreviews(paths)
  if (tone !== 'purple') markStale($, paths)
  if (tone !== 'purple') staleGrep($)
  if (await followCwd($)) return
  const t = await get($)
  if (!t.root) return
  const within = paths.map(posix).filter(p => inside(t.root, p) && !isIgnored(t.root, p)).slice(0, SEARCH_REVEAL_LIMIT)
  if (within.length === 0) return
  if (tone !== 'purple') {
    tree.searchIndex = null
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

export async function reveal($: EngineInterface, paths: string[]): Promise<void> {
  if (await followCwd($)) return
  await revealPaths($, paths)
  const opened: string[] = []
  const to = paths[paths.length - 1]
  if (to) anchorAt(to)
  await patch($, cur => {
    const open = new Set(cur.expanded)
    for (const p of paths) for (const a of ancestorsOf(p, cur.root)) if (!open.has(a)) {
      open.add(a)
      opened.push(a)
    }
    return { expanded: [...open], ...(to ? { cursor: to, selected: to } : {}), scroll: null }
  })
  await markOpened($, opened, paths)
}

async function markOpened($: EngineInterface, opened: string[], touched: string[]): Promise<void> {
  const until = (await $.clock.now()) + COLLAPSE_MS
  for (const d of opened) if (!flashing.autoOpened.has(d)) flashing.autoOpened.set(d, until)
  for (const d of flashing.autoOpened.keys()) if (touched.some(p => p === d || inside(d, p))) flashing.autoOpened.set(d, until)
  if (autoCollapseOn(await get($))) armCollapse($)
}

export function armCollapse($: EngineInterface): void {
  if (!flashing.autoOpened.size) return
  const next = Math.min(...flashing.autoOpened.values())
  if (flashing.collapseTimer && flashing.collapseAt <= next) return
  flashing.collapseTimer?.cancel()
  flashing.collapseAt = next
  void $.clock.now().then(now => {
    flashing.collapseTimer = $.clock.after(Math.max(1, next - now + 50), () => {
      flashing.collapseTimer = null
      flashing.collapseAt = 0
      void autoCollapse($)
    })
  })
}

export function clearAutoCollapse(): void {
  flashing.autoOpened.clear()
  flashing.collapseTimer?.cancel()
  flashing.collapseTimer = null
  flashing.collapseAt = 0
}

export function claimMarks(cursor: string): void {
  for (const d of [...flashing.autoOpened.keys()]) if (cursor === d || inside(d, cursor)) flashing.autoOpened.delete(d)
}

export function autoCollapseOn(t: FileTree): boolean {
  return t.autoCollapse ?? settings.autoCollapseDefault
}

async function autoCollapse($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  const t = await get($)
  if (!autoCollapseOn(t)) return
  const shut: string[] = []
  for (const [dir, until] of [...flashing.autoOpened]) {
    if (until > now) continue
    flashing.autoOpened.delete(dir)
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
