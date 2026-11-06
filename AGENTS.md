# Agent rules for this repository

## Credit every contributor

- Every merged pull request, adopted idea and confirmed bug report gets a line in `ACKNOWLEDGEMENTS.md` under Code, Ideas or Bug reports, naming the GitHub handle, what they gave and the PR or issue number
- A feature rebuilt from someone's pull request or suggestion still credits them under Ideas, even when none of their code shipped
- Release notes credit the same people: each line that comes from a contributor ends with `(@handle, #n)`
- Add the attribution in the same change that lands the work; a release is not cut while `ACKNOWLEDGEMENTS.md` is missing someone in it
- The `credits` workflow fails a pull request whose author, commit authors or closed-issue reporters (other than the owner and bots) have no line there

## Colors

- Every color the plugin picks itself (a hex value: shimmer tones, treemap fills and labels) passes `bun scripts/contrast.ts`, and the `contrast` workflow runs it on any change under `hooks/`; fix the color, never lower the gate
- One owner-approved exception: the Desktop mustard for modified files (`DESK_GIT_TEXT` M and T) is checked on every background except the selected row, where no single mustard reaches 3:1 in both light and dark mode
- Text, git and line-count colors are terminal palette indices and muted text is the engine's `dimColor`, so the user's terminal and Claude themes own them; the script asserts they stay that way and reports their contrast in the known themes without gating on it

## Types and lint

- `tsconfig.json` checks `hooks`, `tests` and `types` against the engine types vendored in `types/engine/`; the `lint` workflow runs `tsc` and oxlint on every change
- When Claude Code updates, hot-reload the mod so the engine rewrites `.claude-plugin/types/`, copy `claude-code/index.d.ts` and `claude-code-tools/index.d.ts` from there over the same paths under `types/engine/`, and fix what `tsc -p tsconfig.json` reports. Never vendor `claude-code-mcp`: it lists the local session's MCP tools

## Merging

- Wait for the Codex review on a pull request to finish (its summary comment says completed for the head commit) and fix or answer every finding before merging; CI passing is not enough
- This holds for pull requests into any branch, not only main: findings left open on a side branch come back when it lands
- A Codex finding that names a class of bug (Windows paths, missing credit, untested logic) gets a CI check or a regression test in the fix, not only the one-line fix

## Review guidelines

- Check `README.md` against the change on every review and flag anything out of date as a finding: features, keys, settings and their defaults, the version badge, install steps
- Flag a screenshot or GIF in `README.md` that shows old behaviour as a finding, naming the file
- A pull request that changes behaviour without updating `README.md` is a finding

## Tests

- Run tests with `claude plugin test .`, never `bun test`: `claude-code/testing` only exists inside that harness, so bun fails to resolve it
- A PR keeps the version of the release branch it targets, set when that branch was cut, so one release never carries two bumps; `.githooks/pre-push` and the version-bump workflow refuse a branch that does not

## Branches

- Two release branches exist at all times, both cut from `main` after each release:
  - `release/<next patch>`, now `release/0.8.2`: fixes and small changes
  - `release/<next minor>.0`, now `release/0.9.0`: new features, new settings and behaviour changes
- A release branch is named after the version it carries; the version check refuses a `release/*` branch whose `.claude-plugin/plugin.json` says otherwise
- Target every PR at one of them, never at `main`: a fix or small change goes to the patch branch, anything else to the feature branch; when unsure, the feature branch
- The commit that cuts a release branch sets its version in `.claude-plugin/plugin.json` and the README badge (`Clean(release): open 0.7.1`); PRs keep the version of the branch they target, and the version-bump workflow and `.githooks/pre-push` refuse anything else
- After every merge into the patch branch, merge the patch branch into the feature branch with a merge commit, so fixes reach the next minor
- `main` only takes release merges and an emergency hotfix; a hotfix is merged into both release branches right after

## Releases

- Release at most once a day, right after the filetree repo keeper's morning run (06:33 Europe/Brussels); never release right after a merge
- Everything merged since the last release ships in the next morning release; once today's release is out, new merges wait for tomorrow's
- Only an emergency hotfix ships the same day: a security issue, a bug that breaks things badly, or a UI that is badly broken
- A release is a PR from a release branch into `main`, merged with a merge commit; sign a `v<version>` tag on that merge and publish the GitHub release from it. The keeper has no signing key, so it hands the release to an agent on a machine that has one
- After a patch release (v0.7.1): delete `release/0.7.1`, cut `release/0.7.2` from `main`, and merge `main` into `release/0.8.0`
- After a feature release (v0.8.0): delete both release branches, then cut `release/0.8.1` and `release/0.9.0` from `main`
- The release notes cover every PR merged since the last release, including versions that never got their own release
