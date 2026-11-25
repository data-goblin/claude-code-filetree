import type { EngineInterface } from 'claude-code'
import { osName, messageOf, shortPath } from './util'
import { isAbsolute, join, dirname, inside, posix } from './tree'
import { linking } from './state'
import { get } from './store'
import { realOf } from './listing'

export type LinkState = { kind: 'ok' | 'outside' | 'broken' | 'circular'; target: string }

async function linkTarget($: EngineInterface, id: string): Promise<string> {
  if ((await osName($)) === 'win32') return ''
  try {
    const run = await $.process.run(['readlink', '--', id], { timeoutMs: 3_000 })
    return run.exitCode === 0 ? run.stdout.trim() : ''
  } catch {
    return ''
  }
}

async function loops($: EngineInterface, id: string, first: string): Promise<boolean> {
  const seen = new Set([id])
  let cur = id
  let to = first
  for (let hop = 0; hop < 16; hop++) {
    if (!to) return false
    const next = isAbsolute(to) ? to : join(dirname(cur), to.replace(/^\.[/]/, ''))
    if (seen.has(next)) return true
    seen.add(next)
    cur = next
    to = await linkTarget($, cur)
  }
  return true
}

export async function classifyLink($: EngineInterface, id: string): Promise<void> {
  if (linking.linkStates.has(id)) return
  linking.linkStates.set(id, null)
  const root = (await get($)).root
  let state: LinkState
  try {
    const real = (await $.fs.stat(id, { resolve: true })).realPath
    if (real) state = { kind: inside(await realOf($, root), posix(real)) ? 'ok' : 'outside', target: posix(real) }
    else {
      const target = await linkTarget($, id)
      state = { kind: (await loops($, id, target)) ? 'circular' : 'broken', target }
    }
  } catch (err) {
    const target = await linkTarget($, id)
    state = { kind: /ELOOP|too many|loop/i.test(messageOf(err)) || (await loops($, id, target)) ? 'circular' : 'broken', target }
  }
  if (linking.linkStates.get(id) !== null) return
  linking.linkStates.set(id, state)
  void $.ui.invalidate('ui.render')
}

export function linkNote(state: LinkState | null | undefined): string {
  if (!state) return ' →'
  const to = state.target ? ` ${shortPath(state.target)}` : ''
  return ` →${to}${state.kind === 'outside' ? ' (outside the tree)' : state.kind === 'broken' ? ' (broken: target missing)' : state.kind === 'circular' ? ' (circular link)' : ''}`
}
