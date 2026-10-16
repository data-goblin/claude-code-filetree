<h1 align="center">Claude Code Filetree</h1>

<p align="center">
  An IDE-style file tree for Claude Code that shows what Claude is doing and where in files
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Claude_Code-%E2%89%A5_2.1.287-D97757?logo=claude&logoColor=fff" alt="Claude Code 2.1.287 or newer">
  <img src="https://img.shields.io/badge/version-0.2.26-blue" alt="Version">
  <img src="https://img.shields.io/badge/type-mod-6f42c1" alt="Claude Code mod">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

<p align="center">
  <img src="media/filetree-shimmer.gif" alt="filetree shimmering the file Claude is editing" width="900">
</p>

> [!NOTE]
> filetree is a Claude Code **mod** and needs **Claude Code 2.1.287+**. It shows in the right sidebar, which in the terminal needs the fullscreen layout (`/tui fullscreen`) and a terminal at least 110 columns wide; the Desktop app docks it on its own, and `/filetree` reopens it there after you close it. Tested on Linux, macOS and Windows; mods don't load in WSL sessions of the Desktop app.

---

## Installation

The repo is its own plugin marketplace. Run this in the terminal:

```bash
claude plugin marketplace add data-goblin/claude-code-filetree
claude plugin install filetree@claude-code-filetree
```

Or inside a Claude Code session:

```text
/plugin marketplace add data-goblin/claude-code-filetree
/plugin install filetree@claude-code-filetree
```

Installed it as `filetree@filetree` before the repository was renamed? Nothing to do: that install keeps loading and keeps receiving updates.

Install fails with `Unrecognized key: "options"`? Your Claude Code is older than 2.1.287: run `claude update`, then install again.

## Features

- Interactive file tree for the working directory where you're using Claude Code; it follows the cwd, or `/filetree <path>` pins another folder
- Search the file tree, including folders you have not opened yet
- Git status per file and folder in color, with exact lines changed (`+N` `-N`) on modified files and `?:N M:N D:N` file counts on folders
- Branch, upstream and ahead/behind in the header
- Visual indicator of Claude reads and searches (purple), writes (orange) and commits (green); collapsed folders open to show the file

  <img src="media/filetree-read.gif" alt="Files shimmer purple while Claude reads and searches them" width="800">

- Git and GitHub operations via `git` and `gh` (commit, push, pull, checkout, merge, PR and more) shown as a status at the bottom of the pane

  <img src="media/filetree-git.gif" alt="A committed file shimmers green and the footer shows the commit" width="800">

- Selection-aware: the selected file is passed to Claude as context through a `prompt.submit` hook, and `@path` mentions in a prompt reveal that file in the tree

  <img src="media/filetree-ask.gif" alt="Selecting config.yaml in the tree and asking Claude what it changed there" width="800">

- File and folder sizes: the `Σ` header button swaps the date column for sizes; folders show their disk usage (`du`, or a summed listing on Windows), worked out in the background for the rows on screen and refreshed after Claude writes
- Double-click a file to open it in its default app
- On macOS, Space on a file shows it in Quick Look
- Click to select, arrow keys or `j`/`k`/`h`/`l` to move through the tree
- Hover a header button to see what it does
- Light on large repos: outside a repo it only checks once whether one exists, and every git call is scoped to the cwd
- Nerd Font icons with a plain Unicode fallback
- On Omarchy, the pane takes its colors and background from the current theme and follows theme switches
- A light `/config` theme in the terminal gets its own palette, with every text color at WCAG AAA contrast (7:1 or more), also on the selected and hovered rows

### Keyboard navigation

With the filetree pane focused, use `j`/`k` to move down/up, `l` to expand a folder, and `h` to collapse it or move to its parent. `o` or Enter opens a file or toggles a folder. Press `s` to focus search, type a query, then Enter to jump to the first match and return focus to the tree controls.

### Resizing the pane

You can resize the pane with the mouse, or by setting custom `pane:grow` or `pane:shrink` keybindings in `keybindings.json`

