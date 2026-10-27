import { expect, mock, test } from 'claude-code/testing'

import { LINUX_LAUNCH, TMUX_OPEN, TMUX_WORKSPACE } from '../hooks/open'
import { CLEAN, POLICY, POSTER } from '../hooks/peek'
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
    if (argv[0] === 'find' && argv.includes('grep')) return ok(w.loc?.[`${argv[1]}${argv[2] === '-maxdepth' ? ' 1' : ''}`] ?? '')
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
      if (verb === 'diff-tree') return ok((w.diffTree ?? []).join('\0'))
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
  on('process.spawn', async function* (_$: any, e: any) {
    const argv: string[] = [...e.argv]
    ran.push(argv)
    if (argv[0] === 'du' && w.abortDu?.includes(argv.at(-1) ?? '')) {
      w.abortDu = w.abortDu.filter(d => d !== argv.at(-1))
      return { deny: 'aborted' }
    }
    const out = argv[0] === 'du' ? (w.du?.[argv.at(-1) ?? ''] ?? '') : argv[0] === 'find' && argv.includes('grep') ? (w.loc?.[argv[1] ?? ''] ?? '') : ''
    if (out) yield { stream: 'stdout', text: out }
    if (argv[0] === 'sh' && w.poster) yield { stream: 'stdout', text: w.poster(argv) }
    if (argv[0] === 'inotifywait' && w.watch) {
      await clock.sleep(w.watch.after)
      yield { stream: 'stdout', text: w.watch.change() }
    }
    return { value: { code: 0, signal: null } }
  } as any)
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
  expect(await texts(ui)).toMatch(/"selected: "\]}\]}.*"truncate-start"},"children":\["README.md"\]/)
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

