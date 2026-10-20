export type DiffLine = { kind: ' ' | '+' | '-'; text: string; old: number; new: number }

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

export function diffWindow(lines: DiffLine[], top: number, rows: number): { text: string; top: number } {
  const from = Math.max(0, Math.min(top, lines.length - 1))
  const shown = lines.slice(from, from + rows)
  const out: string[] = []
  let run: DiffLine[] = []
  const flush = () => {
    const first = run[0]
    if (!first) return
    const olds = run.filter(l => l.kind !== '+').length
    const news = run.filter(l => l.kind !== '-').length
    out.push(`@@ -${first.old},${olds} +${first.new},${news} @@`, ...run.map(l => `${l.kind}${l.text}`))
    run = []
  }
  for (const line of shown) {
    const prev = run[run.length - 1]
    const nextOld = prev ? prev.old + (prev.kind === '+' ? 0 : 1) : 0
    const nextNew = prev ? prev.new + (prev.kind === '-' ? 0 : 1) : 0
    if (prev && (line.old !== nextOld || line.new !== nextNew)) flush()
    run.push(line)
  }
  flush()
  return { text: out.join('\n'), top: from }
}
