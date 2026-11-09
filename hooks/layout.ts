import type { EngineInterface } from 'claude-code'
import type { Look } from './look'
import { ui, settings, zjump, gotoMode, grep, previewing, metrics } from './state'
import { activities } from './store'
import { ACTIVITY_TTL_MS } from './gitstate'
import { rowsOf } from './order'
import { picks } from './select'
import { grepOn, grepKey, grepRun } from './grep'
import { peekTarget } from './preview'
import { BRANCH_ROW } from './consts'
import { wantTimes, wantSizes, wantCounts, wantLoc } from './sizes'
import { counted } from './loc'

const RUNNING_MAX_MS = 600_000
export const DESK_ROWS = 150
const HINT_MS = 5_000

export async function layoutOf($: EngineInterface, v: Look) {
  const { e, t, desk } = v
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
  const grepping = !zjump.on && !gotoMode.on && grepOn(t)
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
  return { now, hintOn, latest, bright, dimmed, ignored, untracked, width, rows, picked, inSet, grepping, footer, splitRows, room, at, from, pinned, max, shown, deskFrom, drawn }
}

export type Layout = Awaited<ReturnType<typeof layoutOf>>
