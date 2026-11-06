import type { Look } from './look'
import type { Layout } from './layout'
import type { Grid } from './cells'
import type { Columns } from './columns'
import type { RowSpec } from './rows'
import { zjump, settings, grep, ui } from './state'
import { clean, shortPath } from './util'
import { JUMP_COLOR } from './palette'
import { dirname, inside, relative } from './tree'
import type { FileNode } from '../types'
import { GREP_LIMIT, grepId } from './grep'
import { fileIcon } from './icons'
import { ROWS_BUDGET } from './register'

export function specsOf(c: Look & Layout & Grid & Columns) {
  const { t, unicode, desk, theme, rows, grepping, room, from, max, pinned, shown, rowSpec, jumpWhen } = c
  const note = (text: string): RowSpec => ({ id: '', left: [{ t: text, c: theme.muted }], right: [] })
  const jumpSpecs: RowSpec[] = zjump.rows.length
    ? zjump.rows.map(dir => ({ id: dir, left: clean([{ t: unicode ? '■ ' : '\u{e5ff} ', c: settings.palette.jump ?? JUMP_COLOR }, { t: dir.split('/').filter(Boolean).pop() ?? dir, c: theme.fg || undefined }, { t: `  ${shortPath(dirname(dir))}`, c: theme.muted }]), right: jumpWhen(dir) ? [{ t: ` ${jumpWhen(dir)} `, c: theme.muted }] : [] }))
    : [note('no matching folder')]
  const grepDigits = Math.max(2, ...grep.rows.map(h => String(h.line).length))
  const grepName = (path: string) => (inside(t.root, path) ? relative(t.root, path) : shortPath(path))
  const grepNode = (path: string): FileNode => ({ id: path, parent: dirname(path), name: path.slice(path.lastIndexOf('/') + 1), kind: 'file', hidden: false, mtime: 0, size: 0, loaded: true })
  const grepNote = !grepping ? '' : grep.rows.length === 0 ? (grep.busy ? 'searching…' : grep.note || 'no matches') : grep.capped ? `first ${GREP_LIMIT} matches; keep typing to narrow` : grep.note
  const grepRoom = Math.max(1, room - (grepNote ? 1 : 0))
  const grepFrom = ui.nativeScroll ? 0 : Math.max(0, Math.min(grep.sel - Math.floor(grepRoom / 2), grep.rows.length - grepRoom))
  const grepSpecs: RowSpec[] = !grepping ? [] : [
    ...grep.rows.slice(grepFrom, ui.nativeScroll ? undefined : grepFrom + grepRoom).map((h): RowSpec => h.line
      ? { id: grepId(h), left: clean([{ t: `    ${String(h.line).padStart(grepDigits)}  `, c: theme.muted }, { t: h.text, c: theme.fg || undefined }]), right: [] }
      : { id: grepId(h), left: clean([{ t: `${unicode ? '∙' : fileIcon(grepNode(h.path), false, false)} `, c: theme.muted }, { t: grepName(h.path), c: theme.fg || undefined, b: true }]), right: [{ t: ` ${h.text} `, c: theme.muted }] }),
    ...(grepNote ? [note(grepNote)] : []),
  ]
  const specs: RowSpec[] = zjump.on ? jumpSpecs : grepping ? grepSpecs : desk ? [] : [
    ...(rows.length === 0 ? [note('empty')] : []),
    ...pinned.map(rowSpec),
    ...(pinned.length > 0 ? [note('  ⋮')] : []),
    ...shown.map(rowSpec),
  ]
  if (ui.nativeScroll) {
    let size = 0
    const cut = specs.findIndex(r => (size += JSON.stringify(r).length + 1) > ROWS_BUDGET)
    if (cut >= 0) specs.splice(cut, specs.length - cut, note(`  … ${specs.length - cut} more rows, collapse folders or use search`))
  }
  const barSize = Math.max(1, Math.round((specs.length * shown.length) / Math.max(1, rows.length)))
  const bar =
    !ui.nativeScroll && !grepping && rows.length > shown.length + pinned.length
      ? { pos: max ? Math.round((from / max) * (specs.length - barSize)) : 0, size: barSize, thumb: theme.accent, track: theme.muted }
      : undefined
  return { grepDigits, grepName, grepNode, grepNote, specs, bar }
}

export type Specs = ReturnType<typeof specsOf>
