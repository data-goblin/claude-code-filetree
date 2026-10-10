import { expect, test } from 'claude-code/testing'
import { openCommand, openWithCommand } from '../hooks/open'

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
  expect(openWithCommand(`herdr plugin pane open --cwd {dir} --env "VIEW={path}" ''`, '/a/{dir}.md', '/a')).toEqual(['herdr', 'plugin', 'pane', 'open', '--cwd', '/a', '--env', 'VIEW=/a/{dir}.md', ''])
  expect(openWithCommand('open -a "Sublime Text" --cwd {dir}', '/a/b.md', '/a')).toEqual(['open', '-a', 'Sublime Text', '--cwd', '/a', '/a/b.md'])
})
