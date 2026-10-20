export const LINUX_LAUNCH = 'setsid -f -w "$@" </dev/null >/dev/null 2>&1 & p=$!; sleep 1; kill -0 "$p" 2>/dev/null && exit 0; wait "$p"'

export const LINUX_OPEN = [
  'set -f',
  'f=$1',
  'if command -v gio >/dev/null; then',
  '  if [ -f "$f" ] && command -v file >/dev/null && encoding=$(file -b --mime-encoding -- "$f") && [ -n "$encoding" ] && [ "$encoding" != binary ]; then',
  '    case $(gio info -a standard::content-type -- "$f" | sed -n \'s/.*standard::content-type: //p\') in',
  '      video/* | audio/*)',
  '        app=$(xdg-mime query default text/plain)',
  '        IFS=:',
  '        for dir in "${XDG_DATA_HOME:-$HOME/.local/share}" ${XDG_DATA_DIRS:-/usr/local/share:/usr/share}; do',
  '          [ -n "$app" ] && [ -f "$dir/applications/$app" ] && exec gio launch "$dir/applications/$app" "$f"',
  '        done',
  '        echo "No text/plain desktop application found for $f" >&2',
  '        exit 1',
  '        ;;',
  '    esac',
  '  fi',
  '  if (exec gio open "$f"); then exit 0; fi',
  'fi',
  'exec xdg-open "$f"',
].join('\n')

export const TMUX_OPEN = [
  'f=$1 d=$2 n=$3; shift 3',
  'bin=$1',
  'case ${bin##*/} in nvim) ;; *) exec tmux new-window -c "$d" -- "$@" ${n:+"+$n"} "$f" ;; esac',
  'probe() {',
  '  "$bin" --server "$s" --remote-expr \'$TMUX . " " . $TMUX_PANE\' 2>/dev/null &',
  '  request=$!',
  '  (sleep 1; kill -KILL "$request") >/dev/null 2>&1 &',
  '  timer=$!',
  '  wait "$request" 2>/dev/null; result=$?',
  '  kill "$timer" 2>/dev/null',
  '  wait "$timer" 2>/dev/null',
  '  return "$result"',
  '}',
  'here=$(tmux display-message -p \'#{socket_path} #{session_id}\')',
  'best= act=-1',
  'for s in "${XDG_RUNTIME_DIR:-/nonexistent}"/nvim.*.0 "${TMPDIR:-${TMP:-${TEMP:-/tmp}}}"/nvim."$(id -un)"/*/nvim.*.0; do',
  '  [ -S "$s" ] && [ -O "$s" ] || continue',
  '  t=$(probe) || continue',
  '  p=${t##* } sock=${t%%,*}',
  '  [ -n "$p" ] && [ "$sock" != "$t" ] || continue',
  '  info=$(tmux display-message -p -t "$p" \'#{socket_path} #{session_id} #{window_activity}\' 2>/dev/null) || continue',
  '  location=${info% *} activity=${info##* }',
  '  [ "$location" = "$here" ] && [ "${location% *}" = "$sock" ] && [ "$activity" -gt "$act" ] || continue',
  '  best=$s pane=$p act=$activity',
  'done',
  'if [ -n "$best" ] && "$bin" --server "$best" --remote "$f"; then',
  '  [ -z "$n" ] || "$bin" --server "$best" --remote-send "<C-\\><C-N>:$n<CR>"',
  '  exec tmux select-window -t "$pane" \\; select-pane -t "$pane"',
  'fi',
  'exec tmux new-window -c "$d" -- "$@" ${n:+"+$n"} "$f"',
].join('\n')

const WIN_OPEN = "$ErrorActionPreference = 'Stop'; [Diagnostics.Process]::Start([Diagnostics.ProcessStartInfo]@{ FileName = $env:PANE_OPEN_TARGET; UseShellExecute = $true }) | Out-Null"

export function tmuxOpenCommand(editor: string, target: string, line?: number) {
  const argv = words(editor)
  if (!argv[0]) throw new Error('Editor command is empty')
  const dir = target.slice(0, target.lastIndexOf('/')) || '/'
  return {
    argv: ['sh', '-c', TMUX_OPEN, 'sh', target, dir, line ? String(line) : '', ...argv],
    init: { timeoutMs: 10_000 },
  }
}

export function herdrOpenCommand(herdr: string, editor: string, target: string, line?: number) {
  const argv = words(editor)
  if (!argv[0]) throw new Error('Editor command is empty')
  const dir = target.slice(0, target.lastIndexOf('/')) || '/'
  const command = [...argv, ...(line ? [`+${line}`] : [])].map(w => `'${w.replace(/'/g, "'\\''")}'`).join(' ')
  return {
    split: [herdr, 'pane', 'split', '--current', '--direction', 'right', '--focus', '--cwd', dir, '--env', `PANE_OPEN_TARGET=${target}`],
    run: (pane: string) => [herdr, 'pane', 'run', pane, `exec ${command} "$PANE_OPEN_TARGET"`],
    init: { timeoutMs: 10_000 },
  }
}

export function herdrPane(stdout: string): string {
  const id: unknown = JSON.parse(stdout)?.result?.pane?.pane_id
  if (typeof id !== 'string' || !id) throw new Error('herdr returned no pane id')
  return id
}

export function herdrError(stderr: string): string {
  let message: unknown
  try {
    message = JSON.parse(stderr)?.error?.message
  } catch {}
  return typeof message === 'string' && message ? message : (stderr.trim().split('\n')[0] ?? '')
}

export function openCommand(os: 'linux' | 'darwin' | 'win32', target: string) {
  const argv = os === 'linux'
    ? ['sh', '-c', LINUX_LAUNCH, 'sh', 'sh', '-c', LINUX_OPEN, 'sh', target]
    : os === 'darwin'
      ? ['open', '--', target]
      : ['powershell', '-NoProfile', '-NonInteractive', '-Command', WIN_OPEN]
  return {
    argv,
    init: {
      timeoutMs: 10_000,
      ...(os === 'win32' ? { env: { PANE_OPEN_TARGET: /^[a-z][a-z0-9+.-]*:\/\//i.test(target) ? target : target.replace(/\//g, '\\') } } : {}),
    },
  }
}

export function words(command: string): string[] {
  const out: string[] = []
  let word: string | null = null
  let quote = ''
  for (const ch of command) {
    if (quote) {
      if (ch === quote) quote = ''
      else word = (word ?? '') + ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
      word ??= ''
    } else if (/\s/.test(ch)) {
      if (word !== null) out.push(word)
      word = null
    } else word = (word ?? '') + ch
  }
  if (word !== null) out.push(word)
  return out
}

export function openWithCommand(command: string, path: string, dir: string, line = 1): string[] | null {
  const argv = words(command)
  if (!argv.length) return null
  const filled = argv.map(w => w.replace(/\{(path|dir|line)\}/g, (_, key) => (key === 'path' ? path : key === 'dir' ? dir : String(line))))
  return argv.some(w => w.includes('{path}')) ? filled : [...filled, path]
}
