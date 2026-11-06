import type { EngineInterface, RenderElement } from 'claude-code'
import { type PaneEvent, lookOf } from './look'
import { settings, zjump, ui, machine, grep } from './state'
import { PANE } from './consts'
import { jumpBlurCancel, jumpClose } from './jump'
import { previewPane } from './previewpane'
import { layoutOf } from './layout'
import { toolbarOf, headerBar } from './toolbar'
import { gridOf } from './cells'
import { columnsOf } from './columns'
import { specsOf } from './specs'
import { deskRowsOf, deskTree } from './deskrows'
import { peekPane } from './peekpane'
import { footerOf, activityRow, footerBar, hotkeys } from './footer'
import { branchRow, gitHint } from './branch'
import { searchBar } from './searchbar'
import type { RowsProps } from './rows'
import { grepId, type GrepHit } from './grep'

const JUMP_BLUR_MS = 400

export async function renderPane($: EngineInterface, e: PaneEvent): Promise<RenderElement> {
  if (e.surface === 'terminal' && e.props.placement === 'inline') {
    if (e.viewport?.isFullscreen === false) {
      settings.noDock = true
      void $.ui.close({ id: PANE }).catch(() => undefined)
    }
    const { Box: Empty } = $.ui.resolve(e)
    return <Empty />
  }
  if (zjump.on) {
    zjump.focused = Boolean(e.props.isFocused)
    if (e.props.isFocused) {
      zjump.held = true
      jumpBlurCancel()
    } else if (zjump.held && !ui.jumpBlur) ui.jumpBlur = $.clock.after(JUMP_BLUR_MS, () => {
      ui.jumpBlur = null
      if (zjump.on && zjump.held && !zjump.focused) jumpClose($)
    })
  }
  const v = await lookOf($, e)
  if (v.t.preview) return previewPane($, v)
  const l = { ...v, ...(await layoutOf($, v)) }
  const b = { ...l, ...toolbarOf(l) }
  const g = { ...b, ...gridOf($, b) }
  const c = { ...g, ...columnsOf($, g) }
  const s = { ...c, ...specsOf(c) }
  const d = { ...s, ...deskRowsOf(s) }
  const split = await peekPane($, d)
  const f = { ...d, ...footerOf($, d) }
  const { t, Box, Text, Client, desk, theme, rowColors, room, grepping, inSet, specs, bar, headerRow, headerRule, overlay, keyRows, deskShortcuts } = f
  return (
    <Box flexDirection="column" minHeight={Math.max(1, e.props.scroll?.bodyRows ?? 1)} backgroundColor={theme.bg || undefined}>
      {headerBar($, f)}
      {settings.splitAt === 'top' ? split : null}
      {branchRow(f)}
      {gitHint(f)}
      {settings.searchGap ? <Text key="gap-above"> </Text> : null}
      {searchBar($, f)}
      {settings.sortHeader ? headerRow() : null}{settings.sortHeader ? headerRule() : settings.searchGap ? <Text key="gap-below"> </Text> : null}
      {desk ? (overlay ? deskShortcuts() : deskTree(f)) : (
        <Client
          key="rows"
          module="./rows.tsx"
          props={overlay ? { rows: keyRows.slice(ui.shortcutsTop, ui.shortcutsTop + room), active: '', ...rowColors, pointer: machine.pointer } satisfies RowsProps : { rows: specs, active: zjump.on ? (zjump.rows[zjump.sel] ?? "") : grepping ? (grep.rows[grep.sel] ? grepId(grep.rows[grep.sel] as GrepHit) : '') : inSet.has(t.cursor) ? t.cursor : '', ...rowColors, pointer: machine.pointer, ...(bar ? { bar } : {}) } satisfies RowsProps}
        />
      )}
      <Box flexGrow={1} />
      {settings.splitAt === 'bottom' ? split : null}
      {activityRow(f)}
      {footerBar($, f)}
      {hotkeys($, f)}
    </Box>
  )
}
