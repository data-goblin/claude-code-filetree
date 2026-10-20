import { expect, mock, test } from 'claude-code/testing'

import { LINUX_LAUNCH, TMUX_OPEN } from '../hooks/open'
import { age, ancestorsOf, formatSize, replaceChildren, toNodes } from '../hooks/tree'

type World = {
  os: 'darwin' | 'linux' | 'win32'
  env: Record<string, string>
  cwd: string
  top: string
  dirs: Record<string, [string, 'file' | 'dir'][]>
  status: string
  numstat: string
  exits?: Record<string, [number, string]>
  stdout?: Record<string, string>
  delays?: Record<string, number[]>
  denied?: string[]
  heads?: string[]
  tool?: (e: any) => unknown
  find?: string
  theme?: { toml: string; mtimeMs: number }
  du?: Record<string, string>
  duDelays?: number[]
  links?: string[]
  files?: Record<string, string>
  mtimes?: Record<string, number>
  patch?: string
  untracked?: string[]
  untrackedPatch?: string
  unborn?: boolean
}
type Ran = string[][]
const HERDR_SPLIT = '{"id":"cli:pane:split","result":{"pane":{"agent_status":"unknown","cwd":"/home/k/proj","focused":false,"pane_id":"w1:p37","parent_pane_id":"w1:p35","tab_id":"w1:tV","workspace_id":"w1"},"type":"pane_info"}}'
const opens: unknown[] = []
const envs: Record<string, string>[] = []

