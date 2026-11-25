import type { EngineInterface } from 'claude-code'
import { get, patch, setActivities } from './store'
import { parseGit, parseNumstat, join, rollCounts, rollUp, dirname, mapper } from './tree'
import { isIgnored, loadDirs, openDirs, type Since } from './listing'
import { vcs, machine, tree, settings } from './state'
import { resolve, type GitAction, chainOf } from './git'
import { has, cwdOf } from './util'
import { scheduleScan } from './activity'

export const ACTIVITY_TTL_MS = 45_000

let gitDirOf = { root: '', dir: '' }
let gitRun: Promise<void> | null = null
let gitNext: Promise<void> | null = null
let lastSync = 0

export async function git($: EngineInterface, cwd: string, args: string[], timeoutMs = 20_000, stdin?: string) {
  return $.process.run(['git', '--no-optional-locks', '-C', cwd, ...args], { timeoutMs, env: { GIT_OPTIONAL_LOCKS: '0' }, ...(stdin === undefined ? {} : { stdin }) })
}

export async function detectRepo($: EngineInterface): Promise<void> {
  const t = await get($)
  if (!t.root) return
  let top = ''
  let prefix = ''
  try {
    const run = await git($, t.root, ['rev-parse', '--show-prefix', '--show-toplevel'], 5_000)
    const [p = '', tl = ''] = run.exitCode === 0 ? run.stdout.split('\n') : []
    prefix = p.trim()
    top = tl.trim()
  } catch {
    top = ''
  }
  await patch($, cur => (cur.root === t.root ? { top, prefix } : {}))
}

async function readGit($: EngineInterface): Promise<void> {
  const t = await get($)
  if (!t.root || !t.top) return
  const root = t.root
  try {
    const [status, head] = await Promise.all([
      git($, root, ['status', '--porcelain=v1', '-b', '-z', '--ignored=traditional', '--untracked-files=normal', '--', '.']),
      git($, root, ['diff', 'HEAD', '--numstat', '-z', '--', '.']),
    ])
    if (status.exitCode !== 0) return
    const parsed = parseGit(status.stdout, root, t.prefix)
    const diff: Record<string, [number, number]> = {}
    if (head.exitCode === 0) parseNumstat(head.stdout, root, t.prefix, diff)
    const files = { ...parsed.files }
    if (parsed.untrackedDirs.length) {
      const others = await git($, root, ['ls-files', '-o', '--exclude-standard', '-z', '--', ...parsed.untrackedDirs.map(d => d.slice(root.length + 1) || '.')])
      if (others.exitCode === 0) for (const rel of others.stdout.split('\0').filter(Boolean)) files[join(root, rel)] = 'new'
    }
    for (const path of Object.keys(diff)) if (files[path] === 'new' || isIgnored(root, path)) delete diff[path]
    for (const path of Object.keys(files)) if (isIgnored(root, path)) delete files[path]
    const gitShown = Object.fromEntries(Object.entries(parsed.git).filter(([path]) => !isIgnored(root, path)))
    vcs.dirty = { root, files }
    await patch($, cur =>
      cur.root === root
        ? {
            git: gitShown,
            ignored: parsed.ignored,
            untrackedDirs: parsed.untrackedDirs,
            branch: parsed.branch,
            counts: rollCounts(files, root),
            diff: rollUp(diff, root),
          }
        : {},
    )
  } catch {
    return
  }
}

export function refreshGit($: EngineInterface): Promise<void> {
  if (!gitRun) {
    gitRun = readGit($).finally(() => {
      gitRun = null
    })
    return gitRun
  }
  const rerun = () => {
    gitNext = null
    return refreshGit($)
  }
  gitNext ??= gitRun.then(rerun, rerun)
  return gitNext
}

