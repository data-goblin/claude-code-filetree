import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { herdrOpenCommand, LINUX_LAUNCH, LINUX_OPEN, tmuxOpenCommand } from '../hooks/open'

const dir = mkdtempSync(join(tmpdir(), 'pane-open-'))
const bin = join(dir, 'bin')
const data = join(dir, 'data with spaces')
const run = (script: string, args: string[], env = process.env) => spawnSync('/bin/sh', ['-c', script, 'sh', ...args], { encoding: 'utf8', env, timeout: 5000 })
const dry = LINUX_OPEN.replace(/exec (gio launch [^\n]+|gio open \"\$f\"|xdg-open \"\$f\")/g, '{ echo $1; exit 0; }')
const sockets: ReturnType<typeof createServer>[] = []
try {
  mkdirSync(bin)
  mkdirSync(join(data, 'applications'), { recursive: true })
  writeFileSync(join(data, 'applications/editor.desktop'), '')
  writeFileSync(join(bin, 'gio'), '#!/bin/sh\n[ "$1" = info ] || exit 99\nprintf "standard::content-type: %s\n" "$TEST_MIME"\n', { mode: 0o700 })
  writeFileSync(join(bin, 'xdg-mime'), '#!/bin/sh\necho editor.desktop\n', { mode: 0o700 })
  for (const tool of ['file', 'sed']) symlinkSync(`/usr/bin/${tool}`, join(bin, tool))
  const env = { ...process.env, PATH: bin, XDG_DATA_HOME: data, XDG_DATA_DIRS: join(dir, 'absent'), TEST_MIME: 'video/mpeg' }
  for (const ext of ['ts', 'txt', 'json', 'mp3']) {
    const target = join(dir, `A & B.${ext}`)
    writeFileSync(target, 'plain text\n')
    for (const mime of ['video/mpeg', 'audio/mpeg']) {
      const result = run(dry, [target], { ...env, TEST_MIME: mime })
      assert.equal(result.status, 0, result.stderr)
      assert.equal(result.stdout.trim(), `gio launch ${data}/applications/editor.desktop ${target}`)
    }
    const normal = run(dry, [target], { ...env, TEST_MIME: 'text/plain' })
    assert.equal(normal.status, 0, normal.stderr)
    assert.equal(normal.stdout.trim(), `gio open ${target}`)
  }
  const binary = join(dir, 'movie.ts')
  writeFileSync(binary, new Uint8Array([0, 1, 2, 0, 255]))
  for (const target of [binary, dir, 'https://example.test/?a=1&b=two%20words']) {
    const result = run(dry, [target], env)
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout.trim(), `gio open ${target}`)
  }
  rmSync(join(data, 'applications/editor.desktop'))
  assert.equal(run(dry, [join(dir, 'A & B.ts')], env).status, 1)
  const fallbackScript = LINUX_OPEN.replace('exec xdg-open', 'echo xdg-open')
  assert.equal(run(fallbackScript, [dir], env).stdout.trim(), `xdg-open ${dir}`)
  rmSync(join(bin, 'gio'))
  const fallback = run(dry, [dir], env)
  assert.equal(fallback.status, 0, fallback.stderr)
  assert.equal(fallback.stdout.trim(), `xdg-open ${dir}`)
  for (const code of [0, 7, 127]) assert.equal(run(LINUX_LAUNCH, ['/bin/sh', '-c', `exit ${code}`]).status, code)
  assert.equal(run(LINUX_LAUNCH, ['/bin/sh', '-c', 'for fd in 0 1 2; do [ "$(readlink /proc/$$/fd/$fd)" = /dev/null ] || exit 9; done']).status, 0)
  for (const target of process.argv.slice(2)) {
    const result = run(dry, [target])
    assert.equal(result.status, 0, result.stderr)
    console.log(`${target}: ${result.stdout.trim()}`)
  }
  writeFileSync(join(bin, 'tmux'), `#!/bin/sh
if [ "$1" = display-message ]; then
  if [ "$3" = -t ]; then printf '/test/tmux $0 1\\n'; else printf '/test/tmux $0\\n'; fi
else
  printf '%s\\0' "$@"
fi
`, { mode: 0o700 })
  const editorDir = join(dir, 'editor with spaces')
  const runtime = join(dir, 'runtime')
  const temp = join(dir, 'temp')
  for (const folder of [editorDir, runtime, temp]) mkdirSync(folder)
  const tmuxEnv = { ...process.env, PATH: `${bin}:/usr/bin:/bin`, XDG_RUNTIME_DIR: runtime, TMPDIR: temp }
  const target = join(dir, "A & B's $(touch nope).txt")
  const editor = join(editorDir, 'vim')
  const launch = tmuxOpenCommand(`"${editor}" -c "set number"`, target)
  const opened = spawnSync(launch.argv[0], launch.argv.slice(1), { encoding: 'utf8', env: tmuxEnv, timeout: 5000 })
  assert.equal(opened.status, 0, opened.stderr)
  assert.deepEqual(opened.stdout.split('\0').slice(0, -1), ['new-window', '-c', dir, '--', editor, '-c', 'set number', target])
  writeFileSync(join(editorDir, 'nvim'), `#!/bin/sh
case "$2" in */nvim.1.0) exec sleep 30 ;; esac
if [ "$3" = --remote-expr ]; then printf '/test/tmux,1,0 %%1\\n'; fi
`, { mode: 0o700 })
  for (const id of [1, 2]) {
    const socket = createServer()
    sockets.push(socket)
    await new Promise<void>((resolve, reject) => {
      socket.once('error', reject)
      socket.listen(join(runtime, `nvim.${id}.0`), resolve)
    })
    const command = tmuxOpenCommand(`"${join(editorDir, 'nvim')}" -u NONE`, target)
    const started = Date.now()
    const result = spawnSync(command.argv[0], command.argv.slice(1), { encoding: 'utf8', env: tmuxEnv, timeout: 5000 })
    assert.equal(result.status, 0, result.stderr)
    assert.ok(Date.now() - started < 3000, 'one hung probe must not stall opening')
    const args = result.stdout.split('\0').slice(0, -1)
    assert.deepEqual(args, id === 1
      ? ['new-window', '-c', dir, '--', join(editorDir, 'nvim'), '-u', 'NONE', target]
      : ['select-window', '-t', '%1', ';', 'select-pane', '-t', '%1'])
  }
  console.log('Tmux checks passed: literal arguments, hung probe fallback, next responsive socket')
  writeFileSync(join(editorDir, 'editor'), '#!/bin/sh\nprintf "%s\\0" "$@"\n', { mode: 0o700 })
  const paneTarget = join(dir, "A & B's $(touch nope) `touch nope2`; x.txt")
  const pane = herdrOpenCommand('herdr', `"${join(editorDir, 'editor')}" -u NONE -c "echo 'hi'"`, paneTarget, 12)
  assert.equal(pane.split.at(-1), `PANE_OPEN_TARGET=${paneTarget}`)
  const shells = ['sh', 'bash', 'zsh', 'fish'].filter(shell => spawnSync('sh', ['-c', `command -v ${shell}`], { stdio: 'ignore' }).status === 0)
  for (const shell of shells) {
    const edited = spawnSync(shell, ['-c', pane.run('w1:p37')[4]!], { encoding: 'utf8', cwd: dir, env: { ...process.env, PANE_OPEN_TARGET: paneTarget }, timeout: 5000 })
    assert.equal(edited.status, 0, `${shell}: ${edited.stderr}`)
    assert.deepEqual(edited.stdout.split('\0').slice(0, -1), ['-u', 'NONE', '-c', "echo 'hi'", '+12', paneTarget], shell)
  }
  assert.ok(!existsSync(join(dir, 'nope')) && !existsSync(join(dir, 'nope2')), 'a file name ran as a command')
  console.log(`Herdr checks passed in ${shells.join(', ')}: the file name reaches the editor verbatim and nothing in it runs`)
  console.log('Open checks passed; no applications launched')
} finally {
  for (const socket of sockets) socket.close()
  rmSync(dir, { recursive: true, force: true })
}
