import type { Register, Timer } from 'claude-code'
import { bindKeys } from './keybind'
import { CLEAN } from './peek'
import { gitActions, readOnly, readTargets, resolve } from './git'
import { jumpKey, jumpClose } from './jump'
import { shellPaths, shellWrites, noteWork, considerWork } from './work'
import { narrowEmoji, finePointerOk, cellPixels, ghosttyColors, fontState, NERD_PROBE } from './term'
import { fileRefs, refHref, refsIn, openRef } from './refs'
import { allGuards, GUARD_TOOLS, guardIn, loadGuards, noteOutside, guardFor } from './guard'
import { emptyTree, inside, posix, relative, useDrives } from './tree'
import { scrollShortcuts } from './keys'
import { settings, machine, tree, vcs, ui, previewing, pics, working, guarding, grep, zjump } from './state'
import { exists, shortPath, cwdOf, has, strings } from './util'
import { get, patch, setActivities, activities, readConfig, SHIMMER_KEY } from './store'
import { watchTree, sinceNow } from './listing'
import { type Job, gitChanged, headOf, type Pending, startGit, finishGit, failAll, bashOutputOf, outcomes, proven, sync, settleBackground } from './gitstate'
import { scheduleScan, touched, reveal } from './activity'
import { reset, followCwd, settleRoot, applyStart } from './root'
import { picks } from './select'
import { grepOn } from './grep'
import { scrollSplit, scrollPreview } from './preview'
import { readOptions } from './options'
import { onMessage } from './messages'
import { renderPane } from './pane'

const PANE = 'filetree'
const TREE = { plugin: 'filetree', key: 'tree' } as const
const GIT_POLL_MS = 2000
const AGE_TICK_MS = 60_000

let gitPoll: Timer | null = null
let ageTick: Timer | null = null

