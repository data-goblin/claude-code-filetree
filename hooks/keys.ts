import type { RowSpec } from './rows'
import type { EngineInterface, RenderSurface } from 'claude-code'
import { ui } from './state'
import { PANE } from './consts'

export type ShortcutKey = { key: string; label: string; terminal?: true }
export type ShortcutGroup = { title: string; keys: ShortcutKey[] }

const GROUPS: readonly ShortcutGroup[] = [
  {
    title: 'Move',
    keys: [
      { key: 'j / k', label: 'down / up' },
      { key: 'h / l', label: 'collapse or parent / expand' },
      { key: 'o, Enter', label: 'open a file or toggle a folder' },
      { key: 'z', label: 'jump to a folder' },
      { key: 'e', label: 'go to a folder by path' },
      { key: 'Space', label: 'Quick Look on macOS', terminal: true },
    ],
  },
  {
    title: 'Search',
    keys: [
      { key: 's', label: 'focus search' },
      { key: 'i', label: 'search in the folder under the cursor' },
      { key: 'c / r', label: 'match case / regular expression' },
      { key: 'q', label: 'search file contents instead of names' },
    ],
  },
  {
    title: 'Files and actions',
    keys: [
      { key: 'd', label: 'diff' },
      { key: 'click', label: 'select one row' },
      { key: 'ctrl+click', label: 'add or drop a row; alt+click on macOS' },
      { key: 'shift+click', label: 'select the range from the anchor' },
      { key: 'shift+j / k', label: 'extend the selection down / up' },
      { key: 'v / V', label: 'add or drop the row / clear the marks' },
      { key: 'y / Y', label: 'copy relative / absolute path' },
      { key: 'u', label: 'copy the name' },
      { key: 't', label: 'shell in a tmux or herdr pane' },
      { key: 'x', label: "guard from Claude's edits" },
      { key: 'w', label: 'files written outside the repo' },
    ],
  },
  {
    title: 'View',
    keys: [
      { key: 'p', label: 'preview or treemap', terminal: true },
      { key: 'f / b', label: 'page the preview', terminal: true },
      { key: '[ / ]', label: 'previous / next PDF or Word page', terminal: true },
      { key: 'a', label: 'auto-collapse' },
      { key: 'n / g / m', label: 'sort by name / git / value' },
    ],
  },
  {
    title: 'Pane',
    keys: [
      { key: '?', label: 'show or hide this list', terminal: true },
      { key: 'ctrl+x tab', label: 'give the pane the keyboard', terminal: true },
      { key: 'alt+l', label: 'give the tree the keyboard', terminal: true },
      { key: 'alt+h', label: 'back to the prompt', terminal: true },
      { key: '/filetree keys', label: 'set up alt+l and alt+h', terminal: true },
      { key: 'Esc', label: 'back to the prompt', terminal: true },
    ],
  },
]

const SCROLL_KEYS: ReadonlySet<string> = new Set(['up', 'down', 'j', 'k', 'pageup', 'pagedown', 'f', 'b', 'home', 'end'])

let deskKeysAt = 0

export function shortcutGroups(desktop: boolean): ShortcutGroup[] {
  return GROUPS.map(g => ({ title: g.title, keys: g.keys.filter(k => !desktop || !k.terminal) })).filter(g => g.keys.length > 0)
}

export function shortcutRows(accent: string, muted: string): RowSpec[] {
  const groups = shortcutGroups(false)
  const width = Math.max(...groups.flatMap(g => g.keys.map(k => k.key.length))) + 2
  const rows: RowSpec[] = [{ id: '', left: [{ t: ' Keyboard shortcuts', b: true, c: accent }], right: [{ t: '? closes ', c: muted }] }]
  for (const g of groups) {
    rows.push({ id: '', left: [{ t: ' ' }], right: [] })
    rows.push({ id: '', left: [{ t: ` ${g.title}`, b: true }], right: [] })
    for (const k of g.keys) rows.push({ id: '', left: [{ t: `   ${k.key.padEnd(width)}`, c: accent }, { t: k.label }], right: [] })
  }
  return rows
}

export function toggleShortcuts($: EngineInterface, open = !ui.shortcutsShown): void {
  ui.shortcutsShown = open
  ui.shortcutsTop = 0
  deskKeysAt = 0
  void $.ui.invalidate('ui.render')
}

export function scrollShortcuts($: EngineInterface, by: number): void {
  const top = Math.max(0, Math.min(ui.shortcutsMax, ui.shortcutsTop + by))
  if (top === ui.shortcutsTop) return
  ui.shortcutsTop = top
  void $.ui.invalidate('ui.render')
}

export function shortcutKey($: EngineInterface, key: string, surface?: RenderSurface): boolean {
  if (key === '?') {
    toggleShortcuts($)
    return true
  }
  if (!ui.shortcutsShown) return false
  if (SCROLL_KEYS.has(key)) {
    const page = Math.max(1, ui.shortcutsPage - 1)
    const by: Record<string, number> = { up: -1, k: -1, down: 1, j: 1, pageup: -page, b: -page, pagedown: page, f: page, home: -Infinity, end: Infinity }
    if (surface !== 'desktop') scrollShortcuts($, by[key] ?? 0)
    else {
      const titles = shortcutGroups(true).map(g => g.title)
      const step = by[key] ?? 0
      deskKeysAt = Math.max(0, Math.min(titles.length - 1, deskKeysAt + (Number.isFinite(step) ? Math.sign(step) * (Math.abs(step) > 1 ? 3 : 1) : step)))
      void $.ui.scroll({ to: { key: `keys-${titles[deskKeysAt]}` }, in: PANE, block: 'start' }).catch(() => undefined)
    }
    return true
  }
  toggleShortcuts($, false)
  return false
}
