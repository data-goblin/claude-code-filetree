# Agent rules for this repository

## Credit every contributor

- Every merged pull request, adopted idea and confirmed bug report gets a line in `ACKNOWLEDGEMENTS.md` under Code, Ideas or Bug reports, naming the GitHub handle, what they gave and the PR or issue number
- A feature rebuilt from someone's pull request or suggestion still credits them under Ideas, even when none of their code shipped
- Release notes credit the same people: each line that comes from a contributor ends with `(@handle, #n)`
- Add the attribution in the same change that lands the work; a release is not cut while `ACKNOWLEDGEMENTS.md` is missing someone in it

## Colors

- Every built-in color passes `bun scripts/contrast.ts`: text, git, line-count and bright shimmer colors at 3:1 on dark terminal backgrounds, dim shimmer steps at 2:1, and the light palette at 7:1 on white, the hover and the selected row
- The `contrast` workflow runs that gate on any change that adds or edits a hex color under `hooks/`; fix the color, never lower the gate
