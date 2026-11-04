# Context for Claude

```mermaid
flowchart TB
  A[Selected file] --> C[Context in Claude's prompt]
  B[Marked files and folders] --> C
  D[@path in a prompt] --> E[The tree reveals that file]
```

- The selected file goes to Claude as context, and `@path` in a prompt reveals that file
- `v` marks up to 100 files and folders: marked rows show a dot, `y` / `Y` copy all their paths, `u` their names, and the marked paths go to Claude as context
- shift+click marks every row from the last marked or clicked row to the clicked one; shift+j / shift+k (or shift+down / shift+up) mark the row under the cursor, move and mark the next. In the Desktop app the hidden hotkeys lose shift, so click a row first