test('moving the cursor writes at most one tree snapshot and an idle tree spawns nothing', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const writes: string[] = []
  on('state.set', (_$: any, e: any, next: any) => {
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
  const rows = ((await ui.drawn()) as any).children.find((c: any) => c.type === 'Client').props.props
  expect(rows.active).toBe(`${root}/b.txt`)
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
  const mtimes: Record<string, number> = {}
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [root]: [['.git', 'dir'], ['a.txt', 'file'], ['b.txt', 'file'], ['c.txt', 'file']], [`${root}/.git`]: [['index', 'file'], ['HEAD', 'file']] }, status: '## main\0', numstat: '', mtimes }, ran)
  const copied: string[] = []
  on('ui.copy', (_$: any, e: any) => {
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
  const rowsOf = async () => ((await ui.drawn()) as any).children.find((c: any) => c.type === 'Client').props.props
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
  on('session.end', (_$: any, e: any) => ({ sessionId: e.sessionId }))
  expect(ancestorsOf('/repo/a.ts', '')).toEqual([])
  expect(ancestorsOf('/repo2/a.ts', '/repo')).toEqual([])
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await $.tool.call({ tool: 'Read', file_path: `${root}/a.ts` } as any)
  await clock.settle()
  await $.session.end({ reason: 'clear', sessionId: 'test-session' } as any)
  await clock.advance(10)
  await clock.settle()
  expect(await texts(ui)).toContain(`"id":"${root}/a.ts"`)
  await $.command.run(fullscreen(`${root}/sub`))
  await clock.settle()
  await $.session.end({ reason: 'clear', sessionId: 'test-session' } as any)
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
  for (const f of files.slice(1)) {
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

test('open with preview on desktop: the file is drawn by the pane itself, with no Client between', { timeoutMs: 20_000, options: { open: 'preview' } }, async ($, on) => {
  const root = '/Users/k/proj'
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: '', status: '', numstat: '', dirs: { [root]: [['a.md', 'file'], ['a.ts', 'file']] }, files: { [`${root}/a.md`]: '# Title\n\nSome prose.', [`${root}/a.ts`]: 'const a = 1' } }, [])
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const props = { ...paneProps(60), scroll: { offset: 0, bodyRows: 20 } }
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props })
  for (const file of ['a.md', 'a.ts']) {
    await ui.post({ press: `${root}/${file}` }, { in: 'rows' })
    await ui.post({ press: `${root}/${file}` }, { in: 'rows' })
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

test('replacing many folders in one batch keeps unchanged nodes and drops what vanished', async () => {
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
  const sent = await $.prompt.submit({ text: 'what is this?', wait: false } as any)
  expect(JSON.stringify(sent)).not.toContain(`${a}/a.txt`)
  await clock.settle()
  expect(await texts(ui)).toContain('b.txt')
  w.cwd = c
  await $.tool.call({ tool: 'Bash', command: `cd ${c}` } as any)
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
  await $.prompt.submit({ text: 'look at @b.txt', wait: false } as any)
  await clock.settle()
  w.cwd = c
  await $.tool.call({ tool: 'Bash', command: `cd ${c}` } as any)
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
  await $.tool.call({ tool: 'Bash', command: `cd ${a}` } as any)
  await clock.advance(500)
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
  expect(shown).toContain('"activeBg":"ansi256(0)","hoverBg":""')
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
  on('config.list', () => ({ value: [{ key: 'theme', label: 'Theme', kind: 'choice', value: 'light-daltonized', provider: { plugin: 'engine', tier: 'core' }, isLocked: false }] as any }))
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  const light = await texts(ui)
  expect(light).toContain('"activeBg":"ansi256(0)"')
  for (const c of ['ansi256(3)', 'ansi256(2)']) expect(light).toContain(`"color":"${c}"`)
  expect(light).toMatch(/"dimColor":true\},"children":\[" 2023-11-1\d \d\d:\d\d"\]/)
  expect(light).not.toContain('ansi256(8)')
  expect(light).toContain('#431407')
  await ui.unmount()
  const desktop = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  expect(await texts(desktop)).toContain('"activeBg":"ansi256(0)"')
  await desktop.unmount()
})

test('formatSize: at most three digits, unit glued on, ? for unknown', async () => {
  expect(formatSize(0)).toBe('0B')
  expect(formatSize(980)).toBe('980B')
  expect(formatSize(1023)).toBe('1.0K')
  expect(formatSize(1536)).toBe('1.5K')
  expect(formatSize(412 * 1024)).toBe('412K')
  expect(formatSize(6.2 * 1024 * 1024)).toBe('6.2M')
  expect(formatSize(12 * 1024 ** 3)).toBe('12G')
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
  expect(sized).toContain(' 1B')
  expect(sized).toContain(' 2.0M')
  expect(ran).toContainEqual(['du', '-skxH', `${root}/src`])
  const before = ran.filter(a => a[0] === 'du').length
  await $.tool.call({ tool: 'Edit', file_path: `${root}/src/a.ts`, old_string: 'a', new_string: 'b' } as any)
  await clock.settle()
  await ui.press({ key: 'refresh' })
  await clock.settle()
  expect(ran.filter(a => a[0] === 'du').length).toBeGreaterThan(before)
  await ui.press({ key: 'size' })
  await clock.settle()
  expect(await texts(ui)).not.toMatch(STAMP)
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
      [`${root} 1`]: `${root}/README.md:12\n`,
      [root]: `${root}/README.md:12\n${root}/src/a.ts:1500\n${root}/src/b.ts:300\n${root}/docs/guide.md:40\n`,
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
  expect(shown).toContain(' 1.8k')
  expect(shown).toContain(' 40')
  expect(shown).toContain(' 12')
  const logo = find(await ui.drawn(), 'Client', 'rows').props.rows.find((r: any) => r.id === `${root}/logo.png`).right.map((x: any) => x.t).join("")
  expect(logo).not.toMatch(/\d/)
  const finds = () => ran.filter(a => a[0] === 'find' && a.includes('grep')).length
  expect(ran.some(a => a[0] === 'find' && a.includes('grep') && a.includes('-maxdepth'))).toBe(true)
  const before = finds()
  w.loc = { ...w.loc, [`${root}/src`]: `${root}/src/a.ts:1500\n${root}/src/b.ts:900\n` }
  await $.tool.call({ tool: 'Edit', file_path: `${root}/src/b.ts`, old_string: 'a', new_string: 'b' } as any)
  await clock.settle()
  await clock.settle()
  expect(finds()).toBeGreaterThan(before)
  expect(await texts(ui)).toContain(' 2.4k')
  await ui.press({ key: 'split' })
  await clock.settle()
  const map = mapOf(await ui.drawn()).rows.map((r: any) => r.left.map((x: any) => x.t).join('')).join('\n')
  expect(map).toContain('src 1.8k')
  expect(JSON.stringify(await ui.drawn())).toContain(' lines')
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
  expect(await texts(ui)).toContain(' 3B')
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
  expect(await texts(ui)).toContain(' 2.0M')
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
  expect(shown).toContain(' 2B')
  expect(shown).not.toContain(' 6B')
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
  expect(shown).toContain(' 1B')
  expect(shown).not.toContain(' 12m')
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

test('the footer names the entry under the cursor, and ? shows the shortcuts with diff for ten seconds on the same row', { timeoutMs: 20_000 }, async ($, on) => {
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [root]: [['src', 'dir'], ['README.md', 'file'], ['notes.md', 'file']] }, status: '## main\0', numstat: '' }, [])
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await ui.post({ press: `${root}/README.md` }, { in: 'rows' })
  await clock.settle()
  expect(await texts(ui)).toMatch(/"selected: "\]}\]}.*"truncate-start"},"children":\["README.md"\]/)
  await ui.post({ key: 'k' }, { in: 'rows' })
  await clock.settle()
  expect(await texts(ui)).toMatch(/"selected: "\]}\]}.*"truncate-start"},"children":\["notes.md"\]/)
  await ui.post({ key: 'k' }, { in: 'rows' })
  await clock.settle()
  expect(await texts(ui)).toMatch(/"selected: "\]}\]}.*"truncate-start"},"children":\["src"\]/)
  expect(await ui.find({ key: 'nav-d' })).toBeUndefined()
  await ui.post({ key: '?' }, { in: 'rows' })
  await clock.settle()
  expect(await ui.find({ key: 'nav-d' })).toBeDefined()
  expect(await ui.find({ key: 'nav-help' })).toBeDefined()
  await clock.advance(10_100)
  expect(await ui.find({ key: 'nav-d' })).toBeUndefined()
  await ui.post({ key: '?' }, { in: 'rows' })
  await clock.settle()
  await ui.post({ key: '?' }, { in: 'rows' })
  await clock.settle()
  expect(await ui.find({ key: 'nav-d' })).toBeUndefined()
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
  const footer = (d: any) => JSON.stringify(d)
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
  expect(drawn).toMatch(/"label":"\?: shortcuts".*"selected: ".*"proj"/)
  expect(drawn).not.toContain('"~/proj"')
  expect(mapOf(await ui.drawn()).rows.map((r: any) => r.left.map((x: any) => x.t).join('')).join('\n')).toContain('a.ts')
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
  const text = mapOf(await ui.drawn())?.rows.map((r: any) => r.left.map((x: any) => x.t).join('')).join('\n') ?? ''
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

