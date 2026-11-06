import type { EngineInterface } from 'claude-code'
import type { Look } from './look'
import type { Layout } from './layout'
import type { Grid } from './cells'
import { relative, age, stamp } from './tree'
import { DESK, lighten, rowSvg, STEP_PX, GAP_PX, ROW_PX, lineSvg } from './svg'
import type { ButtonProps } from './button'
import { scopeSearch, search } from './search'
import { sortBy } from './order'
import { settings, zjump } from './state'
import { GIT_COLS, type Col, COLS } from './register'
import type { Seg } from './rows'

export function columnsOf($: EngineInterface, c: Look & Layout & Grid) {
  const { e, t, Box, Text, Button, Client, Svg, desk, theme, accentInk, accentText, mutedInk, tint, glow, now, widths } = c
  const scopeName = t.searchScope ? `${relative(t.root, t.searchScope)}/` : ''
  const scopeChip = () => !scopeName ? null : desk ? (
    <Box key="scope-chip" position="relative" flexShrink={0} flexDirection="row" alignItems="center" marginLeft={1} paddingX={1} backgroundColor={DESK.toolOn}>
      <Text color={accentText}>{`in ${scopeName}`}</Text>
      <Text color={glow(mutedInk, 'scope')} hover={{ color: lighten(mutedInk) }}>{' ×'}</Text>
      <Box position="absolute" top={0} left={0} right={0} bottom={0}>
        <Client key="button-scope" module="./button.tsx" props={{ id: 'scope', label: '', dim: false } satisfies ButtonProps} width="100%" height="100%" />
      </Box>
    </Box>
  ) : (
    <Button key="scope-chip" plain label={`in ${scopeName} × `} onPress={() => void scopeSearch($, '')}>
      <Text color={theme.accent}>{`in ${scopeName}`}</Text>
      <Text dimColor>{' × '}</Text>
    </Button>
  )
  const onQuery = (v: string) => void (v === '' && t.query === '' && t.searchScope ? scopeSearch($, '') : search($, v))
  const sortCell = (col: 'name' | 'git' | 'metric', label: string) => {
    const active = t.sortCol === col
    const mark = active ? (t.sortDir === 'desc' ? ' ▾' : ' ▴') : ''
    const color = active ? accentInk : mutedInk
    return desk ? (
      <Box key={`sort-${col}`} position="relative" flexShrink={0} flexDirection="row" alignItems="center">
        <Text color={glow(color, `sort-${col}`)} hover={{ color: lighten(color) }} weight={active ? 'semibold' : 'regular'}>{label}</Text>
        {mark ? <Text dimColor>{mark}</Text> : null}
        <Box position="absolute" top={0} left={0} right={0} bottom={0}>
          <Client key={`button-sort-${col}`} module="./button.tsx" props={{ id: `sort-${col}`, label: '', dim: !active } satisfies ButtonProps} width="100%" height="100%" />
        </Box>
      </Box>
    ) : (
      <Button key={`sort-${col}`} plain label={label + mark} onPress={() => void sortBy($, col)}>
        <Text {...(active ? { color: theme.accent } : { dimColor: true })}>{label}</Text>
        {mark ? <Text dimColor>{mark}</Text> : null}
      </Button>
    )
  }
  const jumpWhen = (dir: string) => (at => (at ? (settings.showAge ? age(at, now) : stamp(at, settings.dateSetting, settings.clock)) : ''))(zjump.when[dir] ?? 0)
  const jumpDate = zjump.on ? zjump.rows.reduce((m, dir) => Math.max(m, [...jumpWhen(dir)].length), 0) : 0
  const gitSpan = zjump.on ? 0 : GIT_COLS.reduce((w, c) => w + (widths[c] ? (widths[c] ?? 0) + 1 : 0), 0)
  const metricSpan = zjump.on ? (jumpDate ? jumpDate + 1 : 0) : widths.metric ? (widths.metric ?? 0) + 1 : 0
  const gitLabel = e.props.bodyColumns - Math.max(metricSpan, 11) - 20 >= 12 ? 'Git (LOC)' : 'Git'
  const metricLabel = zjump.on ? 'Last accessed' : t.column === 'size' ? 'Size' : t.column === 'loc' ? 'LOC' : t.column === 'files' ? '# Files' : 'Modified'
  const headCell = (col: 'name' | 'git' | 'metric', label: string) => (!zjump.on ? sortCell(col, label) : desk ? <Text key={`head-${col}`} color={mutedInk}>{label}</Text> : <Text key={`head-${col}`} dimColor>{label}</Text>)
  const headerRow = () => (
    <Box key="sort-header" flexDirection="row" alignItems="center" {...(desk ? {} : { width: e.props.bodyColumns, height: 1 })}>
      {desk && Svg ? <Svg key="sort-indent" source={rowSvg(0, null, null, mutedInk)} alt="column headers" width={STEP_PX * 2 + GAP_PX} height={ROW_PX} /> : <Text>{'    '}</Text>}
      {headCell('name', 'Name')}
      <Box flexGrow={1} />
      {gitSpan ? <Box key="sort-git-cell" width={Math.max(gitSpan, gitLabel.length + 3)} flexShrink={0} flexDirection="row" justifyContent="flex-end">{headCell('git', gitLabel)}</Box> : null}
      {metricSpan ? <Box key="sort-metric-cell" width={Math.max(metricSpan, metricLabel.length + 3)} flexShrink={0} flexDirection="row" justifyContent="flex-end">{headCell('metric', metricLabel)}</Box> : null}
      <Box width={2} flexShrink={0} />
    </Box>
  )
  const headerRule = () => desk && Svg
    ? <Box key="sort-rule" overflow="hidden"><Svg key="sort-rule-svg" source={lineSvg(DESK.edge, 1)} alt="column header rule" width={4000} height={1} /></Box>
    : null
  const tailCols = (cells: Partial<Record<Col, Seg>>, key: string, cols: readonly Col[] = COLS) => cols.filter(c => widths[c]).map(c => {
    const seg = cells[c]
    return (
      <Box key={`${key}-${c}`} width={(widths[c] ?? 0) + 1} flexShrink={0} flexDirection="row" justifyContent="flex-end">
        {seg ? <Text {...tint(seg.c)} tabular>{seg.t}</Text> : null}
      </Box>
    )
  })
  return { scopeChip, onQuery, jumpWhen, metricSpan, metricLabel, headerRow, headerRule, tailCols }
}

export type Columns = ReturnType<typeof columnsOf>
