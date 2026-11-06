import type { EngineInterface, RenderSurface } from 'claude-code'
import { grep, settings, mapping, ui, previewing } from './state'
import type { FileTree } from '../types'
import { PRUNE, broad, HOME_PRUNE, globLiteral, isIgnored, revealPaths } from './listing'
import { join, relative, badPattern, posix, isAbsolute, ancestorsOf, dirname } from './tree'
import { toEre, compileRegex } from './regex'
import { stopStream, messageOf, focusPane } from './util'
import { patch, get } from './store'
import { PANE } from './consts'
import { picks, copyPaths, markRow } from './select'
import { scopeSearch } from './search'
import { loadPreview, parkPreview, diffFile } from './preview'
import { openTerminal } from './editor'
import { toggleGuard } from './guard'

export const GREP_LIMIT = 200
const GREP_MS = 15_000
const GREP_WAIT_MS = 150
const GREP_TEXT = 300
const GREP_WORK = 50_000_000
const GREP_LINE = 10_000
export type GrepHit = { path: string; line: number; text: string }

export function staleGrep($: EngineInterface): void {
  if (!grep.key) return
  grep.key = ''
  void $.ui.invalidate('ui.render')
}

export function grepOn(t: FileTree): boolean {
  return Boolean(t.searchContent) && Boolean(t.query.trim())
}

export function grepKey(t: FileTree): string {
  return JSON.stringify([t.root, t.top, t.query.trim(), Boolean(t.searchCase), Boolean(t.searchRegex), t.searchScope, t.showHidden])
}

export function grepId(h: GrepHit): string {
  return `grep:${h.line}:${h.path}`
}

function grepStop(): void {
  grep.stop?.()
  grep.stop = null
}

export function grepClear(): void {
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
  return [...PRUNE, ...(broad(t.root) ? HOME_PRUNE : []), ...settings.ignoreNames, ...(t.showHidden ? [] : ['.*'])]
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

export function grepRun($: EngineInterface, t: FileTree): void {
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
    const path = isAbsolute(raw) ? raw : join(t.root, raw.replace(/^\.[/]/, ''))
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

export async function openHit($: EngineInterface, h: GrepHit, surface?: RenderSurface): Promise<void> {
  mapping.mapLock = null
  const line = h.line || (grep.rows.find(r => r.path === h.path && r.line)?.line ?? 1)
  const top = Math.max(0, line - 3)
  if (surface === 'desktop' || ui.nativeScroll) {
    await revealPaths($, [h.path])
    await loadPreview($, h.path, line)
    previewing.deskLine = { path: h.path, top, scrolled: false, line }
    await patch($, cur => ({ preview: h.path, previewTop: Math.max(0, top - (previewing.previewed?.first ?? 0)), cursor: h.path, selected: h.path, expanded: [...new Set([...cur.expanded, ...ancestorsOf(h.path, cur.root)])] }))
    $.clock.after(100, () => parkPreview($))
    return
  }
  await revealPaths($, [h.path])
  previewing.peekAt = { path: h.path, line, jumped: false }
  if (previewing.peekPath === h.path) previewing.peeked = null
  else previewing.peekWant = { path: h.path, top }
  previewing.overPeek = false
  await patch($, cur => ({ split: true, preview: '', previewTop: 0, cursor: h.path, selected: h.path, expanded: [...new Set([...cur.expanded, ...ancestorsOf(h.path, cur.root)])] }))
}

export async function grepNav($: EngineInterface, key: string, surface?: RenderSurface): Promise<boolean> {
  const last = Math.min(grep.rows.length, surface === 'desktop' ? ui.deskGrepShown : Infinity) - 1
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

export async function grepAct($: EngineInterface, key: string, shift: boolean, surface?: RenderSurface): Promise<boolean> {
  if (!['x', 'd', 'v', 't', 'y', 'Y', 'u', 'i'].includes(key) || (key === 'v' && shift)) return false
  const path = grep.rows[grep.sel]?.path
  const { ids, marked } = picks(await get($))
  if (!path) {
    if ((key === 'y' || key === 'Y' || key === 'u') && marked) await copyPaths($, ids, key === 'u' ? 'name' : key === 'Y' || shift ? 'absolute' : 'relative', surface)
    return true
  }
  if (key === 'i') {
    const t = await get($)
    const dir = dirname(path)
    await scopeSearch($, dir === t.root ? '' : dir)
    $.clock.after(50, () => focusPane($, t.root, 'q'))
  } else if (key === 'x') await toggleGuard($, path)
  else if (key === 'd') await diffFile($, path)
  else if (key === 'v') await markRow($, path)
  else if (key === 't') await openTerminal($, dirname(path))
  else await copyPaths($, ids.length ? ids : [path], key === 'u' ? 'name' : key === 'Y' || shift ? 'absolute' : 'relative', surface)
  return true
}
