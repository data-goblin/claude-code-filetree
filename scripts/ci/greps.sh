#!/bin/sh
fail=0
flag() { printf '%s\n' "$1" >&2; fail=1; }
if grep -rnE '^\s*(//|/\*)|\s//\s|\{/\*' hooks tests scripts types --exclude-dir=engine --exclude=greps.sh; then
  flag "remove the code comments listed above"
fi
if grep -rnE "startsWith\('/'\)|\[0\] === '/'" hooks | grep -vE "^hooks/tree\.ts:|isAbsolute\(path\) && !path\.startsWith"; then
  flag "use isAbsolute() from hooks/tree.ts so Windows drive paths count as absolute"
fi
if grep -nE "['\"]escape['\"]" hooks/hit.tsx hooks/rows.tsx hooks/zone.tsx hooks/button.tsx; then
  flag "Client onKey handlers never receive Escape (the engine keeps it to return the focus); handle it elsewhere"
fi
if grep -rnE "hotkey(=\{?|: *)['\"][A-Z]['\"]" hooks; then
  flag "Button hotkeys are lowercased on Desktop; use a lowercase letter or a digit"
fi
exit "$fail"
