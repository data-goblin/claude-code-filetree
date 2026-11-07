import { type DiffLine, splitPatch, groupFiles } from './diff'
import type { EngineInterface } from 'claude-code'
import { previewing, guarding, settings, machine, pics } from './state'
import { unlessAborted, shortPath, messageOf, osName, focusPane } from './util'
import { OUTSIDE } from './consts'
import { focusKey } from './site'
import { pictureKind } from './peek'
import { formatSize, dirname } from './tree'
import { git } from './gitstate'
import { get, patch } from './store'
import { tmuxCommand, words, LINUX_LAUNCH } from './open'
import type { FileTree } from '../types'
import { editorHost, openInHerdr, openFile } from './editor'

export type Preview = { path: string; text: string; note: string; diff?: DiffLine[]; page?: number; first?: number }
const PREVIEW_CHARS = 90_000
const PREVIEW_LINE = 2_000

function fitSerialized(lines: string[], max: number): string[] {
  let size = 0
  for (let i = 0; i < lines.length; i++) {
    size += JSON.stringify(lines[i]).length
    if (size > max) return lines.slice(0, i)
  }
  return lines
}

export async function loadPreview($: EngineInterface, path: string, line?: number): Promise<void> {
  previewing.previewed = await readPreview($, path, 1, line)
}

async function docText($: EngineInterface, path: string, page: number): Promise<string> {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
  const argv = ext === 'pdf' ? ['timeout', '10', 'pdftotext', '-f', String(page), '-l', String(page), '-layout', '--', path, '-'] : ext === 'docx' || ext === 'odt' || ext === 'rtf' ? ['timeout', '10', 'pandoc', '-t', 'gfm', '--wrap=none', '--', path] : []
  if (!argv.length) return ''
  if (ext === 'pdf' && !previewing.docCounts.has(path)) {
    const info = await $.process.run(['timeout', '10', 'pdfinfo', '--', path], { timeoutMs: 15_000 }).catch(unlessAborted)
    const all = `${info?.stdout ?? ''}${info?.stderr ?? ''}`
    if (/Incorrect password/.test(all)) return '\0encrypted'
    const pages = Number(/^Pages:\s*(\d+)/m.exec(all)?.[1] ?? 0)
    if (pages) previewing.docCounts.set(path, pages)
  }
  const run = await $.process.run(argv, { timeoutMs: 15_000 }).catch(unlessAborted)
  return run?.exitCode === 0 ? run.stdout.replace(/\f/g, '\n').trimEnd() : ''
}

function previewWindow(text: string, line: number): { text: string; first: number } {
  const clean = text.replace(/\r\n?/g, '\n')
  let at = 0
  for (let n = 1; n < line && at >= 0; n++) at = clean.indexOf('\n', at) + 1 || -1
  if (at <= 0) return { text, first: 0 }
  const min = Math.max(0, at - Math.floor(PREVIEW_CHARS / 4))
  const back = min === 0 ? 0 : clean.indexOf('\n', min - 1) + 1 || at
  const from = Math.min(back, at)
  let first = 0
  for (let i = clean.indexOf('\n'); i >= 0 && i < from; i = clean.indexOf('\n', i + 1)) first++
  return { text: clean.slice(from), first }
}

export async function readPreview($: EngineInterface, path: string, page = 1, line?: number): Promise<Preview> {
  if (path === OUTSIDE) return { path, text: guarding.outside.map(shortPath).join('\n'), note: `${guarding.outside.length} file${guarding.outside.length === 1 ? '' : 's'} Claude wrote outside the repo this session` }
  let text = ''
  let note = ''
  try {
    const stat = await $.fs.stat(path)
    const kind = pictureKind(path)
    if (stat.kind !== 'file') note = 'not a regular file'
    else if (kind === 'pdf' || kind === 'office') {
      text = await docText($, path, page)
      if (text === '\0encrypted') {
        text = ''
        note = 'encrypted'
      } else if (!text) note = kind === 'pdf' && previewing.docCounts.has(path) ? `no text on page ${page}` : `${path.split('/').pop()}, ${formatSize(stat.size)}`
    }
    else if (stat.size > 4_000_000) note = `${formatSize(stat.size)}, too large to preview`
    else {
      text = await $.fs.read(path)
      if (text.slice(0, 8000).includes('\0')) {
        text = ''
        note = `binary file, ${formatSize(stat.size)}`
      }
    }
  } catch (err) {
    unlessAborted(err)
    note = `could not read: ${messageOf(err).split('\n')[0]}`
  }
  const total = text.length
  const win = line && total > PREVIEW_CHARS ? previewWindow(text, line) : { text, first: 0 }
  const first = win.first
  text = win.text
  let lines = text.slice(0, PREVIEW_CHARS).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').split('\n')
  if (lines.length > 1 && (text.length > PREVIEW_CHARS || lines.at(-1) === '')) lines.pop()
  lines = lines.map(l => (l.length > PREVIEW_LINE ? `${l.slice(0, PREVIEW_LINE)}…` : l))
  const fit = fitSerialized(lines, PREVIEW_CHARS)
  if (first) note = `lines ${(first + 1).toLocaleString('en')}–${(first + fit.length).toLocaleString('en')} of ${total.toLocaleString('en')} characters`
  else if (total > PREVIEW_CHARS || fit.length < lines.length) note = `first ${fit.length.toLocaleString('en')} lines of ${total.toLocaleString('en')} characters`
  return { path, text: fit.join('\n'), note, page, ...(first ? { first } : {}) }
}

