import type { EngineInterface } from 'claude-code'
import { settings } from './state'
import { isBinaryPath, openWithCommand, tmuxOpenCommand, LINUX_LAUNCH, openCommand, herdrOpenCommand, herdrPane, herdrError, tmuxCommand, herdrSplit } from './open'
import { showPreview } from './preview'
import { osName, shortPath, messageOf } from './util'
import { dirname } from './tree'

export async function openFile($: EngineInterface, path: string, how: { mode?: string; line?: number } = {}): Promise<void> {
  const chosen = (how.mode ?? settings.openWithSetting).trim()
  const mode = how.mode === undefined && settings.binariesInDefaultApp && chosen !== 'preview' && isBinaryPath(path) ? '' : chosen
  if (mode === 'preview') return showPreview($, path)
  const os = await osName($)
  const host = mode === 'editor' ? await editorHost($, os) : ''
  if (mode === 'editor' && !host) {
    $.ui.toast('Open with: editor requires tmux or herdr on Linux or macOS. Clear Open with to use the default app, or set a custom command.')
    return
  }
  const native = (p: string) => (os === 'win32' ? p.replace(/[/]/g, '\\') : p)
  const custom = mode === 'editor' ? null : openWithCommand(mode, native(path), native(dirname(path)), how.line)
  const editor = mode === 'editor' ? (await $.env.get('VISUAL')) || (await $.env.get('EDITOR')) || 'vi' : undefined
  try {
    if (editor && host === 'herdr') return await openInHerdr($, editor, path, how.line)
    const { argv, init } = editor ? tmuxOpenCommand(editor, path, how.line, settings.targetSetting) : custom ? { argv: os === 'linux' ? ['sh', '-c', LINUX_LAUNCH, 'sh', ...custom] : custom, init: { timeoutMs: 10_000 } } : openCommand(os, path)
    const run = await $.process.run(argv, init)
    if (run.exitCode !== 0) $.ui.toast(`could not open ${path} with ${editor ?? custom?.[0] ?? argv[0]}: ${run.stderr.trim().split('\n')[0] || `exit ${run.exitCode}`}`)
  } catch {
    $.ui.toast(`could not open ${path} with ${editor ?? custom?.[0] ?? 'the default app'}`)
  }
}

export async function editorHost($: EngineInterface, os: 'linux' | 'darwin' | 'win32'): Promise<'tmux' | 'herdr' | ''> {
  if (os === 'win32') return ''
  if (await $.env.get('TMUX')) return 'tmux'
  return (await $.env.get('HERDR_ENV')) ? 'herdr' : ''
}

export async function openInHerdr($: EngineInterface, editor: string, path: string, line?: number): Promise<void> {
  const { split, run, init } = herdrOpenCommand((await $.env.get('HERDR_BIN_PATH')) || 'herdr', editor, path, line, settings.targetSetting, (await $.env.get('HERDR_WORKSPACE_ID')) || '')
  const made = await $.process.run(split, init)
  const sent = made.exitCode === 0 ? await $.process.run(run(herdrPane(made.stdout)), init) : made
  if (sent.exitCode !== 0) $.ui.toast(`could not open ${path} with ${editor}: ${herdrError(sent.stderr) || `exit ${sent.exitCode}`}`)
}

export async function openTerminal($: EngineInterface, dir: string): Promise<void> {
  const host = await editorHost($, await osName($))
  if (!host) {
    $.ui.toast('t opens a shell in a new tmux or herdr pane; run Claude Code inside tmux or herdr to use it')
    return
  }
  try {
    const argv = host === 'tmux' ? tmuxCommand(settings.targetSetting, dir, [(await $.env.get('SHELL')) || 'sh']) : herdrSplit((await $.env.get('HERDR_BIN_PATH')) || 'herdr', dir, settings.targetSetting, (await $.env.get('HERDR_WORKSPACE_ID')) || '')
    const run = await $.process.run(argv, { timeoutMs: 10_000 })
    if (run.exitCode !== 0) $.ui.toast(`could not open a terminal in ${shortPath(dir)}: ${(host === 'herdr' ? herdrError(run.stderr) : run.stderr.trim().split('\n')[0]) || `exit ${run.exitCode}`}`)
  } catch (err) {
    $.ui.toast(`could not open a terminal in ${shortPath(dir)}: ${messageOf(err).split('\n')[0]}`)
  }
}

export async function quickLook($: EngineInterface, path: string): Promise<void> {
  try {
    await $.process.run(['sh', '-c', '(nohup qlmanage -p "$1" >/dev/null 2>&1 &); sleep 0.4; osascript -e \'tell application "System Events" to set frontmost of first process whose name is "qlmanage" to true\' >/dev/null 2>&1 || true', 'sh', path], { timeoutMs: 10_000 })
  } catch {
    $.ui.toast(`could not preview ${path} with Quick Look`)
  }
}
