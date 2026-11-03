# Agent rules for this repository

## Credit every contributor

- Every merged pull request, adopted idea and confirmed bug report gets a line in `ACKNOWLEDGEMENTS.md` under Code, Ideas or Bug reports, naming the GitHub handle, what they gave and the PR or issue number
- A feature rebuilt from someone's pull request or suggestion still credits them under Ideas, even when none of their code shipped
- Release notes credit the same people: each line that comes from a contributor ends with `(@handle, #n)`
- Add the attribution in the same change that lands the work; a release is not cut while `ACKNOWLEDGEMENTS.md` is missing someone in it

## Colors

- Every color the plugin picks itself (a hex value: shimmer tones, treemap fills and labels) passes `bun scripts/contrast.ts`, and the `contrast` workflow runs it on any change under `hooks/`; fix the color, never lower the gate
- Text, git and line-count colors are terminal palette indices and muted text is the engine's `dimColor`, so the user's terminal and Claude themes own them; the script asserts they stay that way and reports their contrast in the known themes without gating on it

## Types and lint

- `tsconfig.json` checks `hooks`, `tests` and `types` against the engine types vendored in `types/engine/`; the `lint` workflow runs `tsc` and oxlint on every change
- When Claude Code updates, hot-reload the mod so the engine rewrites `.claude-plugin/types/`, copy `claude-code/index.d.ts` and `claude-code-tools/index.d.ts` from there over the same paths under `types/engine/`, and fix what `tsc -p tsconfig.json` reports. Never vendor `claude-code-mcp`: it lists the local session's MCP tools

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

## Branch release/0.7.0

- `release/0.7.0` collects the 0.7.0 features: the "Follow work" setting from `filetree-proactive` (the session runs `/cd` into the repo where it and its subagents work, with hysteresis, hooks/work.ts) and the "Long file" setting (red line counts above a threshold in the loc column)
- Keep it current with main: after every merge to main, merge `origin/main` into `release/0.7.0`
- It lands on main through one pull request, with the Codex review on its head, and ships in the next morning release after it merges
- `filetree-proactive` is folded into it and gets no new commits
