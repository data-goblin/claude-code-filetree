import type { EngineInterface } from 'claude-code'
import type { Look } from './look'
import type { RenderElement } from 'claude-code'
import { previewing, ui, settings, machine } from './state'
import { loadPreview, previewLines, jumpDiff, scrollPreview, diffFile, editPreview, parkPreview, closePreview } from './preview'
import { diffWindow, diffCounts, GROUP } from './diff'
import { inside, relative } from './tree'
import { shortPath } from './util'
import { OUTSIDE, PANE } from './consts'
import { type IconName, rowSvg, DESK, STEP_PX, ROW_PX, GAP_PX, nodeIcon } from './svg'
import { pressHeader } from './nav'
import type { FileNode } from '../types'
import { markdownSplit } from './refs'
import { directPreview } from './register'
import type { RowsProps } from './rows'

export async function previewPane($: EngineInterface, v: Look): Promise<RenderElement> {
  const { e, t, unicode, elements, Box, Text, Button, Client, Svg, desk, theme, mutedText, addColor, delColor, deskDiff, rowColors, accentInk, accentText, mutedInk, dc, button, hint } = v
  if (previewing.previewed?.path !== t.preview) await loadPreview($, t.preview, previewing.deskLine?.path === t.preview ? previewing.deskLine.line : undefined)
  const p = previewing.previewed
  const first = p?.diff ? 0 : (p?.first ?? 0)
  const markdown = /\.(md|markdown|mdx|docx|odt|rtf)$/i.test(t.preview)
  const all = p?.diff?.length ?? (p?.text ?? '').split('\n').length
  previewing.previewRows = ui.nativeScroll ? all : Math.max(4, (e.props.scroll?.bodyRows ?? 40) - (p?.note ? 3 : 2))
  const start = ui.nativeScroll ? 0 : p?.diff ? Math.min(t.previewTop, Math.max(0, all - 1)) : Math.min(t.previewTop, Math.max(0, all - previewing.previewRows))
  const win = p?.diff ? diffWindow(p.diff, start, previewing.previewRows) : previewLines(p?.text ?? '', start, previewing.previewRows, markdown)
  previewing.previewLine = first + win.top + 1
  const name = t.preview !== t.root && inside(t.root, t.preview) ? relative(t.root, t.preview) : shortPath(t.preview)
  const listing = t.preview === OUTSIDE
  const external = { id: 'external', label: settings.glyphSetting === 'text' ? 'open' : unicode ? '↗' : '\u{eb14}', dim: true, hint: 'open in default app' }
  if (desk && Svg) {
    const step = p?.diff ? (p.diff.some(l => l.kind === '@') ? 'file' : 'hunk') : ''
    const toTree = t.nodes.find(n => n.id === t.preview)?.kind === 'dir'
    const edits = !listing && (settings.editWithSetting || machine.inTmux || machine.inHerdr)
    previewing.previewDesk = true
    const acts: { id: string; key: string; icon: IconName; hint: string; run: () => Promise<void> }[] = [
      { id: 'pv-k', key: 'k', icon: 'arrow-up', hint: step ? `previous ${step}` : 'up a line', run: () => (step ? jumpDiff($, -1) : scrollPreview($, -1)) },
      { id: 'pv-j', key: 'j', icon: 'arrow-down', hint: step ? `next ${step}` : 'down a line', run: () => (step ? jumpDiff($, 1) : scrollPreview($, 1)) },
      { id: 'pv-b', key: 'b', icon: 'page-up', hint: 'page up', run: () => scrollPreview($, 2 - previewing.previewRows) },
      { id: 'pv-f', key: 'f', icon: 'page-down', hint: 'page down', run: () => scrollPreview($, previewing.previewRows - 2) },
      ...(listing ? [] : [{ id: 'pv-d', key: 'd', icon: (p?.diff ? (toTree ? 'folder' : 'file') : 'diff') as IconName, hint: p?.diff ? (toTree ? 'back to the tree' : 'back to the file') : 'diff against HEAD', run: () => diffFile($, t.preview) }]),
      ...(edits ? [{ id: 'pv-e', key: 'e', icon: 'pencil' as const, hint: `edit at line ${previewing.previewLine}`, run: () => editPreview($, t.preview) }] : []),
      ...(listing ? [] : [{ id: 'external', key: '', icon: 'external-link' as const, hint: 'open in default app', run: () => pressHeader($, 'external') }]),
    ]
    previewing.previewActs = new Map(acts.map(a => [a.id, () => void a.run().then(() => (a.id === 'external' ? undefined : parkPreview($)))]))
    const tools = acts.map(a => ({ id: a.id, label: '', dim: true, hint: a.hint, icon: a.icon }))
    return (
      <Box flexDirection="column" minHeight={Math.max(1, e.props.scroll?.bodyRows ?? 1)} backgroundColor={theme.bg || undefined}>
        <Box key="pv-head" flexDirection="row" alignItems="center">
          <Box key="pv-back" flexDirection="row" alignItems="center" flexShrink={0}>
            <Svg key="pv-back-icon" source={rowSvg(0, null, 'chevron-left', mutedInk, DESK.muted, 0)} alt="back to files" width={STEP_PX * 2} height={ROW_PX} />
            <Button key="back" plain dimColor hover={{ dimColor: false }} hotkey="h" autoFocus label="Files" onPress={() => void closePreview($)} />
          </Box>
          <Text {...mutedText}>{' / '}</Text>
          <Box flexShrink={1} flexGrow={1} overflow="hidden">
            <Text weight="semibold" wrap="truncate-start">{name}</Text>
          </Box>
          {hint(tools, 12 + name.length)}
          <Box flexDirection="row" alignItems="center" flexShrink={0}>{tools.map(button)}</Box>
        </Box>
        {p?.note ? (
          <Box key="pv-note" flexDirection="row" marginLeft={4} marginBottom={1}>
            <Text {...mutedText} size="footnote">{p.note}</Text>
          </Box>
        ) : null}
        {'segments' in win ? (
          <Box key="pv-files" flexDirection="column">
            {win.segments.map((g, i) => {
              const node: FileNode = { id: g.title, parent: '', name: g.title.split('/').pop() ?? g.title, kind: 'file', hidden: false, mtime: 0, size: 0, loaded: true }
              const counts = p?.diff ? diffCounts(g.source) : [0, 0]
              if (g.title.startsWith(GROUP)) return (
                <Box key={`pv-seg-${i}`} flexDirection="row" alignItems="center" marginBottom={1}>
                  <Svg key={`pv-group-icon-${i}`} source={rowSvg(0, null, 'folder', accentInk)} alt={`group ${g.title.slice(GROUP.length)}`} width={STEP_PX * 2 + GAP_PX} height={ROW_PX} />
                  <Text weight="semibold" color={accentText}>{g.title.slice(GROUP.length)}</Text>
                </Box>
              )
              return (
                <Box key={`pv-seg-${i}`} flexDirection="column" marginBottom={1}>
                  {g.title ? (
                    <Box key={`pv-seg-head-${i}`} flexDirection="row" alignItems="center">
                      <Svg key={`pv-seg-icon-${i}`} source={rowSvg(0, null, nodeIcon(node, false), mutedInk)} alt={`file ${g.title}`} width={STEP_PX * 2 + GAP_PX} height={ROW_PX} />
                      <Box flexGrow={1} flexShrink={1} overflow="hidden"><Text weight="semibold" wrap="truncate-start">{g.title}</Text></Box>
                      {counts[0] ? <Text color={dc(addColor)} tabular>{` +${counts[0]}`}</Text> : null}
                      {counts[1] ? <Text color={dc(delColor)} tabular>{` -${counts[1]}`}</Text> : null}
                      <Box width={2} flexShrink={0} />
                    </Box>
                  ) : null}
                  {g.source ? deskDiff(g.source, `pv-seg-${i}`) : null}
                </Box>
              )
            })}
          </Box>
        ) : previewing.deskLine?.path === t.preview && previewing.deskLine.top > 0 && !p?.diff ? (() => {
          const lines = (p?.text ?? '').split('\n')
          const at = Math.max(0, Math.min(previewing.deskLine.top - first, lines.length - 1))
          if (!previewing.deskLine.scrolled) {
            previewing.deskLine.scrolled = true
            $.clock.after(50, () => void $.ui.scroll({ to: { key: 'pv-line' }, in: PANE, block: 'start' }).catch(() => undefined))
          }
          const { Markdown, Code } = elements
          const [above, below] = markdown ? markdownSplit(p?.text ?? '', at) : [lines.slice(0, at).join('\n'), lines.slice(at).join('\n')]
          return (
            <Box key="pv-split" flexDirection="column">
              {markdown ? <Markdown key="pv-above" text={above} /> : <Code key="pv-above" source={above} path={t.preview} startLine={first + 1} wrap="truncate-end" />}
              {markdown ? <Markdown key="pv-line" text={below} /> : <Code key="pv-line" source={below} path={t.preview} startLine={first + at + 1} wrap="truncate-end" />}
            </Box>
          )
        })() : directPreview(elements, { ...win, top: first + win.top }, t.preview, markdown, theme.accent)}
        <Box key="pv-hotkeys" height={0} overflow="hidden" flexDirection="row">
          {acts.filter(a => a.key).map(a => <Button key={`pv-hk-${a.key}`} plain hotkey={a.key} label={a.key} onPress={() => previewing.previewActs.get(a.id)?.()} />)}
        </Box>
      </Box>
    )
  }
  previewing.previewDesk = false
  return (
    <Box flexDirection="column" minHeight={Math.max(1, e.props.scroll?.bodyRows ?? 1)} backgroundColor={theme.bg || undefined}>
      <Box flexDirection="row">
        <Button key="back" plain hotkey="h" autoFocus={settings.editWithSetting || machine.inTmux || machine.inHerdr ? undefined : true} label={unicode ? '← files' : '\u{ea9b} files'} onPress={() => void closePreview($)} />
        <Text> </Text>
        <Box flexShrink={1} flexGrow={1}>
          <Text bold wrap="truncate-start">{name}</Text>
        </Box>
        {listing ? null : hint([external], 8 + name.length)}
        {listing ? null : button(external)}
      </Box>
      <Box flexDirection="row" gap={2}>
        {([['j', '↓', '\u{ea9a}', 1], ['k', '↑', '\u{eaa1}', -1], ['f', 'page ↓', '\u{ea9a} page', previewing.previewRows - 2], ['b', 'page ↑', '\u{eaa1} page', 2 - previewing.previewRows]] as const).map(([k, plain, nerd, by]) => {
          const step = p?.diff && (k === 'j' || k === 'k') ? (p.diff.some(l => l.kind === '@') ? 'file' : 'hunk') : ''
          const label = step ? `${unicode ? plain : nerd} ${step}` : unicode ? plain : nerd
          return <Button key={`pv-${k}`} plain dimColor hotkey={k} label={label} onPress={() => void (step ? jumpDiff($, by > 0 ? 1 : -1) : scrollPreview($, by)).then(() => parkPreview($))} />
        })}
        {listing ? null : <Button key="pv-d" plain dimColor hotkey="d" label={p?.diff ? (t.nodes.find(n => n.id === t.preview)?.kind === 'dir' ? 'tree' : 'file') : 'diff'} onPress={() => void diffFile($, t.preview)} />}
        {!listing && (settings.editWithSetting || machine.inTmux || machine.inHerdr) ? <Button key="edit" plain dimColor autoFocus hotkey="e" label={`${unicode ? 'edit' : '\u{ea73} edit'} :${previewing.previewLine}`} onPress={() => void editPreview($, t.preview)} /> : null}
      </Box>
      {p?.note ? <Text {...mutedText}>{p.note}</Text> : null}
      {ui.nativeScroll ? directPreview(elements, { ...win, top: first + win.top }, t.preview, markdown, theme.accent) : (
        <Client
          key="rows"
          module="./rows.tsx"
          props={{ rows: [], active: '', ...rowColors, pointer: false, preview: 'segments' in win ? { text: '', path: t.preview, startLine: win.top + 1, markdown: false, segments: win.segments, titleColor: theme.accent } : { text: win.text, path: t.preview, startLine: first + win.top + 1, markdown } } satisfies RowsProps}
        />
      )}
    </Box>
  )
}
