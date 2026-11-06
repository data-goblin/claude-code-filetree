# Context for Claude

```mermaid
flowchart TB
  A[Selected row] --> C[Context in Claude's prompt]
  B[Marked rows] --> C
  D[@path in a prompt] --> E[The tree reveals that file]
```

- With nothing marked, the selected row goes to Claude as context
- With rows marked, up to 100 marked files and folders go to Claude as context instead of the selected row
- The tree refuses a mark past 100, and a notice says to press the "100 marked" count in the footer to clear the marks
- `@path` in a prompt reveals that file and moves the cursor to it; with nothing marked, the selection moves with it
- The shaded rows are the rows that go to Claude: `y` / `Y` copy their paths, `u` their names, and the "N marked" count in the footer counts them

Select rows the way an IDE file tree does:

- Click selects one row and clears the marks
- shift+click marks every row from the anchor to the clicked one, in tree order, and replaces the range of the previous shift+click. The anchor is the row of the last click, ctrl+click, `v` or move with j / k, h, the arrows, Home, End, Page Up or Page Down
- ctrl+click marks or unmarks one row and makes it the anchor; it does not open the file
- alt+click does the same as ctrl+click on macOS, because neither the Desktop app nor the terminal reports cmd with a click
- With nothing marked, j / k and the arrows move the selection with the cursor
- With rows marked, j / k and the arrows move only the cursor; the row under the cursor is not shaded unless it is marked
- `v` marks or unmarks the row under the cursor, and its shading follows. On the selected row with nothing marked, `v` marks that row, so j / k then leave it selected
- shift+j / shift+k (or shift+down / shift+up) mark the row under the cursor, move and mark the next. In the Desktop app the hidden hotkeys lose shift, so click a row first
- `V` and the "N marked" count in the footer clear the marks, and the row under the cursor stays selected; the clear selection button in the header clears the marks and the selected row
- Double-click or Enter opens a file
