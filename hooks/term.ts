import { type Rgb, rgbOf } from './pixmap'

export type TermColors = { fg?: Rgb; bg?: Rgb; palette: Record<number, Rgb> }

const XTERM: Rgb[] = [
  [0, 0, 0], [205, 0, 0], [0, 205, 0], [205, 205, 0], [0, 0, 238], [205, 0, 205], [0, 205, 205], [229, 229, 229],
  [127, 127, 127], [255, 0, 0], [0, 255, 0], [255, 255, 0], [92, 92, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255],
]

export const CELL_PROBE = 'import fcntl,os,struct,termios\nfd=os.open("/dev/tty",os.O_RDONLY)\nr,c,x,y=struct.unpack("HHHH",fcntl.ioctl(fd,termios.TIOCGWINSZ,b"\\0"*8))\nprint(x//c if c and x else 0,y//r if r and y else 0)'

export const GHOSTTY_ARGS = 'p=$PPID; while [ "$p" -gt 1 ] 2>/dev/null; do case "$(cat /proc/$p/comm 2>/dev/null)" in ghostty*) tr "\\0" "\\n" < /proc/$p/cmdline; exit 0;; esac; p=$(cut -d" " -f4 /proc/$p/stat 2>/dev/null) || exit 0; done'

export function parseGhostty(text: string): TermColors {
  const out: TermColors = { palette: {} }
  for (const line of text.split('\n')) {
    const m = /^\s*(?:--)?([a-z-]+)\s*=\s*(.+?)\s*$/.exec(line)
    if (!m) continue
    const [, key, raw = ''] = m
    const value = raw.replace(/^"|"$/g, '')
    if (key === 'background' || key === 'foreground') {
      const rgb = rgbOf(value.startsWith('#') ? value : `#${value}`)
      if (rgb) out[key === 'background' ? 'bg' : 'fg'] = rgb
    } else if (key === 'palette') {
      const p = /^(\d+)\s*=\s*#?([0-9a-f]{6})$/i.exec(value)
      const rgb = p ? rgbOf(`#${p[2]}`) : undefined
      if (p && rgb) out.palette[Number(p[1])] = rgb
    }
  }
  return out
}

export function colorOf(color: string, term: TermColors, light: boolean): Rgb {
  const hex = rgbOf(color)
  if (hex) return hex
  const n = /^ansi256\((\d+)\)$/.exec(color)
  if (n) return term.palette[Number(n[1])] ?? XTERM[Number(n[1])] ?? [128, 128, 128]
  return term.fg ?? (light ? [32, 32, 32] : [220, 220, 220])
}

const TEXT_EMOJI_VS16 = /(?=\P{Emoji_Presentation})(\p{Extended_Pictographic})\uFE0F(?!\u200D)/gu

const LITERAL = /^ {0,3}(`{3,}|~{3,})[^\n]*(?:\n[\s\S]*?\n {0,3}\1[`~]*[ \t]*(?=\n|$)|[\s\S]*$)|(`+)(?!`)[\s\S]*?(?<!`)\2(?!`)|\]\([^)]*\)|<[a-z][a-z0-9+.-]*:[^\s<>]*>|\b[a-z][a-z0-9+.-]*:\/\/[^\s<>]*/gim

export function narrowEmoji(text: string): string {
  if (!text.includes('\uFE0F')) return text
  let out = ''
  let at = 0
  for (const m of text.matchAll(LITERAL)) {
    out += text.slice(at, m.index).replace(TEXT_EMOJI_VS16, '$1') + m[0]
    at = m.index + m[0].length
  }
  return out + text.slice(at).replace(TEXT_EMOJI_VS16, '$1')
}
