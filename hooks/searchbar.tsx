import type { EngineInterface } from 'claude-code'
import type { Footer } from './footer'

import type { Look } from './look'
import type { Columns } from './columns'
import { DESK, iconSvg } from './svg'
import { zjump, settings } from './state'
import { jumpKey, jumpInput } from './jump'
import { jump, search } from './search'
import { badPattern } from './tree'
import { JUMP_COLOR } from './palette'

export function searchBar($: EngineInterface, c: Look & Columns & Footer) {
  const { e, t, unicode, Box, Text, Button, Input, Svg, desk, mutedText, mutedInk, searchBg, toggle, scopeChip, onQuery, park } = c
  return (
    desk && Svg ? (
      <Box key="search-bar" flexDirection="row" alignItems="center" backgroundColor={DESK.field} paddingX={1}>
        <Svg key="search-icon" source={iconSvg('search', mutedInk, 14)} alt="search" width={14} height={14} />
        {zjump.on ? (
          <Box key="jump-chip" flexShrink={0} flexDirection="row" marginLeft={1} paddingX={1} backgroundColor={settings.palette.jump ? `${settings.palette.jump}0f` : DESK.jumpOn}><Text color={settings.palette.jump ?? DESK.jump}>jump</Text></Box>
        ) : scopeChip()}
        <Box flexGrow={1} flexShrink={1} marginLeft={1} flexDirection="column" width={Math.max(10, e.props.bodyColumns - (t.query ? 18 : 16))}>
          {zjump.on ? <>
            <Box key="jump-up-box" height={0} overflow="hidden"><Button key="jump-up" plain label="up" onPress={() => void jumpKey($, 'up')} /></Box>
            <Input key="jump" autoFocus placeholder="folder name…" value={zjump.query} onInput={(v: string) => void jumpInput($, v)} onSubmit={() => void jumpKey($, 'return')} />
            <Box key="jump-down-box" height={0} overflow="hidden"><Button key="jump-down" plain label="down" onPress={() => void jumpKey($, 'down')} /></Box>
          </> : <Input
            key="q"
            placeholder={t.searchContent ? 'Search file contents...' : 'Search files...'}
            value={t.query}
            onInput={onQuery}
            onSubmit={(v: string) => void jump($, v, e.surface).then(() => $.clock.after(100, park))}
          />}
        </Box>
        {t.query ? <Button key="clear" plain dimColor label="×" onPress={() => void search($, '')} /> : null}
        <Box flexShrink={0} flexDirection="row" gap={2} marginLeft={1} marginRight={1}>
          {toggle('case', 'Aa', Boolean(t.searchCase), false)}
          {toggle('regex', '.*', Boolean(t.searchRegex), badPattern(t.query, Boolean(t.searchRegex)))}
          {toggle('content', 'contents', Boolean(t.searchContent), false)}
        </Box>
      </Box>
    ) : (
      <Box flexDirection="row" width={e.props.bodyColumns} backgroundColor={searchBg}>
        {settings.glyphSetting === 'text' ? null : <Text {...mutedText}>{unicode ? '⌕ ' : '\u{ea6d} '}</Text>}
        {zjump.on ? <Text key="jump-chip" color={settings.palette.jump ?? JUMP_COLOR} bold>{'jump '}</Text> : scopeChip()}
        <Box flexGrow={1}>
          {zjump.on ? <>
            <Box key="jump-up-box" height={0} overflow="hidden"><Button key="jump-up" plain label="up" onPress={() => void jumpKey($, 'up')} /></Box>
            <Input key="jump" autoFocus placeholder="folder name…" value={zjump.query} onInput={(v: string) => void jumpInput($, v)} onSubmit={() => void jumpKey($, 'return')} />
            <Box key="jump-down-box" height={0} overflow="hidden"><Button key="jump-down" plain label="down" onPress={() => void jumpKey($, 'down')} /></Box>
          </> : <Input
            key="q"
            placeholder={t.searchContent ? 'search contents' : 'search'}
            submitLabel="go"
            value={t.query}
            onInput={onQuery}
            onSubmit={(v: string) => void jump($, v, e.surface).then(() => $.clock.after(100, park))}
          />}
        </Box>
        {t.query ? <Button key="clear" plain dimColor label={unicode ? '×' : '\u{ea76}'} onPress={() => void search($, '')} /> : null}
        <Box flexShrink={0} flexDirection="row" gap={1} marginLeft={1}>
          {toggle('case', 'Aa', Boolean(t.searchCase), false)}
          {toggle('regex', '.*', Boolean(t.searchRegex), badPattern(t.query, Boolean(t.searchRegex)))}
          {toggle('content', settings.glyphSetting === 'text' ? 'in' : unicode ? '≡' : '\u{f09aa}', Boolean(t.searchContent), false)}
          <Text> </Text>
        </Box>
      </Box>
    )
  )
}
