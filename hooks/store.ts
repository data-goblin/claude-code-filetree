import { type EngineInterface, update } from 'claude-code'
import type { FileTree, Activity } from '../types'
import { tree, settings, machine } from './state'
import { emptyTree } from './tree'

const TREE = { plugin: 'filetree', key: 'tree' } as const
const ACTIVITY = { plugin: 'filetree', key: 'activity' } as const
export const SHIMMER_KEY = /^filetree(@[^.]+)?\.shimmer$/

export async function readConfig($: EngineInterface): Promise<void> {
  const rows = await $.config.list()
  const theme = rows.find(r => r.key === 'theme')
  const light = typeof theme?.value === 'string' && theme.value.startsWith('light')
  const shimmer = rows.find(r => SHIMMER_KEY.test(r.key))
  const lit = shimmer ? shimmer.value !== 'off' : settings.shimmerOn
  if (light === machine.lightTerminal && lit === settings.shimmerOn) return
  machine.lightTerminal = light
  settings.shimmerOn = lit
  void $.ui.invalidate('ui.render')
}

export async function saveShimmer($: EngineInterface, lit: boolean): Promise<string> {
  const key = (await $.config.list().catch(() => [])).find(r => SHIMMER_KEY.test(r.key))?.key
  if (!key) return ''
  const result = await $.config.set({ key, value: lit ? 'on' : 'off' }).catch((err: unknown) => ({ deny: err instanceof Error ? err.message : String(err) }))
  return result.deny ?? ''
}

export function get(_$: EngineInterface): Promise<FileTree> {
  tree.cached ??= emptyTree('')
  return Promise.resolve(tree.cached)
}

export function put($: EngineInterface, fn: (t: FileTree) => FileTree): Promise<void> {
  tree.cached = fn(tree.cached ?? emptyTree(''))
  tree.snapshot ??= $.clock.after(1_000, () => {
    tree.snapshot = null
    if (tree.cached) void $.state.set(TREE, tree.cached)
  })
  $.ui.invalidate('ui.render')
  return Promise.resolve()
}

export function patch($: EngineInterface, fn: (t: FileTree) => Partial<FileTree>) {
  return put($, t => ({ ...t, ...fn(t) }))
}

export async function activities($: EngineInterface): Promise<Activity[]> {
  return (await $.state.get(ACTIVITY)).value ?? []
}

export async function setActivities($: EngineInterface, fn: (list: Activity[]) => Activity[]): Promise<void> {
  await update($, ACTIVITY, cur => fn(cur ?? []).slice(-6))
}
