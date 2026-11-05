#!/bin/sh
set -e
rule=$(cd "$(dirname "$0")" && pwd)/version.sh
unset $(git rev-parse --local-env-vars)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cd "$work"
git init -q -b main .
[ "$(git rev-parse --absolute-git-dir)" = "$(pwd -P)/.git" ] || { echo "version-test: not in its own scratch repo" >&2; exit 1; }
g() { git -c user.email=t@t -c user.name=t -c commit.gpgsign=false -c tag.gpgsign=false "$@"; }
mkdir .claude-plugin
at() {
  printf '{"version": "%s"}\n' "$1" > .claude-plugin/plugin.json
  printf 'version-%s-blue\n' "$1" > README.md
  g add -A && g commit -qm "$1" && git rev-parse HEAD
}
remote() { git update-ref "refs/remotes/origin/$1" "$2"; }
fails=0
expect() {
  want=$1; shift
  if sh "$rule" "$@" >/dev/null 2>&1; then got=pass; else got=fail; fi
  [ "$got" = "$want" ] || { echo "version-test: $* gave $got, wanted $want" >&2; fails=1; }
}
v070=$(at 0.7.0); g tag v0.7.0
v071=$(at 0.7.1)
v072=$(at 0.7.2)
v080=$(at 0.8.0)
expect pass push refs/heads/release/0.7.1 "$v071"
expect fail push refs/heads/release/0.7.1 "$v070"
remote release/0.7.1 "$v071"
expect pass push refs/heads/release/0.7.1 "$v071"
expect fail push refs/heads/release/0.7.1 "$v072"
expect fail push refs/heads/release/0.7.3 "$v072"
remote release/0.8.0 "$v080"
expect pass push refs/heads/fix/a "$v071"
expect pass push refs/heads/feat/b "$v080"
expect fail push refs/heads/fix/a "$v072"
git checkout -q "$v071"
expect pass pr release/0.7.1
expect fail pr release/0.8.0
expect pass pr main
git checkout -q "$v070"
expect fail pr main
remote release/0.8.1 "$v072"
v081=$(at 0.8.1)
expect pass push refs/heads/release/0.8.1 "$v081"
expect fail push refs/heads/release/0.8.1 "$v080"
git checkout -q "$v081"
expect pass pr release/0.8.1
exit "$fails"