export type Pending = { actions: GitAction[]; ids: number[]; command: string; head: string }
export type Job = { actions: GitAction[]; since: Since; initRepo: boolean; readOnly: boolean }
export type Background = { p: Pending | null; job: Job; reads: string[] }
type GitOperation = { commit?: { sha: string }; push: boolean; branch?: { action: string }; pr?: { action: string } }
type Outcome = { state: 'done' | 'failed'; label: string; detail: string }

const PROOF: Record<string, (op: GitOperation) => boolean> = {
  push: op => Boolean(op.push),
  merge: op => op.branch?.action === 'merged',
  rebase: op => op.branch?.action === 'rebased',
  'pr create': op => op.pr?.action === 'created',
  'pr merge': op => op.pr?.action === 'merged',
  'pr comment': op => op.pr?.action === 'commented',
}

function actionOf(v: unknown): { action: string } | undefined {
  return has(v, 'action') && typeof v.action === 'string' ? { action: v.action } : undefined
}

function gitOperationOf(v: unknown): GitOperation | undefined {
  if (typeof v !== 'object' || v === null) return undefined
  return {
    commit: has(v, 'commit') && has(v.commit, 'sha') && typeof v.commit.sha === 'string' ? { sha: v.commit.sha } : undefined,
    push: has(v, 'push') && Boolean(v.push),
    branch: has(v, 'branch') ? actionOf(v.branch) : undefined,
    pr: has(v, 'pr') ? actionOf(v.pr) : undefined,
  }
}

export function bashOutputOf(v: unknown): { stdout: string; backgroundTaskId: string; gitOperation: GitOperation | undefined } {
  return {
    stdout: has(v, 'stdout') && typeof v.stdout === 'string' ? v.stdout : '',
    backgroundTaskId: has(v, 'backgroundTaskId') && typeof v.backgroundTaskId === 'string' ? v.backgroundTaskId : '',
    gitOperation: has(v, 'gitOperation') ? gitOperationOf(v.gitOperation) : undefined,
  }
}

export async function startGit($: EngineInterface, actions: GitAction[]): Promise<number[]> {
  const now = await $.clock.now()
  const ids = actions.map(() => ++vcs.activityId)
  await setActivities($, cur => [
    ...cur.filter(a => a.state === 'running' || now - a.at < ACTIVITY_TTL_MS),
    ...actions.map((a, i) => ({
      id: ids[i] ?? 0,
      kind: a.kind,
      label: a.running,
      state: 'running' as const,
      detail: '',
      at: now,
      tone: a.tone,
      nerd: a.icon.nerd,
      plain: a.icon.plain,
    })),
  ])
  return ids
}

export async function headOf($: EngineInterface, cwd: string): Promise<string> {
  try {
    const run = await git($, cwd, ['rev-parse', 'HEAD'], 5_000)
    return run.exitCode === 0 ? run.stdout.trim() : ''
  } catch {
    return ''
  }
}

export async function outcomes($: EngineInterface, p: Pending, ok: boolean, op: GitOperation | undefined): Promise<Outcome[]> {
  const chain = chainOf(p.command)
  const after = p.actions.some(a => a.verb === 'commit') && !op?.commit ? await headOf($, (await get($)).root || (await cwdOf($))) : ''
  return p.actions.map(a => {
    if (a.verb === 'commit') {
      const sha = op?.commit?.sha || (after && after !== p.head ? after : '')
      return sha ? { state: 'done', label: a.done, detail: sha.slice(0, 7) } : { state: 'failed', label: `${a.verb} failed`, detail: '' }
    }
    if ((op && PROOF[a.verb]?.(op)) || (ok && chain.and)) return { state: 'done', label: a.done, detail: '' }
    if (!ok && chain.and && chain.size === 1) return { state: 'failed', label: `${a.verb} failed`, detail: '' }
    return { state: 'done', label: `ran ${a.kind}`, detail: '' }
  })
}

