import type { EngineInterface } from 'claude-code'
import type { Look } from './look'
import type { Layout } from './layout'
import type { Specs } from './specs'
import { previewing, machine, linking, guarding, ui, zjump, settings } from './state'
import { pictureKind } from './peek'
import { focusPane, shortPath } from './util'
import { classifyLink, linkNote } from './links'
import { inside } from './tree'
import { navigate } from './nav'
import { turnPage } from './preview'
import { shortcutRows, shortcutGroups, toggleShortcuts } from './keys'
import { DESK, iconSvg, activityIcon, DESK_GIT, rowSvg, STEP_PX, GAP_PX, ROW_PX } from './svg'
import type { Activity } from '../types'
import type { Toolbar } from './toolbar'
import { clearMarks } from './select'
import { takesKey } from './site'

export function footerOf($: EngineInterface, c: Look & Layout & Specs) {
  const { e, t, Box, Text, Button, Svg, Image, desk, theme, accentInk, accentText, footer, room, grepping } = c
  const paging = previewing.splitShown && Boolean(previewing.peekPath) && (pictureKind(previewing.peekPath) === 'pdf' || (pictureKind(previewing.peekPath) === 'office' && Boolean(Image) && !machine.imageDenied && !machine.inTmux && !machine.inHerdr))
  const park = () => focusPane($, t.root, paging ? 'rows' : 'hk-tree')
  const footerLink = footer && linking.links.has(footer) ? linking.linkStates.get(footer) : undefined
  if (footer && linking.links.has(footer) && !linking.linkStates.has(footer)) void classifyLink($, footer)
  const footerName = footer === t.root ? t.root.split('/').filter(Boolean).pop() || t.root : footer ? (inside(t.root, footer) ? footer.slice(t.root.endsWith('/') ? t.root.length : t.root.length + 1) : shortPath(footer)) : ''
  const allKeys: { key: string; label: string; act: () => void }[] = [
    { key: 'jkhl', label: 'move', act: () => undefined },
    { key: 'o', label: 'open', act: () => void navigate($, 'return') },
    { key: 'd', label: 'diff', act: () => void navigate($, 'd') },
    { key: 's', label: 'search', act: () => void navigate($, 's', false, e.surface) },
    { key: 'i', label: 'in folder', act: () => void navigate($, 'i', false, e.surface) },
    { key: 'a', label: 'auto-collapse', act: () => void navigate($, 'a', false, e.surface).then(park) },
    { key: 'z', label: 'jump', act: () => void navigate($, 'z', false, e.surface) },
    { key: 'n', label: 'sort name', act: () => void navigate($, 'n', false, e.surface).then(park) },
    { key: 'g', label: 'sort git', act: () => void navigate($, 'g', false, e.surface).then(park) },
    { key: 'm', label: 'sort value', act: () => void navigate($, 'm', false, e.surface).then(park) },
    ...(e.surface === 'desktop' ? [] : [{ key: 'p', label: 'preview', act: () => void navigate($, 'p', false, e.surface).then(park) }]),
    { key: 'y', label: 'copy path', act: () => void navigate($, 'y', false, e.surface).then(park) },
    { key: 'u', label: 'copy name', act: () => void navigate($, 'u', false, e.surface).then(park) },
    { key: 'v', label: 'mark', act: () => void navigate($, 'v', false, e.surface).then(park) },
    { key: 't', label: 'terminal', act: () => void navigate($, 't', false, e.surface) },
    { key: 'x', label: 'guard', act: () => void navigate($, 'x', false, e.surface).then(park) },
    ...(guarding.outside.length ? [{ key: 'w', label: 'outside writes', act: () => void navigate($, 'w', false, e.surface) }] : []),
    { key: 'c', label: 'match case', act: () => void navigate($, 'c', false, e.surface).then(park) },
    { key: 'r', label: 'regex', act: () => void navigate($, 'r', false, e.surface).then(park) },
    { key: 'q', label: 'contents', act: () => void navigate($, 'q', false, e.surface).then(park) },
    ...(paging ? [{ key: '[ ]', label: 'page', act: () => void (turnPage($, 1), park()) }] : []),
  ]
  const overlay = ui.shortcutsShown && !zjump.on
  const keyRows = overlay && !desk ? shortcutRows(theme.accent, theme.muted) : []
  ui.shortcutsPage = room
  ui.shortcutsMax = Math.max(0, keyRows.length - room)
  ui.shortcutsTop = Math.min(ui.shortcutsTop, ui.shortcutsMax)
  const deskShortcuts = () => {
    const groups = shortcutGroups(true)
    const keyCols = Math.max(...groups.flatMap(g => g.keys.map(k => k.key.length))) + 2
    return (
      <Box key="keys-panel" flexDirection="column" marginTop={1} marginX={1} paddingX={1} paddingY={1} backgroundColor={DESK.field}>
        <Box key="keys-head" flexDirection="row" alignItems="center">
          {Svg ? <Svg key="keys-panel-icon" source={iconSvg('keyboard', accentInk, 16)} alt="keyboard shortcuts" width={16} height={16} /> : null}
          <Box marginLeft={1} flexShrink={1}><Text bold>Keyboard shortcuts</Text></Box>
          <Box flexGrow={1} />
          <Button key="keys-close" plain dimColor hover={{ dimColor: false }} label="Close" onPress={() => { toggleShortcuts($, false); park() }} />
        </Box>
        {groups.map(g => (
          <Box key={`keys-${g.title}`} flexDirection="column" marginTop={1}>
            <Text key={`keys-title-${g.title}`} bold dimColor>{g.title}</Text>
            {g.keys.map(k => (
              <Box key={`keys-${g.title}-${k.key}`} flexDirection="row">
                <Box width={keyCols} flexShrink={0}><Text mono color={accentText}>{k.key}</Text></Box>
                <Box flexShrink={1} overflow="hidden"><Text wrap="truncate-end">{k.label}</Text></Box>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    )
  }
  const hidden: [string, () => void][] = zjump.on ? [] : [
    ...(['j', 'k', 'h', 'l'] as const).map((k): [string, () => void] => [k, () => void navigate($, k, false, ui.shortcutsShown || grepping ? e.surface : undefined).then(park)]),
    ...allKeys.filter(k => /^[a-z]$/.test(k.key)).map((k): [string, () => void] => [k.key, k.act]),
    ...(previewing.splitShown && e.surface !== 'desktop' ? (['f', 'b'] as const).map((k): [string, () => void] => [k, () => void navigate($, k, false, e.surface).then(park)]) : []),
  ].filter(([k]) => takesKey(c.site, k))
  return { park, footerLink, footerName, overlay, keyRows, deskShortcuts, hidden }
}

export type Footer = ReturnType<typeof footerOf>

export function activityRow(c: Look & Layout) {
  const { unicode, Box, Text, Svg, desk, theme, tones, accentInk, latest } = c
  const chip = (a: Activity) => {
    const tone = a.state === 'failed' ? 'red' : a.tone
    const color = desk && tone === 'green' ? 'success' : desk && tone === 'red' ? 'error' : tones[tone]?.solid ?? theme.accent
    const icon = unicode ? a.plain : a.nerd
    const hash = a.state === 'done' && a.kind === 'git commit' ? a.detail.split(' ')[0] ?? '' : ''
    return (
      <Box flexDirection="row" marginLeft={2} alignItems={desk ? 'center' : undefined}>
        {desk && Svg
          ? <Svg key={`chip-${a.id}`} source={iconSvg(activityIcon(a.plain), tone === 'green' ? (DESK_GIT.A ?? accentInk) : tone === 'red' ? DESK.urgent : (tones[tone]?.solid ?? accentInk), 14)} alt={a.kind} width={14} height={14} />
          : <Text color={color}>{icon + ' '}</Text>}
        {desk ? <Text> </Text> : null}
        <Text bold={a.state === 'running'} color={color}>
          {a.state === 'running' ? `${a.label}…` : a.label}
        </Text>
        {hash && <Text color={color}>{` ${hash}`}</Text>}
      </Box>
    )
  }
  return (
    latest ? (
      <Box key="activity" flexDirection="row" height={1} overflow="hidden">
        <Box flexGrow={1} />
        {chip(latest)}
      </Box>
    ) : null
  )
}

export function footerBar($: EngineInterface, c: Look & Layout & Toolbar & Footer) {
  const { unicode, Box, Text, Button, Svg, desk, theme, mutedText, accentInk, mutedInk, picked, footer, tipText, tipProps, park, footerLink, footerName } = c
  return (
    (footer || tipText || settings.shortcutsSetting === 'auto') && (
      <Box flexDirection="row" height={1} overflow="hidden">
        {settings.shortcutsSetting === 'auto' ? (
          desk && Svg ? (
            <Box key="keys" flexShrink={0} flexDirection="row" alignItems="center">
              <Svg key="keys-icon" source={rowSvg(0, null, 'keyboard', mutedInk)} alt="keyboard shortcuts" width={STEP_PX * 2 + GAP_PX} height={ROW_PX} />
              <Button key="nav-help" plain dimColor hover={{ dimColor: false }} label="Shortcuts" onPress={() => { toggleShortcuts($); park() }} />
            </Box>
          ) : (
            <Box flexShrink={0}>
              <Button key="nav-help" plain dimColor label="?: shortcuts" onPress={() => { toggleShortcuts($); park() }}><Text color={theme.accent}>?</Text>: shortcuts</Button>
            </Box>
          )
        ) : null}
        <Box flexGrow={1} />
        {tipText && !desk ? (
          <Box flexShrink={1} marginLeft={2}>
            <Text {...tipProps} wrap="truncate-end">{tipText}</Text>
          </Box>
        ) : null}
        {picked.marked && !tipText ? <Box key="marked" flexShrink={0} marginLeft={2}><Button key="marked-clear" plain label={`${picked.ids.length} marked`} onPress={() => { clearMarks($); park() }}><Text color={desk ? accentInk : theme.accent}>{`${picked.ids.length} marked`}</Text></Button></Box> : null}
        {footerName && (desk || !tipText) ? (
          <Box flexShrink={1} marginLeft={2}>
            <Text {...mutedText} wrap="truncate-start">{footer && linking.links.has(footer) ? footerName + linkNote(footerLink) : footerName}</Text>
          </Box>
        ) : null}
        {footerName && (desk || !tipText) ? (
          desk && Svg
            ? <Box key="cursor" flexShrink={0} flexDirection="row" alignItems="center" marginLeft={1}><Svg key="cursor-icon" source={iconSvg('cursor', mutedInk, 14)} alt="cursor" width={14} height={14} /></Box>
            : <Box key="cursor" flexShrink={0}><Text {...mutedText}>{unicode ? ' ↖' : ' \u{f01bf}'}</Text></Box>
        ) : null}
      </Box>
    )
  )
}

export function hotkeys($: EngineInterface, c: Look & Footer) {
  const { Box, Button, hidden, site } = c
  return (
  <Box key="hotkeys" height={0} overflow="hidden" flexDirection="row">
    {site.isActive ? <Button key="hk-tree" plain autoFocus label="o" onPress={() => void navigate($, 'return')} /> : null}
    {hidden.map(([k, act]) => <Button key={`hk-${k}`} plain hotkey={k} label={k} onPress={act} />)}
  </Box>
  )
}
