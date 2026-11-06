import type { EngineInterface, RenderSurface } from 'claude-code'
import type { FileTree } from '../types'
import { tree, grep } from './state'
import { listAll, revealPaths, loadDirs } from './listing'
import { relative, matcher, dirname, inside, ancestorsOf } from './tree'
import { get, patch } from './store'
import { grepClear, openHit } from './register'
import { anchorAt } from './select'

export const SEARCH_REVEAL_LIMIT = 60
type SearchFlag = 'searchCase' | 'searchRegex' | 'searchContent'
export type Indexed = { paths: string[]; rel: string[] }

export function indexPaths($: EngineInterface, t: FileTree): Promise<Indexed> {
  if (tree.searchIndex?.root !== t.root) {
    const index: { root: string; paths: Promise<Indexed> } = {
      root: t.root,
      paths: listAll($, t).then(paths => {
        if (paths === null && tree.searchIndex === index) tree.searchIndex = null
        return { paths: paths ?? [], rel: (paths ?? []).map(p => relative(t.root, p)) }
      }),
    }
    tree.searchIndex = index
  }
  return tree.searchIndex.paths
}

export async function search($: EngineInterface, query: string): Promise<string[]> {
  if (!(await get($)).query.trim()) tree.searchIndex = null
  await patch($, () => ({ query }))
  const t = await get($)
  if (t.searchContent) {
    if (!query.trim()) grepClear()
    grep.key = ''
    return []
  }
  if (grep.key) grepClear()
  if (!query.trim()) return []
  const index = await indexPaths($, t)
  const match = matcher(query, Boolean(t.searchCase), Boolean(t.searchRegex))
  if (!match) return []
  const hits: string[] = []
  const scope = t.searchScope ? `${t.searchScope.replace(/\/$/, '')}/` : ''
  for (let i = 0; i < index.rel.length && hits.length < SEARCH_REVEAL_LIMIT; i++) if ((!scope || (index.paths[i] ?? '').startsWith(scope)) && match(index.rel[i] ?? '')) hits.push(index.paths[i] ?? '')
  if ((await get($)).query !== query) return []
  if (match.partial) void $.ui.toast(`regex search stopped after ${hits.length} match${hits.length === 1 ? '' : 'es'}; the pattern is too slow to check every path`)
  await revealPaths($, hits)
  const shown = await get($)
  const ids = new Set(shown.nodes.map(n => n.id))
  const stale = [...new Set(hits.filter(p => !ids.has(p)).map(dirname))].filter(d => inside(shown.root, d))
  if (stale.length) await loadDirs($, stale)
  return hits
}

export async function scopeSearch($: EngineInterface, scope: string): Promise<void> {
  await patch($, () => ({ searchScope: scope }))
  const t = await get($)
  if (t.query.trim()) await search($, t.query)
}

export async function searchFlag($: EngineInterface, flag: SearchFlag): Promise<void> {
  await patch($, cur => (flag === 'searchCase' ? { searchCase: !cur.searchCase } : flag === 'searchRegex' ? { searchRegex: !cur.searchRegex } : { searchContent: !cur.searchContent }))
  const t = await get($)
  if (t.query.trim()) await search($, t.query)
}

export async function jump($: EngineInterface, query: string, surface?: RenderSurface): Promise<void> {
  if ((await get($)).searchContent) {
    const hit = grep.rows[grep.sel]
    if (hit) await openHit($, hit, surface)
    return
  }
  const hits = (await search($, query)).slice(0, 10)
  const to = hits[0]
  if (to) anchorAt(to)
  await patch($, cur => {
    const open = new Set(cur.expanded)
    for (const p of hits) for (const a of ancestorsOf(p, cur.root)) open.add(a)
    return { query: '', expanded: [...open], ...(to ? { cursor: to, selected: to } : {}), scroll: null }
  })
}
