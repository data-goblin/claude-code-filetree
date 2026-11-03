export type FileRef = { path: string; line: number; end: number }

const REF = /(?<![\w.@~+\/\\:-])((?:[A-Za-z]:[\\/])?[\w.@~+\/\\-]+)(?::(\d+)(?:-(\d+))?|#L(\d+)(?:-L?(\d+))?)(?![\w])/g
const LIMIT = 20

export function fileRefs(text: string): FileRef[] {
  const out: FileRef[] = []
  const seen = new Set<string>()
  for (const m of text.matchAll(REF)) {
    const path = (m[1] ?? '').replace(/\\/g, '/').replace(/[.,;]+$/, '')
    if (!/[./]/.test(path) || /^[\d.]+$/.test(path) || path.endsWith('/')) continue
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
