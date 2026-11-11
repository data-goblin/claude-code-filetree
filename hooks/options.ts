import type { PluginOptions } from 'claude-code'
import { settings, ui } from './state'
import { dateFormat, clockSetting } from './tree'
import { parsePalette } from './palette'
import { diffGroups } from './diff'
import { terminalTarget } from './open'

export function readOptions(options: PluginOptions): void {
  settings.glyphSetting = typeof options?.glyphs === 'string' ? options.glyphs : 'auto'
  settings.shimmerOn = options?.shimmer !== 'off'
  const activity = typeof options?.activity === 'string' ? options.activity : 'reads and writes'
  settings.showReads = activity.includes('reads')
  settings.showWrites = activity.includes('writes')
  settings.followClaude = options?.follow !== 'off'
  settings.followWork = options?.work !== 'off'
  settings.columnDefault = options?.column === 'size' || options?.column === 'loc' || options?.column === 'files' ? options.column : 'date'
  settings.showAge = options?.column === 'age'
  settings.dateSetting = dateFormat(options?.dates)
  settings.clock = clockSetting(options?.clock)
  settings.showHints = options?.hints !== 'off'
  settings.showRemote = options?.remote === 'on'
  settings.focusOnOpen = options?.focus !== 'off'
  settings.ignoreNames = typeof options?.ignore === 'string' ? options.ignore.split(/[\s,]+/).filter(Boolean) : []
  settings.searchGap = options?.spacing !== 'off'
  settings.sortHeader = options?.headers !== 'off'
  settings.longFile = options?.long === 'off' ? 0 : typeof options?.long === 'string' && /^\d+$/.test(options.long.trim()) ? Number(options.long.trim()) : 500
  settings.autoCollapseDefault = options?.collapse === 'on'
  settings.shortcutsSetting = options?.shortcuts === 'always' || options?.shortcuts === 'off' ? options.shortcuts : 'auto'
  ui.shortcutsShown = settings.shortcutsSetting === 'always'
  settings.treemapSetting = options?.treemap === 'image' || options?.treemap === 'cells' || options?.treemap === 'off' ? options.treemap : 'auto'
  settings.openWithSetting = typeof options?.open === 'string' ? options.open : ''
  settings.binariesInDefaultApp = options?.binaries === 'default app'
  settings.editWithSetting = typeof options?.edit === 'string' ? options.edit.trim() : ''
  settings.palette = parsePalette(options?.palette)
  settings.diffWithSetting = typeof options?.diff === 'string' ? options.diff.trim() : ''
  settings.groupSetting = diffGroups(options?.groups)
  settings.targetSetting = terminalTarget(options?.target)
  settings.splitAt = options?.split === 'top' ? 'top' : 'bottom'
  settings.jumpMovesClaude = options?.jump !== 'tree'
}
