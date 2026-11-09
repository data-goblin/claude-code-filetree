import type { RenderInputOf, EngineInterface } from 'claude-code'
import { settings, machine, guarding, ui } from './state'
import { get } from './store'
import type { Theme } from '../types'
import { DEFAULT_THEME } from './tree'
import { LIGHT_TONES, TONES } from './git'
import { DESK_GIT_TEXT, ink, DESK_GIT, DESK, selectionOn, lighten, iconSvg, type IconName, toolSvg } from './svg'
import { GIT_COLOR } from './icons'
import { ADD_COLOR, DEL_COLOR } from './palette'
import { loadGuards, allGuards } from './guard'
import { faint, toHex } from './util'
import { rgbOf, over } from './pixmap'
import type { ButtonProps } from './button'
import { searchFlag } from './search'
import { SPIN_MS } from './consts'

export type PaneEvent = RenderInputOf<'Pane', 'terminal'> | RenderInputOf<'Pane', 'desktop'>

const SHIMMER = Object.fromEntries(Object.entries(TONES).map(([k, v]) => [k, { bright: v.bright, dim: v.dim }]))
const LIGHT_SHIMMER = Object.fromEntries(Object.entries(LIGHT_TONES).map(([k, v]) => [k, { bright: v.bright, dim: v.dim }]))
export const DESK_ICON_COLS = 3
const TOGGLES = ['cwd', 'hidden', 'size', 'split', 'autocollapse', 'shimmer']
export const WORDS: Record<string, string> = { up: 'up', cwd: 'cwd', refresh: 'sync', hidden: 'dots', size: 'size', collapse: 'fold', autocollapse: 'auto', split: 'split', unselect: 'clear' }