export const register: Register = (on, options) => {
  readOptions(options)
  on('session.start', async ($, e, next) => {
    settings.noDock = options?.start === 'off'
    guarding.outside = []
    working.workTouches = []
    working.workLast = 0
    guarding.guardsLoaded = null
    void loadGuards($)
    tree.cached ??= { ...emptyTree(''), ...(await $.state.get(TREE)).value }
    await $.command.register({ name: 'filetree', description: 'Show or hide the file tree; args: [path | open | keys] (no path = cwd, open = never hide, keys = bind alt+l / alt+h to move the keys to and from the tree)', immediate: true })
    if (settings.palette.unknown.length) void $.ui.toast(`filetree palette: ignored ${settings.palette.unknown.join(' ')}; use key=#hex with fg, bg, accent, muted, urgent, selection, hover, jump, added, modified, renamed, add or del`)
    const windows = (await $.env.get('OS')) === 'Windows_NT'
    useDrives(windows)
    machine.inTmux = !windows && Boolean(await $.env.get('TMUX'))
    machine.inHerdr = !windows && Boolean(await $.env.get('HERDR_ENV'))
    pics.pictureSession = (await $.session.id()).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64) || 'session'
    pics.pictureBase = ((await $.env.get('XDG_RUNTIME_DIR')) || (await $.env.get('TMPDIR')) || '/tmp').replace(/\/+$/, '') || '/'
    machine.home = posix(((await $.env.get('HOME')) || (await $.env.get('USERPROFILE')) || '').replace(/[\\/]+$/, ''))
    vcs.activityId = Math.max(vcs.activityId, ...(await activities($)).map(a => a.id))
    void (async () => {
      const ready = (async () => {
        machine.pointer = await finePointerOk($)
        const termProgram = await $.env.get('TERM_PROGRAM')
        machine.kittyTerm = !windows && !machine.inTmux && !machine.inHerdr && (termProgram === 'ghostty' || Boolean(await $.env.get('KITTY_WINDOW_ID')) || /kitty|ghostty/.test((await $.env.get('TERM')) ?? ''))
        if (settings.treemapSetting === 'image' || (settings.treemapSetting === 'auto' && machine.kittyTerm)) {
          machine.cellPx = await cellPixels($)
          if (termProgram === 'ghostty') machine.termColors = await ghosttyColors($)
        }
        try {
          const remote = Boolean((await $.env.get('SSH_CONNECTION')) || (await $.env.get('SSH_TTY')))
          machine.noNerd = !remote && (windows || (await fontState($, NERD_PROBE)) !== 'ok')
        } catch {
          machine.noNerd = true
        }
        await readConfig($).catch(() => undefined)
      })()
      const t = await get($)
      if (t.flashOn) await patch($, () => ({ flash: [], flashDim: [], flashOn: false, flashTones: {} }))
      if (t.preview) await patch($, () => ({ preview: '', previewTop: 0 }))
      await setActivities($, cur => cur.map(a => (a.state === 'running' ? { ...a, state: 'failed', label: `${a.kind} interrupted` } : a)))
      const cwd = await cwdOf($)
      const shown = !t.root || t.nodes.length === 0 || (tree.follow && t.root !== cwd) ? reset($, cwd, false, ready) : ready.then(() => (settings.noDock ? undefined : $.ui.open({ id: PANE, title: `Files: ${t.root.split('/').pop() || t.root}` })))
      await ready
      ageTick?.cancel()
      ageTick = settings.showAge ? $.clock.every(AGE_TICK_MS, () => $.ui.invalidate('ui.render')) : null
      gitPoll?.cancel()
      vcs.gitStamp = null
      gitPoll = $.clock.every(GIT_POLL_MS, () => void followCwd($).then(moved => (moved ? undefined : gitChanged($))).then(() => watchTree($)))
      await shown
    })()
    return next(e)
  })

  on('config.set', async ($, e, next) => {
    const result = await next(e)
    if (e.key === 'theme' || SHIMMER_KEY.test(e.key)) await readConfig($).catch(() => undefined)
    return result
  })

  on('command.run', { command: 'filetree' }, async ($, e) => {
    const given = (e.args ?? '').trim()
    if (given === 'keys') return { text: await bindKeys($, machine.home) }
    const mine = given ? undefined : (await $.ui.panes().catch(() => [])).find(p => p.id === PANE)
    if (mine?.isShown) {
      settings.noDock = true
      if (zjump.on) jumpClose($)
      await $.ui.close({ id: PANE }).catch(() => undefined)
      return { text: 'File tree closed.' }
    }
    const terminal = await $.session.surfaces().then(s => s.includes('terminal'), () => true)
    if (terminal && !e.presentation.isFullscreen) return { text: 'filetree shows in the sidebar, which needs the fullscreen layout. Run /tui fullscreen, then /filetree.' }
    if (terminal && e.presentation.columns < 110) return { text: 'filetree shows in the sidebar, which needs a terminal at least 110 columns wide. Widen it, then run /filetree.' }
    settings.noDock = false
    const arg = given === 'open' ? '' : given
    const cwd = await cwdOf($)
    tree.follow = !arg
    const root = arg ? resolve(cwd, arg, machine.home) : cwd
    await reset($, root, settings.focusOnOpen || given !== '' || mine?.isPlaced === true)
    return { text: `File tree on ${shortPath(root)}${tree.follow ? ' (moves with the cwd)' : ''}.` }
  })

  on('tool.call', async ($, e, next) => {
    const tool: string = e.tool
    const shell = tool === 'Bash' || tool === 'PowerShell'
    if (e.tool !== 'Edit' && e.tool !== 'Write' && e.tool !== 'NotebookEdit' && !shell) return next(e)
    const command = shell && has(e, 'command') && typeof e.command === 'string' ? e.command : ''
    const cwd = shell ? await cwdOf($) : ''
    const actions = gitActions(command)
    const quiet = !actions.length && readOnly(command)
    const since = await sinceNow($, shell && !quiet)
    const before = actions.some(a => a.verb === 'commit') ? await get($) : null
    const head = before?.top ? await headOf($, before.root) : ''
    const pending: Pending | null = actions.length ? { actions, ids: await startGit($, actions), command, head } : null
    let result: Awaited<ReturnType<typeof next>>
    try {
      result = await next(e)
    } catch (err) {
      if (pending) await finishGit($, pending, failAll(pending))
      if (since.mark) void $.process.run(['rm', '-f', since.mark], { timeoutMs: 3_000 }).catch(() => undefined)
      throw err
    }
    if (pending && result.deny) {
      const ids = pending.ids
      void setActivities($, cur => cur.filter(a => !ids.includes(a.id)))
    }
    if (result.deny || (result.isError && !shell)) {
      if (since.mark) void $.process.run(['rm', '-f', since.mark], { timeoutMs: 3_000 }).catch(() => undefined)
      return result
    }
    if (shell) {
      const out = bashOutputOf(result.isError ? undefined : result.result)
      const reads = settings.showReads ? readTargets(command, cwd, out.stdout, machine.home) : []
      const job: Job = { actions: [], since, initRepo: actions.some(a => a.init), readOnly: quiet || result.isReadOnly === true }
      if (out.backgroundTaskId) vcs.background.set(out.backgroundTaskId, { p: pending, job, reads })
      else void (async () => {
        const results = pending ? await outcomes($, pending, !result.isError, out.gitOperation) : []
        if (pending) await finishGit($, pending, results)
        vcs.queuedReads.push(...reads)
        scheduleScan($, { ...job, actions: proven(pending, results) })
      })()
      if (tree.follow && /(^|[;&|\s])(cd|pushd|popd)(\s|$)/.test(command)) $.clock.after(400, () => void followCwd($))
      if (!result.isError) void noteWork($, shellPaths(command, cwd, machine.home), shellWrites(command))
    } else {
      const file =
        'file_path' in e && typeof e.file_path === 'string'
          ? e.file_path
          : 'notebook_path' in e && typeof e.notebook_path === 'string'
            ? e.notebook_path
            : ''
      if (file) void touched($, [file], 'orange', settings.showWrites)
      if (file) void noteWork($, [file], true)
      if (file) void noteOutside($, file)
    }
    return result
  })

  on('tool.check', { tool: /^(Edit|Write|NotebookEdit|Bash|PowerShell)$/ }, async ($, e, next) => {
    await loadGuards($)
    const list = allGuards(guarding.guards)
    if (!list.length) return next(e)
    const input = has(e.input, 'file_path') ? e.input.file_path : has(e.input, 'notebook_path') ? e.input.notebook_path : has(e.input, 'command') ? e.input.command : undefined
    if (typeof input !== 'string' || !input) return next(e)
    const cwd = await cwdOf($)
    if ((GUARD_TOOLS as readonly string[]).includes(e.tool)) {
      const path = resolve(cwd, posix(input), machine.home)
      const hit = await guardFor($, path)
      if (!hit) return next(e)
      return { decision: 'deny', reason: `${shortPath(hit)} is guarded in the file tree, so ${e.tool} on ${shortPath(path)} is refused. Leave it alone, or ask the user to unguard it with x in the tree.` }
    }
    const hit = guardIn(input, list, cwd, machine.home)
    if (!hit) return next(e)
    const verdict = await next(e)
    if (verdict.decision === 'deny') return verdict
    return { decision: 'ask', decider: 'person', reason: `This command names ${shortPath(hit)}, which is guarded in the file tree. The check only reads the command text, so it can be a false alarm and can miss a path the command builds itself.` }
  })

  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    const result = await next(e)
    if (result.deny || result.isError || e.tool !== 'Read') return result
    void noteWork($, [posix(e.file_path)], false)
    if (!settings.showReads) return result
    void touched($, [posix(e.file_path)], 'purple', true)
    return result
  })

  for (const tool of [/^Grep$/, /^Glob$/])
    on('tool.call', { tool }, async ($, e, next) => {
      const result = await next(e)
      if (result.deny || result.isError) return result
      const names = strings(has(result.result, 'filenames') ? result.result.filenames : undefined)
      if (names.length === 0) return result
      const cwd = await cwdOf($)
      void noteWork($, names.slice(0, 40).map(f => resolve(cwd, posix(f), machine.home)), false)
      if (!settings.showReads) return result
      void touched($, names.map(f => resolve(cwd, posix(f), machine.home)), 'purple', true)
      return result
    })

  on('turn.start', async (_$, e, next) => {
    if (!e.agentId) working.mainBusy = true
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId) {
      working.mainBusy = false
      void considerWork($)
    }
    return result
  })

  on('ui.message', onMessage)

  on('session.end', async ($, e, next) => {
    tree.cached = null
    guarding.guards = {}
    guarding.guardsLoaded = null
    tree.watcher?.stop()
    tree.watcher = null
    tree.snapshot?.cancel()
    tree.snapshot = null
    const result = await next(e)
    if (pics.sessionDir) {
      const dir = pics.sessionDir
      pics.sessionDir = ''
      pics.pictures.clear()
      await $.process.run(['sh', '-c', CLEAN, 'sh', dir], { timeoutMs: 10_000 }).catch(() => undefined)
    }
    if (e.reason === 'clear' || e.reason === 'resume' || e.reason === 'other') {
      settings.noDock = options?.start === 'off'
      $.clock.after(0, () => void settleRoot($).then(() => applyStart($)))
    }
    return result
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE && zjump.on) jumpClose($)
    if (e.id === PANE) {
      ui.shortcutsShown = settings.shortcutsSetting === 'always'
      ui.shortcutsTop = 0
    }
    return next(e)
  })

  on('ui.focus', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (zjump.on && e.origin.kind === 'person' && (e.element === 'jump-up' || e.element === 'jump-down')) {
      await jumpKey($, e.element === 'jump-up' ? 'up' : 'down')
      return {}
    }
    const result = await next(e)
    void sync($)
    return result
  })

  on('ui.scroll', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (ui.nativeScroll) return next(e)
    const t = await get($)
    if (t.preview) {
      await scrollPreview($, Math.sign(e.by) * Math.max(3, Math.abs(e.by)))
      return {}
    }
    if (t.split && previewing.overPeek) {
      scrollSplit($, previewing.peekTop + Math.sign(e.by) * Math.max(3, Math.abs(e.by)))
      return {}
    }
    if (ui.shortcutsShown && !zjump.on) {
      scrollShortcuts($, Math.sign(e.by) * Math.max(3, Math.abs(e.by)))
      return {}
    }
    if (grepOn(t) && grep.rows.length) {
      grep.sel = Math.max(0, Math.min(grep.rows.length - 1, grep.sel + Math.sign(e.by) * Math.max(3, Math.abs(e.by))))
      void $.ui.invalidate('ui.render')
      const row = grep.rows[grep.sel]
      if (row) await patch($, () => ({ selected: row.path }))
      return {}
    }
    const to = Math.max(0, Math.min(ui.view.max, (t.scroll ?? ui.view.from) + Math.sign(e.by) * Math.max(3, Math.abs(e.by))))
    if (to !== t.scroll) await patch($, () => ({ scroll: to }))
    return {}
  })

  on('prompt.submit', async ($, e, next) => {
    void settleBackground($, e.text)
    if (!(await followCwd($))) void sync($)
    const t = await get($)
    const context = [...(e.context ?? [])]
    const picked = picks(t)
    const live = (await Promise.all(picked.ids.map(async p => ((await exists($, p)) ? p : '')))).filter(Boolean)
    if (picked.marked && live.length) context.push(`The user has marked these entries in the file tree; "these" or "them" in the prompt likely refers to them:\n${live.join('\n')}`)
    else if (!picked.marked && live[0]) context.push(`The user has this file selected in the file tree; "this" or "it" in the prompt likely refers to it: ${live[0]}`)
    const mentions = [...e.text.matchAll(/@([^\s"'`]+)/g)]
      .map(m => (m[1] ?? '').replace(/[.,;:!?)]+$/, ''))
      .filter(Boolean)
      .map(p => resolve(t.root, p, machine.home))
      .filter(p => inside(t.root, p))
    if (mentions.length) {
      void (async () => {
        const found: string[] = []
        for (const p of mentions) {
          try {
            await $.fs.stat(p)
            found.push(p.replace(/\/$/, ''))
          } catch {
            continue
          }
        }
        if (found.length) await reveal($, found)
      })()
    }
    return next(context.length ? { ...e, context } : e)
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const narrow = e.component === 'AssistantMessage' && e.surface === 'terminal' ? narrowEmoji(e.props.text) : null
    const drawn = await next(narrow !== null && e.component === 'AssistantMessage' && narrow !== e.props.text ? { ...e, props: { ...e.props, text: narrow } } : e)
    if (e.component !== 'AssistantMessage' || e.props.isSummary || (e.surface !== 'terminal' && e.surface !== 'desktop') || !fileRefs(e.props.text).length) return drawn
    const t = await get($)
    if (!t.root) return drawn
    const refs = await refsIn($, e.props.text, t.root, await cwdOf($))
    if (!refs.length) return drawn
    const { Box, Markdown } = $.ui.resolve(e)
    const links = refs.map(r => ({ href: refHref(r), label: `${relative(t.root, r.path)}:${r.line}${r.end > r.line ? `-${r.end}` : ''}` }))
    return (
      <Box flexDirection="column">
        {drawn}
        <Markdown key="filetree-refs" dimColor text={`in the file tree: ${links.map(l => `[${l.label.replace(/[[\]]/g, '\\$&')}](${l.href})`).join('  ')}`} pressableLinks={links.map(l => l.href)} onLinkPress={(link, p) => void openRef($, link.href, p.surface)} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (e.surface !== 'terminal' && e.surface !== 'desktop') return next(e)
    return renderPane($, e)
  })
}
