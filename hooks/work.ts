import type { EngineInterface } from 'claude-code'
import { dirname, posix, isAbsolute, inside } from './tree'
import { git } from './gitstate'
import { settings, machine, working, tree } from './state'
import { canCd } from './jump'
import { cwdOf, shortPath } from './util'
import { get } from './store'
import { reset, followCwd } from './root'

export type Touch = { repo: string; write: boolean; at: number }

export const WORK_WINDOW_MS = 180_000
export const WORK_COOLDOWN_MS = 120_000
const LEAD = 1.5

const WRITES = /(^|[;&|(\s])(sed\s+-i|tee|mv|cp|rm|mkdir|touch|truncate|install|patch|apply_patch)(\s|$)|[^&<>0-9]>{1,2}\s*[^&\s]|\bgit\s+(-C\s+\S+\s+)?(commit|add|apply|am|checkout|switch|restore|mv|rm|reset|merge|rebase|cherry-pick|stash|pull)\b|\.write(_text|_bytes)?\(|writeFile/

let workDeciding = false
const workRepos = new Map<string, Promise<string | null>>()

export function shellWrites(command: string): boolean {
  return WRITES.test(command)
}

export function workIgnored(path: string, home: string, extra: string[] = []): boolean {
  const roots = ['/tmp', '/private/tmp', '/var/folders', '/private/var', '/dev', '/proc', ...extra]
  if (home) roots.push(`${home}/.claude`, `${home}/.config`, `${home}/Library`, `${home}/.cache`, `${home}/.local`, `${home}/AppData/Local/Temp`)
  return /^[A-Za-z]:\/Windows\/Temp(\/|$)/i.test(path) || roots.some(r => path === r || path.startsWith(`${r}/`))
}

export function shellPaths(command: string, cwd: string, home: string): string[] {
  const out: string[] = []
  const lead = /^\s*cd\s+("[^"]+"|'[^']+'|\S+)/.exec(command)
  for (const raw of [lead?.[1], ...command.split(/[\s;&|()<>=]+/)]) {
    if (!raw) continue
    const token = raw.replace(/^["']|["']$/g, '').replace(/[,:]+$/, '').replace(/\\/g, '/')
    const base = cwd.replace(/\/+$/, '')
    if (token.startsWith('~/') && home) out.push(`${home}${token.slice(1)}`)
    else if (/^(\/[^/]|[A-Za-z]:\/)/.test(token)) out.push(token)
    else if (raw === lead?.[1] && cwd) out.push(`${base}/${token}`)
    else if (cwd && token.includes('/') && /^[\w.@][\w./@-]*$/.test(token)) out.push(`${base}/${token}`)
  }
  return [...new Set(out.map(p => p.replace(/\/+$/, '') || '/'))]
}

export function scores(touches: Touch[], now: number): Map<string, { score: number; reads: number; writes: number }> {
  const out = new Map<string, { score: number; reads: number; writes: number }>()
  for (const t of touches) {
    if (now - t.at > WORK_WINDOW_MS) continue
    const s = out.get(t.repo) ?? { score: 0, reads: 0, writes: 0 }
    if (t.write) s.writes += 1
    else s.reads += 1
    s.score = s.writes * 3 + s.reads
    out.set(t.repo, s)
  }
  return out
}

function pickRepo(touches: Touch[], current: string, now: number, lastSwitch: number): string | null {
  if (now - lastSwitch < WORK_COOLDOWN_MS) return null
  const all = [...scores(touches, now)].sort((a, b) => b[1].score - a[1].score)
  const top = all[0]
  if (!top || top[0] === current) return null
  const [repo, s] = top
  if (!(s.writes >= 2 || (s.reads >= 4 && s.writes === 0))) return null
  const rival = Math.max(0, ...all.slice(1).map(([, r]) => r.score))
  return s.score > rival * LEAD ? repo : null
}

async function repoOf($: EngineInterface, path: string): Promise<string | null> {
  const known = workRepos.get(path)
  if (known) return known
  const found = (async () => {
    for (const dir of [path, dirname(path)]) {
      try {
        const run = await git($, dir, ['rev-parse', '--show-toplevel'], 3_000)
        if (run.exitCode === 0 && run.stdout.trim()) return posix(run.stdout.trim())
      } catch {}
    }
    return null
  })()
  workRepos.set(path, found)
  if (workRepos.size > 2_000) workRepos.delete(workRepos.keys().next().value ?? path)
  return found
}

export async function noteWork($: EngineInterface, paths: string[], write: boolean): Promise<void> {
  if (!settings.followWork || paths.length === 0) return
  const vault = machine.home ? [`${machine.home}/Git/agents`, `${machine.home}/Desktop/Git/agents`, `${machine.home}/git/agents`, `${machine.home}/vault`] : []
  const kept = [...new Set(paths.map(posix))].filter(p => isAbsolute(p) && !workIgnored(p, machine.home, vault)).slice(0, 40)
  const repos = new Set((await Promise.all(kept.map(p => repoOf($, p)))).filter((r): r is string => Boolean(r) && !workIgnored(r ?? '', machine.home, vault)))
  if (repos.size === 0) return
  const now = await $.clock.now()
  working.workTouches = [...working.workTouches.filter(t => now - t.at < 180_000), ...[...repos].map(repo => ({ repo, write, at: now }))].slice(-400)
  if (!working.mainBusy) void considerWork($)
}

export async function considerWork($: EngineInterface): Promise<void> {
  if (!settings.followWork || workDeciding) return
  workDeciding = true
  try {
    const moves = settings.jumpMovesClaude && (await canCd($))
    const base = moves ? await cwdOf($) : (await get($)).root
    const current = (await repoOf($, base)) ?? base
    const now = await $.clock.now()
    const repo = pickRepo(working.workTouches, current, now, working.workLast)
    if (!repo || inside(repo, base)) return
    working.workLast = now
    if (!moves) {
      tree.follow = false
      await reset($, repo)
      return
    }
    $.clock.after(0, async () => {
      try {
        await $.command.run({ command: 'cd', args: repo })
        void $.ui.toast(`filetree moved to the cwd`)
        $.clock.after(400, () => void (tree.follow ? followCwd($) : reset($, repo)))
      } catch (error) {
        void $.ui.toast(`could not move Claude to ${shortPath(repo)}: ${error instanceof Error ? error.message : String(error)}`)
      }
    })
  } finally {
    workDeciding = false
  }
}
