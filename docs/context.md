# Context for Claude

```mermaid
flowchart TB
  A[Selected row] --> C[Context in Claude's prompt]
  B[Marked rows] --> C
  D[@path in a prompt] --> E[The tree reveals that file]
```

- The selected file goes to Claude as context, and `@path` in a prompt reveals that file
- Up to 100 marked files and folders go to Claude as context; `y` / `Y` copy all their paths, `u` their names
- Marked rows and the selected row show the same selection background

Select rows the way an IDE file tree does:

- Click selects one row and clears the marks
- shift+click marks every row from the anchor (the last click, ctrl+click or `v`) to the clicked one, in tree order, and replaces the range of the previous shift+click
- ctrl+click marks or unmarks one row and makes it the anchor; it does not open the file
- alt+click does the same as ctrl+click on macOS, because neither the Desktop app nor the terminal reports cmd with a click
- `v` marks or unmarks the row under the cursor
- shift+j / shift+k (or shift+down / shift+up) mark the row under the cursor, move and mark the next. In the Desktop app the hidden hotkeys lose shift, so click a row first
- `V` and the "N marked" count in the footer clear the marks; the clear selection button in the header clears the marks and the selected row
- Double-click or Enter opens a file
