import type { EngineInterface } from 'claude-code'
import { posix, dirname } from './tree'
import { zjump, ui, working, tree, settings } from './state'
import { get } from './store'
import { indexPaths } from './search'
import { focusPane, shortPath, cwdOf } from './util'
import { reset } from './root'

export type Visit = { n: number; at: number }
export type Candidate = { path: string; score: number }

const HOUR = 3_600_000

const VISITS = { plugin: 'filetree', key: 'visits' } as const
const ZOXIDE_TTL_MS = 10_000
const JUMP_INDEX_LIMIT = 4000
const JUMP_RECENT = 10
const jumpExists = new Map<string, boolean>()
let zoxideCache: { at: number; rows: Candidate[] } | null = null
let visitsCache: Record<string, Visit> | null = null

export function parseZoxide(stdout: string): Candidate[] {
  const out: Candidate[] = []
  for (const line of stdout.split('\n')) {
    const m = /^\s*([\d.]+)\s+(.+?)\s*$/.exec(line)
    if (m?.[2]) out.push({ path: m[2], score: Number(m[1]) })
  }
  return out
}

export function frecency(v: Visit, now: number): number {
  const age = now - v.at
  const weight = age < HOUR ? 4 : age < 24 * HOUR ? 2 : age < 7 * 24 * HOUR ? 0.5 : 0.25
  return v.n * weight
}

export function terms(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

export function jumpMatch(path: string, words: string[]): boolean {
  if (!words.length) return true
  const text = path.toLowerCase()
  let from = 0
  for (const w of words) {
    const at = text.indexOf(w, from)
    if (at < 0) return false
    from = at + w.length
  }
  const last = words[words.length - 1] ?? ''
  const base = text.slice(text.replace(/\/+$/, '').lastIndexOf('/') + 1)
  return base.includes(last)
}

function tier(path: string, last: string): number {
  if (!last) return 0
  const base = path.toLowerCase().slice(path.replace(/\/+$/, '').lastIndexOf('/') + 1)
  return base === last ? 0 : base.startsWith(last) ? 1 : base.includes(last) ? 2 : 3
}

export function rankJump(candidates: Candidate[], query: string, limit = 50): string[] {
  const words = terms(query)
  const last = words[words.length - 1] ?? ''
  const best = new Map<string, number>()
  for (const c of candidates) if (jumpMatch(c.path, words)) best.set(c.path, Math.max(best.get(c.path) ?? 0, c.score))
  return [...best]
    .map(([path, score]) => ({ path, score, tier: tier(path, last) }))
    .sort((a, b) => a.tier - b.tier || b.score - a.score || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .slice(0, limit)
    .map(r => r.path)
}

export function recentJump(visits: Record<string, Visit>): string[] {
  return Object.entries(visits)
    .sort((a, b) => b[1].at - a[1].at)
    .map(([path]) => path)
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

export async function recordVisit($: EngineInterface, dir: string): Promise<void> {
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
  const typed = zjump.query.trim() !== ''
  const recent = typed ? [] : recentJump(seen).map(posix).filter(p => p !== t.root).slice(0, JUMP_RECENT * 2)
  const ranked = typed ? rankJump(cands, zjump.query) : [...new Set([...recent, ...rankJump(cands, '').filter(p => p !== t.root)])]
  const known = new Set([t.root, ...dirs])
  const remembered = new Set(Object.keys(seen).map(posix))
  const there = await Promise.all(ranked.map(async p => known.has(p) || !remembered.has(p) || (jumpExists.get(p) ?? jumpExists.set(p, await $.fs.exists(p).catch(() => false)).get(p) ?? false)))
  if (mine !== zjump.seq || !zjump.on) return
  const gone = ranked.filter((_, k) => !there[k])
  if (gone.some(p => p in seen)) await forgetVisits($, gone)
  if (mine !== zjump.seq || !zjump.on) return
  zjump.rows = ranked.filter((_, k) => there[k]).slice(0, typed ? undefined : JUMP_RECENT)
  zjump.when = Object.fromEntries(Object.entries(seen).map(([p, v]) => [posix(p), v.at]))
  zjump.sel = Math.min(zjump.sel, Math.max(0, zjump.rows.length - 1))
  void $.ui.invalidate('ui.render')
}

async function forgetVisits($: EngineInterface, dirs: string[]): Promise<void> {
  visitsCache = Object.fromEntries(Object.entries(await visits($)).filter(([dir]) => !dirs.includes(posix(dir))))
  await $.state.set(VISITS, visitsCache)
}

export function jumpBlurCancel(): void {
  ui.jumpBlur?.cancel()
  ui.jumpBlur = null
}

export function jumpOpen($: EngineInterface): void {
  jumpBlurCancel()
  zjump.on = true
  jumpExists.clear()
  zjump.held = false
  zjump.query = ''
  zjump.sel = 0
  zjump.rows = []
  void jumpRefresh($)
  $.clock.after(50, async () => focusPane($, (await get($)).root, 'jump'))
}

export async function jumpInput($: EngineInterface, value: string): Promise<void> {
  if (!zjump.on) return
  zjump.query = value
  zjump.sel = 0
  await jumpRefresh($)
}

export function jumpClose($: EngineInterface, refocus = false): void {
  jumpBlurCancel()
  zjump.on = false
  zjump.query = ''
  zjump.rows = []
  zjump.seq += 1
  void $.ui.invalidate('ui.render')
  if (refocus) $.clock.after(50, async () => focusPane($, (await get($)).root, 'hk-tree'))
}

export async function canCd($: EngineInterface): Promise<boolean> {
  return (await $.command.list().catch(() => [])).some(c => c.name === 'cd')
}

export async function jumpTo($: EngineInterface, dir: string): Promise<void> {
  if (!(await $.fs.exists(dir).catch(() => false))) {
    await forgetVisits($, [dir])
    void $.ui.toast(`${shortPath(dir)} no longer exists`)
    void jumpRefresh($)
    return
  }
  jumpClose($, true)
  working.workLast = await $.clock.now()
  tree.follow = false
  await reset($, dir)
  if (!settings.jumpMovesClaude || (await cwdOf($)) === dir || !(await canCd($))) return
  $.clock.after(0, async () => {
    try {
      await $.command.run({ command: 'cd', args: dir })
    } catch (error) {
      void $.ui.toast(`could not move Claude to ${dir}: ${error instanceof Error ? error.message : String(error)}`)
    }
  })
}

export async function jumpKey($: EngineInterface, key: string): Promise<void> {
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
