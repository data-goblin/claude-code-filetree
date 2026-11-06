# Search

```mermaid
flowchart TB
  A[Search row] -->|names| B[Matches across unopened folders]
  A -->|q: contents| C[git grep or grep -r]
  C --> D[Matches per file with line numbers]
  D -->|Enter or click| E[Preview at that line]
  F[z] --> G[Jump to a folder, zoxide style]
```

- The contents toggle in the search row (`q` from the tree, or a click on it) searches inside files instead of names, with `git grep` in a repo and `grep -r` outside one; matches are grouped per file with line numbers, the first 200 are shown (fewer in the Desktop app when lines are long), and Enter or a click opens the file in the split preview at that line (the full preview in the Desktop app)
- `s` focuses search, `i` searches in the folder under the cursor, `c` and `r` match case and regular expressions
- `z` jumps to a folder: it opens on the 10 folders you visited most recently, newest first, and once you type it ranks zoxide style: type fragments in order, pick with up and down, and Enter re-roots the tree and moves Claude there with `/cd` where the app has `/cd` (the Desktop app does not); folders that no longer exist drop out of the list; the date column turns into Last accessed and shows when you last went to each folder from the tree, and the column headers do not sort while the list is open; the folder icons in the list turn violet (the terminal's magenta), so the list never reads as the tree, and `jump=#hex` in the Palette setting picks another color
