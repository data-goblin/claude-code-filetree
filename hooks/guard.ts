import { inside, relative, posix } from './tree'
import type { EngineInterface } from 'claude-code'
import { guarding, machine, previewing } from './state'
import { get, patch } from './store'
import { shortPath, cwdOf } from './util'
import { realOf } from './listing'
import { resolve } from './git'
import { OUTSIDE } from './consts'
import { loadPreview, parkPreview } from './preview'

export type Guards = Record<string, string[]>

export const GUARD_TOOLS = ['Edit', 'Write', 'NotebookEdit'] as const

const GUARDS = 'guards'

function parseGuards(v: unknown): Guards {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const out: Guards = {}
  for (const [root, list] of Object.entries(v)) {
    const paths = Array.isArray(list) ? list.filter((p): p is string => typeof p === 'string' && p.length > 0) : []
    if (paths.length) out[root] = paths
  }
  return out
}

export function allGuards(guards: Guards): string[] {
  return [...new Set(Object.values(guards).flat())]
}

function guardOver(guards: string[], path: string): string | undefined {
  return guards.find(g => inside(g, path))
}

function toggled(own: string[], path: string): string[] {
  return own.includes(path) ? own.filter(g => g !== path) : [...own.filter(g => !inside(path, g)), path]
}

function spellings(guard: string, cwd: string, home: string): string[] {
  const out = [guard]
  if (home && guard !== home && inside(home, guard)) out.push(`~${guard.slice(home.length)}`)
  if (cwd && guard !== cwd && inside(cwd, guard)) {
    const rel = relative(cwd, guard)
    out.push(rel, `./${rel}`)
  }
  return out
}

function mentions(text: string, spelling: string): boolean {
  for (let at = text.indexOf(spelling); at >= 0; at = text.indexOf(spelling, at + 1)) {
    const before = at === 0 ? '' : (text[at - 1] ?? '')
    const after = text[at + spelling.length] ?? ''
    if (!/[\w.\-/~]/.test(before) && !/[\w.-]/.test(after)) return true
  }
  return false
}

export function guardIn(command: string, guards: string[], cwd: string, home: string): string | undefined {
  const text = command.replace(/\\/g, '/')
  return guards.find(g => spellings(g, cwd, home).some(s => mentions(text, s)))
}

function outsideOf(base: string, path: string): boolean {
  return Boolean(base) && !inside(base, path)
}

export function loadGuards($: EngineInterface): Promise<void> {
  guarding.guardsLoaded ??= $.store.get(GUARDS).then(v => {
    guarding.guards = parseGuards(v)
  }, () => undefined)
  return guarding.guardsLoaded
}

export async function toggleGuard($: EngineInterface, path: string): Promise<void> {
  await loadGuards($)
  const t = await get($)
  const over = guardOver(allGuards(guarding.guards), path)
  if (over && over !== path) {
    $.ui.toast(`${shortPath(path)} is already guarded by ${shortPath(over)}`)
    return
  }
  const owner = over === path ? Object.keys(guarding.guards).find(k => guarding.guards[k]?.includes(path)) : undefined
  const key = owner ?? (t.top && inside(t.top, path) ? t.top : t.root)
  const own = toggled(guarding.guards[key] ?? [], path)
  const next = { ...guarding.guards }
  if (own.length) next[key] = own
  else delete next[key]
  guarding.guards = next
  void $.ui.invalidate('ui.render')
  await $.store.set(GUARDS, guarding.guards)
}

export async function guardFor($: EngineInterface, path: string): Promise<string | undefined> {
  const list = allGuards(guarding.guards)
  const hit = guardOver(list, path)
  if (hit) return hit
  const real = await realOf($, path)
  for (const g of list) if (inside(g, real) || inside(await realOf($, g), real)) return g
  return undefined
}

export async function noteOutside($: EngineInterface, file: string): Promise<void> {
  const t = await get($)
  const abs = resolve(await cwdOf($), posix(file), machine.home)
  if (!outsideOf(t.top || t.root, abs) || guarding.outside.includes(abs)) return
  guarding.outside = [...guarding.outside, abs]
  if (guarding.outside.length === 1) $.ui.toast(`Claude wrote outside ${shortPath(t.top || t.root)}: ${shortPath(abs)}. w lists these writes.`)
  if (previewing.previewed?.path === OUTSIDE) previewing.previewed = null
  void $.ui.invalidate('ui.render')
}

export async function showOutside($: EngineInterface): Promise<void> {
  if (!guarding.outside.length) return
  await loadPreview($, OUTSIDE)
  await patch($, () => ({ preview: OUTSIDE, previewTop: 0 }))
  $.clock.after(100, () => parkPreview($))
}
