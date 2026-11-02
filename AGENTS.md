# Agent rules for this repository

## Credit every contributor

- Every merged pull request, adopted idea and confirmed bug report gets a line in `ACKNOWLEDGEMENTS.md` under Code, Ideas or Bug reports, naming the GitHub handle, what they gave and the PR or issue number
- A feature rebuilt from someone's pull request or suggestion still credits them under Ideas, even when none of their code shipped
- Release notes credit the same people: each line that comes from a contributor ends with `(@handle, #n)`
- Add the attribution in the same change that lands the work; a release is not cut while `ACKNOWLEDGEMENTS.md` is missing someone in it

## Colors

- Every color the plugin picks itself (a hex value: shimmer tones, treemap fills and labels) passes `bun scripts/contrast.ts`, and the `contrast` workflow runs it on any change under `hooks/`; fix the color, never lower the gate
- Text, git and line-count colors are terminal palette indices and muted text is the engine's `dimColor`, so the user's terminal and Claude themes own them; the script asserts they stay that way and reports their contrast in the known themes without gating on it

## Merging

- Wait for the Codex review on a pull request to finish (its summary comment says completed for the head commit) and fix or answer every finding before merging; CI passing is not enough

## Tests

- Run tests with `claude plugin test .`, never `bun test`: `claude-code/testing` only exists inside that harness, so bun fails to resolve it
- Every PR raises the version in `.claude-plugin/plugin.json` and the README badge; `.githooks/pre-push` and the version-bump workflow refuse a branch that does not

## Releases

- Release at most once a day, right after the filetree repo keeper's morning run (06:33 Europe/Brussels); never release right after a merge
- Everything merged since the last release ships in the next morning release; once today's release is out, new merges wait for tomorrow's
- Only an emergency hotfix ships the same day: a security issue, a bug that breaks things badly, or a UI that is badly broken
- The release takes the version on `main` at that run; sign a `v<version>` tag on that commit and publish the GitHub release from it. The keeper has no signing key, so it hands the release to an agent on a machine that has one
- The release notes cover every PR merged since the last release, including versions that never got their own release

## Branch filetree-proactive

- `filetree-proactive` holds the "Follow work" setting: the session runs `/cd` into the repo where it and its subagents work, with hysteresis (hooks/work.ts). It is under test and not meant for main yet
- Keep it current with main: after every merge to main, rebase `filetree-proactive` onto `origin/main` and force-push it with `--force-with-lease`; its version stays one patch above main so the pre-push check passes
