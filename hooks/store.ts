import { type EngineInterface, update } from 'claude-code'
import type { FileTree, Activity } from '../types'
import { tree } from './state'
import { emptyTree } from './tree'

const TREE = { plugin: 'filetree', key: 'tree' } as const
const ACTIVITY = { plugin: 'filetree', key: 'activity' } as const

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