test('the ignore setting leaves a name out of the listing, the change scan and the shimmer at any depth', { timeoutMs: 20_000, options: { ignore: '.spool, .cache' } }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const w: World = { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.ts', 'file'], ['.spool', 'dir'], ['sub', 'dir']], [`${root}/sub`]: [['.cache', 'dir'], ['b.ts', 'file']] }, status: '', numstat: '', find: `${root}/a.ts\0${root}/.spool/log.json\0${root}/sub/.cache/x\0` }
  w.tool = e => (e.tool === 'Grep' ? { result: { numFiles: 2, filenames: ['.spool/log.json', 'sub/b.ts'] } } : undefined)
  const clock = world(on, w, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  expect(await texts(ui)).not.toContain('.spool')
  await $.tool.call({ tool: 'Bash', command: 'touch a.ts' } as any)
  await clock.settle()
  expect(ran.find(a => a[0] === 'find')).toContain('.spool')
  await $.tool.call({ tool: 'Grep', pattern: 'x' } as any)
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
  const w: World = { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: root, dirs: { [`${root}/.cache`]: cached(61).map(p => [p.slice(7), 'file'] as [string, 'file']), [root]: [['.cache', 'dir'], ['src', 'dir']], [`${root}/src`]: [['k.ts', 'file']] }, status: '## main\0', numstat: '' }
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
  w.tool = e => (e.tool === 'Grep' ? { result: { numFiles: 61, filenames: [...cached(60), 'gen/g.ts'] } } : undefined)
  const clock = world(on, w, ran)
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await clock.settle()
  await $.tool.call({ tool: 'Bash', command: 'git commit -m real' } as any)
  await clock.settle()
  expect(await texts(ui)).toContain(shimmer('k.ts', 'green'))
  await $.tool.call({ tool: 'Grep', pattern: 'x' } as any)
  await clock.settle()
  expect(await texts(ui)).toContain(shimmer('g.ts', 'purple'))
  await ui.unmount()
})

test('a second /filetree closes the tree', async ($, on) => {
  const closed: string[] = []
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('ui.panes', () => ({ value: [{ id: 'filetree', title: 'Files', isShown: true, isFocused: false, isPlaced: true }] }) as never)
  on('ui.close', ($, e) => {
    closed.push((e as { id: string }).id)
    return { value: undefined } as never
  })
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true } as never)
  const out = await $.command.run({ command: 'filetree', args: '' } as never)
  expect(closed).toEqual(['filetree'])
  expect(JSON.stringify(out)).toContain('closed')
})