export async function lookOf($: EngineInterface, e: PaneEvent) {
  const unicode = settings.glyphSetting === 'plain' || settings.glyphSetting === 'text' || (settings.glyphSetting === 'auto' && (machine.noNerd || e.surface === 'desktop'))
  const elements = $.ui.resolve(e)
  const { Box, Text, Button, Input, Client } = elements
  const Svg = 'Svg' in elements ? elements.Svg : undefined
  const desk = e.surface === 'desktop' && Boolean(Svg)
  const Image = 'Image' in elements ? elements.Image : undefined
  const t = await get($)
  const light = e.surface !== 'desktop' && machine.lightTerminal
  const theme: Theme = { ...DEFAULT_THEME, ...settings.palette.theme }
  const tones = light ? LIGHT_TONES : TONES
  const mutedText = theme.muted ? { color: theme.muted } : { dimColor: true }
  const gitColors = { ...(desk ? DESK_GIT_TEXT : GIT_COLOR), ...settings.palette.git }
  const addColor = settings.palette.add ?? ADD_COLOR
  const delColor = settings.palette.del ?? DEL_COLOR
  const warnColor = gitColors.M ?? 'ansi256(3)'
  await loadGuards($)
  const guarded = new Set(allGuards(guarding.guards))
  const deskDiff = (source: string, key: string) => {
    const rows: { kind: ' ' | '+' | '-' | '@'; text: string; old: number; new: number }[] = []
    let old = 0
    let cur = 0
    let inHunk = false
    for (const line of source.split('\n')) {
      const head = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
      if (head) {
        old = Number(head[1])
        cur = Number(head[2])
        inHunk = true
        rows.push({ kind: '@', text: line, old, new: cur })
        continue
      }
      if (!inHunk) continue
      const kind = line[0]
      if (kind === '+') rows.push({ kind, text: line.slice(1), old: 0, new: cur++ })
      else if (kind === '-') rows.push({ kind, text: line.slice(1), old: old++, new: 0 })
      else if (kind === ' ') rows.push({ kind, text: line.slice(1), old: old++, new: cur++ })
    }
    const digits = Math.max(2, ...rows.map(r => String(Math.max(r.old, r.new)).length))
    const add = ink(addColor, DESK_GIT.A ?? DESK.accent)
    const del = ink(delColor, DESK.urgent)
    const tintOf = (kind: string) => (kind === '+' ? DESK.addBg : kind === '-' ? DESK.delBg : undefined)
    return (
      <Box key={`${key}-diff`} flexDirection="column">
        {rows.map((r, j) => r.kind === '@' ? (
          <Box key={`${key}-h${j}`} flexDirection="row" alignItems="center" paddingLeft={1} backgroundColor={DESK.hover}>
            <Text dimColor size="footnote" tabular wrap="truncate-end">{r.text}</Text>
          </Box>
        ) : (
          <Box key={`${key}-l${j}`} flexDirection="row" alignItems="center" backgroundColor={tintOf(r.kind)}>
            <Box width={digits + 1} flexShrink={0} flexDirection="row" justifyContent="flex-end"><Text dimColor tabular mono>{r.old ? String(r.old) : ''}</Text></Box>
            <Box width={digits + 1} flexShrink={0} flexDirection="row" justifyContent="flex-end"><Text dimColor tabular mono>{r.new ? String(r.new) : ''}</Text></Box>
            <Box width={2} flexShrink={0} flexDirection="row" justifyContent="center"><Text color={r.kind === '+' ? add : r.kind === '-' ? del : mutedInk} mono>{r.kind === ' ' ? '' : r.kind}</Text></Box>
            <Box flexGrow={1} flexShrink={1} overflow="hidden"><Text mono wrap="truncate-end">{r.text.replace(/\t/g, '  ') || ' '}</Text></Box>
          </Box>
        ))}
      </Box>
    )
  }
  const selBg = selectionOn(theme.selection, theme.bg, light)
  const rowColors = { activeBg: selBg, hoverBg: settings.palette.hover ?? (theme.selection.startsWith('#') ? faint(theme.selection) : ''), tones: light ? LIGHT_SHIMMER : SHIMMER }
  ui.nativeScroll = e.surface === 'desktop'
  const accentInk = ink(theme.accent, DESK.accent)
  const accentText = desk ? 'suggestion' : accentInk
  const mutedInk = ink(theme.muted, DESK.muted)
  const dc = (c: string | undefined) => (desk && c ? ink(c, c) : c)
  const tint = (c: string | undefined) => (c === '' ? { dimColor: true } : c === undefined ? {} : !desk ? { color: c } : c === theme.muted ? { dimColor: true } : c === theme.accent ? { color: 'suggestion' } : c === theme.urgent ? { color: 'error' } : { color: ink(c, c) })
  const bgRgb = rgbOf(theme.bg)
  const searchBg = bgRgb ? toHex(over(bgRgb, rgbOf(theme.fg) ?? (light ? [0, 0, 0] : [255, 255, 255]), 0.07)) : light ? 'ansi256(254)' : 'ansi256(236)'
  const glow = (color: string, id: string) => (ui.hovered === id ? lighten(color) : color)
  const flagOf = { case: 'searchCase', regex: 'searchRegex', content: 'searchContent' } as const
  const toggle = (id: keyof typeof flagOf, label: string, active: boolean, bad: boolean) => {
    const color = bad ? ink(theme.urgent, DESK.urgent) : active ? accentInk : mutedInk
    return desk ? (
      <Box key={`tool-${id}`} position="relative" flexShrink={0} flexDirection="row" alignItems="center">
        {id === 'content' && Svg
          ? <Svg key={`search-${id}-icon-${active ? 'on' : 'off'}`} source={iconSvg('file-text', glow(color, id), 16)} alt={`search file contents ${active ? 'on' : 'off'}`} width={16} height={16} />
          : <Text color={glow(color, id)} hover={{ color: lighten(color) }} weight={active ? 'semibold' : 'regular'}>{label}</Text>}
        <Box position="absolute" top={0} left={0} right={0} bottom={0}>
          <Client key={`button-${id}`} module="./button.tsx" props={{ id, label: '', dim: !active } satisfies ButtonProps} width="100%" height="100%" />
        </Box>
      </Box>
    ) : (
      <Button key={`search-${id}`} plain label={label} onPress={() => void searchFlag($, flagOf[id])}>
        <Text {...(bad ? { color: theme.urgent } : active ? { color: theme.accent } : { dimColor: true })}>{label}</Text>
      </Button>
    )
  }
  const deskSel = settings.palette.theme.selection ?? DESK.selection
  const deskHover = settings.palette.hover ?? DESK.hover
  const deskCur = e.props.isFocused ? deskSel : deskHover
  const deskCursor = settings.palette.theme.accent ? `${accentInk}1f` : DESK.cursor
  const jumpSel = settings.palette.jump ? `${settings.palette.jump}1f` : DESK.jumpSel
  const button = (b: ButtonProps & { icon?: IconName; hint?: string }) => desk && Svg && b.icon ? (
    <Box key={`tool-${b.id}`} position="relative" flexDirection="row" alignItems="center" flexShrink={0}>
      <Svg key={`tool-icon-${b.id}${b.id === 'refresh' ? `-${ui.reloading ? 'spin' : ui.reloadSpin}` : ''}`} source={toolSvg(b.icon, glow(b.id === 'outside' ? ink(warnColor, DESK_GIT.M ?? DESK.accent) : b.dim && !(b.id === 'refresh' && ui.reloading) ? mutedInk : accentInk, b.id), b.id === 'refresh' && ui.reloading ? SPIN_MS : 0)} alt={`${WORDS[b.id] ?? b.id} button`} width={24} height={24} />
      {b.id === 'outside' ? <Text key="outside-count" color={glow(ink(warnColor, DESK_GIT.M ?? DESK.accent), b.id)} tabular>{`${guarding.outside.length} `}</Text> : null}
      <Box position="absolute" top={0} left={0} right={0} bottom={0}>
        <Client key={`button-${b.id}`} module="./button.tsx" props={{ id: b.id, label: '', dim: b.dim } satisfies ButtonProps} width="100%" height="100%" />
      </Box>
    </Box>
  ) : <Client key={`button-${b.id}`} module="./button.tsx" props={{ id: b.id, label: b.label, dim: b.dim, ...(TOGGLES.includes(b.id) ? { color: theme.accent } : b.id === 'outside' ? { color: warnColor } : {}) } satisfies ButtonProps} />
  const hint = (buttons: { id: string; label: string; hint: string; dim: boolean }[], title: number) => {
    const over = buttons.find(b => b.id === ui.hovered)
    const text = over?.hint
    if (!text) return null
    const tint = over && !over.dim ? accentInk : theme.fg ? ink(theme.fg, 'text') : 'text'
    const room = e.props.bodyColumns - title - buttons.reduce((w, b) => w + (desk ? DESK_ICON_COLS : b.label.length + 1), 0) - 2
    return text.length <= room ? <Text color={tint} wrap="truncate-end">{`${text} `}</Text> : null
  }
  return { e, unicode, elements, Box, Text, Button, Input, Client, Svg, desk, Image, t, light, theme, tones, mutedText, gitColors, addColor, delColor, warnColor, guarded, deskDiff, rowColors, accentInk, accentText, mutedInk, dc, tint, searchBg, glow, toggle, deskSel, deskHover, deskCur, deskCursor, jumpSel, button, hint }
}

export type Look = Awaited<ReturnType<typeof lookOf>>
