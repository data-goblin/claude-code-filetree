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
if grep -rnE '\$\.ui\.open\(' hooks | grep -v '^hooks/util\.ts:'; then
  flag "open the pane through openPane() in hooks/util.ts so every open carries the pane ground"
fi
for want in '-protocol_whitelist file -f "$coder"' 'MAGICK_CONFIGURE_PATH="$d"' '<policy domain="coder" rights="none" pattern="*"/>'; do
  grep -qF -e "$want" hooks/peek.ts || flag "hooks/peek.ts: keep the picture decoders locked down ($want)"
done
exit "$fail"
