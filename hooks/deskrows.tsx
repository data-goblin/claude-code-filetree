import type { Look } from './look'
import type { Layout } from './layout'
import type { Grid } from './cells'
import type { Columns } from './columns'
import type { Specs } from './specs'
import { nodeIcon, ink, DESK, barSvg, ROW_PX, rowSvg, STEP_PX, GAP_PX, iconSvg } from './svg'
import { clean, weigh, shortPath } from './util'
import type { RowsProps } from './rows'
import type { HitProps } from './hit'
import { zjump, grep, ui, settings } from './state'
import { DESK_TREE_CHARS, DESK_TREE_NODES, DESK_ROWS, DESK_SHIMMER_MAX, DESK_ROW_CHARS, DESK_ROW_PAGE, ROWS_BUDGET, DESK_PAGE_CHARS } from './register'
import { type GrepHit, grepId } from './grep'
import { dirname } from './tree'
import type { RenderElement } from 'claude-code'

export function deskRowsOf(c: Look & Layout & Grid & Columns & Specs) {
  const { e, t, Box, Text, Client, Svg, desk, theme, tones, rowColors, accentInk, accentText, mutedInk, deskCur, deskCursor, deskHover, tint, at, from, grepping, drawn, deskFrom, rowParts, tailCols, grepNote } = c
  const deskRow = (p: ReturnType<typeof rowParts>, deskShimmer: boolean) => {
    const r = p.r
    const n = p.n
    const icon = p.isGuard ? 'x' : nodeIcon(n, p.isRepo)
    const tone = tones[p.tone]
    const iconInk = p.lit ? (tone?.solid ?? accentInk) : p.isGuard ? ink(theme.urgent, DESK.urgent) : ink(p.iconColor, n.kind === 'dir' ? accentInk : mutedInk)
    const strike = p.status === 'D' && n.kind !== 'dir'
    const name = p.lit && deskShimmer
      ? <Client key={`lit:${n.id}`} module="./rows.tsx" props={{ rows: [{ id: '', left: clean([{ t: n.name, sh: p.tone, b: p.isBright }]), right: [] }], active: '', activeBg: '', hoverBg: '', tones: rowColors.tones, pointer: false } satisfies RowsProps} />
      : p.lit
      ? <Text color={tone?.solid ?? accentText} bold={p.isBright || undefined} strikethrough={strike || undefined} wrap="truncate-end">{n.name}</Text>
      : <Text {...tint(p.nameColor)} strikethrough={strike || undefined} wrap="truncate-end">{p.parts.some(x => x.hit) ? p.parts.map((x, i) => (x.hit ? <Text key={`hl-${i}`} color={accentText} weight="semibold">{x.t}</Text> : x.t)) : n.name}</Text>
    return (
      <Box key={`row:${n.id}`} position="relative" flexDirection="row" alignItems="center" backgroundColor={n.id === t.cursor && !p.isPicked ? deskCursor : p.isPicked ? deskCur : undefined} hover={{ backgroundColor: n.id === t.cursor && !p.isPicked ? deskCursor : p.isPicked ? deskCur : deskHover }}>
        {n.id === t.cursor && (e.props.isFocused || !p.isPicked) && Svg ? <Box key={`bar:${n.id}`} position="absolute" top={0} left={0} bottom={0}><Svg key={`bar-svg:${n.id}`} source={barSvg(accentInk)} alt="cursor" width={2} height={ROW_PX} /></Box> : null}
        {Svg ? <Svg key={`icon:${n.id}`} source={rowSvg(r.depth, n.kind === 'dir' ? (r.open ? 'open' : 'closed') : null, icon, iconInk)} alt={`${p.isGuard ? 'guarded ' : ''}${n.kind === 'dir' ? 'folder' : n.kind === 'link' ? 'link' : 'file'} ${n.name}`} width={r.depth * STEP_PX + STEP_PX * 2 + GAP_PX} height={ROW_PX} /> : null}
        <Box flexGrow={p.isLink ? 0 : 1} flexShrink={1} overflow="hidden">{name}</Box>
        {p.isLink ? <Text key={`link:${n.id}`} {...tint(p.linkColor)}>{` → `}</Text> : null}
        {p.isLink ? <Box flexGrow={1} /> : null}
        {tailCols(p.cells, `tail:${n.id}`)}
        <Box width={2} flexShrink={0} flexDirection="row" justifyContent="flex-end" alignItems="center">
          {p.status ? <Text {...tint(p.gitColor)} bold>{p.status}</Text> : p.isIgnored && Svg ? <Svg key={`ignored:${n.id}`} source={iconSvg('ban', mutedInk, 12)} alt="ignored by git" width={12} height={12} /> : null}
        </Box>
        <Box position="absolute" top={0} left={0} right={0} bottom={0}>
          <Client key={`hit:${n.id}`} module="./hit.tsx" props={{ id: n.id } satisfies HitProps} width="100%" height="100%" />
        </Box>
      </Box>
    )
  }

  const deskParts: ReturnType<typeof rowParts>[] = []
  let deskStart = deskFrom
  if (desk && !grepping && !zjump.on && drawn.length) {
    const parts = new Map<number, ReturnType<typeof rowParts>>()
    const part = (k: number) => {
      const known = parts.get(k)
      if (known) return known
      const made = rowParts(drawn[k] as (typeof drawn)[number])
      parts.set(k, made)
      return made
    }
    let chars = 0
    let nodes = 0
    const fits = (k: number) => {
      const [c, n] = weigh(deskRow(part(k), true))
      if (chars + c > DESK_TREE_CHARS || nodes + n > DESK_TREE_NODES) return false
      chars += c
      nodes += n
      return true
    }
    const focusAt = Math.min(drawn.length - 1, Math.max(0, at - from - deskFrom))
    let lo = focusAt
    let hi = focusAt - 1
    let down = true
    let up = true
    while (hi - lo + 1 < DESK_ROWS && (down || up)) {
      if (down) down = hi + 1 < drawn.length && fits(hi + 1) ? (hi++, true) : false
      if (up && hi - lo + 1 < DESK_ROWS && hi >= lo) up = lo - 1 >= 0 && fits(lo - 1) ? (lo--, true) : false
      if (hi < lo) break
    }
    for (let k = lo; k <= hi; k++) deskParts.push(part(k))
    deskStart = deskFrom + lo
  }
  const deskShimmer = deskParts.filter(x => x.lit).length <= DESK_SHIMMER_MAX
  const deskGrep: GrepHit[] = []
  if (desk && grepping) {
    let size = 0
    let page = 0
    for (const g of grep.rows) {
      size += DESK_ROW_CHARS + 7 * grepId(g).length + g.text.length
      page += DESK_ROW_PAGE + 5 * grepId(g).length + g.text.length
      if (size > ROWS_BUDGET || page > DESK_PAGE_CHARS || deskGrep.length >= DESK_ROWS) break
      deskGrep.push(g)
    }
  }
  if (desk && grepping) ui.deskGrepShown = deskGrep.length
  const deskGrepNote = deskGrep.length < grep.rows.length ? `first ${deskGrep.length} of ${grep.rows.length} rows; keep typing to narrow` : grepNote
  return { deskRow, deskParts, deskStart, deskShimmer, deskGrep, deskGrepNote }
}

