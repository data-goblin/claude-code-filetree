import type { Look } from './look'
import type { Layout } from './layout'
import type { Toolbar } from './toolbar'
import type { Grid } from './cells'
import type { Columns } from './columns'
import { settings } from './state'
import { BRANCH_ROW } from './consts'
import { rowSvg, STEP_PX, GAP_PX, ROW_PX, iconSvg } from './svg'
import { BRANCH_ICON } from './git'
import { GIT_COLS } from './register'

export function branchRow(c: Look & Layout & Toolbar & Grid & Columns) {
  const { e, t, unicode, Box, Text, Svg, desk, theme, tones, mutedText, addColor, delColor, accentInk, mutedInk, bright, totals, rootCounts, tipText, tipProps, widths, branchCells, tailCols } = c
  if (!t.top || !t.branch) return null
  const b = t.branch
  const isFlash = settings.shimmerOn && bright.has(BRANCH_ROW)
  const tone = t.flashTones[BRANCH_ROW] ?? 'teal'
  const label = b.head
  return (
    <Box flexDirection="row" height={desk ? undefined : 1} overflow="hidden" alignItems={desk ? 'center' : undefined}>
      <Box flexDirection="row" flexShrink={0} alignItems={desk ? 'center' : undefined}>
        {desk && Svg
          ? <Svg key="branch-icon" source={rowSvg(0, null, 'git-branch', isFlash ? (tones[tone]?.solid ?? accentInk) : e.props.isFocused ? accentInk : mutedInk)} alt="git branch" width={STEP_PX * 2 + GAP_PX} height={ROW_PX} />
          : <Text color={isFlash ? (tones[tone]?.solid ?? theme.accent) : theme.accent}>{(unicode ? BRANCH_ICON.plain : BRANCH_ICON.nerd) + ' '}</Text>}
        <Text {...(desk && !e.props.isFocused && !isFlash ? mutedText : { bold: true, color: isFlash ? (tones[tone]?.solid ?? (theme.fg || undefined)) : theme.fg || undefined })}>
          {label}
        </Text>
      </Box>
      <Box flexGrow={1} />
      {desk && tipText ? (
        <Box key="branch-tip" flexShrink={1} overflow="hidden"><Text {...tipProps} wrap="truncate-end">{tipText}</Text></Box>
      ) : <Box key="branch-git" flexDirection="row" flexShrink={1} alignItems={desk ? 'center' : undefined}>
      <Box flexDirection="row" flexShrink={0} alignItems={desk ? 'center' : undefined}>
        {rootCounts.length === 0 && totals[0] === 0 && totals[1] === 0 ? (
          desk && Svg
            ? <Box key="clean" flexDirection="row" alignItems="center"><Svg key="clean-icon" source={iconSvg('git-commit', mutedInk, 14)} alt="git" width={14} height={14} /><Text {...mutedText}> no changes</Text></Box>
            : <Text {...mutedText}>{unicode ? '± no changes' : '\u{e702} no changes'}</Text>
        ) : null}
        {desk ? tailCols(branchCells, 'branch', GIT_COLS) : null}
        {!desk && totals[0] > 0 && <Text color={addColor}>{` +${totals[0]}`}</Text>}
        {!desk && totals[1] > 0 && <Text color={delColor}>{` -${totals[1]}`}</Text>}
        {desk ? null : rootCounts.map((c, i) => (
          <Text key={`root-count-${i}`} color={c.c}>{c.t}</Text>
        ))}
      </Box>
      {b.upstream && settings.showRemote ? (
        <Box flexDirection="row" flexShrink={1} overflow="hidden" marginLeft={2} alignItems={desk ? 'center' : undefined}>
          {desk && Svg
            ? <Svg key="remote-icon" source={iconSvg('cloud', mutedInk, 14)} alt="remote branch" width={14} height={14} />
            : <Text {...mutedText}>{unicode ? '☁' : '\u{f0c2}'}</Text>}
          <Text {...mutedText} wrap="truncate-end">{` ${b.upstream}`}</Text>
        </Box>
      ) : null}
      {desk && widths.metric ? (
        <Box key="branch-sync" width={(widths.metric ?? 0) + 1} flexShrink={0} flexDirection="row" justifyContent="flex-end">{<Box flexDirection="row">{b.upstream ? <Text {...(b.ahead > 0 ? { color: tones.blue?.solid } : mutedText)}>{` ↑${b.ahead}`}</Text> : null}{b.upstream ? <Text {...(b.behind > 0 ? { color: tones.red?.solid ?? theme.urgent } : mutedText)}>{` ↓${b.behind}`}</Text> : null}</Box>}</Box>
      ) : <Box flexDirection="row">{b.upstream ? <Text {...(b.ahead > 0 ? { color: tones.blue?.solid } : mutedText)}>{` ↑${b.ahead}`}</Text> : null}{b.upstream ? <Text {...(b.behind > 0 ? { color: tones.red?.solid ?? theme.urgent } : mutedText)}>{` ↓${b.behind}`}</Text> : null}</Box>}
      </Box>}
      <Box key="branch-tail" width={desk ? 2 : 1} flexShrink={0} />
    </Box>
  )
}

export function gitHint(c: Look & Layout) {
  const { t, unicode, Box, Text, Svg, desk, mutedText, mutedInk, hintOn } = c
  return (
    !t.top && settings.showHints && (!hintOn ? (desk && Svg ? <Svg key="git-hint" source={rowSvg(0, null, null, mutedInk)} alt="git status" width={STEP_PX * 2 + GAP_PX} height={ROW_PX} /> : <Text key="git-hint">{' '}</Text>) : desk && Svg ? (
      <Box key="git-hint" flexDirection="row" alignItems="center">
        <Svg key="git-hint-icon" source={rowSvg(0, null, 'git-branch', mutedInk)} alt="no git repo" width={STEP_PX * 2 + GAP_PX} height={ROW_PX} />
        <Text {...mutedText}>not a Git repo</Text>
      </Box>
    ) : <Text key="git-hint" {...mutedText}>{unicode ? '± ' : '\u{ea68} '}not a Git repo</Text>)
  )
}
