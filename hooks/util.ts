import type { EngineInterface, HookStream, ProcessSpawnResult } from 'claude-code'
import { posix, inside } from './tree'
import type { Seg } from './rows'
import type { Rgb } from './pixmap'
import { machine } from './state'
import { PANE } from './consts'

let platform: Promise<'linux' | 'darwin' | 'win32'> | null = null

export function osName($: EngineInterface): Promise<'linux' | 'darwin' | 'win32'> {
  platform ??= (async () => {
    if ((await $.env.get('OS')) === 'Windows_NT') return 'win32'
    try {
      return (await $.process.run(['uname', '-s'], { timeoutMs: 3_000 })).stdout.trim() === 'Darwin' ? 'darwin' : 'linux'
    } catch {
      return 'linux'
    }
  })()
  return platform
}

export async function cwdOf($: EngineInterface): Promise<string> {
  return posix(await $.session.cwd())
}

export function clean(segs: Seg[]): Seg[] {
  for (const seg of segs) for (const [k, v] of Object.entries(seg)) if (v === undefined) Reflect.deleteProperty(seg, k)
  return segs
}

export function toHex(c: Rgb): string {
  return `#${c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`
}

export function faint(hex: string): string {
  const v = parseInt(hex.slice(1), 16)
  const ch = (shift: number) => Math.round(0x26 + (((v >> shift) & 255) - 0x26) * 0.3)
  return `#${[16, 8, 0].map(x => ch(x).toString(16).padStart(2, '0')).join('')}`
}

export function weigh(el: unknown): [number, number] {
  const text = JSON.stringify(el) ?? ''
  return [text.length, text.split('"type":').length - 1]
}

export async function exists($: EngineInterface, path: string): Promise<boolean> {
  try {
    await $.fs.stat(path)
    return true
  } catch {
    return false
  }
}

export function stopStream(stream: HookStream<unknown, ProcessSpawnResult>): void {
  void stream.return({ code: null, signal: null }).catch(() => undefined)
}

export function has<K extends string>(v: unknown, key: K): v is Record<K, unknown> {
  return typeof v === 'object' && v !== null && key in v
}

export function messageOf(err: unknown): string {
  return String((has(err, 'message') ? err.message : undefined) ?? err)
}

export function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x: unknown): x is string => typeof x === 'string') : []
}

export function unlessAborted(err: unknown): null {
  if (/aborted/.test(messageOf(err))) throw err
  return null
}

export function focusPane($: EngineInterface, root: string, key: string): void {
  void $.ui.open({ id: PANE, title: `Files: ${root.split('/').pop() || root}`, focus: true }).then(() => (key ? $.ui.focus({ requestId: PANE, key }) : undefined)).catch(() => {})
}

export function shortPath(path: string): string {
  return machine.home && inside(machine.home, path) ? `~${path.slice(machine.home.length)}` : path
}
