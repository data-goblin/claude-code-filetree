import type { FileTree, FileNode } from '../types'
import { metrics } from './state'
import { inside, dirname, type Row, visibleRows, collator } from './tree'
import { counted } from './loc'
import { isIgnored } from './listing'
import type { EngineInterface } from 'claude-code'
import { patch } from './store'

const GIT_RANK: Record<string, number> = { D: 5, M: 4, T: 4, R: 3, C: 3, A: 2, '?': 1 }

function metricOf(t: FileTree, n: FileNode): number {
  if (t.column === 'loc') return metrics.locCache.get(n.id) ?? -1
  if (t.column === 'files') return n.kind === 'dir' ? (metrics.fileCounts.get(n.id) ?? -1) : -1
  if (t.column === 'size') return n.kind === 'dir' ? (t.dirSizes[n.id] ?? -1) : n.size
  return n.kind === 'dir' ? (metrics.dirTimes.get(n.id)?.[1] ?? 0) : n.mtime
}

function metricWorking(t: FileTree, n: FileNode): boolean {
  if (n.kind !== 'dir' && t.column !== 'loc') return false
  if (t.column === 'files') return metrics.counting.has(n.id) || metrics.countQueue.includes(n.id)
  if (t.column === 'loc') return metrics.locBusy.has(`d${n.id}`) || metrics.locBusy.has(`s${n.id}`) || metrics.locQueue.some(([d]) => d === n.id) || metrics.locBusy.has(`s${n.parent}`) || metrics.locQueue.some(([d]) => d === n.parent)
  if (t.column === 'size') return metrics.sizing.has(n.id) || metrics.sizeQueue.includes(n.id)
  return metrics.timing.has(n.id) || metrics.timeQueue.some(([d]) => d === n.id) || [...metrics.timing].some(w => inside(w, n.id))
}

function metricKnown(t: FileTree, n: FileNode): boolean {
  if (t.column === 'loc') return n.kind === 'link' || metrics.locCache.has(n.id) || (n.kind === 'file' && (!counted(n.name) || metrics.locListed.has(n.parent)))
  if (t.column === 'size') return n.kind !== 'dir' || n.id in t.dirSizes
  if (t.column === 'files') return n.kind !== 'dir' || metrics.fileCounts.has(n.id)
  return n.kind !== 'dir' || metrics.dirTimes.has(n.id)
}

function gitOf(t: FileTree, n: FileNode): [number, number] {
  const d = t.diff[n.id]
  const c = t.counts[n.id]
  const rank = n.kind === 'dir' ? (c ? c[0] + c[1] + c[2] : 0) : (GIT_RANK[t.git[n.id] ?? ''] ?? 0)
  return [d ? d[0] + d[1] : 0, rank]
}

let ghostMemo: { nodes: FileNode[]; git: FileTree['git']; root: string; out: FileNode[] } | null = null

export function ghostsOf(t: FileTree): FileNode[] {
  if (ghostMemo && ghostMemo.nodes === t.nodes && ghostMemo.git === t.git && ghostMemo.root === t.root) return ghostMemo.out
  ghostMemo = { nodes: t.nodes, git: t.git, root: t.root, out: ghostScan(t) }
  return ghostMemo.out
}

function ghostScan(t: FileTree): FileNode[] {
  const have = new Set(t.nodes.map(n => n.id))
  const loaded = new Set(t.nodes.filter(n => n.loaded).map(n => n.id))
  loaded.add(t.root)
  const out: FileNode[] = []
  for (const [id, status] of Object.entries(t.git)) {
    if (status !== 'D' || have.has(id) || isIgnored(t.root, id)) continue
    const parent = dirname(id)
    if (!loaded.has(parent) || !inside(t.root, id)) continue
    const name = id.slice(parent.length + 1)
    out.push({ id, parent, name, kind: 'file', hidden: name.startsWith('.'), mtime: 0, size: 0, loaded: true })
  }
  return out
}

export function isGhost(t: FileTree, id: string): boolean {
  return t.git[id] === 'D' && ghostsOf(t).some(n => n.id === id)
}

export function rowsOf(base: FileTree): Row[] {
  const ghosts = ghostsOf(base)
  const t = ghosts.length ? { ...base, nodes: [...base.nodes, ...ghosts] } : base
  if (!t.sortCol) return visibleRows(t, ghosts.length ? (a, b) => collator.compare(a.name, b.name) : undefined)
  const sign = t.sortDir === 'asc' ? 1 : -1
  const order = t.sortCol === 'name'
    ? (a: FileNode, b: FileNode) => sign * collator.compare(a.name, b.name)
    : t.sortCol === 'git'
    ? (a: FileNode, b: FileNode) => {
        const [x, y] = [gitOf(t, a), gitOf(t, b)]
        return sign * (x[0] - y[0] || x[1] - y[1])
      }
    : (() => {
        const pending = new Set<string>()
        for (const r of visibleRows(t)) if (!pending.has(r.node.parent) && !metricKnown(t, r.node) && metricWorking(t, r.node)) pending.add(r.node.parent)
        return (a: FileNode, b: FileNode) => {
          if (pending.has(a.parent)) return collator.compare(a.name, b.name)
          const ka = metricKnown(t, a)
          const kb = metricKnown(t, b)
          if (ka !== kb) return ka ? -1 : 1
          return (ka ? sign * (metricOf(t, a) - metricOf(t, b)) : 0) || collator.compare(a.name, b.name)
        }
      })()
  return visibleRows(t, order)
}

export async function sortBy($: EngineInterface, col: 'name' | 'git' | 'metric'): Promise<void> {
  await patch($, cur => (cur.sortCol !== col ? { sortCol: col, sortDir: 'desc' } : cur.sortDir === 'desc' ? { sortDir: 'asc' } : { sortCol: '', sortDir: 'desc' }))
}
