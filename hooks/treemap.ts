import type { RowSpec, Seg } from './rows'

export type Usage = { path: string; name: string; bytes: number; kids?: Usage[] }
export type Tile = { path: string; name: string; bytes: number; x0: number; y0: number; x1: number; y1: number; depth: number; parent?: Tile; nested: boolean }
export type TileLook = { name: string; size: string; bold: boolean; bg?: string; rank: number }

export const REST = '#rest'
export const CELL_ASPECT = 2
const MIN_AREA = 7 * 2 * CELL_ASPECT * 1.5
const MAX_TILES = 60
const NEST_COLUMNS = 12
const NEST_ROWS = 6

export const gapOf = (ch: number) => Math.max(2, Math.round(ch / 9))

export function parseDu(text: string, dir: string): { total?: number; items: Usage[] } {
  const top = new Map<string, Usage>()
  const kids = new Map<string, Usage[]>()
  let total: number | undefined
  const base = dir.endsWith('/') ? dir : `${dir}/`
  for (const line of text.split('\n')) {
    const tab = line.indexOf('\t')
    const kb = Number(line.slice(0, tab))
    if (tab < 1 || !Number.isFinite(kb)) continue
    const path = line.slice(tab + 1)
    if (path === dir) {
      total = kb * 1024
      continue
    }
    if (!path.startsWith(base)) continue
    const rel = path.slice(base.length)
    const cut = rel.indexOf('/')
    const usage = { path, name: rel.slice(cut + 1), bytes: kb * 1024 }
    if (cut < 0) top.set(path, usage)
    else {
      const parent = base + rel.slice(0, cut)
      const list = kids.get(parent)
      if (list) list.push(usage)
      else kids.set(parent, [usage])
    }
  }
  return { total, items: [...top.values()].map(u => ({ ...u, kids: kids.get(u.path) ?? [] })) }
}

export function mix(from: string, to: string, t: number): string {
  const rgb = (hex: string) => {
    const v = parseInt(hex.slice(1), 16)
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
  }
  const a = rgb(from)
  const b = rgb(to)
  return `#${a.map((x, i) => Math.round(x + ((b[i] ?? x) - x) * Math.max(0, Math.min(1, t))).toString(16).padStart(2, '0')).join('')}`
}

function worst(row: number[], side: number): number {
  const sum = row.reduce((a, b) => a + b, 0)
  const max = Math.max(...row)
  const min = Math.min(...row)
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min))
}

function squarify(areas: number[], x: number, y: number, w: number, h: number): { x: number; y: number; w: number; h: number }[] {
  const out: { x: number; y: number; w: number; h: number }[] = []
  let i = 0
  while (i < areas.length) {
    const side = Math.min(w, h)
    const row = [areas[i] ?? 0]
    let j = i + 1
    while (j < areas.length && worst([...row, areas[j] ?? 0], side) <= worst(row, side)) row.push(areas[j++] ?? 0)
    const thick = row.reduce((a, b) => a + b, 0) / side
    let off = 0
    for (const a of row) {
      const len = a / thick
      out.push(w >= h ? { x, y: y + off, w: thick, h: len } : { x: x + off, y, w: len, h: thick })
      off += len
    }
    if (w >= h) {
      x += thick
      w -= thick
    } else {
      y += thick
      h -= thick
    }
    i = j
  }
  return out
}

export type Gaps = { l: number; r: number; t: number; b: number }
type Unit = { cw: number; ch: number; aspect: number; inset: Gaps; gx: number; gy: number; text: number }
export const CELL_INSET: Gaps = { l: 1, r: 1, t: 1, b: 0 }
const CELL_GAP = { x: 2, y: 1 }

export const fillOf = (t: Tile, g: Gaps) => ({ x0: t.x0 + g.l, y0: t.y0 + g.t, x1: t.x1 - g.r, y1: t.y1 - g.b })

