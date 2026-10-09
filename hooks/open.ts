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

// nvim: the file joins a running nvim of this tmux session as a buffer and its pane is
// selected; with several, the one in the most recently active window. Every nvim serves on a
// default socket (nvim.<pid>.0 under stdpath('run')), found by globbing and asked for the
// tmux server and pane it runs in. With none, or any other editor, the file gets a new window.
export const TMUX_OPEN = [
  'ed=$1 f=$2 d=$3',
  'case $ed in nvim | nvim\\ * | */nvim | */nvim\\ *) ;; *) exec tmux new-window -c "$d" -- sh -c \'exec $1 "$2"\' sh "$ed" "$f" ;; esac',
  'bin=${ed%% *}',
  'here=$(tmux display-message -p \'#{socket_path} #{session_id}\')',
  'best= act=-1',
  // stdpath('run'): $XDG_RUNTIME_DIR, else a random folder under the temp dir nvim picks
  'for s in "${XDG_RUNTIME_DIR:-/nonexistent}"/nvim.*.0 "${TMPDIR:-${TMP:-${TEMP:-/tmp}}}"/nvim."$(id -un)"/*/nvim.*.0; do',
  // owned by this user: a socket another user planted is never talked to
  '  [ -S "$s" ] && [ -O "$s" ] || continue',
  '  t=$("$bin" --server "$s" --remote-expr \'$TMUX . " " . $TMUX_PANE\' 2>/dev/null) || continue',
  '  p=${t##* } sock=${t%%,*}',
  '  [ -n "$p" ] && [ "$sock" != "$t" ] || continue',
  // pane ids are per tmux server, so the pane must be resolved on the server nvim runs under
  '  info=$(tmux display-message -p -t "$p" \'#{socket_path} #{session_id} #{window_activity}\' 2>/dev/null) || continue',
  '  set -- $info',
  '  [ "$1 $2" = "$here" ] && [ "$1" = "$sock" ] && [ "$3" -gt "$act" ] || continue',
  '  best=$s pane=$p act=$3',
  'done',
  'if [ -n "$best" ] && "$bin" --server "$best" --remote "$f"; then',
  '  exec tmux select-window -t "$pane" \\; select-pane -t "$pane"',
  'fi',
  'exec tmux new-window -c "$d" -- sh -c \'exec $1 "$2"\' sh "$ed" "$f"',
].join('\n')

const WIN_OPEN = "$ErrorActionPreference = 'Stop'; [Diagnostics.Process]::Start([Diagnostics.ProcessStartInfo]@{ FileName = $env:PANE_OPEN_TARGET; UseShellExecute = $true }) | Out-Null"

export function openCommand(os: 'linux' | 'darwin' | 'win32', target: string, editor?: string) {
  if (editor && os !== 'win32') {
    const dir = target.slice(0, target.lastIndexOf('/')) || '/'
    return {
      argv: ['sh', '-c', TMUX_OPEN, 'sh', editor, target, dir],
      init: { timeoutMs: 10_000 },
    }
  }
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

function words(command: string): string[] {
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

export function openWithCommand(command: string, path: string, dir: string): string[] | null {
  const argv = words(command)
  if (!argv.length) return null
  const filled = argv.map(w => w.replace(/\{(path|dir)\}/g, (_, key) => (key === 'path' ? path : dir)))
  return argv.some(w => w.includes('{path}')) ? filled : [...filled, path]
}
