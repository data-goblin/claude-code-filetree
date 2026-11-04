#!/bin/sh
set -e
rule=$(cd "$(dirname "$0")" && pwd)/version.sh
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cd "$work"
git init -q -b main .
git config user.email t@t && git config user.name t && git config commit.gpgsign false && git config tag.gpgsign false
mkdir .claude-plugin
at() {
  printf '{"version": "%s"}\n' "$1" > .claude-plugin/plugin.json
  printf 'version-%s-blue\n' "$1" > README.md
  git add -A && git commit -qm "$1" && git rev-parse HEAD
}
remote() { git update-ref "refs/remotes/origin/$1" "$2"; }
fails=0
expect() {
  want=$1; shift
  if sh "$rule" "$@" >/dev/null 2>&1; then got=pass; else got=fail; fi
  [ "$got" = "$want" ] || { echo "version-test: $* gave $got, wanted $want" >&2; fails=1; }
}
v070=$(at 0.7.0); git tag v0.7.0
v071=$(at 0.7.1)
v072=$(at 0.7.2)
v080=$(at 0.8.0)
expect pass push refs/heads/release/0.7.x "$v071"
expect fail push refs/heads/release/0.7.x "$v070"
remote release/0.7.x "$v071"
expect pass push refs/heads/release/0.7.x "$v071"
expect fail push refs/heads/release/0.7.x "$v072"
remote release/0.8.x "$v080"
expect pass push refs/heads/fix/a "$v071"
expect pass push refs/heads/feat/b "$v080"
expect fail push refs/heads/fix/a "$v072"
git checkout -q "$v071"
expect pass pr release/0.7.x
expect fail pr release/0.8.x
expect pass pr main
git checkout -q "$v070"
expect fail pr main
exit "$fails"