function world(on: any, w: World, ran: Ran) {
  mock.env(on, w.env)
  const clock = mock.clock(on, { now: 1_800_000_000_000 })
  mock.store(on)
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: w.cwd }))
  on('session.id', () => ({ value: 'test-session' }))
  on('command.register', () => ({ value: undefined }))
  on('ui.open', (_$: any, e: any) => {
    opens.push(e)
    return { value: { isPlaced: true } }
  })
  on('ui.toast', (_$: any, e: any) => {
    ran.push(['toast', String(e.text ?? e.message ?? JSON.stringify(e))])
    return { value: undefined }
  })
  const isTheme = (p: string) => p.replace(/\\/g, '/').endsWith('/.local/state/omarchy/current/theme/colors.toml')
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/^.*?(?=[A-Za-z]:\/)/, '')
  on('fs.read', (_$: any, e: any) => {
    if (w.theme && isTheme(e.path)) return { value: w.theme.toml }
    const file = norm(e.path).replace(/^[A-Za-z]:/, '')
    if (w.files && file in w.files) return { value: w.files[file] }
    throw new Error('no theme file')
  })
  const dirOf = (p: string) => w.dirs[p] ?? w.dirs[p.replace(/^[A-Za-z]:/, '')]
  on('fs.list', async (_$: any, e: any) => {
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
  on('fs.stat', (_$: any, e: any) => {
    if (isTheme(e.path)) {
      ran.push(['theme-stat'])
      if (!w.theme) throw new Error(`ENOENT ${e.path}`)
      return { value: { kind: 'file', size: w.theme.toml.length, mtimeMs: w.theme.mtimeMs, isLink: false } }
    }
    const p = norm(e.path)
    const parent = p.slice(0, p.lastIndexOf('/')) || '/'
    const name = p.slice(p.lastIndexOf('/') + 1)
    const hit = dirOf(p) ? 'dir' : dirOf(parent)?.find(([n]) => n === name)?.[1]
    if (!hit) throw new Error(`ENOENT ${e.path}`)
    return { value: { kind: hit, size: 1, mtimeMs: w.mtimes?.[p.replace(/^[A-Za-z]:/, '')] ?? (name === 'a.ts' ? 1_800_000_000_500 : 1_700_000_000_000), isLink: false } }
  })
  on('process.run', async (_$: any, e: any) => {
    const argv: string[] = [...e.argv]
    ran.push(argv)
    if (e.init?.env) envs.push(e.init.env)
    const ok = (stdout: string) => ({ value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    const exit = w.exits?.[argv[0] ?? '']
    if (exit) return { value: { exitCode: exit[0], stdout: '', stderr: exit[1], isStdoutTruncated: false, isStderrTruncated: false } }
    const out = w.stdout?.[argv.slice(0, 3).join(' ')]
    if (out !== undefined) return ok(out)
    if (argv[0] === 'find' && w.find !== undefined) return ok(w.find)
    if (argv[0] === 'du') {
      const delay = w.duDelays?.shift()
      if (delay) await clock.sleep(delay)
      return ok(w.du?.[argv.at(-1) ?? ''] ?? '')
    }
    if (argv[0] === 'uname') return ok(w.os === 'darwin' ? 'Darwin\n' : 'Linux\n')
    if (argv[0] === 'sh') return ok('missing\n')
    if (argv[0] === 'git') {
      const verb = argv.slice(4).find(a => !a.startsWith('-'))
      if (verb === 'hash-object') return ok('4b825dc642cb6eb9a060e54bf8d69288fbee4904\n')
      if (verb === 'rev-parse' && argv.includes('--verify') && w.unborn) return { value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
      if (verb === 'rev-parse' && argv.at(-1) === 'HEAD') return ok(`${(w.heads && w.heads.length > 1 ? w.heads.shift() : w.heads?.[0]) ?? ''}\n`)
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
  on('tool.call', (_$: any, e: any) => (w.tool?.(e) ?? { result: { stdout: '', stderr: '' } }) as any)
  on('prompt.submit', (_$: any, e: any) => ({ text: e.text, context: e.context }))
  return clock
}

const paneProps = (bodyColumns: number) => ({ title: 'Files', isFocused: false, bodyColumns, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} }) as any

async function texts(ui: any): Promise<string> {
  const rows = JSON.stringify(await ui.drawn({ in: 'rows' }))
  return JSON.stringify(await ui.drawn()) + rows
}

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
  for (const word of ['README.md', 'notes.md', 'src', 'main', 'origin/main']) expect(shown).toContain(word)
  expect(NERD.test(shown)).toBe(false)
  await ui.post({ press: `${root}/README.md` }, { in: 'rows' })
  await clock.settle()
  expect(await texts(ui)).toContain('"selected: ","README.md"')
  const sent = await $.prompt.submit({ text: 'what is this?', wait: false } as any)
  expect(JSON.stringify(sent)).toContain(`${root}/README.md`)
  await ui.post({ press: `${root}/README.md` }, { in: 'rows' })
  await clock.settle()
  expect(ran).toContainEqual(['open', '--', `${root}/README.md`])
  expect(ran.some(a => a[0] === 'setsid' || a[0] === 'gio')).toBe(false)
  await $.tool.call({ tool: 'Bash', command: 'echo hi >> src/a.ts' } as any)
  await clock.settle()
  const finds = ran.filter(a => a[0] === 'find')
  expect(finds.length).toBeGreaterThan(0)
  expect(finds.every(f => f.includes('-newer') && !f.includes('-newermt'))).toBe(true)
  expect(ran.some(a => a[0] === 'touch' && a[1]?.startsWith('/var/folders/x/T/filetree-'))).toBe(true)
  expect(ran.some(a => a[0] === 'rm')).toBe(true)
  await ui.unmount()
})

test('macOS outside a repo: write scan uses find -newer marker, not GNU -newermt', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/Users/k/scratch'
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: '', dirs: { [root]: [['a.ts', 'file']] }, status: '', numstat: '' }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  await $.tool.call({ tool: 'Bash', command: 'echo hi > a.ts' } as any)
  await clock.settle()
  const find = ran.find(a => a[0] === 'find')
  expect(find).toBeDefined()
  expect(find).toContain('-newer')
  expect(find).not.toContain('-newermt')
})

test('macOS: the Nerd Font probe skips the LastResort placeholder font and still checks the Fonts folders', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/Users/k/scratch'
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: '', dirs: { [root]: [['a.ts', 'file']] }, status: '', numstat: '' }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const probe = ran.find(a => a[0] === 'sh' && (a[2] ?? '').includes('fc-list'))?.[2] ?? ''
  const filtered = probe.indexOf('fc-list ":charset=$1" file | grep -vi lastresort')
  expect(filtered).toBeGreaterThan(-1)
  expect(probe.indexOf('Library/Fonts/*Nerd*')).toBeGreaterThan(filtered)
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
  await $.tool.call({ tool: 'Edit', file_path: 'C:\\Users\\k\\proj\\src\\a.ts', old_string: 'a', new_string: 'b' } as any)
  await clock.settle()
  const shown = await texts(ui)
  expect(shown).toContain('a.ts')
  expect(shown).toContain('+1')
  await $.tool.call({ tool: 'Bash', command: 'echo x >> src/a.ts' } as any)
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
  await $.tool.call({ tool: 'Bash', command: 'echo hi > c.txt' } as any)
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
  await ui.press({ key: 'hidden' })
  await clock.settle()
  expect(await texts(ui)).not.toContain('.env')
  await ui.press({ key: 'hidden' })
  await ui.input({ key: 'q', text: 'a.ts' })
  await clock.settle()
  const jumped = await texts(ui)
  expect(jumped).toContain('a.ts')
  expect(jumped).toContain('"value":""')
  await ui.press({ key: 'collapse' })
  await clock.settle()
  expect(await texts(ui)).not.toContain(`"id":"${root}/src/a.ts"`)
  await ui.press({ key: 'up' })
  await clock.settle()
  expect(await texts(ui)).toContain('"proj"')
  await ui.press({ key: 'cwd' })
  await clock.settle()
  expect(await texts(ui)).toContain('README.md')
  await ui.unmount()
})

