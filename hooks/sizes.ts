import type { EngineInterface } from 'claude-code'
import { join, inside, dirname } from './tree'
import { rootOfDisk, pruneArgs, PRUNE } from './listing'
import { osName } from './util'
import { metrics } from './state'
import { patch, get } from './store'
import { sumDirs, locArgv, scanFrom, parseLocIn, scanned } from './loc'
import type { FileNode } from '../types'

const SIZE_TIMEOUT_MS = 15_000
const SIZE_JOBS = 2
const SIZE_WALK_LIMIT = 50_000
let sizeActive = 0
let timeActive = 0
const TIME_TRIES = 3
let locActive = 0

export async function walkSize($: EngineInterface, dir: string): Promise<number> {
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
  while (sizeActive < SIZE_JOBS && metrics.sizeQueue.length) {
    const dir = metrics.sizeQueue.shift() ?? ''
    const epoch = metrics.sizeEpoch
    metrics.sizing.add(dir)
    sizeActive += 1
    void dirSize($, dir)
      .then(async bytes => {
        if (epoch === metrics.sizeEpoch) return patch($, cur => (inside(cur.root, dir) ? { dirSizes: { ...cur.dirSizes, [dir]: bytes } } : {}))
        const cur = await get($)
        if (cur.column === 'size' && inside(cur.root, dir) && !(dir in cur.dirSizes) && !metrics.sizeQueue.includes(dir)) metrics.sizeQueue.push(dir)
      })
      .catch(() => undefined)
      .finally(() => {
        metrics.sizing.delete(dir)
        sizeActive -= 1
        pumpSizes($)
      })
  }
}

export function takeLoc(files: Map<string, number>, dir: string, deep: boolean): void {
  for (const [path, n] of files) metrics.locCache.set(path, n)
  if (deep) {
    for (const [d, n] of sumDirs(files, dir)) {
      metrics.locCache.set(d, n)
      metrics.locListed.add(d)
    }
  }
  metrics.locListed.add(dir)
}

