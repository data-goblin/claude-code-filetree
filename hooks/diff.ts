export type DiffLine = { kind: ' ' | '+' | '-' | '@'; text: string; old: number; new: number }
export type DiffSegment = { title: string; source: string }

export function parseDiff(patch: string): DiffLine[] {
  const out: DiffLine[] = []
  let old = 0
  let cur = 0
  let inHunk = false
  for (const line of patch.replace(/\r\n?/g, '\n').split('\n')) {
    const head = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
    if (head) {
      old = Number(head[1])
      cur = Number(head[2])
      inHunk = true
      continue
    }
    if (!inHunk || line.startsWith('\\')) continue
    const kind = line[0]
    if (kind === '+') out.push({ kind, text: line.slice(1), old, new: cur++ })
    else if (kind === '-') out.push({ kind, text: line.slice(1), old: old++, new: cur })
    else if (kind === ' ') out.push({ kind, text: line.slice(1), old: old++, new: cur++ })
    else inHunk = false
  }
  return out
}

export function splitPatch(patch: string): { path: string; lines: DiffLine[] }[] {
  return patch
    .replace(/\r\n?/g, '\n')
    .split(/^(?=diff --git )/m)
    .map(part => {
      const plus = /^\+\+\+ (?:b\/)?(.+)$/m.exec(part)?.[1]
      const head = /^diff --git a\/.+ b\/(.+)$/m.exec(part)?.[1]
      return { path: (plus && plus !== '/dev/null' ? plus : head) ?? '', lines: parseDiff(part) }
    })
    .filter(f => f.lines.length)
}

export function diffWindow(lines: DiffLine[], top: number, rows: number): { segments: DiffSegment[]; top: number } {
  const from = Math.max(0, Math.min(top, lines.length - 1))
  const shown = lines.slice(from, from + rows)
  const segments: DiffSegment[] = []
  let title = ''
  for (let i = from; i >= 0; i--) {
    const l = lines[i]
    if (l?.kind === '@') {
      title = i === from ? '' : l.text
      break
    }
  }
  let out: string[] = []
  let run: DiffLine[] = []
  const flush = () => {
    const first = run[0]
    if (!first) return
    const olds = run.filter(l => l.kind !== '+').length
    const news = run.filter(l => l.kind !== '-').length
    out.push(`@@ -${first.old},${olds} +${first.new},${news} @@`, ...run.map(l => `${l.kind}${l.text}`))
    run = []
  }
  const close = () => {
    flush()
    if (out.length || title) segments.push({ title, source: out.join('\n') })
    out = []
  }
  for (const line of shown) {
    if (line.kind === '@') {
      close()
      title = line.text
      continue
    }
    const prev = run[run.length - 1]
    const nextOld = prev ? prev.old + (prev.kind === '+' ? 0 : 1) : 0
    const nextNew = prev ? prev.new + (prev.kind === '-' ? 0 : 1) : 0
    if (prev && (line.old !== nextOld || line.new !== nextNew)) flush()
    run.push(line)
  }
  close()
  return { segments, top: from }
}
