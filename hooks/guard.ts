import { inside, relative } from './tree'

export type Guards = Record<string, string[]>

export const GUARD_TOOLS = ['Edit', 'Write', 'NotebookEdit'] as const

export function parseGuards(v: unknown): Guards {
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

export function guardOver(guards: string[], path: string): string | undefined {
  return guards.find(g => inside(g, path))
}

export function toggled(own: string[], path: string): string[] {
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

export function outsideOf(base: string, path: string): boolean {
  return Boolean(base) && !inside(base, path)
}