async function loadDiff($: EngineInterface, path: string, folder: boolean): Promise<boolean> {
  const cwd = folder ? path : dirname(path)
  const born = await git($, cwd, ['rev-parse', '--verify', '--quiet', 'HEAD']).then(r => r.exitCode === 0, () => false)
  const base = born ? 'HEAD' : await git($, cwd, ['hash-object', '-t', 'tree', '--stdin'], 10_000, '').then(r => r.stdout.trim(), () => '')
  if (!base) return false
  const tracked = await git($, cwd, ['diff', base, '--no-color', '--no-ext-diff', '--src-prefix=a/', '--dst-prefix=b/', '--', path]).then(r => r.stdout, () => '')
  const others = await git($, cwd, ['ls-files', '--others', '--exclude-standard', '--full-name', '-z', '--', path]).then(r => r.stdout.split('\0').filter(Boolean), (): string[] => [])
  const top = (await get($)).top || cwd
  const files = splitPatch(tracked.slice(0, PREVIEW_CHARS))
  for (const rel of others.slice(0, 50)) {
    const run = await git($, top, ['diff', '--no-index', '--no-color', '--no-ext-diff', '--src-prefix=a/', '--dst-prefix=b/', '--', '/dev/null', rel]).catch(() => null)
    const file = run ? splitPatch(run.stdout.slice(0, PREVIEW_CHARS))[0] : undefined
    if (file) files.push({ path: rel, lines: file.lines })
  }
  if (!files.length) return false
  const many = folder || files.length > 1
  const lines = many ? groupFiles(files, folder ? settings.groupSetting : 'off').flatMap(g => ('group' in g ? [{ kind: '@' as const, text: g.group, old: 0, new: 0 }] : [{ kind: '@' as const, text: g.file.path, old: 0, new: 0 }, ...g.file.lines])) : files.flatMap(f => f.lines)
  const note = many ? `${files.length} changed file${files.length === 1 ? '' : 's'} against HEAD` : others.length ? 'untracked file' : 'changes against HEAD'
  previewing.previewed = { path, text: '', note, diff: lines }
  return true
}

export async function diffFile($: EngineInterface, path: string): Promise<void> {
  if (!settings.diffWithSetting) {
    const t = await get($)
    const folder = t.nodes.find(n => n.id === path)?.kind === 'dir'
    if (t.preview === path && previewing.previewed?.path === path && previewing.previewed.diff) return folder ? closePreview($) : showPreview($, path)
    if (!(await loadDiff($, path, folder))) {
      $.ui.toast(`no changes in ${shortPath(path)}`)
      return
    }
    await patch($, () => ({ preview: path, previewTop: 0, selected: path }))
    $.clock.after(100, () => parkPreview($))
    return
  }
  const os = await osName($)
  const host = await editorHost($, os)
  try {
    if (host === 'herdr') return await openInHerdr($, settings.diffWithSetting, path)
    if (host === 'tmux') {
      const run = await $.process.run(tmuxCommand(settings.targetSetting, dirname(path), [...words(settings.diffWithSetting), path]), { timeoutMs: 10_000 })
      if (run.exitCode !== 0) $.ui.toast(`could not diff ${shortPath(path)} with ${settings.diffWithSetting}: ${run.stderr.trim().split('\n')[0] || `exit ${run.exitCode}`}`)
      return
    }
    if (os === 'linux') {
      const argv = ['sh', '-c', LINUX_LAUNCH, 'sh', 'xdg-terminal-exec', 'sh', '-c', 'cd "$1" && shift && exec "$@"', 'sh', dirname(path), ...words(settings.diffWithSetting), path]
      const run = await $.process.run(argv, { timeoutMs: 10_000 })
      if (run.exitCode !== 0) $.ui.toast(`could not diff ${shortPath(path)} with ${settings.diffWithSetting}: ${run.stderr.trim().split('\n')[0] || `exit ${run.exitCode}`}`)
      return
    }
    $.ui.toast('Diff with: a terminal command needs tmux, herdr or Linux. Clear Diff with to see the diff in the pane.')
  } catch {
    $.ui.toast(`could not diff ${shortPath(path)} with ${settings.diffWithSetting}`)
  }
}

