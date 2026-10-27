import { FONT_BITS, FONT_CHARS, FONT_H, FONT_W } from './font'
import { fillOf, pixelGap, pixelInset, type Tile } from './treemap'

export type Rgb = [number, number, number]
export type PixelLook = { fill: Rgb; alpha: number; ink: Rgb; bold: boolean; rank: number; dim: boolean }

const MAX_SIDE = 2048
const GLYPHS = new Map([...FONT_CHARS].map((c, i) => [c, i]))
const BITS = Uint8Array.from(atob(FONT_BITS), c => c.charCodeAt(0))

export function rgbOf(color: string): Rgb | undefined {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim())
  if (!m) return undefined
  const v = parseInt(m[1] ?? '0', 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

function luminance([r, g, b]: Rgb): number {
  const c = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b)
}

export function over(under: Rgb, fill: Rgb, alpha: number): Rgb {
  const mix = (i: 0 | 1 | 2) => fill[i] * alpha + under[i] * (1 - alpha)
  return [mix(0), mix(1), mix(2)]
}

export function ratio(a: Rgb, b: Rgb): number {
  const [x, y] = [luminance(a), luminance(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

export function inkOn(fill: Rgb, inks: Rgb[]): Rgb {
  return inks.reduce((best, c) => (ratio(c, fill) > ratio(best, fill) ? c : best))
}

function tinted(paper: Rgb, tint: Rgb, inks: Rgb[], alpha: number): { fill: Rgb; ink: Rgb; score: number; alpha: number } {
  const fill = over(paper, tint, alpha)
  const ink = inkOn(fill, inks)
  return { fill, ink, score: ratio(ink, fill), alpha }
}

function strongest(paper: Rgb, tint: Rgb, inks: Rgb[], target: number): ReturnType<typeof tinted> {
  const all = Array.from({ length: 51 }, (_, i) => tinted(paper, tint, inks, i / 50))
  const ok = all.filter(x => x.score >= 4.5)
  const near = (x: { alpha: number }) => Math.abs(x.alpha - target)
  return ok.length ? ok.reduce((a, b) => (near(b) < near(a) ? b : a)) : all.reduce((a, b) => (b.score > a.score ? b : a))
}

export function boxLook(paper: Rgb, tint: Rgb, inks: Rgb[], depth: number, share: number): { fill: Rgb; ink: Rgb } {
  const top = strongest(paper, tint, inks, 0.74 + 0.2 * Math.sqrt(share))
  if (!(depth % 2)) return top
  return tinted(paper, tint, inks, strongest(paper, tint, inks, 0.84).alpha >= 0.45 ? 0.16 : 0)
}

export function readable(fill: Rgb, alpha: number, ink: Rgb, ground: Rgb): Rgb {
  const under = luminance(over(ground, fill, alpha))
  const ratio = (c: Rgb) => (Math.max(luminance(c), under) + 0.05) / (Math.min(luminance(c), under) + 0.05)
  return ratio(ink) >= ratio(ground) ? ink : ground
}

export function fitPixels(columns: number, rows: number, cw: number, ch: number): { width: number; height: number; scale: number } {
  let width = Math.round(columns * cw)
  let height = Math.round(rows * ch)
  let scale = 1
  while (width / scale > MAX_SIDE || height / scale > MAX_SIDE) scale++
  width = Math.ceil(width / scale)
  height = Math.ceil(height / scale)
  return { width, height, scale }
}

export const glyphScale = (ch: number) => Math.max(1, Math.floor((ch * 0.8) / FONT_H))

export const textHeight = (ch: number) => FONT_H * glyphScale(ch)

export function paint(looked: { tile: Tile; look: PixelLook }[], width: number, height: number, ch: number, label: (t: Tile) => string): Uint8Array {
  const px = new Uint32Array(width * height)
  const put = (x0: number, y0: number, x1: number, y1: number, [r, g, b]: Rgb, a: number) => {
    const ax = Math.max(0, Math.floor(x0))
    const bx = Math.min(width, Math.floor(x1))
    const ay = Math.max(0, Math.floor(y0))
    const by = Math.min(height, Math.floor(y1))
    if (ax >= bx || ay >= by) return
    const word = ((Math.round(a * 255) & 255) << 24) | (b << 16) | (g << 8) | r
    for (let y = ay; y < by; y++) {
      if (a >= 1) {
        px.fill(word >>> 0, y * width + ax, y * width + bx)
        continue
      }
      for (let i = y * width + ax; i < y * width + bx; i++) {
        const d = px[i] ?? 0
        const da = (d >>> 24) / 255
        if (!da) {
          px[i] = word >>> 0
          continue
        }
        const oa = a + da * (1 - a)
        const mixc = (c: number, s: number) => Math.round((c * a + ((d >>> s) & 255) * da * (1 - a)) / oa)
        px[i] = ((Math.round(oa * 255) << 24) | (mixc(b, 16) << 16) | (mixc(g, 8) << 8) | mixc(r, 0)) >>> 0
      }
    }
  }
  const gap = pixelGap(ch)
  const inset = pixelInset(ch)
  const scale = glyphScale(ch)
  const gw = FONT_W * scale
  const gh = FONT_H * scale
  const text = (s: string, x: number, y: number, ink: Rgb, bold: boolean) => {
    let cx = x
    for (const c of s) {
      const i = GLYPHS.get(c) ?? GLYPHS.get('?') ?? 0
      for (let row = 0; row < FONT_H; row++) {
        const bits = BITS[i * FONT_H + row] ?? 0
        if (!bits) continue
        for (let col = 0; col < FONT_W; col++) {
          if (!(bits & (0x80 >> col))) continue
          const ox = cx + col * scale
          const oy = y + row * scale
          put(ox, oy, ox + scale + (bold ? Math.max(1, scale >> 1) : 0), oy + scale, ink, 1)
        }
      }
      cx += gw
    }
  }
  const order = [...looked].sort((a, b) => a.tile.depth - b.tile.depth)
  for (const { tile: t, look: lk } of order) {
    const f = fillOf(t, inset)
    put(f.x0, f.y0, f.x1, f.y1, lk.fill, lk.alpha)
    const room = Math.floor((f.x1 - f.x0 - 2 * gap) / gw)
    const tall = f.y1 - f.y0 - 2 * gap
    const lines = tall < gh ? 0 : 1 + Math.floor((tall - gh) / ch)
    const name = [...t.name].length
    const size = label(t)
    const sized = [...size].length
    if (lines < 1 || name > room) continue
    const x = f.x0 + gap
    const y = f.y0 + gap
    text(t.name, x, y, lk.ink, lk.bold)
    if (name + 1 + sized <= room) text(size, x + (name + 1) * gw, y, lk.ink, lk.bold)
    else if (!t.nested && lines >= 2 && sized <= room) text(size, x, y + ch, lk.ink, lk.bold)
  }
  return new Uint8Array(px.buffer)
}

export function hit(tiles: Tile[], x: number, y: number): Tile | undefined {
  return [...tiles].reverse().find(t => x >= t.x0 && x < t.x1 && y >= t.y0 && y < t.y1)
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258]
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]

function deflate(data: Uint8Array): Uint8Array {
  let out = new Uint8Array(1024 + (data.length >> 3))
  let pos = 0
  let acc = 0
  let bits = 0
  const push = (value: number, count: number) => {
    acc |= value << bits
    bits += count
    while (bits >= 8) {
      if (pos >= out.length) {
        const grown = new Uint8Array(out.length * 2)
        grown.set(out)
        out = grown
      }
      out[pos++] = acc & 255
      acc >>>= 8
      bits -= 8
    }
  }
  const huff = (code: number, count: number) => {
    let r = 0
    for (let i = 0; i < count; i++) r |= ((code >> i) & 1) << (count - 1 - i)
    push(r, count)
  }
  const symbol = (v: number) => {
    if (v < 144) huff(0x30 + v, 8)
    else if (v < 256) huff(0x190 + v - 144, 9)
    else if (v < 280) huff(v - 256, 7)
    else huff(0xc0 + v - 280, 8)
  }
  push(0x78, 8)
  push(0x01, 8)
  push(1, 1)
  push(1, 2)
  let i = 0
  while (i < data.length) {
    const prev = data[i - 1]
    let run = 0
    if (i > 0) while (run < 258 && i + run < data.length && data[i + run] === prev) run++
    if (run >= 3) {
      let code = LEN_BASE.length - 1
      while ((LEN_BASE[code] ?? 0) > run) code--
      symbol(257 + code)
      push(run - (LEN_BASE[code] ?? 0), LEN_EXTRA[code] ?? 0)
      huff(0, 5)
      i += run
    } else symbol(data[i++] ?? 0)
  }
  symbol(256)
  if (bits) push(0, 8 - bits)
  let a = 1
  let b = 0
  for (let k = 0; k < data.length; k += 4096) {
    const end = Math.min(data.length, k + 4096)
    for (let j = k; j < end; j++) {
      a += data[j] ?? 0
      b += a
    }
    a %= 65521
    b %= 65521
  }
  const sum = ((b << 16) | a) >>> 0
  push(sum >>> 24, 8)
  push((sum >>> 16) & 255, 8)
  push((sum >>> 8) & 255, 8)
  push(sum & 255, 8)
  return out.subarray(0, pos)
}

export function png(rgba: Uint8Array, width: number, height: number): Uint8Array {
  const stride = width * 4
  const raw = new Uint8Array((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    const row = rgba.subarray(y * stride, (y + 1) * stride)
    const above = y ? rgba.subarray((y - 1) * stride, y * stride) : undefined
    let same = above !== undefined
    for (let x = 0; same && x < stride; x++) same = row[x] === above?.[x]
    const o = y * (stride + 1)
    raw[o] = same ? 2 : 1
    if (same) continue
    for (let x = 0; x < stride; x++) raw[o + 1 + x] = ((row[x] ?? 0) - (x >= 4 ? (row[x - 4] ?? 0) : 0)) & 255
  }
  const idat = deflate(raw)
  const chunk = (type: string, body: Uint8Array) => {
    const out = new Uint8Array(12 + body.length)
    const view = new DataView(out.buffer)
    view.setUint32(0, body.length)
    for (let k = 0; k < 4; k++) out[4 + k] = type.charCodeAt(k)
    out.set(body, 8)
    let c = 0xffffffff
    for (let k = 4; k < 8 + body.length; k++) c = (CRC[(c ^ (out[k] ?? 0)) & 255] ?? 0) ^ (c >>> 8)
    view.setUint32(8 + body.length, (c ^ 0xffffffff) >>> 0)
    return out
  }
  const head = new Uint8Array(13)
  const hv = new DataView(head.buffer)
  hv.setUint32(0, width)
  hv.setUint32(4, height)
  head.set([8, 6, 0, 0, 0], 8)
  const parts = [Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))]
  const file = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    file.set(p, at)
    at += p.length
  }
  return file
}
