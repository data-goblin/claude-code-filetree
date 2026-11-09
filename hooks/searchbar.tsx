import type { EngineInterface } from 'claude-code'
import type { Footer } from './footer'

import type { Look } from './look'
import type { Columns } from './columns'
import { DESK, iconSvg } from './svg'
import { zjump, gotoMode, settings } from './state'
import { gotoField, gotoInput, gotoKey, gotoSubmit, gotoValue } from './goto'
import { pressHeader } from './nav'
import type { ButtonProps } from './button'
import { jumpKey, jumpInput } from './jump'
import { jump, search } from './search'
import { badPattern } from './tree'
import { JUMP_COLOR } from './palette'

export function searchBar($: EngineInterface, c: Look & Columns & Footer) {
  const { e, t, unicode, Box, Text, Button, Input, Client, Svg, desk, theme, accentInk, glow, mutedText, mutedInk, searchBg, toggle, scopeChip, onQuery, park } = c
  const gotoGlyph = settings.glyphSetting === 'text' ? 'goto' : unicode ? '■' : '\u{e5ff}'
  const pathField = (submitLabel?: string) => <>
    <Box key="goto-up-box" height={0} overflow="hidden"><Button key="goto-up" plain label="up" onPress={() => void gotoKey($, 'up')} /></Box>
    <Box key={`goto-field-${gotoMode.field}`} flexGrow={1}>
      <Input key={gotoField()} autoFocus placeholder="folder path…" {...(submitLabel ? { submitLabel } : {})} value={gotoValue()} onInput={(v: string) => void gotoInput($, v)} onSubmit={(v: string) => void gotoSubmit($, v)} />
    </Box>
    <Box key="goto-down-box" height={0} overflow="hidden"><Button key="goto-down" plain label="down" onPress={() => void gotoKey($, 'tab')} /></Box>
  </>
  return (
    desk && Svg ? (
      <Box key="search-bar" flexDirection="row" alignItems="center" backgroundColor={DESK.field} paddingX={1}>
        <Box key="tool-goto" position="relative" flexShrink={0} flexDirection="row" alignItems="center">
          <Svg key={`goto-icon-${gotoMode.on ? 'on' : 'off'}`} source={iconSvg('folder-line', glow(gotoMode.on ? accentInk : mutedInk, 'goto'), 16)} alt={gotoMode.on ? 'close the folder path' : 'go to a folder path'} width={16} height={16} />
          <Box position="absolute" top={0} left={0} right={0} bottom={0}>
            <Client key="button-goto" module="./button.tsx" props={{ id: 'goto', label: '', dim: !gotoMode.on } satisfies ButtonProps} width="100%" height="100%" />
          </Box>
        </Box>
        {gotoMode.on ? null : <Box key="search-icon-box" flexShrink={0} marginLeft={1} flexDirection="row" alignItems="center"><Svg key="search-icon" source={iconSvg('search', mutedInk, 14)} alt="search" width={14} height={14} /></Box>}
        {zjump.on ? (
          <Box key="jump-chip" flexShrink={0} flexDirection="row" marginLeft={1} paddingX={1} backgroundColor={settings.palette.jump ? `${settings.palette.jump}0f` : DESK.jumpOn}><Text color={settings.palette.jump ?? DESK.jump}>jump</Text></Box>
        ) : gotoMode.on ? null : scopeChip()}
        <Box flexGrow={1} flexShrink={1} marginLeft={1} flexDirection="column" width={Math.max(10, e.props.bodyColumns - (gotoMode.on ? 6 : t.query ? 21 : 19))}>
          {zjump.on ? <>
            <Box key="jump-up-box" height={0} overflow="hidden"><Button key="jump-up" plain label="up" onPress={() => void jumpKey($, 'up')} /></Box>
            <Input key="jump" autoFocus placeholder="folder name…" value={zjump.query} onInput={(v: string) => void jumpInput($, v)} onSubmit={() => void jumpKey($, 'return')} />
            <Box key="jump-down-box" height={0} overflow="hidden"><Button key="jump-down" plain label="down" onPress={() => void jumpKey($, 'down')} /></Box>
          </> : gotoMode.on ? pathField() : <Input
            key="q"
            placeholder={t.searchContent ? 'Search file contents...' : 'Search files...'}
            value={t.query}
            onInput={onQuery}
            onSubmit={(v: string) => void jump($, v, e.surface).then(() => $.clock.after(100, park))}
          />}
        </Box>
        {t.query && !gotoMode.on ? <Button key="clear" plain dimColor label="×" onPress={() => void search($, '')} /> : null}
        {gotoMode.on ? null : (
          <Box flexShrink={0} flexDirection="row" gap={2} marginLeft={1} marginRight={1}>
            {toggle('case', 'Aa', Boolean(t.searchCase), false)}
            {toggle('regex', '.*', Boolean(t.searchRegex), badPattern(t.query, Boolean(t.searchRegex)))}
            {toggle('content', 'contents', Boolean(t.searchContent), false)}
          </Box>
        )}
      </Box>
    ) : (
      <Box flexDirection="row" width={e.props.bodyColumns} backgroundColor={searchBg}>
        <Button key="goto-open" plain label={gotoGlyph} onPress={() => void pressHeader($, 'goto')}><Text {...(gotoMode.on ? { color: theme.accent, bold: true } : mutedText)}>{gotoGlyph}</Text></Button>
        <Text> </Text>
        {settings.glyphSetting === 'text' || gotoMode.on ? null : <Text {...mutedText}>{unicode ? '⌕ ' : '\u{ea6d} '}</Text>}
        {zjump.on ? <Text key="jump-chip" color={settings.palette.jump ?? JUMP_COLOR} bold>{'jump '}</Text> : gotoMode.on ? null : scopeChip()}
        <Box flexGrow={1}>
          {zjump.on ? <>
            <Box key="jump-up-box" height={0} overflow="hidden"><Button key="jump-up" plain label="up" onPress={() => void jumpKey($, 'up')} /></Box>
            <Input key="jump" autoFocus placeholder="folder name…" value={zjump.query} onInput={(v: string) => void jumpInput($, v)} onSubmit={() => void jumpKey($, 'return')} />
            <Box key="jump-down-box" height={0} overflow="hidden"><Button key="jump-down" plain label="down" onPress={() => void jumpKey($, 'down')} /></Box>
          </> : gotoMode.on ? pathField('go') : <Input
            key="q"
            placeholder={t.searchContent ? 'search contents' : 'search'}
            submitLabel="go"
            value={t.query}
            onInput={onQuery}
            onSubmit={(v: string) => void jump($, v, e.surface).then(() => $.clock.after(100, park))}
          />}
        </Box>
        {t.query && !gotoMode.on ? <Button key="clear" plain dimColor label={unicode ? '×' : '\u{ea76}'} onPress={() => void search($, '')} /> : null}
        {gotoMode.on ? null : (
          <Box flexShrink={0} flexDirection="row" gap={1} marginLeft={1}>
            {toggle('case', 'Aa', Boolean(t.searchCase), false)}
            {toggle('regex', '.*', Boolean(t.searchRegex), badPattern(t.query, Boolean(t.searchRegex)))}
            {toggle('content', settings.glyphSetting === 'text' ? 'in' : unicode ? '≡' : '\u{f09aa}', Boolean(t.searchContent), false)}
            <Text> </Text>
          </Box>
        )}
      </Box>
    )
  )
}
