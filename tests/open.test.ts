import { expect, test } from 'claude-code/testing'
import { herdrError, herdrOpenCommand, herdrPane, openCommand, openWithCommand, tmuxOpenCommand } from '../hooks/open'

test('tmux editor: a line goes to the opener as its own argument, quoted executable paths and arguments stay literal, and an empty command is refused', () => {
  expect(tmuxOpenCommand('nvim', '/a/b.ts', 12).argv.slice(4)).toEqual(['/a/b.ts', '/a', '12', 'nvim'])
  const { argv } = tmuxOpenCommand('"/opt/My Editor/nvim" -u NONE -c "set number"', '/work/A & B/$(touch nope).ts')
  expect(argv.slice(4)).toEqual(['/work/A & B/$(touch nope).ts', '/work/A & B', '', '/opt/My Editor/nvim', '-u', 'NONE', '-c', 'set number'])
  expect(() => tmuxOpenCommand('   ', '/a.ts')).toThrow('Editor command is empty')
  expect(() => tmuxOpenCommand('""', '/a.ts')).toThrow('Editor command is empty')
})

test('open keeps file and URL targets literal on every platform', () => {
  for (const os of ['linux', 'darwin', 'win32'] as const) {
    const target = os === 'win32' ? 'C:/Models/A & %NAME%/dax.ts' : '/work/A & B/dax.ts'
    const { argv, init } = openCommand(os, target)
    if (os === 'win32') {
      expect(init.env?.PANE_OPEN_TARGET).toBe('C:\\Models\\A & %NAME%\\dax.ts')
      expect(argv.at(-1)).toContain('UseShellExecute = $true')
      expect(argv.at(-1)).toContain("$ErrorActionPreference = 'Stop'")
      const url = 'https://example.test/path?q=a%20b&next=%NAME%'
      expect(openCommand(os, url).init.env?.PANE_OPEN_TARGET).toBe(url)
    } else {
      expect(argv.at(-1)).toBe(target)
      if (os === 'linux') expect(argv[2]).toContain('setsid -f -w')
    }
  }
})

test('open with: words keep quotes whole, placeholders fill in, and the path goes last without {path}', () => {
  expect(openWithCommand('', '/a/b.md', '/a')).toBe(null)
  expect(openWithCommand('   ', '/a/b.md', '/a')).toBe(null)
  expect(openWithCommand('zed', '/w/A & B/b.md', '/w/A & B')).toEqual(['zed', '/w/A & B/b.md'])
  expect(openWithCommand('code -g {path}:1', '/a/b.md', '/a')).toEqual(['code', '-g', '/a/b.md:1'])
  expect(openWithCommand('code -g {path}:{line}', '/a/b.md', '/a', 7)).toEqual(['code', '-g', '/a/b.md:7'])
  expect(openWithCommand(`herdr plugin pane open --cwd {dir} --env "VIEW={path}" ''`, '/a/{dir}.md', '/a')).toEqual(['herdr', 'plugin', 'pane', 'open', '--cwd', '/a', '--env', 'VIEW=/a/{dir}.md', ''])
  expect(openWithCommand('open -a "Sublime Text" --cwd {dir}', '/a/b.md', '/a')).toEqual(['open', '-a', 'Sublime Text', '--cwd', '/a', '/a/b.md'])
})

test('herdr editor: a line goes to the editor as +N before the file, quoted executable paths and arguments stay literal for the pane shell, and an empty command is refused', () => {
  expect(herdrOpenCommand('herdr', 'nvim', '/a/b.ts', 12).run('w1:p2')).toEqual(['herdr', 'pane', 'run', 'w1:p2', `exec 'nvim' '+12' "$PANE_OPEN_TARGET"`])
  const quoted = herdrOpenCommand('herdr', `"/opt/My Editor/nvim" -u NONE -c "echo 'hi'"`, '/a.ts')
  expect(quoted.run('w1:p2')[4]).toBe(`exec '/opt/My Editor/nvim' '-u' 'NONE' '-c' 'echo '\\''hi'\\''' "$PANE_OPEN_TARGET"`)
  expect(() => herdrOpenCommand('herdr', '   ', '/a.ts')).toThrow('Editor command is empty')
  expect(() => herdrOpenCommand('herdr', '""', '/a.ts')).toThrow('Editor command is empty')
})

test('herdr replies: the pane id comes from the split JSON and a failure message from the error JSON', () => {
  expect(herdrPane('{"id":"cli:pane:split","result":{"pane":{"pane_id":"w1:p37","parent_pane_id":"w1:p35"},"type":"pane_info"}}')).toBe('w1:p37')
  expect(() => herdrPane('{"id":"cli:pane:split","result":{"type":"ok"}}')).toThrow('herdr returned no pane id')
  expect(() => herdrPane('')).toThrow()
  expect(herdrError('{"error":{"code":"pane_not_found","message":"pane w1:p35 not found"},"id":"cli:pane:split"}\n')).toBe('pane w1:p35 not found')
  expect(herdrError('error: unexpected argument\nUsage: herdr pane split')).toBe('error: unexpected argument')
  expect(herdrError('')).toBe('')
})