export type DeskRows = ReturnType<typeof deskRowsOf>

export function deskTree(c: Look & Layout & Columns & Specs & DeskRows) {
  const { Box, Text, Client, Svg, mutedText, mutedInk, deskSel, deskHover, jumpSel, rows, shown, grepping, metricSpan, metricLabel, jumpWhen, grepDigits, grepNode, grepName, deskGrep, deskGrepNote, deskRow, deskParts, deskStart, deskShimmer } = c
  if (grepping) return (
    <Box key="grep-list" flexDirection="column">
      {deskGrep.map((g, k) => (
        <Box key={`grep-row:${grepId(g)}`} position="relative" flexDirection="row" alignItems="center" backgroundColor={k === grep.sel ? deskSel : undefined} hover={{ backgroundColor: k === grep.sel ? deskSel : deskHover }}>
          {g.line ? <Box key={`grep-line:${grepId(g)}`} flexDirection="row" alignItems="center" flexGrow={1} flexShrink={1} overflow="hidden">
            {Svg ? <Svg key={`grep-guide:${grepId(g)}`} source={rowSvg(1, null, null, mutedInk)} alt={`line ${g.line}`} width={STEP_PX * 3 + GAP_PX} height={ROW_PX} /> : null}
            <Text dimColor tabular mono>{`${String(g.line).padStart(grepDigits)} `}</Text>
            <Box flexGrow={1} flexShrink={1} overflow="hidden"><Text mono wrap="truncate-end">{g.text}</Text></Box>
          </Box> : <Box key={`grep-file:${grepId(g)}`} flexDirection="row" alignItems="center" flexGrow={1} flexShrink={1} overflow="hidden">
            {Svg ? <Svg key={`grep-icon:${grepId(g)}`} source={rowSvg(0, null, nodeIcon(grepNode(g.path), false), mutedInk)} alt={`file ${grepName(g.path)}`} width={STEP_PX * 2 + GAP_PX} height={ROW_PX} /> : null}
            <Box flexGrow={1} flexShrink={1} overflow="hidden"><Text weight="semibold" wrap="truncate-start">{grepName(g.path)}</Text></Box>
            <Text dimColor tabular>{g.text}</Text>
            <Box width={2} flexShrink={0} />
          </Box>}
          <Box position="absolute" top={0} left={0} right={0} bottom={0}>
            <Client key={`hit:${grepId(g)}`} module="./hit.tsx" props={{ id: grepId(g) } satisfies HitProps} width="100%" height="100%" />
          </Box>
        </Box>
      ))}
      {deskGrepNote ? (
        <Box key="grep-note" position="relative" flexDirection="row" alignItems="center">
          <Text {...mutedText}>{deskGrepNote}</Text>
          <Box position="absolute" top={0} left={0} right={0} bottom={0}>
            <Client key="hit:grep-note" module="./hit.tsx" props={{ id: '' } satisfies HitProps} width="100%" height="100%" />
          </Box>
        </Box>
      ) : null}
    </Box>
  )
  if (zjump.on) return (
    <Box key="jump-list" flexDirection="column">
      {zjump.rows.length ? zjump.rows.map((dir, k) => (
        <Box key={`jump:${dir}`} position="relative" flexDirection="row" alignItems="center" overflow="hidden" backgroundColor={k === zjump.sel ? jumpSel : undefined} hover={{ backgroundColor: k === zjump.sel ? jumpSel : deskHover }}>
          {Svg ? <Svg key={`jump-icon:${dir}`} source={rowSvg(0, null, 'folder', settings.palette.jump ?? DESK.jump)} alt={`folder ${dir}`} width={STEP_PX * 2 + GAP_PX} height={ROW_PX} /> : null}
          <Box flexShrink={1} overflow="hidden"><Text wrap="truncate-end">{dir.split('/').filter(Boolean).pop() ?? dir}</Text></Box>
          <Box flexGrow={1} flexShrink={3} overflow="hidden" marginLeft={1}><Text {...mutedText} wrap="truncate-start">{shortPath(dirname(dir))}</Text></Box>
          {metricSpan ? <Box width={Math.max(metricSpan, metricLabel.length + 3)} flexShrink={0} flexDirection="row" justifyContent="flex-end"><Text {...mutedText}>{jumpWhen(dir)}</Text></Box> : null}
          <Box width={2} flexShrink={0} />
          <Box position="absolute" top={0} left={0} right={0} bottom={0}>
            <Client key={`hit:${dir}`} module="./hit.tsx" props={{ id: dir } satisfies HitProps} width="100%" height="100%" />
          </Box>
        </Box>
      )) : (
        <Box key="jump-none" position="relative" flexDirection="row" alignItems="center">
          <Text {...mutedText}>no matching folder</Text>
          <Box position="absolute" top={0} left={0} right={0} bottom={0}>
            <Client key="hit:jump-none" module="./hit.tsx" props={{ id: '' } satisfies HitProps} width="100%" height="100%" />
          </Box>
        </Box>
      )}
    </Box>
  )
  const out: RenderElement[] = rows.length === 0 ? [<Text key="empty" {...mutedText}>empty</Text>] : []
  for (const p of deskParts) out.push(deskRow(p, deskShimmer))
  if (deskStart > 0) out.unshift(<Text key="above" {...mutedText}>{`  … ${deskStart} rows above, collapse folders or use search`}</Text>)
  const below = shown.length - deskStart - deskParts.length
  if (below > 0) out.push(<Text key="more" {...mutedText}>{`  … ${below} more rows, collapse folders or use search`}</Text>)
  return <Box key="tree" flexDirection="column">{out}</Box>
}
