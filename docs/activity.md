# Claude activity

```mermaid
flowchart TB
  A[Claude reads or writes a file] --> B[The file shimmers]
  B --> C[Collapsed folders open to show it]
  C -->|auto-collapse on| D[Folders close 10 seconds after the last touch]
  E[File reference in a reply] --> F[Link that opens the preview]
```

- Claude's reads (purple), writes (orange) and commits (green) shimmer in the tree; collapsed folders open to show the file
- A file reference with a line in Claude's reply (`path:12`, `path:12-20` or `path#L12-L20`, relative to the cwd or absolute) to a file under the tree root gets a link under the reply; clicking it reveals the file and opens the preview at that line
- Auto-collapse (`a`, the toolbar button or the setting) closes folders opened for Claude 10 seconds after its last touch; turning it on also closes the ones it opened while off

Follow work moves the session to where the work is. When Claude or its subagents read and write in another git repo for a few minutes (two or more writes there, or four reads with no writes, and clearly more than anywhere else), filetree runs `/cd` to that repo at the end of the turn, or right away while Claude is idle, and the tree follows. It moves at most once every two minutes, stays put while several repos are equally busy, and skips temp folders, `~/.claude`, `~/.config`, `~/Library` and the agents vault. A `z` jump counts as a move, so it is not undone straight away. Where the app has no `/cd` (the Desktop app) or Jump moves Claude is set to tree, only the tree moves: it stays on the repo it shows while the work stays there, and moves back when the work goes back to the first repo.
