import type { EngineInterface } from 'claude-code'
import { get, put } from './store'
import { flashing, metrics, ui, marking, linking, tree, settings, zjump } from './state'
import { clearAutoCollapse } from './activity'
import { emptyTree } from './tree'
import { loadDirs } from './listing'
import { detectRepo, refreshGit } from './gitstate'
import { PANE } from './consts'
import { cwdOf } from './util'
import { grepClear } from './grep'
import { jumpClose, recordVisit } from './jump'

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
  const title = `Files: ${root.split('/').pop() || root}`
  const listed = loadDirs($, [root])
  const repo = detectRepo($)
  await ready
  if (focus) await $.ui.open({ id: PANE, title, focus: true })
  else if (!settings.noDock) await $.ui.open({ id: PANE, title })
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

export async function applyStart($: EngineInterface): Promise<void> {
  const shown = (await $.ui.panes().catch(() => [])).find(p => p.id === PANE)?.isShown ?? false
  if (settings.noDock && shown) {
    if (zjump.on) jumpClose($)
    await $.ui.close({ id: PANE }).catch(() => undefined)
    return
  }
  if (settings.noDock || shown) return
  const t = await get($)
  if (t.root) await $.ui.open({ id: PANE, title: `Files: ${t.root.split('/').pop() || t.root}` })
}

export async function settleRoot($: EngineInterface): Promise<void> {
  const root = tree.follow || !lastRoot ? await cwdOf($) : lastRoot
  const t = await get($)
  if (t.root !== root || t.nodes.length === 0) await reset($, root)
}
