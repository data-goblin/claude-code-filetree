import type { EngineInterface } from 'claude-code'
import { get, put } from './store'
import { flashing, metrics, ui, marking, linking, tree, settings } from './state'
import { clearAutoCollapse } from './activity'
import { emptyTree } from './tree'
import { loadDirs } from './listing'
import { detectRepo, refreshGit } from './gitstate'
import { openPane } from './site'
import { cwdOf } from './util'
import { grepClear } from './grep'
import { recordVisit } from './jump'

let lastRoot = ''

export async function reset($: EngineInterface, root: string, focus = false, ready?: Promise<void>): Promise<void> {
  const prev = await get($)
  flashing.generation += 1
  flashing.blink?.cancel()
  flashing.blink = null
  if (root) void recordVisit($, root)
  clearAutoCollapse()
  metrics.dirTimes.clear()
  metrics.timeFailed.clear()
  metrics.timeTries.clear()
  metrics.locTries.clear()
  metrics.fileCounts.clear()
  metrics.countTries.clear()
  metrics.countQueue = []
  metrics.timeQueue = []
  lastRoot = root
  ui.hintRoot = ''
  marking.marks = []
  marking.markAnchor = ''
  marking.markBase = []
  linking.linkStates.clear()
  tree.searchIndex = null
  grepClear()
  metrics.sizeEpoch += 1
  metrics.sizeQueue = []
  await put($, () => ({ ...emptyTree(root), showHidden: prev.showHidden, column: prev.root ? prev.column : settings.columnDefault, split: prev.split, searchCase: Boolean(prev.searchCase), searchRegex: Boolean(prev.searchRegex), searchContent: Boolean(prev.searchContent) }))
  const listed = loadDirs($, [root])
  const repo = detectRepo($)
  await ready
  if (focus) await openPane($, root, true)
  else if (!settings.noDock) await openPane($, root)
  await listed
  await repo
  await refreshGit($)
}

export async function followCwd($: EngineInterface): Promise<boolean> {
  if (!tree.follow) return false
  const cwd = await cwdOf($)
  const t = await get($)
  if (t.root === cwd) return false
  await reset($, cwd)
  return true
}

export async function settleRoot($: EngineInterface): Promise<void> {
  const root = tree.follow || !lastRoot ? await cwdOf($) : lastRoot
  const t = await get($)
  if (t.root !== root || t.nodes.length === 0) await reset($, root)
}