test('/filetree open keeps an open tree open', async ($, on) => {
  const closed: string[] = []
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('ui.panes', () => ({ value: [{ id: 'filetree', title: 'Files', isShown: false, isFocused: false, isPlaced: true }] }) as never)
  on('ui.close', ($, e) => {
    closed.push((e as { id: string }).id)
    return { value: undefined } as never
  })
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true } as never)
  await $.command.run({ command: 'filetree', args: 'open', presentation: { isFullscreen: true, columns: 200 } } as never).catch(() => undefined)
  expect(closed).toEqual([])
})

test('/filetree on a tree hidden behind another tab brings it forward instead of closing it', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const root = '/home/k/proj'
  const clock = world(on, { os: 'linux', env: { HOME: '/home/k' }, cwd: root, top: '', dirs: { [root]: [['a.txt', 'file']] }, status: '', numstat: '' }, ran)
  const closed: unknown[] = []
  on('ui.panes', () => ({ value: [{ id: 'filetree', title: 'Files', isShown: false, isFocused: false, isPlaced: true }] }))
  on('ui.close', (_$: any, e: any) => {
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
  expect(opens.slice(before).some((o: any) => o.id === 'filetree' && o.focus === true)).toBe(true)
})

const PNG_HEAD = '137 80 78 71 13 10 26 10 0 0 0 13 73 72 68 82 0 0 3 32 0 0 1 144'

function peekOf(tree: any): any {
  if (!tree || typeof tree !== 'object') return undefined
  if (tree.type === 'Client' && tree.props?.props?.preview?.rows) return tree.props.props
  for (const c of [tree.children ?? []].flat()) {
    const hit = peekOf(c)
    if (hit) return hit
  }
  return undefined
}

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
  expect(shown).toContain(`"file":"${cache}/p1.png"`)
  expect(shown).toContain('p 1/3')
  const posters = () => ran.filter(a => a[0] === 'sh' && a.includes(`${root}/doc.pdf`))
  expect(posters()[0]?.slice(8, 9)).toEqual(['pdf'])
  expect(posters().map(a => a[12])).toEqual(['1', '2'])
  await ui.post({ key: ']' }, { in: 'rows' })
  await clock.settle()
  await clock.settle()
  shown = JSON.stringify(await ui.drawn())
  expect(shown).toContain(`"file":"${cache}/p2.png"`)
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
  expect(peek.bar.pos).toBe(0)
  expect(JSON.stringify(await ui.drawn())).toContain('1–16/201')
  await ui.post({ key: 'pagedown' }, { in: 'rows' })
  await clock.settle()
  expect(peekOf(await ui.drawn()).preview.startLine).toBe(16)
  await ui.post({ key: 'f' }, { in: 'rows' })
  await clock.settle()
  expect(peekOf(await ui.drawn()).preview.startLine).toBe(31)
  await $.ui.scroll({ component: 'Pane', requestId: 'filetree', by: 1 } as any)
  await clock.settle()
  expect(peekOf(await ui.drawn()).preview.startLine).toBe(31)
  await ui.post({ over: true }, { in: 'peek' })
  await $.ui.scroll({ component: 'Pane', requestId: 'filetree', by: 1 } as any)
  await clock.settle()
  expect(peekOf(await ui.drawn()).preview.startLine).toBe(34)
  await ui.post({ key: 'end' }, { in: 'peek' })
  await clock.settle()
  peek = peekOf(await ui.drawn())
  expect(peek.preview.startLine).toBe(186)
  expect(peek.bar.pos + peek.bar.size).toBe(16)
  await ui.post({ over: false }, { in: 'peek' })
  await ui.post({ key: 'j' }, { in: 'rows' })
  await clock.settle()
  await clock.settle()
  shown = JSON.stringify(await ui.drawn())
  expect(shown).toContain(`"file":"${root}/b.png","format":"png"`)
  expect(shown).toContain('800×400')
  expect(shown).toContain('"columns":59,"rows":15')
  expect(ran.some(a => a[0] === 'sh' && a.includes(`${root}/b.png`))).toBe(false)
  await ui.post({ key: 'j' }, { in: 'rows' })
  await clock.settle()
  await clock.settle()
  shown = JSON.stringify(await ui.drawn())
  expect(shown).toContain('"file":"/run/user/1000/filetree-preview-1000/')
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
  const drawn = await ui.drawn() as any
  const split = drawn.children[1]
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
    dirs: { [root]: [['a.ts', 'file'], ['b.jpg', 'file'], ['fifo', 'other' as any]] },
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
  await $.ui.scroll({ component: 'Pane', requestId: 'filetree', by: 1 } as any)
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
  const names = Array.from({ length: 30 }, (_, i) => [`f${String(i).padStart(2, '0')}.txt`, 'file'] as [string, 'file'])
  const clock = world(on, { os: 'darwin', env: { HOME: '/Users/k' }, cwd: root, top: '', status: '', numstat: '', dirs: { [root]: names } }, [])
  await $.session.start({ cwd: root, surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'desktop', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await ui.post({ key: 'k' }, { in: 'rows' })
  await ui.post({ key: 'p' }, { in: 'rows' })
  await ui.post({ key: 'pagedown' }, { in: 'rows' })
  await clock.settle()
  const shown = JSON.stringify(await ui.drawn())
  expect(shown).not.toContain('──')
  expect(shown).toContain(`"active":"${root}/f10.txt"`)
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
  on('session.end', (_$: any, e: any) => ({ sessionId: e.sessionId }))
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'filetree', surface: 'terminal', component: 'Pane', requestId: 'filetree', props: paneProps(60) })
  await ui.post({ key: 'end' }, { in: 'rows' })
  await ui.post({ key: 'p' }, { in: 'rows' })
  await clock.settle()
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).toContain(`"file":"${cache}/x.png"`)
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
  await $.session.end({ reason: 'other', sessionId: 'test-session' } as any)
  await clock.settle()
  expect(ran).toContainEqual(['sh', '-c', CLEAN, 'sh', cache])
})

