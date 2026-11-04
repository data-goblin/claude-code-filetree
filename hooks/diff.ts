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
      const lines = parseDiff(part)
      const note = /^Binary files /m.test(part) ? 'binary file changed' : /^rename from /m.test(part) ? 'renamed, no text change' : /^copy from /m.test(part) ? 'copied, no text change' : /^(old|new) mode /m.test(part) ? 'file mode changed' : 'changed, no text diff'
      return { path: (plus && plus !== '/dev/null' ? plus : head) ?? '', lines: lines.length || !note ? lines : [{ kind: ' ' as const, text: `(${note})`, old: 1, new: 1 }] }
    })
    .filter(f => f.path && f.lines.length)
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

export type DiffGroups = 'folder' | 'kind' | 'off'

export const GROUP = '── '
const LOCKS = new Set(['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'bun.lockb', 'bun.lock', 'go.sum'])
const BUILT = new Set(['dist', 'build', 'out', 'test', 'tests', '__tests__', '__snapshots__'])

export function diffGroups(value: unknown): DiffGroups {
  return value === 'kind' || value === 'off' ? value : 'folder'
}

export function generated(path: string): boolean {
  const parts = path.split('/')
  const name = parts.pop() ?? ''
  return name.endsWith('.lock') || LOCKS.has(name) || parts.some(p => BUILT.has(p)) || /\.min\.[^/]+$/.test(name) || name.endsWith('.snap') || /\.test\.[^/]+$/.test(name) || /_test\.[^/]+$/.test(name)
}

export function groupFiles<F extends { path: string }>(files: F[], mode: DiffGroups): ({ group: string } | { file: F })[] {
  if (mode === 'off') return files.map(file => ({ file }))
  const rest = files.filter(f => !generated(f.path))
  const built = files.filter(f => generated(f.path))
  const dirOf = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : './')
  const groups: [string, F[]][] = []
  if (mode === 'folder') {
    const sorted = [...rest].sort((a, b) => dirOf(a.path).localeCompare(dirOf(b.path)) || a.path.localeCompare(b.path))
    for (const f of sorted) {
      const last = groups.at(-1)
      if (last && last[0] === dirOf(f.path)) last[1].push(f)
      else groups.push([dirOf(f.path), [f]])
    }
  } else if (rest.length) groups.push(['source', rest])
  if (built.length) groups.push(['tests, builds and generated', built])
  if (groups.length < 2) return files.map(file => ({ file }))
  return groups.flatMap(([name, list]) => [{ group: `${GROUP}${name} (${list.length})` }, ...list.map(file => ({ file }))])
}
