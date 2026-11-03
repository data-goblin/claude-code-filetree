export type Touch = { repo: string; write: boolean; at: number }

export const WORK_WINDOW_MS = 180_000
export const WORK_COOLDOWN_MS = 120_000
const LEAD = 1.5

const WRITES = /(^|[;&|(\s])(sed\s+-i|tee|mv|cp|rm|mkdir|touch|truncate|install|patch|apply_patch)(\s|$)|[^&<>0-9]>{1,2}\s*[^&\s]|\bgit\s+(-C\s+\S+\s+)?(commit|add|apply|am|checkout|switch|restore|mv|rm|reset|merge|rebase|cherry-pick|stash|pull)\b|\.write(_text|_bytes)?\(|writeFile/

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

export function pickRepo(touches: Touch[], current: string, now: number, lastSwitch: number): string | null {
  if (now - lastSwitch < WORK_COOLDOWN_MS) return null
  const all = [...scores(touches, now)].sort((a, b) => b[1].score - a[1].score)
  const top = all[0]
  if (!top || top[0] === current) return null
  const [repo, s] = top
  if (!(s.writes >= 2 || (s.reads >= 4 && s.writes === 0))) return null
  const rival = Math.max(0, ...all.slice(1).map(([, r]) => r.score))
  return s.score > rival * LEAD ? repo : null
}