function mapOf(tree: any): any {
  if (!tree || typeof tree !== 'object') return undefined
  if (tree.type === 'Client' && tree.props?.key === 'treemap') return tree.props.props
  for (const c of [tree.children ?? []].flat()) {
    const hit = mapOf(c)
    if (hit) return hit
  }
}

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
  let map = mapOf(await ui.drawn())
  const text = (m: any) => m.rows.map((r: any) => r.left.map((s: any) => s.t).join('')).join('\n')
  expect(text(map)).toContain('src')
  expect(text(map)).toContain('6.0M')
  expect(text(map)).toContain('big.bin')
  expect(text(map)).not.toMatch(/[╭│─]/)
  expect(text(map)).toContain('x.ts 5.0M 56%')
  expect(JSON.stringify(await ui.drawn())).toContain('9.0M')
  const fillOf = (m: any, tab: string) => m.rows.flatMap((r: any) => r.left).find((s: any) => s.tab === tab && s.t.trim())?.bg
  const before = fillOf(map, `${root}/src`)
  await ui.post({ tab: `${root}/src` }, { in: 'treemap' })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).toContain(`"active":"${root}/src"`)
  expect(ran).not.toContainEqual(['du', '-akxH', '-d', '2', '--', `${root}/src`])
  expect(text(mapOf(await ui.drawn()))).toContain('x.ts 5.0M 56%')
  expect(fillOf(mapOf(await ui.drawn()), `${root}/src`)).not.toBe(before)
  await clock.advance(1_000)
  await ui.post({ tab: `${root}/src` }, { in: 'treemap' })
  await clock.settle()
  expect(ran).not.toContainEqual(['du', '-akxH', '-d', '2', '--', `${root}/src`])
  await ui.post({ key: 'return' }, { in: 'treemap' })
  await clock.settle()
  expect(ran).toContainEqual(['du', '-akxH', '-d', '2', '--', `${root}/src`])
  expect(text(mapOf(await ui.drawn()))).toContain('x.ts 5.0M 83%')
  await $.tool.call({ tool: 'Edit', file_path: `${root}/src/x.ts`, old_string: 'a', new_string: 'b' } as any)
  await clock.settle()
  map = mapOf(await ui.drawn())
  expect(map.rows.some((r: any) => r.left.some((s: any) => s.tab === `${root}/src/x.ts` && s.bg?.startsWith('#') && s.b))).toBe(true)
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

