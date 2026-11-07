import type { EngineInterface } from 'claude-code'
import { PANE } from './consts'
import { placementIn, readPlacement, TOOLBAR_KEYS } from './pane-grid'

export const PLUGIN = 'filetree'

export type Site = { id: string; columns: number; rows: number | undefined; isActive: boolean }

export function titleOf(root: string): string {
  return `Files: ${root.split('/').pop() || root}`
}

export function takesKey(site: Site, key: string): boolean {
  return site.isActive && (site.id === PANE || !(TOOLBAR_KEYS as readonly string[]).includes(key))
}

export async function isSite($: EngineInterface, requestId: string): Promise<boolean> {
  return requestId === PANE || requestId === (await readPlacement($, PLUGIN))?.requestId
}

export async function openPane($: EngineInterface, root: string, focus = false): Promise<boolean> {
  if (await readPlacement($, PLUGIN)) return false
  await $.ui.open({ id: PANE, title: titleOf(root), ...(focus ? { focus: true } : {}) })
  return true
}

export async function focusKey($: EngineInterface, key: string): Promise<void> {
  if (await readPlacement($, PLUGIN)) return
  await $.ui.focus({ requestId: PANE, key })
}

export async function placeOwnPane($: EngineInterface, root: string, layout: unknown, previous: unknown): Promise<void> {
  const isPlaced = placementIn(layout, PLUGIN) !== undefined
  const isOpen = (await $.ui.panes()).some(pane => pane.id === PANE)
  if (isPlaced && isOpen) return $.ui.close({ id: PANE })
  if (isPlaced || isOpen || placementIn(previous, PLUGIN) === undefined) return
  await $.ui.open({ id: PANE, title: titleOf(root) })
}
