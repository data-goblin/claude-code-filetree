import type { EngineInterface, RenderSurface } from 'claude-code'
import { get, patch } from './store'
import { inside } from './tree'
import type { FileTree } from '../types'
import { marking } from './state'
import { rowsOf } from './order'

const MARK_LIMIT = 100
const MARKS_FULL = `at most ${MARK_LIMIT} marks; press "${MARK_LIMIT} marked" in the footer to clear them`

export async function copyPaths($: EngineInterface, ids: string[], how: 'relative' | 'absolute' | 'name', surface?: RenderSurface): Promise<void> {
  const t = await get($)
  const one = (id: string) => (how === 'name' ? id.slice(id.lastIndexOf('/') + 1) || id : how === 'relative' && id !== t.root && inside(t.root, id) ? id.slice(t.root.endsWith('/') ? t.root.length : t.root.length + 1) : id)
  const text = ids.map(one).join('\n')
  const done = await $.ui.copy({ text, ...(surface ? { surface } : {}) })
  $.ui.toast(!done.isCopied ? `Could not copy the ${how === 'name' ? 'name' : 'path'}${ids.length > 1 ? 's' : ''}` : ids.length > 1 ? `Copied ${ids.length} ${how === 'name' ? 'names' : 'paths'}` : `Copied ${text}`)
}

export function copyPath($: EngineInterface, id: string, absolute: boolean, surface?: RenderSurface): Promise<void> {
  return copyPaths($, [id], absolute ? 'absolute' : 'relative', surface)
}

export function picks(t: FileTree): { ids: string[]; marked: boolean } {
  return marking.marks.length ? { ids: marking.marks, marked: true } : { ids: t.selected ? [t.selected] : [], marked: false }
}

export function anchorAt(id: string): void {
  marking.markAnchor = id
  marking.markBase = marking.marks.filter(m => m !== id)
}

function flip($: EngineInterface, t: FileTree, id: string, pin: boolean): boolean {
  const { ids, marked } = picks(t)
  const on = ids.includes(id)
  if (!on && ids.length >= MARK_LIMIT) {
    $.ui.toast(MARKS_FULL)
    return false
  }
  marking.marks = on && pin && !marked ? [id] : on ? ids.filter(m => m !== id) : [...ids, id]
  anchorAt(id)
  return true
}

export async function markRow($: EngineInterface, id: string): Promise<void> {
  if (flip($, await get($), id, true)) await patch($, cur => ({ selected: marking.marks.length ? cur.selected : '' }))
}

export function addMarks($: EngineInterface, ids: string[]): void {
  const fresh = ids.filter(id => id && !marking.marks.includes(id))
  const room = Math.max(0, MARK_LIMIT - marking.marks.length)
  if (fresh.length > room) $.ui.toast(MARKS_FULL)
  marking.marks = [...marking.marks, ...fresh.slice(0, room)]
  void $.ui.invalidate('ui.render')
}

export async function markRange($: EngineInterface, id: string): Promise<void> {
  const t = await get($)
  const ids = rowsOf(t).map(r => r.node.id)
  if (!ids.includes(marking.markAnchor)) anchorAt(ids.includes(t.cursor) ? t.cursor : id)
  const to = ids.indexOf(id)
  const from = ids.indexOf(marking.markAnchor)
  marking.marks = marking.markBase
  addMarks($, to < 0 ? [id] : ids.slice(Math.min(from, to), Math.max(from, to) + 1))
  await patch($, () => ({ cursor: id, selected: id }))
}

export async function pickRow($: EngineInterface, id: string): Promise<void> {
  if (flip($, await get($), id, false)) await patch($, () => ({ cursor: id, selected: marking.marks.length ? id : '' }))
}

export function pickOnly(id: string): void {
  marking.marks = []
  anchorAt(id)
}

export function clearMarks($: EngineInterface): void {
  if (!marking.marks.length) return
  marking.marks = []
  marking.markBase = []
  void patch($, cur => ({ selected: cur.cursor }))
}
