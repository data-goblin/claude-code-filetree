# Git

```mermaid
flowchart TB
  A[Repo] --> B[Branch row: counts, ahead and behind]
  A --> C[Status per file and folder]
  A --> D[Line counts on changed files]
  E[Git and GitHub commands Claude runs] --> F[Status line at the bottom]
```

- Git status per file and folder, line counts on changed files, and the branch with ahead/behind in the header (the upstream name with the `Remote branch` setting)
- Git and GitHub commands Claude runs show as a status line at the bottom of the pane

<img src="../media/filetree-git.gif" alt="A committed file shimmers green and the footer shows the commit" width="800">