function place(usage: Usage[], x0: number, y0: number, x1: number, y1: number, u: Unit, parent?: Tile): Tile[] {
  const w = x1 - x0
  const h = (y1 - y0) * u.aspect
  const minArea = MIN_AREA * u.cw * u.cw
  const sorted = usage.filter(u => u.bytes > 0).sort((a, b) => b.bytes - a.bytes)
  const total = sorted.reduce((a, u) => a + u.bytes, 0)
  if (!total || w < 1 || h < 1) return []
  let keep = sorted.findIndex((u, i) => i >= MAX_TILES - 1 || (u.bytes * w * h) / total < minArea)
  keep = keep < 0 ? sorted.length : Math.max(1, keep)
  const rest = sorted.slice(keep).reduce((a, u) => a + u.bytes, 0)
  const weigh = (x: Usage) => (x.path.startsWith(REST) ? Math.max(x.bytes, (Math.max(minArea, 8 * u.cw * Math.min(w, h)) * total) / (w * h)) : x.bytes)
  const shown: Usage[] = sorted.slice(0, keep)
  if (rest > 0) shown.push({ path: `${REST}${parent?.path ?? ''}`, name: `+${sorted.length - keep}`, bytes: rest })
  shown.sort((a, b) => weigh(b) - weigh(a))
  const scale = (w * h) / shown.reduce((a, u) => a + weigh(u), 0)
  const rects = squarify(shown.map(u => weigh(u) * scale), 0, 0, w, h)
  const g = u.inset
  return shown.flatMap((s, i) => {
    const r = rects[i]
    if (!r) return []
    const tile: Tile = { path: s.path, name: s.name, bytes: s.bytes, x0: x0 + Math.round(r.x), x1: x0 + Math.round(r.x + r.w), y0: y0 + Math.round(r.y / u.aspect), y1: y0 + Math.round((r.y + r.h) / u.aspect), depth: parent ? parent.depth + 1 : 0, nested: false, ...(parent ? { parent } : {}) }
    const f = fillOf(tile, g)
    if (f.x1 <= f.x0 || f.y1 <= f.y0) return []
    const inner = !parent && s.kids?.length && tile.x1 - tile.x0 >= NEST_COLUMNS * u.cw && tile.y1 - tile.y0 >= NEST_ROWS * u.ch ? place(s.kids, f.x0 + u.gx - g.l, f.y0 + 2 * u.gy + u.text - g.t, f.x1 - (u.gx - g.r), f.y1 - (u.gy - g.b), u, tile) : []
    tile.nested = inner.length > 0
    return [tile, ...inner]
  })
}

export function layout(usage: Usage[], columns: number, rows: number): Tile[] {
  const g = CELL_INSET
  return place(usage, CELL_GAP.x - g.l, CELL_GAP.y - g.t, columns - (CELL_GAP.x - g.r), rows - (CELL_GAP.y - g.b), { cw: 1, ch: 1, aspect: CELL_ASPECT, inset: g, gx: CELL_GAP.x, gy: CELL_GAP.y, text: 1 })
}

export const pixelGap = (ch: number) => 2 * gapOf(ch)

export function pixelInset(ch: number): Gaps {
  const half = gapOf(ch)
  return { l: half, r: half, t: half, b: half }
}

export function layoutPixels(usage: Usage[], width: number, height: number, cw: number, ch: number, textH: number): Tile[] {
  const gap = pixelGap(ch)
  const g = pixelInset(ch)
  return place(usage, gap - g.l, gap - g.t, width - (gap - g.r), height - (gap - g.b), { cw, ch, aspect: 1, inset: g, gx: gap, gy: gap, text: textH })
}

export function draw(tiles: Tile[], columns: number, rows: number, look: (t: Tile) => TileLook, label: (t: Tile) => string): RowSpec[] {
  const text = Array.from({ length: rows }, () => new Array<string>(columns).fill(' '))
  const style = Array.from({ length: rows }, () => new Array<Omit<Seg, 't'>>(columns).fill({}))
  const order = tiles.map(t => ({ t, lk: look(t) })).sort((a, b) => a.t.depth - b.t.depth)
  const g = CELL_INSET
  for (const { t, lk } of order) {
    const tab = t.path
    const f = fillOf(t, g)
    const cell = (x: number, y: number, st: Omit<Seg, 't'>, ch: string) => {
      const line = text[y]
      const styled = style[y]
      if (!line || !styled || x < 0 || x >= columns) return
      line[x] = ch
      styled[x] = st
    }
    const fill = lk.bg ? { bg: lk.bg } : {}
    for (let y = f.y0; y < f.y1; y++) for (let x = f.x0; x < f.x1; x++) cell(x, y, { ...fill, tab }, ' ')
    const room = f.x1 - f.x0 - 2 * CELL_GAP.x
    const lines = f.y1 - f.y0 - 2 * CELL_GAP.y
    const size = label(t)
    const name = [...t.name].length
    const sized = [...size].length
    if (lines < 1 || name > room) continue
    const nameSt = { c: lk.name, b: lk.bold, ...fill, tab }
    const sizeSt = { c: lk.size, b: lk.bold, ...fill, tab }
    const top = f.y0 + CELL_GAP.y
    const parts: [number, number, string, Omit<Seg, 't'>][] =
      name + 1 + sized <= room ? [[top, 0, t.name, nameSt], [top, name + 1, size, sizeSt]]
      : !t.nested && lines >= 2 && sized <= room ? [[top, 0, t.name, nameSt], [top + 1, 0, size, sizeSt]]
      : [[top, 0, t.name, nameSt]]
    for (const [y, from, s, st] of parts) [...s].forEach((ch, i) => cell(f.x0 + CELL_GAP.x + from + i, y, st, ch))
  }
  return text.map((row, y) => {
    const segs: Seg[] = []
    row.forEach((ch, x) => {
      const st = style[y]?.[x] ?? {}
      const last = segs[segs.length - 1]
      const seg: Seg = { t: ch, ...(st.c ? { c: st.c } : {}), ...(st.bg ? { bg: st.bg } : {}), ...(st.b ? { b: true } : {}), ...(st.tab ? { tab: st.tab } : {}) }
      if (last && last.c === seg.c && last.bg === seg.bg && last.b === seg.b && last.tab === seg.tab) last.t += ch
      else segs.push(seg)
    })
    return { id: '', left: segs, right: [] }
  })
}
