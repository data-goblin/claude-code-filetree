import type { EngineInterface, RenderSurface } from 'claude-code'
import type { FileNode } from '../types'
import { flashing, ui, tree, zjump, previewing, mapping, marking, settings } from './state'
import { get, patch, saveShimmer } from './store'
import { loadDirs, watchTree } from './listing'
import { DOUBLE_MS, SPIN_MS } from './consts'
import { isGhost, rowsOf, sortBy } from './order'
import { diffFile, peekTarget, toggleSplit, turnPage, scrollSplit } from './preview'
import { reset } from './root'
import { openFile, openTerminal, quickLook } from './editor'
import { jumpKey, jumpOpen } from './jump'
import { showOutside, toggleGuard } from './register'
import { grepOn, grepNav, grepAct } from './grep'
import { claimMarks, autoCollapseOn, armCollapse } from './activity'
import { picks, anchorAt, addMarks, clearMarks, markRow, copyPaths } from './select'
import { scopeSearch, searchFlag, search } from './search'
import { focusPane, osName, cwdOf } from './util'
import { dirname, dropBelow } from './tree'
import { staleSizes } from './sizes'
import { detectRepo, refreshGit } from './gitstate'
import { shortcutKey } from './keys'

const EXPAND_MAX = 150

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

export async function press($: EngineInterface, n: FileNode): Promise<void> {
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

export async function navigate($: EngineInterface, key: string, shift = false, surface?: RenderSurface): Promise<void> {
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

export async function pressHeader($: EngineInterface, id: string): Promise<void> {
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

export async function selectRoot($: EngineInterface): Promise<void> {
  mapping.mapLock = null
  await patch($, cur => ({ cursor: cur.root, selected: cur.root, scroll: null }))
}