test('hovering a header button says what it does left of the buttons where it fits, and the buttons sit a column apart', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/Users/k/proj'
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: root, dirs: { [root]: [['.env', 'file'], ['a.ts', 'file']] }, status: '## main\0', numstat: '' }, ran)
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ plugin: 'filetree', surface, component: 'Pane', requestId: 'filetree', props: paneProps(60) })
    await clock.settle()
    expect(JSON.stringify(await ui.drawn())).toContain('"gap":1')
    expect(await texts(ui)).not.toContain('reload tree and git')
    await ui.pointer({ type: 'enter', x: 0, y: 0, in: 'button-refresh' })
    await clock.settle()
    expect(await texts(ui)).toContain('"reload tree and git "')
    await ui.pointer({ type: 'leave', x: 0, y: 0, in: 'button-refresh' })
    await clock.settle()
    expect(await texts(ui)).not.toContain('reload tree and git')
    await ui.pointer({ type: 'enter', x: 0, y: 0, in: 'button-hidden' })
    await clock.settle()
    expect(await texts(ui)).toContain('"hide hidden files "')
    await ui.press({ key: 'hidden' })
    await clock.settle()
    expect(await texts(ui)).toContain('"show hidden files "')
    await ui.press({ key: 'hidden' })
    await ui.pointer({ type: 'leave', x: 0, y: 0, in: 'button-hidden' })
    await clock.settle()
    await ui.unmount()
  }
  const narrow = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(24) })
  await clock.settle()
  await narrow.pointer({ type: 'enter', x: 0, y: 0, in: 'button-refresh' })
  await clock.settle()
  expect(await texts(narrow)).not.toContain('reload tree and git')
  await narrow.pointer({ type: 'leave', x: 0, y: 0, in: 'button-refresh' })
  await narrow.unmount()
})

test('outside a repo only git rev-parse runs, never status, diff or ls-files', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/scratch'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['c.txt', 'file']] }, status: '', numstat: '' }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  await $.tool.call({ tool: 'Bash', command: 'echo hi > c.txt' } as any)
  await $.tool.call({ tool: 'Edit', file_path: `${root}/c.txt`, old_string: 'a', new_string: 'b' } as any)
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
  await $.tool.call({ tool: 'NotebookEdit', notebook_path: `${root}/nb/a.ipynb`, new_source: 'x' } as any)
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
  const names = Array.from({ length: 60 }, (_, i) => [`f${String(i).padStart(2, '0')}.txt`, 'file'] as [string, 'file'])
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: names }, status: '', numstat: '' }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const props = { ...paneProps(60), scroll: { offset: 0, bodyRows: 20 } }
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props })
  await clock.settle()
  const rowsOf = async () => ((await ui.drawn()) as any).children.find((c: any) => c.type === 'Client').props.props
  let p = await rowsOf()
  expect(p.bar).toBeDefined()
  expect(p.rows[0].id).toBe(`${root}/f00.txt`)
  expect(JSON.stringify(p.rows)).not.toContain('below')
  await $.ui.scroll({ component: 'Pane', requestId: 'filetree', by: 1 } as any)
  await clock.settle()
  p = await rowsOf()
  expect(p.rows[0].id).toBe(`${root}/f03.txt`)
  await ui.post({ scrollTo: 1 }, { in: 'rows' })
  await clock.settle()
  p = await rowsOf()
  expect(p.rows.at(-1).id).toBe(`${root}/f59.txt`)
  const first = p.rows[0].id
  await ui.post({ press: p.rows[5].id }, { in: 'rows' })
  await clock.settle()
  p = await rowsOf()
  expect(p.rows[0].id).toBe(first)
  expect(p.active).toBe(p.rows[5].id)
  await ui.unmount()
})

test('desktop: a long tree draws every row and leaves the wheel to the app', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/Users/k/big'
  const names = Array.from({ length: 60 }, (_, i) => [`f${String(i).padStart(2, '0')}.txt`, 'file'] as [string, 'file'])
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k', TMPDIR: '/var/folders/x/T/' }, cwd: root, top: '', dirs: { [root]: names }, status: '', numstat: '' }, [])
  const appScrolls: number[] = []
  on('ui.scroll', (_$: any, e: any) => (appScrolls.push(e.by), {}))
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const props = { ...paneProps(60), scroll: { offset: 0, bodyRows: 20 } }
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props })
  await clock.settle()
  const rowsOf = async () => ((await ui.drawn()) as any).children.find((c: any) => c.type === 'Client').props.props
  let p = await rowsOf()
  expect(p.bar).toBeUndefined()
  expect(p.rows.length).toBe(60)
  expect(p.rows.at(-1).id).toBe(`${root}/f59.txt`)
  const wheel = { component: 'Pane', requestId: 'filetree', by: 1, offset: 1, bodyRows: 20, contentRows: 64, origin: { kind: 'person' } }
  expect(await $.ui.scroll(wheel as any)).toEqual({})
  expect(appScrolls).toEqual([1])
  await clock.settle()
  p = await rowsOf()
  expect(p.rows.length).toBe(60)
  expect(p.rows[0].id).toBe(`${root}/f00.txt`)
  await ui.unmount()
})

