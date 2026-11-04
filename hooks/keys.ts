import type { RowSpec } from './rows'

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
      { key: 'v / V', label: 'mark / clear marks' },
      { key: 'shift+j / k', label: 'mark and extend down / up' },
      { key: 'shift+click', label: 'mark from the last marked or clicked row' },
      { key: 'ctrl+click', label: 'open the file' },
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

export const SCROLL_KEYS: ReadonlySet<string> = new Set(['up', 'down', 'j', 'k', 'pageup', 'pagedown', 'f', 'b', 'home', 'end'])

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