<p align="center">
  <img src="media/filetree-resize.gif" alt="Dragging the filetree pane edge to resize it" width="900">
</p>

## Settings

All settings are in `/config` under filetree.

- **Claude activity:** what shimmers: `reads and writes` (default), `writes`, `reads` or `none`. Git status, line counts and the git status at the bottom always show.
- **Follow Claude:** `on` (default) scrolls the tree to what Claude reads, writes or commits; `off` keeps the view where you put it, and highlights still show.
- **Open at start:** `on` (default) opens the pane when a session starts; `off` keeps it closed until you run `/filetree`.
- **Right column:** `date` (default), `age` or `size`; what the right column shows when a session starts. `age` shows how long ago a file changed in a few characters: `now`, `12m`, `3h`, `5d`, then the day (`Oct 9`) past a week and the year past a year. The `Σ` button in the header toggles between sizes and the dates or ages.
- **Hints:** `on` (default) shows a line under the header outside a git repo saying git status starts after `git init`; `off` hides it.
- **Open with:** empty (default) opens files in their default app on double-click or Enter, including inside tmux. `editor` opts into `$VISUAL`, then `$EDITOR`, then `vi` in tmux on Linux/macOS: nvim reuses a running nvim in the same tmux server and session; otherwise the editor opens in a new window in the file's folder. Outside a supported tmux environment it shows a notice instead of opening the file: a mod cannot hand Claude Code's terminal to another program, so a terminal editor needs a tmux window to run in. For a GUI editor, or outside tmux, use a command instead, such as `code -g {path}` or one that opens your terminal's new window. Editor commands can include arguments; quote an executable path or argument that contains spaces, for example `EDITOR='"/opt/My Editor/nvim" -u NONE'`. Arguments apply when starting a new editor; reusing nvim keeps that instance's configuration. `preview` shows the file in the pane instead: Markdown rendered, code highlighted, `j`/`k` or the arrow keys, `f`/`b`, Page Up/Down or Ctrl+F/B for a page, and the wheel to scroll, `←`/`h` or `← files` back to the tree, `↗` always the default app, `e` the editor from Edit with at the top line shown, which the button names (`edit :42`). Otherwise a command that double-click and Enter run instead: `{path}` is the file and `{dir}` its folder, and without `{path}` the path goes last. It runs without a shell, so quote a word that holds spaces, and it should start the viewer and return rather than wait for it. Examples: `zed {path}`, `code -g {path}`, or in herdr a tab running [herdr-file-viewer](https://github.com/smarzban/herdr-file-viewer) on the file: `herdr plugin pane open --plugin herdr-file-viewer --entrypoint file-viewer --placement tab --focus --env HERDR_FILE_VIEWER_OPEN={path}`.
- **Edit with:** what `e` does in the preview: it opens the file at the top line shown. Empty (default) uses `$VISUAL`, then `$EDITOR`, then `vi` in tmux on Linux/macOS, the same way as `Open with: editor`, passing the line as `+N`; elsewhere the `e` button is hidden. Otherwise a command like Open with, where `{line}` is that line: `code -g {path}:{line}` or `zed {path}:{line}`.
- **Glyphs:** `auto` (default) uses Nerd Font icons when a Nerd Font is installed and your terminal started after it was installed, plain Unicode in the desktop app, and Nerd Font over SSH. `nerd` or `plain` forces one.

## herdr

Clicking rows needs herdr 0.9.1 or later. herdr 0.9.0 and older accept pixel mouse reporting but still send cell positions, which would put every click in the session in the wrong place, so on those versions the rows ignore the mouse and the rest of the pane and session keep working. Run `herdr update` to get row clicks.

## Contributing

Turn on the pre-commit hook once per clone; it runs `claude plugin validate` and the plugin tests before each commit that touches the plugin:

```bash
git config core.hooksPath .githooks
```

The same checks run on macOS, Windows and Linux in CI on every push that touches the plugin.

## License

[MIT](LICENSE)

*This project is inspired by my Omarchy app [FileBlade](https://github.com/data-goblin/fileblade)*
