import type { EngineInterface } from 'claude-code'
import { collator, join, posix } from './tree'
import { resolve } from './git'
import { gotoMode, machine, zjump } from './state'
import { get } from './store'
import { focusPane, shortPath } from './util'
import { jumpClose, jumpTo } from './jump'

export const GOTO_LIMIT = 50
const GOTO_LINK_STATS = 100

export function pathParts(text: string): { head: string; frag: string } {
  const cut = text.lastIndexOf('/')
  return { head: text.slice(0, cut + 1), frag: text.slice(cut + 1) }
}

export function folderMatches(names: string[], frag: string): string[] {
  const want = frag.toLowerCase()
  return names.filter(n => n.toLowerCase().startsWith(want) && (want.startsWith('.') || !n.startsWith('.'))).sort(collator.compare)
}

export function completion(head: string, frag: string, names: string[]): string {
  if (frag === '..' || (frag === '~' && !head)) return `${frag}/`
  const [first, ...rest] = names
  if (first === undefined) return ''
  if (rest.length === 0) return `${first}/`
  let n = frag.length
  while (n < first.length && rest.every(x => x[n]?.toLowerCase() === first[n]?.toLowerCase())) n++
  return n > frag.length ? first.slice(0, n) : ''
}

export function gotoRows(): string[] {
  return gotoMode.names.slice(0, GOTO_LIMIT).map(name => join(gotoMode.dir, name))
}

export function gotoField(): string {
  return gotoMode.miss ? `goto-${gotoMode.miss}` : 'goto'
}

export function gotoValue(): string {
  const name = gotoMode.names[gotoMode.sel]
  return name === undefined ? gotoMode.typed : `${pathParts(posix(gotoMode.typed)).head}${name}/`
}

async function gotoRefresh($: EngineInterface): Promise<void> {
  const mine = ++gotoMode.seq
  const { head, frag } = pathParts(posix(gotoMode.typed))
  const dir = resolve((await get($)).root, head || '.', machine.home)
  let names: string[] = []
  try {
    const entries = new Map((await $.fs.list(dir)).map(e => [e.name, e]))
    const named = folderMatches([...entries.keys()], frag)
    const links = named.filter(name => entries.get(name)?.isLink).slice(0, GOTO_LINK_STATS)
    const linked = new Set((await Promise.all(links.map(name => $.fs.stat(join(dir, name)).then(s => (s.kind === 'dir' ? name : ''), () => '')))).filter(Boolean))
    names = named.filter(name => entries.get(name)?.kind === 'dir' || linked.has(name))
  } catch {
    names = []
  }
  if (mine !== gotoMode.seq || !gotoMode.on) return
  gotoMode.dir = dir
  gotoMode.names = names
  gotoMode.listed = true
  gotoMode.sel = Math.min(gotoMode.sel, Math.min(names.length, GOTO_LIMIT) - 1)
  void $.ui.invalidate('ui.render')
}

export async function gotoOpen($: EngineInterface): Promise<void> {
  if (zjump.on) jumpClose($)
  const shown = shortPath((await get($)).root)
  Object.assign(gotoMode, { on: true, typed: shown.endsWith('/') ? shown : `${shown}/`, sel: -1, dir: '', names: [], listed: false, note: '', held: false, focused: false, miss: 0 })
  void $.ui.invalidate('ui.render')
  void gotoRefresh($)
  $.clock.after(50, async () => focusPane($, (await get($)).root, gotoField()))
}

export function gotoClose($: EngineInterface, refocus = false): void {
  Object.assign(gotoMode, { on: false, typed: '', sel: -1, names: [], note: '' })
  gotoMode.seq += 1
  void $.ui.invalidate('ui.render')
  if (refocus) $.clock.after(50, async () => focusPane($, (await get($)).root, 'hk-tree'))
}

export async function gotoInput($: EngineInterface, value: string): Promise<void> {
  if (!gotoMode.on || value === gotoValue()) return
  Object.assign(gotoMode, { typed: value, sel: -1, note: '' })
  void $.ui.invalidate('ui.render')
  await gotoRefresh($)
}

async function gotoNext($: EngineInterface, complete: boolean): Promise<void> {
  gotoMode.field += 1
  if (complete && gotoMode.sel < 0) {
    const { head, frag } = pathParts(posix(gotoMode.typed))
    const done = completion(head, frag, gotoMode.names)
    if (done) return gotoInput($, head + done)
  }
  gotoMode.sel = Math.min(gotoRows().length - 1, gotoMode.sel + 1)
  void $.ui.invalidate('ui.render')
}

export async function gotoSubmit($: EngineInterface, text?: string): Promise<void> {
  if (text !== undefined) await gotoInput($, text)
  const dir = resolve((await get($)).root, gotoValue(), machine.home)
  const kind = await $.fs.stat(dir).then(s => s.kind, () => '')
  if (!gotoMode.on) return
  if (kind === 'dir') return gotoTo($, dir)
  gotoMode.note = kind ? 'not a folder' : 'no such folder'
  gotoMode.miss += 1
  void $.ui.invalidate('ui.render')
  focusPane($, (await get($)).root, gotoField())
}

export async function gotoTo($: EngineInterface, dir: string): Promise<void> {
  gotoClose($)
  await jumpTo($, dir)
}

export async function gotoKey($: EngineInterface, key: string, shift = false): Promise<void> {
  gotoMode.field += 1
  if (key === 'escape') gotoClose($, true)
  else if (key === 'return' || key === 'enter') await gotoSubmit($)
  else if (key === 'tab' && !shift) await gotoNext($, true)
  else if (key === 'down') await gotoNext($, false)
  else if (key === 'up' || key === 'tab') {
    gotoMode.sel = Math.max(-1, gotoMode.sel - 1)
    void $.ui.invalidate('ui.render')
  } else if (key === 'backspace' || key === 'delete') await gotoInput($, gotoValue().slice(0, -1))
  else if (key === 'space' || key === ' ' || [...key].length === 1) await gotoInput($, gotoValue() + (key === 'space' ? ' ' : key))
}
