import { type Usage, parseDu, REST } from './treemap'
import type { Timer, EngineInterface } from 'claude-code'
import { mapping, ui } from './state'
import { osName, stopStream, messageOf } from './util'
import { locArgv, locUsage, parseLocIn } from './loc'
import { pruneArgs, isIgnored, revealPaths } from './listing'
import { get, patch } from './store'
import { takeLoc, walkSize } from './sizes'
import { join, dirname, posix, inside, ancestorsOf } from './tree'
import { DOUBLE_MS } from './consts'

export type Scan = { dir: string; loc: boolean; items: Usage[]; total: number; done: boolean; stale: boolean; stopped: boolean; stop: () => void }
const SCAN_KEEP = 24
const SCAN_DRAW_MS = 100
const STALE_MS = 1500
const staleQueue = new Set<string>()
let staleTimer: Timer | null = null
const DU_DARWIN_SH = 'du -kxH -d 2 -- "$1"; find -x "$1" -mindepth 1 -maxdepth 2 -type f -exec du -kH -- {} +'

export function stopScans(keep = ''): void {
  for (const scan of mapping.scans.values()) {
    if (scan.done || scan.dir === keep) continue
    scan.stopped = true
    scan.stop()
    mapping.scans.delete(`${scan.loc ? 'loc:' : ''}${scan.dir}`)
  }
}

export function usageOf($: EngineInterface, dir: string, loc: boolean): Scan {
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

export async function mapUp($: EngineInterface, anchor: string): Promise<void> {
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

export async function pickTile($: EngineInterface, id: string): Promise<void> {
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

export async function mapKey($: EngineInterface, key: string): Promise<boolean> {
  const t = await get($)
  if (!mapping.mapLock || mapping.mapLock.cursor !== t.cursor || !mapping.mapLock.pick || (key !== 'return' && key !== 'l' && key !== 'right')) return false
  const pick = mapping.mapLock.pick
  const kind = t.nodes.find(n => n.id === pick)?.kind ?? (await $.fs.stat(pick).then(s => s.kind, () => 'file'))
  if (kind !== 'dir') return false
  drillTile($, pick, t.cursor)
  return true
}
