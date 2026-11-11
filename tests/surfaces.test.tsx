import { type Engine, expect, mock, test } from 'claude-code/testing'
import type { CommandRunInput, On, RenderPropsOf, ToolCallInput, ToolCallResult, UiScrollInput } from 'claude-code'
import type { RowSpec, RowsProps, Seg } from '../hooks/rows'
import type { ZoneProps } from '../hooks/zone'

import { LINUX_LAUNCH, TMUX_OPEN, TMUX_WORKSPACE } from '../hooks/open'
import { CLEAN, POLICY, POSTER } from '../hooks/peek'
import { compileRegex, compileSpans, toEre } from '../hooks/regex'
import { fileRefs, markdownSplit } from '../hooks/refs'
import { DESK, ICONS } from '../hooks/svg'
import { jumpMatch, rankJump, terms } from '../hooks/jump'
import { shellPaths, workIgnored } from '../hooks/work'
import { age, ancestorsOf, badPattern, stamp, formatSize, replaceChildren, toNodes } from '../hooks/tree'

type World = {
  os: 'darwin' | 'linux' | 'win32'
  env: Record<string, string>
  cwd: string
  top: string
  dirs: Record<string, [string, 'file' | 'dir' | 'other'][]>
  status: string
  numstat: string
  exits?: Record<string, [number, string]>
  stdout?: Record<string, string>
  delays?: Record<string, number[]>
  denied?: string[]
  heads?: string[]
  tool?: (e: ToolCallInput) => ToolCallResult | undefined
  find?: string
  theme?: { toml: string; mtimeMs: number }
  du?: Record<string, string>
  loc?: Record<string, string>
  duDelays?: number[]
  abortDu?: string[]
  watch?: { after: number; change: () => string }
  links?: string[]
  files?: Record<string, string>
  mtimes?: Record<string, number>
  patch?: string
  untracked?: string[]
  untrackedPatch?: string
  unborn?: boolean
  diffTree?: string[]
  poster?: (argv: string[]) => string
  font?: string
  newest?: (dir: string) => string
  findDelayMs?: number
  newestDelay?: number
  newestAbortOnce?: string[]
  locAbortOnce?: string[]
  tops?: Record<string, string>
  real?: Record<string, string>
  grep?: string
  bytes?: Record<string, string>
  fullName?: boolean
  linkTo?: Record<string, string>
  loops?: string[]
  noCd?: boolean
}
type Ran = string[][]
const HERDR_SPLIT = '{"id":"cli:pane:split","result":{"pane":{"agent_status":"unknown","cwd":"/home/k/proj","focused":false,"pane_id":"w1:p37","parent_pane_id":"w1:p35","tab_id":"w1:tV","workspace_id":"w1"},"type":"pane_info"}}'
const opens: unknown[] = []
const registered: unknown[] = []
const envs: Record<string, string>[] = []
const spawns: { argv: string[]; env: Record<string, string> }[] = []

function world(on: On, w: World, ran: Ran) {
  mock.env(on, w.env)
  const clock = mock.clock(on, { now: 1_800_000_000_000 })
  mock.store(on)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: w.cwd }))
  on('session.id', () => ({ value: 'test-session' }))
  on('command.list', () => ({ value: w.noCd ? [] : [{ name: 'cd', description: 'cd', source: 'builtin' as const }] }))
  on('command.register', (_$, e) => {
    registered.push(e)
    return { value: { command: e.name } }
  })
  on('ui.open', (_$, e) => {
    opens.push(e)
    return { value: { isPlaced: true } }
  })
  on('ui.toast', (_$, e) => {
    ran.push(['toast', e.text])
    return { value: undefined }
  })
  const isTheme = (p: string) => p.replace(/\\/g, '/').endsWith('/.local/state/omarchy/current/theme/colors.toml')
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/^.*?(?=[A-Za-z]:\/)/, '')
  on('fs.read', (_$, e) => {
    if (w.theme && isTheme(e.path)) return { value: w.theme.toml }
    const file = norm(e.path).replace(/^[A-Za-z]:/, '')
    if (e.as === 'bytes') return { value: { base64: btoa(PNG_1PX + (w.bytes?.[file] ?? file)) } }
    const text = w.files?.[file]
    if (text !== undefined) return { value: text }
    throw new Error('no theme file')
  })
  const dirOf = (p: string) => w.dirs[p] ?? w.dirs[p.replace(/^[A-Za-z]:/, '')]
  on('fs.exists', (_$, e) => {
    const file = norm(e.path).replace(/^[A-Za-z]:/, '')
    return { value: w.files?.[file] !== undefined || dirOf(file) !== undefined || dirOf(norm(e.path)) !== undefined }
  })
  on('fs.write', (_$, e) => {
    ran.push(['write', e.path])
    w.files = { ...w.files, [norm(e.path).replace(/^[A-Za-z]:/, '')]: e.text }
    return { value: undefined }
  })
  on('fs.list', async (_$, e) => {
    const path = norm(e.path)
    const bare = path.replace(/^[A-Za-z]:/, '')
    if (w.denied?.includes(bare)) return { deny: `EACCES: permission denied, scandir '${path}'` }
    const kids = dirOf(path)
    if (!kids) throw new Error(`ENOENT ${e.path}`)
    const value = kids.map(([name, kind]) => ({ name, kind, size: 1, mtimeMs: w.mtimes?.[`${bare}/${name}`] ?? 1_700_000_000_000, isLink: w.links?.includes(`${bare}/${name}`) ?? false }))
    const delay = w.delays?.[bare]?.shift()
    if (delay) await clock.sleep(delay)
    return { value }
  })
  on('fs.stat', (_$, e) => {
    if (isTheme(e.path)) {
      ran.push(['theme-stat'])
      if (!w.theme) throw new Error(`ENOENT ${e.path}`)
      return { value: { kind: 'file', size: w.theme.toml.length, mtimeMs: w.theme.mtimeMs, isLink: false } }
    }
    const said = norm(e.path)
    const drive = /^[A-Za-z]:/.exec(said)?.[0] ?? ''
    const bare = said.slice(drive.length)
    const alias = Object.keys(w.real ?? {}).find(k => bare === k || bare.startsWith(`${k}/`))
    const p = alias ? `${drive}${w.real?.[alias]}${bare.slice(alias.length)}` : said
    const key = p.replace(/^[A-Za-z]:/, '')
    if (w.loops?.includes(key)) return { value: { kind: 'file', size: 1, mtimeMs: 1_700_000_000_000, isLink: true } }
    const to = w.linkTo?.[key]
    if (to !== undefined) {
      if (!to) throw new Error(`ENOENT ${e.path}`)
      return { value: { kind: 'file', size: 1, mtimeMs: 1_700_000_000_000, isLink: false, ...(e.resolve ? { realPath: to } : {}) } }
    }
    const parent = p.slice(0, p.lastIndexOf('/')) || '/'
    const name = p.slice(p.lastIndexOf('/') + 1)
    const hit = dirOf(p) ? 'dir' : dirOf(parent)?.find(([n]) => n === name)?.[1]
    if (!hit) throw new Error(`ENOENT ${e.path}`)
    return { value: { kind: hit, size: 1, mtimeMs: w.mtimes?.[p.replace(/^[A-Za-z]:/, '')] ?? (name === 'a.ts' ? 1_800_000_000_500 : 1_700_000_000_000), isLink: false, ...(e.resolve && w.real ? { realPath: p } : {}) } }
  })
  on('process.run', async (_$, e) => {
    const argv: string[] = [...e.argv]
    ran.push(argv)
    if (e.init?.env) envs.push(e.init.env)
    const ok = (stdout: string) => ({ value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    const exit = w.exits?.[argv[0] ?? '']
    if (exit) return { value: { exitCode: exit[0], stdout: '', stderr: exit[1], isStdoutTruncated: false, isStderrTruncated: false } }
    const out = w.stdout?.[argv.slice(0, 3).join(' ')]
    if (out !== undefined) return ok(out)
    if (w.newest && argv[0] === 'sh' && (argv[2] ?? '').includes('awk -v d=')) {
      const at = w.newestAbortOnce?.indexOf(argv[4] ?? '') ?? -1
      if (at >= 0) {
        w.newestAbortOnce?.splice(at, 1)
        throw new Error('$.process.run(sh) aborted')
      }
      if (w.newestDelay) await clock.sleep(w.newestDelay)
      return ok(w.newest(argv[4] ?? ''))
    }
    if (w.font !== undefined && argv[0] === 'sh' && (argv[2] ?? '').includes('fc-list')) return ok(w.font)
    if (argv[0] === 'find' && argv.includes('grep')) {
      const at = w.locAbortOnce?.indexOf((argv[1] ?? '').replace(/\/\.$/, '')) ?? -1
      if (at >= 0) {
        w.locAbortOnce?.splice(at, 1)
        throw new Error('$.process.run(find) aborted')
      }
    }
    if (argv[0] === 'find' && argv.includes('grep')) return ok(w.loc?.[`${(argv[1] ?? '').replace(/\/\.$/, '')}${argv[2] === '-maxdepth' ? ' 1' : ''}`] ?? '')
    if (argv[0] === 'find' && w.find !== undefined) {
      if (w.findDelayMs) await new Promise(r => setTimeout(r, w.findDelayMs))
      return ok(w.find)
    }
    if (argv[0] === 'du') {
      const delay = w.duDelays?.shift()
      if (delay) await clock.sleep(delay)
      return ok(w.du?.[argv.at(-1) ?? ''] ?? '')
    }
    if (argv[0] === 'mv' && w.files) {
      const [from, to] = argv.slice(-2)
      const text = w.files[from ?? '']
      if (text !== undefined && to) {
        w.files = { ...w.files, [to]: text }
        delete w.files[from ?? '']
      }
      return ok('')
    }
    if (argv[0] === 'rm' && w.files) {
      delete w.files[argv.at(-1) ?? '']
      return ok('')
    }
    if (argv[0] === 'uname') return ok(w.os === 'darwin' ? 'Darwin\n' : 'Linux\n')
    if (argv[0] === 'sh') return ok('missing\n')
    if (argv[0] === 'git') {
      const verb = argv.slice(4).find(a => !a.startsWith('-'))
      if (verb === 'diff-tree') return ok((w.diffTree ?? []).join('\0'))
      if (verb === 'hash-object') return ok('4b825dc642cb6eb9a060e54bf8d69288fbee4904\n')
      if (verb === 'rev-parse' && argv.includes('--verify') && w.unborn) return { value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
      if (verb === 'rev-parse' && argv.at(-1) === 'HEAD') return ok(`${(w.heads && w.heads.length > 1 ? w.heads.shift() : w.heads?.[0]) ?? ''}\n`)
      if (verb === 'rev-parse' && w.tops) {
        const dir = norm(argv[3] ?? '')
        const top = Object.keys(w.tops).filter(k => dir === k || dir.startsWith(`${k}/`)).sort((x, y) => y.length - x.length)[0]
        return top ? ok(`\n${w.tops[top]}\n`) : { value: { exitCode: 128, stdout: '', stderr: 'not a git repository', isStdoutTruncated: false, isStderrTruncated: false } }
      }
      if (verb === 'rev-parse') return w.top ? ok(`\n${w.top}\n`) : { value: { exitCode: 128, stdout: '', stderr: 'not a git repository', isStdoutTruncated: false, isStderrTruncated: false } }
      if (verb === 'status') return ok(w.status)
      if (verb === 'diff' && argv.includes('--no-index')) return ok(w.untrackedPatch ?? '')
      if (verb === 'diff' && argv.includes('--no-ext-diff')) return ok(w.patch ?? '')
      if (verb === 'ls-files' && argv.includes('--others')) return ok((w.untracked ?? []).join('\0'))
      if (verb === 'diff') return ok(w.numstat)
      if (verb === 'ls-files') {
        const files: string[] = []
        for (const [dir, kids] of Object.entries(w.dirs)) for (const [name, kind] of kids) if (kind === 'file' && dir.startsWith(w.top)) files.push(`${dir}/${name}`.slice(w.top.length + 1))
        return ok(files.join('\0'))
      }
      return ok('')
    }
    return ok('')
  })
  on('process.spawn', async function* (_$, e) {
    const argv: string[] = [...e.argv]
    ran.push(argv)
    spawns.push({ argv, env: { ...e.env } })
    if (argv[0] === 'du' && w.abortDu?.includes(argv.at(-1) ?? '')) {
      w.abortDu = w.abortDu.filter(d => d !== argv.at(-1))
      return { deny: 'aborted' }
    }
    const out = argv[0] === 'du' ? (w.du?.[argv.at(-1) ?? ''] ?? '') : argv[0] === 'find' && argv.includes('grep') ? (w.loc?.[(argv[1] ?? '').replace(/\/\.$/, '')] ?? '') : ''
    if (out) yield { stream: 'stdout', text: out }
    if (w.grep && (argv[0] === 'grep' || (argv[0] === 'git' && argv.includes('grep')))) {
      const under = argv[0] === 'git' ? (argv[argv.indexOf('-C') + 1] ?? '').slice(w.top.length + 1) : ''
      const full = w.fullName && under && !argv.includes('--no-full-name')
      yield { stream: 'stdout', text: full ? w.grep.replace(/^(?=.)/gm, `${under}/`) : w.grep }
    }
    if (argv[0] === 'sh' && w.poster) yield { stream: 'stdout', text: w.poster(argv) }
    if (argv[0] === 'inotifywait' && w.watch) {
      await clock.sleep(w.watch.after)
      yield { stream: 'stdout', text: w.watch.change() }
    }
    return { value: { code: 0, signal: null } }
  })
  on('tool.call', (_$, e) => w.tool?.(e) ?? { result: { stdout: '', stderr: '' } })
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }))
  return clock
}

const paneProps = (bodyColumns: number) => ({ title: 'Files', isFocused: false, bodyColumns, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} }) satisfies RenderPropsOf['Pane']

async function texts(ui: { drawn: (scope?: { in?: string }) => Promise<unknown> }): Promise<string> {
  const rows = await ui.drawn({ in: 'rows' }).then(r => JSON.stringify(r), () => '')
  return JSON.stringify(await ui.drawn()) + rows
}

const has = <K extends string>(v: unknown, key: K): v is Record<K, unknown> => typeof v === 'object' && v !== null && key in v
const kids = (node: unknown): unknown[] => (has(node, 'children') ? [node.children ?? []].flat() : [])
const propsOf = (node: unknown): unknown => (has(node, 'props') ? node.props : undefined)
const optional = (v: unknown, type: 'string' | 'boolean' | 'number') => v === undefined || typeof v === type
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string')

function isSeg(v: unknown): v is Seg {
  return has(v, 't') && typeof v.t === 'string' && (['c', 'sh', 'bg', 'tab'] as const).every(k => optional(has(v, k) ? v[k] : undefined, 'string')) && (['b', 's', 'i', 'dim', 'one', 'spin'] as const).every(k => optional(has(v, k) ? v[k] : undefined, 'boolean'))
}

function isRowSpec(v: unknown): v is RowSpec {
  return has(v, 'id') && typeof v.id === 'string' && has(v, 'left') && Array.isArray(v.left) && v.left.every(isSeg) && has(v, 'right') && Array.isArray(v.right) && v.right.every(isSeg)
}

function isBar(v: unknown): v is NonNullable<RowsProps['bar']> {
  return has(v, 'pos') && typeof v.pos === 'number' && has(v, 'size') && typeof v.size === 'number' && has(v, 'thumb') && typeof v.thumb === 'string' && has(v, 'track') && typeof v.track === 'string'
}

function isPreview(v: unknown): v is NonNullable<RowsProps['preview']> {
  const segments = has(v, 'segments') ? v.segments : undefined
  return (
    has(v, 'text') && typeof v.text === 'string' && has(v, 'path') && typeof v.path === 'string' && has(v, 'startLine') && typeof v.startLine === 'number' && has(v, 'markdown') && typeof v.markdown === 'boolean' &&
    (segments === undefined || (Array.isArray(segments) && segments.every(g => has(g, 'title') && typeof g.title === 'string' && has(g, 'source') && typeof g.source === 'string'))) &&
    optional(has(v, 'titleColor') ? v.titleColor : undefined, 'string') && optional(has(v, 'rows') ? v.rows : undefined, 'number')
  )
}

function isRowsProps(v: unknown): v is RowsProps {
  if (!has(v, 'rows') || !Array.isArray(v.rows) || !v.rows.every(isRowSpec)) return false
  if (!has(v, 'active') || typeof v.active !== 'string' || !has(v, 'activeBg') || typeof v.activeBg !== 'string' || !has(v, 'hoverBg') || typeof v.hoverBg !== 'string') return false
  if (!has(v, 'tones') || typeof v.tones !== 'object' || v.tones === null || !Object.values(v.tones).every(t => has(t, 'bright') && isStrings(t.bright) && has(t, 'dim') && isStrings(t.dim))) return false
  const spinner = has(v, 'spinner') ? v.spinner : undefined
  const bar = has(v, 'bar') ? v.bar : undefined
  const preview = has(v, 'preview') ? v.preview : undefined
  return (spinner === undefined || isStrings(spinner)) && optional(has(v, 'pointer') ? v.pointer : undefined, 'boolean') && (bar === undefined || isBar(bar)) && (preview === undefined || isPreview(preview))
}

function isZoneProps(v: unknown): v is ZoneProps {
  const box = (b: unknown) => Array.isArray(b) && b.length === 5 && typeof b[0] === 'string' && b.slice(1).every(n => typeof n === 'number')
  return has(v, 'columns') && typeof v.columns === 'number' && has(v, 'rows') && typeof v.rows === 'number' && has(v, 'boxes') && Array.isArray(v.boxes) && v.boxes.every(box)
}

function search(node: unknown, hit: (node: unknown) => boolean): unknown {
  if (!node || typeof node !== 'object') return undefined
  if (hit(node)) return node
  for (const c of kids(node)) {
    const found = search(c, hit)
    if (found) return found
  }
  return undefined
}

function isKeyed(node: unknown, type: string, key: string): boolean {
  const props = propsOf(node)
  return has(node, 'type') && node.type === type && has(props, 'key') && props.key === key
}

function rowsProps(props: unknown): RowsProps {
  if (!isRowsProps(props)) throw new Error(`not rows props: ${JSON.stringify(props)?.slice(0, 300)}`)
  return props
}

function every(node: unknown, hit: (node: unknown) => boolean, out: unknown[] = []): unknown[] {
  if (!node || typeof node !== 'object') return out
  if (hit(node)) out.push(node)
  for (const c of kids(node)) every(c, hit, out)
  return out
}

const keyOf = (node: unknown): string => {
  const props = propsOf(node)
  return has(props, 'key') && typeof props.key === 'string' ? props.key : ''
}
const deskRows = (tree: unknown): string[] => every(tree, n => has(n, 'type') && n.type === 'Box' && keyOf(n).startsWith('row:')).map(n => keyOf(n).slice(4))
const svgs = (tree: unknown): { key: string; alt: string; source: string }[] =>
  every(tree, n => has(n, 'type') && n.type === 'Svg').map(n => {
    const props = propsOf(n)
    return { key: keyOf(n), alt: has(props, 'alt') && typeof props.alt === 'string' ? props.alt : '', source: has(props, 'source') && typeof props.source === 'string' ? props.source : '' }
  })

const deskActive = (tree: unknown): string => keyOf(every(tree, n => has(n, 'type') && n.type === 'Box' && keyOf(n).startsWith('row:') && has(propsOf(n), 'backgroundColor'))[0]).slice(4)
const tap = (ui: { pointer: (e: { type: 'up'; x: number; y: number; in: string }) => Promise<unknown> }, id: string) => ui.pointer({ type: 'up', x: 0, y: 0, in: `button-${id}` })

const firstClient = (tree: unknown): unknown => propsOf(propsOf(kids(tree).find(c => has(c, 'type') && c.type === 'Client')))
const treeRows = (tree: unknown): RowsProps => rowsProps(firstClient(tree))
const clientProps = (tree: unknown, key: string): unknown => propsOf(propsOf(search(tree, n => isKeyed(n, 'Client', key))))

function mapOf(tree: unknown): RowsProps | undefined {
  const props = clientProps(tree, 'treemap')
  return isRowsProps(props) ? props : undefined
}

function mapAt(tree: unknown): RowsProps {
  return rowsProps(clientProps(tree, 'treemap'))
}

function zoneAt(tree: unknown): ZoneProps {
  const props = clientProps(tree, 'treemap')
  if (!isZoneProps(props)) throw new Error('no treemap zone')
  return props
}

const imageAt = (tree: unknown, key: string): string | undefined => sourceOf(search(tree, n => isKeyed(n, 'Image', key)))

const PNG_1PX = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
const pngOf = (path: string) => `"png":"${btoa(PNG_1PX + path)}"`

function sourceOf(node: unknown): string | undefined {
  const props = propsOf(node)
  const source = has(props, 'source') ? props.source : undefined
  return has(source, 'png') && typeof source.png === 'string' ? source.png : undefined
}

function peekOf(tree: unknown): RowsProps & { preview: NonNullable<RowsProps['preview']> } {
  const props = propsOf(propsOf(search(tree, n => {
    const p = propsOf(propsOf(n))
    const preview = has(p, 'preview') ? p.preview : undefined
    return has(n, 'type') && n.type === 'Client' && has(preview, 'rows') && Boolean(preview.rows)
  })))
  const rows = rowsProps(props)
  if (!rows.preview) throw new Error('no preview')
  return { ...rows, preview: rows.preview }
}

const wheelDown = { component: 'Pane', requestId: 'filetree', by: 1, offset: 1, bodyRows: 20, contentRows: 100, origin: { kind: 'person' } } satisfies UiScrollInput
const hostTool = (input: { tool: 'PowerShell' | 'Grep' | 'Glob'; [field: string]: unknown }) => input as unknown as Parameters<Engine['tool']['call']>[0]

const STAMP = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/
const NERD = /[\u{e000}-\u{f8ff}\u{f0000}-\u{fffff}]/u

test('macOS Claude Code app: desktop pane draws, selects, opens with open', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/Users/k/proj'
  const clock = world(on, {
    os: 'darwin', env: { HOME: '/Users/k', TMPDIR: '/var/folders/x/T/' }, cwd: root, top: root,
    dirs: { [root]: [['src', 'dir'], ['README.md', 'file'], ['notes.md', 'file']], [`${root}/src`]: [['a.ts', 'file']] },
    status: '## main...origin/main\0 M src/a.ts\0?? notes.md\0', numstat: '3\t1\tsrc/a.ts\0',
  }, ran)
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const shown = await texts(ui)
  for (const word of ['README.md', 'notes.md', 'src', 'main']) expect(shown).toContain(word)
  expect(shown).not.toContain('origin/main')
  expect(NERD.test(shown)).toBe(false)
  await ui.post({ press: `${root}/README.md` }, { in: `hit:${root}/README.md` })
  await clock.settle()
  expect(await texts(ui)).toMatch(/"truncate-start"},"children":\["README.md"\]/)
  const sent = await $.prompt.submit({ text: 'what is this?', wait: false, origin: { kind: 'composer' } })
  expect(JSON.stringify(sent)).toContain(`${root}/README.md`)
  await ui.post({ press: `${root}/README.md` }, { in: `hit:${root}/README.md` })
  await clock.settle()
  expect(ran).toContainEqual(['open', '--', `${root}/README.md`])
  expect(ran.some(a => a[0] === 'setsid' || a[0] === 'gio')).toBe(false)
  await $.tool.call({ tool: 'Bash', command: 'echo hi >> src/a.ts' })
  await clock.settle()
  const finds = ran.filter(a => a[0] === 'find')
  expect(finds.length).toBeGreaterThan(0)
  expect(finds.every(f => f.includes('-newer') && !f.includes('-newermt'))).toBe(true)
  expect(ran.some(a => a[0] === 'touch' && a[1]?.startsWith('/var/folders/x/T/filetree-'))).toBe(true)
  expect(ran.some(a => a[0] === 'rm')).toBe(true)
  await ui.unmount()
})

test('moving the cursor writes at most one tree snapshot and an idle tree spawns nothing', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const writes: string[] = []
  on('state.set', (_$, e, next) => {
    writes.push(e.key)
    return next(e)
  })
  const root = '/home/k/proj'
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root,
    dirs: { [root]: [['src', 'dir'], ['a.txt', 'file'], ['b.txt', 'file'], ['c.txt', 'file']], [`${root}/src`]: [['a.ts', 'file']] },
    status: '## main\0 M a.txt\0', numstat: '1\t0\ta.txt\0',
  }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  writes.length = 0
  for (const key of ['j', 'j', 'k', 'l', 'h', 'j']) {
    await ui.post({ key }, { in: 'rows' })
    await clock.settle()
  }
  const spawned = ran.length
  for (let i = 0; i < 10; i++) await clock.advance(2_000)
  expect(writes.filter(k => k === 'tree').length <= 1).toBe(true)
  expect(ran.slice(spawned).filter(a => a[0] !== 'toast')).toEqual([])
  const rows = treeRows(await ui.drawn())
  expect(rows.active).toBe(`${root}/b.txt`)
  await ui.unmount()
})

test('macOS outside a repo: write scan uses find -newer marker, not GNU -newermt', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/Users/k/scratch'
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: '', dirs: { [root]: [['a.ts', 'file']] }, status: '', numstat: '' }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  await $.tool.call({ tool: 'Bash', command: 'echo hi > a.ts' })
  await clock.settle()
  const find = ran.find(a => a[0] === 'find')
  expect(find).toBeDefined()
  expect(find).toContain('-newer')
  expect(find).not.toContain('-newermt')
})

test('macOS: the Nerd Font probe skips the LastResort placeholder font, asks for the 3.2 codicons and only trusts a Fonts folder file from Nerd Fonts 3.2 or newer', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/Users/k/scratch'
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: '', dirs: { [root]: [['a.ts', 'file']] }, status: '', numstat: '' }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const call = ran.find(a => a[0] === 'sh' && (a[2] ?? '').includes('fc-list')) ?? []
  const probe = call[2] ?? ''
  const filtered = probe.indexOf('fc-list ":charset=$1" file | grep -vi lastresort')
  expect(filtered).toBeGreaterThan(-1)
  expect(probe.indexOf('Library/Fonts/*Nerd*')).toBeGreaterThan(filtered)
  expect((call[4] ?? '').split(' ')).toEqual(['f04eb', 'ebff', 'ebf6', 'ec01'])
  expect(probe).toContain('grep -aqE "Nerd Fonts (3\\.([2-9]|[1-9][0-9])|[4-9]|[1-9][0-9]+)\\."')
  expect(probe).not.toContain('ls "$HOME"/Library/Fonts')
})

test('Windows: backslash paths shimmer, open hands the path to PowerShell as data, no find, sh or cmd', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = 'C:/Users/k/proj'
  const clock = world(on, {
    os: 'win32', env: { OS: 'Windows_NT', USERPROFILE: 'C:\\Users\\k' }, cwd: 'C:\\Users\\k\\proj', top: root,
    dirs: { [root]: [['src', 'dir'], ['README.md', 'file'], ['a&calc&%USERNAME%.txt', 'file']], [`${root}/src`]: [['a.ts', 'file']] },
    status: '## main\0 M src/a.ts\0', numstat: '1\t0\tsrc/a.ts\0',
  }, ran)
  await $.session.start({ cwd: 'C:\\Users\\k\\proj', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  expect(await texts(ui)).toContain('README.md')
  await $.tool.call({ tool: 'Edit', file_path: 'C:\\Users\\k\\proj\\src\\a.ts', old_string: 'a', new_string: 'b' })
  await clock.settle()
  const shown = await texts(ui)
  expect(shown).toContain('a.ts')
  expect(shown).toContain('+1')
  await $.tool.call({ tool: 'Bash', command: 'echo x >> src/a.ts' })
  await clock.settle()
  await ui.post({ press: `${root}/a&calc&%USERNAME%.txt` }, { in: 'rows' })
  await ui.post({ press: `${root}/a&calc&%USERNAME%.txt` }, { in: 'rows' })
  await clock.settle()
  expect(ran.find(a => a[0] === 'powershell')?.at(-1)).toContain('UseShellExecute = $true')
  expect(envs.at(-1)).toEqual({ PANE_OPEN_TARGET: 'C:\\Users\\k\\proj\\a&calc&%USERNAME%.txt' })
  expect(ran.some(a => ['find', 'sh', 'uname', 'setsid', 'touch', 'cmd'].includes(a[0] ?? ''))).toBe(false)
  await ui.unmount()
})

test('Linux unchanged: GNU find -newermt outside a repo, xdg-open detached', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/scratch'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a\\b.txt', 'file'], ['c.txt', 'file']] }, status: '', numstat: '' }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  expect(await texts(ui)).toContain('a\\\\b.txt')
  await $.tool.call({ tool: 'Bash', command: 'echo hi > c.txt' })
  await clock.settle()
  const find = ran.find(a => a[0] === 'find')
  expect(find).toContain('-newermt')
  expect(ran.some(a => a[0] === 'touch')).toBe(false)
  await ui.post({ press: `${root}/c.txt` }, { in: 'rows' })
  await ui.post({ press: `${root}/c.txt` }, { in: 'rows' })
  await clock.settle()
  const opener = ran.find(a => a[0] === 'sh' && a[2]?.includes('setsid -f -w'))
  expect(opener?.[2]).toContain('</dev/null >/dev/null 2>&1')
  expect(opener?.at(-1)).toBe(`${root}/c.txt`)
  await ui.unmount()
})

test('macOS app: every header button and the search box work on the desktop surface', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/Users/k/proj'
  const clock = world(on, {
    os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: root,
    dirs: { [root]: [['src', 'dir'], ['.env', 'file'], ['README.md', 'file']], [`${root}/src`]: [['a.ts', 'file']], '/Users/k': [['proj', 'dir']] },
    status: '## main\0', numstat: '',
  }, ran)
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  expect(await texts(ui)).toContain('.env')
  await tap(ui, 'hidden')
  await clock.settle()
  expect(await texts(ui)).not.toContain('.env')
  await tap(ui, 'hidden')
  await ui.input({ key: 'q', text: 'a.ts' })
  await clock.settle()
  const jumped = await texts(ui)
  expect(jumped).toContain('a.ts')
  expect(jumped).toContain('"value":""')
  await tap(ui, 'collapse')
  await clock.settle()
  expect(await texts(ui)).not.toContain(`"id":"${root}/src/a.ts"`)
  await tap(ui, 'up')
  await clock.settle()
  expect(await texts(ui)).toContain('"proj"')
  await tap(ui, 'cwd')
  await clock.settle()
  expect(await texts(ui)).toContain('README.md')
  await ui.unmount()
})

test('hovering a header button says what it does in the footer on both surfaces, so the header never moves', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/Users/k/proj'
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: root, dirs: { [root]: [['.env', 'file'], ['a.ts', 'file']] }, status: '## main\0', numstat: '' }, ran)
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ plugin: 'filetree', surface, component: 'Pane', requestId: 'filetree', props: paneProps(60) })
    await clock.settle()
    const head = async () => JSON.stringify(((await ui.drawn()) as { children: unknown[] }).children[0])
    expect(await texts(ui)).not.toContain('reload tree and git')
    await ui.pointer({ type: 'enter', x: 0, y: 0, in: 'button-refresh' })
    await clock.settle()
    expect(await texts(ui)).toMatch(/"reload tree and git ?"/)
    if (surface === 'terminal') expect(await head()).not.toContain('reload tree')
    await ui.pointer({ type: 'leave', x: 0, y: 0, in: 'button-refresh' })
    await clock.settle()
    expect(await texts(ui)).not.toContain('reload tree and git')
    await ui.pointer({ type: 'enter', x: 0, y: 0, in: 'button-hidden' })
    await clock.settle()
    expect(await texts(ui)).toMatch(/"hide hidden files ?"/)
    await (surface === 'desktop' ? tap(ui, 'hidden') : ui.press({ key: 'hidden' }))
    await clock.settle()
    expect(await texts(ui)).toMatch(/"show hidden files ?"/)
    await (surface === 'desktop' ? tap(ui, 'hidden') : ui.press({ key: 'hidden' }))
    await ui.pointer({ type: 'leave', x: 0, y: 0, in: 'button-hidden' })
    await clock.settle()
    await ui.unmount()
  }
  const narrow = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(24) })
  await clock.settle()
  await narrow.pointer({ type: 'enter', x: 0, y: 0, in: 'button-refresh' })
  await clock.settle()
  expect(await texts(narrow)).toContain('"reload tree and git"')
  await narrow.pointer({ type: 'leave', x: 0, y: 0, in: 'button-refresh' })
  await narrow.unmount()
})

test('outside a repo only git rev-parse runs, never status, diff or ls-files', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/scratch'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['c.txt', 'file']] }, status: '', numstat: '' }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  await $.tool.call({ tool: 'Bash', command: 'echo hi > c.txt' })
  await $.tool.call({ tool: 'Edit', file_path: `${root}/c.txt`, old_string: 'a', new_string: 'b' })
  await clock.settle()
  const gits = ran.filter(a => a[0] === 'git').map(a => a.slice(4).find(x => !x.startsWith('-')))
  expect(gits.length).toBeGreaterThan(0)
  expect(gits.every(v => v === 'rev-parse')).toBe(true)
})

test('NotebookEdit refreshes git and lists the notebook folder', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [root]: [['nb', 'dir']], [`${root}/nb`]: [['a.ipynb', 'file']] }, status: '## main\0 M nb/a.ipynb\0', numstat: '4\t2\tnb/a.ipynb\0' }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const before = ran.filter(a => a[0] === 'git' && a.includes('status')).length
  await $.tool.call({ tool: 'NotebookEdit', notebook_path: `${root}/nb/a.ipynb`, new_source: 'x' })
  await clock.settle()
  expect(ran.filter(a => a[0] === 'git' && a.includes('status')).length).toBeGreaterThan(before)
  const shown = await texts(ui)
  expect(shown).toContain('a.ipynb')
  expect(shown).toContain('+4')
  await ui.unmount()
})

test('long trees scroll: wheel, scrollbar drag, and a click does not jump the view', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/big'
  const names = Array.from({ length: 60 }, (_, i): [string, 'file'] => [`f${String(i).padStart(2, '0')}.txt`, 'file'])
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: names }, status: '', numstat: '' }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const props = { ...paneProps(60), scroll: { offset: 0, bodyRows: 20 } }
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props })
  await clock.settle()
  const rowsOf = async () => treeRows(await ui.drawn())
  let p = await rowsOf()
  expect(p.bar).toBeDefined()
  expect(p.rows[0]?.id).toBe(`${root}/f00.txt`)
  expect(JSON.stringify(p.rows)).not.toContain('below')
  await $.ui.scroll(wheelDown)
  await clock.settle()
  p = await rowsOf()
  expect(p.rows[0]?.id).toBe(`${root}/f03.txt`)
  await ui.post({ scrollTo: 1 }, { in: 'rows' })
  await clock.settle()
  p = await rowsOf()
  expect(p.rows.at(-1)?.id).toBe(`${root}/f59.txt`)
  const first = p.rows[0]?.id
  const sixth = p.rows[5]?.id
  if (sixth === undefined) throw new Error('fewer than six rows')
  await ui.post({ press: sixth }, { in: 'rows' })
  await clock.settle()
  p = await rowsOf()
  expect(p.rows[0]?.id).toBe(first)
  expect(p.active).toBe(p.rows[5]?.id)
  await ui.unmount()
})

test('desktop: a long tree draws every row and leaves the wheel to the app', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/Users/k/big'
  const names = Array.from({ length: 60 }, (_, i): [string, 'file'] => [`f${String(i).padStart(2, '0')}.txt`, 'file'])
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k', TMPDIR: '/var/folders/x/T/' }, cwd: root, top: '', dirs: { [root]: names }, status: '', numstat: '' }, [])
  const appScrolls: number[] = []
  on('ui.scroll', (_$, e) => (appScrolls.push(e.by), {}))
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const props = { ...paneProps(60), scroll: { offset: 0, bodyRows: 20 } }
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props })
  await clock.settle()
  const rowsOf = async () => deskRows(await ui.drawn())
  let p = await rowsOf()
  expect(p.length).toBe(60)
  expect(p.at(-1)).toBe(`${root}/f59.txt`)
  const wheel = { component: 'Pane', requestId: 'filetree', by: 1, offset: 1, bodyRows: 20, contentRows: 64, origin: { kind: 'person' } } satisfies UiScrollInput
  expect(await $.ui.scroll(wheel)).toEqual({})
  expect(appScrolls).toEqual([1])
  await clock.settle()
  p = await rowsOf()
  expect(p.length).toBe(60)
  expect(p[0]).toBe(`${root}/f00.txt`)
  await ui.unmount()
})

test('desktop: past a few lit rows the names stop running their own shimmer clock so the page is not flooded', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/Users/k/lit'
  const names = Array.from({ length: 12 }, (_, i): [string, 'file'] => [`f${String(i).padStart(2, '0')}.txt`, 'file'])
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k', TMPDIR: '/var/folders/x/T/' }, cwd: root, top: '', dirs: { [root]: names }, status: '', numstat: '' }, [])
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const litClients = async () => every(await ui.drawn(), n => has(n, 'type') && n.type === 'Client' && keyOf(n).startsWith('lit:')).length
  for (const [name] of names.slice(0, 3)) await $.tool.call({ tool: 'Read', file_path: `${root}/${name}` })
  await clock.settle()
  expect(await litClients()).toBe(3)
  for (const [name] of names.slice(3, 10)) await $.tool.call({ tool: 'Read', file_path: `${root}/${name}` })
  await clock.settle()
  expect(await litClients()).toBe(0)
  expect(await texts(ui)).toContain('"children":["f09.txt"]')
  await ui.unmount()
})

const shimmering = (tree: unknown): Seg[] => every(tree, n => has(n, 'type') && n.type === 'Client').map(n => propsOf(propsOf(n))).filter(isRowsProps).flatMap(p => p.rows.flatMap(r => [...r.left, ...r.right])).filter(s => s.sh)
const fillOf = (source: string): string => /fill="(#[0-9a-f]{6})"/.exec(source)?.[1] ?? ''
const strokeOf = (source: string): string => / stroke="(#[0-9a-f]{6})"/.exec(source)?.[1] ?? ''

test('the shimmer setting turns the activity shimmer off in the terminal and the Desktop app, /config flips it live, and only the Desktop app draws the Clawd button that writes it', { timeoutMs: 30_000 }, async ($, on) => {
  const root = '/Users/k/lit'
  const names = Array.from({ length: 12 }, (_, i): [string, 'file'] => [`f${String(i).padStart(2, '0')}.txt`, 'file'])
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k', TMPDIR: '/var/folders/x/T/' }, cwd: root, top: root, dirs: { [root]: names }, status: '## main\0', numstat: '' }, [])
  const config: Record<string, string> = { 'filetree.shimmer': 'off' }
  const writes: string[] = []
  on('config.list', () => ({ value: Object.entries(config).map(([key, value]) => ({ key, label: key, kind: 'choice' as const, value, options: ['on', 'off'], provider: { plugin: 'filetree', tier: 'user' as const }, isLocked: false })) }))
  on('config.set', (_$, e) => {
    config[e.key] = String(e.value)
    writes.push(`${e.key}=${String(e.value)}`)
    return { value: e.value }
  })
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  const start = async (surface: 'terminal' | 'desktop') => {
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface, component: 'Pane', requestId: 'filetree', props: paneProps(60) })
    await clock.settle()
    return ui
  }
  type Ui = Awaited<ReturnType<typeof start>>
  const press = async (ui: Ui) => {
    await ui.pointer({ type: 'enter', x: 0, y: 0, in: 'button-shimmer' })
    await tap(ui, 'shimmer')
    await ui.pointer({ type: 'leave', x: 0, y: 0, in: 'button-shimmer' })
    await clock.settle()
  }
  const read = async (count: number) => {
    await clock.advance(3_000)
    for (const [name] of names.slice(0, count)) await $.tool.call({ tool: 'Read', file_path: `${root}/${name}` })
    await clock.settle()
  }
  const hint = async (ui: Ui) => {
    await ui.pointer({ type: 'enter', x: 0, y: 0, in: 'button-shimmer' })
    await clock.settle()
    const shown = await texts(ui)
    await ui.pointer({ type: 'leave', x: 0, y: 0, in: 'button-shimmer' })
    await clock.settle()
    return /"((?:en|dis)able agent activity shimmer effect) ?"/.exec(shown)?.[1]
  }
  const look = async (ui: Ui) => {
    const tree = await ui.drawn()
    const icon = (alt: string) => svgs(tree).find(s => s.alt === alt)?.source ?? ''
    const clawd = icon('shimmer button')
    expect(clawd).toContain(ICONS.clawd)
    return fillOf(clawd) === strokeOf(icon('dots button')) ? 'blue like the shown dots' : fillOf(clawd) === strokeOf(icon('up button')) ? 'grey like up' : clawd
  }
  const lit = async (ui: Ui) => {
    const tree = await ui.drawn()
    return { segs: shimmering(tree).length, clients: every(tree, n => has(n, 'type') && n.type === 'Client' && keyOf(n).startsWith('lit:')).length }
  }
  const ticks = async (ui: Ui, key: string) => {
    const before = JSON.stringify(await ui.drawn({ in: key }))
    await ui.advance(450)
    return JSON.stringify(await ui.drawn({ in: key })) !== before
  }
  const DARK = { segs: 0, clients: 0 }
  let ui = await start('desktop')
  expect(await look(ui)).toBe('grey like up')
  expect(await hint(ui)).toBe('enable agent activity shimmer effect')
  await read(10)
  expect(await lit(ui)).toEqual(DARK)
  expect(await texts(ui)).toContain('f09.txt')
  await press(ui)
  expect(writes).toEqual(['filetree.shimmer=on'])
  expect(await look(ui)).toBe('blue like the shown dots')
  expect(await hint(ui)).toBe('disable agent activity shimmer effect')
  await read(3)
  expect(await lit(ui)).toEqual({ segs: 3, clients: 3 })
  expect(await ticks(ui, `lit:${root}/f00.txt`)).toBe(true)
  await press(ui)
  expect(writes).toEqual(['filetree.shimmer=on', 'filetree.shimmer=off'])
  expect(await look(ui)).toBe('grey like up')
  expect(await lit(ui)).toEqual(DARK)
  await ui.unmount()
  await $.session.end({ reason: 'other', sessionId: 'test-session', resume: { id: 'test-session' } })
  ui = await start('terminal')
  expect(clientProps(await ui.drawn(), 'button-shimmer')).toBeUndefined()
  await read(10)
  expect(await lit(ui)).toEqual(DARK)
  expect(await ticks(ui, 'rows')).toBe(false)
  await $.config.set({ key: 'filetree.shimmer', value: 'on', previous: 'off', provider: { plugin: 'filetree', tier: 'user' }, origin: { kind: 'composer' } })
  await clock.settle()
  await read(3)
  expect(await lit(ui)).toEqual({ segs: 6, clients: 0 })
  expect(await ticks(ui, 'rows')).toBe(true)
  expect(writes).toEqual(['filetree.shimmer=on', 'filetree.shimmer=off', 'filetree.shimmer=on'])
  await ui.unmount()
})

const shimmerConfig = (on: On, value: string) => {
  const config: Record<string, string> = { 'filetree.shimmer': value }
  on('config.list', () => ({ value: Object.entries(config).map(([key, v]) => ({ key, label: key, kind: 'choice' as const, value: v, options: ['on', 'off'], provider: { plugin: 'filetree', tier: 'user' as const }, isLocked: false })) }))
  on('config.set', (_$, e) => {
    config[e.key] = String(e.value)
    return { value: e.value }
  })
}
const shimmerOnAgain = ($: Engine) => $.config.set({ key: 'filetree.shimmer', value: 'on', previous: 'off', provider: { plugin: 'filetree', tier: 'user' }, origin: { kind: 'composer' } })

test('desktop: k on the first row and a click on the root header never put the cursor on the root folder', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/Users/k/proj'
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: '', dirs: { [root]: [['a.ts', 'file'], ['b.ts', 'file']] }, status: '', numstat: '' }, [])
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: { ...paneProps(60), isFocused: true } })
  await clock.settle()
  const cursorOn = async () => every(await ui.drawn(), n => has(n, 'type') && n.type === 'Box' && keyOf(n).startsWith('bar:')).map(n => keyOf(n).slice(4))
  await ui.post({ press: `${root}/a.ts` }, { in: `hit:${root}/a.ts` })
  await clock.advance(1000)
  await ui.post({ key: 'k' }, { in: `hit:${root}/a.ts` })
  await ui.post({ key: 'k' }, { in: `hit:${root}/a.ts` })
  await clock.settle()
  expect(await cursorOn()).toEqual([`${root}/a.ts`])
  await ui.post({ press: '\u0000root' }, { in: 'hit:root' })
  await clock.settle()
  expect(await cursorOn()).toEqual([`${root}/a.ts`])
  expect(await selected($)).toContain(`${root}/a.ts`)
  await ui.unmount()
})

test('desktop: when /config refuses the shimmer write, the Clawd button keeps the shimmer as it was and says why', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/Users/k/lit'
  const names = Array.from({ length: 4 }, (_, i): [string, 'file'] => [`f${i}.txt`, 'file'])
  const ran: Ran = []
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k', TMPDIR: '/var/folders/x/T/' }, cwd: root, top: root, dirs: { [root]: names }, status: '## main\0', numstat: '' }, ran)
  on('config.list', () => ({ value: [{ key: 'filetree.shimmer', label: 'Activity shimmer', kind: 'choice' as const, value: 'off', options: ['on', 'off'], provider: { plugin: 'filetree', tier: 'user' as const }, isLocked: true }] }))
  on('config.set', () => ({ deny: 'managed settings own this value' }))
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const hint = async () => {
    await ui.pointer({ type: 'enter', x: 0, y: 0, in: 'button-shimmer' })
    await clock.settle()
    const shown = JSON.stringify(await ui.drawn())
    await ui.pointer({ type: 'leave', x: 0, y: 0, in: 'button-shimmer' })
    await clock.settle()
    return /(?:en|dis)able agent activity shimmer effect/.exec(shown)?.[0]
  }
  expect(await hint()).toBe('enable agent activity shimmer effect')
  await tap(ui, 'shimmer')
  await clock.settle()
  const tree = await ui.drawn()
  const icon = (alt: string) => svgs(tree).find(s => s.alt === alt)?.source ?? ''
  expect(fillOf(icon('shimmer button'))).toBe(strokeOf(icon('up button')))
  expect(ran.some(r => r[0] === 'toast' && (r[1] ?? '').includes('managed settings own this value'))).toBe(true)
  await clock.advance(3_000)
  for (const [name] of names) await $.tool.call({ tool: 'Read', file_path: `${root}/${name}` })
  await clock.settle()
  expect(every(await ui.drawn(), n => has(n, 'type') && n.type === 'Client' && keyOf(n).startsWith('lit:'))).toHaveLength(0)
  await ui.unmount()
})

test('terminal: with the shimmer off, a file Claude read above the view is not pinned there, and turning it on pins it again', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const root = '/Users/k/lit'
  const names = Array.from({ length: 80 }, (_, i): [string, 'file'] => [`f${String(i).padStart(2, '0')}.txt`, 'file'])
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k', TMPDIR: '/var/folders/x/T/' }, cwd: root, top: '', dirs: { [root]: names }, status: '', numstat: '' }, [])
  shimmerConfig(on, 'off')
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const view = async () => treeRows(await ui.drawn()).rows
  const readPair = async () => {
    await clock.advance(3_000)
    await $.tool.call({ tool: 'Read', file_path: `${root}/f00.txt` })
    await $.tool.call({ tool: 'Read', file_path: `${root}/f70.txt` })
    await clock.settle()
  }
  await readPair()
  let rows = await view()
  expect(rows.map(r => r.id)).toContain(`${root}/f70.txt`)
  expect(rows.map(r => r.id)).not.toContain(`${root}/f00.txt`)
  expect(rows.some(r => r.left.some(s => s.t.includes('⋮')))).toBe(false)
  await shimmerOnAgain($)
  await clock.settle()
  await readPair()
  rows = await view()
  expect(rows.map(r => r.id)).toContain(`${root}/f00.txt`)
  expect(rows.some(r => r.left.some(s => s.t.includes('⋮')))).toBe(true)
  await ui.unmount()
})

test('treemap: with the shimmer off, an edit inside a box leaves its color alone, and turning it on lights the box again', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['src', 'dir'], ['big.bin', 'file'], ['a.ts', 'file']], [`${root}/src`]: [['x.ts', 'file'], ['y.ts', 'file']] },
    files: { [`${root}/src/x.ts`]: 'export const x = 1\n' },
    du: { [root]: `5120\t${root}/src/x.ts\n1024\t${root}/src/y.ts\n6144\t${root}/src\n3072\t${root}/big.bin\n4\t${root}/a.ts\n9220\t${root}\n` },
  }, [])
  shimmerConfig(on, 'off')
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.press({ key: 'split' })
  await clock.settle()
  const look = async () => JSON.stringify(mapAt(await ui.drawn()).rows.flatMap(r => r.left).filter(s => s.tab === `${root}/src`).map(s => [s.bg, s.b]))
  const edit = async () => {
    await clock.advance(3_000)
    await $.tool.call({ tool: 'Edit', file_path: `${root}/src/x.ts`, old_string: 'a', new_string: 'b' })
    await clock.settle()
  }
  const calm = await look()
  await edit()
  expect(await look()).toBe(calm)
  await shimmerOnAgain($)
  await clock.settle()
  await edit()
  expect(await look()).not.toBe(calm)
  await ui.unmount()
})

test('terminal: the shimmer setting set to off in the plugin options starts with no shimmer and no Clawd button', { timeoutMs: 20_000, options: { shimmer: 'off' } }, async ($, on) => {
  const root = '/Users/k/lit'
  const names = Array.from({ length: 4 }, (_, i): [string, 'file'] => [`f${i}.txt`, 'file'])
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k', TMPDIR: '/var/folders/x/T/' }, cwd: root, top: root, dirs: { [root]: names }, status: '## main\0', numstat: '' }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  for (const [name] of names) await $.tool.call({ tool: 'Read', file_path: `${root}/${name}` })
  await clock.settle()
  const tree = await ui.drawn()
  expect(clientProps(tree, 'button-shimmer')).toBeUndefined()
  expect(shimmering(tree)).toEqual([])
  expect(await texts(ui)).toContain('f3.txt')
  await ui.unmount()
})

test('desktop: a very large open tree is cut with a note so the drawn tree stays within the engine bounds', { timeoutMs: 30_000 }, async ($, on) => {
  const root = '/Users/k/huge'
  const names = Array.from({ length: 5000 }, (_, i): [string, 'file'] => [`file-number-${String(i).padStart(5, '0')}.txt`, 'file'])
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k', TMPDIR: '/var/folders/x/T/' }, cwd: root, top: '', dirs: { [root]: names }, status: '', numstat: '' }, [])
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: { ...paneProps(60), scroll: { offset: 0, bodyRows: 20 } } })
  await clock.settle()
  const tree = await ui.drawn()
  const rows = deskRows(tree)
  expect(rows.length).toBeLessThan(5000)
  expect(rows.length).toBeGreaterThan(100)
  expect(JSON.stringify(tree)).toContain('more rows, collapse folders or use search')
  await ui.unmount()
})

async function scrolledTree($: Engine, on: On) {
  const root = '/home/k/big'
  const files = Array.from({ length: 60 }, (_, i): [string, 'file'] => [`f${String(i).padStart(2, '0')}.txt`, 'file'])
  const kids = Array.from({ length: 5 }, (_, i): [string, 'file'] => [`a${i}.txt`, 'file'])
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a', 'dir'], ...files], [`${root}/a`]: kids }, status: '', numstat: '' }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: { ...paneProps(60), scroll: { offset: 0, bodyRows: 20 } } })
  await clock.settle()
  await $.ui.scroll(wheelDown)
  await clock.settle()
  const ids = async () => treeRows(await ui.drawn()).rows.map(r => r.id)
  expect((await ids())[0]).toBe(`${root}/f02.txt`)
  return { root, clock, ui, ids }
}

test('follow on: the tree scrolls to the file Claude reads', { timeoutMs: 20_000 }, async ($, on) => {
  const { root, clock, ui, ids } = await scrolledTree($, on)
  await $.tool.call({ tool: 'Read', file_path: `${root}/f55.txt` })
  await clock.settle()
  expect(await ids()).toContain(`${root}/f55.txt`)
  expect((await ids())[0]).not.toBe(`${root}/f02.txt`)
  await ui.unmount()
})

test('follow off: reads, writes and folders Claude opens above the view never move it', { timeoutMs: 20_000, options: { follow: 'off' } }, async ($, on) => {
  const { root, clock, ui, ids } = await scrolledTree($, on)
  await $.tool.call({ tool: 'Read', file_path: `${root}/f55.txt` })
  await clock.settle()
  expect((await ids())[0]).toBe(`${root}/f02.txt`)
  expect(await ids()).not.toContain(`${root}/f55.txt`)
  await $.tool.call({ tool: 'Read', file_path: `${root}/f05.txt` })
  await clock.settle()
  expect((await ids())[0]).toBe(`${root}/f02.txt`)
  expect(await texts(ui)).toContain(shimmer('f05.txt', 'purple'))
  await $.tool.call({ tool: 'Read', file_path: `${root}/a/a3.txt` })
  await clock.settle()
  expect((await ids())[0]).toBe(`${root}/f02.txt`)
  await $.tool.call({ tool: 'Edit', file_path: `${root}/f40.txt`, old_string: 'a', new_string: 'b' })
  await clock.settle()
  expect((await ids())[0]).toBe(`${root}/f02.txt`)
  await $.ui.scroll(wheelDown)
  await clock.settle()
  expect((await ids())[0]).toBe(`${root}/f05.txt`)
  await ui.unmount()
})

test('watches only git metadata, copies paths, clears search, Home and End', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const mtimes: Record<string, number> = {}
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [root]: [['.git', 'dir'], ['a.txt', 'file'], ['b.txt', 'file'], ['c.txt', 'file']], [`${root}/.git`]: [['index', 'file'], ['HEAD', 'file']] }, status: '## main\0', numstat: '', mtimes }, ran)
  const copied: string[] = []
  on('ui.copy', (_$, e) => {
    copied.push(e.text)
    return { value: { isCopied: true } }
  })
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ copy: `${root}/b.txt` }, { in: 'rows' })
  await ui.post({ copy: `${root}/b.txt`, shift: true }, { in: 'rows' })
  await clock.settle()
  expect(copied).toEqual(['b.txt', `${root}/b.txt`])
  await ui.input({ key: 'q', text: 'b', kind: 'change' })
  await clock.settle()
  expect(await ui.find({ key: 'clear' })).toBeDefined()
  await ui.press({ key: 'clear' })
  await clock.settle()
  expect(await ui.find({ key: 'clear' })).toBeUndefined()
  await ui.post({ key: 'end' }, { in: 'rows' })
  await clock.settle()
  const rowsOf = async () => treeRows(await ui.drawn())
  expect((await rowsOf()).active).toBe(`${root}/c.txt`)
  await ui.post({ key: 'home' }, { in: 'rows' })
  await clock.settle()
  expect((await rowsOf()).active).toBe(`${root}/.git`)
  await ui.post({ key: 'j' }, { in: 'rows' })
  await clock.settle()
  expect((await rowsOf()).active).not.toBe(`${root}/.git`)
  await ui.post({ key: 'k' }, { in: 'rows' })
  await clock.settle()
  expect((await rowsOf()).active).toBe(`${root}/.git`)
  await ui.input({ key: 'q', text: 'c', kind: 'submit' })
  await clock.settle()
  expect((await rowsOf()).active).toBe(`${root}/c.txt`)
  await clock.advance(2100)
  await clock.settle()
  const before = ran.filter(a => a.includes('status')).length
  mtimes[`${root}/.git/index`] = 1_800_000_009_000
  await clock.advance(2100)
  await clock.settle()
  expect(ran.filter(a => a.includes('status')).length).toBeGreaterThan(before)
  await ui.unmount()
})

test('with the classic hooks bypassed, a git commit still recolours the tree', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const mtimes: Record<string, number> = {}
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [root]: [['.git', 'dir'], ['a.txt', 'file']], [`${root}/.git`]: [['index', 'file'], ['HEAD', 'file']] }, status: '## main\0', numstat: '', mtimes }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  await clock.advance(2100)
  const before = ran.filter(a => a.includes('status')).length
  await clock.advance(2100)
  expect(ran.filter(a => a.includes('status')).length).toBe(before)
  mtimes[`${root}/.git/index`] = 1_800_000_009_000
  await clock.advance(2100)
  await clock.settle()
  expect(ran.filter(a => a.includes('status')).length).toBeGreaterThan(before)
})

test('with the classic hooks bypassed, /clear still rebuilds the tree from session.end', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const w: World = { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.ts', 'file'], ['sub', 'dir']], [`${root}/sub`]: [['b.ts', 'file']] }, status: '', numstat: '' }
  const clock = world(on, w, ran)
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  expect(await texts(ui)).toContain(`"id":"${root}/a.ts"`)
  w.cwd = `${root}/sub`
  await $.session.end({ reason: 'clear', sessionId: 'test-session', resume: { id: 'test-session' } })
  await clock.advance(10)
  await clock.settle()
  const shown = await texts(ui)
  expect(shown).toContain(`"id":"${root}/sub/b.ts"`)
  expect(shown).not.toContain(`"id":"${root}/a.ts"`)
  await ui.unmount()
})

test('d shows a changed file as a diff drawn by the engine, and d again goes back to the file', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [root]: [['a.ts', 'file']] }, status: '## main\0 M a.ts\0', numstat: '', files: { '/home/k/proj/a.ts': 'const a = 1\nconst b = 3\nconst c = 4\n' }, patch: 'diff --git a/a.ts b/a.ts\nindex 1..2 100644\n--- a/a.ts\n+++ b/a.ts\n@@ -1,3 +1,3 @@\n const a = 1\n-const b = 2\n+const b = 3\n const c = 4\n' }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ key: 'end' }, { in: 'rows' })
  await ui.post({ key: 'd' }, { in: 'rows' })
  await clock.settle()
  let shown = await texts(ui)
  expect(shown).toContain('"format":"diff"')
  expect(shown).toContain('@@ -1,3 +1,3 @@\\n const a = 1\\n-const b = 2\\n+const b = 3')
  await ui.post({ key: 'd' }, { in: 'rows' })
  await clock.settle()
  shown = await texts(ui)
  expect(shown).not.toContain('"format":"diff"')
  expect(shown).toContain('const b = 3')
  await ui.unmount()
})

test('d on a folder shows every changed file under it in one diff, and j/k jump from file to file', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const long = Array.from({ length: 60 }, (_, i) => `+line ${i}`).join('\n')
  const patch = `diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,2 +1,62 @@\n-old a\n+new a\n${long}\n same\n` + 'diff --git a/src/b.ts b/src/b.ts\n--- a/src/b.ts\n+++ b/src/b.ts\n@@ -4,1 +4,1 @@\n-old b\n+new b\n'
  const fresh = 'diff --git a/src/c.ts b/src/c.ts\nnew file mode 100644\n--- /dev/null\n+++ b/src/c.ts\n@@ -0,0 +1,1 @@\n+brand new\n'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [root]: [['src', 'dir']], [`${root}/src`]: [['a.ts', 'file'], ['b.ts', 'file'], ['c.ts', 'file']] }, status: '## main\0 M src/a.ts\0 M src/b.ts\0?? src/c.ts\0', numstat: '', patch, untracked: ['src/c.ts'], untrackedPatch: fresh }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ key: 'end' }, { in: 'rows' })
  await ui.post({ key: 'd' }, { in: 'rows' })
  await clock.settle()
  let shown = await texts(ui)
  expect(shown).toContain('3 changed files against HEAD')
  expect(ran.filter(a => a[0] === 'git' && a.includes('--no-ext-diff')).every(a => a.includes('--src-prefix=a/') && a.includes('--dst-prefix=b/'))).toBe(true)
  expect(shown).toContain('"src/a.ts"')
  expect(shown).toContain('+new a')
  await ui.post({ key: 'j' }, { in: 'rows' })
  await clock.settle()
  shown = await texts(ui)
  expect(shown).not.toContain('+new a')
  for (const name of ['src/b.ts', 'src/c.ts']) expect(shown).toContain(`"${name}"`)
  expect(shown).toContain('+new b')
  expect(shown).toContain('+brand new')
  await ui.post({ key: 'j' }, { in: 'rows' })
  await clock.settle()
  shown = await texts(ui)
  expect(shown).not.toContain('+new b')
  expect(shown).toContain('+brand new')
  await ui.post({ key: 'k' }, { in: 'rows' })
  await clock.settle()
  await ui.post({ key: 'k' }, { in: 'rows' })
  await clock.settle()
  expect(await texts(ui)).toContain('+new a')
  await ui.unmount()
})

test('Diff with runs lazygit in a tmux window', { timeoutMs: 20_000, options: { diff: 'lazygit -f' } }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k', TMUX: '/tmp/tmux-1/default,1,0' }, cwd: root, top: root, dirs: { [root]: [['a.ts', 'file']] }, status: '## main\0 M a.ts\0', numstat: '' }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ key: 'end' }, { in: 'rows' })
  await ui.post({ key: 'd' }, { in: 'rows' })
  await clock.settle()
  expect(ran).toContainEqual(['tmux', 'new-window', '-c', root, '--', 'lazygit', '-f', `${root}/a.ts`])
  await ui.unmount()
})

test('d diffs against the empty tree before the first commit, and a binary change still shows', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const patch = 'diff --git a/logo.png b/logo.png\nnew file mode 100644\nindex 0000000..1111111\nBinary files /dev/null and b/logo.png differ\n'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [root]: [['logo.png', 'file']] }, status: '## No commits yet on main\0A  logo.png\0', numstat: '', patch, unborn: true }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ key: 'end' }, { in: 'rows' })
  await ui.post({ key: 'd' }, { in: 'rows' })
  await clock.settle()
  expect(ran.some(a => a[0] === 'git' && a.includes('hash-object'))).toBe(true)
  expect(ran.some(a => a[0] === 'git' && a.includes('--no-ext-diff') && a.includes('4b825dc642cb6eb9a060e54bf8d69288fbee4904'))).toBe(true)
  expect(await texts(ui)).toContain('(binary file changed)')
  await ui.unmount()
})

test('Diff with outside tmux and herdr opens a new terminal window on Linux', { timeoutMs: 20_000, options: { diff: 'hunk diff --' } }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [root]: [['a.ts', 'file']] }, status: '## main\0 M a.ts\0', numstat: '' }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ key: 'end' }, { in: 'rows' })
  await ui.post({ key: 'd' }, { in: 'rows' })
  await clock.settle()
  expect(ran).toContainEqual(['sh', '-c', LINUX_LAUNCH, 'sh', 'xdg-terminal-exec', 'sh', '-c', 'cd "$1" && shift && exec "$@"', 'sh', root, 'hunk', 'diff', '--', `${root}/a.ts`])
  await ui.unmount()
})

test('sidebar only: no pane in the default layout, and an inline pane closes itself', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.txt', 'file']] }, status: '', numstat: '' }, ran)
  const opened = opens
  const closed: unknown[] = []
  on('ui.close', (_$, e) => {
    closed.push(e)
    return { value: undefined }
  })
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const before = opened.length
  const r = await $.command.run({ command: 'filetree', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 200 } })
  expect(JSON.stringify(r)).toContain('/tui fullscreen')
  expect(opened.length).toBe(before)
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: { ...paneProps(60), placement: 'inline' }, viewport: { columns: 200, rows: 40, isFullscreen: false } })
  await clock.settle()
  expect(closed.length).toBeGreaterThan(0)
  await ui.unmount()
})

test('fullscreen: a terminal narrowed for a moment leaves the pane open, and it draws again once wide', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.txt', 'file']] }, status: '', numstat: '' }, ran)
  const closed: unknown[] = []
  on('ui.close', (_$, e) => {
    closed.push(e)
    return { value: undefined }
  })
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const narrow = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: { ...paneProps(60), placement: 'inline' }, viewport: { columns: 90, rows: 40, isFullscreen: true } })
  await clock.settle()
  await narrow.unmount()
  expect(closed).toEqual([])
  const wide = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60), viewport: { columns: 200, rows: 40, isFullscreen: true } })
  await clock.settle()
  expect(await texts(wide)).toContain('a.txt')
  await wide.unmount()
})

test('in the desktop app /filetree opens the pane without the terminal layout checks', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.txt', 'file']] }, status: '', numstat: '' }, ran)
  on('session.surfaces', () => ({ value: ['desktop'] }))
  await $.session.start({ cwd: root, surface: null, isInteractive: false })
  await clock.settle()
  const before = opens.length
  const r = await $.command.run({ command: 'filetree', args: '', origin: { kind: 'sdk' }, presentation: { isFullscreen: false, columns: 80 } })
  await clock.settle()
  expect(JSON.stringify(r)).toContain('File tree on')
  expect(opens.length).toBeGreaterThan(before)
  expect(opens.at(-1)).toMatchObject({ id: 'filetree', focus: true })
})

test('/filetree registers as immediate so it toggles the tree while a turn runs', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.txt', 'file']] }, status: '', numstat: '' }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  expect(registered.at(-1)).toMatchObject({ name: 'filetree', immediate: true })
})

test('focus on open off: a bare /filetree opens the tree without taking the keyboard, /filetree open still takes it', { timeoutMs: 20_000, options: { focus: 'off' } }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.txt', 'file']] }, status: '', numstat: '' }, ran)
  on('session.surfaces', () => ({ value: ['desktop'] }))
  await $.session.start({ cwd: root, surface: null, isInteractive: false })
  await clock.settle()
  const before = opens.length
  await $.command.run({ command: 'filetree', args: '', origin: { kind: 'sdk' }, presentation: { isFullscreen: false, columns: 80 } })
  await clock.settle()
  expect(opens.length).toBeGreaterThan(before)
  expect(opens.at(-1)).not.toHaveProperty('focus')
  await $.command.run({ command: 'filetree', args: 'open', origin: { kind: 'sdk' }, presentation: { isFullscreen: false, columns: 80 } })
  await clock.settle()
  expect(opens.at(-1)).toMatchObject({ id: 'filetree', focus: true })
})

for (const [start, via] of [['off', 'clear'], ['on', 'clear'], ['off', 'reload'], ['on', 'reload']] as const) {
  test(`open at start ${start}: ${via === 'clear' ? '/clear' : 'a plugin reload'} goes back to the setting after /filetree ${start === 'off' ? 'opened' : 'closed'} the tree (#73)`, { timeoutMs: 20_000, options: { start } }, async ($, on) => {
    const ran: Ran = []
    const root = '/home/k/proj'
    const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.txt', 'file']] }, status: '', numstat: '' }, ran)
    const first = opens.length
    let closedAt = -1
    const shown = () => opens.length > first && closedAt !== opens.length
    on('session.surfaces', () => ({ value: ['desktop'] }))
    on('ui.close', () => {
      closedAt = opens.length
      return { value: undefined }
    })
    on('ui.panes', () => ({ value: opens.length > first ? [{ id: 'filetree', title: 'Files', isFocused: false, isShown: shown(), isPlaced: shown() }] : [] }))
    on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
    const bare = { command: 'filetree', args: '', origin: { kind: 'sdk' }, presentation: { isFullscreen: false, columns: 80 } } satisfies CommandRunInput
    await $.session.start({ cwd: root, surface: null, isInteractive: false })
    await clock.settle()
    expect(shown()).toBe(start === 'on')
    await $.command.run(bare)
    await clock.settle()
    expect(shown()).toBe(start === 'off')
    const before = opens.length
    if (via === 'clear') {
      await $.session.end({ reason: 'clear', sessionId: 'test-session', resume: { id: 'test-session' } })
      await clock.advance(10)
    } else await $.session.start({ cwd: root, surface: null, isInteractive: false })
    await clock.settle()
    expect(opens.length > before).toBe(start === 'on')
    if (via === 'clear') expect(shown()).toBe(start === 'on')
  })
}

test('focus on open off: a bare /filetree toggles the tree and reopens it after a close without taking the keyboard', { timeoutMs: 20_000, options: { focus: 'off' } }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.txt', 'file']] }, status: '', numstat: '' }, ran)
  const start = opens.length
  let closedAt = -1
  const shown = () => opens.length > start && closedAt !== opens.length
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('ui.close', () => {
    closedAt = opens.length
    return { value: undefined }
  })
  on('ui.panes', () => ({ value: opens.length > start ? [{ id: 'filetree', title: 'Files', isFocused: false, isShown: shown(), isPlaced: shown() }] : [] }))
  await $.session.start({ cwd: root, surface: null, isInteractive: false })
  await clock.settle()
  const bare = { command: 'filetree', args: '', origin: { kind: 'sdk' }, presentation: { isFullscreen: false, columns: 80 } } satisfies CommandRunInput
  expect(shown()).toBe(true)
  for (let round = 0; round < 2; round++) {
    expect(JSON.stringify(await $.command.run(bare))).toContain('closed')
    await clock.settle()
    expect(shown()).toBe(false)
    const before = opens.length
    expect(JSON.stringify(await $.command.run(bare))).toContain('File tree on')
    await clock.settle()
    expect(opens.length).toBeGreaterThan(before)
    expect(shown()).toBe(true)
    expect(opens.at(-1)).not.toHaveProperty('focus')
  }
})

const shimmer = (name: string, tone: string) => `"t":${JSON.stringify(name)},"sh":"${tone}"`
const fullscreen = (args: string) => ({ command: 'filetree', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } }) satisfies CommandRunInput

test('after /clear the tree rebuilds itself, keeps a pinned folder, and an empty root never loops', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.ts', 'file'], ['sub', 'dir']], [`${root}/sub`]: [['b.ts', 'file']] }, status: '', numstat: '' }, ran)
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  expect(ancestorsOf('/repo/a.ts', '')).toEqual([])
  expect(ancestorsOf('/repo2/a.ts', '/repo')).toEqual([])
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await $.tool.call({ tool: 'Read', file_path: `${root}/a.ts` })
  await clock.settle()
  await $.session.end({ reason: 'clear', sessionId: 'test-session', resume: { id: 'test-session' } })
  await clock.advance(10)
  await clock.settle()
  expect(await texts(ui)).toContain(`"id":"${root}/a.ts"`)
  await $.command.run(fullscreen(`${root}/sub`))
  await clock.settle()
  await $.session.end({ reason: 'clear', sessionId: 'test-session', resume: { id: 'test-session' } })
  await clock.advance(10)
  await clock.settle()
  const shown = await texts(ui)
  expect(shown).toContain(`"id":"${root}/sub/b.ts"`)
  expect(shown).not.toContain(`"id":"${root}/a.ts"`)
  await ui.unmount()
})

test('opener failures show a toast instead of failing silently', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/Users/k/proj'
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: '', dirs: { [root]: [['a.xyz', 'file']] }, status: '', numstat: '', exits: { open: [1, 'No application knows how to open a.xyz\n'] } }, ran)
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await ui.post({ press: `${root}/a.xyz` }, { in: `hit:${root}/a.xyz` })
  await ui.post({ press: `${root}/a.xyz` }, { in: `hit:${root}/a.xyz` })
  await clock.settle()
  expect(ran).toContainEqual(['open', '--', `${root}/a.xyz`])
  expect(ran.some(a => a[0] === 'toast' && (a[1] ?? '').includes('No application knows how to open a.xyz'))).toBe(true)
  await ui.unmount()
})

test('open with unset: tmux and editor variables do not replace the default app', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/Users/k/proj'
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k', TMUX: '/tmp/tmux-501/default,1,0', VISUAL: 'vim', EDITOR: 'nano' }, cwd: root, top: '', dirs: { [root]: [['a.png', 'file'], ['b.pdf', 'file']] }, status: '', numstat: '' }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await ui.post({ press: `${root}/a.png` }, { in: 'rows' })
  await ui.post({ press: `${root}/a.png` }, { in: 'rows' })
  await ui.post({ key: 'down' }, { in: 'rows' })
  await ui.post({ key: 'return' }, { in: 'rows' })
  await clock.settle()
  expect(ran).toContainEqual(['open', '--', `${root}/a.png`])
  expect(ran).toContainEqual(['open', '--', `${root}/b.pdf`])
  expect(ran.some(a => a.includes(TMUX_OPEN))).toBe(false)
  await ui.unmount()
})

for (const [visual, editor, chosen] of [['vim', 'nano', 'vim'], ['', 'nano', 'nano'], ['', '', 'vi']] as const) {
  test(`open with editor: VISUAL=${visual}, EDITOR=${editor} chooses ${chosen}`, { timeoutMs: 20_000, options: { open: 'editor' } }, async ($, on) => {
    const ran: Ran = []
    const root = '/home/k/proj'
    const clock = world(on, { os: 'linux', env: { HOME: '/home/k', TMUX: '/tmp/tmux-1000/default,1,0', VISUAL: visual, EDITOR: editor }, cwd: root, top: '', dirs: { [root]: [['a b.md', 'file']] }, status: '', numstat: '' }, ran)
    await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
    await ui.post({ press: `${root}/a b.md` }, { in: 'rows' })
    await ui.post({ key: 'o' }, { in: 'rows' })
    await clock.settle()
    expect(ran).toContainEqual(['sh', '-c', TMUX_OPEN, 'sh', `${root}/a b.md`, root, '', chosen])
    expect(ran.some(a => a[0] === 'editor')).toBe(false)
    await ui.unmount()
  })
}

for (const [surface, os] of [['terminal', 'darwin'], ['desktop', 'darwin'], ['terminal', 'win32']] as const) {
  test(`open with editor in an unsupported environment: ${surface} on ${os} requests a toast without opening a file`, { timeoutMs: 20_000, options: { open: 'editor' } }, async ($, on) => {
    const ran: Ran = []
    const root = os === 'win32' ? 'C:/Users/k/proj' : '/Users/k/proj'
    const env: Record<string, string> = os === 'win32' ? { OS: 'Windows_NT', TMUX: '/tmp/tmux-501/default,1,0', HERDR_ENV: '1', EDITOR: 'vim' } : { HOME: '/Users/k', EDITOR: 'vim' }
    const clock = world(on, { os, env, cwd: root, top: '', dirs: { [root]: [['a.md', 'file']] }, status: '', numstat: '' }, ran)
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface, component: 'Pane', requestId: 'filetree', props: paneProps(60) })
    ran.length = 0
    const zone = { in: surface === 'desktop' ? `hit:${root}/a.md` : 'rows' }
    await ui.post({ press: `${root}/a.md` }, zone)
    await ui.post({ press: `${root}/a.md` }, zone)
    await clock.settle()
    expect(ran.filter(a => a[0] !== 'uname')).toEqual([['toast', 'Open with: editor requires tmux or herdr on Linux or macOS. Clear Open with to use the default app, or set a custom command.']])
    await ui.unmount()
  })
}

for (const [bin, env] of [
  ['/opt/herdr/bin/herdr', { HOME: '/home/k', HERDR_ENV: '1', HERDR_BIN_PATH: '/opt/herdr/bin/herdr', EDITOR: 'nvim' }],
  ['herdr', { HOME: '/home/k', HERDR_ENV: '1', EDITOR: 'nvim' }],
] as const) {
  test(`open with editor in herdr: Enter splits a pane beside Claude's and ${bin === 'herdr' ? 'herdr on PATH' : 'HERDR_BIN_PATH'} runs the editor there, the file name only in its environment`, { timeoutMs: 20_000, options: { open: 'editor' } }, async ($, on) => {
    const ran: Ran = []
    const root = '/home/k/proj'
    const name = "A & B's $(touch nope) `touch nope2`; x.md"
    const clock = world(on, { os: 'linux', env, cwd: root, top: '', dirs: { [root]: [[name, 'file']] }, status: '', numstat: '', stdout: { [`${bin} pane split`]: HERDR_SPLIT } }, ran)
    await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
    await ui.post({ press: `${root}/${name}` }, { in: 'rows' })
    await ui.post({ key: 'o' }, { in: 'rows' })
    await clock.settle()
    expect(ran.filter(a => a[0] === bin && a[1] === 'pane')).toEqual([
      [bin, 'pane', 'split', '--current', '--direction', 'right', '--focus', '--cwd', root, '--env', `PANE_OPEN_TARGET=${root}/${name}`],
      [bin, 'pane', 'run', 'w1:p37', `exec 'nvim' "$PANE_OPEN_TARGET"`],
    ])
    expect(ran.some(a => a.includes(TMUX_OPEN) || a[0] === 'toast')).toBe(false)
    await ui.unmount()
  })
}

test('open with editor: tmux inside herdr keeps using the tmux window', { timeoutMs: 20_000, options: { open: 'editor' } }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k', TMUX: '/tmp/tmux-1000/default,1,0', HERDR_ENV: '1', HERDR_BIN_PATH: '/opt/herdr/bin/herdr', EDITOR: 'nvim' }, cwd: root, top: '', dirs: { [root]: [['a.md', 'file']] }, status: '', numstat: '' }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await ui.post({ press: `${root}/a.md` }, { in: 'rows' })
  await ui.post({ key: 'o' }, { in: 'rows' })
  await clock.settle()
  expect(ran).toContainEqual(['sh', '-c', TMUX_OPEN, 'sh', `${root}/a.md`, root, '', 'nvim'])
  expect(ran.some(a => a[0] === '/opt/herdr/bin/herdr' && a[1] === 'pane')).toBe(false)
  await ui.unmount()
})

test("open with editor in herdr: a failed split shows herdr's message and sends nothing to a pane", { timeoutMs: 20_000, options: { open: 'editor' } }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k', HERDR_ENV: '1', HERDR_BIN_PATH: '/opt/herdr/bin/herdr', EDITOR: 'nvim' }, cwd: root, top: '', dirs: { [root]: [['a.md', 'file']] }, status: '', numstat: '', exits: { '/opt/herdr/bin/herdr': [1, '{"error":{"code":"pane_not_found","message":"pane w1:p35 not found"},"id":"cli:pane:split"}\n'] } }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await ui.post({ press: `${root}/a.md` }, { in: 'rows' })
  await ui.post({ key: 'o' }, { in: 'rows' })
  await clock.settle()
  expect(ran.filter(a => a[0] === '/opt/herdr/bin/herdr' && a[1] === 'pane').length).toBe(1)
  expect(ran).toContainEqual(['toast', `could not open ${root}/a.md with nvim: pane w1:p35 not found`])
  await ui.unmount()
})

test('macOS: space on a file opens Quick Look, space on a folder still toggles it', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/Users/k/proj'
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: '', dirs: { [root]: [['a b.png', 'file'], ['sub', 'dir']], [`${root}/sub`]: [['c.txt', 'file']] }, status: '', numstat: '' }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await ui.post({ press: `${root}/a b.png` }, { in: 'rows' })
  await clock.settle()
  await ui.post({ key: ' ' }, { in: 'rows' })
  await clock.settle()
  const look = ran.find(a => a[0] === 'sh' && (a[2] ?? '').includes('qlmanage -p'))
  expect(look?.at(-1)).toBe(`${root}/a b.png`)
  expect(ran.some(a => a[0] === 'open')).toBe(false)
  await ui.post({ press: `${root}/sub` }, { in: 'rows' })
  await clock.settle()
  await ui.post({ key: ' ' }, { in: 'rows' })
  await clock.settle()
  expect(ran.filter(a => a[0] === 'sh' && (a[2] ?? '').includes('qlmanage')).length).toBe(1)
  await ui.unmount()
})

test('open with: a double-click and Enter run the configured command instead of the default app, inside tmux too', { timeoutMs: 20_000, options: { open: 'glow -p {path} --dir "{dir}"' } }, async ($, on) => {
  const ran: Ran = []
  const root = '/Users/k/my proj'
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k', TMUX: '/tmp/tmux-501/default,1,0', EDITOR: 'nvim' }, cwd: root, top: '', dirs: { [root]: [['a b.md', 'file'], ['c.md', 'file']] }, status: '', numstat: '', exits: { glow: [1, 'glow: no such file\n'] } }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await ui.post({ press: `${root}/a b.md` }, { in: 'rows' })
  await ui.post({ press: `${root}/a b.md` }, { in: 'rows' })
  await clock.settle()
  expect(ran).toContainEqual(['glow', '-p', `${root}/a b.md`, '--dir', root])
  expect(ran.some(a => a[0] === 'open' || a.includes('nvim'))).toBe(false)
  expect(ran.some(a => a[0] === 'toast' && (a[1] ?? '').includes('glow: no such file'))).toBe(true)
  await ui.post({ key: 'down' }, { in: 'rows' })
  await ui.post({ key: 'return' }, { in: 'rows' })
  await clock.settle()
  expect(ran).toContainEqual(['glow', '-p', `${root}/c.md`, '--dir', root])
  await ui.unmount()
})

test('binary files: default app sends images and documents to the default app, in any case, while code, dotfiles and SVG still go to the Open with editor', { timeoutMs: 20_000, options: { open: 'code -g {path}', binaries: 'default app' } }, async ($, on) => {
  const ran: Ran = []
  const root = '/Users/k/proj'
  const files = ['.env', 'a.ts', 'icon.svg', 'logo.PNG', 'site.tar.gz', 'spec.pdf']
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k', TMUX: '/tmp/tmux-501/default,1,0', EDITOR: 'nvim' }, cwd: root, top: '', dirs: { [root]: files.map(f => [f, 'file']) }, status: '', numstat: '' }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await ui.post({ press: `${root}/${files[0]}` }, { in: 'rows' })
  await ui.post({ press: `${root}/${files[0]}` }, { in: 'rows' })
  await clock.settle()
  for (let i = 1; i < files.length; i++) {
    await ui.post({ key: 'down' }, { in: 'rows' })
    await ui.post({ key: 'return' }, { in: 'rows' })
    await clock.settle()
  }
  expect(ran.filter(a => a[0] === 'code').map(a => a[2])).toEqual([`${root}/.env`, `${root}/a.ts`, `${root}/icon.svg`])
  expect(ran.filter(a => a[0] === 'open').map(a => a[2])).toEqual([`${root}/logo.PNG`, `${root}/site.tar.gz`, `${root}/spec.pdf`])
  expect(ran.some(a => a.includes('nvim'))).toBe(false)
  await ui.unmount()
})

test('open with preview: a double-click shows the file in the pane, left goes back to the tree, arrows scroll, ↗ opens the default app inside tmux, a binary file shows a note', { timeoutMs: 20_000, options: { open: 'preview' } }, async ($, on) => {
  const ran: Ran = []
  const root = '/Users/k/proj'
  const clock = world(on, {
    os: 'darwin', env: { HOME: '/Users/k', TMUX: '/tmp/tmux-501/default,1,0', VISUAL: 'nvim' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['notes.md', 'file'], ['a.ts', 'file'], ['blob.bin', 'file']] },
    files: { [`${root}/notes.md`]: '# Title\r\n\nSome *notes*\u0007', [`${root}/a.ts`]: `const a = 1\n${'a++\n'.repeat(60)}`, [`${root}/blob.bin`]: 'PK\u0000\u0003' },
  }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await ui.post({ press: `${root}/notes.md` }, { in: 'rows' })
  await ui.post({ press: `${root}/notes.md` }, { in: 'rows' })
  await clock.settle()
  let shown = JSON.stringify(await ui.drawn())
  expect(shown).toContain('# Title\\n\\nSome *notes*"')
  expect(shown).not.toContain('a.ts')
  expect(ran.some(a => a[0] === 'open')).toBe(false)
  const sent = await $.prompt.submit({ text: 'what is this?', wait: false, origin: { kind: 'composer' } })
  expect(JSON.stringify(sent)).toContain(`${root}/notes.md`)
  await ui.press({ key: 'back' })
  await clock.settle()
  expect(await texts(ui)).toContain('a.ts')
  await ui.post({ press: `${root}/a.ts` }, { in: 'rows' })
  await ui.post({ press: `${root}/a.ts` }, { in: 'rows' })
  await clock.settle()
  shown = JSON.stringify(await ui.drawn())
  expect(shown).toContain('const a = 1')
  expect(shown).toContain('"startLine":1')
  await ui.post({ key: 'down' }, { in: 'rows' })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).toContain('"startLine":2')
  await ui.post({ key: 'q' }, { in: 'rows' })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).toContain('"startLine":2')
  await ui.post({ key: 'left' }, { in: 'rows' })
  await clock.settle()
  expect(await texts(ui)).toContain('notes.md')
  await ui.post({ press: `${root}/a.ts` }, { in: 'rows' })
  await ui.post({ press: `${root}/a.ts` }, { in: 'rows' })
  await clock.settle()
  await ui.press({ key: 'external' })
  await clock.settle()
  expect(ran).toContainEqual(['open', '--', `${root}/a.ts`])
  await ui.press({ key: 'back' })
  await ui.post({ press: `${root}/blob.bin` }, { in: 'rows' })
  await ui.post({ press: `${root}/blob.bin` }, { in: 'rows' })
  await clock.settle()
  shown = JSON.stringify(await ui.drawn())
  expect(shown).toContain('binary file')
  expect(shown).not.toContain('PK')
  await ui.post({ key: 'left' }, { in: 'rows' })
  await clock.settle()
  expect(await texts(ui)).toContain('notes.md')
  await ui.unmount()
})

for (const [edit, env, expected] of [
  ['', { HOME: '/Users/k', TMUX: '/tmp/tmux-501/default,1,0', VISUAL: 'nvim' }, ['sh', '-c', TMUX_OPEN, 'sh', '/Users/k/proj/a.ts', '/Users/k/proj', '3', 'nvim']],
  ['code -g {path}:{line}', { HOME: '/Users/k' }, ['code', '-g', '/Users/k/proj/a.ts:3']],
  ['', { HOME: '/Users/k', HERDR_ENV: '1', HERDR_BIN_PATH: '/opt/herdr/bin/herdr', VISUAL: 'nvim' }, ['/opt/herdr/bin/herdr', 'pane', 'run', 'w1:p37', `exec 'nvim' '+3' "$PANE_OPEN_TARGET"`]],
  ['', { HOME: '/Users/k', VISUAL: 'nvim' }, null],
] as const) {
  test(`open with preview: Ctrl+F/B and the f/b/j/k buttons scroll, e opens the file at the top line shown, Edit with "${edit}"${'TMUX' in env ? ' in tmux' : 'HERDR_ENV' in env ? ' in herdr' : ''}`, { timeoutMs: 20_000, options: { open: 'preview', edit } }, async ($, on) => {
    const ran: Ran = []
    const root = '/Users/k/proj'
    const clock = world(on, { os: 'darwin', env, cwd: root, top: '', status: '', numstat: '', dirs: { [root]: [['a.ts', 'file']] }, files: { [`${root}/a.ts`]: `const a = 1\n${'a++\n'.repeat(200)}` }, stdout: { '/opt/herdr/bin/herdr pane split': HERDR_SPLIT } }, ran)
    await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
    await ui.post({ press: `${root}/a.ts` }, { in: 'rows' })
    await ui.post({ press: `${root}/a.ts` }, { in: 'rows' })
    await ui.post({ key: 'down' }, { in: 'rows' })
    await ui.post({ key: 'down' }, { in: 'rows' })
    await ui.post({ key: 'f', ctrl: true }, { in: 'rows' })
    await clock.settle()
    const top = async () => Number(/"startLine":(\d+)/.exec(JSON.stringify(await ui.drawn()))?.[1])
    expect(await top()).toBeGreaterThan(4)
    await ui.post({ key: 'b', ctrl: true }, { in: 'rows' })
    await clock.settle()
    expect(await top()).toBe(3)
    await ui.post({ key: 'f' }, { in: 'rows' })
    await clock.settle()
    expect(await top()).toBeGreaterThan(4)
    await ui.post({ key: 'b' }, { in: 'rows' })
    await clock.settle()
    expect(await top()).toBe(3)
    await ui.press({ key: 'pv-f' })
    await clock.settle()
    expect(await top()).toBeGreaterThan(4)
    await ui.press({ key: 'pv-b' })
    await ui.press({ key: 'pv-j' })
    await ui.press({ key: 'pv-k' })
    await clock.settle()
    expect(await top()).toBe(3)
    if (expected !== null) expect(JSON.stringify(await ui.drawn())).toContain('"label":"edit :3"')
    if (expected === null) {
      expect(await ui.find({ key: 'edit' })).toBeUndefined()
      await ui.post({ key: 'e' }, { in: 'rows' })
      await clock.settle()
      expect(ran.some(a => a.includes('nvim') || a[0] === 'code')).toBe(false)
    } else {
      await ui.post({ key: 'e' }, { in: 'rows' })
      await clock.settle()
      expect(ran).toContainEqual([...expected])
      const before = ran.length
      await ui.press({ key: 'edit' })
      await clock.settle()
      expect(ran.slice(before)).toContainEqual([...expected])
    }
    await ui.unmount()
  })
}

test('open with on linux: the command runs detached, like the default opener, a PDF included by default', { timeoutMs: 20_000, options: { open: 'evince {path}' } }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.pdf', 'file']] }, status: '', numstat: '' }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await ui.post({ press: `${root}/a.pdf` }, { in: 'rows' })
  await ui.post({ press: `${root}/a.pdf` }, { in: 'rows' })
  await clock.settle()
  expect(ran).toContainEqual(['sh', '-c', LINUX_LAUNCH, 'sh', 'evince', `${root}/a.pdf`])
  await ui.unmount()
})

test('open with preview: End shows the last screen, an edit reloads the file, a fence the window starts in is reopened, and a new session starts on the tree', { timeoutMs: 20_000, options: { open: 'preview' } }, async ($, on) => {
  const root = '/Users/k/proj'
  const body = Array.from({ length: 60 }, (_, i) => `line ${i}`)
  const doc = ['# Doc', '~~~sh', '```', ...body, '~~~', 'after'].join('\n')
  const w: World = { os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: '', status: '', numstat: '', dirs: { [root]: [['a.ts', 'file'], ['doc.md', 'file']] }, files: { [`${root}/a.ts`]: body.join('\n'), [`${root}/doc.md`]: doc } }
  const clock = world(on, w, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const props = { ...paneProps(60), scroll: { offset: 0, bodyRows: 20 } }
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props })
  await ui.post({ press: `${root}/a.ts` }, { in: 'rows' })
  await ui.post({ press: `${root}/a.ts` }, { in: 'rows' })
  await clock.settle()
  await ui.post({ key: 'end' }, { in: 'rows' })
  await clock.settle()
  let shown = JSON.stringify(await ui.drawn())
  expect(shown).toContain('"startLine":43')
  expect(shown).toContain('line 59')
  w.files![`${root}/a.ts`] = 'changed\n'
  await $.tool.call({ tool: 'Edit', file_path: `${root}/a.ts`, old_string: 'a', new_string: 'b' })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).toContain('changed')
  await ui.post({ key: 'left' }, { in: 'rows' })
  await ui.post({ press: `${root}/doc.md` }, { in: 'rows' })
  await ui.post({ press: `${root}/doc.md` }, { in: 'rows' })
  await clock.settle()
  await ui.post({ key: 'down' }, { in: 'rows' })
  await ui.post({ key: 'down' }, { in: 'rows' })
  await ui.post({ key: 'down' }, { in: 'rows' })
  await ui.post({ key: 'down' }, { in: 'rows' })
  await clock.settle()
  shown = JSON.stringify(await ui.drawn())
  expect(shown).toContain('"text":"~~~sh\\nline 1')
  await ui.unmount()
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const again = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props })
  await clock.settle()
  expect(await texts(again)).toContain('doc.md')
  await again.unmount()
})

test('open with preview on desktop: the whole file is drawn and the wheel goes to the app', { timeoutMs: 20_000, options: { open: 'preview' } }, async ($, on) => {
  const root = '/Users/k/proj'
  const body = Array.from({ length: 200 }, (_, i) => `line ${i}`).join('\n')
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: '', status: '', numstat: '', dirs: { [root]: [['a.ts', 'file']] }, files: { [`${root}/a.ts`]: body } }, [])
  const appScrolls: number[] = []
  on('ui.scroll', (_$, e) => (appScrolls.push(e.by), {}))
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const props = { ...paneProps(60), scroll: { offset: 0, bodyRows: 20 } }
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props })
  await ui.post({ press: `${root}/a.ts` }, { in: `hit:${root}/a.ts` })
  await ui.post({ press: `${root}/a.ts` }, { in: `hit:${root}/a.ts` })
  await clock.settle()
  const shown = JSON.stringify(await ui.drawn())
  expect(shown).toContain('line 0')
  expect(shown).toContain('line 199')
  const wheel = { component: 'Pane', requestId: 'filetree', by: 5, offset: 5, bodyRows: 20, contentRows: 202, origin: { kind: 'person' } } satisfies UiScrollInput
  expect(await $.ui.scroll(wheel)).toEqual({})
  expect(appScrolls).toEqual([5])
  await ui.unmount()
})

test('open with preview on desktop: the file is drawn by the pane itself, with no Client between', { timeoutMs: 20_000, options: { open: 'preview' } }, async ($, on) => {
  const root = '/Users/k/proj'
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: '', status: '', numstat: '', dirs: { [root]: [['a.md', 'file'], ['a.ts', 'file']] }, files: { [`${root}/a.md`]: '# Title\n\nSome prose.', [`${root}/a.ts`]: 'const a = 1' } }, [])
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const props = { ...paneProps(60), scroll: { offset: 0, bodyRows: 20 } }
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props })
  for (const file of ['a.md', 'a.ts']) {
    await ui.post({ press: `${root}/${file}` }, { in: `hit:${root}/${file}` })
    await ui.post({ press: `${root}/${file}` }, { in: `hit:${root}/${file}` })
    await clock.settle()
    const shown = JSON.stringify(await ui.drawn())
    expect(shown).toContain(file === 'a.md' ? '"type":"Markdown"' : '"type":"Code"')
    expect(shown).not.toContain('"key":"rows"')
    await ui.press({ key: 'back' })
    await clock.settle()
  }
  await ui.unmount()
})

test('an older directory listing never overwrites a newer one', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/scratch'
  const w: World = { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['old.txt', 'file']] }, status: '', numstat: '', delays: {} }
  const clock = world(on, w, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  w.delays = { [root]: [1_000] }
  await ui.press({ key: 'refresh' })
  w.dirs[root] = [['new.txt', 'file']]
  await ui.press({ key: 'refresh' })
  await clock.settle()
  expect(await texts(ui)).toContain('new.txt')
  await clock.advance(1_500)
  const shown = await texts(ui)
  expect(shown).toContain('new.txt')
  expect(shown).not.toContain('old.txt')
  await ui.unmount()
})

test('a listing error keeps the cached rows and says so', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/scratch'
  const w: World = { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.txt', 'file']] }, status: '', numstat: '' }
  const clock = world(on, w, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  w.denied = [root]
  await ui.press({ key: 'refresh' })
  await clock.settle()
  expect(await texts(ui)).toContain(`"id":"${root}/a.txt"`)
  expect(ran.some(a => a[0] === 'toast' && (a[1] ?? '').includes('could not list'))).toBe(true)
  await ui.unmount()
})

test('replacing many folders in one batch keeps unchanged nodes and drops what vanished', () => {
  const dir = (id: string, loaded: boolean) => ({ id, parent: id.slice(0, id.lastIndexOf('/')) || '/', name: id.slice(id.lastIndexOf('/') + 1), kind: 'dir' as const, hidden: false, mtime: 0, size: 0, loaded })
  const file = (id: string) => ({ ...dir(id, false), kind: 'file' as const })
  const nodes = [dir('/r/a', true), dir('/r/b', true), file('/r/a/x'), dir('/r/b/y', true), file('/r/b/y/z')]
  const out = replaceChildren(nodes, new Map([
    ['/r/a', toNodes('/r/a', [{ name: 'w', kind: 'file', size: 0, mtimeMs: 0, isLink: false }])],
    ['/r/b', []],
    ['/r/b/y', toNodes('/r/b/y', [{ name: 'z', kind: 'file', size: 0, mtimeMs: 0, isLink: false }])],
  ]))
  expect(out.map(n => n.id).sort()).toEqual(['/r/a', '/r/a/w', '/r/b'])
  expect(out.find(n => n.id === '/r/b')?.loaded).toBe(true)
})

test('a cwd change moves the tree and drops the old selection before the next prompt', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const a = '/home/k/repo-a'
  const b = '/home/k/repo-b'
  const c = '/home/k/repo-c'
  const w: World = { os: 'linux', env: { HOME: '/home/k' }, cwd: a, top: '', dirs: { [a]: [['a.txt', 'file']], [b]: [['b.txt', 'file']], [c]: [['c.txt', 'file']] }, status: '', numstat: '' }
  const clock = world(on, w, ran)
  await $.session.start({ cwd: a, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await ui.post({ press: `${a}/a.txt` }, { in: 'rows' })
  await clock.settle()
  w.cwd = b
  const sent = await $.prompt.submit({ text: 'what is this?', wait: false, origin: { kind: 'composer' } })
  expect(JSON.stringify(sent)).not.toContain(`${a}/a.txt`)
  await clock.settle()
  expect(await texts(ui)).toContain('b.txt')
  w.cwd = c
  await $.tool.call({ tool: 'Bash', command: `cd ${c}` })
  await clock.advance(500)
  await clock.settle()
  expect(await texts(ui)).toContain('c.txt')
  w.cwd = a
  await clock.advance(2100)
  await clock.settle()
  expect(await texts(ui)).toContain('a.txt')
  await ui.unmount()
})

test('open at start off: no pane at start, on a cwd change or a prompt, until /filetree opens it', { timeoutMs: 20_000, options: { start: 'off' } }, async ($, on) => {
  const ran: Ran = []
  const a = '/home/k/repo-a'
  const b = '/home/k/repo-b'
  const c = '/home/k/repo-c'
  const w: World = { os: 'linux', env: { HOME: '/home/k' }, cwd: a, top: '', dirs: { [a]: [['a.txt', 'file']], [b]: [['b.txt', 'file']], [c]: [['c.txt', 'file']] }, status: '', numstat: '' }
  const clock = world(on, w, ran)
  const before = opens.length
  await $.session.start({ cwd: a, surface: 'terminal', isInteractive: true })
  await clock.settle()
  w.cwd = b
  await $.prompt.submit({ text: 'look at @b.txt', wait: false, origin: { kind: 'composer' } })
  await clock.settle()
  w.cwd = c
  await $.tool.call({ tool: 'Bash', command: `cd ${c}` })
  await clock.advance(500)
  await clock.settle()
  await $.session.start({ cwd: c, surface: 'terminal', isInteractive: true })
  await clock.settle()
  expect(opens.length).toBe(before)
  await $.command.run(fullscreen(''))
  await clock.settle()
  expect(opens.slice(before)).toContainEqual(expect.objectContaining({ id: 'filetree', focus: true }))
  const shown = opens.length
  w.cwd = a
  await $.tool.call({ tool: 'Bash', command: `cd ${a}` })
  await clock.advance(500)
  await clock.settle()
  expect(opens.length).toBeGreaterThan(shown)
})

test('a background git push stays running until its task notification arrives', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [root]: [['a.txt', 'file']] }, status: '## main\0', numstat: '',
    tool: e => ({ result: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: has(e, 'command') && e.command === 'git push' ? 'b1' : 'b2' } }),
  }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await $.tool.call({ tool: 'Bash', command: 'git push', run_in_background: true })
  await clock.settle()
  expect(await texts(ui)).toContain('pushing…')
  expect(await texts(ui)).not.toContain('pushed')
  await $.prompt.submit({ text: '<task-notification>\n<task-id>b1</task-id>\n<status>completed</status>\n<summary>Background command "git push" completed (exit code 0)</summary>\n</task-notification>', wait: false, origin: { kind: 'composer' } })
  await clock.settle()
  expect(await texts(ui)).toContain('pushed')
  await $.tool.call({ tool: 'Bash', command: 'git pull', run_in_background: true })
  await clock.settle()
  await $.prompt.submit({ text: '<task-notification>\n<task-id>b2</task-id>\n<status>failed</status>\n<summary>Background command "git pull" failed with exit code 1</summary>\n</task-notification>', wait: false, origin: { kind: 'composer' } })
  await clock.settle()
  expect(await texts(ui)).toContain('pull failed')
  await ui.unmount()
})

test('a failed Bash command still refreshes what it changed before failing', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const w: World = { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [root]: [['a.txt', 'file'], ['b.txt', 'file']] }, status: '## main\0', numstat: '', tool: () => ({ isError: true, result: 'Exit code 1' }) }
  const clock = world(on, w, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  expect(await texts(ui)).toContain(`"id":"${root}/a.txt"`)
  const before = ran.filter(a => a.includes('status')).length
  w.dirs[root] = [['b.txt', 'file']]
  await $.tool.call({ tool: 'Bash', command: 'rm a.txt && false' })
  await clock.settle()
  expect(ran.filter(a => a.includes('status')).length).toBeGreaterThan(before)
  expect(await texts(ui)).not.toContain(`"id":"${root}/a.txt"`)
  await ui.unmount()
})

test('git activity is only certified by evidence: HEAD for commits, the exit code only for plain && chains', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const w: World = { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [root]: [['a.txt', 'file']] }, status: '## main\0', numstat: '', heads: ['abc1234def0'] }
  const clock = world(on, w, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await $.tool.call({ tool: 'Bash', command: 'git commit -m test || true' })
  await clock.settle()
  let shown = await texts(ui)
  expect(shown).toContain('commit failed')
  expect(shown).not.toContain('committed')
  expect(ran.some(a => a.includes('diff-tree'))).toBe(false)
  w.heads = ['abc1234def0', 'fed4321cba9']
  await $.tool.call({ tool: 'Bash', command: 'git commit -m real' })
  await clock.settle()
  shown = await texts(ui)
  expect(shown).toContain('committed')
  expect(shown).toContain('fed4321')
  await $.tool.call({ tool: 'Bash', command: 'git push; echo done' })
  await clock.settle()
  expect(await texts(ui)).toContain('ran git push')
  await $.tool.call({ tool: 'Bash', command: 'git fetch && git status' })
  await clock.settle()
  expect(await texts(ui)).toContain('fetched')
  await ui.unmount()
})

test('unknown git verbs count as writers and read-only commands skip git work', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const w: World = { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [root]: [['README.md', 'file'], ['gone.txt', 'file']] }, status: '## main\0', numstat: '' }
  const clock = world(on, w, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  const statuses = () => ran.filter(a => a[0] === 'git' && a.includes('status')).length
  let before = statuses()
  await $.tool.call({ tool: 'Bash', command: 'cat README.md' })
  await $.tool.call({ tool: 'Bash', command: 'git status' })
  await clock.settle()
  expect(statuses()).toBe(before)
  expect(ran.some(a => a[0] === 'find')).toBe(false)
  w.dirs[root] = [['README.md', 'file']]
  before = statuses()
  await $.tool.call({ tool: 'Bash', command: 'git clean -fd' })
  await clock.settle()
  expect(statuses()).toBeGreaterThan(before)
  expect(ran.some(a => a[0] === 'find')).toBe(true)
  expect(await texts(ui)).not.toContain('gone.txt')
  await ui.unmount()
})

test('search matches relative paths, and a refresh or a click in the tree picks up files added since the index was built', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const w: World = { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [root]: [['src', 'dir'], ['alpha.txt', 'file']], [`${root}/src`]: [['a.ts', 'file']] }, status: '## main\0', numstat: '' }
  const clock = world(on, w, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await ui.input({ key: 'q', text: 'src/a.ts', kind: 'change' })
  await clock.settle()
  expect(await texts(ui)).toContain(`"id":"${root}/src/a.ts"`)
  await ui.input({ key: 'q', text: 'alpha', kind: 'change' })
  await clock.settle()
  w.dirs[`${root}/src`] = [['a.ts', 'file'], ['beta.ts', 'file']]
  await ui.press({ key: 'refresh' })
  await ui.input({ key: 'q', text: 'beta', kind: 'change' })
  await clock.settle()
  expect(await texts(ui)).toContain(`"id":"${root}/src/beta.ts"`)
  w.dirs[`${root}/src`] = [['a.ts', 'file'], ['beta.ts', 'file'], ['gamma.ts', 'file']]
  await clock.advance(2_500)
  await ui.post({ key: 'down' }, { in: 'rows' })
  await clock.settle()
  await ui.input({ key: 'q', text: 'gamma', kind: 'change' })
  await clock.settle()
  expect(await texts(ui)).toContain(`"id":"${root}/src/gamma.ts"`)
  await ui.unmount()
})

test('a pinned path with dot segments resolves to the same folder', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: '/home/k', top: '', dirs: { [root]: [['a.ts', 'file']], [`${root}/src`]: [] }, status: '', numstat: '' }, ran)
  await $.session.start({ cwd: '/home/k', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const r = await $.command.run(fullscreen(`${root}/./src/..`))
  expect(JSON.stringify(r)).toContain('File tree on ~/proj.')
})

test('a written file whose name holds a newline still shimmers', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/scratch'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a\nb.ts', 'file'], ['c.txt', 'file']] }, status: '', numstat: '', find: `${root}/a\nb.ts\0` }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await $.tool.call({ tool: 'Bash', command: 'touch "a\nb.ts"' })
  await clock.settle()
  expect(ran.find(a => a[0] === 'find')).toContain('-print0')
  expect(await texts(ui)).toContain(shimmer('a\nb.ts', 'orange'))
  await ui.unmount()
})

test('the pane draws in the terminal\'s own colours: no background, ANSI palette names, and an Omarchy theme file is never read', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const w: World = { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [root]: [['a.ts', 'file'], ['sub', 'dir']] }, status: '## main\0 M a.ts\0', numstat: '', theme: { toml: 'background = "#1e1e2e"\ndark_background = "#161622"\n', mtimeMs: 1 } }
  const clock = world(on, w, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await clock.advance(10_000)
  await clock.settle()
  const shown = await texts(ui)
  expect(ran.some(a => a[0] === 'theme-stat')).toBe(false)
  expect(shown).not.toContain('"backgroundColor":"#')
  expect(shown).toContain('"activeBg":"ansi256(238)","hoverBg":""')
  for (const c of ['ansi256(4)', 'ansi256(3)']) expect(shown).toContain(`"color":"${c}"`)
  await ui.unmount()
})

test('the palette setting overrides the terminal colours key by key and names an entry it cannot read', { timeoutMs: 20_000, options: { palette: 'bg=#1d2021 accent=#83a598 nope=#fff muted=gray selection=#fff' } }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const w: World = { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.ts', 'file'], ['sub', 'dir']] }, status: '', numstat: '' }
  const clock = world(on, w, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const shown = await texts(ui)
  expect(shown).toContain('"backgroundColor":"#1d2021"')
  expect(shown).not.toContain('#161622')
  expect(shown).toContain('#83a598')
  expect(shown).toContain('"activeBg":"#ffffff"')
  expect(shown).not.toContain('#1b1f67')
  const toast = ran.find(a => a[0] === 'toast' && a[1]?.includes('filetree palette'))
  expect(toast?.[1]).toContain('nope=#fff muted=gray')
  await ui.unmount()
})

test('a light theme setting only changes the activity colours; the tree keeps the terminal palette on both surfaces', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/Users/k/proj'
  const clock = world(on, {
    os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: root,
    dirs: { [root]: [['a.ts', 'file'], ['b.ts', 'file']] },
    status: '## main\0 M a.ts\0?? b.ts\0', numstat: '3\t1\ta.ts\0',
  }, ran)
  on('config.list', () => ({ value: [{ key: 'theme', label: 'Theme', kind: 'choice', value: 'light-daltonized', provider: { plugin: 'engine', tier: 'core' }, isLocked: false }] }))
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const light = await texts(ui)
  expect(light).toContain('"activeBg":"ansi256(252)"')
  for (const c of ['ansi256(3)', 'ansi256(2)']) expect(light).toContain(`"color":"${c}"`)
  expect(light).toMatch(/"color":"ansi256\(3\)","dimColor":false\},"children":\[" 2023-11-1\d \d\d:\d\d"\]/)
  expect(light).not.toContain('ansi256(8)')
  expect(light).toContain('#431407')
  await ui.unmount()
  const desktop = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const drawnDesk = await texts(desktop)
  expect(drawnDesk).not.toContain('#431407')
  expect(drawnDesk).toContain('"type":"Svg"')
  await desktop.unmount()
})

test('formatSize: at most three digits, unit glued on, ? for unknown', () => {
  expect(formatSize(0)).toBe('0B')
  expect(formatSize(980)).toBe('980B')
  expect(formatSize(1023)).toBe('1.0K')
  expect(formatSize(1536)).toBe('1.5K')
  expect(formatSize(412 * 1024)).toBe('412K')
  expect(formatSize(6.2 * 1024 * 1024)).toBe('6.2M')
  expect(formatSize(12 * 1024 ** 3)).toBe('12G')
  expect(formatSize(-1)).toBe('?')
})

test('age: now, minutes, hours and days, then the day past a week and the year past a year', () => {
  const now = new Date(2026, 9, 12, 10, 42).getTime()
  const ago = (s: number) => now - s * 1000
  expect(age(0, now)).toBe('')
  expect(age(ago(30), now)).toBe('now')
  expect(age(now + 20_000, now)).toBe('now')
  expect(age(ago(12 * 60), now)).toBe('12m')
  expect(age(ago(3600 - 1), now)).toBe('59m')
  expect(age(ago(3 * 3600 + 59), now)).toBe('3h')
  expect(age(ago(5 * 86_400), now)).toBe('5d')
  expect(age(new Date(2026, 9, 3, 9).getTime(), now)).toBe('Oct 3')
  expect(age(new Date(2025, 10, 20).getTime(), now)).toBe('Nov 20')
  expect(age(new Date(2025, 9, 9).getTime(), now)).toBe('2025')
  expect(age(new Date(2027, 0, 1).getTime(), now)).toBe('Jan 1')
})

test('size column: the toggle swaps dates for sizes, folders are sized with du, an edit re-sizes its folders', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root,
    dirs: { [root]: [['src', 'dir'], ['README.md', 'file']], [`${root}/src`]: [['a.ts', 'file']] },
    status: '## main\0', numstat: '',
    du: { [`${root}/src`]: `2048\t${root}/src\n` },
  }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  expect(await texts(ui)).toMatch(STAMP)
  expect(ran.some(a => a[0] === 'du')).toBe(false)
  await ui.press({ key: 'size' })
  await clock.settle()
  const sized = await texts(ui)
  expect(sized).not.toMatch(STAMP)
  expect(sized).toContain('1 B ')
  expect(sized).toContain('2.0 MB')
  expect(ran).toContainEqual(['du', '-skxH', `${root}/src`])
  const before = ran.filter(a => a[0] === 'du').length
  await $.tool.call({ tool: 'Edit', file_path: `${root}/src/a.ts`, old_string: 'a', new_string: 'b' })
  await clock.settle()
  await ui.press({ key: 'refresh' })
  await clock.settle()
  expect(ran.filter(a => a[0] === 'du').length).toBeGreaterThan(before)
  await ui.press({ key: 'size' })
  await clock.settle()
  expect(await texts(ui)).not.toMatch(STAMP)
  await ui.press({ key: 'size' })
  await clock.settle()
  expect(await texts(ui)).toContain('# Files')
  await ui.press({ key: 'size' })
  await clock.settle()
  expect(await texts(ui)).toMatch(STAMP)
  await ui.unmount()
})

test('loc column: the toggle goes date, size, lines of code; code files show their count, folders the sum, pictures nothing, an edit counts its folders again, and the treemap weighs boxes by lines', { timeoutMs: 20_000, options: { column: 'size' } }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const w: World = {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root,
    dirs: { [root]: [['src', 'dir'], ['docs', 'dir'], ['README.md', 'file'], ['logo.png', 'file']], [`${root}/src`]: [['a.ts', 'file'], ['b.ts', 'file']], [`${root}/docs`]: [['guide.md', 'file']] },
    status: '## main\0', numstat: '',
    loc: {
      [`${root} 1`]: `${root}/README.md:12\n${root}/logo.png:0\n`,
      [root]: `${root}/README.md:12\n${root}/logo.png:0\n${root}/src/a.ts:1500\n${root}/src/b.ts:300\n${root}/docs/guide.md:40\n`,
      [`${root}/src`]: `${root}/src/a.ts:1500\n${root}/src/b.ts:300\n`,
      [`${root}/docs`]: `${root}/docs/guide.md:40\n`,
    },
  }
  const clock = world(on, w, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.press({ key: 'size' })
  await clock.settle()
  const shown = await texts(ui)
  expect(shown).not.toMatch(STAMP)
  expect(shown).toContain('1.80k')
  expect(shown).toContain(' 40')
  expect(shown).toContain(' 12')
  const logo = rowsProps(clientProps(await ui.drawn(), 'rows')).rows.find(r => r.id === `${root}/logo.png`)?.right.map(x => x.t).join("")
  expect(logo).not.toMatch(/\d/)
  const finds = () => ran.filter(a => a[0] === 'find' && a.includes('grep')).length
  expect(ran.some(a => a[0] === 'find' && a.includes('grep') && a.includes('-maxdepth'))).toBe(true)
  const before = finds()
  w.loc = { ...w.loc, [`${root}/src`]: `${root}/src/a.ts:1500\n${root}/src/b.ts:900\n` }
  await $.tool.call({ tool: 'Edit', file_path: `${root}/src/b.ts`, old_string: 'a', new_string: 'b' })
  await clock.settle()
  await clock.settle()
  expect(finds()).toBeGreaterThan(before)
  expect(await texts(ui)).toContain('2.40k')
  await ui.press({ key: 'split' })
  await clock.settle()
  const map = mapAt(await ui.drawn()).rows.map(r => r.left.map(x => x.t).join('')).join('\n')
  expect(map).toContain('src 1.80k')
  expect(JSON.stringify(await ui.drawn())).toContain(' lines')
  await ui.press({ key: 'size' })
  await clock.settle()
  expect(await texts(ui)).toContain('# Files')
  await ui.press({ key: 'size' })
  await clock.settle()
  expect(await texts(ui)).toMatch(STAMP)
  await ui.unmount()
})

test('size column on Windows sums file sizes with fs.list instead of du', { timeoutMs: 20_000, options: { column: 'size' } }, async ($, on) => {
  const ran: Ran = []
  const root = 'C:/Users/k/proj'
  const clock = world(on, {
    os: 'win32', env: { OS: 'Windows_NT', USERPROFILE: 'C:\\Users\\k' }, cwd: root, top: '',
    dirs: { [root]: [['src', 'dir']], [`${root}/src`]: [['a.ts', 'file'], ['b.ts', 'file'], ['lib', 'dir']], [`${root}/src/lib`]: [['c.ts', 'file']] },
    status: '', numstat: '',
  }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  expect(await texts(ui)).toContain('3 B ')
  expect(ran.some(a => a[0] === 'du')).toBe(false)
  await ui.unmount()
})

test('a folder whose size job goes stale mid-run is sized again instead of waiting forever', { timeoutMs: 20_000, options: { column: 'size' } }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root,
    dirs: { [root]: [['src', 'dir']], [`${root}/src`]: [['a.ts', 'file']] },
    status: '## main\0', numstat: '',
    du: { [`${root}/src`]: `2048\t${root}/src\n` },
    duDelays: [1_000],
  }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await $.tool.call({ tool: 'Edit', file_path: `${root}/src/a.ts`, old_string: 'a', new_string: 'b' })
  await clock.settle()
  await clock.advance(1_500)
  await clock.settle()
  expect(await texts(ui)).toContain('2.0 MB')
  await ui.unmount()
})

test('on Windows a folder size does not walk into linked folders, like du', { timeoutMs: 20_000, options: { column: 'size' } }, async ($, on) => {
  const ran: Ran = []
  const root = 'C:/Users/k/proj'
  const clock = world(on, {
    os: 'win32', env: { OS: 'Windows_NT', USERPROFILE: 'C:\\Users\\k' }, cwd: root, top: '',
    dirs: { [root]: [['src', 'dir']], [`${root}/src`]: [['a.ts', 'file'], ['b.ts', 'file'], ['back', 'dir']], [`${root}/src/back`]: [['x', 'file'], ['y', 'file'], ['z', 'file'], ['w', 'file']] },
    links: ['/Users/k/proj/src/back'],
    status: '', numstat: '',
  }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const shown = await texts(ui)
  expect(shown).toContain('2 B ')
  expect(shown).not.toContain('6 B ')
  await ui.unmount()
})

test('age column: files show how long ago they changed, the toggle swaps ages for sizes and back, and the ages move on with the clock', { timeoutMs: 20_000, options: { column: 'age' } }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const now = 1_800_000_000_000
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root,
    dirs: { [root]: [['fresh.md', 'file'], ['recent.ts', 'file'], ['README.md', 'file']] },
    mtimes: { [`${root}/fresh.md`]: now - 30_000, [`${root}/recent.ts`]: now - 12 * 60_000 },
    status: '## main\0', numstat: '',
  }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  let shown = await texts(ui)
  expect(shown).not.toMatch(STAMP)
  for (const label of [' now', ' 12m', ' 2023']) expect(shown).toContain(label)
  await ui.press({ key: 'size' })
  await clock.settle()
  shown = await texts(ui)
  expect(shown).toContain('1 B ')
  expect(shown).not.toContain(' 12m')
  await ui.press({ key: 'size' })
  await clock.settle()
  expect(await texts(ui)).not.toContain(' 12m')
  await ui.press({ key: 'size' })
  await clock.settle()
  expect(await texts(ui)).not.toContain(' 12m')
  await ui.press({ key: 'size' })
  await clock.settle()
  expect(await texts(ui)).toContain(' 12m')
  await clock.advance(3 * 60_000)
  await clock.settle()
  shown = await texts(ui)
  expect(shown).toContain(' 3m')
  expect(shown).toContain(' 15m')
  await ui.unmount()
})

for (const hints of ['on', 'off'] as const) {
  test(`hints ${hints}: outside a repo the git init line ${hints === 'on' ? 'shows' : 'is hidden and the tree takes its row'}`, { timeoutMs: 20_000, options: { hints } }, async ($, on) => {
    const root = '/home/k/big'
    const names = Array.from({ length: 60 }, (_, i): [string, 'file'] => [`f${String(i).padStart(2, '0')}.txt`, 'file'])
    const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: names }, status: '', numstat: '' }, [])
    await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: { ...paneProps(60), scroll: { offset: 0, bodyRows: 20 } } })
    await clock.settle()
    const drawn = await ui.drawn()
    expect(JSON.stringify(drawn).includes('not a Git repo')).toBe(hints === 'on')
    expect(treeRows(drawn).rows.length).toBe(hints === 'on' ? 14 : 15)
    await ui.unmount()
  })
}

test('spacing off and shortcuts off drop the blank lines and the shortcut row, and the tree gets them back except the header row and the row kept for hover hints', { timeoutMs: 20_000, options: { hints: 'off', spacing: 'off', shortcuts: 'off' } }, async ($, on) => {
  const root = '/home/k/big'
  const names = Array.from({ length: 60 }, (_, i): [string, 'file'] => [`f${String(i).padStart(2, '0')}.txt`, 'file'])
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: names }, status: '', numstat: '' }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: { ...paneProps(60), scroll: { offset: 0, bodyRows: 20 } } })
  await clock.settle()
  const drawn = await ui.drawn()
  expect(treeRows(drawn).rows.length).toBe(16)
  expect(await ui.find({ key: 'nav-j' })).toBeUndefined()
  expect(await ui.find({ key: 'gap-above' })).toBeUndefined()
  await ui.post({ key: 'j' }, { in: 'rows' })
  await clock.settle()
  const after = await ui.drawn()
  expect(treeRows(after).active).toBe(`${root}/f01.txt`)
  await ui.unmount()
})

const shortcutText = (tree: unknown) => treeRows(tree).rows.map(r => r.left.map(x => x.t).join('')).join('\n')

test('the footer names the entry under the cursor, and ? toggles a grouped shortcuts overlay in the tree body with no timer', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [root]: [['src', 'dir'], ['README.md', 'file'], ['notes.md', 'file']] }, status: '## main\0', numstat: '' }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: { ...paneProps(60), scroll: { offset: 0, bodyRows: 60 } } })
  await clock.settle()
  await ui.post({ press: `${root}/README.md` }, { in: 'rows' })
  await clock.settle()
  expect(await texts(ui)).toMatch(/"truncate-start"},"children":\["README.md"\]/)
  await ui.post({ key: 'k' }, { in: 'rows' })
  await clock.settle()
  await ui.post({ key: 'k' }, { in: 'rows' })
  await clock.settle()
  expect(await texts(ui)).toMatch(/"truncate-start"},"children":\["src"\]/)
  expect(shortcutText(await ui.drawn())).not.toContain('Keyboard shortcuts')
  await ui.post({ key: '?' }, { in: 'rows' })
  await clock.settle()
  const open = shortcutText(await ui.drawn())
  for (const word of ['Keyboard shortcuts', 'Move', 'Search', 'Files and actions', 'View', 'Pane', 'v / V', 'y / Y', 'n / g / m', 'c / r', 'f / b', '[ / ]', 'search file contents', 'ctrl+x tab', 'give the pane the keyboard', 'alt+l', 'alt+h', '/filetree keys', 'set up alt+l and alt+h', 'Esc', 'back to the prompt']) expect(open).toContain(word)
  for (const key of ['u', 't', 'x', 'w', 'd', 'z', 'i', 's', 'p', 'a']) expect(open).toMatch(new RegExp(`\n   ${key} +\\S`))
  expect(treeRows(await ui.drawn()).active).toBe('')
  expect(await ui.find({ key: 'nav-d' })).toBeUndefined()
  await clock.advance(20_000)
  expect(shortcutText(await ui.drawn())).toContain('Keyboard shortcuts')
  await ui.post({ key: 'j' }, { in: 'rows' })
  await clock.settle()
  expect(shortcutText(await ui.drawn())).toContain('Keyboard shortcuts')
  await ui.post({ key: '?' }, { in: 'rows' })
  await clock.settle()
  expect(shortcutText(await ui.drawn())).not.toContain('Keyboard shortcuts')
  expect(treeRows(await ui.drawn()).active).toBe(`${root}/src`)
  expect(await texts(ui)).toMatch(/"truncate-start"},"children":\["src"\]/)
  await ui.post({ key: '?' }, { in: 'rows' })
  await clock.settle()
  await ui.post({ key: 'v' }, { in: 'rows' })
  await clock.settle()
  expect(shortcutText(await ui.drawn())).not.toContain('Keyboard shortcuts')
  expect(JSON.stringify(await ui.drawn())).toContain('1 marked')
  await ui.unmount()
})

test('the shortcuts overlay scrolls with j and the wheel when the pane is short, and h closes it and acts on the tree', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['src', 'dir'], ['a.ts', 'file']], [`${root}/src`]: [['x.ts', 'file']] }, status: '', numstat: '' }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: { ...paneProps(60), scroll: { offset: 0, bodyRows: 20 } } })
  await clock.settle()
  await ui.post({ key: '?' }, { in: 'rows' })
  await clock.settle()
  const first = treeRows(await ui.drawn()).rows
  expect(first[0]?.left.map(x => x.t).join('')).toContain('Keyboard shortcuts')
  expect(shortcutText(await ui.drawn())).not.toContain('back to the prompt')
  await ui.post({ key: 'j' }, { in: 'rows' })
  await clock.settle()
  expect(treeRows(await ui.drawn()).rows[0]?.left.map(x => x.t).join('')).not.toContain('Keyboard shortcuts')
  await ui.post({ key: 'end' }, { in: 'rows' })
  await clock.settle()
  expect(shortcutText(await ui.drawn())).toContain('back to the prompt')
  await ui.post({ key: 'home' }, { in: 'rows' })
  await clock.settle()
  expect(treeRows(await ui.drawn()).rows[0]?.left.map(x => x.t).join('')).toContain('Keyboard shortcuts')
  await $.ui.scroll({ ...wheelDown, by: 5 })
  await clock.settle()
  expect(treeRows(await ui.drawn()).rows[0]?.left.map(x => x.t).join('')).not.toContain('Keyboard shortcuts')
  await ui.post({ key: 'l' }, { in: 'rows' })
  await clock.settle()
  expect(shortcutText(await ui.drawn())).not.toContain('Keyboard shortcuts')
  await ui.unmount()
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`? typed into the search box is a literal character and never toggles content search or the overlay on the ${surface}`, { timeoutMs: 20_000 }, async ($, on) => {
    const ran: Ran = []
    const root = '/home/k/proj'
    const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [root]: [['a.ts', 'file'], ['why?.md', 'file']] }, status: '## main\0', numstat: '', grep: 'a.ts\x003\x00const alpha = 1\n' }, ran)
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface, component: 'Pane', requestId: 'filetree', props: paneProps(60) })
    await clock.settle()
    await ui.input({ key: 'q', text: '?', kind: 'change' })
    await clock.settle()
    await clock.advance(200)
    await clock.settle()
    const drawn = await ui.drawn()
    expect(JSON.stringify(drawn)).toContain('"value":"?"')
    expect(JSON.stringify(drawn)).not.toContain('Keyboard shortcuts')
    expect(JSON.stringify(drawn)).not.toContain('grep:')
    expect(ran.some(a => a.includes('grep'))).toBe(false)
    if (surface === 'desktop') {
      expect(deskRows(drawn)).toEqual([`${root}/why?.md`])
      expect(svgs(drawn).map(x => x.alt)).toContain('search file contents off')
    } else expect(treeRows(drawn).rows.map(r => r.id).filter(id => id.startsWith(root))).toEqual([`${root}/why?.md`])
    await ui.unmount()
  })

  test(`the q hotkey and a click on the contents toggle switch the search box between names and file contents on the ${surface}`, { timeoutMs: 20_000 }, async ($, on) => {
    const ran: Ran = []
    const root = '/home/k/proj'
    const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [root]: [['a.ts', 'file'], ['alpha.md', 'file']] }, status: '## main\0', numstat: '', grep: 'a.ts\x003\x00const alpha = 1\n' }, ran)
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface, component: 'Pane', requestId: 'filetree', props: paneProps(60) })
    await clock.settle()
    const hit = `grep:3:${root}/a.ts`
    const settle = async () => {
      await clock.settle()
      await clock.advance(200)
      await clock.settle()
    }
    await ui.input({ key: 'q', text: 'alpha', kind: 'change' })
    await settle()
    expect(JSON.stringify(await ui.drawn())).not.toContain(hit)
    expect(ran.some(a => a.includes('grep'))).toBe(false)
    if (surface === 'desktop') await ui.press({ key: 'hk-q' })
    else await ui.post({ key: 'q' }, { in: 'rows' })
    await settle()
    const on1 = await ui.drawn()
    expect(JSON.stringify(on1)).toContain(hit)
    expect(JSON.stringify(on1)).toContain('"value":"alpha"')
    expect(ran.some(a => a.includes('grep') && a.includes('alpha'))).toBe(true)
    if (surface === 'desktop') {
      expect(svgs(on1).map(x => x.alt)).toContain('search file contents on')
      expect(JSON.stringify(on1)).toContain('"placeholder":"Search file contents..."')
      await tap(ui, 'content')
    } else {
      expect(JSON.stringify(on1)).toContain('"placeholder":"search contents"')
      expect(await ui.find({ key: 'search-content' })).toBeDefined()
      await ui.press({ key: 'search-content' })
    }
    await settle()
    const off = await ui.drawn()
    expect(JSON.stringify(off)).not.toContain(hit)
    if (surface === 'desktop') {
      expect(svgs(off).map(x => x.alt)).toContain('search file contents off')
      expect(deskRows(off)).toEqual([`${root}/alpha.md`])
      await tap(ui, 'content')
    } else {
      expect(treeRows(off).rows.map(r => r.id).filter(id => id.startsWith(root))).toEqual([`${root}/alpha.md`])
      await ui.press({ key: 'search-content' })
    }
    await settle()
    expect(JSON.stringify(await ui.drawn())).toContain(hit)
    await ui.unmount()
  })
}

test('shortcuts always opens the overlay with the pane and ? still closes it', { timeoutMs: 20_000, options: { shortcuts: 'always' } }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.ts', 'file']] }, status: '', numstat: '' }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  expect(shortcutText(await ui.drawn())).toContain('Keyboard shortcuts')
  expect(await ui.find({ key: 'nav-help' })).toBeUndefined()
  expect(await ui.find({ key: 'hk-tree' })).toBeDefined()
  await ui.post({ key: '?' }, { in: 'rows' })
  await clock.settle()
  expect(shortcutText(await ui.drawn())).toContain('a.ts')
  expect(shortcutText(await ui.drawn())).not.toContain('Keyboard shortcuts')
  await ui.unmount()
})

test('shortcuts off drops the ?: shortcuts hint but ? still toggles the overlay', { timeoutMs: 20_000, options: { shortcuts: 'off' } }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.ts', 'file']] }, status: '', numstat: '' }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  expect(await ui.find({ key: 'nav-help' })).toBeUndefined()
  await ui.post({ key: '?' }, { in: 'rows' })
  await clock.settle()
  expect(shortcutText(await ui.drawn())).toContain('Keyboard shortcuts')
  await ui.post({ key: '?' }, { in: 'rows' })
  await clock.settle()
  expect(shortcutText(await ui.drawn())).not.toContain('Keyboard shortcuts')
  await ui.unmount()
})

test('on the desktop the Shortcuts button opens a keyboard panel in the pane body with desktop keys only, and Close or an action key closes it', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, { os: 'darwin', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.ts', 'file'], ['b.ts', 'file']] }, status: '', numstat: '' }, [])
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  expect(await ui.find({ key: 'keys-panel' })).toBeUndefined()
  await ui.press({ key: 'nav-help' })
  await clock.settle()
  const panel = JSON.stringify(await ui.find({ key: 'keys-panel' }))
  for (const word of ['Keyboard shortcuts', 'keyboard shortcuts', 'Move', 'Files and actions', 'v / V', 'n / g / m', 'search file contents']) expect(panel).toContain(word)
  for (const word of ['ctrl+x tab', 'alt+l', '/filetree keys', 'page the preview', 'Quick Look']) expect(panel).not.toContain(word)
  await ui.press({ key: 'keys-close' })
  await clock.settle()
  expect(await ui.find({ key: 'keys-panel' })).toBeUndefined()
  await ui.press({ key: 'nav-help' })
  await clock.settle()
  expect(await ui.find({ key: 'keys-panel' })).toBeDefined()
  await ui.press({ key: 'hk-j' })
  await clock.settle()
  expect(await ui.find({ key: 'keys-panel' })).toBeDefined()
  await ui.press({ key: 'hk-h' })
  await clock.settle()
  expect(await ui.find({ key: 'keys-panel' })).toBeUndefined()
  await ui.press({ key: 'hk-j' })
  await clock.settle()
  await ui.press({ key: 'nav-help' })
  await clock.settle()
  await ui.press({ key: 'hk-v' })
  await clock.settle()
  expect(await ui.find({ key: 'keys-panel' })).toBeUndefined()
  expect(JSON.stringify(await ui.drawn())).toContain('1 marked')
  await ui.unmount()
})

test('the root row has a folder glyph, k from the first row selects it and k on it stays, the split maps the whole root, and the footer keeps ?: shortcuts left of the selected name', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['src', 'dir'], ['a.ts', 'file']], [`${root}/src`]: [['x.ts', 'file']] },
    du: { [root]: `5120\t${root}/src/x.ts\n5120\t${root}/src\n2048\t${root}/a.ts\n7168\t${root}\n`, [`${root}/src`]: `5120\t${root}/src/x.ts\n5120\t${root}/src\n` },
  }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const footer = (d: unknown) => JSON.stringify(d)
  expect(footer(await ui.drawn())).toContain('"key":"root","label":"■ proj"')
  expect(footer(await ui.drawn())).toContain('"key":"nav-help","label":"?: shortcuts"')
  expect(footer(await ui.drawn())).toMatch(/"key":"nav-help"[^\]]*"children":\[\{"type":"Text","props":\{"color":"ansi256\(4\)"\},"children":\["\?"\]\}/)
  await ui.press({ key: 'split' })
  await clock.settle()
  await ui.post({ key: 'home' }, { in: 'rows' })
  await clock.settle()
  expect(ran).toContainEqual(['du', '-akxH', '-d', '2', '--', `${root}/src`])
  await ui.post({ key: 'k' }, { in: 'rows' })
  await clock.settle()
  const drawn = footer(await ui.drawn())
  expect(drawn).toContain(`"active":"${root}"`)
  expect(drawn).toMatch(/"label":"\?: shortcuts".*"proj"/)
  expect(drawn).not.toContain('"~/proj"')
  expect(mapAt(await ui.drawn()).rows.map(r => r.left.map(x => x.t).join('')).join('\n')).toContain('a.ts')
  await ui.post({ key: 'j' }, { in: 'rows' })
  await clock.settle()
  expect(footer(await ui.drawn())).toContain(`"active":"${root}/src"`)
  await ui.post({ key: 'k' }, { in: 'rows' })
  await clock.settle()
  await ui.press({ key: 'root' })
  await clock.settle()
  expect(footer(await ui.drawn())).toContain(`"active":"${root}"`)
  await ui.post({ key: 'k' }, { in: 'rows' })
  await clock.settle()
  expect(footer(await ui.drawn())).toContain(`"active":"${root}"`)
  await ui.unmount()
})

test('the root row maps the whole root in a fresh session', async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['src', 'dir'], ['a.ts', 'file']], [`${root}/src`]: [['x.ts', 'file']] },
    files: { [`${root}/a.ts`]: 'export const a = 1\n' },
    abortDu: [root],
    du: { [root]: `5120\t${root}/src/x.ts\n5120\t${root}/src\n2048\t${root}/a.ts\n7168\t${root}\n`, [`${root}/src`]: `5120\t${root}/src/x.ts\n5120\t${root}/src\n` },
  }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ press: `${root}/a.ts` }, { in: 'rows' })
  await clock.settle()
  await ui.press({ key: 'split' })
  await clock.settle()
  await ui.press({ key: 'root' })
  await clock.settle()
  const text = mapOf(await ui.drawn())?.rows.map(r => r.left.map(x => x.t).join('')).join('\n') ?? ''
  expect(text).toContain('a.ts')
  expect(JSON.stringify(await ui.drawn())).not.toContain('"empty"')
  await ui.unmount()
})

for (const os of ['linux', 'win32'] as const) {
  test(`${os}: a failed file opener is visible`, { timeoutMs: 20_000 }, async ($, on) => {
    const ran: Ran = []
    const root = os === 'linux' ? '/home/k/proj' : 'C:/Users/k/proj'
    const clock = world(on, {
      os, env: os === 'win32' ? { OS: 'Windows_NT' } : { HOME: '/home/k' }, cwd: root, top: root,
      dirs: { [root]: [['dax.ts', 'file']] }, status: '', numstat: '',
      exits: { [os === 'linux' ? 'sh' : 'powershell']: [7, ''] },
    }, ran)
    await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
    await clock.settle()
    await ui.post({ press: `${root}/dax.ts` }, { in: 'rows' })
    await ui.post({ press: `${root}/dax.ts` }, { in: 'rows' })
    await clock.settle()
    expect(ran.some(a => a[0] === 'toast' && a[1]?.includes(`could not open ${root}/dax.ts`) && a[1]?.includes('exit 7'))).toBe(true)
    await ui.unmount()
  })
}

test('Windows: a commit run through the PowerShell tool shows as git activity', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = 'C:/Users/k/proj'
  const w: World = { os: 'win32', env: { OS: 'Windows_NT', USERPROFILE: 'C:\\Users\\k' }, cwd: 'C:\\Users\\k\\proj', top: root, dirs: { [root]: [['a.txt', 'file']] }, status: '## main\0', numstat: '', heads: ['abc1234def0', 'fed4321cba9'] }
  const clock = world(on, w, ran)
  await $.session.start({ cwd: 'C:\\Users\\k\\proj', surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await $.tool.call(hostTool({ tool: 'PowerShell', command: 'git commit -m real' }))
  await clock.settle()
  const shown = await texts(ui)
  expect(shown).toContain('committed')
  expect(shown).toContain('fed4321')
  await ui.unmount()
})

test('files a Grep or Glob search returns shimmer as reads, relative names resolved against the cwd', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const w: World = { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.ts', 'file'], ['sub', 'dir']], [`${root}/sub`]: [['b.ts', 'file']] }, status: '', numstat: '' }
  w.tool = e => (String(e.tool) === 'Grep' ? { result: { numFiles: 1, filenames: ['sub/b.ts'] } } : String(e.tool) === 'Glob' ? { result: { numFiles: 1, filenames: [`${root}/a.ts`] } } : undefined)
  const clock = world(on, w, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await $.tool.call(hostTool({ tool: 'Grep', pattern: 'x' }))
  await clock.settle()
  expect(await texts(ui)).toContain(shimmer('b.ts', 'purple'))
  await $.tool.call(hostTool({ tool: 'Glob', pattern: '*.ts' }))
  await clock.settle()
  expect(await texts(ui)).toContain(shimmer('a.ts', 'purple'))
  await ui.unmount()
})

test('the ignore setting leaves a name out of the listing, the change scan and the shimmer at any depth', { timeoutMs: 20_000, options: { ignore: '.spool, .cache' } }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const w: World = { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.ts', 'file'], ['.spool', 'dir'], ['sub', 'dir']], [`${root}/sub`]: [['.cache', 'dir'], ['b.ts', 'file']] }, status: '', numstat: '', find: `${root}/a.ts\0${root}/.spool/log.json\0${root}/sub/.cache/x\0` }
  w.tool = e => (String(e.tool) === 'Grep' ? { result: { numFiles: 2, filenames: ['.spool/log.json', 'sub/b.ts'] } } : undefined)
  const clock = world(on, w, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  expect(await texts(ui)).not.toContain('.spool')
  await $.tool.call({ tool: 'Bash', command: 'touch a.ts' })
  await clock.settle()
  expect(ran.find(a => a[0] === 'find')).toContain('.spool')
  await $.tool.call(hostTool({ tool: 'Grep', pattern: 'x' }))
  await clock.settle()
  const shown = await texts(ui)
  expect(shown).toContain(shimmer('a.ts', 'orange'))
  expect(shown).toContain(shimmer('b.ts', 'purple'))
  expect(shown).not.toContain('.spool')
  expect(shown).not.toContain('.cache')
  await ui.unmount()
})

const cached = (n: number) => Array.from({ length: n }, (_, i) => `.cache/k${String(i).padStart(3, '0')}.ts`)

test('the ignore setting keeps ignored tracked files out of the git search index before the hit cap', { timeoutMs: 20_000, options: { ignore: '.cache' } }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const w: World = { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [`${root}/.cache`]: cached(61).map((p): [string, 'file'] => [p.slice(7), 'file']), [root]: [['.cache', 'dir'], ['src', 'dir']], [`${root}/src`]: [['k.ts', 'file']] }, status: '## main\0', numstat: '' }
  const clock = world(on, w, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await ui.input({ key: 'q', text: 'k', kind: 'change' })
  await clock.settle()
  expect(await texts(ui)).toContain(`"id":"${root}/src/k.ts"`)
  await ui.unmount()
})

test('the ignore setting applies before the reveal cap on a commit and on a Grep result', { timeoutMs: 20_000, options: { ignore: '.cache' } }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const w: World = { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [root]: [['.cache', 'dir'], ['src', 'dir'], ['gen', 'dir']], [`${root}/src`]: [['k.ts', 'file']], [`${root}/gen`]: [['g.ts', 'file']] }, status: '## main\0', numstat: '', heads: ['abc1234def0', 'fed4321cba9'], diffTree: [...cached(12), 'src/k.ts'] }
  w.tool = e => (String(e.tool) === 'Grep' ? { result: { numFiles: 61, filenames: [...cached(60), 'gen/g.ts'] } } : undefined)
  const clock = world(on, w, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await $.tool.call({ tool: 'Bash', command: 'git commit -m real' })
  await clock.settle()
  expect(await texts(ui)).toContain(shimmer('k.ts', 'green'))
  await $.tool.call(hostTool({ tool: 'Grep', pattern: 'x' }))
  await clock.settle()
  expect(await texts(ui)).toContain(shimmer('g.ts', 'purple'))
  await ui.unmount()
})

test('a second /filetree closes the tree', async ($, on) => {
  const closed: string[] = []
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('ui.panes', () => ({ value: [{ id: 'filetree', title: 'Files', isShown: true, isFocused: false, isPlaced: true }] }))
  on('ui.close', (_$, e) => {
    closed.push(e.id)
    return { value: undefined }
  })
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
  const out = await $.command.run({ command: 'filetree', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } })
  expect(closed).toEqual(['filetree'])
  expect(JSON.stringify(out)).toContain('closed')
})

test('/filetree open keeps an open tree open', async ($, on) => {
  const closed: string[] = []
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('ui.panes', () => ({ value: [{ id: 'filetree', title: 'Files', isShown: false, isFocused: false, isPlaced: true }] }))
  on('ui.close', (_$, e) => {
    closed.push(e.id)
    return { value: undefined }
  })
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'filetree', args: 'open', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } }).catch(() => undefined)
  expect(closed).toEqual([])
})

test('/filetree on a tree hidden behind another tab brings it forward instead of closing it', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.txt', 'file']] }, status: '', numstat: '' }, ran)
  const closed: unknown[] = []
  on('ui.panes', () => ({ value: [{ id: 'filetree', title: 'Files', isShown: false, isFocused: false, isPlaced: true }] }))
  on('ui.close', (_$, e) => {
    closed.push(e)
    return { value: undefined }
  })
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const before = opens.length
  const r = await $.command.run(fullscreen(''))
  await clock.settle()
  expect(closed).toEqual([])
  expect(JSON.stringify(r)).toContain('File tree on')
  expect(opens.slice(before).some(o => has(o, 'id') && o.id === 'filetree' && has(o, 'focus') && o.focus === true)).toBe(true)
})

const PNG_HEAD = '137 80 78 71 13 10 26 10 0 0 0 13 73 72 68 82 0 0 3 32 0 0 1 144'


test('split preview: a PDF draws its page as a picture with p N/M, prefetches the next page, ] and [ turn pages within the count, and a docx is converted once for every page', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const cache = '/run/user/1000/filetree-preview-1000/test-session'
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k', XDG_RUNTIME_DIR: '/run/user/1000' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['doc.pdf', 'file'], ['note.docx', 'file']], [cache]: [['p1.png', 'file'], ['p2.png', 'file'], ['p3.png', 'file']] },
    stdout: { 'od -An -tu1': PNG_HEAD },
    poster: argv => `${cache}/p${argv[12]}.png\n3`,
  }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.press({ key: 'split' })
  await ui.post({ key: 'k' }, { in: 'rows' })
  await clock.settle()
  await clock.settle()
  let shown = JSON.stringify(await ui.drawn())
  expect(shown).toContain(pngOf(`${cache}/p1.png`))
  expect(shown).toContain('p 1/3')
  const posters = () => ran.filter(a => a[0] === 'sh' && a.includes(`${root}/doc.pdf`))
  expect(posters()[0]?.slice(8, 9)).toEqual(['pdf'])
  expect(posters().map(a => a[12])).toEqual(['1', '2'])
  await ui.post({ key: ']' }, { in: 'rows' })
  await clock.settle()
  await clock.settle()
  shown = JSON.stringify(await ui.drawn())
  expect(shown).toContain(pngOf(`${cache}/p2.png`))
  expect(shown).toContain('p 2/3')
  await ui.post({ key: ']' }, { in: 'rows' })
  await clock.settle()
  await ui.post({ key: ']' }, { in: 'rows' })
  await clock.settle()
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).toContain('p 3/3')
  await ui.post({ key: '[' }, { in: 'rows' })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).toContain('p 2/3')
  expect(posters().map(a => a[12])).toEqual(['1', '2', '3'])
  await ui.post({ key: 'j' }, { in: 'rows' })
  await clock.settle()
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).toContain('p 1/3')
  const office = ran.filter(a => a[0] === 'sh' && a.includes(`${root}/note.docx`))
  expect(office.map(a => [a[8], a[12]])).toEqual([['office', '1'], ['office', '2']])
  expect(office[0]?.[14]).toMatch(/^[0-9a-f]{32}\.pdf$/)
  expect(office[1]?.[14]).toBe(office[0]?.[14])
})

test('split preview: the header button shows the file under the cursor below a rule, the wheel, Page Down, f and End scroll it with a scrollbar, pictures draw as images, and the button hides it', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/opt/k/proj'
  const clock = world(on, {
    os: 'linux', env: { HOME: '/opt/k', XDG_RUNTIME_DIR: '/run/user/1000' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['a.ts', 'file'], ['b.png', 'file'], ['c.mp4', 'file']], '/run/user/1000/filetree-preview-1000/test-session': [['0123456789abcdef.png', 'file']] },
    files: { [`${root}/a.ts`]: `const a = 1\n${'a++\n'.repeat(200)}` },
    stdout: { 'od -An -tu1': PNG_HEAD, [`sh -c ${POSTER}`]: '/run/user/1000/filetree-preview-1000/test-session/0123456789abcdef.png' },
  }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).not.toContain('──')
  await ui.press({ key: 'split' })
  await clock.settle()
  let shown = JSON.stringify(await ui.drawn())
  expect(shown).toContain('──')
  expect(shown).toContain('empty')
  await ui.post({ key: 'k' }, { in: 'rows' })
  await clock.settle()
  let peek = peekOf(await ui.drawn())
  expect(peek.preview.text).toContain('const a = 1')
  expect(peek.preview.startLine).toBe(1)
  expect(peek.bar?.pos).toBe(0)
  expect(JSON.stringify(await ui.drawn())).toContain('1–16/201')
  await ui.post({ key: 'pagedown' }, { in: 'rows' })
  await clock.settle()
  expect(peekOf(await ui.drawn()).preview.startLine).toBe(16)
  await ui.post({ key: 'f' }, { in: 'rows' })
  await clock.settle()
  expect(peekOf(await ui.drawn()).preview.startLine).toBe(31)
  await ui.press({ key: 'hk-b' })
  await clock.settle()
  expect(peekOf(await ui.drawn()).preview.startLine).toBe(16)
  await ui.press({ key: 'hk-f' })
  await clock.settle()
  expect(peekOf(await ui.drawn()).preview.startLine).toBe(31)
  await $.ui.scroll(wheelDown)
  await clock.settle()
  expect(peekOf(await ui.drawn()).preview.startLine).toBe(31)
  await ui.post({ over: true }, { in: 'peek' })
  await $.ui.scroll(wheelDown)
  await clock.settle()
  expect(peekOf(await ui.drawn()).preview.startLine).toBe(34)
  await ui.post({ key: 'end' }, { in: 'peek' })
  await clock.settle()
  peek = peekOf(await ui.drawn())
  expect(peek.preview.startLine).toBe(186)
  expect(peek.bar && peek.bar.pos + peek.bar.size).toBe(16)
  await ui.post({ over: false }, { in: 'peek' })
  await ui.post({ key: 'j' }, { in: 'rows' })
  await clock.settle()
  await clock.settle()
  shown = JSON.stringify(await ui.drawn())
  expect(shown).toContain(pngOf(`${root}/b.png`))
  expect(shown).toContain('800×400')
  expect(shown).toContain('"columns":59,"rows":15')
  expect(ran.some(a => a[0] === 'sh' && a.includes(`${root}/b.png`))).toBe(false)
  await ui.post({ key: 'j' }, { in: 'rows' })
  await clock.settle()
  await clock.settle()
  shown = JSON.stringify(await ui.drawn())
  expect(shown).toContain(pngOf('/run/user/1000/filetree-preview-1000/test-session/0123456789abcdef.png'))
  const poster = ran.find(a => a[0] === 'sh' && a.includes(`${root}/c.mp4`))
  expect(poster?.slice(4)).toEqual([`${root}/c.mp4`, '/run/user/1000', 'test-session', poster?.[7] ?? '', 'video', 'mov', '64', POLICY])
  expect(POSTER).toContain('-protocol_whitelist file -f "$coder"')
  expect(POSTER).toContain('"$coder:$src[0]"')
  expect(POSTER).toContain('MAGICK_CONFIGURE_PATH="$d"')
  expect(POSTER).not.toContain('ffmpegthumbnailer')
  expect(POLICY).toContain('<policy domain="coder" rights="none" pattern="*"/>')
  await ui.press({ key: 'split' })
  await clock.settle()
  shown = JSON.stringify(await ui.drawn())
  expect(shown).not.toContain('──')
  expect(shown).not.toContain('"Image"')
  await ui.unmount()
})

test('split preview at the top: p shows it under the header with the rule below it, and a picture that cannot be decoded says why', { timeoutMs: 20_000, options: { split: 'top' } }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['a.md', 'file'], ['b.webp', 'file']] },
    files: { [`${root}/a.md`]: '# Notes\n\nhello' },
    exits: { sh: [3, 'no magick or ffmpeg to decode it'] },
  }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await ui.post({ key: 'k' }, { in: 'rows' })
  await ui.post({ key: 'p' }, { in: 'rows' })
  await clock.settle()
  const drawn = await ui.drawn()
  const split = kids(drawn)[1]
  const order = JSON.stringify(split)
  expect(order.indexOf('a.md')).toBeLessThan(order.indexOf('──'))
  expect(peekOf(drawn).preview.markdown).toBe(true)
  await ui.post({ key: 'j' }, { in: 'rows' })
  await clock.settle()
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).toContain('no magick or ffmpeg to decode it')
  await ui.post({ key: 'p' }, { in: 'rows' })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).not.toContain('──')
  await ui.unmount()
})

test('split preview: a scrollbar click lands mid-file, the wheel goes back to the tree once the file under it changes, a pipe is not read, a failed decoder says it failed, and a short pane leaves the split out', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['a.ts', 'file'], ['b.jpg', 'file'], ['fifo', 'other']] },
    files: { [`${root}/a.ts`]: `const a = 1\n${'a++\n'.repeat(200)}` },
    exits: { sh: [4, 'magick: corrupt image'] },
  }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await ui.post({ key: 'k' }, { in: 'rows' })
  await ui.post({ key: 'p' }, { in: 'rows' })
  await clock.settle()
  await ui.pointer({ type: 'down', x: 59, y: 8, button: 'left', in: 'peek' })
  await ui.pointer({ type: 'up', x: 59, y: 8, button: 'left', in: 'peek' })
  await clock.settle()
  const mid = peekOf(await ui.drawn()).preview.startLine
  expect(mid).toBeGreaterThan(80)
  expect(mid).toBeLessThan(120)
  await ui.post({ over: true }, { in: 'peek' })
  await ui.post({ key: 'j' }, { in: 'rows' })
  await clock.settle()
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).toContain('could not decode: magick: corrupt image')
  await ui.post({ key: 'k' }, { in: 'rows' })
  await clock.settle()
  await $.ui.scroll(wheelDown)
  await clock.settle()
  expect(peekOf(await ui.drawn()).preview.startLine).toBe(1)
  await ui.post({ key: 'end' }, { in: 'rows' })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).toContain('not a regular file')
  await ui.unmount()
  const short = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: { ...paneProps(60), scroll: { offset: 0, bodyRows: 16 } } })
  await clock.settle()
  expect(JSON.stringify(await short.drawn())).not.toContain('──')
  await short.unmount()
})

test('split preview on desktop: p does nothing and Page Down still moves the tree', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/Users/k/proj'
  const names = Array.from({ length: 30 }, (_, i): [string, 'file'] => [`f${String(i).padStart(2, '0')}.txt`, 'file'])
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: '', status: '', numstat: '', dirs: { [root]: names } }, [])
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const zone = { in: `hit:${root}/f00.txt` }
  await ui.post({ key: 'k' }, zone)
  await ui.post({ key: 'p' }, zone)
  await ui.post({ key: 'pagedown' }, zone)
  await clock.settle()
  const tree = await ui.drawn()
  expect(JSON.stringify(tree)).not.toContain('──')
  expect(deskActive(tree)).toBe(`${root}/f10.txt`)
  await ui.unmount()
})

test('split preview: a cached picture another session pruned is decoded again, and the session folder goes when the session ends', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const cache = '/run/user/1000/filetree-preview-1000/test-session'
  const w: World = {
    os: 'linux', env: { HOME: '/home/k', XDG_RUNTIME_DIR: '/run/user/1000' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['a.txt', 'file'], ['b.jpg', 'file']], [cache]: [['x.png', 'file']] },
    files: { [`${root}/a.txt`]: 'a' },
    stdout: { 'od -An -tu1': PNG_HEAD, [`sh -c ${POSTER}`]: `${cache}/x.png` },
  }
  const clock = world(on, w, ran)
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await ui.post({ key: 'end' }, { in: 'rows' })
  await ui.post({ key: 'p' }, { in: 'rows' })
  await clock.settle()
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).toContain(pngOf(`${cache}/x.png`))
  const decodes = () => ran.filter(a => a[0] === 'sh' && a.includes(`${root}/b.jpg`)).length
  expect(decodes()).toBe(1)
  w.dirs[cache] = []
  await ui.post({ key: 'k' }, { in: 'rows' })
  await clock.settle()
  await ui.post({ key: 'j' }, { in: 'rows' })
  await clock.settle()
  await clock.settle()
  expect(decodes()).toBe(2)
  expect(JSON.stringify(await ui.drawn())).toContain('the preview cache was cleared')
  await ui.unmount()
  await $.session.end({ reason: 'other', sessionId: 'test-session', resume: { id: 'test-session' } })
  await clock.settle()
  expect(ran).toContainEqual(['sh', '-c', CLEAN, 'sh', cache])
})


test('treemap: a folder under the cursor maps its children by du size, a click on a box selects it and moves the cursor there without changing the map, Enter on the map drills into the picked folder, an edit inside lights its block, and p shows the picked file', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['src', 'dir'], ['big.bin', 'file'], ['a.ts', 'file']], [`${root}/src`]: [['x.ts', 'file'], ['y.ts', 'file']] },
    files: { [`${root}/src/x.ts`]: 'export const x = 1\n' },
    du: {
      [root]: `5120\t${root}/src/x.ts\n1024\t${root}/src/y.ts\n6144\t${root}/src\n3072\t${root}/big.bin\n4\t${root}/a.ts\n9220\t${root}\n`,
      [`${root}/src`]: `5120\t${root}/src/x.ts\n1024\t${root}/src/y.ts\n6144\t${root}/src\n`,
    },
  }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.press({ key: 'split' })
  await clock.settle()
  expect(ran).toContainEqual(['du', '-akxH', '-d', '2', '--', root])
  let map = mapAt(await ui.drawn())
  const text = (m: RowsProps) => m.rows.map(r => r.left.map(s => s.t).join('')).join('\n')
  expect(text(map)).toContain('src')
  expect(text(map)).toContain('6.0M')
  expect(text(map)).toContain('big.bin')
  expect(text(map)).not.toMatch(/[╭│─]/)
  expect(text(map)).toContain('x.ts 5.0M 56%')
  expect(JSON.stringify(await ui.drawn())).toContain('9.0M')
  const fillOf = (m: RowsProps, tab: string) => m.rows.flatMap(r => r.left).find(s => s.tab === tab && s.t.trim())?.bg
  const before = fillOf(map, `${root}/src`)
  await ui.post({ tab: `${root}/src` }, { in: 'treemap' })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).toContain(`"active":"${root}/src"`)
  expect(ran).not.toContainEqual(['du', '-akxH', '-d', '2', '--', `${root}/src`])
  expect(text(mapAt(await ui.drawn()))).toContain('x.ts 5.0M 56%')
  expect(fillOf(mapAt(await ui.drawn()), `${root}/src`)).not.toBe(before)
  await clock.advance(1_000)
  await ui.post({ tab: `${root}/src` }, { in: 'treemap' })
  await clock.settle()
  expect(ran).not.toContainEqual(['du', '-akxH', '-d', '2', '--', `${root}/src`])
  await ui.post({ key: 'return' }, { in: 'treemap' })
  await clock.settle()
  expect(ran).toContainEqual(['du', '-akxH', '-d', '2', '--', `${root}/src`])
  expect(text(mapAt(await ui.drawn()))).toContain('x.ts 5.0M 83%')
  await $.tool.call({ tool: 'Edit', file_path: `${root}/src/x.ts`, old_string: 'a', new_string: 'b' })
  await clock.settle()
  map = mapAt(await ui.drawn())
  expect(map.rows.some(r => r.left.some(s => s.tab === `${root}/src/x.ts` && s.bg?.startsWith('#') && s.b))).toBe(true)
  await ui.post({ tab: `${root}/src/x.ts` }, { in: 'treemap' })
  await clock.settle()
  for (let i = 0; i < 3; i++) {
    await clock.settle()
    const drawn = JSON.stringify(await ui.drawn())
    expect(drawn).toContain(`"active":"${root}/src/x.ts"`)
    expect(drawn).toContain('"key":"treemap"')
    expect(drawn).not.toContain('export const x')
  }
  await ui.post({ key: 'p' }, { in: 'treemap' })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).toContain('export const x')
  await ui.post({ key: 'k' }, { in: 'rows' })
  await clock.settle()
  expect(mapOf(await ui.drawn())).toBeDefined()
})


test('treemap image: in Ghostty the map is one PNG Image with a click zone over it, a double click on a folder box maps that folder, and a click on a file box selects it and keeps the map', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k', TERM_PROGRAM: 'ghostty' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['src', 'dir'], ['big.bin', 'file']], [`${root}/src`]: [['x.ts', 'file'], ['y.ts', 'file']] },
    du: {
      [root]: `5120\t${root}/src/x.ts\n5120\t${root}/src\n3072\t${root}/big.bin\n8196\t${root}\n`,
      [`${root}/src`]: `4096\t${root}/src/x.ts\n1024\t${root}/src/y.ts\n5120\t${root}/src\n`,
    },
  }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.press({ key: 'split' })
  await clock.settle()
  const image = imageAt(await ui.drawn(), 'treemap-image')
  if (image === undefined) throw new Error('no treemap image')
  const bytes = Uint8Array.fromBase64(image)
  expect([...bytes.slice(1, 4)].map(c => String.fromCharCode(c)).join('')).toBe('PNG')
  const zone = zoneAt(await ui.drawn())
  expect(zone.boxes.map(b => b[0])).toContain(`${root}/src`)
  await ui.post({ tab: `${root}/src` }, { in: 'treemap' })
  await clock.settle()
  expect(zoneAt(await ui.drawn()).boxes.map(b => b[0])).not.toContain(`${root}/src/y.ts`)
  await ui.post({ tab: `${root}/src` }, { in: 'treemap' })
  await clock.settle()
  const after = await ui.drawn()
  expect(zoneAt(after).boxes.map(b => b[0])).toContain(`${root}/src/y.ts`)
  expect(imageAt(after, 'treemap-image')).not.toBe(image)
  await ui.post({ tab: `${root}/src/y.ts` }, { in: 'treemap' })
  await clock.settle()
  const file = await ui.drawn()
  expect(imageAt(file, 'treemap-image')).toBeDefined()
  expect(zoneAt(file).boxes.map(b => b[0])).toContain(`${root}/src/y.ts`)
  expect(JSON.stringify(file)).toContain(`"active":"${root}/src/y.ts"`)
})

test('treemap off: a folder under the cursor shows no map and runs no du', { timeoutMs: 20_000, options: { treemap: 'off' } }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k', TERM_PROGRAM: 'ghostty' }, cwd: root, top: '', status: '', numstat: '', dirs: { [root]: [['src', 'dir']], [`${root}/src`]: [] } }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.press({ key: 'split' })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).not.toContain('treemap')
  expect(ran.some(c => c[0] === 'du')).toBe(false)
})

const HERDR_TAB = '{"id":"cli:tab:create","result":{"root_pane":{"pane_id":"w1:p40"},"tab":{"tab_id":"w1:t9"},"type":"tab_created"}}'
const HERDR_WORKSPACE = '{"id":"cli:workspace:create","result":{"root_pane":{"pane_id":"w2:p1"},"tab":{"tab_id":"w2:t1"},"workspace":{"workspace_id":"w2"},"type":"workspace_created"}}'

for (const [target, made, pane] of [
  ['auto', ['pane', 'split', '--current', '--direction', 'right'], 'w1:p37'],
  ['pane right', ['pane', 'split', '--current', '--direction', 'right'], 'w1:p37'],
  ['pane below', ['pane', 'split', '--current', '--direction', 'down'], 'w1:p37'],
  ['tab', ['tab', 'create', '--workspace', 'w1'], 'w1:p40'],
  ['workspace', ['workspace', 'create'], 'w2:p1'],
] as const) {
  test(`terminal target ${target} in herdr: Enter opens the editor through herdr ${made.slice(0, 2).join(' ')}${made[4] ? ` ${made[4]}` : ''}${made[2] === '--workspace' ? " in Claude's workspace" : ''} and runs it in the new pane`, { timeoutMs: 20_000, options: { open: 'editor', target } }, async ($, on) => {
    const ran: Ran = []
    const root = '/home/k/proj'
    const bin = '/opt/herdr/bin/herdr'
    const clock = world(on, { os: 'linux', env: { HOME: '/home/k', HERDR_ENV: '1', HERDR_BIN_PATH: bin, HERDR_WORKSPACE_ID: 'w1', EDITOR: 'nvim' }, cwd: root, top: '', dirs: { [root]: [['a.md', 'file']] }, status: '', numstat: '', stdout: { [`${bin} pane split`]: HERDR_SPLIT, [`${bin} tab create`]: HERDR_TAB, [`${bin} workspace create`]: HERDR_WORKSPACE } }, ran)
    await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
    await ui.post({ press: `${root}/a.md` }, { in: 'rows' })
    await ui.post({ key: 'o' }, { in: 'rows' })
    await clock.settle()
    expect(ran.filter(a => a[0] === bin && a[1] !== '--version')).toEqual([
      [bin, ...made, '--focus', '--cwd', root, '--env', `PANE_OPEN_TARGET=${root}/a.md`],
      [bin, 'pane', 'run', pane, `exec 'nvim' "$PANE_OPEN_TARGET"`],
    ])
    expect(ran.some(a => a[0] === 'toast')).toBe(false)
    await ui.unmount()
  })
}

for (const [target, launch] of [
  ['pane right', 'exec tmux split-window -h -c "$d" -- "$@" ${n:+"+$n"} "$f"'],
  ['pane below', 'exec tmux split-window -v -c "$d" -- "$@" ${n:+"+$n"} "$f"'],
  ['tab', 'exec tmux new-window -c "$d" -- "$@" ${n:+"+$n"} "$f"'],
  ['workspace', `s=$(tmux new-session -d -P -F '#{session_id}' -c "$d" -- "$@" \${n:+"+$n"} "$f") && tmux set-option -t "$s" detach-on-destroy off >/dev/null && { tmux switch-client -t "$s" || { tmux kill-session -t "$s"; exit 1; }; }; exit`],
] as const) {
  test(`terminal target ${target} in tmux: Enter starts the editor with ${launch.split(' -c ')[0]} when no nvim is running`, { timeoutMs: 20_000, options: { open: 'editor', target } }, async ($, on) => {
    const ran: Ran = []
    const root = '/home/k/proj'
    const clock = world(on, { os: 'linux', env: { HOME: '/home/k', TMUX: '/tmp/tmux-1000/default,1,0', EDITOR: 'nvim' }, cwd: root, top: '', dirs: { [root]: [['a.md', 'file']] }, status: '', numstat: '' }, ran)
    await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
    await ui.post({ press: `${root}/a.md` }, { in: 'rows' })
    await ui.post({ key: 'o' }, { in: 'rows' })
    await clock.settle()
    const opened = ran.find(a => a[0] === 'sh' && a[1] === '-c' && a[2]?.includes('remote-expr'))
    expect(opened?.slice(3)).toEqual(['sh', `${root}/a.md`, root, '', 'nvim'])
    const script = opened?.[2]?.split('\n') ?? []
    expect(script.at(-1)).toBe(launch)
    expect(script[2]).toBe(`case \${bin##*/} in nvim) ;; *) ${launch} ;; esac`)
    await ui.unmount()
  })
}

for (const [target, argv] of [
  ['auto', ['tmux', 'new-window', '-c', '/home/k/proj', '--', 'lazygit', '-f', '/home/k/proj/a.ts']],
  ['tab', ['tmux', 'new-window', '-c', '/home/k/proj', '--', 'lazygit', '-f', '/home/k/proj/a.ts']],
  ['pane right', ['tmux', 'split-window', '-h', '-c', '/home/k/proj', '--', 'lazygit', '-f', '/home/k/proj/a.ts']],
  ['pane below', ['tmux', 'split-window', '-v', '-c', '/home/k/proj', '--', 'lazygit', '-f', '/home/k/proj/a.ts']],
  ['workspace', ['sh', '-c', TMUX_WORKSPACE, 'sh', '/home/k/proj', 'lazygit', '-f', '/home/k/proj/a.ts']],
] as const) {
  test(`terminal target ${target}: Diff with runs lazygit in tmux with ${argv[0] === 'sh' ? 'a new session' : argv[1]}`, { timeoutMs: 20_000, options: { diff: 'lazygit -f', target } }, async ($, on) => {
    const ran: Ran = []
    const root = '/home/k/proj'
    const clock = world(on, { os: 'linux', env: { HOME: '/home/k', TMUX: '/tmp/tmux-1/default,1,0' }, cwd: root, top: root, dirs: { [root]: [['a.ts', 'file']] }, status: '## main\0 M a.ts\0', numstat: '' }, ran)
    await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
    await clock.settle()
    await ui.post({ key: 'end' }, { in: 'rows' })
    await ui.post({ key: 'd' }, { in: 'rows' })
    await clock.settle()
    expect(ran).toContainEqual([...argv])
    await ui.unmount()
  })
}

test('terminal target pane below in herdr: Diff with splits the pane downward', { timeoutMs: 20_000, options: { diff: 'lazygit -f', target: 'pane below' } }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const bin = '/opt/herdr/bin/herdr'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k', HERDR_ENV: '1', HERDR_BIN_PATH: bin }, cwd: root, top: root, dirs: { [root]: [['a.ts', 'file']] }, status: '## main\0 M a.ts\0', numstat: '', stdout: { [`${bin} pane split`]: HERDR_SPLIT } }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ key: 'end' }, { in: 'rows' })
  await ui.post({ key: 'd' }, { in: 'rows' })
  await clock.settle()
  expect(ran.filter(a => a[0] === bin && a[1] !== '--version')).toEqual([
    [bin, 'pane', 'split', '--current', '--direction', 'down', '--focus', '--cwd', root, '--env', `PANE_OPEN_TARGET=${root}/a.ts`],
    [bin, 'pane', 'run', 'w1:p37', `exec 'lazygit' '-f' "$PANE_OPEN_TARGET"`],
  ])
  await ui.unmount()
})

test('tmux workspace: the new session returns to Claude when the program exits and is removed when no client can switch to it', () => {
  expect(TMUX_WORKSPACE).toBe(`d=$1; shift; s=$(tmux new-session -d -P -F '#{session_id}' -c "$d" -- "$@") && tmux set-option -t "$s" detach-on-destroy off >/dev/null && { tmux switch-client -t "$s" || { tmux kill-session -t "$s"; exit 1; }; }; exit`)
})

test('split preview: a file edited outside Claude shows its new text after the watcher fires', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/opt/k/proj'
  const files: Record<string, string> = { [`${root}/a.ts`]: 'const before = 1\n' }
  const w: World = {
    os: 'linux', env: { HOME: '/opt/k' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['a.ts', 'file']] },
    files,
    watch: { after: 5_000, change: () => {
      files[`${root}/a.ts`] = 'const after = 2\n'
      return `${root}/a.ts\n`
    } },
  }
  const clock = world(on, w, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.press({ key: 'split' })
  await clock.settle()
  await ui.post({ key: 'j' }, { in: 'rows' })
  await clock.settle()
  expect(peekOf(await ui.drawn()).preview.text).toContain('const before = 1')
  await clock.advance(5_000)
  await clock.settle()
  await clock.advance(2_000)
  await clock.settle()
  const text = peekOf(await ui.drawn()).preview.text
  expect(text).toContain('const after = 2')
  expect(text).not.toContain('const before')
  await ui.unmount()
})

test('files added and removed outside Claude show in the tree and the treemap without a click', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const dirs: World['dirs'] = { [root]: [['a.ts', 'file']] }
  const du: Record<string, string> = { [root]: `4\t${root}/a.ts\n4\t${root}\n` }
  const w: World = {
    os: 'linux' as const, env: { HOME: '/home/k' }, cwd: root, top: '', status: '', numstat: '',
    dirs,
    du,
    watch: { after: 5_000, change: () => {
      dirs[root] = [['shell.bin', 'file']]
      du[root] = `8192\t${root}/shell.bin\n8192\t${root}\n`
      return `${root}/shell.bin\n${root}/a.ts\n`
    } },
  }
  const clock = world(on, w, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.press({ key: 'split' })
  await clock.settle()
  expect(ran).toContainEqual(['inotifywait', '-mq', '-e', 'create,delete,moved_to,moved_from,close_write', '--format', '%w%f', '--', root])
  expect(await texts(ui)).not.toContain('shell.bin')
  await clock.advance(5_000)
  await clock.settle()
  await clock.advance(2_000)
  await clock.settle()
  const after = await texts(ui)
  expect(after).toContain('shell.bin')
  expect(after).not.toContain('a.ts')
  expect(JSON.stringify(mapOf(await ui.drawn()))).toContain(`"tab":"${root}/shell.bin"`)
  expect(ran.filter(a => a[0] === 'inotifywait').length).toBe(1)
  await ui.unmount()
})

const ICON_WORLD = (root: string): World => ({
  os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: root,
  dirs: { [root]: [['src', 'dir'], ['README.md', 'file'], ['.gitignore', 'file'], ['logo.png', 'file']], [`${root}/src`]: [['a.ts', 'file'], ['b.ts', 'file']] },
  status: '## main\0 M src/a.ts\0', numstat: '3\t1\tsrc/a.ts\0',
})

test('terminal: git counts sit in their own columns left of the value column', { timeoutMs: 20_000, options: { glyphs: 'nerd' } }, async ($, on) => {
  const root = '/Users/k/proj'
  const clock = world(on, ICON_WORLD(root), [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const rows = treeRows(await ui.drawn()).rows
  const right = (id: string) => (rows.find(r => r.id === id)?.right ?? []).map(seg => seg.t.trim()).filter(Boolean)
  expect(right(`${root}/src`)).toEqual(['+3', '-1', 'M:1'])
  expect(right(`${root}/README.md`)).toEqual([stamp(1_700_000_000_000)])
  await ui.unmount()
})

const GLYPH_SETS: [string, Record<string, string>, string, string[], string, string, string][] = [
  ['nerd', { glyphs: 'nerd' }, 'ok', ['\u{f19f3}', '\u{eb46}', '\u{eb37}', '\u{ea70}', '\u{ea90}', '\u{eac5}', '\u{eb57}'], '\u{ea6d} ', '\u{e5ff} ', '\u{f0354} '],
  ['auto without a Nerd Font', {}, 'missing', ['↑', '⌂', '↻', '⊙', '◫', '⊟', '⊡'], '⌕ ', '■ ', '∙ '],
  ['plain', { glyphs: 'plain' }, 'ok', ['↑', '⌂', '↻', '⊙', '◫', '⊟', '⊡'], '⌕ ', '■ ', '∙ '],
  ['text', { glyphs: 'text' }, 'ok', ['up', 'cwd', 'sync', 'dots', 'size', 'fold', 'split'], '', '■ ', '∙ '],
]
for (const [name, options, font, labels, lens, dirGlyph, fileGlyph] of GLYPH_SETS) {
  test(`terminal regression: the ${name} glyph set draws single-cell toolbar, search and tree glyphs`, { timeoutMs: 20_000, options }, async ($, on) => {
    const root = '/Users/k/proj'
    const clock = world(on, { ...ICON_WORLD(root), font }, [])
    await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(80) })
    await clock.settle()
    const tree = await ui.drawn()
    const drawn = ['up', 'cwd', 'refresh', 'hidden', 'size', 'collapse', 'split'].map(id => {
      const props = clientProps(tree, `button-${id}`)
      return has(props, 'label') ? props.label : undefined
    })
    expect(drawn).toEqual(labels)
    if (name !== 'text') for (const l of labels) expect([...l].length).toBe(1)
    if (lens) expect(JSON.stringify(tree)).toContain(JSON.stringify(lens))
    const rows = treeRows(tree).rows
    expect(rows.find(r => r.id === `${root}/src`)?.left.map(s => s.t).slice(1, 3)).toEqual(['▸ ', dirGlyph])
    expect(rows.find(r => r.id === `${root}/README.md`)?.left.map(s => s.t)[2]).toBe(fileGlyph)
    await ui.unmount()
  })
}

test('terminal: i scopes search to the folder under the cursor, × drops it, and n cycles the Name header desc, asc, off with folders first', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const root = '/Users/k/proj'
  const clock = world(on, ICON_WORLD(root), [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const ids = async () => treeRows(await ui.drawn()).rows.map(r => r.id.slice(root.length + 1))
  expect(JSON.stringify(await ui.drawn())).toContain('"label":"Name"')
  expect(JSON.stringify(await ui.drawn())).toContain('"label":"Modified"')
  const start = await ids()
  await ui.post({ key: 'n' }, { in: 'rows' })
  await clock.settle()
  expect(await ids()).toEqual(['src', 'README.md', 'logo.png', '.gitignore'])
  expect(JSON.stringify(await ui.drawn())).toContain('"label":"Name ▾"')
  await ui.post({ key: 'n' }, { in: 'rows' })
  await clock.settle()
  expect(await ids()).toEqual(['src', '.gitignore', 'logo.png', 'README.md'])
  expect(JSON.stringify(await ui.drawn())).toContain('"label":"Name ▴"')
  await ui.post({ key: 'n' }, { in: 'rows' })
  await clock.settle()
  expect(await ids()).toEqual(start)
  await ui.post({ key: 'home' }, { in: 'rows' })
  await clock.settle()
  expect(treeRows(await ui.drawn()).active).toBe(`${root}/src`)
  expect(JSON.stringify(await ui.drawn())).toContain('"hotkey":"i"')
  await ui.post({ key: 'i' }, { in: 'rows' })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).toContain('"label":"in src/ × "')
  await ui.input({ key: 'q', text: 'a', kind: 'change' })
  await clock.settle()
  expect(await ids()).toEqual(['src', 'src/a.ts'])
  await ui.press({ key: 'scope-chip' })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).not.toContain('in src/')
  expect(await ids()).toContain('README.md')
  await ui.unmount()
})

test('terminal: toolbar icons sit a space apart, the least used drop first when narrow, and auto-collapse closes folders opened for Claude once its activity fades', { timeoutMs: 20_000, options: { glyphs: 'plain', collapse: 'on' } }, async ($, on) => {
  const root = '/Users/k/proj'
  const clock = world(on, ICON_WORLD(root), [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const shown = JSON.stringify(await ui.drawn())
  expect(shown).toContain('"gap":2},"children":[{"type":"Client","props":{"key":"button-up"')
  expect(shown).toContain('"key":"button-autocollapse"')
  const ids = async () => treeRows(await ui.drawn()).rows.map(r => r.id.slice(root.length + 1))
  await $.tool.call({ tool: 'Read', file_path: `${root}/src/b.ts` })
  await clock.settle()
  expect(await ids()).toContain('src/b.ts')
  await clock.advance(11_000)
  await clock.settle()
  expect(await ids()).not.toContain('src/b.ts')
  await $.tool.call({ tool: 'Read', file_path: `${root}/src/b.ts` })
  await clock.settle()
  await clock.advance(6_000)
  await $.tool.call({ tool: 'Read', file_path: `${root}/src/a.ts` })
  await clock.settle()
  await clock.advance(6_000)
  await clock.settle()
  expect(await ids()).toContain('src/b.ts')
  await ui.post({ press: `${root}/src/a.ts` }, { in: 'rows' })
  await clock.advance(11_000)
  await clock.settle()
  expect(await ids()).toContain('src/b.ts')
  await ui.unmount()
  const narrow = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(16) })
  await clock.settle()
  const tight = JSON.stringify(await narrow.drawn())
  expect(tight).not.toContain('"key":"button-autocollapse"')
  expect(tight).toContain('"key":"button-up"')
  await narrow.unmount()
})

test('terminal: a deleted file stays in its folder as a red struck ghost row with its -N count until committed, untracked files draw green, and the Git header says LOC', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const root = '/Users/k/proj'
  const clock = world(on, { ...ICON_WORLD(root), status: '## main\0 D gone.ts\0?? new.ts\0', numstat: '0\t7\tgone.ts\0', patch: 'diff --git a/gone.ts b/gone.ts\ndeleted file mode 100644\n--- a/gone.ts\n+++ /dev/null\n@@ -1,1 +0,0 @@\n-const gone = 1\n', dirs: { [root]: [['src', 'dir'], ['README.md', 'file'], ['new.ts', 'file']], [`${root}/src`]: [['a.ts', 'file']] } }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const tree = await ui.drawn()
  expect(JSON.stringify(tree)).toContain('"label":"Git (LOC)"')
  const rows = treeRows(tree).rows
  expect(rows.map(r => r.id.slice(root.length + 1))).toEqual(['src', 'gone.ts', 'new.ts', 'README.md'])
  const gone = rows.find(r => r.id === `${root}/gone.ts`)
  expect(gone?.left[3]).toMatchObject({ t: 'gone.ts', c: 'ansi256(1)', s: true })
  expect(gone?.right.map(s => s.t.trim())).toContain('-7')
  const fresh = rows.find(r => r.id === `${root}/new.ts`)
  expect(fresh?.left[3]).toMatchObject({ c: 'ansi256(2)' })
  expect(fresh?.left[2]).toMatchObject({ c: 'ansi256(2)' })
  await ui.post({ press: `${root}/gone.ts` }, { in: 'rows' })
  await clock.settle()
  expect(await texts(ui)).toContain('"format":"diff"')
  await ui.unmount()
})

test('desktop: a diff draws native rows with old and new line numbers, +/- markers, tinted added and removed rows and a hunk divider, not the engine Code element', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [root]: [['a.ts', 'file']] }, status: '## main\0 M a.ts\0', numstat: '', files: { '/home/k/proj/a.ts': 'const a = 1\nconst b = 3\nconst c = 4\n' }, patch: 'diff --git a/a.ts b/a.ts\nindex 1..2 100644\n--- a/a.ts\n+++ b/a.ts\n@@ -1,3 +1,3 @@\n const a = 1\n-const b = 2\n+const b = 3\n const c = 4\n' }, [])
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ press: `${root}/a.ts` }, { in: `hit:${root}/a.ts` })
  await clock.settle()
  await ui.post({ key: 'd' }, { in: `hit:${root}/a.ts` })
  await clock.settle()
  const shown = JSON.stringify(await ui.drawn())
  expect(shown).not.toContain('"format":"diff"')
  expect(shown).toContain('"children":["@@ -1,3 +1,3 @@"]')
  expect(shown).toContain('"backgroundColor":"#3fb9502e"')
  expect(shown).toContain('"backgroundColor":"#ef53502e"')
  expect(shown).toContain('"children":["const b = 2"]')
  expect(shown).toContain('"children":["const b = 3"]')
  expect(shown).toMatch(/"children":\["2"\][\s\S]*"children":\["-"\][\s\S]*"children":\["2"\][\s\S]*"children":\["\+"\]/)
  await ui.unmount()
})

test('desktop: a narrow pane drops toolbar buttons in the same order as the terminal, and the Clawd shimmer button outlasts auto-collapse, size and fold', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/Users/k/proj'
  const clock = world(on, ICON_WORLD(root), [])
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(22) })
  await clock.settle()
  const shown = JSON.stringify(await ui.drawn())
  expect(shown).not.toContain('"key":"button-autocollapse"')
  expect(shown).toContain('"key":"button-up"')
  await ui.unmount()
  const mid = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(37) })
  await clock.settle()
  const kept = JSON.stringify(await mid.drawn())
  expect(kept).not.toContain('"key":"button-autocollapse"')
  expect(kept).toContain('"key":"button-shimmer"')
  await mid.unmount()
})

test('regex search on (a+)+$ finishes at once with no match, and an over-long pattern turns .* red', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const root = '/Users/k/proj'
  const clock = world(on, { ...ICON_WORLD(root), dirs: { [root]: [['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab', 'file']] } }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ key: 'r' }, { in: 'rows' })
  await clock.settle()
  const began = Date.now()
  await ui.input({ key: 'q', text: '(a+)+$', kind: 'change' })
  await clock.settle()
  expect(Date.now() - began).toBeLessThan(2000)
  expect(treeRows(await ui.drawn()).rows.filter(r => r.id)).toEqual([])
  await ui.input({ key: 'q', text: 'a'.repeat(201), kind: 'change' })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).toMatch(/"color":"ansi256\(1\)"\},"children":\["\.\*"\]/)
  expect(treeRows(await ui.drawn()).rows.filter(r => r.id)).toEqual([])
  await ui.unmount()
})

test('m sorts each level by the value column once every value on that level is known, newest first, folders first', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const root = '/Users/k/proj'
  const clock = world(on, { ...ICON_WORLD(root), mtimes: { [`${root}/README.md`]: 1_700_000_000_000, [`${root}/logo.png`]: 1_700_000_900_000, [`${root}/.gitignore`]: 1_700_000_500_000 } }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ key: 'm' }, { in: 'rows' })
  await clock.settle()
  const ids = treeRows(await ui.drawn()).rows.map(r => r.id.slice(root.length + 1))
  expect(ids).toEqual(['src', 'logo.png', '.gitignore', 'README.md'])
  await ui.unmount()
})

test('folder dates come from one walk per folder that also dates every folder below it', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const ran: Ran = []
  const root = '/Users/k/proj'
  const clock = world(on, {
    ...ICON_WORLD(root),
    dirs: { [root]: [['src', 'dir'], ['README.md', 'file']], [`${root}/src`]: [['lib', 'dir'], ['a.ts', 'file']], [`${root}/src/lib`]: [['b.ts', 'file']] },
    newest: dir => dir === `${root}/src` ? `${1_700_000_600} ${root}/src\n${1_700_000_300} ${root}/src/lib\n` : '',
  }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ press: `${root}/src` }, { in: 'rows' })
  await clock.settle()
  const walks = () => ran.filter(a => a[0] === 'sh' && (a[2] ?? '').includes('awk -v d=')).map(a => a[4])
  expect(walks()).toEqual([`${root}/src`])
  const date = (id: string) => treeRows(tree).rows.find(r => r.id === id)?.right.map(x => x.t).join('').trim()
  const tree = await ui.drawn()
  expect(date(`${root}/src/lib`)).toBe(stamp(1_700_000_300_000))
  expect(date(`${root}/src`)).toContain(stamp(1_700_000_600_000))
  await ui.unmount()
})

test('regex search runs on a linear-time matcher: pathological patterns finish fast, supported syntax passes, backreferences and lookaround are refused', () => {
  const time = (p: string, text: string) => {
    const test = compileRegex(p, false)
    expect(test).not.toBeNull()
    const began = performance.now()
    expect(test?.(text)).toBe(false)
    return performance.now() - began
  }
  expect(time('^a+a+a+a+a+a+a+a+$', 'a'.repeat(120) + '!')).toBeLessThan(50)
  expect(time('((a+))+$', 'a'.repeat(40) + '!')).toBeLessThan(50)
  for (const p of ['(foo|bar)+', '(a+)?', '[a-z]+\\d{2}', '(foo|bar)\\.ts$', '(?:x|y){2,4}']) expect(badPattern(p, true)).toBe(false)
  for (const p of ['(((){1000}){1000}){1000}', '((a{0}){100}){100}', '(?:){50}', '((a{50}){50}){50}', 'a{101}', 'a{2,101}']) {
    const began = performance.now()
    const test = compileRegex(p, false)
    test?.('a'.repeat(200))
    expect(performance.now() - began).toBeLessThan(50)
  }
  for (const p of ['(((){1000}){1000}){1000}', '((a{50}){50}){50}', 'a{101}', 'a{2,101}']) expect(badPattern(p, true)).toBe(true)
  expect(compileRegex('((a{0}){100}){100}b', false)?.('xb')).toBe(true)
  expect(compileRegex('(?:){50}c', false)?.('c')).toBe(true)
  for (const p of ['(x)\\1', '(?=a)', '(?!a)', '(?<=a)b', '\\bword', 'a{2,1}', 'x'.repeat(201)]) expect(badPattern(p, true)).toBe(true)
})

test('the linear-time matcher agrees with RegExp on random patterns over real-looking paths', () => {
  let seed = 7
  const rand = (n: number) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed % n
  }
  const pick = <T,>(list: readonly T[]) => list[rand(list.length)] as T
  const names = ['src', 'hooks', 'tests', 'README', 'index', 'register', 'tree', 'a', 'b1', 'Foo_bar', 'x-y', '.github', 'docs', 'v2', 'Makefile']
  const exts = ['.ts', '.tsx', '.md', '.json', '', '.test.tsx', '.d.ts', '.png']
  const paths = Array.from({ length: 300 }, () => Array.from({ length: 1 + rand(4) }, () => pick(names)).join('/') + pick(exts))
  const atoms = ['a', 's', 'r', 'T', '\\.', '.', '\\d', '\\w', '\\s', '\\W', '[a-z]', '[^/]', '[A-Z0-9_]', '[.-]', '/', 'ts', 'x?', '(src|tests)', '(?:\\.ts|\\.md)', '(e|ee)']
  const quants = ['', '', '', '*', '+', '?', '{2}', '{1,}', '{0,2}', '*?', '+?']
  const gen = (depth: number): string => {
    const parts = Array.from({ length: 1 + rand(3) }, () => {
      const atom = depth < 2 && rand(4) === 0 ? `(${gen(depth + 1)})` : pick(atoms)
      return atom + pick(quants)
    })
    const body = parts.join('')
    return depth < 2 && rand(5) === 0 ? `${body}|${gen(depth + 1)}` : body
  }
  let checked = 0
  for (let k = 0; k < 400; k++) {
    const p = (rand(4) === 0 ? '^' : '') + gen(0) + (rand(4) === 0 ? '$' : '')
    for (const ci of [false, true]) {
      const ours = compileRegex(p, ci)
      if (!ours) {
        expect(() => new RegExp(p)).toThrow()
        continue
      }
      const native = new RegExp(p, ci ? 'i' : '')
      for (const path of paths) {
        expect([p, ci, path, ours(path)]).toEqual([p, ci, path, native.test(path)])
        checked += 1
      }
    }
  }
  expect(checked).toBeGreaterThan(50_000)
})

test('a slow index does not eat the regex time budget: the sole match at the end is still found', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const root = '/home/k/scratch'
  const files = Array.from({ length: 100 }, (_, i) => `${root}/f${String(i).padStart(2, '0')}.txt`)
  files[99] = `${root}/target.md`
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: files.map(f => [f.slice(root.length + 1), 'file'] as [string, 'file']) }, status: '', numstat: '', find: files.join('\0') + '\0', findDelayMs: 120 }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ key: 'r' }, { in: 'rows' })
  await clock.settle()
  await ui.input({ key: 'q', text: 'targ.t\\.md$', kind: 'change' })
  await clock.settle()
  await new Promise(r => setTimeout(r, 200))
  await clock.settle()
  expect(treeRows(await ui.drawn()).rows.map(r => r.id)).toEqual([`${root}/target.md`])
  await ui.unmount()
})

test('a hidden folder with no value never freezes the sort of its visible siblings', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const root = '/Users/k/proj'
  const clock = world(on, {
    ...ICON_WORLD(root),
    dirs: { [root]: [['.hid', 'dir'], ['src', 'dir'], ['README.md', 'file'], ['logo.png', 'file']], [`${root}/src`]: [['a.ts', 'file']], [`${root}/.hid`]: [] },
    mtimes: { [`${root}/README.md`]: 1_700_000_000_000, [`${root}/logo.png`]: 1_700_000_900_000 },
    newest: dir => (dir === `${root}/src` ? `1700000100 ${root}/src\n` : ''),
  }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  if (treeRows(await ui.drawn()).rows.some(r => r.id.endsWith('/.hid'))) await ui.press({ key: 'hidden' })
  await clock.settle()
  expect(treeRows(await ui.drawn()).rows.some(r => r.id.endsWith('/.hid'))).toBe(false)
  await ui.post({ key: 'm' }, { in: 'rows' })
  await clock.settle()
  expect(treeRows(await ui.drawn()).rows.map(r => r.id.slice(root.length + 1))).toEqual(['src', 'logo.png', 'README.md'])
  await ui.unmount()
})

test('jump ranking: every term matches in order, the last one inside the folder name, exact then prefix then contains, then frecency', () => {
  expect(jumpMatch('/home/k/git/claude-code-filetree', terms('git tree'))).toBe(true)
  expect(jumpMatch('/home/k/git/claude-code-filetree', terms('tree git'))).toBe(false)
  expect(jumpMatch('/home/k/git/claude-code-filetree/hooks', terms('tree'))).toBe(false)
  expect(jumpMatch('/home/k/Videos', terms('VID'))).toBe(true)
  const cands = [
    { path: '/home/k/vivid-video-ontology', score: 90 },
    { path: '/home/k/my-videos', score: 50 },
    { path: '/home/k/Videos', score: 1 },
    { path: '/home/k/video', score: 0 },
    { path: '/home/k/video/old', score: 99 },
  ]
  expect(rankJump(cands, 'video')).toEqual(['/home/k/video', '/home/k/Videos', '/home/k/vivid-video-ontology', '/home/k/my-videos'])
  expect(rankJump(cands, '')).toEqual(['/home/k/video/old', '/home/k/vivid-video-ontology', '/home/k/my-videos', '/home/k/Videos', '/home/k/video'])
})

test('z opens folder jump without zoxide: folders from the tree and filetree visits rank live, up/down picks, Enter re-roots, Esc cancels', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const root = '/home/k/proj'
  const ran: Ran = []
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['hooks', 'dir'], ['tests', 'dir'], ['README.md', 'file']], [`${root}/hooks`]: [['a.ts', 'file']], [`${root}/tests`]: [['hooks-e2e', 'dir'], ['t.ts', 'file']], [`${root}/tests/hooks-e2e`]: [] },
    find: `${root}/hooks/a.ts\0${root}/tests/t.ts\0${root}/tests/hooks-e2e/x.ts\0`,
    exits: { zoxide: [127, 'zoxide: not found'] },
  }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).toContain('"hotkey":"z"')
  await ui.post({ key: 'z' }, { in: 'rows' })
  await clock.settle()
  expect(ran.some(a => a[0] === 'zoxide')).toBe(true)
  expect(JSON.stringify(await ui.drawn())).toContain('"jump "')
  for (const k of ['h', 'o', 'o', 'k']) await ui.post({ key: k }, { in: 'rows' })
  await clock.settle()
  const ids = async () => treeRows(await ui.drawn()).rows.map(r => r.id)
  expect(await ids()).toEqual([`${root}/hooks`, `${root}/tests/hooks-e2e`])
  await ui.post({ key: 'down' }, { in: 'rows' })
  await clock.settle()
  expect(treeRows(await ui.drawn()).active).toBe(`${root}/tests/hooks-e2e`)
  await ui.post({ key: 'escape' }, { in: 'rows' })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).not.toContain('"jump "')
  expect(await ids()).toContain(`${root}/README.md`)
  await ui.post({ key: 'z' }, { in: 'rows' })
  for (const k of ['t', 'e', 's', 't']) await ui.post({ key: k }, { in: 'rows' })
  await clock.settle()
  await ui.post({ key: 'return' }, { in: 'rows' })
  await clock.settle()
  expect(await ids()).toEqual([`${root}/tests/hooks-e2e`, `${root}/tests/t.ts`])
  await ui.unmount()
})

test('z with zoxide installed merges its scored folders, including ones outside the root, and caches the listing', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const root = '/home/k/proj'
  const ran: Ran = []
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['hooks', 'dir']], [`${root}/hooks`]: [['a.ts', 'file']] },
    find: `${root}/hooks/a.ts\0`,
    stdout: { 'zoxide query --list': '  80.0 /home/k/other/hooks\n   2.5 /home/k/notes\n' },
  }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ key: 'z' }, { in: 'rows' })
  for (const k of ['h', 'o', 'o', 'k', 's']) await ui.post({ key: k }, { in: 'rows' })
  await clock.settle()
  expect(treeRows(await ui.drawn()).rows.map(r => r.id)).toEqual(['/home/k/other/hooks', `${root}/hooks`])
  expect(ran.filter(a => a[0] === 'zoxide').length).toBe(1)
  await ui.unmount()
})

test('a folder date scan cut short by a write is redone, so the date still appears', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const root = '/Users/k/proj'
  const clock = world(on, {
    ...ICON_WORLD(root),
    dirs: { [root]: [['src', 'dir'], ['README.md', 'file']], [`${root}/src`]: [['a.ts', 'file']] },
    newest: dir => (dir === `${root}/src` ? `1700000600 ${root}/src\n` : ''),
    newestDelay: 1000,
  }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.advance(200)
  await $.tool.call({ tool: 'Write', file_path: `${root}/README.md`, content: 'x' })
  await clock.advance(3000)
  await clock.settle()
  await clock.advance(3000)
  await clock.settle()
  const src = treeRows(await ui.drawn()).rows.find(r => r.id === `${root}/src`)
  expect(src?.right.map(x => x.t).join('')).toContain(stamp(1_700_000_600_000))
  await ui.unmount()
})

test('desktop jump mode keeps a keyboard zone with no matches, so Backspace and Esc still work, and no hotkeys compete for letters', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['hooks', 'dir'], ['README.md', 'file']], [`${root}/hooks`]: [['a.ts', 'file']] },
    find: `${root}/hooks/a.ts\0`,
    exits: { zoxide: [127, 'zoxide: not found'] },
  }, [])
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ key: 'z' }, { in: `hit:${root}/hooks` })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).not.toContain('"hotkey"')
  await ui.post({ key: 'q' }, { in: `hit:${root}/hooks` })
  await clock.settle()
  let shown = JSON.stringify(await ui.drawn())
  expect(shown).toContain('no matching folder')
  expect(shown).toContain('"key":"hit:jump-none"')
  await ui.post({ key: 'backspace' }, { in: 'hit:jump-none' })
  await clock.settle()
  shown = JSON.stringify(await ui.drawn())
  expect(shown).toContain(`"key":"hit:${root}/hooks"`)
  await ui.post({ key: 'q' }, { in: `hit:${root}/hooks` })
  await clock.settle()
  await ui.post({ key: 'escape' }, { in: 'hit:jump-none' })
  await clock.settle()
  shown = JSON.stringify(await ui.drawn())
  expect(shown).not.toContain('no matching folder')
  expect(shown).toContain('"hotkey":"z"')
  await ui.unmount()
})

test('desktop folder diff counts and draws ++x and --x content lines as added and removed, not as file headers', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [root]: [['src', 'dir']], [`${root}/src`]: [['a.c', 'file']] }, status: '## main\0 M src/a.c\0', numstat: '1\t1\tsrc/a.c\0', files: { '/home/k/proj/src/a.c': 'int x;\n++counter;\n' }, patch: 'diff --git a/src/a.c b/src/a.c\nindex 1..2 100644\n--- a/src/a.c\n+++ b/src/a.c\n@@ -1,2 +1,2 @@\n int x;\n---counter;\n+++counter;\n' }, [])
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ press: `${root}/src` }, { in: `hit:${root}/src` })
  await clock.settle()
  await ui.post({ key: 'd' }, { in: `hit:${root}/src` })
  await clock.settle()
  const shown = JSON.stringify(await ui.drawn())
  expect(shown).toContain('"children":[" +1"]')
  expect(shown).toContain('"children":[" -1"]')
  expect(shown).toContain('"children":["++counter;"]')
  expect(shown).toContain('"children":["--counter;"]')
  expect(shown).toMatch(/"children":\["-"\][\s\S]*"children":\["--counter;"\][\s\S]*"children":\["\+"\][\s\S]*"children":\["\+\+counter;"\]/)
  await ui.unmount()
})

test('Windows z jump: zoxide backslash paths are normalised, a parent-only fragment does not match, and Enter re-roots inside the drive', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const root = 'C:/Users/k/proj'
  const clock = world(on, {
    os: 'win32', env: { OS: 'Windows_NT', USERPROFILE: 'C:\\Users\\k' }, cwd: 'C:\\Users\\k\\proj', top: '',
    dirs: { [root]: [['README.md', 'file']], [`${root}/hooks`]: [['a.ts', 'file']] },
    status: '', numstat: '',
    stdout: { 'zoxide query --list': '  9.0 C:\\Users\\k\\proj\\hooks\n  3.0 C:\\Users\\k\\other\\\n' },
  }, [])
  await $.session.start({ cwd: 'C:\\Users\\k\\proj', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const ids = async () => treeRows(await ui.drawn()).rows.map(r => r.id)
  await ui.post({ key: 'z' }, { in: 'rows' })
  for (const k of 'users') await ui.post({ key: k }, { in: 'rows' })
  await clock.settle()
  expect(await ids()).toEqual([''])
  for (let k = 0; k < 5; k++) await ui.post({ key: 'backspace' }, { in: 'rows' })
  for (const k of 'oth') await ui.post({ key: k }, { in: 'rows' })
  await clock.settle()
  expect(await ids()).toEqual(['C:/Users/k/other'])
  for (let k = 0; k < 3; k++) await ui.post({ key: 'backspace' }, { in: 'rows' })
  for (const k of 'hoo') await ui.post({ key: k }, { in: 'rows' })
  await clock.settle()
  expect(await ids()).toEqual([`${root}/hooks`])
  await ui.post({ key: 'return' }, { in: 'rows' })
  await clock.settle()
  expect(await ids()).toEqual([`${root}/hooks/a.ts`])
  await ui.unmount()
})

for (const [surface, options, want] of [
  ['terminal', { open: 'preview' }, 'back'],
  ['terminal', { open: 'preview', edit: 'nvim +{line} {path}' }, 'edit'],
  ['desktop', { open: 'preview' }, 'back'],
  ['desktop', { open: 'preview', edit: 'nvim +{line} {path}' }, 'back'],
] as const) {
  test(`${surface} preview with ${options.edit ? 'an editor' : 'no editor'}: focus goes to "${want}", which is drawn as the only autofocus`, { timeoutMs: 20_000, options }, async ($, on) => {
    const root = '/home/k/proj'
    const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.ts', 'file']] }, status: '', numstat: '', files: { '/home/k/proj/a.ts': 'const a = 1\n' } }, [])
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface, component: 'Pane', requestId: 'filetree', props: paneProps(60) })
    await clock.settle()
    const where = surface === 'desktop' ? `hit:${root}/a.ts` : 'rows'
    await ui.post({ press: `${root}/a.ts` }, { in: where })
    await ui.post({ press: `${root}/a.ts` }, { in: where })
    await clock.advance(200)
    await clock.settle()
    const shown = JSON.stringify(await ui.drawn())
    expect(shown.match(/"autoFocus":true/g)?.length).toBe(1)
    expect(shown).toMatch(new RegExp(`"key":"${want}"[^}]*"autoFocus":true`))
    await ui.unmount()
  })
}

test('jump mode types through its own focused field, arrows reach it through the ring sentinels, and Enter re-roots', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['hooks', 'dir'], ['tests', 'dir']], [`${root}/hooks`]: [['a.ts', 'file']], [`${root}/tests`]: [['hooks-e2e', 'dir']], [`${root}/tests/hooks-e2e`]: [['x.ts', 'file']] },
    find: `${root}/hooks/a.ts\0${root}/tests/hooks-e2e/x.ts\0`,
    exits: { zoxide: [127, 'zoxide: not found'] },
  }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ key: 'z' }, { in: 'rows' })
  await clock.settle()
  const shown = JSON.stringify(await ui.drawn())
  expect(shown).toMatch(/"type":"Input","props":\{[^}]*"key":"jump"[^}]*"autoFocus":true|"type":"Input","props":\{[^}]*"autoFocus":true[^}]*"key":"jump"/)
  expect(shown).toContain('"key":"jump-up"')
  expect(shown).toContain('"key":"jump-down"')
  expect(shown).not.toContain('"hotkey"')
  await ui.input({ key: 'jump', text: 'hooks', kind: 'change' })
  await clock.settle()
  expect(treeRows(await ui.drawn()).rows.map(r => r.id)).toEqual([`${root}/hooks`, `${root}/tests/hooks-e2e`])
  await ui.press({ key: 'jump-down' })
  await clock.settle()
  expect(treeRows(await ui.drawn()).active).toBe(`${root}/tests/hooks-e2e`)
  await ui.input({ key: 'jump', text: 'hooks', kind: 'submit' })
  await clock.settle()
  expect(treeRows(await ui.drawn()).rows.map(r => r.id)).toEqual([`${root}/tests/hooks-e2e/x.ts`])
  await ui.unmount()
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: every toolbar button shows a non-empty hint on hover, and collapse-all and auto-collapse use different icons`, { timeoutMs: 20_000, options: { glyphs: 'nerd' } }, async ($, on) => {
    const root = '/Users/k/proj'
    const clock = world(on, ICON_WORLD(root), [])
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface, component: 'Pane', requestId: 'filetree', props: paneProps(60) })
    await clock.settle()
    const ids = ['up', 'cwd', 'refresh', 'hidden', 'size', 'collapse', 'autocollapse', ...(surface === 'terminal' ? ['split'] : ['shimmer'])]
    for (const id of ids) {
      const before = await texts(ui)
      await ui.pointer({ type: 'enter', x: 0, y: 0, in: `button-${id}` })
      await clock.settle()
      const after = JSON.stringify(await ui.drawn())
      const tip = /"wrap":"truncate-end"\},"children":\["([^"]+)"\]/.exec(after.slice(after.lastIndexOf('"wrap":"truncate-end"') - 40))?.[1] ?? ''
      expect([id, tip.trim().length > 0]).toEqual([id, true])
      expect(before).not.toBe(await texts(ui))
      await ui.pointer({ type: 'leave', x: 0, y: 0, in: `button-${id}` })
      await clock.settle()
    }
    const shown = JSON.stringify(await ui.drawn())
    if (surface === 'terminal') {
      const label = (id: string) => /"label":"([^"]*)"/.exec(shown.slice(shown.indexOf(`"key":"button-${id}"`)))?.[1]
      expect(label('collapse')).not.toBe(label('autocollapse'))
    } else expect(ICONS.fold).not.toBe(ICONS.collapse)
    await ui.unmount()
  })
}

test('a folder date walk that the engine aborts is retried, so the date still appears', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const root = '/Users/k/proj'
  const clock = world(on, {
    ...ICON_WORLD(root),
    dirs: { [root]: [['docs', 'dir'], ['README.md', 'file']], [`${root}/docs`]: [['a.md', 'file']] },
    newest: dir => (dir === `${root}/docs` ? `1700000600 ${root}/docs\n` : ''),
    newestAbortOnce: [`${root}/docs`],
  }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await clock.advance(100)
  await clock.settle()
  const docs = treeRows(await ui.drawn()).rows.find(r => r.id === `${root}/docs`)
  expect(docs?.right.map(x => x.t).join('')).toContain(stamp(1_700_000_600_000))
  await ui.unmount()
})

test('deleted files under an ignored name never come back as ghost rows or in the rolled-up counts', { timeoutMs: 20_000, options: { glyphs: 'plain', ignore: 'vendor' } }, async ($, on) => {
  const root = '/Users/k/proj'
  const clock = world(on, { ...ICON_WORLD(root), status: '## main\0 D vendor/x.ts\0 D gone.ts\0', numstat: '0\t5\tvendor/x.ts\0' + '0\t2\tgone.ts\0', dirs: { [root]: [['README.md', 'file'], ['vendor', 'dir']], [`${root}/vendor`]: [] } }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const shown = JSON.stringify(await ui.drawn())
  const ids = treeRows(await ui.drawn()).rows.map(r => r.id.slice(root.length + 1))
  expect(ids).toContain('gone.ts')
  expect(ids.some(id => id.startsWith('vendor'))).toBe(false)
  expect(shown).toContain('"t":" -2"')
  expect(shown).not.toContain('" -7"')
  expect(shown).toContain('" D:1"')
  await ui.unmount()
})

test('jump mode closes when the pane loses the keyboard and never pulls focus back from the prompt', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['hooks', 'dir']], [`${root}/hooks`]: [['a.ts', 'file']] },
    find: `${root}/hooks/a.ts\0`,
    exits: { zoxide: [127, 'zoxide: not found'] },
  }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const focused = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: { ...paneProps(60), isFocused: true } })
  await clock.settle()
  await focused.post({ key: 'z' }, { in: 'rows' })
  await clock.advance(100)
  await clock.settle()
  expect(JSON.stringify(await focused.drawn())).toContain('"key":"jump"')
  await focused.unmount()
  const before = opens.length
  const blurred = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.advance(600)
  await clock.settle()
  expect(JSON.stringify(await blurred.drawn())).not.toContain('"key":"jump"')
  expect(opens.slice(before).some(o => has(o, 'focus') && o.focus === true)).toBe(false)
  await blurred.unmount()
})

test('a LOC scan that the engine aborts is retried, so the folder still shows its line count', { timeoutMs: 20_000, options: { column: 'loc' } }, async ($, on) => {
  const root = '/Users/k/proj'
  const clock = world(on, {
    os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['src', 'dir']], [`${root}/src`]: [['a.ts', 'file']] },
    loc: { [`${root}/src`]: `${root}/src/a.ts:10\n` },
    locAbortOnce: [`${root}/src`],
  }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await clock.advance(100)
  await clock.settle()
  const src = treeRows(await ui.drawn()).rows.find(r => r.id === `${root}/src`)
  expect(src?.right.map(x => x.t).join('').trim()).toBe('10')
  await ui.unmount()
})

for (const [long, red] of [[undefined, ['big.ts']], ['50', ['big.ts', 'mid.ts']], ['off', []]] as const) {
  test(`loc column: Long file ${long ?? 'default'} draws the line count of longer files in red`, { timeoutMs: 20_000, options: { column: 'loc', ...(long ? { long } : {}) } }, async ($, on) => {
    const root = '/Users/k/proj'
    const clock = world(on, {
      os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: '', status: '', numstat: '',
      dirs: { [root]: [['big.ts', 'file'], ['mid.ts', 'file'], ['small.ts', 'file']] },
      loc: { [`${root} 1`]: `${root}/big.ts:600\n${root}/mid.ts:80\n${root}/small.ts:12\n`, [root]: `${root}/big.ts:600\n${root}/mid.ts:80\n${root}/small.ts:12\n` },
    }, [])
    await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
    await clock.settle()
    await clock.advance(100)
    await clock.settle()
    const rows = treeRows(await ui.drawn()).rows
    for (const name of ['big.ts', 'mid.ts', 'small.ts']) {
      const cell = rows.find(r => r.id === `${root}/${name}`)?.right.find(x => /\d/.test(x.t))
      expect(cell?.c === 'ansi256(1)').toBe((red as readonly string[]).includes(name))
    }
    await ui.unmount()
  })
}

test('desktop: in a 1000-row tree End and a reveal at row 900 both draw their target row', { timeoutMs: 30_000 }, async ($, on) => {
  const root = '/Users/k/huge'
  const names = Array.from({ length: 1000 }, (_, i): [string, 'file'] => [`f${String(i).padStart(4, '0')}.txt`, 'file'])
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: '', dirs: { [root]: names }, status: '', numstat: '' }, [])
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  expect(deskRows(await ui.drawn())).toContain(`${root}/f0000.txt`)
  await ui.post({ key: 'end' }, { in: `hit:${root}/f0000.txt` })
  await clock.settle()
  let tree = await ui.drawn()
  expect(deskRows(tree)).toContain(`${root}/f0999.txt`)
  expect(JSON.stringify(tree)).toContain('rows above')
  await ui.post({ key: 'home' }, { in: `hit:${root}/f0999.txt` })
  await clock.settle()
  await $.tool.call({ tool: 'Read', file_path: `${root}/f0900.txt` })
  await clock.settle()
  tree = await ui.drawn()
  expect(deskRows(tree)).toContain(`${root}/f0900.txt`)
  await ui.unmount()
})

test('desktop: in LOC mode a window past the first 400 rows still measures and draws the LOC column for the rows it shows', { timeoutMs: 30_000, options: { column: 'loc' } }, async ($, on) => {
  const root = '/Users/k/huge'
  const names = Array.from({ length: 1000 }, (_, i): [string, 'file'] => [i < 400 ? `a${String(i).padStart(4, '0')}.png` : `c${String(i).padStart(4, '0')}.ts`, 'file'])
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: '', dirs: { [root]: names }, status: '', numstat: '', loc: { [`${root} 1`]: names.filter(([n]) => n.endsWith('.ts')).map(([n]) => `${root}/${n}:42\n`).join('') } }, [])
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await $.tool.call({ tool: 'Read', file_path: `${root}/c0900.ts` })
  await clock.settle()
  await ui.post({ press: `${root}/c0900.ts` }, { in: `hit:${root}/c0900.ts` })
  await clock.settle()
  const tree = await ui.drawn()
  expect(deskRows(tree)).toContain(`${root}/c0900.ts`)
  const shown = JSON.stringify(tree)
  const row = JSON.stringify(every(tree, n => has(n, 'type') && n.type === 'Box' && keyOf(n) === `row:${root}/c0900.ts`)[0])
  expect(shown).toContain('"children":["LOC"]')
  expect(row).toContain('"children":["42"]')
  await ui.unmount()
})

const MEMORY_WORLD = (root: string): World => ({
  os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: root,
  dirs: { [root]: [['.claude', 'dir'], ['AGENTS.md', 'file'], ['CLAUDE.md', 'file'], ['README.md', 'file']], [`${root}/.claude`]: [['rules', 'dir']], [`${root}/.claude/rules`]: [['x.md', 'file']] },
  status: '## main\0', numstat: '',
})

for (const [set, surface, brain, markdown] of [['nerd', 'terminal', '\u{f09d1} ', '\u{f0354} '], ['plain', 'terminal', '§ ', '∙ '], ['auto', 'desktop', '', '']] as const) {
  test(`${surface} ${set} glyphs: AGENTS.md, CLAUDE.md and .claude/rules/*.md draw a brain, README.md keeps the markdown icon`, { timeoutMs: 20_000, options: { glyphs: set } }, async ($, on) => {
    const root = '/Users/k/proj'
    const clock = world(on, MEMORY_WORLD(root), [])
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface, component: 'Pane', requestId: 'filetree', props: paneProps(60) })
    await clock.settle()
    await $.tool.call({ tool: 'Read', file_path: `${root}/.claude/rules/x.md` })
    await clock.settle()
    const tree = await ui.drawn()
    const memory = [`${root}/AGENTS.md`, `${root}/CLAUDE.md`, `${root}/.claude/rules/x.md`]
    if (surface === 'terminal') {
      const glyph = (id: string) => treeRows(tree).rows.find(r => r.id === id)?.left[2]?.t
      for (const id of memory) expect([id, glyph(id)]).toEqual([id, brain])
      expect(glyph(`${root}/README.md`)).toBe(markdown)
    } else {
      const icon = (name: string) => svgs(tree).find(s => s.alt === `file ${name}`)?.source ?? ''
      for (const name of ['AGENTS.md', 'CLAUDE.md', 'x.md']) expect([name, icon(name).includes(ICONS.brain)]).toEqual([name, true])
      expect(icon('README.md')).toContain(ICONS['file-text'])
      expect(icon('README.md')).not.toContain(ICONS.brain)
    }
    await ui.unmount()
  })
}

const GUARD_WORLD = (root: string): World => ({
  os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root,
  dirs: { [root]: [['secret', 'dir'], ['src', 'dir'], ['notes.md', 'file']], [`${root}/secret`]: [['key.ts', 'file']], [`${root}/src`]: [['a.ts', 'file']], '/home/k/other': [['out.md', 'file']] },
  status: '## main\0', numstat: '',
})

test('x guards the folder under the cursor: an x glyph, kept across sessions, Edit and Write under it denied naming it, Bash naming it asks, x again lifts it', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, GUARD_WORLD(root), [])
  on('tool.check', () => ({ decision: 'allow' }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  const start = async () => {
    await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
    await clock.settle()
    return ui
  }
  const glyph = async (ui: Awaited<ReturnType<typeof start>>, id: string) => treeRows(await ui.drawn()).rows.find(r => r.id === id)?.left[2]
  let ui = await start()
  expect((await glyph(ui, `${root}/secret`))?.t).toBe('■ ')
  expect(await ui.find({ key: 'nav-x' })).toBeUndefined()
  await ui.post({ press: `${root}/secret` }, { in: 'rows' })
  await ui.post({ key: 'x' }, { in: 'rows' })
  await clock.settle()
  expect(await glyph(ui, `${root}/secret`)).toEqual({ t: '× ', c: 'ansi256(1)' })
  expect((await glyph(ui, `${root}/src`))?.t).toBe('■ ')
  await ui.unmount()
  await $.session.end({ reason: 'clear', sessionId: 'test-session', resume: { id: 'test-session' } })
  ui = await start()
  expect((await glyph(ui, `${root}/secret`))?.t).toBe('× ')
  const edit = await $.tool.check({ tool: 'Edit', input: { file_path: `${root}/secret/key.ts`, old_string: 'a', new_string: 'b' } })
  expect(edit.decision).toBe('deny')
  expect(edit.reason).toContain('~/proj/secret is guarded')
  const write = await $.tool.check({ tool: 'Write', input: { file_path: 'secret/new.ts', content: 'x' } })
  expect(write.decision).toBe('deny')
  expect((await $.tool.check({ tool: 'Write', input: { file_path: `${root}/src/a.ts`, content: 'x' } })).decision).toBe('allow')
  expect((await $.tool.check({ tool: 'Write', input: { file_path: `${root}/secretive.ts`, content: 'x' } })).decision).toBe('allow')
  const bash = await $.tool.check({ tool: 'Bash', input: { command: 'sed -i s/a/b/ secret/key.ts' } })
  expect(bash.decision).toBe('ask')
  expect(bash.reason).toContain('only reads the command text')
  expect((await $.tool.check({ tool: 'Bash', input: { command: `cat ${root}/secret` } })).decision).toBe('ask')
  expect((await $.tool.check({ tool: 'Bash', input: { command: 'ls src secrets' } })).decision).toBe('allow')
  await clock.advance(1000)
  await ui.post({ press: `${root}/secret` }, { in: 'rows' })
  await ui.post({ key: 'x' }, { in: 'rows' })
  await clock.settle()
  expect((await glyph(ui, `${root}/secret`))?.t).toBe('■ ')
  expect((await $.tool.check({ tool: 'Edit', input: { file_path: `${root}/secret/key.ts`, old_string: 'a', new_string: 'b' } })).decision).toBe('allow')
  await ui.unmount()
})

test('desktop: a guarded file draws the vector x icon in red', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, GUARD_WORLD(root), [])
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ press: `${root}/notes.md` }, { in: `hit:${root}/notes.md` })
  await clock.settle()
  await ui.press({ key: 'hk-x' })
  await clock.settle()
  const icon = svgs(await ui.drawn()).find(s => s.alt === 'guarded file notes.md')?.source ?? ''
  expect(icon).toContain(ICONS.x)
  expect(icon).toContain('#ef5350')
  await ui.unmount()
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: Edit, Write and NotebookEdit outside the repo, by Claude or a subagent, count in a header badge with one toast, and the badge lists the paths`, { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
    const ran: Ran = []
    const root = '/home/k/proj'
    const clock = world(on, GUARD_WORLD(root), ran)
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface, component: 'Pane', requestId: 'filetree', props: paneProps(60) })
    await clock.settle()
    await $.tool.call({ tool: 'Write', file_path: `${root}/src/a.ts`, content: 'x' })
    await $.tool.call({ tool: 'Bash', command: 'echo x > /home/k/other/shell.md' })
    await clock.settle()
    expect(await ui.find({ key: 'button-outside' })).toBeUndefined()
    await $.tool.call({ tool: 'Write', file_path: '/home/k/other/out.md', content: 'x' })
    await clock.settle()
    expect(ran.filter(a => a[0] === 'toast')).toEqual([['toast', 'Claude wrote outside ~/proj: ~/other/out.md. w lists these writes.']])
    if (surface === 'terminal') expect(clientProps(await ui.drawn(), 'button-outside')).toEqual({ id: 'outside', label: '⚠ 1', dim: false, color: 'ansi256(3)' })
    else expect(svgs(await ui.drawn()).some(s => s.alt === 'outside button' && s.source.includes(ICONS.warning))).toBe(true)
    await $.tool.call({ tool: 'Edit', file_path: '/home/k/other/out.md', old_string: 'x', new_string: 'y' })
    await $.tool.call({ tool: 'NotebookEdit', notebook_path: '/home/k/other/nb.ipynb', new_source: 'x', agentId: 'sub-1' } as unknown as Parameters<Engine['tool']['call']>[0])
    await clock.settle()
    expect(ran.filter(a => a[0] === 'toast').length).toBe(1)
    if (surface === 'terminal') expect(clientProps(await ui.drawn(), 'button-outside')).toMatchObject({ label: '⚠ 2' })
    else expect(JSON.stringify(await ui.drawn())).toContain('"children":["2 "]')
    await (surface === 'desktop' ? tap(ui, 'outside') : ui.post({ key: 'w' }, { in: 'rows' }))
    await clock.settle()
    const listed = await texts(ui)
    expect(listed).toContain('~/other/out.md\\n~/other/nb.ipynb')
    expect(listed).toContain('2 files Claude wrote outside the repo this session')
    expect(listed).not.toContain('shell.md')
    expect(await ui.find({ key: 'pv-d' })).toBeUndefined()
    await ui.unmount()
  })
}

const WORK_WORLD = (a: string, b: string, os: World['os'] = 'linux'): World => ({
  os, env: os === 'win32' ? { OS: 'Windows_NT', USERPROFILE: 'C:\\Users\\k' } : { HOME: '/home/k' }, cwd: a, top: a,
  dirs: { [a]: [['src', 'dir'], ['a.ts', 'file']], [`${a}/src`]: [['x.ts', 'file']], [b]: [['b.ts', 'file'], ['c.ts', 'file'], ['d.ts', 'file'], ['e.ts', 'file']] },
  status: '## main\0', numstat: '', tops: { [a]: a, [b]: b },
})

async function workSession($: Engine, on: On, w: World, ran: Ran) {
  const clock = world(on, w, ran)
  on('command.run', async (_$, e, next) => {
    if (e.command !== 'cd') return next(e)
    ran.push(['cd', e.args])
    w.cwd = e.args
    return {}
  })
  await $.session.start({ cwd: w.cwd, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const root = async () => treeRows(await ui.drawn()).rows[0]?.id ?? ''
  const reads = async (dir: string) => {
    for (const f of ['b.ts', 'c.ts', 'd.ts', 'e.ts']) await $.tool.call({ tool: 'Read', file_path: `${dir}/${f}` })
    await clock.advance(1000)
    await clock.settle()
  }
  return { clock, ui, root, reads }
}

test('Follow work from a pinned root: four reads in another repo move Claude there with /cd and re-root the tree, though /filetree pinned it', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const a = '/home/k/a', b = '/home/k/b'
  const ran: Ran = []
  const { ui, root, reads, clock } = await workSession($, on, WORK_WORLD(a, b), ran)
  await $.command.run({ command: 'filetree', args: `${a}/src`, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } })
  await clock.settle()
  expect(await root()).toBe(`${a}/src/x.ts`)
  await reads(b)
  expect(ran).toContainEqual(['cd', b])
  expect(await root()).toBe(`${b}/b.ts`)
  await ui.unmount()
})

test('Follow work with Jump moves Claude set to tree: the tree moves to the busy repo and back again, and Claude never moves', { timeoutMs: 20_000, options: { glyphs: 'plain', jump: 'tree' } }, async ($, on) => {
  const a = '/home/k/a', b = '/home/k/b'
  const w = WORK_WORLD(a, b)
  w.dirs[a] = [['b.ts', 'file'], ['c.ts', 'file'], ['d.ts', 'file'], ['e.ts', 'file']]
  const ran: Ran = []
  const { ui, root, reads, clock } = await workSession($, on, w, ran)
  await reads(b)
  expect(await root()).toBe(`${b}/b.ts`)
  await clock.advance(200_000)
  await reads(a)
  expect(await root()).toBe(`${a}/b.ts`)
  expect(ran.some(r => r[0] === 'cd')).toBe(false)
  await ui.unmount()
})

test('Follow work on Windows: reads under another drive-letter repo count as work and move Claude there', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const a = 'C:/Users/k/a', b = 'C:/Users/k/b'
  const ran: Ran = []
  const { ui, reads } = await workSession($, on, WORK_WORLD(a, b, 'win32'), ran)
  await reads(b)
  expect(ran).toContainEqual(['cd', b])
  await ui.unmount()
})

test('x on a guarded path seen from the parent folder lifts the guard set inside the repo, instead of adding a second one', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const root = '/home/k/proj'
  const w = GUARD_WORLD(root)
  w.dirs['/home/k'] = [['proj', 'dir'], ['other', 'dir']]
  w.tops = { [root]: root }
  const clock = world(on, w, [])
  on('tool.check', () => ({ decision: 'allow' }))
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const glyph = async (id: string) => treeRows(await ui.drawn()).rows.find(r => r.id === id)?.left[2]?.t
  const edit = () => $.tool.check({ tool: 'Edit', input: { file_path: `${root}/secret/key.ts`, old_string: 'a', new_string: 'b' } })
  await ui.post({ press: `${root}/secret` }, { in: 'rows' })
  await ui.post({ key: 'x' }, { in: 'rows' })
  await clock.settle()
  expect((await edit()).decision).toBe('deny')
  await $.command.run({ command: 'filetree', args: '/home/k', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } })
  await clock.settle()
  await ui.post({ press: root }, { in: 'rows' })
  await ui.post({ key: 'l' }, { in: 'rows' })
  await clock.settle()
  expect(await glyph(`${root}/secret`)).toBe('× ')
  await clock.advance(1000)
  await ui.post({ press: `${root}/secret` }, { in: 'rows' })
  await ui.post({ key: 'x' }, { in: 'rows' })
  await clock.settle()
  expect(await glyph(`${root}/secret`)).toBe('■ ')
  expect((await edit()).decision).toBe('allow')
  await ui.unmount()
})

test('Follow work reads shell commands: absolute, home, drive-letter and relative paths with a slash count, flags and bare words do not', () => {
  expect(shellPaths('touch src/a.ts && sed -i s/x/y/ ../b/c.ts', '/home/k/a', '/home/k')).toEqual(['/home/k/a/src/a.ts', '/home/k/a/s/x/y', '/home/k/a/../b/c.ts'])
  expect(shellPaths('cat /etc/hosts ~/notes.md -n README', '/home/k/a', '/home/k')).toEqual(['/etc/hosts', '/home/k/notes.md'])
  expect(shellPaths('Get-Content C:\\Users\\k\\b\\x.ts; type D:/data/y.csv', 'C:/Users/k/a', 'C:/Users/k')).toEqual(['C:/Users/k/b/x.ts', 'D:/data/y.csv'])
  expect(shellPaths('cd lib', '/home/k/a', '/home/k')).toEqual(['/home/k/a/lib'])
  expect(shellPaths('curl https://x.test/a -o out', '/home/k/a', '/home/k')).toEqual([])
})

test('Follow work ignores temporary folders on Linux, macOS and Windows', () => {
  for (const p of ['/tmp/x/repo', '/var/folders/ab/T/repo', 'C:/Users/k/AppData/Local/Temp/repo', 'C:/Windows/Temp/repo']) expect(workIgnored(p, p.startsWith('C:') ? 'C:/Users/k' : '/home/k')).toBe(true)
  for (const p of ['/home/k/a', 'C:/Users/k/a', 'D:/Temp/repo']) expect(workIgnored(p, p.startsWith('/') ? '/home/k' : 'C:/Users/k')).toBe(false)
})

test('a guard holds through a symlink into a folder that does not exist yet, so Write cannot create files inside the guarded folder by an alias', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const root = '/home/k/proj'
  const w = GUARD_WORLD(root)
  w.real = { '/home/k/alias': `${root}/secret` }
  const clock = world(on, w, [])
  on('tool.check', () => ({ decision: 'allow' }))
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ press: `${root}/secret` }, { in: 'rows' })
  await ui.post({ key: 'x' }, { in: 'rows' })
  await clock.settle()
  const write = (file_path: string) => $.tool.check({ tool: 'Write', input: { file_path, content: 'x' } })
  expect((await write('/home/k/alias/key.ts')).decision).toBe('deny')
  expect((await write('/home/k/alias/new/deeper/file.txt')).decision).toBe('deny')
  expect((await write('/home/k/other/new/file.txt')).decision).toBe('allow')
  await ui.unmount()
})

test('failed shell calls into another repo never count as work: neither Claude nor the tree moves', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const a = '/home/k/a', b = '/home/k/b'
  const w = WORK_WORLD(a, b)
  w.tool = e => (e.tool === 'Bash' ? { isError: true, result: 'Exit code 1' } : undefined)
  const ran: Ran = []
  const { ui, root, clock } = await workSession($, on, w, ran)
  for (let i = 0; i < 6; i++) await $.tool.call({ tool: 'Bash', command: `touch ${b}/b.ts ${b}/c.ts` })
  await clock.advance(1000)
  await clock.settle()
  expect(ran.some(r => r[0] === 'cd')).toBe(false)
  expect(await root()).toBe(`${a}/src`)
  await ui.unmount()
})

test('Follow work starts over in a new or resumed session: reads from the last session never add up to a move', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const a = '/home/k/a', b = '/home/k/b'
  const ran: Ran = []
  const w = WORK_WORLD(a, b)
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  const { ui, clock } = await workSession($, on, w, ran)
  for (const f of ['b.ts', 'c.ts', 'd.ts']) await $.tool.call({ tool: 'Read', file_path: `${b}/${f}` })
  await clock.settle()
  await ui.unmount()
  await $.session.end({ reason: 'resume', sessionId: 'test-session', resume: { id: 'other-session' } })
  await $.session.start({ cwd: a, surface: 'terminal', isInteractive: true })
  await clock.settle()
  await $.tool.call({ tool: 'Read', file_path: `${b}/e.ts` })
  await clock.advance(1000)
  await clock.settle()
  expect(ran.some(r => r[0] === 'cd')).toBe(false)
})

test('the contents toggle searches file contents, groups matches per file, opens the split at the line and caps the results', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const w: World = {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, status: '## main\0', numstat: '',
    dirs: { [root]: [['src', 'dir'], ['b.md', 'file']], [`${root}/src`]: [['a.ts', 'file']] },
    files: { [`${root}/src/a.ts`]: Array.from({ length: 60 }, (_, i) => `line ${i + 1}`).join('\n') },
    grep: 'src/a.ts\x0040\x00  const needle = 1\nsrc/a.ts\x0045\x00needle()\nb.md\x002\x00a needle\n',
  }
  const clock = world(on, w, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.press({ key: 'search-content' })
  await ui.input({ key: 'q', text: 'needle', kind: 'change' })
  await clock.settle()
  await clock.advance(200)
  await clock.settle()
  expect(ran.find(a => a[0] === 'git' && a.includes('grep'))?.slice(4)).toEqual(['grep', '-n', '-I', '-z', '--no-color', '--no-column', '--no-full-name', '--untracked', '-i', '-F', '-e', 'needle', '--', '.'])
  const rows = treeRows(await ui.drawn()).rows
  expect(rows.map(r => r.id)).toEqual([`grep:0:${root}/src/a.ts`, `grep:40:${root}/src/a.ts`, `grep:45:${root}/src/a.ts`, `grep:0:${root}/b.md`, `grep:2:${root}/b.md`])
  expect(rows[1]?.left.map(s => s.t).join('')).toBe('    40  const needle = 1')
  expect(rows[0]?.right.map(s => s.t).join('')).toContain('2')
  await ui.post({ key: 'j' }, { in: 'rows' })
  await ui.post({ key: 'return' }, { in: 'rows' })
  await clock.settle()
  expect(peekOf(await ui.drawn()).preview.startLine).toBe(38)
  await ui.post({ press: `grep:45:${root}/src/a.ts` }, { in: 'rows' })
  await clock.settle()
  expect(peekOf(await ui.drawn()).preview.startLine).toBe(43)
  expect(treeRows(await ui.drawn()).active).toBe(`grep:45:${root}/src/a.ts`)
  w.grep = `${Array.from({ length: 250 }, (_, i) => `b.md\x00${i + 1}\x00needle ${i}`).join('\n')}\n`
  await ui.input({ key: 'q', text: 'needles', kind: 'change' })
  await clock.settle()
  await clock.advance(200)
  await clock.settle()
  const capped = treeRows(await ui.drawn()).rows
  expect(capped.at(-1)?.left[0]?.t).toBe('first 200 matches; keep typing to narrow')
  const desktop = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const drawn = JSON.stringify(await desktop.drawn())
  expect(drawn).toContain(`hit:grep:1:${root}/b.md`)
  expect(drawn).toMatch(/first 150 of \d+ rows; keep typing to narrow/)
  await desktop.post({ press: `grep:3:${root}/b.md` }, { in: `hit:grep:3:${root}/b.md` })
  await clock.settle()
  expect(JSON.stringify(await desktop.drawn())).toContain('pv-head')
  await desktop.press({ key: 'back' })
  await clock.settle()
  await ui.input({ key: 'q', text: '', kind: 'change' })
  await clock.settle()
  expect(treeRows(await ui.drawn()).rows.some(r => r.id.startsWith('grep:'))).toBe(false)
  await desktop.unmount()
  await ui.unmount()
})

test('v marks rows: y and Y copy every mark, the marks go to Claude, V clears them, on the terminal and the desktop', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, status: '## main\0', numstat: '', dirs: { [root]: [['src', 'dir'], ['a.txt', 'file'], ['b.txt', 'file']], [`${root}/src`]: [['c.ts', 'file']] } }, [])
  const copied: string[] = []
  on('ui.copy', (_$, e) => {
    copied.push(e.text)
    return { value: { isCopied: true } }
  })
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ press: `${root}/a.txt` }, { in: 'rows' })
  await ui.post({ key: 'v' }, { in: 'rows' })
  await ui.post({ key: 'k' }, { in: 'rows' })
  await ui.post({ key: 'v' }, { in: 'rows' })
  await clock.settle()
  const lit = (rows: RowsProps) => rows.rows.filter(r => r.on).map(r => r.id)
  expect(lit(treeRows(await ui.drawn()))).toEqual([`${root}/src`, `${root}/a.txt`])
  expect(JSON.stringify(await ui.drawn())).toContain('2 marked')
  for (const key of ['y', 'Y']) await ui.post({ key }, { in: 'rows' })
  await clock.settle()
  expect(copied).toEqual(['a.txt\nsrc', `${root}/a.txt\n${root}/src`])
  const sent = await $.prompt.submit({ text: 'compare these', wait: false, origin: { kind: 'composer' } })
  expect(JSON.stringify(sent)).toContain(`marked these entries in the file tree; \\"these\\" or \\"them\\" in the prompt likely refers to them:\\n${root}/a.txt\\n${root}/src`)
  await ui.post({ key: 'V' }, { in: 'rows' })
  await clock.settle()
  expect(lit(treeRows(await ui.drawn()))).toEqual([`${root}/src`])
  expect(JSON.stringify(await ui.drawn())).not.toContain(' marked')
  const desktop = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await desktop.pointer({ type: 'down', x: 0, y: 0, button: 'left', in: `hit:${root}/b.txt` })
  await desktop.pointer({ type: 'up', x: 0, y: 0, button: 'left', in: `hit:${root}/b.txt` })
  await desktop.post({ key: 'v' }, { in: `hit:${root}/b.txt` })
  await clock.settle()
  expect(JSON.stringify(await desktop.drawn())).toContain('1 marked')
  await desktop.post({ key: 'V' }, { in: `hit:${root}/b.txt` })
  await clock.settle()
  expect(JSON.stringify(await desktop.drawn())).not.toContain(' marked')
  await desktop.unmount()
  await ui.unmount()
})

const RANGE_WORLD = (root: string): World => ({ os: 'darwin', env: { HOME: '/home/k' }, cwd: root, top: root, status: '## main\0', numstat: '', dirs: { [root]: [['src', 'dir'], ['a.txt', 'file'], ['b.txt', 'file'], ['c.txt', 'file'], ['d.txt', 'file']], [`${root}/src`]: [['e.ts', 'file']] } })

type Mods = { shift?: true; ctrl?: true; alt?: true }

async function rangeMount($: Engine, surface: 'terminal' | 'desktop') {
  const ui = await $.ui.mount({ plugin: 'filetree', surface, component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  const zone = (id: string) => ({ in: surface === 'desktop' ? `hit:${id}` : 'rows' })
  const click = async (id: string, mods: Mods = {}) => {
    const y = surface === 'desktop' ? 0 : treeRows(await ui.drawn()).rows.findIndex(r => r.id === id)
    const at = { x: 2, y, button: 'left' as const, ...mods, ...zone(id) }
    await ui.pointer({ type: 'down', ...at })
    await ui.pointer({ type: 'up', ...at })
  }
  const shaded = async (): Promise<{ id: string; bg: string }[]> => {
    const tree = await ui.drawn()
    if (surface === 'desktop') {
      return every(tree, n => has(n, 'type') && n.type === 'Box' && keyOf(n).startsWith('row:')).flatMap(n => {
        const props = propsOf(n)
        return has(props, 'backgroundColor') && typeof props.backgroundColor === 'string' && props.backgroundColor !== DESK.cursor ? [{ id: keyOf(n).slice(4), bg: props.backgroundColor }] : []
      })
    }
    const specs = treeRows(tree).rows
    return kids(await ui.drawn({ in: 'rows' })).flatMap((box, i) => {
      const props = propsOf(box)
      return has(props, 'backgroundColor') && typeof props.backgroundColor === 'string' ? [{ id: specs[i]?.id ?? '', bg: props.backgroundColor }] : []
    })
  }
  const marked = async () => (await shaded()).map(s => s.id.split('/').pop() ?? '')
  const selBg = async () => (surface === 'desktop' ? [...new Set((await shaded()).map(s => s.bg))] : [treeRows(await ui.drawn()).activeBg])
  return { ui, zone, click, marked, shaded, selBg }
}

const sentTo = async ($: Engine) => JSON.stringify(await $.prompt.submit({ text: 'look at these', wait: false, origin: { kind: 'composer' } }))

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a click selects one row, shift+click selects the range from the anchor in tree order, and every selected row gets the selection background, on the ${surface}`, { timeoutMs: 20_000 }, async ($, on) => {
    const root = '/home/k/proj'
    const ran: Ran = []
    const clock = world(on, RANGE_WORLD(root), ran)
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const { click, marked, shaded, selBg, ui } = await rangeMount($, surface)
    await clock.settle()
    await click(`${root}/d.txt`)
    await clock.settle()
    expect(await marked()).toEqual(['d.txt'])
    const one = await selBg()
    expect(one).toHaveLength(1)
    expect(one[0]).not.toBe('')
    await clock.advance(1000)
    await click(`${root}/a.txt`, { shift: true })
    await clock.settle()
    expect(await marked()).toEqual(['a.txt', 'b.txt', 'c.txt', 'd.txt'])
    expect([...new Set((await shaded()).map(s => s.bg))]).toEqual(one)
    expect(JSON.stringify(await ui.drawn())).not.toContain('"alt":"marked ')
    await click(`${root}/src`, { shift: true })
    await clock.settle()
    expect(await marked()).toEqual(['src', 'a.txt', 'b.txt', 'c.txt', 'd.txt'])
    await click(`${root}/c.txt`, { shift: true })
    await clock.settle()
    expect(await marked()).toEqual(['c.txt', 'd.txt'])
    const sent = await sentTo($)
    expect(sent).toContain(`marked these entries in the file tree; \\"these\\" or \\"them\\" in the prompt likely refers to them:\\n${root}/c.txt\\n${root}/d.txt`)
    expect(sent).not.toContain('selected in the file tree')
    await clock.advance(1000)
    await click(`${root}/b.txt`)
    await clock.settle()
    expect(await marked()).toEqual(['b.txt'])
    expect(await sentTo($)).not.toContain('marked these entries')
    expect(ran.some(a => a[0] === 'open')).toBe(false)
    await ui.unmount()
  })

  test(`ctrl+click and alt+click on macOS add or drop one row and open nothing, on the ${surface}`, { timeoutMs: 20_000 }, async ($, on) => {
    const root = '/home/k/proj'
    const ran: Ran = []
    const clock = world(on, RANGE_WORLD(root), ran)
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const { click, marked, ui } = await rangeMount($, surface)
    await clock.settle()
    await click(`${root}/a.txt`)
    await clock.advance(1000)
    await click(`${root}/c.txt`, { ctrl: true })
    await clock.settle()
    expect(await marked()).toEqual(['a.txt', 'c.txt'])
    expect(await sentTo($)).toContain(`refers to them:\\n${root}/a.txt\\n${root}/c.txt`)
    await click(`${root}/b.txt`, { ctrl: true })
    await clock.settle()
    expect(await marked()).toEqual(['a.txt', 'b.txt', 'c.txt'])
    await click(`${root}/a.txt`, { ctrl: true })
    await clock.settle()
    expect(await marked()).toEqual(['b.txt', 'c.txt'])
    await click(`${root}/c.txt`, { alt: true })
    await clock.settle()
    expect(await marked()).toEqual(['b.txt'])
    await click(`${root}/b.txt`, { ctrl: true })
    await clock.settle()
    expect(await marked()).toEqual([])
    const sent = await sentTo($)
    expect(sent).not.toContain('marked these entries')
    expect(sent).not.toContain('selected in the file tree')
    expect(ran.some(a => a[0] === 'open')).toBe(false)
    await ui.unmount()
  })

  test(`the clear selection button clears every selected row, on the ${surface}`, { timeoutMs: 20_000 }, async ($, on) => {
    const root = '/home/k/proj'
    const clock = world(on, RANGE_WORLD(root), [])
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const { click, marked, ui } = await rangeMount($, surface)
    await clock.settle()
    await click(`${root}/a.txt`)
    await click(`${root}/c.txt`, { shift: true })
    await clock.settle()
    expect(await marked()).toEqual(['a.txt', 'b.txt', 'c.txt'])
    await (surface === 'desktop' ? tap(ui, 'unselect') : ui.press({ key: 'unselect' }))
    await clock.settle()
    expect(await marked()).toEqual([])
    const sent = await sentTo($)
    expect(sent).not.toContain('marked these entries')
    expect(sent).not.toContain('selected in the file tree')
    await ui.unmount()
  })

  test(`shift+j / shift+k and shift+down / shift+up select the row, move and select the next, on the ${surface}`, { timeoutMs: 20_000 }, async ($, on) => {
    const root = '/home/k/proj'
    const clock = world(on, RANGE_WORLD(root), [])
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const { ui, zone, click, marked } = await rangeMount($, surface)
    await clock.settle()
    await click(`${root}/a.txt`)
    await clock.advance(1000)
    await ui.post({ key: 'j', shift: true }, zone(`${root}/a.txt`))
    await clock.settle()
    expect(await marked()).toEqual(['a.txt', 'b.txt'])
    await ui.post({ key: 'down', shift: true }, zone(`${root}/b.txt`))
    await clock.settle()
    expect(await marked()).toEqual(['a.txt', 'b.txt', 'c.txt'])
    await ui.post({ key: 'k', shift: true }, zone(`${root}/c.txt`))
    await ui.post({ key: 'up', shift: true }, zone(`${root}/b.txt`))
    await clock.settle()
    expect(await marked()).toEqual(['a.txt', 'b.txt', 'c.txt'])
    await ui.post({ key: 'j' }, zone(`${root}/a.txt`))
    await ui.post({ key: 'j' }, zone(`${root}/b.txt`))
    await ui.post({ key: 'j' }, zone(`${root}/c.txt`))
    await clock.settle()
    expect(await marked()).toEqual(['a.txt', 'b.txt', 'c.txt'])
    await ui.post({ key: 'down', shift: true }, zone(`${root}/d.txt`))
    await clock.settle()
    expect(await marked()).toEqual(['a.txt', 'b.txt', 'c.txt', 'd.txt'])
    await ui.unmount()
  })

  test(`with rows marked, j moves only the cursor, and the shaded rows, the footer count, y and the prompt context name the same rows, on the ${surface}`, { timeoutMs: 20_000 }, async ($, on) => {
    const root = '/home/k/proj'
    const clock = world(on, RANGE_WORLD(root), [])
    const copied: string[] = []
    on('ui.copy', (_$, e) => {
      copied.push(e.text)
      return { value: { isCopied: true } }
    })
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const { ui, zone, click, marked } = await rangeMount($, surface)
    await clock.settle()
    await click(`${root}/a.txt`)
    await clock.advance(1000)
    await click(`${root}/b.txt`, { ctrl: true })
    await ui.post({ key: 'j' }, zone(`${root}/b.txt`))
    await clock.settle()
    expect(await marked()).toEqual(['a.txt', 'b.txt'])
    const tree = await ui.drawn()
    expect(JSON.stringify(tree)).toContain('2 marked')
    if (surface === 'desktop') expect(every(tree, n => isKeyed(n, 'Box', `bar:${root}/c.txt`))).toHaveLength(1)
    if (surface === 'desktop') {
      const bg = (id: string) => (propsOf(search(tree, n => isKeyed(n, 'Box', `row:${root}/${id}`))) as { backgroundColor?: string } | undefined)?.backgroundColor
      expect(bg('c.txt')).toBe(DESK.cursor)
      expect(bg('a.txt')).toBeDefined()
      expect(bg('a.txt')).not.toBe(DESK.cursor)
      expect(bg('d.txt')).toBeUndefined()
    }
    else expect(treeRows(tree).rows.find(r => r.id === `${root}/c.txt`)?.left.some(s => s.t === '▎ ')).toBe(true)
    await ui.post({ key: 'y' }, zone(`${root}/c.txt`))
    await clock.settle()
    expect(copied).toEqual(['a.txt\nb.txt'])
    const sent = await sentTo($)
    expect(sent).toContain(`refers to them:\\n${root}/a.txt\\n${root}/b.txt`)
    expect(sent).not.toContain(`${root}/c.txt`)
    await ui.unmount()
  })

  test(`v adds or drops the row under the cursor and its shading follows, on the ${surface}`, { timeoutMs: 20_000 }, async ($, on) => {
    const root = '/home/k/proj'
    const clock = world(on, RANGE_WORLD(root), [])
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const { ui, zone, click, marked } = await rangeMount($, surface)
    await clock.settle()
    await click(`${root}/a.txt`)
    await clock.advance(1000)
    await ui.post({ key: 'v' }, zone(`${root}/a.txt`))
    await ui.post({ key: 'j' }, zone(`${root}/a.txt`))
    await clock.settle()
    expect(await marked()).toEqual(['a.txt'])
    expect(JSON.stringify(await ui.drawn())).toContain('1 marked')
    await ui.post({ key: 'v' }, zone(`${root}/b.txt`))
    await clock.settle()
    expect(await marked()).toEqual(['a.txt', 'b.txt'])
    expect(JSON.stringify(await ui.drawn())).toContain('2 marked')
    await ui.post({ key: 'v' }, zone(`${root}/b.txt`))
    await clock.settle()
    expect(await marked()).toEqual(['a.txt'])
    await ui.post({ key: 'k' }, zone(`${root}/b.txt`))
    await ui.post({ key: 'v' }, zone(`${root}/a.txt`))
    await clock.settle()
    expect(await marked()).toEqual([])
    expect(JSON.stringify(await ui.drawn())).not.toContain(' marked')
    const sent = await sentTo($)
    expect(sent).not.toContain('marked these entries')
    expect(sent).not.toContain('selected in the file tree')
    await ui.unmount()
  })

  test(`an @path in a prompt moves the selection with the cursor while nothing is marked, and only the cursor while rows are marked, on the ${surface}`, { timeoutMs: 20_000 }, async ($, on) => {
    const root = '/home/k/proj'
    const clock = world(on, RANGE_WORLD(root), [])
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const { ui, click, marked } = await rangeMount($, surface)
    await clock.settle()
    await click(`${root}/a.txt`)
    await clock.advance(1000)
    await $.prompt.submit({ text: 'look at @c.txt', wait: false, origin: { kind: 'composer' } })
    await clock.settle()
    expect(await marked()).toEqual(['c.txt'])
    expect(await sentTo($)).toContain(`refers to it: ${root}/c.txt`)
    await click(`${root}/a.txt`, { ctrl: true })
    await clock.settle()
    await $.prompt.submit({ text: 'look at @d.txt', wait: false, origin: { kind: 'composer' } })
    await clock.settle()
    expect(await marked()).toEqual(['a.txt', 'c.txt'])
    const sent = await sentTo($)
    expect(sent).toContain(`refers to them:\\n${root}/c.txt\\n${root}/a.txt`)
    expect(sent).not.toContain(`${root}/d.txt`)
    await ui.unmount()
  })

  test(`j / k and the arrows make the row they move to the anchor, so shift+click selects the range from there, on the ${surface}`, { timeoutMs: 20_000 }, async ($, on) => {
    const root = '/home/k/proj'
    const clock = world(on, RANGE_WORLD(root), [])
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const { ui, zone, click, marked } = await rangeMount($, surface)
    await clock.settle()
    await click(`${root}/a.txt`)
    await clock.advance(1000)
    await ui.post({ key: 'j' }, zone(`${root}/a.txt`))
    await ui.post({ key: 'j' }, zone(`${root}/b.txt`))
    await clock.settle()
    await click(`${root}/d.txt`, { shift: true })
    await clock.settle()
    expect(await marked()).toEqual(['c.txt', 'd.txt'])
    await clock.advance(1000)
    await click(`${root}/d.txt`)
    await clock.advance(1000)
    await ui.post({ key: 'up' }, zone(`${root}/d.txt`))
    await ui.post({ key: 'up' }, zone(`${root}/c.txt`))
    await clock.settle()
    await click(`${root}/a.txt`, { shift: true })
    await clock.settle()
    expect(await marked()).toEqual(['a.txt', 'b.txt'])
    await ui.unmount()
  })

  test(`past 100 marks the toast points to the "100 marked" footer count without the plugin name or the V key, on the ${surface}`, { timeoutMs: 20_000 }, async ($, on) => {
    const root = '/home/k/proj'
    const names = Array.from({ length: 101 }, (_, i) => `f${String(i).padStart(3, '0')}.txt`)
    const ran: Ran = []
    const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', status: '', numstat: '', dirs: { [root]: names.map(n => [n, 'file'] as const) } }, ran)
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const { ui, zone } = await rangeMount($, surface)
    await clock.settle()
    await ui.post({ key: 'home' }, zone(`${root}/f000.txt`))
    for (const name of names.slice(0, 99)) await ui.post({ key: 'j', shift: true }, zone(`${root}/${name}`))
    await clock.settle()
    expect(JSON.stringify(await ui.drawn())).toContain('100 marked')
    expect(ran.filter(a => a[0] === 'toast')).toEqual([])
    await ui.post({ press: `${root}/f100.txt`, ctrl: true }, zone(`${root}/f100.txt`))
    await ui.post({ key: 'j', shift: true }, zone(`${root}/f099.txt`))
    await clock.settle()
    const full = ['toast', 'at most 100 marks; press "100 marked" in the footer to clear them']
    expect(ran.filter(a => a[0] === 'toast')).toEqual([full, full])
    expect(JSON.stringify(await ui.drawn())).toContain('100 marked')
    await ui.unmount()
  })

  test(`shift+click on a deleted file's ghost row ends a range instead of opening its diff, on the ${surface}`, { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
    const root = '/home/k/proj'
    const clock = world(on, { ...RANGE_WORLD(root), status: '## main\0 D gone.ts\0', numstat: '0\t7\tgone.ts\0', patch: 'diff --git a/gone.ts b/gone.ts\ndeleted file mode 100644\n--- a/gone.ts\n+++ /dev/null\n@@ -1,1 +0,0 @@\n-const gone = 1\n' }, [])
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const { ui, click, marked } = await rangeMount($, surface)
    await clock.settle()
    await click(`${root}/b.txt`)
    await clock.advance(1000)
    await click(`${root}/gone.ts`, { shift: true })
    await clock.settle()
    expect(await marked()).toEqual(['b.txt', 'c.txt', 'd.txt', 'gone.ts'])
    expect(await texts(ui)).not.toContain('"format":"diff"')
    expect(await texts(ui)).not.toContain('@@ -1,1 +0,0 @@')
    await ui.unmount()
  })

  test(`with auto-collapse on, a shift+click range ending in a folder Claude opened keeps that folder open, on the ${surface}`, { timeoutMs: 20_000, options: { collapse: 'on' } }, async ($, on) => {
    const root = '/home/k/proj'
    const clock = world(on, RANGE_WORLD(root), [])
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const { ui, click, marked } = await rangeMount($, surface)
    await clock.settle()
    await $.tool.call({ tool: 'Read', file_path: `${root}/src/e.ts` })
    await clock.settle()
    await clock.advance(3_000)
    await clock.settle()
    await click(`${root}/src/e.ts`, { shift: true })
    await clock.settle()
    expect(await marked()).toEqual(['e.ts'])
    await clock.advance(11_000)
    await clock.settle()
    expect(await marked()).toEqual(['e.ts'])
    await ui.unmount()
  })
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`u copies the bare file name on the ${surface}`, { timeoutMs: 20_000 }, async ($, on) => {
    const root = '/home/k/proj'
    const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, status: '## main\0', numstat: '', dirs: { [root]: [['src', 'dir']], [`${root}/src`]: [['deep.ts', 'file']] } }, [])
    const copied: string[] = []
    on('ui.copy', (_$, e) => {
      copied.push(e.text)
      return { value: { isCopied: true } }
    })
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface, component: 'Pane', requestId: 'filetree', props: paneProps(60) })
    await clock.settle()
    const zone = (id: string) => ({ in: surface === 'desktop' ? `hit:${id}` : 'rows' })
    await ui.post({ press: `${root}/src` }, zone(`${root}/src`))
    await clock.settle()
    await ui.post({ press: `${root}/src/deep.ts` }, zone(`${root}/src/deep.ts`))
    await clock.settle()
    if (surface === 'desktop') await ui.press({ key: 'hk-u' })
    else await ui.post({ key: 'u' }, zone(`${root}/src/deep.ts`))
    await clock.settle()
    expect(copied).toEqual(['deep.ts'])
    await ui.unmount()
  })
}

test('symlinks show an arrow, and the footer says where they lead: inside, outside the tree, broken or circular, on the terminal and the desktop', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, status: '## main\0', numstat: '',
    dirs: { [root]: [['gone.ts', 'file'], ['in.ts', 'file'], ['loop', 'file'], ['out.ts', 'file'], ['x.ts', 'file']] },
    links: [`${root}/in.ts`, `${root}/out.ts`, `${root}/gone.ts`, `${root}/loop`],
    linkTo: { [`${root}/in.ts`]: `${root}/x.ts`, [`${root}/out.ts`]: '/etc/hosts', [`${root}/gone.ts`]: '' },
    loops: [`${root}/loop`],
    stdout: { [`readlink -- ${root}/gone.ts`]: 'missing.ts\n', [`readlink -- ${root}/loop`]: 'loop\n' },
  }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(80) })
  await clock.settle()
  await ui.drawn()
  await clock.settle()
  const rows = treeRows(await ui.drawn()).rows
  const arrow = (name: string) => rows.find(r => r.id === `${root}/${name}`)?.left.find(s => s.t === ' →')
  expect(arrow('x.ts')).toBeUndefined()
  expect(arrow('in.ts')?.c).toBe('')
  expect(arrow('out.ts')?.c).toBe('ansi256(3)')
  expect(arrow('gone.ts')?.c).toBe('ansi256(1)')
  expect(arrow('loop')?.c).toBe('ansi256(1)')
  const footer = async (name: string) => {
    await ui.post({ press: `${root}/${name}` }, { in: 'rows' })
    await clock.advance(1000)
    await clock.settle()
    return JSON.stringify(await ui.drawn())
  }
  expect(await footer('in.ts')).toContain('in.ts → ~/proj/x.ts"')
  expect(await footer('out.ts')).toContain('out.ts → /etc/hosts (outside the tree)')
  expect(await footer('gone.ts')).toContain('gone.ts → missing.ts (broken: target missing)')
  expect(await footer('loop')).toContain('loop → loop (circular link)')
  const desktop = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(80) })
  await clock.settle()
  const drawn = JSON.stringify(await desktop.drawn())
  expect(drawn.match(/"children":\[" → "\]/g)?.length).toBe(4)
  expect(drawn).toContain('{"color":"#a67c00"},"children":[" → "]')
  expect(drawn).toContain('loop → loop (circular link)')
  await desktop.unmount()
  await ui.unmount()
})

for (const [surface, env, want] of [
  ['terminal', { HOME: '/home/k', TMUX: '/tmp/tmux-1000/default,1,0', SHELL: '/bin/zsh' }, ['tmux', 'new-window', '-c', '/home/k/proj/src', '--', '/bin/zsh']],
  ['terminal', { HOME: '/home/k', HERDR_ENV: '1', HERDR_BIN_PATH: '/opt/herdr' }, ['/opt/herdr', 'pane', 'split', '--current', '--direction', 'right', '--focus', '--cwd', '/home/k/proj/src']],
  ['desktop', { HOME: '/home/k' }, null],
] as const) {
  test(`t opens a shell in the folder of the cursor on the ${surface}${'TMUX' in env ? ' in tmux' : 'HERDR_ENV' in env ? ' in herdr' : ', or says it needs tmux or herdr'}`, { timeoutMs: 20_000 }, async ($, on) => {
    const ran: Ran = []
    const root = '/home/k/proj'
    const clock = world(on, { os: 'linux', env, cwd: root, top: root, status: '## main\0', numstat: '', dirs: { [root]: [['src', 'dir']], [`${root}/src`]: [['a.ts', 'file']] } }, ran)
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface, component: 'Pane', requestId: 'filetree', props: paneProps(60) })
    await clock.settle()
    const zone = (id: string) => ({ in: surface === 'desktop' ? `hit:${id}` : 'rows' })
    await ui.post({ press: `${root}/src` }, zone(`${root}/src`))
    await clock.settle()
    await ui.post({ press: `${root}/src/a.ts` }, zone(`${root}/src/a.ts`))
    await clock.settle()
    if (surface === 'desktop') await ui.press({ key: 'hk-t' })
    else await ui.post({ key: 't' }, zone(`${root}/src/a.ts`))
    await clock.settle()
    if (want) expect(ran).toContainEqual([...want])
    else expect(ran).toContainEqual(['toast', 't opens a shell in a new tmux or herdr pane; run Claude Code inside tmux or herdr to use it'])
    await ui.unmount()
  })
}

test('name search highlights the matched characters for plain, case and regex search, on the terminal and the desktop', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, status: '## main\0', numstat: '', dirs: { [root]: [['src', 'dir']], [`${root}/src`]: [['xAbyab.ts', 'file'], ['zz.ts', 'file']] } }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const lit = async () => {
    const row = treeRows(await ui.drawn()).rows.find(r => r.id === `${root}/src/xAbyab.ts`)
    return row?.left.slice(3).filter(s => s.c === 'ansi256(4)' && s.b).map(s => s.t) ?? []
  }
  await ui.input({ key: 'q', text: 'ab', kind: 'change' })
  await clock.settle()
  expect(await lit()).toEqual(['Ab', 'ab'])
  await ui.post({ key: 'c' }, { in: 'rows' })
  await clock.settle()
  expect(await lit()).toEqual(['ab'])
  await ui.post({ key: 'c' }, { in: 'rows' })
  await ui.post({ key: 'r' }, { in: 'rows' })
  await ui.input({ key: 'q', text: 'b.a', kind: 'change' })
  await clock.settle()
  expect(await lit()).toEqual(['bya'])
  const desktop = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const name = every(await desktop.drawn(), n => has(n, 'type') && n.type === 'Text' && kids(n).some(c => has(c, 'type') && c.type === 'Text'))
  expect(JSON.stringify(name)).toContain('"weight":"semibold","bold":true},"children":["bya"]')
  expect(JSON.stringify(name)).toContain('"children":["xA",')
  await desktop.unmount()
  await ui.unmount()
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`file references with a line in Claude's reply get a link that reveals the file and previews that line, on the ${surface}`, { timeoutMs: 20_000 }, async ($, on) => {
    const root = '/home/k/proj'
    const clock = world(on, {
      os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, status: '## main\0', numstat: '',
      dirs: { [root]: [['src', 'dir']], [`${root}/src`]: [['a.ts', 'file']] },
      files: { [`${root}/src/a.ts`]: Array.from({ length: 80 }, (_, i) => `line ${i + 1}`).join('\n') },
    }, [])
    on('ui.render', { component: 'AssistantMessage' }, (_$, e) => ({ type: 'Text', props: {}, children: [e.component === 'AssistantMessage' ? e.props.text : ''] }))
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const pane = await $.ui.mount({ plugin: 'filetree', surface, component: 'Pane', requestId: 'filetree', props: paneProps(60) })
    await clock.settle()
    const text = 'Fixed it in `src/a.ts:40-42`, see also src/a.ts#L50, /home/k/proj/src/missing.ts:3, http://host:8080 and 12:30.'
    const reply = await $.ui.mount({ plugin: 'filetree', surface, component: 'AssistantMessage', props: { text, isFirstOfReply: true } })
    await clock.settle()
    const drawn = JSON.stringify(await reply.drawn())
    expect(drawn).toContain(text)
    expect(drawn).toContain(`in the file tree: [src/a.ts:40-42](file://${root}/src/a.ts#L40-L42)  [src/a.ts:50](file://${root}/src/a.ts#L50)"`)
    const before = opens.length
    await reply.press({ key: 'filetree-refs', link: { href: `file://${root}/src/a.ts#L40-L42` } })
    await clock.settle()
    expect(opens.slice(before).some(o => has(o, 'id') && o.id === 'filetree')).toBe(true)
    if (surface === 'desktop') {
      expect(JSON.stringify(await pane.drawn())).toMatch(/"source":"line 38\\nline 39[^"]*","path":"\/home\/k\/proj\/src\/a\.ts","startLine":38/)
      await pane.press({ key: 'back' })
      await clock.settle()
      const term = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
      await clock.settle()
      expect(treeRows(await term.drawn()).active).toBe(`${root}/src/a.ts`)
      await term.unmount()
    } else {
      expect(peekOf(await pane.drawn()).preview.startLine).toBe(38)
      expect(treeRows(await pane.drawn()).active).toBe(`${root}/src/a.ts`)
    }
    const plain = await $.ui.mount({ plugin: 'filetree', surface, component: 'AssistantMessage', props: { text: 'No files here, version 1.2:3 aside.', isFirstOfReply: false } })
    await clock.settle()
    expect(JSON.stringify(await plain.drawn())).not.toContain('filetree-refs')
    await plain.unmount()
    await reply.unmount()
    await pane.unmount()
  })
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(surface === 'terminal' ? 'a reply drops the VS16 selector after a text-style emoji on the terminal, so the engine and a terminal that ignores it both draw it one cell wide' : 'a reply keeps its emoji as written on the desktop', { timeoutMs: 20_000 }, async ($, on) => {
    const root = '/home/k/proj'
    const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, status: '## main\0', numstat: '', dirs: { [root]: [] } }, [])
    on('ui.render', { component: 'AssistantMessage' }, (_$, e) => ({ type: 'Text', props: {}, children: [e.component === 'AssistantMessage' ? e.props.text : ''] }))
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const text = '\u2753 Q1\n\u27A1\uFE0F Yes: v7, pinned \u26A0\uFE0F \u2764\uFE0F\u200D\uD83D\uDD25 \u2B50\uFE0F 1\uFE0F\u20E3'
    const reply = await $.ui.mount({ plugin: 'filetree', surface, component: 'AssistantMessage', props: { text, isFirstOfReply: true } })
    await clock.settle()
    const drawn = JSON.stringify(await reply.drawn())
    expect(drawn).toContain(JSON.stringify(surface === 'terminal' ? '\u2753 Q1\n\u27A1 Yes: v7, pinned \u26A0 \u2764\uFE0F\u200D\uD83D\uDD25 \u2B50\uFE0F 1\uFE0F\u20E3' : text).slice(1, -1))
    await reply.unmount()
  })
}

test('a reply reference pressed on the terminal while a full diff is open replaces it with the split preview at that line', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, status: '## main\0 M src/a.ts\0', numstat: '',
    dirs: { [root]: [['src', 'dir']], [`${root}/src`]: [['a.ts', 'file']] },
    files: { [`${root}/src/a.ts`]: Array.from({ length: 80 }, (_, i) => `line ${i + 1}`).join('\n') },
    patch: 'diff --git a/src/a.ts b/src/a.ts\nindex 1..2 100644\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-line 0\n+line 1\n',
  }, [])
  on('ui.render', { component: 'AssistantMessage' }, (_$, e) => ({ type: 'Text', props: {}, children: [e.component === 'AssistantMessage' ? e.props.text : ''] }))
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const pane = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await pane.post({ key: 'end' }, { in: 'rows' })
  await pane.post({ key: 'd' }, { in: 'rows' })
  await clock.settle()
  expect(await texts(pane)).toContain('"format":"diff"')
  const reply = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'AssistantMessage', props: { text: 'Fixed it in `src/a.ts:40`.', isFirstOfReply: true } })
  await clock.settle()
  await reply.press({ key: 'filetree-refs', link: { href: `file://${root}/src/a.ts#L40` } })
  await clock.settle()
  expect(await texts(pane)).not.toContain('"format":"diff"')
  expect(peekOf(await pane.drawn()).preview.startLine).toBe(38)
  expect(treeRows(await pane.drawn()).active).toBe(`${root}/src/a.ts`)
  await reply.unmount()
  await pane.unmount()
})

for (const [surface, groups, want] of [
  ['terminal', 'folder', ['── lib/ (1)', 'lib/a.ts', '── src/ (2)', 'src/a.ts', 'src/b.ts', '── tests, builds and generated (2)', 'package-lock.json', 'tests/x.test.ts']],
  ['desktop', 'folder', ['group lib/ (1)', 'file lib/a.ts', 'group src/ (2)', 'file src/a.ts', 'file src/b.ts', 'group tests, builds and generated (2)', 'file package-lock.json', 'file tests/x.test.ts']],
  ['terminal', 'kind', ['── source (3)', 'src/b.ts', 'lib/a.ts', 'src/a.ts', '── tests, builds and generated (2)', 'package-lock.json', 'tests/x.test.ts']],
  ['terminal', 'off', ['src/b.ts', 'package-lock.json', 'lib/a.ts', 'tests/x.test.ts', 'src/a.ts']],
] as const) {
  test(`d on a folder with Diff groups ${groups} orders the files on the ${surface}`, { timeoutMs: 20_000, options: { groups } }, async ($, on) => {
    const root = '/home/k/proj'
    const files = ['src/b.ts', 'package-lock.json', 'lib/a.ts', 'tests/x.test.ts', 'src/a.ts']
    const patch = files.map(f => `diff --git a/${f} b/${f}\nindex 1..2 100644\n--- a/${f}\n+++ b/${f}\n@@ -1 +1 @@\n-a\n+b\n`).join('')
    const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [root]: [['src', 'dir'], ['lib', 'dir'], ['tests', 'dir'], ['package-lock.json', 'file']] }, status: '## main\0 M src/a.ts\0', numstat: '', patch }, [])
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface, component: 'Pane', requestId: 'filetree', props: { ...paneProps(60), scroll: { offset: 0, bodyRows: 80 } } })
    await clock.settle()
    await ui.post({ key: 'k' }, { in: surface === 'desktop' ? `hit:${root}/lib` : 'rows' })
    await ui.post({ key: 'd' }, { in: surface === 'desktop' ? `hit:${root}/lib` : 'rows' })
    await clock.settle()
    const tree = await ui.drawn()
    if (surface === 'desktop') expect(svgs(tree).map(s => s.alt).filter(a => a.startsWith('group ') || a.startsWith('file '))).toEqual([...want])
    else {
      const preview = rowsProps(clientProps(tree, 'rows')).preview
      expect(preview?.segments?.map(g => g.title).filter(Boolean)).toEqual([...want])
    }
    await ui.unmount()
  })
}

test('content search in a tree rooted in a repository subdirectory joins hits to the root even when git grep.fullName is set', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const top = '/home/k/repo'
  const root = `${top}/src`
  const w: World = {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top, status: '## main\0', numstat: '',
    dirs: { [top]: [['src', 'dir']], [root]: [['a.txt', 'file']] },
    grep: 'a.txt\x003\x00a needle\n', fullName: true,
  }
  const clock = world(on, w, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ key: 'q' }, { in: 'rows' })
  await ui.input({ key: 'q', text: 'needle', kind: 'change' })
  await clock.settle()
  await clock.advance(200)
  await clock.settle()
  const argv = ran.find(a => a[0] === 'git' && a.includes('grep')) ?? []
  expect(argv[argv.indexOf('-C') + 1]).toBe(root)
  expect(treeRows(await ui.drawn()).rows.map(r => r.id)).toEqual([`grep:0:${root}/a.txt`, `grep:3:${root}/a.txt`])
  await ui.unmount()
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a content-search hit past the preview character budget opens at its line with real line numbers, on the ${surface}`, { timeoutMs: 20_000 }, async ($, on) => {
    const ran: Ran = []
    const root = '/home/k/proj'
    const pad = (n: number) => `line ${n} `.padEnd(99, 'x')
    const clock = world(on, {
      os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, status: '## main\0', numstat: '',
      dirs: { [root]: [['big.txt', 'file']] },
      files: { [`${root}/big.txt`]: Array.from({ length: 2000 }, (_, i) => pad(i + 1)).join('\n') },
      grep: `big.txt\x001500\x00${pad(1500)}\n`,
    }, ran)
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface, component: 'Pane', requestId: 'filetree', props: paneProps(60) })
    await clock.settle()
    if (surface === 'desktop') await tap(ui, 'content')
    else await ui.post({ key: 'q' }, { in: 'rows' })
    await ui.input({ key: 'q', text: 'line 1500', kind: 'change' })
    await clock.settle()
    await clock.advance(200)
    await clock.settle()
    const id = `grep:1500:${root}/big.txt`
    await ui.post({ press: id }, { in: surface === 'desktop' ? `hit:${id}` : 'rows' })
    await clock.settle()
    await clock.advance(100)
    await clock.settle()
    const drawn = await ui.drawn()
    if (surface === 'desktop') {
      const code = every(drawn, n => has(n, 'type') && n.type === 'Code').map(n => propsOf(n))
      const at = code.find(c => has(c, 'startLine') && c.startLine === 1498)
      expect(has(at, 'source') && String(at.source).startsWith('line 1498 ')).toBe(true)
      const above = code.find(c => has(c, 'source') && String(c.source).includes('line 1497 '))
      expect(has(above, 'startLine') && has(above, 'source') && Number(above.startLine) + String(above.source).split('\n').length).toBe(1498)
    } else {
      const peek = peekOf(drawn).preview
      expect(peek.startLine).toBe(1498)
      expect(peek.text.startsWith('line 1498 ')).toBe(true)
      expect(JSON.stringify(drawn)).toContain('1498–')
    }
    await ui.unmount()
  })
}

test('a content-search hit right after a line longer than the preview budget still lands inside the preview', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, status: '## main\0', numstat: '',
    dirs: { [root]: [['long.txt', 'file']] },
    files: { [`${root}/long.txt`]: ['x'.repeat(100_000), 'needle here', 'after'].join('\n') },
    grep: 'long.txt\x002\x00needle here\n',
  }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ key: 'q' }, { in: 'rows' })
  await ui.input({ key: 'q', text: 'needle', kind: 'change' })
  await clock.settle()
  await clock.advance(200)
  await clock.settle()
  await ui.post({ press: `grep:2:${root}/long.txt` }, { in: 'rows' })
  await clock.settle()
  await clock.advance(100)
  await clock.settle()
  const peek = peekOf(await ui.drawn()).preview
  expect(peek.text).toContain('needle here')
  expect(peek.startLine).toBe(2)
  await ui.unmount()
})

test('a case-sensitive regex content search hands grep the same pattern in POSIX ERE and keeps only lines the tree regex matches', { timeoutMs: 20_000 }, async ($, on) => {
  expect(toEre('\\d+(?:px|em)?')).toBe('[0-9]+(px|em)?')
  expect(toEre('ab*?[\\w-]\\d')).toBe('ab*[0-9A-Za-z_-][0-9]')
  for (const unsafe of ['a\\sb', '[^]', '[]', '[^]x', '(a|)', '|a', '()', '[a-c-e]', '[\\d-z]', '[é]', '[[:alpha:]]', '\\bword', 'a\\nb']) expect(toEre(unsafe)).toBeNull()
  expect(toEre('a{2}b{x')).toBe('a{2}b\\{x')
  expect(toEre('[^\\D]')).toBeNull()
  expect(toEre('[a\\-z]')).toBeNull()
  expect(toEre('[\\]]')).toBeNull()
  expect(toEre('[\\\\x]')).toBeNull()
  expect(toEre('[\\.]')).toBe('[.]')
  const ran: Ran = []
  const root = '/home/k/proj'
  const w: World = {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, status: '## main\0', numstat: '',
    dirs: { [root]: [['a.ts', 'file']] },
    grep: 'a.ts\x001\x00ddd\na.ts\x002\x00width 42\n',
  }
  const clock = world(on, w, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ key: 'r' }, { in: 'rows' })
  await ui.post({ key: 'c' }, { in: 'rows' })
  await ui.post({ key: 'q' }, { in: 'rows' })
  await ui.input({ key: 'q', text: '\\d+', kind: 'change' })
  await clock.settle()
  await clock.advance(200)
  await clock.settle()
  expect(ran.find(a => a[0] === 'git' && a.includes('grep'))?.slice(-4)).toEqual(['-e', '[0-9]+', '--', '.'])
  expect(treeRows(await ui.drawn()).rows.map(r => r.id)).toEqual([`grep:0:${root}/a.ts`, `grep:2:${root}/a.ts`])
  await ui.unmount()
})

test('content search outside a repo in a hidden root with hidden files off searches its visible children, so grep never skips the root itself', { timeoutMs: 20_000, options: { ignore: 'cache[1]' } }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/.config'
  const w: World = {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['app', 'dir'], ['.cache', 'dir'], ['node_modules', 'dir'], ['b.toml', 'file']], [`${root}/app`]: [['c.toml', 'file']] },
    grep: `${root}/app/c.toml\x003\x00needle = 1\n`,
  }
  const clock = world(on, w, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.press({ key: 'hidden' })
  await clock.settle()
  await ui.post({ key: 'q' }, { in: 'rows' })
  await ui.input({ key: 'q', text: 'needle', kind: 'change' })
  await clock.settle()
  await clock.advance(200)
  await clock.settle()
  const argv = ran.find(a => a[0] === 'grep' && a.includes('--null')) ?? []
  expect(argv).toContain('--exclude-dir=.*')
  expect(argv.slice(argv.indexOf('--') + 1)).toEqual([`${root}/app`, `${root}/b.toml`])
  expect(argv.slice(1, 3)).toEqual(['-rnIH', '--null'])
  expect(argv.some(a => /^-[a-zA-Z]*Z/.test(a))).toBe(false)
  expect(argv).toContain('--exclude-dir=cache\\[1\\]')
  expect(argv).not.toContain('--exclude-dir=cache[1]')
  expect(treeRows(await ui.drawn()).rows.map(r => r.id)).toEqual([`grep:0:${root}/app/c.toml`, `grep:3:${root}/app/c.toml`])
  await ui.unmount()
})

test('a Markdown preview opened at a line splits between blocks, splits a code fence at the line itself by closing and reopening it, and keeps link definitions in both halves', () => {
  const doc = ['# Title', '', 'See [docs][d].', '', '```ts', 'const a = 1', 'const b = 2', '```', '', 'After', '', '[d]: https://x.test'].join('\n')
  const [above, below] = markdownSplit(doc, 6)
  expect(above.split('\n').slice(0, 7)).toEqual(['# Title', '', 'See [docs][d].', '', '```ts', 'const a = 1', '```'])
  expect(below.startsWith('```ts\nconst b = 2\n```')).toBe(true)
  expect(above.endsWith('[d]: https://x.test')).toBe(true)
  expect(below.endsWith('[d]: https://x.test')).toBe(true)
  expect(markdownSplit('a\n\nb\n\nc', 4)[1]).toBe('c')
})

test('row keys during content search act on the highlighted result, not the tree cursor left behind', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const w: World = {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, status: '## main\0', numstat: '',
    dirs: { [root]: [['src', 'dir'], ['b.md', 'file']], [`${root}/src`]: [['a.ts', 'file']] },
    grep: 'b.md\x002\x00a needle\nsrc/a.ts\x0040\x00const needle = 1\n',
  }
  const clock = world(on, w, [])
  on('tool.check', () => ({ decision: 'allow' }))
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ press: `${root}/b.md` }, { in: 'rows' })
  await ui.post({ key: 'q' }, { in: 'rows' })
  await ui.input({ key: 'q', text: 'needle', kind: 'change' })
  await clock.settle()
  await clock.advance(200)
  await clock.settle()
  for (let i = 0; i < 3; i++) await ui.post({ key: 'j' }, { in: 'rows' })
  expect(treeRows(await ui.drawn()).active).toBe(`grep:40:${root}/src/a.ts`)
  await ui.post({ key: 'x' }, { in: 'rows' })
  await clock.settle()
  const edit = (file_path: string) => $.tool.check({ tool: 'Edit', input: { file_path, old_string: 'a', new_string: 'b' } })
  expect((await edit(`${root}/src/a.ts`)).decision).toBe('deny')
  expect((await edit(`${root}/b.md`)).decision).toBe('allow')
  await ui.unmount()
})

test('content search: the wheel walks the results, and right-click copies the hit file path, relative and absolute', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const w: World = {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, status: '## main\0', numstat: '',
    dirs: { [root]: [['b.md', 'file']] },
    grep: `${Array.from({ length: 80 }, (_, i) => `b.md\x00${i + 1}\x00needle ${i}`).join('\n')}\n`,
  }
  const clock = world(on, w, [])
  const copied: string[] = []
  on('ui.copy', (_$, e) => {
    copied.push(e.text)
    return { value: { isCopied: true } }
  })
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ key: 'q' }, { in: 'rows' })
  await ui.input({ key: 'q', text: 'needle', kind: 'change' })
  await clock.settle()
  await clock.advance(200)
  await clock.settle()
  const ids = async () => treeRows(await ui.drawn()).rows.map(r => r.id)
  expect(await ids()).not.toContain(`grep:70:${root}/b.md`)
  for (let i = 0; i < 25; i++) await $.ui.scroll({ ...wheelDown, by: 3 })
  await clock.settle()
  expect(await ids()).toContain(`grep:70:${root}/b.md`)
  await ui.post({ copy: `grep:70:${root}/b.md` }, { in: 'rows' })
  await ui.post({ copy: `grep:70:${root}/b.md`, shift: true }, { in: 'rows' })
  await clock.settle()
  expect(copied).toEqual(['b.md', `${root}/b.md`])
  await ui.unmount()
})

test('match highlighting does bounded work: a pattern with overlapping alternatives over a long path returns at once, and plain patterns still light every match', () => {
  const spans = compileSpans('(a|aa)*z|a', false)
  const start = performance.now()
  for (let i = 0; i < 200; i++) spans?.(`/${'a'.repeat(1000)}`)
  expect(performance.now() - start).toBeLessThan(2000)
  expect(compileSpans('ab', false)?.('xxabyyab')).toEqual([[2, 4], [6, 8]])
})

test('match highlighting charges every NFA step: nested optional repeats over 200 long paths return at once', () => {
  const spans = compileSpans('((a?){100}){5}z|a', false)
  const start = performance.now()
  for (let i = 0; i < 200; i++) spans?.(`/${'a'.repeat(1000)}/${i}`)
  expect(performance.now() - start).toBeLessThan(1000)
  expect(compileSpans('ab', false)?.('xxabyyab')).toEqual([[2, 4], [6, 8]])
})

test('i on a content search hit scopes the search to the folder of that hit, not the tree cursor', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const w: World = {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, status: '## main\0', numstat: '',
    dirs: { [root]: [['lib', 'dir'], ['src', 'dir']], [`${root}/lib`]: [['b.ts', 'file']], [`${root}/src`]: [['a.ts', 'file']] },
    grep: 'src/a.ts\x001\x00needle\n',
  }
  const clock = world(on, w, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ key: 'down' }, { in: 'rows' })
  await ui.post({ key: 'up' }, { in: 'rows' })
  await clock.settle()
  expect(treeRows(await ui.drawn()).active).toBe(`${root}/lib`)
  await ui.post({ key: 'q' }, { in: 'rows' })
  await ui.input({ key: 'q', text: 'needle', kind: 'change' })
  await clock.settle()
  await clock.advance(200)
  await clock.settle()
  expect(treeRows(await ui.drawn()).rows.map(r => r.id)).toEqual([`grep:0:${root}/src/a.ts`, `grep:1:${root}/src/a.ts`])
  await ui.post({ key: 'down' }, { in: 'rows' })
  const before = ran.length
  await ui.post({ key: 'i' }, { in: 'rows' })
  await clock.settle()
  await clock.advance(200)
  await clock.settle()
  expect(ran.slice(before).filter(a => a[0] === 'git' && a.includes('grep')).at(-1)?.slice(-2)).toEqual(['--', 'src'])
  await ui.unmount()
})

test('file references with a line include extensionless names like Dockerfile, never bare numbers', () => {
  expect(fileRefs('Edit Dockerfile:12, Makefile#L3-L5 and src/a.ts:7; port 8080:1 is not a file').map(r => `${r.path}:${r.line}-${r.end}`)).toEqual(['Dockerfile:12-12', 'Makefile:3-5', 'src/a.ts:7-7'])
})

test('open content search results refresh after Claude writes a file', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const w: World = {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, status: '## main\0', numstat: '',
    dirs: { [root]: [['a.ts', 'file'], ['b.ts', 'file']] },
    grep: 'a.ts\x001\x00needle\n',
  }
  const clock = world(on, w, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ key: 'q' }, { in: 'rows' })
  await ui.input({ key: 'q', text: 'needle', kind: 'change' })
  await clock.settle()
  await clock.advance(200)
  await clock.settle()
  const ids = async () => treeRows(await ui.drawn()).rows.map(r => r.id)
  expect(await ids()).toEqual([`grep:0:${root}/a.ts`, `grep:1:${root}/a.ts`])
  w.grep = 'a.ts\x001\x00needle\nb.ts\x004\x00needle again\n'
  await $.tool.call({ tool: 'Write', file_path: `${root}/b.ts`, content: 'x' })
  await clock.settle()
  await ui.drawn()
  await clock.advance(1000)
  await clock.settle()
  expect(await ids()).toEqual([`grep:0:${root}/a.ts`, `grep:1:${root}/a.ts`, `grep:0:${root}/b.ts`, `grep:4:${root}/b.ts`])
  await ui.unmount()
})

const KEYS_FILE = '/home/k/.claude/keybindings.json'
const keysRun = { command: 'filetree', args: 'keys', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } } satisfies CommandRunInput

function keysWorld(on: On, text: string | undefined, picks: string[]) {
  const ran: Ran = []
  const asked: string[][] = []
  const root = '/home/k/proj'
  const w: World = {
    os: 'linux',
    env: { HOME: '/home/k' },
    cwd: root,
    top: '',
    status: '',
    numstat: '',
    dirs: { [root]: [['a.txt', 'file']], '/home/k/.claude': text === undefined ? [] : [['keybindings.json', 'file']] },
    files: text === undefined ? {} : { [KEYS_FILE]: text },
    linkTo: text === undefined ? {} : { [KEYS_FILE]: KEYS_FILE },
    tool: e => {
      if (e.tool !== 'AskUserQuestion' || !has(e, 'questions') || !Array.isArray(e.questions)) return undefined
      const q: unknown = e.questions[0]
      if (!has(q, 'question') || typeof q.question !== 'string' || !has(q, 'options') || !Array.isArray(q.options)) return undefined
      asked.push(q.options.map((o: unknown) => (has(o, 'label') ? String(o.label) : '')))
      return { result: { questions: [], answers: { [q.question]: picks.shift() ?? '' } } }
    },
  }
  const clock = world(on, w, ran)
  return { w, ran, asked, clock }
}

const keysIn = (w: World) => JSON.parse(w.files?.[KEYS_FILE] ?? '{}') as { bindings: { context: string; bindings: Record<string, string | null> }[] }

test('/filetree keys with no keybindings.json asks, then writes alt+l in Chat and alt+h in Pane and PaneField', { timeoutMs: 20_000 }, async ($, on) => {
  const { w, asked, clock } = keysWorld(on, undefined, ['Add them'])
  await $.session.start({ cwd: '/home/k/proj', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const r = await $.command.run(keysRun)
  expect(JSON.stringify(r)).toContain(`Wrote ${KEYS_FILE}`)
  expect(asked).toEqual([['Add them', 'Cancel']])
  expect(keysIn(w).bindings).toEqual([
    { context: 'Chat', bindings: { 'meta+l': 'abovePrompt:focus' } },
    { context: 'Pane', bindings: { 'meta+h': 'abovePrompt:leave' } },
    { context: 'PaneField', bindings: { 'meta+h': 'abovePrompt:leave' } },
  ])
})

test('/filetree keys keeps existing bindings and other keys, keeps a tab indent, and a second run changes nothing', { timeoutMs: 20_000 }, async ($, on) => {
  const text = `${JSON.stringify({ $schema: 'https://x/schema.json', bindings: [{ context: 'Chat', bindings: { 'ctrl+e': 'chat:externalEditor' } }, { context: 'Global', bindings: { 'ctrl+t': null } }] }, null, '\t')}\n`
  const { w, ran, asked, clock } = keysWorld(on, text, ['Add them'])
  await $.session.start({ cwd: '/home/k/proj', surface: 'terminal', isInteractive: true })
  await clock.settle()
  await $.command.run(keysRun)
  const after = w.files?.[KEYS_FILE] ?? ''
  expect(after).toContain('\n\t"bindings"')
  const doc = keysIn(w) as { $schema?: string; bindings: { context: string; bindings: Record<string, string | null> }[] }
  expect(doc.$schema).toBe('https://x/schema.json')
  expect(doc.bindings).toEqual([
    { context: 'Chat', bindings: { 'ctrl+e': 'chat:externalEditor', 'meta+l': 'abovePrompt:focus' } },
    { context: 'Global', bindings: { 'ctrl+t': null } },
    { context: 'Pane', bindings: { 'meta+h': 'abovePrompt:leave' } },
    { context: 'PaneField', bindings: { 'meta+h': 'abovePrompt:leave' } },
  ])
  expect(ran.some(a => a[0] === 'mv' && a.at(-1) === KEYS_FILE)).toBe(true)
  const writes = ran.filter(a => a[0] === 'write').length
  const again = await $.command.run(keysRun)
  expect(JSON.stringify(again)).toContain('Already set')
  expect(asked.length).toBe(1)
  expect(ran.filter(a => a[0] === 'write').length).toBe(writes)
  expect(w.files?.[KEYS_FILE]).toBe(after)
})

test('/filetree keys asks on a clash, Keep mine leaves the file byte-identical, and a Global alt+l counts as a clash', { timeoutMs: 20_000 }, async ($, on) => {
  const text = '{\n    "bindings": [\n        { "context": "Global", "bindings": { "alt+l": "app:toggleTodos" } },\n        { "context": "Pane", "bindings": { "meta+h": "pane:shrink" } }\n    ]\n}\n'
  const { w, ran, asked, clock } = keysWorld(on, text, ['Keep mine', 'Replace'])
  await $.session.start({ cwd: '/home/k/proj', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const kept = await $.command.run(keysRun)
  expect(JSON.stringify(kept)).toContain('Kept your bindings')
  expect(asked[0]).toEqual(['Replace', 'Keep mine', 'Add the free ones only'])
  expect(w.files?.[KEYS_FILE]).toBe(text)
  expect(ran.some(a => a[0] === 'write')).toBe(false)
  await $.command.run(keysRun)
  expect(w.files?.[KEYS_FILE]).toContain('\n    "bindings"')
  expect(keysIn(w).bindings).toEqual([
    { context: 'Global', bindings: { 'alt+l': 'app:toggleTodos' } },
    { context: 'Pane', bindings: { 'meta+h': 'abovePrompt:leave' } },
    { context: 'PaneField', bindings: { 'meta+h': 'abovePrompt:leave' } },
    { context: 'Chat', bindings: { 'meta+l': 'abovePrompt:focus' } },
  ])
  expect(JSON.stringify(await $.command.run(keysRun))).toContain('Already set')
})

test('/filetree keys refuses invalid JSON and a read-only file without asking or writing', { timeoutMs: 20_000 }, async ($, on) => {
  const text = '{ "bindings": [ { "context": "Chat", '
  const { w, ran, asked, clock } = keysWorld(on, text, ['Add them'])
  await $.session.start({ cwd: '/home/k/proj', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const r = JSON.stringify(await $.command.run(keysRun))
  expect(r).toContain('not valid JSON')
  expect(r).toContain('Nothing changed')
  w.files = { [KEYS_FILE]: '{"bindings":[]}' }
  w.exits = { test: [1, ''] }
  expect(JSON.stringify(await $.command.run(keysRun))).toContain('is read-only')
  expect(asked.length).toBe(0)
  expect(ran.some(a => a[0] === 'write')).toBe(false)
})

function grepWorld(root: string, grep: string, extra: Partial<World> = {}): World {
  return { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, status: '## main\0', numstat: '', dirs: { [root]: [['a.ts', 'file'], ['b.md', 'file']] }, grep, ...extra }
}

async function contentSearch($: Engine, clock: ReturnType<typeof world>, text: string, regex = false) {
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  if (regex) await ui.post({ key: 'r' }, { in: 'rows' })
  await ui.post({ key: 'q' }, { in: 'rows' })
  await ui.input({ key: 'q', text, kind: 'change' })
  await clock.settle()
  await clock.advance(200)
  await clock.settle()
  return ui
}

test('a costly regex over long lines stops the content search with a notice instead of freezing', { timeoutMs: 60_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const long = 'a'.repeat(100_000)
  const clock = world(on, grepWorld(root, `${Array.from({ length: 10 }, (_, i) => `a.ts\x00${i + 1}\x00${long}`).join('\n')}\n`), [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const started = Date.now()
  const ui = await contentSearch($, clock, '(?:a{100}){10}\\s', true)
  expect(Date.now() - started).toBeLessThan(5_000)
  expect(JSON.stringify(await ui.drawn())).toContain('search stopped: the pattern is too costly')
  await ui.unmount()
})

test('a class with a literal caret is never translated for grep, so [-^] cannot turn into a negation', () => {
  expect(toEre('[-^]')).toBeNull()
  expect(toEre('[a^]')).toBeNull()
  expect(toEre('[^a]')).toBeNull()
})

test('an untranslatable regex searches every line, so ^\\s*$ finds completely empty lines', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, grepWorld(root, 'a.ts\x002\x00\na.ts\x003\x00   \na.ts\x004\x00x\n'), ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await contentSearch($, clock, '^\\s*$', true)
  expect(ran.find(a => a[0] === 'git' && a.includes('grep'))?.slice(-4)).toEqual(['-e', '^', '--', '.'])
  expect(treeRows(await ui.drawn()).rows.map(r => r.id)).toEqual([`grep:0:${root}/a.ts`, `grep:2:${root}/a.ts`, `grep:3:${root}/a.ts`])
  await ui.unmount()
})

test('y, Y and u copy the marks while a content search has no matches', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, grepWorld(root, ''), [])
  const copied: string[] = []
  on('ui.copy', (_$, e) => {
    copied.push(e.text)
    return { value: { isCopied: true } }
  })
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ press: `${root}/a.ts` }, { in: 'rows' })
  await clock.advance(1000)
  await ui.post({ key: 'v' }, { in: 'rows' })
  await ui.unmount()
  const search = await contentSearch($, clock, 'nothing')
  expect(JSON.stringify(await search.drawn())).toContain('no matches')
  for (const key of ['y', 'Y', 'u']) await search.post({ key }, { in: 'rows' })
  await clock.settle()
  expect(copied).toEqual(['a.ts', `${root}/a.ts`, 'a.ts'])
  await search.unmount()
})

test('moving through content results tells Claude about the highlighted file, not the old tree selection', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, grepWorld(root, 'a.ts\x001\x00needle\nb.md\x002\x00needle\n'), [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await contentSearch($, clock, 'needle')
  for (let i = 0; i < 3; i++) await ui.post({ key: 'j' }, { in: 'rows' })
  await clock.settle()
  const sent = JSON.stringify(await $.prompt.submit({ text: 'edit this', wait: false, origin: { kind: 'composer' } }))
  expect(sent).toContain(`selected in the file tree; \\"this\\" or \\"it\\" in the prompt likely refers to it: ${root}/b.md`)
  await ui.unmount()
})

test('file references keep folders written with brackets or parentheses', () => {
  expect(fileRefs('see src/app/[id]/page.tsx:12, src/app/(auth)/login.tsx:15 and (src/a.ts:7)').map(r => `${r.path}:${r.line}`)).toEqual(['src/app/[id]/page.tsx:12', 'src/app/(auth)/login.tsx:15', 'src/a.ts:7'])
})

test('the regex fallback reads whole lines, so a long line cannot pass ^\\s*$ on its blank prefix', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, grepWorld(root, `a.ts\x001\x00${' '.repeat(12_000)}x\nc.ts\x003\x00\n`), [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await contentSearch($, clock, '^\\s*$', true)
  const ids = treeRows(await ui.drawn()).rows.map(r => r.id)
  expect(ids).toContain(`grep:3:${root}/c.ts`)
  expect(ids).not.toContain(`grep:1:${root}/a.ts`)
  await ui.unmount()
})

test('the regex fallback reads whole lines, so a match past 10,000 characters is found', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, grepWorld(root, `b.md\x002\x00${'b'.repeat(12_000)} needle\n`), [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await contentSearch($, clock, '\\sneedle', true)
  expect(treeRows(await ui.drawn()).rows.map(r => r.id)).toContain(`grep:2:${root}/b.md`)
  await ui.unmount()
})

test('scrolling content results with the wheel tells Claude about the highlighted file', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, grepWorld(root, 'a.ts\x001\x00needle\nb.md\x002\x00needle\n'), [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await contentSearch($, clock, 'needle')
  await $.ui.scroll({ ...wheelDown, by: 3 })
  await clock.settle()
  const sent = JSON.stringify(await $.prompt.submit({ text: 'edit this', wait: false, origin: { kind: 'composer' } }))
  expect(sent).toContain(`selected in the file tree; \\"this\\" or \\"it\\" in the prompt likely refers to it: ${root}/b.md`)
  await ui.unmount()
})

test('/filetree keys writes nothing when keybindings.json changes while it asks', { timeoutMs: 20_000 }, async ($, on) => {
  const text = `${JSON.stringify({ bindings: [{ context: 'Chat', bindings: { 'ctrl+e': 'chat:externalEditor' } }] }, null, 2)}\n`
  const { w, clock } = keysWorld(on, text, ['Add them'])
  const edited = `${JSON.stringify({ bindings: [{ context: 'Chat', bindings: { 'ctrl+g': 'chat:externalEditor' } }] }, null, 2)}\n`
  const ask = w.tool
  w.tool = e => {
    const r = ask?.(e)
    if (r && w.files) w.files[KEYS_FILE] = edited
    return r
  }
  await $.session.start({ cwd: '/home/k/proj', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const r = await $.command.run(keysRun)
  expect(JSON.stringify(r)).toContain('changed while you were asked')
  expect(w.files?.[KEYS_FILE]).toBe(edited)
})

test('content search results tell Claude about the first highlighted hit as soon as they arrive', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, grepWorld(root, 'b.md\x002\x00needle\n'), [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await contentSearch($, clock, 'needle')
  const sent = JSON.stringify(await $.prompt.submit({ text: 'edit this', wait: false, origin: { kind: 'composer' } }))
  expect(sent).toContain(`selected in the file tree; \\"this\\" or \\"it\\" in the prompt likely refers to it: ${root}/b.md`)
  await ui.unmount()
})

test('patterns that can match a non-ASCII character are never translated for grep, so UTF-8 grep cannot drop what the matcher accepts', () => {
  for (const p of ['^..$', 'a.b', '[^a]', '\\W', '\\D', '\\S', 'é', '😀+']) expect(toEre(p)).toBeNull()
  expect(compileRegex('^..$', false, { left: 1000 })?.('😀')).toBe(true)
  expect(toEre('needle\\d+')).toBe('needle[0-9]+')
})

test('a regex content search that ignores case scans every line, so Unicode case folding cannot hide a match from grep', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const ran: Ran = []
  const clock = world(on, grepWorld(root, 'a.ts\x001\x00K\n'), ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await contentSearch($, clock, '^[a-z]$', true)
  const argv = ran.find(a => a[0] === 'git' && a.includes('grep')) ?? []
  expect(argv[argv.indexOf('-e') + 1]).toBe('^')
  expect(treeRows(await ui.drawn()).rows.map(r => r.id)).toContain(`grep:1:${root}/a.ts`)
  await ui.unmount()
})

test('desktop: content results stay inside the drawing budget and say how many rows they hold back', { timeoutMs: 30_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const long = `${'d'.repeat(200)}`
  const clock = world(on, grepWorld(root, `${Array.from({ length: 200 }, (_, i) => `${long}/f${i}.ts\x001\x00${'x'.repeat(300)}`).join('\n')}\n`), [])
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ key: 'q' }, { in: `hit:${root}/a.ts` })
  await ui.input({ key: 'q', text: 'x', kind: 'change' })
  await clock.settle()
  await clock.advance(200)
  await clock.settle()
  const drawn = JSON.stringify(await ui.drawn())
  const shown = Number(/first (\d+) of 400 rows; keep typing to narrow/.exec(drawn)?.[1] ?? 0)
  expect(shown).toBeGreaterThan(0)
  for (let i = 0; i < shown + 5; i++) await ui.press({ key: 'hk-j' })
  await clock.settle()
  const lit: string[] = []
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(walk)
    if (!n || typeof n !== 'object') return
    const o = n as { props?: { key?: unknown; backgroundColor?: unknown } }
    const key = o.props?.key
    if (typeof key === 'string' && key.startsWith('grep-row:') && o.props?.backgroundColor) lit.push(key)
    Object.values(n).forEach(walk)
  }
  walk(await ui.drawn())
  expect(lit.length).toBe(1)
  await ui.unmount()
})

test('a translated ASCII regex runs grep under the C locale, and a plain search keeps the host locale', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, grepWorld(root, 'a.ts\x001\x00abc\n', { top: '' }), [])
  const grepEnv = () => spawns.filter(x => x.argv.includes('-rnIH')).at(-1)?.env ?? {}
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ key: 'r' }, { in: 'rows' })
  await ui.post({ key: 'c' }, { in: 'rows' })
  await ui.post({ key: 'q' }, { in: 'rows' })
  await ui.input({ key: 'q', text: '[a-z]+', kind: 'change' })
  await clock.settle()
  await clock.advance(200)
  await clock.settle()
  expect(grepEnv().LC_ALL).toBe('C')
  await ui.post({ key: 'r' }, { in: 'rows' })
  await ui.input({ key: 'q', text: 'abc', kind: 'change' })
  await clock.settle()
  await clock.advance(200)
  await clock.settle()
  expect(grepEnv().LC_ALL).toBeUndefined()
  await ui.unmount()
})

test('the footer count of marks is a button that clears them', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', status: '', numstat: '', dirs: { [root]: [['a.txt', 'file'], ['b.txt', 'file']] } }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ press: `${root}/a.txt` }, { in: 'rows' })
  await ui.post({ key: 'v' }, { in: 'rows' })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).toContain('1 marked')
  await ui.press({ key: 'marked-clear' })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).not.toContain('1 marked')
  await ui.unmount()
})

test('split preview: a picture past the image byte limit shows a note instead of blanking the pane, and a large but small-on-disk picture still draws', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/opt/k/proj'
  const clock = world(on, {
    os: 'linux', env: { HOME: '/opt/k', XDG_RUNTIME_DIR: '/run/user/1000' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['big.png', 'file'], ['wide.png', 'file']] },
    bytes: { [`${root}/big.png`]: 'x'.repeat(2_200_000) },
    stdout: { 'od -An -tu1': '137 80 78 71 13 10 26 10 0 0 0 13 73 72 68 82 0 0 4 176 0 0 3 32' },
  }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.press({ key: 'split' })
  await ui.post({ key: 'j' }, { in: 'rows' })
  await clock.settle()
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).toContain(pngOf(`${root}/wide.png`))
  await ui.post({ key: 'k' }, { in: 'rows' })
  await clock.settle()
  await clock.settle()
  const shown = JSON.stringify(await ui.drawn())
  expect(shown).toContain('big.png: too large to preview here')
  expect(shown).not.toContain(pngOf(`${root}/big.png`))
  await ui.unmount()
})

function deskRowsWorld(on: On, count: number) {
  const root = '/home/k/proj'
  const clock = world(on, { os: 'darwin', env: { HOME: '/home/k' }, cwd: root, top: '', status: '', numstat: '', dirs: { [root]: Array.from({ length: count }, (_, i): [string, 'file'] => [`f${String(i).padStart(2, '0')}.ts`, 'file']) } }, [])
  return { root, clock }
}

function clientKeys(tree: unknown): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(walk)
    if (!n || typeof n !== 'object') return
    const o = n as { type?: unknown; props?: { key?: unknown; module?: unknown } }
    if (o.type === 'Client' && typeof o.props?.key === 'string' && typeof o.props.module === 'string') out.set(o.props.module, [...(out.get(o.props.module) ?? []), o.props.key])
    Object.values(n).forEach(walk)
  }
  walk(tree)
  return out
}

test('desktop (#47): a key that reaches every Client in the pane moves the cursor one row, so no per-row key listener can flood the page', { timeoutMs: 30_000 }, async ($, on) => {
  const { root, clock } = deskRowsWorld(on, 40)
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const mounted = clientKeys(await ui.drawn())
  const rows = (mounted.get('hooks/hit.tsx') ?? []).filter(k => k !== 'hit:root')
  const all = [...mounted.values()].flat()
  expect(rows.length).toBeGreaterThan(30)
  const cursor = async () => {
    const lit: string[] = []
    const walk = (n: unknown): void => {
      if (Array.isArray(n)) return n.forEach(walk)
      if (!n || typeof n !== 'object') return
      const o = n as { props?: { key?: unknown; backgroundColor?: unknown } }
      const key = o.props?.key
      if (typeof key === 'string' && key.startsWith('row:') && o.props?.backgroundColor) lit.push(key.slice(4))
      Object.values(n).forEach(walk)
    }
    walk(await ui.drawn())
    return lit
  }
  await ui.pointer({ type: 'down', x: 0, y: 0, button: 'left', in: rows[5] })
  await ui.pointer({ type: 'up', x: 0, y: 0, button: 'left', in: rows[5] })
  await clock.advance(1000)
  await clock.settle()
  expect(await cursor()).toEqual([`${root}/f05.ts`])
  for (const k of all) await ui.key({ key: 'j', in: k })
  await clock.settle()
  expect(await cursor()).toEqual([`${root}/f06.ts`])
  for (const k of all) await ui.key({ key: 'k', in: k })
  await clock.settle()
  expect(await cursor()).toEqual([`${root}/f05.ts`])
  await ui.input({ key: 'q', text: 'f1', kind: 'change' })
  await clock.advance(1000)
  await clock.settle()
  const left = clientKeys(await ui.drawn()).get('hooks/hit.tsx') ?? []
  expect(left).not.toContain(`hit:${root}/f05.ts`)
  await new Promise(done => setTimeout(done, 1600))
  const before = await cursor()
  for (const k of left) await ui.key({ key: 'j', in: k })
  await clock.settle()
  expect(await cursor()).not.toEqual(before)
  await ui.unmount()
})

test('desktop: a click on the root header leaves the keys with the tree rows', { timeoutMs: 30_000 }, async ($, on) => {
  const { root, clock } = deskRowsWorld(on, 10)
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const all = [...clientKeys(await ui.drawn()).values()].flat()
  expect(all).toContain('hit:root')
  const cursor = async () => {
    const lit: string[] = []
    const walk = (n: unknown): void => {
      if (Array.isArray(n)) return n.forEach(walk)
      if (!n || typeof n !== 'object') return
      const o = n as { props?: { key?: unknown; backgroundColor?: unknown } }
      const key = o.props?.key
      if (typeof key === 'string' && key.startsWith('row:') && o.props?.backgroundColor) lit.push(key.slice(4))
      Object.values(n).forEach(walk)
    }
    walk(await ui.drawn())
    return lit
  }
  await ui.pointer({ type: 'down', x: 0, y: 0, button: 'left', in: 'hit:root' })
  await ui.pointer({ type: 'up', x: 0, y: 0, button: 'left', in: 'hit:root' })
  await clock.advance(1000)
  await clock.settle()
  const before = await cursor()
  for (const k of all) await ui.key({ key: 'j', in: k })
  await clock.settle()
  expect(await cursor()).not.toEqual(before)
  await ui.unmount()
})

test('desktop (#53): every background is translucent or a theme key and no text color is a fixed light or dark hex, so the pane reads in light and dark mode', { timeoutMs: 30_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, { os: 'darwin', env: { HOME: '/home/k' }, cwd: root, top: root, status: '## main\0 M a.ts\0?? b.md\0', numstat: '1\t1\ta.ts\0', dirs: { [root]: [['src', 'dir'], ['a.ts', 'file'], ['b.md', 'file']], [`${root}/src`]: [['c.ts', 'file']] } }, [])
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const bad: string[] = []
  const lum = (hex: string) => {
    const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * (v[0] ?? 0) + 0.7152 * (v[1] ?? 0) + 0.0722 * (v[2] ?? 0)
  }
  const check = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(check)
    if (!n || typeof n !== 'object') return
    const o = n as { type?: unknown; props?: { backgroundColor?: unknown; color?: unknown; hover?: { backgroundColor?: unknown } } }
    for (const bg of [o.props?.backgroundColor, o.props?.hover?.backgroundColor]) if (typeof bg === 'string' && /^#[0-9a-f]{6}$/i.test(bg)) bad.push(`background ${bg}`)
    const c = o.props?.color
    if (o.type === 'Text' && typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) && (lum(c) > 0.45 || lum(c) < 0.04)) bad.push(`text ${c}`)
    Object.values(n).forEach(check)
  }
  check(await ui.drawn())
  await ui.input({ key: 'q', text: 'a', kind: 'change' })
  await clock.advance(200)
  await clock.settle()
  check(await ui.drawn())
  await ui.input({ key: 'q', text: '', kind: 'change' })
  await ui.press({ key: 'nav-help' })
  await clock.settle()
  check(await ui.drawn())
  expect([...new Set(bad)]).toEqual([])
  await ui.unmount()
})

const LONG_ROOT = '/Users/k/work/clients/a-long-client-organisation-name/projects/data-platform-migration-2026/repositories/flood'

function withinPage(tree: unknown) {
  const text = JSON.stringify(tree)
  expect(every(tree, n => has(n, 'type')).length).toBeLessThan(1800)
  expect(text.length).toBeLessThan(230_000)
  expect(every(tree, n => keyOf(n).startsWith('hk-')).length).toBeGreaterThan(0)
  return text
}

async function deskPane($: Engine, on: On, root: string, dirs: World['dirs'], extra: Partial<World> = {}) {
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: '', dirs, status: '', numstat: '', ...extra }, [])
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  return { clock, ui }
}

const selected = async ($: Engine) => JSON.stringify(await $.prompt.submit({ text: 'x', wait: false, origin: { kind: 'composer' } }))

test('desktop (#63): a long root with 300 open files stays under the page caps, so the app accepts every redraw, and a real click selects the row under the pointer', { timeoutMs: 30_000 }, async ($, on) => {
  const root = LONG_ROOT
  const sql = Array.from({ length: 300 }, (_, i): [string, 'file'] => [`m${String(i + 1).padStart(3, '0')}.sql`, 'file'])
  const { clock, ui } = await deskPane($, on, root, { [root]: [['.git', 'dir'], ['migrations', 'dir'], ['src', 'dir']], [`${root}/migrations`]: sql, [`${root}/src`]: [['a.ts', 'file']] })
  await ui.post({ press: `${root}/migrations` }, { in: `hit:${root}/migrations` })
  await clock.settle()
  await ui.post({ key: 'l' }, { in: `hit:${root}/migrations` })
  await clock.settle()
  const text = withinPage(await ui.drawn())
  expect(text).toContain('m001.sql')
  expect(text).toContain('more rows, collapse folders or use search')
  for (const id of [`${root}/migrations/m002.sql`, `${root}/migrations/m005.sql`]) {
    await ui.pointer({ type: 'down', x: 0, y: 0, button: 'left', in: `hit:${id}` })
    await ui.pointer({ type: 'up', x: 0, y: 0, button: 'left', in: `hit:${id}` })
    await clock.advance(1000)
    await clock.settle()
    expect(await selected($)).toContain(id)
  }
  await ui.unmount()
})

test('desktop (#63): a short root with 5000 files in one folder stays under the page caps', { timeoutMs: 30_000 }, async ($, on) => {
  const root = '/Users/k/huge'
  const names = Array.from({ length: 5000 }, (_, i): [string, 'file'] => [`f${i}.txt`, 'file'])
  const { ui } = await deskPane($, on, root, { [root]: names })
  expect(withinPage(await ui.drawn())).toContain('more rows, collapse folders or use search')
  await ui.unmount()
})

test('desktop (#63): a deep open tree under a long root stays under the page caps', { timeoutMs: 30_000 }, async ($, on) => {
  const root = LONG_ROOT
  const dirs: World['dirs'] = {}
  let dir = root
  for (let d = 0; d < 25; d++) {
    const next = `${dir}/level-${String(d).padStart(2, '0')}-folder`
    dirs[dir] = [[next.split('/').pop() ?? '', 'dir'], ...Array.from({ length: 20 }, (_, i): [string, 'file'] => [`file-${i}.ts`, 'file'])]
    dir = next
  }
  dirs[dir] = [['leaf.ts', 'file']]
  const { clock, ui } = await deskPane($, on, root, dirs)
  await $.tool.call({ tool: 'Read', file_path: `${dir}/leaf.ts` })
  await clock.settle()
  withinPage(await ui.drawn())
  await ui.unmount()
})

const sqlFiles = (n: number) => Array.from({ length: n }, (_, i): [string, 'file'] => [`m${String(i + 1).padStart(3, '0')}.sql`, 'file'])

async function openMigrations(ui: Awaited<ReturnType<typeof deskPane>>['ui'], clock: Awaited<ReturnType<typeof deskPane>>['clock'], root: string, folder = 'migrations') {
  await ui.post({ press: `${root}/${folder}` }, { in: `hit:${root}/${folder}` })
  await clock.settle()
  await ui.post({ key: 'l' }, { in: `hit:${root}/${folder}` })
  await clock.settle()
}

const drawnHits = (tree: unknown) => every(tree, n => has(n, 'type') && n.type === 'Client' && keyOf(n).startsWith('hit:')).map(n => keyOf(n).slice(4))

test('desktop (#63): 300 modified files with line counts under a long root stay under the page caps', { timeoutMs: 30_000 }, async ($, on) => {
  const root = LONG_ROOT
  const sql = sqlFiles(300)
  const { clock, ui } = await deskPane($, on, root, { [root]: [['.git', 'dir'], ['migrations', 'dir'], ['src', 'dir']], [`${root}/migrations`]: sql, [`${root}/src`]: [['a.ts', 'file']] }, {
    top: root,
    status: `## main\0${sql.map(([n]) => ` M migrations/${n}\0`).join('')}`,
    numstat: sql.map(([n]) => `12\t3\tmigrations/${n}\0`).join(''),
  })
  await openMigrations(ui, clock, root)
  const text = withinPage(await ui.drawn())
  expect(text).toContain('m001.sql')
  expect(text).toContain('more rows, collapse folders or use search')
  await ui.unmount()
})

test('desktop (#63): an open ignored folder of 300 entries stays under the page caps', { timeoutMs: 30_000 }, async ($, on) => {
  const root = '/Users/k/app'
  const mods = Array.from({ length: 300 }, (_, i): [string, 'dir'] => [`package-number-${String(i).padStart(3, '0')}`, 'dir'])
  const { clock, ui } = await deskPane($, on, root, { [root]: [['node_modules', 'dir'], ['src', 'dir']], [`${root}/node_modules`]: mods, [`${root}/src`]: [['a.ts', 'file']] }, { top: root, status: '## main\0!! node_modules/\0' })
  await openMigrations(ui, clock, root, 'node_modules')
  const tree = await ui.drawn()
  const text = withinPage(tree)
  expect(text).toContain('package-number-000')
  expect(svgs(tree).filter(s => s.alt === 'ignored by git').length).toBeGreaterThan(10)
  await ui.unmount()
})

for (const depth of [4, 12]) {
  test(`desktop (#63): ${depth} levels of open folders with 30 files each stay under the page caps`, { timeoutMs: 30_000 }, async ($, on) => {
    const root = '/Users/k/service'
    const dirs: World['dirs'] = {}
    let dir = root
    for (let d = 0; d < depth; d++) {
      const next = `${dir}/package-level-${d}`
      dirs[dir] = [[next.split('/').pop() ?? '', 'dir'], ...Array.from({ length: 30 }, (_, i): [string, 'file'] => [`ServiceComponent${i}Factory.java`, 'file'])]
      dir = next
    }
    dirs[dir] = Array.from({ length: 30 }, (_, i): [string, 'file'] => [`Leaf${i}.java`, 'file'])
    const { clock, ui } = await deskPane($, on, root, dirs)
    await $.tool.call({ tool: 'Read', file_path: `${dir}/Leaf0.java` })
    await clock.settle()
    const tree = await ui.drawn()
    withinPage(tree)
    expect(drawnHits(tree)).toContain(`${dir}/Leaf0.java`)
    await ui.unmount()
  })
}

test('desktop (#63): End, Home and a click deep in a long cut list keep the cursor row drawn', { timeoutMs: 30_000 }, async ($, on) => {
  const root = LONG_ROOT
  const sql = sqlFiles(300)
  const { clock, ui } = await deskPane($, on, root, { [root]: [['.git', 'dir'], ['migrations', 'dir'], ['src', 'dir']], [`${root}/migrations`]: sql, [`${root}/src`]: [['a.ts', 'file']] }, {
    top: root,
    status: `## main\0${sql.map(([n]) => ` M migrations/${n}\0`).join('')}`,
    numstat: sql.map(([n]) => `12\t3\tmigrations/${n}\0`).join(''),
  })
  await openMigrations(ui, clock, root)
  await ui.post({ key: 'end' }, { in: `hit:${root}/migrations` })
  await clock.settle()
  let tree = await ui.drawn()
  withinPage(tree)
  expect(drawnHits(tree)).toContain(`${root}/src`)
  expect(drawnHits(tree)).toContain(`${root}/migrations/m300.sql`)
  const deep = `${root}/migrations/m280.sql`
  expect(drawnHits(tree)).toContain(deep)
  await ui.pointer({ type: 'down', x: 0, y: 0, button: 'left', in: `hit:${deep}` })
  await ui.pointer({ type: 'up', x: 0, y: 0, button: 'left', in: `hit:${deep}` })
  await clock.advance(1000)
  await clock.settle()
  tree = await ui.drawn()
  expect(drawnHits(tree)).toContain(deep)
  expect(await selected($)).toContain(deep)
  await ui.post({ key: 'home' }, { in: `hit:${deep}` })
  await clock.settle()
  tree = await ui.drawn()
  withinPage(tree)
  expect(drawnHits(tree)).toContain(`${root}/.git`)
  await ui.unmount()
})

test('desktop (#63): 2000 short content matches stay under the page caps', { timeoutMs: 30_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, grepWorld(root, `${Array.from({ length: 2000 }, (_, i) => `f${i}.ts\x001\x00x`).join('\n')}\n`, { os: 'darwin' }), [])
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ key: 'q' }, { in: `hit:${root}/a.ts` })
  await ui.input({ key: 'q', text: 'x', kind: 'change' })
  await clock.settle()
  await clock.advance(200)
  await clock.settle()
  expect(withinPage(await ui.drawn())).toContain('keep typing to narrow')
  await ui.unmount()
})

test('jump mode stays open through a short focus blip, as the Desktop app reports while focus moves into the jump field', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['hooks', 'dir']], [`${root}/hooks`]: [['a.ts', 'file']] },
    find: `${root}/hooks/a.ts\0`,
    exits: { zoxide: [127, 'zoxide: not found'] },
  }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const mount = (isFocused: boolean) => $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: { ...paneProps(60), isFocused } })
  const first = await mount(true)
  await clock.settle()
  await first.post({ key: 'z' }, { in: 'rows' })
  await clock.advance(100)
  await clock.settle()
  await first.unmount()
  const blip = await mount(false)
  await clock.advance(100)
  await clock.settle()
  await blip.unmount()
  const back = await mount(true)
  await clock.advance(1000)
  await clock.settle()
  expect(JSON.stringify(await back.drawn())).toContain('"key":"jump"')
  await back.unmount()
})

test('jump mode leaves out remembered folders that no longer exist and forgets them', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const root = '/home/k/proj'
  let saved: unknown = null
  const seeded = { '/home/k/moved-away': { n: 9, at: 1_799_999_000_000 }, '/home/k/kept': { n: 9, at: 1_799_999_000_000 } }
  on('state.get', (_$, e, next) => (e.key === 'visits' ? { value: { value: saved ?? seeded, version: 1 } } : next(e)))
  on('state.set', (_$, e, next) => {
    if (e.key === 'visits') saved = e.value
    return next(e)
  })
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['hooks', 'dir']], [`${root}/hooks`]: [['a.ts', 'file']], '/home/k/kept': [['b.ts', 'file']] },
    find: `${root}/hooks/a.ts\0`,
    exits: { zoxide: [127, 'zoxide: not found'] },
  }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: { ...paneProps(60), isFocused: true } })
  await clock.settle()
  await ui.post({ key: 'z' }, { in: 'rows' })
  await clock.advance(100)
  await clock.settle()
  const ids = treeRows(await ui.drawn()).rows.map(r => r.id)
  expect(ids).toContain('/home/k/kept')
  expect(ids).not.toContain('/home/k/moved-away')
  expect(JSON.stringify(saved)).not.toContain('moved-away')
  await ui.unmount()
})

test('Follow work in an app without /cd re-roots the tree and leaves Claude where it is, with no failure toast', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const a = '/home/k/a', b = '/home/k/b'
  const ran: Ran = []
  const { ui, root, reads } = await workSession($, on, { ...WORK_WORLD(a, b), noCd: true }, ran)
  await reads(b)
  expect(ran.some(r => r[0] === 'cd')).toBe(false)
  expect(ran.some(r => r[0] === 'toast')).toBe(false)
  expect(await root()).toBe(`${b}/b.ts`)
  await ui.unmount()
})

test('desktop: jump mode heads the date column Last accessed and dates each remembered folder by its last visit', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/Users/k/proj'
  const at = 1_799_990_000_000
  on('state.get', (_$, e, next) => (e.key === 'visits' ? { value: { value: { '/Users/k/kept': { n: 3, at } }, version: 1 } } : next(e)))
  const clock = world(on, {
    os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['hooks', 'dir'], ['a.ts', 'file']], [`${root}/hooks`]: [['b.ts', 'file']], '/Users/k/kept': [['c.ts', 'file']] },
    find: `${root}/hooks/b.ts\0`,
    exits: { zoxide: [127, 'zoxide: not found'] },
  }, [])
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: { ...paneProps(60), isFocused: true } })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).toContain('Modified')
  await ui.post({ key: 'z' }, { in: `hit:${root}/a.ts` })
  await clock.advance(100)
  await clock.settle()
  const drawn = JSON.stringify(await ui.drawn())
  expect(drawn).toContain('Last accessed')
  expect(drawn).not.toContain('"Modified"')
  expect(drawn).toContain(stamp(at))
})

test('jump mode opens on the 10 most recently visited folders, newest first, and ranks by match once you type', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const root = '/home/k/proj'
  const names = Array.from({ length: 12 }, (_, i) => `/home/k/r${String(i).padStart(2, '0')}`)
  const seeded = Object.fromEntries(names.map((p, i) => [p, { n: 1, at: 1_799_000_000_000 + i * 1000 }]))
  seeded['/home/k/often-api'] = { n: 50, at: 1_700_000_000_000 }
  on('state.get', (_$, e, next) => (e.key === 'visits' ? { value: { value: seeded, version: 1 } } : next(e)))
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['hooks', 'dir']], [`${root}/hooks`]: [['a.ts', 'file']], ...Object.fromEntries([...names, '/home/k/often-api'].map(p => [p, [['x.ts', 'file']]])) },
    find: `${root}/hooks/a.ts\0`,
    exits: { zoxide: [127, 'zoxide: not found'] },
  }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: { ...paneProps(60), isFocused: true } })
  await clock.settle()
  await ui.post({ key: 'z' }, { in: 'rows' })
  await clock.advance(100)
  await clock.settle()
  expect(treeRows(await ui.drawn()).rows.map(r => r.id)).toEqual([...names].reverse().slice(0, 10))
  await ui.input({ key: 'jump', text: 'api', kind: 'change' })
  await clock.settle()
  expect(treeRows(await ui.drawn()).rows.map(r => r.id)[0]).toBe('/home/k/often-api')
  await ui.unmount()
})

test('terminal: jump mode heads the date column Last accessed and dates each remembered folder by its last visit', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const root = '/home/k/proj'
  const at = 1_799_990_000_000
  on('state.get', (_$, e, next) => (e.key === 'visits' ? { value: { value: { '/home/k/kept': { n: 3, at } }, version: 1 } } : next(e)))
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['hooks', 'dir'], ['a.ts', 'file']], [`${root}/hooks`]: [['b.ts', 'file']], '/home/k/kept': [['c.ts', 'file']] },
    find: `${root}/hooks/b.ts\0`,
    exits: { zoxide: [127, 'zoxide: not found'] },
  }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: { ...paneProps(80), isFocused: true } })
  await clock.settle()
  await ui.post({ key: 'z' }, { in: 'rows' })
  await clock.advance(100)
  await clock.settle()
  const drawn = await texts(ui)
  expect(drawn).toContain('Last accessed')
  expect(drawn).toContain(stamp(at))
  await ui.unmount()
})

for (const [label, options, terminalInk, deskInk] of [['default', {}, 'ansi256(5)', '#9a64f7'], ['palette jump=#ff00aa', { palette: 'jump=#ff00aa' }, '#ff00aa', '#ff00aa']] as const) {
  for (const surface of ['terminal', 'desktop'] as const) {
    test(`${surface}: jump mode draws its folder glyphs and its chip in the jump color (${label}), apart from the blue tree folders`, { timeoutMs: 20_000, options: { glyphs: 'plain', ...options } }, async ($, on) => {
      const root = '/home/k/proj'
      on('state.get', (_$, e, next) => (e.key === 'visits' ? { value: { value: { '/home/k/kept': { n: 3, at: 1_799_990_000_000 } }, version: 1 } } : next(e)))
      const clock = world(on, {
        os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', status: '', numstat: '',
        dirs: { [root]: [['hooks', 'dir'], ['a.ts', 'file']], [`${root}/hooks`]: [['b.ts', 'file']], '/home/k/kept': [['c.ts', 'file']] },
        find: `${root}/hooks/b.ts\0`,
        exits: { zoxide: [127, 'zoxide: not found'] },
      }, [])
      await $.session.start({ cwd: root, surface, isInteractive: true })
      await clock.settle()
      const ui = await $.ui.mount({ plugin: 'filetree', surface, component: 'Pane', requestId: 'filetree', props: { ...paneProps(80), isFocused: true } })
      await clock.settle()
      const folderInk = async (id: string, name: string) => {
        const tree = await ui.drawn()
        if (surface === 'desktop') return /fill="(#[0-9a-f]{6})"/.exec(svgs(tree).find(s => s.alt === `folder ${name}`)?.source ?? '')?.[1]
        const row = treeRows(tree).rows.find(r => r.id === id)
        return row?.left.find(s => s.t === '■ ')?.c
      }
      const treeInk = await folderInk(`${root}/hooks`, 'hooks')
      expect(treeInk).toBeDefined()
      expect(treeInk).not.toBe(surface === 'desktop' ? deskInk : terminalInk)
      await ui.post({ key: 'z' }, surface === 'desktop' ? { in: `hit:${root}/a.ts` } : { in: 'rows' })
      await clock.advance(100)
      await clock.settle()
      expect(await folderInk('/home/k/kept', '/home/k/kept')).toBe(surface === 'desktop' ? deskInk : terminalInk)
      const chipInk = (surface === 'desktop' ? deskInk : terminalInk).replace(/[()]/g, '\\$&')
      expect(JSON.stringify(await ui.drawn())).toMatch(new RegExp(`"color":"${chipInk}"[^{}]*\\},"children":\\["jump ?"\\]`))
      await ui.unmount()
    })
  }
}

const tallBoxes = (tree: unknown) => every(tree, n => has(n, 'type') && n.type === 'Box' && has(propsOf(n), 'height') && typeof (propsOf(n) as { height?: unknown }).height === 'number' && ((propsOf(n) as { height: number }).height > 2))

test('desktop: no row in the tree, the jump list or its empty note is drawn taller than two lines', { timeoutMs: 30_000 }, async ($, on) => {
  const root = '/Users/k/proj'
  const w: World = {
    os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['hooks', 'dir'], ['a.ts', 'file']], [`${root}/hooks`]: [['b.ts', 'file']] },
    find: `${root}/hooks/b.ts\0`,
    exits: { zoxide: [127, 'zoxide: not found'] },
  }
  const clock = world(on, w, [])
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: { ...paneProps(60), isFocused: true } })
  await clock.settle()
  expect(tallBoxes(await ui.drawn())).toEqual([])
  await ui.post({ key: 'z' }, { in: `hit:${root}/a.ts` })
  await clock.advance(100)
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).toContain('jump:')
  expect(tallBoxes(await ui.drawn())).toEqual([])
  await ui.input({ key: 'jump', text: 'zzzz-nothing', kind: 'change' })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).toContain('no matching folder')
  expect(tallBoxes(await ui.drawn())).toEqual([])
  await ui.unmount()
})

test('Follow work without /cd keeps the tree on the repo it moved to while the work stays there, and moves it back once the work returns to the first repo', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const a = '/home/k/a', b = '/home/k/b'
  const w: World = { ...WORK_WORLD(a, b), noCd: true }
  w.dirs[a] = [['b.ts', 'file'], ['c.ts', 'file'], ['d.ts', 'file'], ['e.ts', 'file']]
  const ran: Ran = []
  const { ui, root, reads, clock } = await workSession($, on, w, ran)
  await reads(b)
  expect(await root()).toBe(`${b}/b.ts`)
  await ui.post({ press: `${b}/c.ts` }, { in: 'rows' })
  await clock.advance(1000)
  await ui.post({ key: 'v' }, { in: 'rows' })
  await clock.settle()
  const marked = async () => JSON.stringify(await ui.drawn()).includes('1 marked') && (await selected($)).includes(`${b}/c.ts`)
  expect(await marked()).toBe(true)
  await clock.advance(200_000)
  await reads(b)
  expect(await marked()).toBe(true)
  await clock.advance(200_000)
  await reads(a)
  expect(await root()).toBe(`${a}/b.ts`)
  expect(ran.some(r => r[0] === 'cd')).toBe(false)
  await ui.unmount()
})

test('jump mode stays open through two short focus blips in a row, and a blip before Esc never closes the jump opened after it', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['hooks', 'dir']], [`${root}/hooks`]: [['a.ts', 'file']] },
    find: `${root}/hooks/a.ts\0`,
    exits: { zoxide: [127, 'zoxide: not found'] },
  }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: { ...paneProps(60), isFocused: true } })
  await clock.settle()
  const focus = async (isFocused: boolean, ms: number) => {
    await ui.redraw({ ...paneProps(60), isFocused })
    await clock.advance(ms)
    await clock.settle()
  }
  const open = async () => JSON.stringify(await ui.drawn()).includes('"key":"jump"')
  await ui.post({ key: 'z' }, { in: 'rows' })
  await focus(true, 100)
  await focus(false, 300)
  await focus(true, 50)
  await focus(false, 300)
  await focus(true, 1000)
  expect(await open()).toBe(true)
  await focus(false, 300)
  await ui.post({ key: 'escape' }, { in: 'rows' })
  await clock.settle()
  expect(await open()).toBe(false)
  await ui.post({ key: 'z' }, { in: 'rows' })
  await focus(true, 50)
  await focus(false, 300)
  await focus(true, 1000)
  expect(await open()).toBe(true)
  await ui.unmount()
})

test('an older jump listing still forgetting a missing folder never overwrites the rows of the query typed after it', { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
  const root = '/home/k/proj'
  const seeded = { '/home/k/moved-away': { n: 9, at: 1_799_999_000_000 }, '/home/k/kept': { n: 9, at: 1_799_998_000_000 }, '/home/k/other': { n: 9, at: 1_799_997_000_000 } }
  let saved: unknown = null
  let slow = false
  on('state.get', (_$, e, next) => (e.key === 'visits' ? { value: { value: saved ?? seeded, version: 1 } } : next(e)))
  on('state.set', async (_$, e, next) => {
    if (e.key === 'visits') {
      saved = e.value
      if (slow) await clock.sleep(500)
    }
    return next(e)
  })
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['hooks', 'dir']], [`${root}/hooks`]: [['a.ts', 'file']], '/home/k/kept': [['b.ts', 'file']], '/home/k/other': [['c.ts', 'file']] },
    find: `${root}/hooks/a.ts\0`,
    exits: { zoxide: [127, 'zoxide: not found'] },
  }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: { ...paneProps(60), isFocused: true } })
  await clock.settle()
  slow = true
  await ui.post({ key: 'z' }, { in: 'rows' })
  await clock.advance(100)
  await clock.settle()
  await ui.input({ key: 'jump', text: 'kept', kind: 'change' })
  await clock.settle()
  expect(treeRows(await ui.drawn()).rows.map(r => r.id)).toEqual(['/home/k/kept'])
  await clock.advance(1000)
  await clock.settle()
  expect(treeRows(await ui.drawn()).rows.map(r => r.id)).toEqual(['/home/k/kept'])
  expect(JSON.stringify(saved)).not.toContain('moved-away')
  await ui.unmount()
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: jump mode in an empty root dates each remembered folder under a plain Last accessed header that sorts nothing`, { timeoutMs: 20_000, options: { glyphs: 'plain' } }, async ($, on) => {
    const root = '/home/k/empty'
    const at = 1_799_990_000_000
    on('state.get', (_$, e, next) => (e.key === 'visits' ? { value: { value: { '/home/k/kept': { n: 3, at } }, version: 1 } } : next(e)))
    const clock = world(on, {
      os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', status: '', numstat: '',
      dirs: { [root]: [], '/home/k/kept': [['c.ts', 'file']] },
      find: '',
      exits: { zoxide: [127, 'zoxide: not found'] },
    }, [])
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface, component: 'Pane', requestId: 'filetree', props: { ...paneProps(80), isFocused: true } })
    await clock.settle()
    await ui.post({ key: 'z' }, { in: surface === 'desktop' ? 'hit:root' : 'rows' })
    await clock.advance(100)
    await clock.settle()
    const drawn = JSON.stringify(await ui.drawn())
    expect(drawn).toContain('/home/k/kept')
    expect(drawn).toContain('Last accessed')
    expect(drawn).toContain(stamp(at))
    expect(drawn).not.toMatch(/ [▾▴]/)
    expect(drawn).not.toMatch(/"key":"(button-)?sort-(name|git|metric)"/)
    await ui.unmount()
  })
}
