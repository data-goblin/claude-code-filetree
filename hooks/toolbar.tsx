import type { EngineInterface } from 'claude-code'
import { type Look, WORDS, DESK_ICON_COLS } from './look'
import type { Layout } from './layout'
import type { Seg } from './rows'
import { guarding, tree, ui, settings } from './state'
import { autoCollapseOn } from './activity'
import { ink, rowSvg, STEP_PX, GAP_PX, ROW_PX } from './svg'
import { ROOT_PRESS } from './consts'
import type { HitProps } from './hit'
import { selectRoot } from './nav'
import { focusPane } from './util'

export function toolbarOf(c: Look & Layout) {
  const { e, t, unicode, desk, theme, gitColors, addColor, accentText, picked } = c
  const totals: [number, number] = t.top ? (t.diff[t.root] ?? [0, 0]) : [0, 0]
  const countSegs = (c: [number, number, number] | undefined): Seg[] => {
    if (!c) return []
    const out: Seg[] = []
    if (c[0] > 0) out.push({ t: ` ?:${c[0]}`, c: gitColors['?'] ?? addColor })
    if (c[1] > 0) out.push({ t: ` M:${c[1]}`, c: gitColors.M ?? 'ansi256(3)' })
    if (c[2] > 0) out.push({ t: ` D:${c[2]}`, c: theme.urgent })
    return out
  }
  const rootCounts = t.top ? countSegs(t.counts[t.root]) : []
  const plainButtons = [
    ...(guarding.outside.length ? [{ id: 'outside', label: `${unicode ? '⚠' : '\u{ea6c}'} ${guarding.outside.length}`, dim: false, hint: `${guarding.outside.length} file${guarding.outside.length === 1 ? '' : 's'} written outside the repo`, icon: 'warning' as const }] : []),
    ...(picked.ids.length ? [{ id: 'unselect', label: unicode ? '⊘' : '\u{eabd}', dim: false, hint: 'clear selection', icon: 'ban' as const }] : []),
    { id: 'up', label: unicode ? '↑' : '\u{f19f3}', dim: true, hint: 'parent folder', icon: 'folder-up-line' as const },
    { id: 'cwd', label: unicode ? '⌂' : '\u{eb46}', dim: !tree.follow, hint: 'go to cwd', icon: 'root-folder' as const },
    { id: 'hidden', label: unicode ? (t.showHidden ? '⊙' : '○') : t.showHidden ? '\u{ea70}' : '\u{eae7}', dim: !t.showHidden, hint: t.showHidden ? 'hide hidden files' : 'show hidden files', icon: t.showHidden ? ('eye' as const) : ('eye-off' as const) },
    { id: 'size', label: unicode ? '◫' : '\u{ea90}', dim: t.column === 'date', hint: t.column === 'date' ? 'show sizes' : t.column === 'size' ? 'show lines of code' : t.column === 'loc' ? 'show file counts' : 'show dates', icon: 'columns' as const },
    { id: 'collapse', label: unicode ? '⊟' : '\u{eac5}', dim: true, hint: t.expanded.length ? 'collapse all' : 'expand all', icon: t.expanded.length ? 'square-minus' as const : 'square-plus' as const },
    { id: 'autocollapse', label: unicode ? '◷' : '\u{ea82}', dim: !autoCollapseOn(t), hint: 'auto-collapse opened folders', icon: 'folder-minus' as const },
    ...(ui.nativeScroll ? [] : [{ id: 'split', label: unicode ? '⊡' : '\u{eb57}', dim: !t.split, hint: t.split ? 'hide preview' : 'show preview', icon: 'panel' as const }]),
    ...(desk ? [{ id: 'shimmer', label: '', dim: !settings.shimmerOn, hint: settings.shimmerOn ? 'disable agent activity shimmer effect' : 'enable agent activity shimmer effect', icon: 'clawd' as const }] : []),
    { id: 'refresh', label: unicode ? '↻' : '\u{eb37}', dim: !ui.reloading, hint: 'reload tree and git', icon: 'refresh' as const },
  ]
  const wordButtons = plainButtons.map(b => ({ ...b, label: b.id === 'outside' ? `outside ${guarding.outside.length}` : (WORDS[b.id] ?? b.label) }))
  const wordWidth = wordButtons.reduce((w, b) => w + b.label.length + 1, 1)
  const buttons = settings.glyphSetting === 'text' && e.props.bodyColumns - wordWidth >= 8 ? wordButtons : plainButtons
  const rootGlyph = unicode ? '■' : t.top === t.root ? '\u{f02a2}' : '\u{e5fe}'
  const header = t.top ? [t.top.split('/').pop() ?? t.top, t.prefix.replace(/\/$/, '')].filter(Boolean).join('/') : t.root.split('/').pop() || t.root
  const toolRoom = e.props.bodyColumns - header.length - 4
  const toolWidth = (list: typeof buttons, gap: number) => list.reduce((w, b) => w + (desk ? DESK_ICON_COLS : [...b.label].length), 0) + gap * Math.max(0, list.length - 1) + 1
  let toolButtons = buttons
  for (const drop of ['autocollapse', 'size', 'collapse', 'shimmer', 'refresh']) {
    if (toolWidth(toolButtons, 1) <= toolRoom) break
    toolButtons = toolButtons.filter(b => b.id !== drop)
  }
  const toolGap = desk ? 0 : toolWidth(toolButtons, 2) <= toolRoom ? 2 : 1
  const tipButton = buttons.find(b => b.id === ui.hovered)
  const tipText = tipButton?.hint ?? ''
  const tipProps = tipButton && !tipButton.dim ? { color: desk ? accentText : theme.accent } : desk ? { color: theme.fg ? ink(theme.fg, 'text') : 'text' } : theme.fg ? { color: theme.fg } : {}
  return { totals, rootCounts, toolButtons, toolGap, tipText, tipProps, rootGlyph, header }
}