function find(tree: any, type: string, key: string): any {
  if (!tree || typeof tree !== 'object') return undefined
  if (tree.type === type && tree.props?.key === key) return tree.props
  for (const c of [tree.children ?? []].flat()) {
    const hit = find(c, type, key)
    if (hit) return hit
  }
}

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
  const image = find(await ui.drawn(), 'Image', 'treemap-image')
  expect(image).toBeDefined()
  const bytes = Uint8Array.fromBase64(image.source.png)
  expect([...bytes.slice(1, 4)].map(c => String.fromCharCode(c)).join('')).toBe('PNG')
  const zone = find(await ui.drawn(), 'Client', 'treemap').props
  expect(zone.boxes.map((b: any) => b[0])).toContain(`${root}/src`)
  await ui.post({ tab: `${root}/src` }, { in: 'treemap' })
  await clock.settle()
  expect(find(await ui.drawn(), 'Client', 'treemap').props.boxes.map((b: any) => b[0])).not.toContain(`${root}/src/y.ts`)
  await ui.post({ tab: `${root}/src` }, { in: 'treemap' })
  await clock.settle()
  const after = await ui.drawn()
  expect(find(after, 'Client', 'treemap').props.boxes.map((b: any) => b[0])).toContain(`${root}/src/y.ts`)
  expect(find(after, 'Image', 'treemap-image').source.png).not.toBe(image.source.png)
  await ui.post({ tab: `${root}/src/y.ts` }, { in: 'treemap' })
  await clock.settle()
  const file = await ui.drawn()
  expect(find(file, 'Image', 'treemap-image')).toBeDefined()
  expect(find(file, 'Client', 'treemap').props.boxes.map((b: any) => b[0])).toContain(`${root}/src/y.ts`)
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
  const w = {
    os: 'linux' as const, env: { HOME: '/opt/k' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['a.ts', 'file']] } as Record<string, [string, string][]>,
    files: { [`${root}/a.ts`]: 'const before = 1\n' } as Record<string, string>,
    watch: { after: 5_000, change: () => {
      w.files[`${root}/a.ts`] = 'const after = 2\n'
      return `${root}/a.ts\n`
    } },
  }
  const clock = world(on, w as any, ran)
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
  const w = {
    os: 'linux' as const, env: { HOME: '/home/k' }, cwd: root, top: '', status: '', numstat: '',
    dirs: { [root]: [['a.ts', 'file']] } as Record<string, [string, string][]>,
    du: { [root]: `4\t${root}/a.ts\n4\t${root}\n` } as Record<string, string>,
    watch: { after: 5_000, change: () => {
      w.dirs[root] = [['shell.bin', 'file']]
      w.du[root] = `8192\t${root}/shell.bin\n8192\t${root}\n`
      return `${root}/shell.bin\n${root}/a.ts\n`
    } },
  }
  const clock = world(on, w as any, ran)
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
