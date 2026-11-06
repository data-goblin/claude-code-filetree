import { type Rgb, rgbOf } from './pixmap'
import type { EngineInterface } from 'claude-code'

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

export function narrowEmoji(text: string): string {
  return text.includes('\uFE0F') ? text.replace(TEXT_EMOJI_VS16, '$1') : text
}

const FONT_SCRIPT =
  'if command -v fc-list >/dev/null 2>&1; then f=$(fc-list ":charset=$1" file | grep -vi lastresort | head -n1 | cut -d: -f1); fi; ' +
  '[ -n "$f" ] || for g in "$HOME"/Library/Fonts/*Nerd* /Library/Fonts/*Nerd*; do [ -f "$g" ] && LC_ALL=C grep -aqE "Nerd Fonts (3\\.([2-9]|[1-9][0-9])|[4-9]|[1-9][0-9]+)\\." "$g" && { f=$g; break; }; done; ' +
  '[ -n "$f" ] || { echo missing; exit 0; }; m=$(stat -c %Z "$f" 2>/dev/null || stat -f %c "$f"); p=$PPID; ' +
  'while [ -n "$p" ] && [ "$p" -gt 1 ]; do c=$(ps -o comm= -p "$p" 2>/dev/null); c=$(basename "$c" 2>/dev/null | tr -d " "); case "$c" in ' +
  'ghostty|kitty|alacritty|Alacritty|foot|footclient|wezterm-gui|konsole|gnome-terminal-|xterm|urxvt|st|Terminal|iTerm2) ' +
  'e=$(ps -o etime= -p "$p" 2>/dev/null | awk -F\'[-:]\' \'{n=NF; s=$n+60*$(n-1); if (n>2) s+=3600*$(n-2); if (n>3) s+=86400*$(n-3); print s}\'); [ -n "$e" ] && [ $(( $(date +%s) - e )) -lt "$m" ] && echo stale || echo ok; exit 0;; esac; ' +
  'p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d " "); done; echo ok'

export const NERD_PROBE = 'f04eb ebff ebf6 ec01'

export async function fontState($: EngineInterface, charset: string): Promise<'ok' | 'stale' | 'missing'> {
  try {
    const out = (await $.process.run(['sh', '-c', FONT_SCRIPT, 'sh', charset], { timeoutMs: 5_000 })).stdout.trim()
    return out === 'stale' || out === 'missing' ? out : 'ok'
  } catch {
    return 'missing'
  }
}

export async function finePointerOk($: EngineInterface): Promise<boolean> {
  if (!(await $.env.get('HERDR_ENV'))) return true
  try {
    const out = (await $.process.run([(await $.env.get('HERDR_BIN_PATH')) || 'herdr', '--version'], { timeoutMs: 3_000 })).stdout
    const [major = 0, minor = 0, fix = 0] = (/(\d+)\.(\d+)\.(\d+)/.exec(out) ?? []).slice(1).map(Number)
    return major * 1e6 + minor * 1e3 + fix >= 9_001
  } catch {
    return false
  }
}

export async function cellPixels($: EngineInterface): Promise<{ cw: number; ch: number } | null> {
  try {
    const [cw = 0, ch = 0] = (await $.process.run(['python3', '-I', '-c', CELL_PROBE], { timeoutMs: 3_000 })).stdout.trim().split(/\s+/).map(Number)
    return cw > 2 && ch > 4 ? { cw, ch } : null
  } catch {
    return null
  }
}

export async function ghosttyColors($: EngineInterface): Promise<TermColors> {
  const args = (await $.process.run(['sh', '-c', GHOSTTY_ARGS], { timeoutMs: 3_000 }).catch(() => ({ stdout: '' }))).stdout.split('\n')
  const files = args.filter(a => a.startsWith('--config-file=')).map(a => a.slice('--config-file='.length).replace(/^\?/, ''))
  const own = args.includes('--config-default-files=false') ? '' : (await $.process.run(['ghostty', '+show-config'], { timeoutMs: 3_000 }).catch(() => ({ stdout: '' }))).stdout
  const read = await Promise.all(files.map(f => $.fs.read(f).then(String, () => '')))
  return parseGhostty([own, ...read, ...args.filter(a => a.startsWith('--'))].join('\n'))
}
