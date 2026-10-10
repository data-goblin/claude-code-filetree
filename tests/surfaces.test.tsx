import { expect, mock, test } from 'claude-code/testing'

import { ancestorsOf, formatSize, replaceChildren, toNodes } from '../hooks/tree'

type World = {
  os: 'darwin' | 'linux' | 'win32'
  env: Record<string, string>
  cwd: string
  top: string
  dirs: Record<string, [string, 'file' | 'dir'][]>
  status: string
  numstat: string
  exits?: Record<string, [number, string]>
  delays?: Record<string, number[]>
  denied?: string[]
  heads?: string[]
  tool?: (e: any) => unknown
  find?: string
  theme?: { toml: string; mtimeMs: number }
  du?: Record<string, string>
  duDelays?: number[]
  links?: string[]
}
type Ran = string[][]
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
  on('fs.read', (_$: any, e: any) => {
    if (w.theme && isTheme(e.path)) return { value: w.theme.toml }
    throw new Error('no theme file')
  })
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/^.*?(?=[A-Za-z]:\/)/, '')
  const dirOf = (p: string) => w.dirs[p] ?? w.dirs[p.replace(/^[A-Za-z]:/, '')]
  on('fs.list', async (_$: any, e: any) => {
    const path = norm(e.path)
    const bare = path.replace(/^[A-Za-z]:/, '')
    if (w.denied?.includes(bare)) return { deny: `EACCES: permission denied, scandir '${path}'` }
    const kids = dirOf(path)
    if (!kids) throw new Error(`ENOENT ${e.path}`)
    const value = kids.map(([name, kind]) => ({ name, kind, size: 1, mtimeMs: 1_700_000_000_000, isLink: w.links?.includes(`${bare}/${name}`) ?? false }))
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
    return { value: { kind: hit, size: 1, mtimeMs: name === 'a.ts' ? 1_800_000_000_500 : 1_700_000_000_000, isLink: false } }
  })
  on('process.run', async (_$: any, e: any) => {
    const argv: string[] = [...e.argv]
    ran.push(argv)
    if (e.init?.env) envs.push(e.init.env)
    const ok = (stdout: string) => ({ value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    const exit = w.exits?.[argv[0] ?? '']
    if (exit) return { value: { exitCode: exit[0], stdout: '', stderr: exit[1], isStdoutTruncated: false, isStderrTruncated: false } }
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
      if (verb === 'rev-parse' && argv.at(-1) === 'HEAD') return ok(`${(w.heads && w.heads.length > 1 ? w.heads.shift() : w.heads?.[0]) ?? ''}\n`)
      if (verb === 'rev-parse') return w.top ? ok(`\n${w.top}\n`) : { value: { exitCode: 128, stdout: '', stderr: 'not a git repository', isStdoutTruncated: false, isStderrTruncated: false } }
      if (verb === 'status') return ok(w.status)
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
  const before = ran.filter(a => a.includes('status')).length
  await $.classic.FileChanged({ file_path: `${root}/.git/index`, event: 'change' } as any)
  await clock.advance(400)
  expect(ran.filter(a => a.includes('status')).length).toBeGreaterThan(before)
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

test('formatSize: bytes, binary units, one decimal under 100, ? for unknown', async () => {
  expect(formatSize(0)).toBe('0 B')
  expect(formatSize(1023)).toBe('1023 B')
  expect(formatSize(1536)).toBe('1.5 K')
  expect(formatSize(412 * 1024)).toBe('412 K')
  expect(formatSize(6.2 * 1024 * 1024)).toBe('6.2 M')
  expect(formatSize(-1)).toBe('?')
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