export async function finishGit($: EngineInterface, p: Pending, results: Outcome[]): Promise<void> {
  const now = await $.clock.now()
  await setActivities($, cur =>
    cur.map(a => {
      const i = p.ids.indexOf(a.id)
      const result = i < 0 ? undefined : results[i]
      return result ? { ...a, ...result, at: now } : a
    }),
  )
  $.clock.after(ACTIVITY_TTL_MS + 500, () => void setActivities($, cur => cur.filter(a => a.state === 'running' || a.at > now)))
}

export function failAll(p: Pending): Outcome[] {
  return p.actions.map(a => ({ state: 'failed', label: `${a.verb} failed`, detail: '' }))
}

export function proven(p: Pending | null, results: Outcome[]): GitAction[] {
  return p ? p.actions.filter((_, i) => results[i]?.state !== 'failed') : []
}

function taskEnds(text: string): [string, string][] {
  return [...text.matchAll(/<task-notification>([\s\S]*?)<\/task-notification>/g)].flatMap(m => {
    const id = /<task-id>([^<]*)<\/task-id>/.exec(m[1] ?? '')?.[1]?.trim()
    const status = /<status>([^<]*)<\/status>/.exec(m[1] ?? '')?.[1]?.trim()
    return id && status ? [[id, status]] : []
  })
}

export async function settleBackground($: EngineInterface, text: string): Promise<void> {
  if (vcs.background.size === 0 || !text.includes('<task-notification>')) return
  for (const [id, status] of taskEnds(text)) {
    const task = vcs.background.get(id)
    if (!task) continue
    vcs.background.delete(id)
    const ok = status === 'completed'
    const results = task.p ? await outcomes($, task.p, ok, undefined) : []
    if (task.p) await finishGit($, task.p, results)
    if (settings.showReads) vcs.queuedReads.push(...task.reads)
    scheduleScan($, { ...task.job, actions: proven(task.p, results) })
  }
}

export async function gitPaths($: EngineInterface, root: string, prefix: string, committed: boolean): Promise<string[]> {
  const map = mapper(root, prefix)
  try {
    const run = committed
      ? await git($, root, ['diff-tree', '--root', '--no-commit-id', '--name-only', '-r', '-z', 'HEAD'], 5_000)
      : await git($, root, ['diff', '--cached', '--name-only', '-z'], 5_000)
    return run.exitCode === 0 ? run.stdout.split('\0').filter(Boolean).flatMap(rel => map(rel) ?? []) : []
  } catch {
    return []
  }
}

export async function gitChanged($: EngineInterface): Promise<void> {
  const root = (await get($)).root
  if (gitDirOf.root !== root || !gitDirOf.dir) gitDirOf = { root, dir: await gitDir($, root) }
  const gd = gitDirOf.dir
  const stamps = gd ? await Promise.all(['index', 'HEAD'].map(f => $.fs.stat(join(gd, f)).then(st => st.mtimeMs, () => 0))) : []
  const stamp = gd ? `${gd}:${stamps.join(':')}` : ''
  const before = vcs.gitStamp
  vcs.gitStamp = stamp
  if (before === '' && stamp) {
    await detectRepo($)
    void sync($, true)
  } else if (before && stamp && before !== stamp) void sync($, true)
}

async function gitDir($: EngineInterface, cwd: string): Promise<string> {
  for (let dir = cwd, i = 0; i < 64; i++) {
    try {
      const dot = join(dir, '.git')
      const st = await $.fs.stat(dot)
      if (st.kind === 'dir') return dot
      const ref = /^gitdir:\s*(.+)$/m.exec(String(await $.fs.read(dot)))?.[1]?.trim()
      if (ref) return resolve(dir, ref, machine.home)
    } catch {
      const up = dirname(dir)
      if (up === dir) return ''
      dir = up
      continue
    }
    return ''
  }
  return ''
}

export async function sync($: EngineInterface, force = false): Promise<void> {
  const now = await $.clock.now()
  if (!force && now - lastSync < 2_000) return
  lastSync = now
  tree.searchIndex = null
  const t = await get($)
  if (!t.root) return
  await loadDirs($, [t.root, ...openDirs(t)])
  if (t.top) await refreshGit($)
}