function pumpLoc($: EngineInterface): void {
  while (locActive < SIZE_JOBS && metrics.locQueue.length) {
    const [dir, deep] = metrics.locQueue.shift() ?? ['', false]
    const epoch = metrics.sizeEpoch
    const key = `${deep ? 'd' : 's'}${dir}`
    metrics.locBusy.add(key)
    locActive += 1
    const giveUp = () => {
      if (epoch !== metrics.sizeEpoch) return
      if (deep && !metrics.locCache.has(dir)) metrics.locCache.set(dir, -1)
      metrics.locListed.add(dir)
      void $.ui.invalidate('ui.render')
    }
    void (async () => {
      if ((await osName($)) === 'win32') return giveUp()
      const t = await get($)
      const argv = locArgv(dir, pruneArgs(t.root))
      const run = await $.process.run(deep ? argv : [argv[0] ?? 'find', argv[1] ?? scanFrom(dir), '-maxdepth', '1', ...argv.slice(2)], { timeoutMs: SIZE_TIMEOUT_MS })
      if (epoch !== metrics.sizeEpoch) return
      takeLoc(parseLocIn(run.stdout, dir), dir, deep)
      metrics.locTries.delete(key)
      void $.ui.invalidate('ui.render')
    })()
      .catch(() => {
        if (epoch !== metrics.sizeEpoch) return
        const tries = (metrics.locTries.get(key) ?? 0) + 1
        metrics.locTries.set(key, tries)
        if (tries < TIME_TRIES) {
          if (!metrics.locQueue.some(([d, k]) => d === dir && k === deep)) metrics.locQueue.push([dir, deep])
          return
        }
        giveUp()
      })
      .finally(() => {
        metrics.locBusy.delete(key)
        locActive -= 1
        if (epoch !== metrics.sizeEpoch) {
          if (!(deep ? metrics.locCache.has(dir) : metrics.locListed.has(dir)) && !metrics.locQueue.some(([d, k]) => d === dir && k === deep)) metrics.locQueue.push([dir, deep])
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
  for (const [d, n] of counts) metrics.fileCounts.set(d, n)
}

function pumpCounts($: EngineInterface): void {
  while (metrics.counting.size < SIZE_JOBS && metrics.countQueue.length) {
    const dir = metrics.countQueue.shift() ?? ''
    const epoch = metrics.sizeEpoch
    metrics.counting.add(dir)
    void (async () => {
      if ((await osName($)) === 'win32') {
        metrics.fileCounts.set(dir, -1)
        return
      }
      const t = await get($)
      const run = await $.process.run(['find', scanFrom(dir), ...pruneArgs(t.root), '-type', 'f', '-print'], { timeoutMs: SIZE_TIMEOUT_MS })
      if (epoch !== metrics.sizeEpoch) return
      takeCounts(run.stdout, dir)
      metrics.countTries.delete(dir)
    })()
      .catch(() => {
        if (epoch !== metrics.sizeEpoch) return
        const tries = (metrics.countTries.get(dir) ?? 0) + 1
        metrics.countTries.set(dir, tries)
        if (tries < TIME_TRIES) metrics.countQueue.push(dir)
        else metrics.fileCounts.set(dir, -1)
      })
      .finally(() => {
        metrics.counting.delete(dir)
        void $.ui.invalidate('ui.render')
        pumpCounts($)
      })
  }
}

export function wantCounts($: EngineInterface, dirs: string[]): void {
  for (const dir of dirs) if (!metrics.counting.has(dir) && !metrics.countQueue.includes(dir)) metrics.countQueue.push(dir)
  pumpCounts($)
}

export function wantLoc($: EngineInterface, dirs: string[], deep: boolean): void {
  for (const dir of dirs) {
    if (metrics.locBusy.has(`${deep ? 'd' : 's'}${dir}`) || metrics.locQueue.some(([d, k]) => d === dir && k === deep)) continue
    metrics.locQueue.push([dir, deep])
  }
  pumpLoc($)
}

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
  while (timeActive < SIZE_JOBS && metrics.timeQueue.length) {
    const [dir] = metrics.timeQueue.shift() ?? ['', 0]
    if (metrics.dirTimes.has(dir) || [...metrics.timing].some(w => inside(w, dir))) continue
    const epoch = metrics.sizeEpoch
    timeActive += 1
    metrics.timing.add(dir)
    void (async () => {
      const t = await get($)
      const found = await newestUnder($, dir, pruneArgs(t.root))
      if (epoch !== metrics.sizeEpoch) return
      for (const [d, ms] of found) metrics.dirTimes.set(d, [0, ms])
      metrics.timeTries.delete(dir)
      void $.ui.invalidate('ui.render')
    })()
      .catch(() => {
        if (epoch !== metrics.sizeEpoch) return
        const tries = (metrics.timeTries.get(dir) ?? 0) + 1
        metrics.timeTries.set(dir, tries)
        if (tries < TIME_TRIES) {
          if (!metrics.timeQueue.some(([d]) => d === dir)) metrics.timeQueue.push([dir, 0])
          return
        }
        metrics.timeFailed.add(dir)
        void $.ui.invalidate('ui.render')
      })
      .finally(() => {
        timeActive -= 1
        metrics.timing.delete(dir)
        if (epoch !== metrics.sizeEpoch) {
          if (!metrics.dirTimes.has(dir) && !metrics.timeQueue.some(([d]) => d === dir)) metrics.timeQueue.push([dir, 0])
          void $.ui.invalidate('ui.render')
        }
        pumpTimes($)
      })
  }
}

export function wantTimes($: EngineInterface, dirs: FileNode[]): void {
  for (const n of dirs) {
    if (metrics.dirTimes.has(n.id) || metrics.timeFailed.has(n.id) || metrics.timing.has(n.id) || metrics.timeQueue.some(([d]) => d === n.id)) continue
    metrics.timeQueue.push([n.id, 0])
  }
  metrics.timeQueue.sort(([a], [b]) => a.length - b.length)
  pumpTimes($)
}

export function wantSizes($: EngineInterface, dirs: string[]): void {
  for (const dir of dirs) if (!metrics.sizing.has(dir) && !metrics.sizeQueue.includes(dir)) metrics.sizeQueue.push(dir)
  pumpSizes($)
}

export async function staleSizes($: EngineInterface, paths?: string[]): Promise<void> {
  metrics.sizeEpoch += 1
  metrics.sizeQueue = []
  metrics.locQueue = []
  metrics.timeQueue = []
  if (!paths) {
    metrics.locCache.clear()
    metrics.locListed.clear()
    metrics.dirTimes.clear()
    metrics.timeFailed.clear()
    metrics.timeTries.clear()
    metrics.locTries.clear()
  }
  if (!paths) {
    metrics.fileCounts.clear()
    metrics.countTries.clear()
  }
  metrics.countQueue = []
  for (const p of paths ?? []) {
    metrics.locCache.delete(p)
    metrics.locListed.delete(p)
    for (let d = dirname(p), prev = p; d !== prev; prev = d, d = dirname(d)) metrics.fileCounts.delete(d)
    for (const d of [...metrics.fileCounts.keys()]) if (inside(p, d)) metrics.fileCounts.delete(d)
    for (let d = p, prev = ''; d !== prev; prev = d, d = dirname(d)) {
      metrics.dirTimes.delete(d)
      metrics.timeFailed.delete(d)
    }
    for (const d of [...metrics.dirTimes.keys()]) if (inside(p, d)) metrics.dirTimes.delete(d)
    for (let d = dirname(p), prev = p; d !== prev; prev = d, d = dirname(d)) {
      metrics.locCache.delete(d)
      metrics.locListed.delete(d)
    }
  }
  await patch($, cur => {
    if (!paths) return { dirSizes: {} }
    const keep: Record<string, number> = {}
    for (const [dir, bytes] of Object.entries(cur.dirSizes)) if (!paths.some(p => inside(dir, p))) keep[dir] = bytes
    return { dirSizes: keep }
  })
}
