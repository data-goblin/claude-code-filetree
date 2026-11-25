import type { EngineInterface } from 'claude-code'
import type { Look } from './look'
import type { Layout } from './layout'
import type { Toolbar } from './toolbar'
import type { FileNode } from '../types'
import { settings, metrics, linking } from './state'
import type { Seg, RowSpec } from './rows'
import { formatLoc, counted } from './loc'
import { humanSize, age, stamp, underAny, dirname, relative, matchSpans, highlight } from './tree'
import { classifyLink } from './links'
import { CHEVRON_OPEN, CHEVRON_CLOSED, GUARD, isMemory, BRAIN, fileIcon } from './icons'
import { clean } from './util'

const NAME_MIN = 10
export const COLS = ['+', '-', '?', 'M', 'D', 'metric'] as const
export const GIT_COLS = ['+', '-', '?', 'M', 'D'] as const
export type Col = (typeof COLS)[number]

export function gridOf($: EngineInterface, c: Look & Layout & Toolbar) {
  const { t, unicode, desk, theme, rows, gitColors, addColor, delColor, warnColor, guarded, now, bright, dimmed, ignored, untracked, width, inSet, grepping, pinned, shown, drawn, totals } = c
  const sizePad = desk ? '\u2007' : ' '
  const isLong = (n: FileNode): boolean => settings.longFile > 0 && t.column === 'loc' && n.kind === 'file' && (metrics.locCache.get(n.id) ?? 0) > settings.longFile
  const cellsOf = (n: FileNode): Partial<Record<Col, Seg>> => {
    const loc = t.diff[n.id]
    const metric = t.column === 'loc'
      ? n.kind === 'dir'
        ? metrics.locCache.has(n.id)
          ? (metrics.locCache.get(n.id) ?? 0) >= 0 ? formatLoc(metrics.locCache.get(n.id) ?? 0) : ''
          : '…'
        : n.kind === 'file' && counted(n.name)
          ? metrics.locCache.has(n.id)
            ? formatLoc(metrics.locCache.get(n.id) ?? 0)
            : metrics.locListed.has(n.parent) ? '' : '…'
          : ''
      : t.column === 'files'
      ? n.kind === 'dir'
        ? metrics.fileCounts.has(n.id)
          ? (metrics.fileCounts.get(n.id) ?? -1) >= 0 ? formatLoc(metrics.fileCounts.get(n.id) ?? 0) : ''
          : '…'
        : ''
      : t.column === 'size'
      ? n.kind === 'dir'
        ? n.id in t.dirSizes
          ? humanSize(t.dirSizes[n.id] ?? -1, sizePad)
          : '…'
        : n.kind === 'file' || (n.kind === 'link' && n.size > 0)
          ? humanSize(n.size, sizePad)
          : ''
      : n.kind === 'file' || n.kind === 'dir'
        ? (when => (when ? (settings.showAge ? age(when, now) : stamp(when, settings.dateSetting, settings.clock)) : ''))(n.kind === 'dir' ? (metrics.dirTimes.get(n.id)?.[1] ?? 0) : n.mtime)
        : ''
    const counts = n.kind === 'dir' ? t.counts[n.id] : undefined
    const cells: Partial<Record<Col, Seg>> = {}
    if (loc && loc[0] > 0) cells['+'] = { t: `+${loc[0]}`, c: addColor }
    if (loc && loc[1] > 0) cells['-'] = { t: `-${loc[1]}`, c: delColor }
    if (counts && counts[0] > 0) cells['?'] = { t: `?:${counts[0]}`, c: gitColors['?'] ?? addColor }
    if (counts && counts[1] > 0) cells.M = { t: `M:${counts[1]}`, c: gitColors.M ?? 'ansi256(3)' }
    if (counts && counts[2] > 0) cells.D = { t: `D:${counts[2]}`, c: theme.urgent }
    if (metric) cells.metric = { t: metric, c: isLong(n) ? delColor : theme.muted }
    return cells
  }
  const tailRows = desk ? drawn : [...pinned, ...shown]
  const allCells = tailRows.map(r => cellsOf(r.node))
  const branchCells: Partial<Record<Col, Seg>> = {}
  if (totals[0] > 0) branchCells['+'] = { t: `+${totals[0]}`, c: addColor }
  if (totals[1] > 0) branchCells['-'] = { t: `-${totals[1]}`, c: delColor }
  const rootC = t.top ? t.counts[t.root] : undefined
  if (rootC && rootC[0] > 0) branchCells['?'] = { t: `?:${rootC[0]}`, c: gitColors['?'] ?? addColor }
  if (rootC && rootC[1] > 0) branchCells.M = { t: `M:${rootC[1]}`, c: gitColors.M ?? 'ansi256(3)' }
  if (rootC && rootC[2] > 0) branchCells.D = { t: `D:${rootC[2]}`, c: theme.urgent }
  const widths: Partial<Record<Col, number>> = {}
  for (const cells of [...allCells, branchCells]) for (const c of COLS) {
    const cell = cells[c]
    if (cell) widths[c] = Math.max(widths[c] ?? 0, [...cell.t].length)
  }
  const maxDepth = tailRows.reduce((m, r) => Math.max(m, r.depth), 0)
  const tailSum = () => COLS.reduce((w, c) => w + (widths[c] ? (widths[c] ?? 0) + 1 : 0), 0)
  if (width - 6 - maxDepth * 2 - tailSum() - 2 < NAME_MIN) delete widths.metric
  if (width - 6 - maxDepth * 2 - tailSum() - 2 < NAME_MIN) for (const c of GIT_COLS) delete widths[c]
  const tailCells = tailSum()
  const searching = Boolean(t.query.trim()) && !grepping
  const rowParts = (r: (typeof rows)[number]) => {
    const n = r.node
    const own = t.git[n.id]
    const status = own ?? (underAny(dirname(n.id), untracked, t.root) ? '?' : undefined)
    const isIgnored = !status && underAny(n.id, ignored, t.root)
    const gitColor = status === 'D' || status === 'U' ? theme.urgent : status ? (gitColors[status] ?? theme.muted) : undefined
    const isBright = settings.shimmerOn && bright.has(n.id)
    const isDim = settings.shimmerOn && !isBright && dimmed.has(n.id)
    const tone = t.flashTones[n.id] ?? 'orange'
    const isGuard = guarded.has(n.id)
    const iconColor = isGuard ? theme.urgent : isIgnored ? theme.muted : (gitColor ?? (n.hidden ? theme.muted : n.kind === 'dir' ? theme.accent : theme.muted))
    const nameColor = isIgnored ? theme.muted : (gitColor ?? (n.hidden ? theme.muted : theme.fg || undefined))
    const cells = cellsOf(n)
    if (cells.metric && gitColor && !isIgnored && !isLong(n)) cells.metric = { ...cells.metric, c: gitColor }
    const hasCounts = Boolean(cells['?'] || cells.M || cells.D)
    const badge = hasCounts ? '  ' : status ? ` ${status}` : isIgnored ? ' ⊘' : '  '
    const rel = relative(t.root, n.id)
    const spans = searching ? matchSpans(t.query, Boolean(t.searchCase), Boolean(t.searchRegex), rel) : []
    const hl = (text: string) => (spans.length ? highlight(text, spans, rel.length - n.name.length) : [{ t: text, hit: false }])
    const isPicked = inSet.has(n.id)
    const isLink = linking.links.has(n.id)
    const link = isLink ? linking.linkStates.get(n.id) : undefined
    if (isLink && !linking.linkStates.has(n.id)) void classifyLink($, n.id)
    const linkColor = link?.kind === 'broken' || link?.kind === 'circular' ? theme.urgent : link?.kind === 'outside' ? warnColor : theme.muted
    const cols = Math.max(4, width - r.depth * 2 - 6 - tailCells - badge.length - (isLink ? 2 : 0))
    const name = n.name.length > cols ? n.name.slice(0, cols - 1) + '…' : n.name
    const isCur = n.id === t.cursor
    const caret = n.kind === 'dir' ? (unicode ? (r.open ? '▾' : '▸') : r.open ? CHEVRON_OPEN : CHEVRON_CLOSED) + ' ' : isCur ? '▎ ' : '  '
    const isRepo = n.kind === 'dir' && n.id === t.top
    const glyph = isGuard ? (unicode ? GUARD.plain : GUARD.nerd) : unicode ? (n.kind === 'dir' ? '■' : isMemory(n) ? BRAIN.plain : '∙') : fileIcon(n, r.open, isRepo)
    const lit = isBright || isDim
    const left: Seg[] = [
      { t: '  '.repeat(r.depth) },
      { t: caret, c: isCur ? theme.accent : theme.muted, b: isCur || undefined },
      lit ? { t: glyph + ' ', sh: tone, dim: isDim, one: true } : { t: glyph + ' ', c: iconColor },
      ...(lit ? [{ t: name, sh: tone, dim: isDim, b: isBright }] : hl(name).map(x => ({ t: x.t, c: x.hit ? theme.accent : nameColor, b: x.hit || n.id === t.selected || isCur, s: status === 'D' && n.kind !== 'dir' }))),
      ...(isLink ? [{ t: ' →', c: linkColor }] : []),
    ]
    const right: Seg[] = COLS.filter(c => widths[c]).map(c => {
      const cell = cells[c]
      const pad = ' ' + (cell?.t ?? '').padStart(widths[c] ?? 0)
      return cell ? { t: pad, c: cell.c } : { t: pad }
    })
    right.push({ t: badge, c: status && !hasCounts ? gitColor : theme.muted, b: true })
    return { spec: { id: n.id, left: clean(left), right: clean(right), ...(isPicked ? { on: true as const } : {}) }, n, r, cells, status: hasCounts ? '' : (status ?? ''), gitColor, isIgnored: isIgnored && !hasCounts && !status, iconColor, nameColor, lit, tone, isDim, isBright, isRepo, isGuard, isPicked, isLink, link, linkColor, parts: hl(n.name) }
  }
  const rowSpec = (r: (typeof rows)[number]): RowSpec => rowParts(r).spec
  return { cellsOf, branchCells, widths, rowParts, rowSpec }
}

export type Grid = ReturnType<typeof gridOf>
