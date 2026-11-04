# Diff

```mermaid
flowchart TB
  A[d on a file] --> B[Diff of that file]
  C[d on a folder] --> D[Every changed file in it]
  D --> E[Grouped by folder or by kind]
  B --> F[In the pane or in a diff tool]
  E --> F
```

- `d` shows the diff of a file or of every changed file in a folder, in the pane or in a tool you name; a folder's files are grouped by folder, with test, build and generated files (lockfiles, `dist`, `build`, `out`, `*.min.*`, snapshots, test folders and `*.test.*` / `*_test.*` files) in a group of their own after the rest

<img src="media/diff.gif" alt="d shows the diff of a file and of a folder" width="800">