export async function toggleSplit($: EngineInterface): Promise<void> {
  previewing.overPeek = false
  previewing.peekTop = 0
  await patch($, cur => ({ split: !cur.split }))
}

export function scrollSplit($: EngineInterface, to: number): void {
  const last = Math.max(0, (previewing.peeked?.text.split('\n').length ?? 1) - previewing.peekRows)
  const top = Math.max(0, Math.min(last, to))
  if (top === previewing.peekTop) return
  previewing.peekTop = top
  void $.ui.invalidate('ui.render')
}

export function peekTarget(t: FileTree): string {
  const cur = t.nodes.find(n => n.id === t.cursor)
  if (cur) return cur.kind === 'dir' ? '' : cur.id
  const sel = t.selected ? t.nodes.find(n => n.id === t.selected) : undefined
  return sel && sel.kind !== 'dir' ? sel.id : ''
}

export async function showPreview($: EngineInterface, path: string): Promise<void> {
  await loadPreview($, path)
  await patch($, () => ({ preview: path, previewTop: 0, selected: path }))
  $.clock.after(100, () => parkPreview($))
}

function previewFocusKey(): 'edit' | 'back' {
  return !previewing.previewDesk && (settings.editWithSetting || machine.inTmux || machine.inHerdr) ? 'edit' : 'back'
}

export function parkPreview($: EngineInterface): void {
  void focusKey($, previewFocusKey()).catch(() => {})
}

export async function closePreview($: EngineInterface): Promise<void> {
  await patch($, () => ({ preview: '', previewTop: 0 }))
  $.clock.after(100, async () => focusPane($, (await get($)).root, 'hk-tree'))
}

export async function jumpDiff($: EngineInterface, dir: 1 | -1): Promise<void> {
  const lines = previewing.previewed?.diff
  if (!lines) return
  const files = lines.some(l => l.kind === '@')
  const marks = lines.flatMap((l, i) => {
    if (files) return l.kind === '@' ? [i] : []
    const prev = lines[i - 1]
    const gap = !prev || l.old !== prev.old + (prev.kind === '+' ? 0 : 1) || l.new !== prev.new + (prev.kind === '-' ? 0 : 1)
    return gap ? [i] : []
  })
  const t = await get($)
  const to = dir > 0 ? marks.find(i => i > t.previewTop) : [...marks].reverse().find(i => i < t.previewTop)
  if (to !== undefined) await patch($, () => ({ previewTop: to }))
}

export async function scrollPreview($: EngineInterface, by: number): Promise<void> {
  const t = await get($)
  const last = Math.max(0, (previewing.previewed?.diff?.length ?? previewing.previewed?.text.split('\n').length ?? 1) - previewing.previewRows)
  const top = Math.max(0, Math.min(last, t.previewTop + by))
  if (top !== t.previewTop) await patch($, () => ({ previewTop: top }))
}

export function previewLines(text: string, top: number, rows: number, markdown: boolean): { text: string; top: number } {
  const lines = text.split('\n')
  const from = Math.max(0, Math.min(top, lines.length - 1))
  let shown = lines.slice(from, from + rows)
  if (markdown) {
    let fence = ''
    let opener = ''
    for (const line of lines.slice(0, from)) {
      const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
      if (!m) continue
      const mark = m[1] ?? ''
      if (!fence) {
        fence = mark
        opener = line.trimStart()
      } else if (mark[0] === fence[0] && mark.length >= fence.length && !(m[2] ?? '').trim()) fence = ''
    }
    if (fence) shown = [opener, ...shown]
  }
  return { text: shown.join('\n'), top: from }
}

export async function editPreview($: EngineInterface, path: string): Promise<void> {
  if (settings.editWithSetting || machine.inTmux || machine.inHerdr) await openFile($, path, { mode: settings.editWithSetting || 'editor', line: previewing.previewLine })
}

export function turnPage($: EngineInterface, by: number): boolean {
  const kind = previewing.peekPath ? pictureKind(previewing.peekPath) : ''
  if (kind !== 'pdf' && kind !== 'office') return false
  if (kind === 'office' && !pics.pictures.has(`${previewing.peekPath}\0${previewing.docPages.get(previewing.peekPath) ?? 1}`)) return true
  const now = previewing.docPages.get(previewing.peekPath) ?? 1
  const next = Math.max(1, Math.min(previewing.docCounts.get(previewing.peekPath) ?? now + 1, now + by))
  if (next !== now) {
    previewing.docPages.set(previewing.peekPath, next)
    void $.ui.invalidate('ui.render')
  }
  return true
}
