export type Visit = { n: number; at: number }
export type Candidate = { path: string; score: number }

const HOUR = 3_600_000

export function parseZoxide(stdout: string): Candidate[] {
  const out: Candidate[] = []
  for (const line of stdout.split('\n')) {
    const m = /^\s*([\d.]+)\s+(.+?)\s*$/.exec(line)
    if (m?.[2]) out.push({ path: m[2], score: Number(m[1]) })
  }
  return out
}

export function frecency(v: Visit, now: number): number {
  const age = now - v.at
  const weight = age < HOUR ? 4 : age < 24 * HOUR ? 2 : age < 7 * 24 * HOUR ? 0.5 : 0.25
  return v.n * weight
}

export function terms(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

export function jumpMatch(path: string, words: string[]): boolean {
  if (!words.length) return true
  const text = path.toLowerCase()
  let from = 0
  for (const w of words) {
    const at = text.indexOf(w, from)
    if (at < 0) return false
    from = at + w.length
  }
  const last = words[words.length - 1] ?? ''
  const base = text.slice(text.replace(/\/+$/, '').lastIndexOf('/') + 1)
  return base.includes(last)
}

function tier(path: string, last: string): number {
  if (!last) return 0
  const base = path.toLowerCase().slice(path.replace(/\/+$/, '').lastIndexOf('/') + 1)
  return base === last ? 0 : base.startsWith(last) ? 1 : base.includes(last) ? 2 : 3
}

export function rankJump(candidates: Candidate[], query: string, limit = 50): string[] {
  const words = terms(query)
  const last = words[words.length - 1] ?? ''
  const best = new Map<string, number>()
  for (const c of candidates) if (jumpMatch(c.path, words)) best.set(c.path, Math.max(best.get(c.path) ?? 0, c.score))
  return [...best]
    .map(([path, score]) => ({ path, score, tier: tier(path, last) }))
    .sort((a, b) => a.tier - b.tier || b.score - a.score || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .slice(0, limit)
    .map(r => r.path)
}
