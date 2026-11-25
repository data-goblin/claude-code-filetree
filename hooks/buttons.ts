import type { EngineInterface, PluginOptions, Timer } from 'claude-code'
import type { FileTree } from '../types'
import { settings, machine, flashing } from './state'
import { get, patch } from './store'
import { armCollapse, autoCollapseOn } from './activity'

export type ButtonName = 'shimmer' | 'hidden' | 'column' | 'collapse'

type Button = {
  values: readonly string[]
  fallback: string
  read: (t: FileTree) => string
  write: (v: string) => void
  live: (v: string) => Partial<FileTree>
  next: (was: string) => string
  stays: (v: string) => string
}

async function settleCollapse($: EngineInterface): Promise<void> {
  if (autoCollapseOn()) {
    const open = new Set((await get($)).expanded)
    for (const d of [...flashing.autoOpened.keys()]) if (!open.has(d)) flashing.autoOpened.delete(d)
    armCollapse($)
  } else {
    flashing.collapseTimer?.cancel()
    flashing.collapseTimer = null
    flashing.collapseAt = 0
  }
}

const AGE_TICK_MS = 60_000
let ageTick: Timer | null = null

export function syncAgeTick($: EngineInterface): void {
  ageTick?.cancel()
  ageTick = settings.showAge ? $.clock.every(AGE_TICK_MS, () => $.ui.invalidate('ui.render')) : null
}

const COLUMNS = ['date', 'age', 'size', 'loc', 'files'] as const

export const BUTTONS: Record<ButtonName, Button> = {
  shimmer: {
    values: ['on', 'off'],
    fallback: 'on',
    read: () => (settings.shimmerOn ? 'on' : 'off'),
    write: v => {
      settings.shimmerOn = v !== 'off'
    },
    live: () => ({}),
    next: was => (was === 'on' ? 'off' : 'on'),
    stays: v => `Activity shimmer stays ${v}`,
  },
  hidden: {
    values: ['show', 'hide'],
    fallback: 'show',
    read: t => (t.showHidden ? 'show' : 'hide'),
    write: v => {
      settings.showHiddenDefault = v !== 'hide'
    },
    live: v => ({ showHidden: v !== 'hide' }),
    next: was => (was === 'show' ? 'hide' : 'show'),
    stays: v => `Hidden files stay ${v === 'show' ? 'shown' : 'hidden'}`,
  },
  column: {
    values: ['date', 'age', 'size', 'loc', 'files'],
    fallback: 'date',
    read: t => (t.column === 'date' ? (settings.showAge ? 'age' : 'date') : t.column),
    write: v => {
      settings.showAge = v === 'age'
      settings.columnDefault = v === 'size' || v === 'loc' || v === 'files' ? v : 'date'
    },
    live: v => ({ column: v === 'size' || v === 'loc' || v === 'files' ? v : 'date' }),
    next: was => COLUMNS[(COLUMNS.findIndex(c => c === was) + 1) % COLUMNS.length] ?? 'date',
    stays: v => `Right column stays ${v}`,
  },
  collapse: {
    values: ['off', 'on'],
    fallback: 'off',
    read: () => (autoCollapseOn() ? 'on' : 'off'),
    write: v => {
      settings.autoCollapseDefault = v === 'on'
    },
    live: () => ({}),
    next: was => (was === 'on' ? 'off' : 'on'),
    stays: v => `Auto-collapse stays ${v}`,
  },
}

const NAMES = Object.keys(BUTTONS) as ButtonName[]
const KEYS = Object.fromEntries(NAMES.map(n => [n, new RegExp(`^filetree(@[^.]+)?\\.${n}$`)])) as Record<ButtonName, RegExp>

export function isButtonKey(key: string): boolean {
  return NAMES.some(n => KEYS[n].test(key))
}

function pick(name: ButtonName, raw: unknown): string | undefined {
  return typeof raw === 'string' && BUTTONS[name].values.includes(raw) ? raw : undefined
}

export function readButtons(options: PluginOptions): void {
  for (const name of NAMES) BUTTONS[name].write(pick(name, options?.[name]) ?? BUTTONS[name].fallback)
}

async function apply($: EngineInterface, name: ButtonName, value: string): Promise<void> {
  const button = BUTTONS[name]
  button.write(value)
  const live = button.live(value)
  if (Object.keys(live).length) await patch($, () => live)
  else void $.ui.invalidate('ui.render')
  if (name === 'column') syncAgeTick($)
  if (name === 'collapse') await settleCollapse($)
}

async function save($: EngineInterface, name: ButtonName, value: string): Promise<string> {
  const key = (await $.config.list().catch(() => [])).find(r => KEYS[name].test(r.key))?.key
  if (!key) return ''
  const result = await $.config.set({ key, value }).catch((err: unknown) => ({ deny: err instanceof Error ? err.message : String(err) }))
  return result.deny ?? ''
}

export async function pressButton($: EngineInterface, name: ButtonName): Promise<void> {
  const button = BUTTONS[name]
  const was = button.read(await get($))
  const to = button.next(was)
  await apply($, name, to)
  const deny = await save($, name, to)
  if (!deny) return
  await apply($, name, was)
  $.ui.toast(`${button.stays(was)}: ${deny}`)
}

export async function readConfig($: EngineInterface): Promise<void> {
  const rows = await $.config.list()
  const theme = rows.find(r => r.key === 'theme')
  const light = typeof theme?.value === 'string' && theme.value.startsWith('light')
  let changed = light !== machine.lightTerminal
  machine.lightTerminal = light
  for (const name of NAMES) {
    const value = pick(name, rows.find(r => KEYS[name].test(r.key))?.value)
    if (value === undefined || value === BUTTONS[name].read(await get($))) continue
    await apply($, name, value)
    changed = true
  }
  if (changed) void $.ui.invalidate('ui.render')
}
