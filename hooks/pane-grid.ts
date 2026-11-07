import type { EngineInterface, RenderElement, RenderNode, UiScrollInput } from 'claude-code'

const GRID_LAYOUT = { plugin: 'pane-grid', key: 'layout' } as const
const GRID_VERSION = 1
const SLOT_KEY = 'slot:'
const CHOICES_KEY = 'choices:'
const ACTIVE_SUFFIX = ':active'
const NONE_KEY = 'none:'
const PLACE_KEY = 'place:'
const SCROLLS_KEY = 'scrolls:'
const CHOICE_HOTKEYS = 9

type GridPlacement = { tab: string; requestId: string; cell: string; columns: number; rows: number; column?: number; row?: number; isActive?: boolean }

const isPlacement = (value: unknown): value is GridPlacement => {
  if (typeof value != 'object' || value == null) return false
  const placement = value as Record<string, unknown>
  return typeof placement.tab == 'string' && typeof placement.requestId == 'string'
    && typeof placement.columns == 'number' && typeof placement.rows == 'number'
}

export const placementIn = (layout: unknown, plugin: string): GridPlacement | undefined => {
  if (typeof layout != 'object' || layout == null) return undefined
  const { version, placed } = layout as { version?: unknown; placed?: unknown }
  if (version != GRID_VERSION || typeof placed != 'object' || placed == null) return undefined
  const placement = (placed as Record<string, unknown>)[plugin]
  return isPlacement(placement) ? placement : undefined
}

export async function readPlacement($: EngineInterface, plugin: string): Promise<GridPlacement | undefined> {
  const read = await $.state.get(GRID_LAYOUT as never) as { value?: unknown }
  return placementIn(read.value, plugin)
}

type GridChoice = { key: string; label: string; hotkey?: string }

const keyOf = (node: RenderNode) => {
  if (typeof node == 'string') return undefined
  const props: Record<string, unknown> | undefined = 'props' in node ? node.props : undefined
  const key = props?.key
  return typeof key == 'string' ? key : undefined
}

const childrenOf = (node: RenderElement): readonly RenderNode[] => ('children' in node && Array.isArray(node.children) ? node.children : [])

const rewrite = (element: RenderElement, change: (element: RenderElement) => RenderElement | undefined): RenderElement => {
  const changed = change(element)
  if (changed) return changed
  const children = childrenOf(element)
  const rewritten = children.map(child => (typeof child == 'string' ? child : rewrite(child, change)))
  return rewritten.every((child, index) => child === children[index]) ? element : ({ ...element, children: rewritten } as RenderElement)
}

export const fillSlot = (below: RenderElement, plugin: string, cell: RenderElement): RenderElement | undefined => {
  let isFilled = false
  const filled = rewrite(below, element => {
    if (keyOf(element) != `${SLOT_KEY}${plugin}`) return undefined
    isFilled = true
    return { ...element, children: [cell] } as RenderElement
  })
  return isFilled ? filled : undefined
}

export const offerChoice = (below: RenderElement, plugin: string, placement: GridPlacement | undefined, makeButton: (choice: GridChoice) => RenderElement): RenderElement =>
  rewrite(below, element => {
    const key = keyOf(element)
    if (!key?.startsWith(CHOICES_KEY)) return undefined
    const isActive = key.endsWith(ACTIVE_SUFFIX)
    const cell = key.slice(CHOICES_KEY.length, isActive ? -ACTIVE_SUFFIX.length : undefined)
    const choiceKey = `${PLACE_KEY}${cell}:${plugin}`
    const children = childrenOf(element).filter(child => !keyOf(child)?.startsWith(NONE_KEY))
    if (children.some(child => keyOf(child) == choiceKey)) return undefined
    const count = children.filter(child => keyOf(child)?.startsWith(PLACE_KEY)).length
    const hotkey = isActive && count < CHOICE_HOTKEYS ? String(count + 1) : undefined
    const label = placement ? `${plugin} (move from ${placement.cell})` : plugin
    return { ...element, children: [...children, makeButton({ key: choiceKey, label, hotkey })] } as RenderElement
  })

export const scrollsKey = (plugin: string) => `${SCROLLS_KEY}${plugin}`

export const isScrollIn = (placement: GridPlacement | undefined, e: UiScrollInput): boolean => {
  if (!placement || placement.requestId != e.requestId || placement.column == undefined || placement.row == undefined) return false
  if (!e.pointer) return placement.isActive == true
  const { column, row } = e.pointer
  return column >= placement.column && column < placement.column + placement.columns && row >= placement.row && row < placement.row + placement.rows
}
