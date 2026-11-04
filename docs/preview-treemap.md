# Preview and treemap

`p` or the header button shows the split. On a file it shows the file; on a folder, the root row or nothing it shows the treemap.

<img src="media/preview-media.gif" alt="An image, a video, a PDF turned to page 2 and a Word document in the preview" width="800">

```mermaid
flowchart TB
  C[Cursor] -->|file| P[File preview]
  C -->|folder, root row or nothing| T[Treemap]
  T -->|click a box| S[Select the entry]
  T -->|double-click a folder| D[Map that folder]
  T -->|folder name| U[Map the parent]
```

<img src="media/columns.gif" alt="The size button cycles dates, sizes and lines of code, and the treemap follows" width="800">

<img src="media/live-updates.gif" alt="A file created and removed in a shell shows in the tree and the treemap" width="800">

- Split preview under or above the tree: highlighted code, rendered Markdown, images, video poster frames, and PDF and Word pages turned with `[` and `]`
- Treemap of the folder under the cursor in the same split, sized by bytes or by lines, with Claude's activity lit
- The Desktop app has no split preview or treemap
