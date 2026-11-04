import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { compileRegex, toEre } from '../hooks/regex'

const lines = ['', 'a', 'ab', 'aab', 'abc', 'b', 'ba', 'cab', 'a1', '12', 'x_y', 'A-Z', 'a.b', 'a{2}', 'é', 'café', 'aaaa', 'needle 42', '  ', 'a|b', '[x]', 'ac', 'bb', 'abab']
const fixed = ['a', '^a', 'b$', '^$', 'a*b', 'a+', 'ab?c', 'a|b', '(ab)+', '[a-c]+', '[ab]c', '\\d+', '\\w+', 'a{2}', 'a{1,2}b', 'x_y', 'A-Z', 'needle \\d\\d', '^(a|b)+$', '[0-9]', 'a\\.b', 'a\\|b', '\\[x\\]', 'a{2', '(a|ab)(c|bcd)?']
const tokens = ['a', 'b', 'c', '.', '*', '+', '?', '|', '(', ')', '[ab]', '[a-c]', '\\d', '\\w', '^', '$', '{2}', '1', '_']
let seed = 7
const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
const random = Array.from({ length: 600 }, () => Array.from({ length: 1 + Math.floor(next() * 5) }, () => tokens[Math.floor(next() * tokens.length)]).join(''))

const dir = mkdtempSync(join(tmpdir(), 'ere-'))
const file = join(dir, 'lines.txt')
writeFileSync(file, `${lines.join('\n')}\n`)
spawnSync('git', ['init', '-q', dir])
const grepped = (argv: string[]) => {
  const r = spawnSync(argv[0] ?? '', argv.slice(1), { cwd: dir, encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' } })
  assert.ok(r.status === 0 || r.status === 1, `${argv.join(' ')}: ${r.stderr}`)
  return new Set(r.stdout.split('\n').filter(Boolean).map(l => Number(l.split(':')[0]) - 1))
}
let checked = 0
try {
  for (const p of [...fixed, ...random]) {
    const ere = toEre(p)
    if (ere === null) continue
    const fits = compileRegex(p, false, { left: 1_000_000 })
    if (!fits) continue
    const want = new Set(lines.flatMap((l, i) => (fits(l) ? [i] : [])))
    for (const argv of [['grep', '-n', '-E', '-e', ere, file], ['git', 'grep', '--no-index', '-h', '-n', '-E', '-e', ere, '--', 'lines.txt']]) {
      const got = grepped(argv)
      const lost = [...want].filter(i => !got.has(i))
      assert.deepEqual(lost.map(i => lines[i]), [], `${argv[0]} ${argv[1]} -E '${ere}' (from /${p}/) drops lines the matcher accepts`)
    }
    checked += 1
  }
  assert.ok(checked > 50, `only ${checked} patterns were translatable`)
  console.log(`ere: ${checked} patterns agree with grep -E and git grep -E`)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
