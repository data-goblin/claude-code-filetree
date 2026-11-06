import type { Hook } from 'claude-code'
import { has, focusPane, osName } from './util'
import { PANE, ROOT_PRESS, OUTSIDE } from './consts'
import { pressHeader, selectRoot, press, navigate } from './nav'
import { ui, previewing, zjump, grep, flashing } from './state'
import { scrollSplit, toggleSplit, turnPage, diffFile, closePreview, editPreview, jumpDiff, scrollPreview } from './preview'
import { pickTile, mapKey } from './scans'
import { sync } from './gitstate'
import { get, patch } from './store'
import { copyPath, pickOnly, markRange, pickRow } from './select'
import { jumpTo } from './jump'
import { grepId, openHit } from './grep'
import { ghostsOf } from './order'
import { claimMarks } from './activity'

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

export const onMessage: Hook<'ui.message'> = async ($, e, next) => {
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
}
