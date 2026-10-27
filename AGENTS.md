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