test('desktop: a very large open tree is cut with a note so the drawn tree stays within the engine bounds', { timeoutMs: 30_000 }, async ($, on) => {
  const root = '/Users/k/huge'
  const names = Array.from({ length: 5000 }, (_, i) => [`file-number-${String(i).padStart(5, '0')}.txt`, 'file'] as [string, 'file'])
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k', TMPDIR: '/var/folders/x/T/' }, cwd: root, top: '', dirs: { [root]: names }, status: '', numstat: '' }, [])
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: { ...paneProps(60), scroll: { offset: 0, bodyRows: 20 } } })
  await clock.settle()
  const client = ((await ui.drawn()) as any).children.find((c: any) => c.type === 'Client')
  const rows = client.props.props.rows as any[]
  expect(JSON.stringify(client.props.props).length).toBeLessThan(100_000)
  expect(rows.length).toBeLessThan(5000)
  expect(rows.at(-1).id).toBe('')
  expect(rows.at(-1).left[0].t).toContain('more rows')
  await ui.unmount()
})

async function scrolledTree($: any, on: any) {
  const root = '/home/k/big'
  const files = Array.from({ length: 60 }, (_, i) => [`f${String(i).padStart(2, '0')}.txt`, 'file'] as [string, 'file'])
  const kids = Array.from({ length: 5 }, (_, i) => [`a${i}.txt`, 'file'] as [string, 'file'])
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a', 'dir'], ...files], [`${root}/a`]: kids }, status: '', numstat: '' }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: { ...paneProps(60), scroll: { offset: 0, bodyRows: 20 } } })
  await clock.settle()
  await $.ui.scroll({ component: 'Pane', requestId: 'filetree', by: 1 } as any)
  await clock.settle()
  const ids = async () => (((await ui.drawn()) as any).children.find((c: any) => c.type === 'Client').props.props.rows as { id: string }[]).map(r => r.id)
  expect((await ids())[0]).toBe(`${root}/f02.txt`)
  return { root, clock, ui, ids }
}

test('follow on: the tree scrolls to the file Claude reads', { timeoutMs: 20_000 }, async ($, on) => {
  const { root, clock, ui, ids } = await scrolledTree($, on)
  await $.tool.call({ tool: 'Read', file_path: `${root}/f55.txt` } as any)
  await clock.settle()
  expect(await ids()).toContain(`${root}/f55.txt`)
  expect((await ids())[0]).not.toBe(`${root}/f02.txt`)
  await ui.unmount()
})

test('follow off: reads, writes and folders Claude opens above the view never move it', { timeoutMs: 20_000, options: { follow: 'off' } }, async ($, on) => {
  const { root, clock, ui, ids } = await scrolledTree($, on)
  await $.tool.call({ tool: 'Read', file_path: `${root}/f55.txt` } as any)
  await clock.settle()
  expect((await ids())[0]).toBe(`${root}/f02.txt`)
  expect(await ids()).not.toContain(`${root}/f55.txt`)
  await $.tool.call({ tool: 'Read', file_path: `${root}/f05.txt` } as any)
  await clock.settle()
  expect((await ids())[0]).toBe(`${root}/f02.txt`)
  expect(await texts(ui)).toContain(shimmer('f05.txt', 'purple'))
  await $.tool.call({ tool: 'Read', file_path: `${root}/a/a3.txt` } as any)
  await clock.settle()
  expect((await ids())[0]).toBe(`${root}/f02.txt`)
  await $.tool.call({ tool: 'Edit', file_path: `${root}/f40.txt`, old_string: 'a', new_string: 'b' } as any)
  await clock.settle()
  expect((await ids())[0]).toBe(`${root}/f02.txt`)
  await $.ui.scroll({ component: 'Pane', requestId: 'filetree', by: 1 } as any)
  await clock.settle()
  expect((await ids())[0]).toBe(`${root}/f05.txt`)
  await ui.unmount()
})

test('watches only git metadata, copies paths, clears search, Home and End', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [root]: [['.git', 'dir'], ['a.txt', 'file'], ['b.txt', 'file'], ['c.txt', 'file']], [`${root}/.git`]: [['index', 'file'], ['HEAD', 'file']] }, status: '## main\0', numstat: '' }, ran)
  const copied: string[] = []
  on('ui.copy', (_$: any, e: any) => {
    copied.push(e.text)
    return { value: { isCopied: true } }
  })
  on('classic.SessionStart', () => ({}))
  on('classic.FileChanged', () => ({}))
  const started = await $.classic.SessionStart({ source: 'startup', cwd: root } as any)
  expect((started as any).watchPaths).toEqual([`${root}/.git/index`, `${root}/.git/HEAD`])
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
  const rowsOf = async () => ((await ui.drawn()) as any).children.find((c: any) => c.type === 'Client').props.props
  expect((await rowsOf()).active).toBe(`${root}/c.txt`)
  await ui.post({ key: 'home' }, { in: 'rows' })
  await clock.settle()
  expect((await rowsOf()).active).toBe(`${root}/.git`)
  await ui.press({ key: 'nav-j' })
  await clock.settle()
  expect((await rowsOf()).active).not.toBe(`${root}/.git`)
  await ui.press({ key: 'nav-k' })
  await clock.settle()
  expect((await rowsOf()).active).toBe(`${root}/.git`)
  await ui.input({ key: 'q', text: 'c', kind: 'submit' })
  await clock.settle()
  expect((await rowsOf()).active).toBe(`${root}/c.txt`)
  const before = ran.filter(a => a.includes('status')).length
  await $.classic.FileChanged({ file_path: `${root}/.git/index`, event: 'change' } as any)
  await clock.advance(400)
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
  on('session.end', (_$: any, e: any) => ({ sessionId: e.sessionId }))
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  expect(await texts(ui)).toContain(`"id":"${root}/a.ts"`)
  w.cwd = `${root}/sub`
  await $.session.end({ reason: 'clear', sessionId: 'test-session' } as any)
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
  on('ui.close', (_$: any, e: any) => {
    closed.push(e)
    return { value: undefined }
  })
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const before = opened.length
  const r = await $.command.run({ command: 'filetree', args: '', origin: { kind: 'person' }, presentation: { isFullscreen: false, columns: 200 } } as any)
  expect(JSON.stringify(r)).toContain('/tui fullscreen')
  expect(opened.length).toBe(before)
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: { ...paneProps(60), placement: 'inline' } })
  await clock.settle()
  expect(closed.length).toBeGreaterThan(0)
  await ui.unmount()
})

