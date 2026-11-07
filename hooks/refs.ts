import type { EngineInterface, RenderSurface } from 'claude-code'
import { resolve } from './git'
import { machine } from './state'
import { inside } from './tree'
import { get } from './store'
import { openPane } from './site'
import { openHit } from './grep'

type FileRef = { path: string; line: number; end: number }

const REF = /(?<![\w.@~+/\\:\])-])((?:[A-Za-z]:[\\/])?(?:[\w.@~+/\\-]|\[[\w.@~+-]+\]|\([\w.@~+-]+\))+)(?::(\d+)(?:-(\d+))?|#L(\d+)(?:-L?(\d+))?)(?![\w])/g
const LIMIT = 20

const refCache = new Map<string, Promise<FileRef[]>>()

export function fileRefs(text: string): FileRef[] {
  const out: FileRef[] = []
  const seen = new Set<string>()
  for (const m of text.matchAll(REF)) {
    const path = (m[1] ?? '').replace(/\\/g, '/').replace(/[.,;]+$/, '')
    if (/^[\d.]+$/.test(path) || path.endsWith('/') || (!/[./]/.test(path) && !/^[A-Za-z][\w-]*$/.test(path))) continue
    const line = Number(m[2] ?? m[4])
    const end = Math.max(line, Number(m[3] ?? m[5] ?? line))
    if (!line) continue
    const key = `${path}:${line}-${end}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ path, line, end })
    if (out.length >= LIMIT) break
  }
  return out
}

export function refHref(ref: FileRef): string {
  return `file://${encodeURI(/^[A-Za-z]:/.test(ref.path) ? `/${ref.path}` : ref.path)}#L${ref.line}${ref.end > ref.line ? `-L${ref.end}` : ''}`
}

function parseHref(href: string): FileRef | null {
  const m = /^file:\/\/(.+)#L(\d+)(?:-L(\d+))?$/.exec(href)
  if (!m) return null
  const raw = decodeURI(m[1] ?? '')
  const path = /^\/[A-Za-z]:\//.test(raw) ? raw.slice(1) : raw
  return { path, line: Number(m[2]), end: Number(m[3] ?? m[2]) }
}

export function markdownSplit(text: string, at: number): [string, string] {
  const lines = text.split('\n')
  let fence = ''
  let open = ''
  let cut = 0
  const end = Math.min(at, lines.length)
  for (let i = 0; i < end; i++) {
    const m = /^\s{0,3}(`{3,}|~{3,})/.exec(lines[i] ?? '')
    if (m?.[1]) {
      if (!fence) {
        fence = m[1]
        open = (lines[i] ?? '').trim()
      } else if (m[1][0] === fence[0] && m[1].length >= fence.length) fence = ''
    } else if (!fence && !(lines[i] ?? '').trim()) cut = i + 1
  }
  const defs = lines.filter(l => /^\s{0,3}\[[^\]]+\]:\s*\S/.test(l)).join('\n')
  const tail = defs ? `\n\n${defs}` : ''
  if (fence) return [`${lines.slice(0, end).join('\n')}\n${fence}${tail}`, `${[open, ...lines.slice(end)].join('\n')}${tail}`]
  return [lines.slice(0, cut).join('\n') + tail, lines.slice(cut).join('\n') + tail]
}

export function refsIn($: EngineInterface, text: string, root: string, cwd: string): Promise<FileRef[]> {
  const key = `${root}\0${cwd}\0${text}`
  const known = refCache.get(key)
  if (known) return known
  const found = (async () => {
    const out: FileRef[] = []
    for (const r of fileRefs(text)) {
      const path = resolve(cwd, r.path, machine.home)
      if (!inside(root, path) || path === root || out.some(o => o.path === path && o.line === r.line && o.end === r.end)) continue
      const kind = await $.fs.stat(path).then(st => st.kind, () => '')
      if (kind === 'file') out.push({ ...r, path })
    }
    return out
  })()
  refCache.set(key, found)
  if (refCache.size > 200) refCache.delete(refCache.keys().next().value ?? key)
  return found
}

export async function openRef($: EngineInterface, href: string, surface: RenderSurface): Promise<void> {
  const ref = parseHref(href)
  if (!ref) return
  const t = await get($)
  if (!inside(t.root, ref.path)) return
  void openPane($, t.root).catch(() => undefined)
  await openHit($, { path: ref.path, line: ref.line, text: '' }, surface)
}
