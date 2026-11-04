export type FileRef = { path: string; line: number; end: number }

const REF = /(?<![\w.@~+/\\:\])-])((?:[A-Za-z]:[\\/])?(?:[\w.@~+/\\-]|\[[\w.@~+-]+\]|\([\w.@~+-]+\))+)(?::(\d+)(?:-(\d+))?|#L(\d+)(?:-L?(\d+))?)(?![\w])/g
const LIMIT = 20

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

export function parseHref(href: string): FileRef | null {
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
