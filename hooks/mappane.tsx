import type { EngineInterface } from 'claude-code'
import type { Look } from './look'
import type { Layout } from './layout'
import type { Columns } from './columns'
import type { RenderElement } from 'claude-code'
import { mapping, previewing, settings, machine } from './state'
import { usageOf } from './scans'
import { layout, type Tile, REST, layoutPixels, draw } from './treemap'
import { colorOf } from './term'
import { type Rgb, boxLook, over, inkOn, readable, fitPixels, textHeight, type PixelLook, png, paint } from './pixmap'
import { isIgnored } from './listing'
import { inside, formatSize } from './tree'
import { formatLoc } from './loc'
import type { ZoneProps } from './zone'
import { PANE } from './consts'
import type { RowsProps } from './rows'

export function mapPane($: EngineInterface, c: Look & Layout & Columns, anchor: string): { content: RenderElement; status: string } {
  const { e, t, Box, Text, Client, Image, theme, tones, light, mutedText, rowColors } = c
  let content: RenderElement
  let status = ''
  mapping.mapAnchor = anchor
  const scan = usageOf($, anchor, t.column === 'loc')
  const cols = Math.max(8, e.props.bodyColumns - 1)
  const tiles = layout(scan.items, cols, previewing.peekRows)
  const total = scan.done ? scan.total : scan.items.reduce((a, u) => a + u.bytes, 0)
  const lit = settings.shimmerOn && t.flashOn ? t.flash : []
  const pick = tiles.find(x => x.path === mapping.mapPick)
  const ground = theme.bg
  const shade = ground.startsWith('#') && theme.accent.startsWith('#')
  const pct = (bytes: number) => { const p = total ? Math.round((bytes / total) * 100) : 0; return bytes && !p ? '<1%' : `${p}%` }
  const accent = colorOf(theme.accent, machine.termColors, light)
  const ink = colorOf(theme.fg, machine.termColors, light)
  const paper = machine.termColors.bg ?? (theme.bg ? colorOf(theme.bg, machine.termColors, light) : light ? ([255, 255, 255] satisfies Rgb) : ([24, 24, 24] satisfies Rgb))
  const muted = colorOf(theme.muted || 'ansi256(8)', machine.termColors, light)
  const hex = (c: Rgb) => `#${c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`
  const inks = [ink, paper, colorOf('ansi256(15)', machine.termColors, light), colorOf('ansi256(0)', machine.termColors, light)]
  const known = shade || Boolean(machine.termColors.bg)
  const dimmed = (tile: Tile) => tile.path.startsWith(REST) || (!t.showHidden && tile.name.startsWith('.')) || isIgnored(t.root, tile.path)
  const boxOf = (tile: Tile) => {
    if (!dimmed(tile)) return boxLook(paper, accent, inks, tile.depth, total ? tile.bytes / total : 0)
    const fill = over(paper, muted, 0.3)
    return { fill, ink: inkOn(fill, inks) }
  }
  const heat = (tile: Tile, picked: boolean) => {
    const hot = lit.find(f => inside(tile.path, f))
    const warm = !hot && tile.parent ? lit.find(f => inside(tile.parent?.path ?? '', f)) : undefined
    const from = hot ?? warm
    const tone = from ? colorOf(tones[t.flashTones[from] ?? 'orange']?.solid ?? theme.accent, machine.termColors, light) : undefined
    const lift: [Rgb, number] | undefined = picked ? [ink, 0.85] : hot && tone ? [tone, 0.8] : tone ? [paper, 0.35] : undefined
    return { tone, lift }
  }
  const look = (tile: Tile) => {
    const picked = tile === pick
    const { tone, lift } = heat(tile, picked)
    if (lift) {
      const fill = over(lift[0] === paper && tone ? over(paper, tone, 0.8) : paper, lift[0], lift[1])
      const c = hex(readable(fill, 1, ink, paper))
      return { name: c, size: c, bold: true, bg: hex(fill), rank: picked ? 2 : 1 }
    }
    if (known) {
      const box = boxOf(tile)
      const c = hex(box.ink)
      return { name: c, size: c, bold: true, bg: hex(box.fill), rank: 0 }
    }
    const top = !dimmed(tile) && !(tile.depth % 2)
    return { name: top ? 'ansi256(0)' : 'ansi256(15)', size: top ? 'ansi256(0)' : 'ansi256(15)', bold: true, bg: top ? 'ansi256(4)' : 'ansi256(8)', rank: 0 }
  }
  const amount = scan.loc ? formatLoc : formatSize
  status = pick ? `${pick.name} ${amount(pick.bytes)} ${pct(pick.bytes)}` : `${amount(total)}${scan.loc ? ' lines' : ''}${scan.done ? '' : ' …'}`
  const sized = (x: Tile) => `${amount(x.bytes)} ${pct(x.bytes)}`
  const pixels = Image && !machine.imageDenied && (settings.treemapSetting === 'image' || (settings.treemapSetting === 'auto' && machine.kittyTerm))
  if (pixels && tiles.length) {
    const cell = machine.cellPx ?? { cw: 10, ch: 20 }
    const k = (Math.max(1, Math.round((cell.ch * 0.75) / 16)) * 16) / 0.75 / cell.ch
    const fit = fitPixels(cols, previewing.peekRows, cell.cw * k, cell.ch * k)
    const cw = (cell.cw * k) / fit.scale
    const ch = (cell.ch * k) / fit.scale
    const boxes = layoutPixels(scan.items, fit.width, fit.height, cw, ch, textHeight(ch))
    const under = new Map<Tile, Rgb>()
    const pixelLook = (tile: Tile): PixelLook => {
      const picked = tile.path === mapping.mapPick
      const { lift } = heat(tile, picked)
      const dim = dimmed(tile)
      const box = lift ? null : boxOf(tile)
      const seen = box ? box.fill : over((tile.parent && under.get(tile.parent)) || paper, lift?.[0] ?? accent, lift?.[1] ?? 1)
      under.set(tile, seen)
      return { fill: seen, alpha: 1, ink: box ? box.ink : readable(seen, 1, ink, paper), bold: true, rank: lift ? (picked ? 2 : 1) : 0, dim }
    }
    const looked = boxes.map(tile => ({ tile, look: pixelLook(tile) }))
    const key = JSON.stringify([fit, ink, looked.map(({ tile: b, look }) => [b.path, b.x0, b.y0, b.x1, b.y1, sized(b), look])])
    if (mapping.mapImage?.key !== key) {
      mapping.mapImage = { key, png: png(paint(looked, fit.width, fit.height, ch, sized), fit.width, fit.height).toBase64() }
    }
    const zone: ZoneProps = { columns: cols, rows: previewing.peekRows, boxes: boxes.map(b => [b.path, b.x0 / cw, b.y0 / ch, b.x1 / cw, b.y1 / ch]) }
    if (!machine.imageChecked) {
      machine.imageChecked = true
      $.clock.after(300, () => void $.ui.blit({ requestId: PANE, key: 'treemap-image', source: { png: mapping.mapImage?.png ?? '' } }).then(r => {
        if (r.deny && /alt/i.test(r.deny)) {
          machine.imageDenied = true
          $.ui.invalidate('ui.render')
        }
        if (r.deny) machine.imageChecked = false
      }))
    }
    content = (
      <Box key="treemap-box" position="relative" height={previewing.peekRows} width={cols}>
        <Image key="treemap-image" source={{ png: mapping.mapImage.png }} columns={cols} rows={previewing.peekRows} alt=" " />
        <Box position="absolute" top={0} left={0}>
          <Client key="treemap" module="./zone.tsx" props={zone} />
        </Box>
      </Box>
    )
  } else content = tiles.length
    ? <Client key="treemap" module="./rows.tsx" props={{ rows: draw(tiles, cols, previewing.peekRows, look, sized), active: '', ...rowColors, pointer: machine.pointer } satisfies RowsProps} />
    : <Text {...mutedText}>{scan.done ? 'empty' : 'sizing…'}</Text>
  return { content, status }
}