export type Toolbar = ReturnType<typeof toolbarOf>

export function headerBar($: EngineInterface, c: Look & Toolbar) {
  const { e, t, Box, Text, Button, Client, Svg, desk, theme, mutedText, rowColors, accentInk, accentText, mutedInk, button, toolButtons, toolGap, rootGlyph, header } = c
  return (
    desk && Svg ? (
      <Box key="head" flexDirection="row" alignItems="center">
        <Box flexDirection="row" alignItems="center" flexShrink={1} overflow="hidden" position="relative">
          <Svg key="root-icon" source={rowSvg(0, null, t.top === t.root ? 'folder-git' : 'folder-open', e.props.isFocused ? accentInk : mutedInk)} alt="root folder" width={STEP_PX * 2 + GAP_PX} height={ROW_PX} />
          {e.props.isFocused ? <Text bold color={accentText}>{header}</Text> : <Text {...mutedText}>{header}</Text>}
          <Box position="absolute" top={0} left={0} right={0} bottom={0}>
            <Client key="hit:root" module="./hit.tsx" props={{ id: ROOT_PRESS, keys: false } satisfies HitProps} width="100%" height="100%" />
          </Box>
        </Box>
        <Box flexGrow={1} />
        <Box flexDirection="row" alignItems="center" flexShrink={0}>
          {toolButtons.map(button)}
        </Box>
      </Box>
    ) : (
      <Box flexDirection="row">
        <Box flexDirection="row" flexShrink={1} overflow="hidden" backgroundColor={t.cursor === t.root ? rowColors.activeBg || undefined : undefined}>
          <Button key="root" plain onPress={() => void selectRoot($).then(() => focusPane($, t.root, 'hk-tree'))}>
            <Text color={theme.accent}>{`${rootGlyph} `}</Text>
            <Text bold color={theme.accent}>{header}</Text>
          </Button>
        </Box>
        <Box flexGrow={1} />
        <Box flexDirection="row" gap={toolGap}>
          {toolButtons.map(button)}
          <Text> </Text>
        </Box>
      </Box>
    )
  )
}
