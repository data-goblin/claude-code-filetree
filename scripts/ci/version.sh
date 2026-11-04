#!/bin/sh
set -e
usage() { echo "usage: version.sh pr <base-branch> | push <target-ref> <commit>" >&2; exit 2; }
above() { [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -n1)" = "$1" ]; }
version_at() { git show "$1:.claude-plugin/plugin.json" | jq -r .version; }
released=$(git tag -l 'v*' --sort=-v:refname | head -n1 | sed 's/^v//')
[ -n "$released" ] || released=0.0.0
mode=$1
case "$mode" in
  pr)
    [ -n "$2" ] || usage
    base_ref=$2
    commit=HEAD
    head=$(version_at "$commit")
    case "$base_ref" in
      release/*)
        base=$(version_at "origin/$base_ref")
        [ "$base" != "${base_ref#release/}" ] && [ "$head" = "${base_ref#release/}" ] && base=$head
        [ "$head" = "$base" ] || { echo "version: $base_ref is at $base; keep that version, not $head" >&2; exit 1; } ;;
      *)
        above "$head" "$released" || { echo "version: $head is not above the released $released" >&2; exit 1; } ;;
    esac ;;
  push)
    [ -n "$3" ] || usage
    target=${2#refs/heads/}
    commit=$3
    head=$(version_at "$commit")
    case "$target" in
      main) exit 0 ;;
      release/*)
        [ "$head" = "${target#release/}" ] || { echo "version: $target must carry version ${target#release/}, not $head" >&2; exit 1; }
        if git rev-parse -q --verify "refs/remotes/origin/$target" >/dev/null && above "$(version_at "origin/$target")" "$released" && [ "$(version_at "origin/$target")" = "${target#release/}" ]; then
          current=$(version_at "origin/$target")
          [ "$head" = "$current" ] || { echo "version: $target is at $current; keep that version, not $head" >&2; exit 1; }
        else
          above "$head" "$released" || { echo "version: $target is at $head; a new release branch must be above the released $released" >&2; exit 1; }
        fi ;;
      *)
        lines=$(for b in $(git for-each-ref --format='%(refname:short)' 'refs/remotes/origin/release/*'); do printf '%s=%s ' "${b#origin/}" "$(version_at "$b")"; done)
        if [ -n "$lines" ]; then
          case " $lines" in *"=$head "*) ;; *) echo "version: $target is at $head; use the version of the release branch it targets: $lines" >&2; exit 1 ;; esac
        else
          above "$head" "$released" || { echo "version: $target keeps $head; bump above the released $released" >&2; exit 1; }
        fi ;;
    esac ;;
  *) usage ;;
esac
git show "$commit:README.md" | grep -q "version-$head-blue" || { echo "version: set the README version badge to $head" >&2; exit 1; }