test('in the desktop app /filetree opens the pane without the terminal layout checks', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.txt', 'file']] }, status: '', numstat: '' }, ran)
  on('session.surfaces', () => ({ value: ['desktop'] }))
  await $.session.start({ cwd: root, surface: null, isInteractive: false })
  await clock.settle()
  const before = opens.length
  const r = await $.command.run({ command: 'filetree', args: '', origin: { kind: 'sdk' }, presentation: { isFullscreen: false, columns: 80 } } as any)
  await clock.settle()
  expect(JSON.stringify(r)).toContain('File tree on')
  expect(opens.length).toBeGreaterThan(before)
  expect(opens.at(-1)).toMatchObject({ id: 'filetree', focus: true })
})

const shimmer = (name: string, tone: string) => `"t":${JSON.stringify(name)},"sh":"${tone}"`
const fullscreen = (args: string) => ({ command: 'filetree', args, origin: { kind: 'person' }, presentation: { isFullscreen: true, columns: 200 } }) as any

test('after /clear the tree rebuilds itself, keeps a pinned folder, and an empty root never loops', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.ts', 'file'], ['sub', 'dir']], [`${root}/sub`]: [['b.ts', 'file']] }, status: '', numstat: '' }, ran)
  on('classic.SessionStart', () => ({}))
  expect(ancestorsOf('/repo/a.ts', '')).toEqual([])
  expect(ancestorsOf('/repo2/a.ts', '/repo')).toEqual([])
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await $.tool.call({ tool: 'Read', file_path: `${root}/a.ts` } as any)
  await clock.settle()
  await $.classic.SessionStart({ source: 'clear', cwd: root } as any)
  await clock.settle()
  expect(await texts(ui)).toContain(`"id":"${root}/a.ts"`)
  await $.command.run(fullscreen(`${root}/sub`))
  await clock.settle()
  await $.classic.SessionStart({ source: 'clear', cwd: root } as any)
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
  await ui.post({ press: `${root}/a.xyz` }, { in: 'rows' })
  await ui.post({ press: `${root}/a.xyz` }, { in: 'rows' })
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

for (const [visual, editor, chosen] of [['vim', 'nano', 'vim'], ['', 'nano', 'nano'], ['', '', 'vi']]) {
  test(`open with editor: VISUAL=${visual}, EDITOR=${editor} chooses ${chosen}`, { timeoutMs: 20_000, options: { open: 'editor' } }, async ($, on) => {
    const ran: Ran = []
    const root = '/home/k/proj'
    const clock = world(on, { os: 'linux', env: { HOME: '/home/k', TMUX: '/tmp/tmux-1000/default,1,0', VISUAL: visual, EDITOR: editor }, cwd: root, top: '', dirs: { [root]: [['a b.md', 'file']] }, status: '', numstat: '' }, ran)
    await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
    await ui.post({ press: `${root}/a b.md` }, { in: 'rows' })
    await ui.press({ key: 'nav-o' })
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
    const env = os === 'win32' ? { OS: 'Windows_NT', TMUX: '/tmp/tmux-501/default,1,0', HERDR_ENV: '1', EDITOR: 'vim' } : { HOME: '/Users/k', EDITOR: 'vim' }
    const clock = world(on, { os, env, cwd: root, top: '', dirs: { [root]: [['a.md', 'file']] }, status: '', numstat: '' }, ran)
    await $.session.start({ cwd: root, surface, isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface, component: 'Pane', requestId: 'filetree', props: paneProps(60) })
    ran.length = 0
    await ui.post({ press: `${root}/a.md` }, { in: 'rows' })
    await ui.post({ press: `${root}/a.md` }, { in: 'rows' })
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
    await ui.press({ key: 'nav-o' })
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
  await ui.press({ key: 'nav-o' })
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
  await ui.press({ key: 'nav-o' })
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
  const sent = await $.prompt.submit({ text: 'what is this?', wait: false } as any)
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

test('open with on linux: the command runs detached, like the default opener', { timeoutMs: 20_000, options: { open: 'evince {path}' } }, async ($, on) => {
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
  await $.tool.call({ tool: 'Edit', file_path: `${root}/a.ts`, old_string: 'a', new_string: 'b' } as any)
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
  on('ui.scroll', (_$: any, e: any) => (appScrolls.push(e.by), {}))
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const props = { ...paneProps(60), scroll: { offset: 0, bodyRows: 20 } }
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props })
  await ui.post({ press: `${root}/a.ts` }, { in: 'rows' })
  await ui.post({ press: `${root}/a.ts` }, { in: 'rows' })
  await clock.settle()
  const shown = JSON.stringify(await ui.drawn())
  expect(shown).toContain('line 0')
  expect(shown).toContain('line 199')
  const wheel = { component: 'Pane', requestId: 'filetree', by: 5, offset: 5, bodyRows: 20, contentRows: 202, origin: { kind: 'person' } }
  expect(await $.ui.scroll(wheel as any)).toEqual({})
  expect(appScrolls).toEqual([5])
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

test('replacing many folders in one batch keeps unchanged nodes and drops what vanished', async () => {
  const dir = (id: string, loaded: boolean) => ({ id, parent: id.slice(0, id.lastIndexOf('/')) || '/', name: id.slice(id.lastIndexOf('/') + 1), kind: 'dir' as const, hidden: false, mtime: 0, loaded })
  const file = (id: string) => ({ ...dir(id, false), kind: 'file' as const })
  const nodes = [dir('/r/a', true), dir('/r/b', true), file('/r/a/x'), dir('/r/b/y', true), file('/r/b/y/z')]
  const out = replaceChildren(nodes, new Map([
    ['/r/a', toNodes('/r/a', [{ name: 'w', kind: 'file', mtimeMs: 0, isLink: false }])],
    ['/r/b', []],
    ['/r/b/y', toNodes('/r/b/y', [{ name: 'z', kind: 'file', mtimeMs: 0, isLink: false }])],
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
  on('classic.CwdChanged', () => ({}))
  await $.session.start({ cwd: a, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await ui.post({ press: `${a}/a.txt` }, { in: 'rows' })
  await clock.settle()
  w.cwd = b
  const sent = await $.prompt.submit({ text: 'what is this?', wait: false } as any)
  expect(JSON.stringify(sent)).not.toContain(`${a}/a.txt`)
  await clock.settle()
  expect(await texts(ui)).toContain('b.txt')
  w.cwd = c
  await $.classic.CwdChanged({ old_cwd: b, new_cwd: c } as any)
  await clock.settle()
  expect(await texts(ui)).toContain('c.txt')
  await ui.unmount()
})

test('open at start off: no pane at start, on a cwd change or a prompt, until /filetree opens it', { timeoutMs: 20_000, options: { start: 'off' } }, async ($, on) => {
  const ran: Ran = []
  const a = '/home/k/repo-a'
  const b = '/home/k/repo-b'
  const c = '/home/k/repo-c'
  const w: World = { os: 'linux', env: { HOME: '/home/k' }, cwd: a, top: '', dirs: { [a]: [['a.txt', 'file']], [b]: [['b.txt', 'file']], [c]: [['c.txt', 'file']] }, status: '', numstat: '' }
  const clock = world(on, w, ran)
  on('classic.CwdChanged', () => ({}))
  const before = opens.length
  await $.session.start({ cwd: a, surface: 'terminal', isInteractive: true })
  await clock.settle()
  w.cwd = b
  await $.prompt.submit({ text: 'look at @b.txt', wait: false } as any)
  await clock.settle()
  w.cwd = c
  await $.classic.CwdChanged({ old_cwd: b, new_cwd: c } as any)
  await clock.settle()
  await $.session.start({ cwd: c, surface: 'terminal', isInteractive: true })
  await clock.settle()
  expect(opens.length).toBe(before)
  await $.command.run(fullscreen(''))
  await clock.settle()
  expect(opens.slice(before)).toContainEqual(expect.objectContaining({ id: 'filetree', focus: true }))
  const shown = opens.length
  w.cwd = a
  await $.classic.CwdChanged({ old_cwd: c, new_cwd: a } as any)
  await clock.settle()
  expect(opens.length).toBeGreaterThan(shown)
})

test('a background git push stays running until its task notification arrives', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, {
    os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [root]: [['a.txt', 'file']] }, status: '## main\0', numstat: '',
    tool: e => ({ result: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: e.command === 'git push' ? 'b1' : 'b2' } }),
  }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await $.tool.call({ tool: 'Bash', command: 'git push', run_in_background: true } as any)
  await clock.settle()
  expect(await texts(ui)).toContain('pushing…')
  expect(await texts(ui)).not.toContain('pushed')
  await $.prompt.submit({ text: '<task-notification>\n<task-id>b1</task-id>\n<status>completed</status>\n<summary>Background command "git push" completed (exit code 0)</summary>\n</task-notification>', wait: false } as any)
  await clock.settle()
  expect(await texts(ui)).toContain('pushed')
  await $.tool.call({ tool: 'Bash', command: 'git pull', run_in_background: true } as any)
  await clock.settle()
  await $.prompt.submit({ text: '<task-notification>\n<task-id>b2</task-id>\n<status>failed</status>\n<summary>Background command "git pull" failed with exit code 1</summary>\n</task-notification>', wait: false } as any)
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
  await $.tool.call({ tool: 'Bash', command: 'rm a.txt && false' } as any)
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
  await $.tool.call({ tool: 'Bash', command: 'git commit -m test || true' } as any)
  await clock.settle()
  let shown = await texts(ui)
  expect(shown).toContain('commit failed')
  expect(shown).not.toContain('committed')
  expect(ran.some(a => a.includes('diff-tree'))).toBe(false)
  w.heads = ['abc1234def0', 'fed4321cba9']
  await $.tool.call({ tool: 'Bash', command: 'git commit -m real' } as any)
  await clock.settle()
  shown = await texts(ui)
  expect(shown).toContain('committed')
  expect(shown).toContain('fed4321')
  await $.tool.call({ tool: 'Bash', command: 'git push; echo done' } as any)
  await clock.settle()
  expect(await texts(ui)).toContain('ran git push')
  await $.tool.call({ tool: 'Bash', command: 'git fetch && git status' } as any)
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
  await $.tool.call({ tool: 'Bash', command: 'cat README.md' } as any)
  await $.tool.call({ tool: 'Bash', command: 'git status' } as any)
  await clock.settle()
  expect(statuses()).toBe(before)
  expect(ran.some(a => a[0] === 'find')).toBe(false)
  w.dirs[root] = [['README.md', 'file']]
  before = statuses()
  await $.tool.call({ tool: 'Bash', command: 'git clean -fd' } as any)
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
  await $.tool.call({ tool: 'Bash', command: 'touch "a\nb.ts"' } as any)
  await clock.settle()
  expect(ran.find(a => a[0] === 'find')).toContain('-print0')
  expect(await texts(ui)).toContain(shimmer('a\nb.ts', 'orange'))
  await ui.unmount()
})

test('the pane takes its background from the Omarchy theme and follows a theme switch', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const w: World = { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.ts', 'file']] }, status: '', numstat: '', theme: { toml: 'background = "#1e1e2e"\ndark_background = "#161622"\n', mtimeMs: 1 } }
  const clock = world(on, w, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  expect(await texts(ui)).toContain('"backgroundColor":"#161622"')
  w.theme = { toml: 'background = "#fafafa"\n', mtimeMs: 2 }
  await clock.advance(2_000)
  await clock.settle()
  const shown = await texts(ui)
  expect(shown).toContain('"backgroundColor":"#fafafa"')
  expect(shown).not.toContain('#161622')
  await ui.unmount()
})

test('the palette setting wins over the Omarchy theme key by key and names an entry it cannot read', { timeoutMs: 20_000, options: { palette: 'bg=#1d2021 accent=#83a598 nope=#fff muted=gray selection=#fff' } }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const w: World = { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.ts', 'file'], ['sub', 'dir']] }, status: '', numstat: '', theme: { toml: 'background = "#1e1e2e"\ndark_background = "#161622"\nforeground = "#cdd6f4"\n', mtimeMs: 1 } }
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

test('without an Omarchy theme the pane keeps the terminal background and nothing polls', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.ts', 'file']] }, status: '', numstat: '' }, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const stats = ran.filter(a => a[0] === 'theme-stat').length
  await clock.advance(10_000)
  await clock.settle()
  expect(ran.filter(a => a[0] === 'theme-stat').length).toBe(stats)
  expect(await texts(ui)).not.toContain('"backgroundColor":"#')
  await ui.unmount()
})

test('a light theme setting draws every color at AAA contrast in the terminal, and the desktop app and a dark theme keep the dark palette', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/Users/k/proj'
  const clock = world(on, {
    os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: root,
    dirs: { [root]: [['a.ts', 'file'], ['b.ts', 'file']] },
    status: '## main\0 M a.ts\0?? b.ts\0', numstat: '3\t1\ta.ts\0',
  }, ran)
  let theme = 'light-daltonized'
  on('config.list', () => ({ value: [{ key: 'theme', label: 'Theme', kind: 'choice', value: theme, provider: { plugin: 'engine', tier: 'core' }, isLocked: false }] as any }))
  on('config.set', (_$: any, e: any) => {
    theme = e.value
    return { value: e.value }
  })
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  let ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const light = await texts(ui)
  expect(light).toContain('"activeBg":"#e2e6ec","hoverBg":"#f0f2f5"')
  for (const c of ['#1e3a8a', '#78350f', '#14532d', '#374151']) expect(light).toContain(`"color":"${c}"`)
  expect(light).toContain('#431407')
  expect(light).not.toContain('"color":"#5b9bd5"')
  await ui.unmount()
  const desktop = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const onDesktop = await texts(desktop)
  expect(onDesktop).toContain('"activeBg":"#6b7280","hoverBg":"#3b3d41"')
  expect(onDesktop).not.toContain('"color":"#1e3a8a"')
  await desktop.unmount()
  ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  expect(await texts(ui)).toContain('"color":"#1e3a8a"')
  await $.config.set({ key: 'theme', value: 'dark' } as any)
  await clock.settle()
  const dark = await texts(ui)
  expect(dark).toContain('"activeBg":"#6b7280","hoverBg":"#3b3d41"')
  for (const c of ['#5b9bd5', '#e5c07b', '#98c379', '#808a96']) expect(dark).toContain(`"color":"${c}"`)
  expect(dark).not.toContain('"color":"#1e3a8a"')
  await ui.unmount()
})

test('formatSize: bytes, binary units, one decimal under 100, ? for unknown', async () => {
  expect(formatSize(0)).toBe('0 B')
  expect(formatSize(1023)).toBe('1023 B')
  expect(formatSize(1536)).toBe('1.5 K')
  expect(formatSize(412 * 1024)).toBe('412 K')
  expect(formatSize(6.2 * 1024 * 1024)).toBe('6.2 M')
  expect(formatSize(-1)).toBe('?')
})

test('age: now, minutes, hours and days, then the day past a week and the year past a year', async () => {
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
  expect(sized).toContain(' 1 B')
  expect(sized).toContain(' 2.0 M')
  expect(ran).toContainEqual(['du', '-skxH', `${root}/src`])
  const before = ran.filter(a => a[0] === 'du').length
  await $.tool.call({ tool: 'Edit', file_path: `${root}/src/a.ts`, old_string: 'a', new_string: 'b' } as any)
  await clock.settle()
  await ui.press({ key: 'refresh' })
  await clock.settle()
  expect(ran.filter(a => a[0] === 'du').length).toBeGreaterThan(before)
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
  expect(await texts(ui)).toContain(' 3 B')
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
  await $.tool.call({ tool: 'Edit', file_path: `${root}/src/a.ts`, old_string: 'a', new_string: 'b' } as any)
  await clock.settle()
  await clock.advance(1_500)
  await clock.settle()
  expect(await texts(ui)).toContain(' 2.0 M')
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
  expect(shown).toContain(' 2 B')
  expect(shown).not.toContain(' 6 B')
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
  expect(shown).toContain(' 1 B')
  expect(shown).not.toContain(' 12m')
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
    const names = Array.from({ length: 60 }, (_, i) => [`f${String(i).padStart(2, '0')}.txt`, 'file'] as [string, 'file'])
    const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: names }, status: '', numstat: '' }, [])
    await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: { ...paneProps(60), scroll: { offset: 0, bodyRows: 20 } } })
    await clock.settle()
    const drawn = (await ui.drawn()) as any
    expect(JSON.stringify(drawn).includes('git init')).toBe(hints === 'on')
    expect(drawn.children.find((c: any) => c.type === 'Client').props.props.rows.length).toBe(hints === 'on' ? 14 : 15)
    await ui.unmount()
  })
}

test('spacing off and shortcuts off drop the blank lines and the shortcut row, and the tree takes all three rows', { timeoutMs: 20_000, options: { hints: 'off', spacing: 'off', shortcuts: 'off' } }, async ($, on) => {
  const root = '/home/k/big'
  const names = Array.from({ length: 60 }, (_, i) => [`f${String(i).padStart(2, '0')}.txt`, 'file'] as [string, 'file'])
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: names }, status: '', numstat: '' }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: { ...paneProps(60), scroll: { offset: 0, bodyRows: 20 } } })
  await clock.settle()
  const drawn = (await ui.drawn()) as any
  expect(drawn.children.find((c: any) => c.type === 'Client').props.props.rows.length).toBe(18)
  expect(await ui.find({ key: 'nav-j' })).toBeUndefined()
  expect(await ui.find({ key: 'gap-above' })).toBeUndefined()
  await ui.post({ key: 'j' }, { in: 'rows' })
  await clock.settle()
  const after = (await ui.drawn()) as any
  expect(after.children.find((c: any) => c.type === 'Client').props.props.active).toBe(`${root}/f01.txt`)
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
  const w: World = { os: 'win32', env: { OS: 'Windows_NT', USERPROFILE: 'C:\Users\k' }, cwd: 'C:\Users\k\proj', top: root, dirs: { [root]: [['a.txt', 'file']] }, status: '## main\0', numstat: '', heads: ['abc1234def0', 'fed4321cba9'] }
  const clock = world(on, w, ran)
  await $.session.start({ cwd: 'C:\Users\k\proj', surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await $.tool.call({ tool: 'PowerShell', command: 'git commit -m real' } as any)
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
  w.tool = e => (e.tool === 'Grep' ? { result: { numFiles: 1, filenames: ['sub/b.ts'] } } : e.tool === 'Glob' ? { result: { numFiles: 1, filenames: [`${root}/a.ts`] } } : undefined)
  const clock = world(on, w, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await $.tool.call({ tool: 'Grep', pattern: 'x' } as any)
  await clock.settle()
  expect(await texts(ui)).toContain(shimmer('b.ts', 'purple'))
  await $.tool.call({ tool: 'Glob', pattern: '*.ts' } as any)
  await clock.settle()
  expect(await texts(ui)).toContain(shimmer('a.ts', 'purple'))
  await ui.unmount()
})
