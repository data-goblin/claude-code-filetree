import type { EngineInterface } from 'claude-code'

export type KeyWant = { readonly context: string; readonly key: string; readonly action: string; readonly shadows?: readonly string[] }

export const FOCUS_KEYS: readonly KeyWant[] = [
  { context: 'Chat', key: 'meta+l', action: 'abovePrompt:focus', shadows: ['Global'] },
  { context: 'Pane', key: 'meta+h', action: 'abovePrompt:leave' },
  { context: 'PaneField', key: 'meta+h', action: 'abovePrompt:leave' },
]

type Block = { context: string; bindings: Record<string, unknown> }

const shown = (v: unknown): string => typeof v === 'string' ? v : JSON.stringify(v)

export type KeyClash = KeyWant & { readonly where: string; readonly spelled: string; readonly bound: string }

export type KeyPlan =
  | { readonly kind: 'invalid'; readonly reason: string }
  | { readonly kind: 'done' }
  | { readonly kind: 'change'; readonly add: readonly KeyWant[]; readonly clash: readonly KeyClash[]; readonly merge: (replace: boolean) => string }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const ALIASES: Record<string, string> = { alt: 'meta', option: 'meta', opt: 'meta', control: 'ctrl' }

export const sameKey = (a: string, b: string): boolean => {
  const norm = (k: string) =>
    k
      .toLowerCase()
      .split(' ')
      .map(chord => {
        const parts = chord.split('+').map(p => ALIASES[p] ?? p)
        const last = parts.pop() ?? ''
        return [...parts.sort(), last].join('+')
      })
      .join(' ')
  return norm(a) === norm(b)
}

export const indentOf = (text: string | undefined): string | number => {
  const lead = /\n([ \t]+)\S/.exec(text ?? '')?.[1]
  if (!lead) return 2
  return lead.startsWith('\t') ? '\t' : lead.length
}

const boundIn = (blocks: readonly Block[], context: string, key: string): [string, unknown] | undefined =>
  blocks
    .filter(b => b.context === context)
    .flatMap(b => Object.entries(b.bindings).filter(([k]) => sameKey(k, key)))
    .pop()

export const planKeys = (text: string | undefined, wants: readonly KeyWant[] = FOCUS_KEYS): KeyPlan => {
  let doc: Record<string, unknown> = {}
  if (text !== undefined && text.trim() !== '') {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (err) {
      return { kind: 'invalid', reason: `not valid JSON (${err instanceof Error ? err.message : String(err)})` }
    }
    if (!isRecord(parsed)) return { kind: 'invalid', reason: 'the top level is not a JSON object' }
    doc = parsed
  }
  const raw = doc.bindings ?? []
  if (!Array.isArray(raw)) return { kind: 'invalid', reason: '"bindings" is not an array' }
  if (!raw.every(b => isRecord(b) && typeof b.context === 'string' && isRecord(b.bindings))) return { kind: 'invalid', reason: 'a "bindings" entry lacks a string "context" or a "bindings" object' }
  const blocks = raw as Block[]
  const add: KeyWant[] = []
  const clash: KeyClash[] = []
  for (const want of wants) {
    const own = boundIn(blocks, want.context, want.key)
    if (own) {
      if (own[1] !== want.action) clash.push({ ...want, where: want.context, spelled: own[0], bound: own[1] === null ? 'null (unbound)' : shown(own[1]) })
      continue
    }
    const shadow = (want.shadows ?? []).map(context => ({ context, found: boundIn(blocks, context, want.key) })).find(s => s.found && s.found[1] !== null && s.found[1] !== want.action)
    if (shadow?.found) clash.push({ ...want, where: shadow.context, spelled: shadow.found[0], bound: shown(shadow.found[1]) })
    else add.push(want)
  }
  if (add.length === 0 && clash.length === 0) return { kind: 'done' }
  const merge = (replace: boolean): string => {
    const next = blocks.map(b => ({ ...b, bindings: { ...b.bindings } }))
    for (const want of [...add, ...(replace ? clash : [])]) {
      for (const b of next) if (b.context === want.context) for (const k of Object.keys(b.bindings)) if (sameKey(k, want.key)) delete b.bindings[k]
      const home = next.filter(b => b.context === want.context).pop()
      if (home) home.bindings[want.key] = want.action
      else next.push({ context: want.context, bindings: { [want.key]: want.action } })
    }
    return `${JSON.stringify({ ...doc, bindings: next }, null, indentOf(text))}\n`
  }
  return { kind: 'change', add, clash, merge }
}

type Place = { readonly path: string; readonly atomic: boolean }

async function placeKeys($: EngineInterface, path: string): Promise<Place | { readonly refused: string }> {
  const own = await $.fs.stat(path, { resolve: true }).catch(() => undefined)
  if (!own) return { path, atomic: false }
  const target = own.realPath
  if (!target) return { refused: `cannot resolve where ${path} leads` }
  if (own.kind !== 'file') return { refused: `${target} is not a regular file` }
  if ((await $.env.get('OS')) === 'Windows_NT') return { path: target, atomic: false }
  if ((await $.process.run(['test', '-w', target])).exitCode !== 0) return { refused: `${target} is read-only` }
  return { path: target, atomic: true }
}

async function writeKeys($: EngineInterface, place: Place, text: string): Promise<string | undefined> {
  if (!place.atomic) {
    await $.fs.write(place.path, text)
    return undefined
  }
  const tmp = `${place.path}.filetree-${Date.now()}.tmp`
  try {
    await $.fs.write(tmp, text)
    await $.process.run(['chmod', '--reference', place.path, tmp]).catch(() => undefined)
    const moved = await $.process.run(['mv', '-f', tmp, place.path])
    return moved.exitCode === 0 ? undefined : `could not replace ${place.path}: ${moved.stderr.trim()}`
  } finally {
    await $.process.run(['rm', '-f', tmp]).catch(() => undefined)
  }
}

const KEEP = 'Keep mine'
const REPLACE = 'Replace'
const FREE = 'Add the free ones only'
const ADD = 'Add them'

export async function bindKeys($: EngineInterface, home: string): Promise<string> {
  const dir = (await $.env.get('CLAUDE_CONFIG_DIR')) || `${home}/.claude`
  const path = `${dir.replace(/[\\/]+$/, '')}/keybindings.json`
  const text = (await $.fs.exists(path)) ? await $.fs.read(path).catch(() => null) : undefined
  if (text === null) return `Could not read ${path}; nothing changed.`
  const plan = planKeys(text)
  if (plan.kind === 'invalid') return `${path} is ${plan.reason}; fix it and run /filetree keys again. Nothing changed.`
  if (plan.kind === 'done') return 'Already set: in the terminal, alt+l moves the keys to the file tree and alt+h (or Escape) gives them back. The Desktop app does not read keybindings.json; click the tree there.'
  const place = await placeKeys($, path)
  if ('refused' in place) return `Did not write: ${place.refused}. Nothing changed.`
  const adds = plan.add.map(w => `${w.context} ${w.key}`).join(', ')
  const ask = async (q: string, o: string[]) => $.ui.ask(q, { header: 'filetree', options: o }).catch(() => '')
  let replace = false
  if (plan.clash.length > 0) {
    const clashes = plan.clash.map(w => `${w.where} ${w.spelled} is ${w.bound}`).join(', ')
    const pick = await ask(`${clashes}. Replace with the file tree keys${adds ? ` and add ${adds}` : ''} in ${path}?`, adds ? [REPLACE, KEEP, FREE] : [REPLACE, KEEP])
    if (pick === REPLACE) replace = true
    else if (!(adds && pick === FREE)) return `Kept your bindings; nothing changed in ${path}.`
  } else {
    const pick = await ask(`Add ${adds} to ${path}, so alt+l moves the keys to the file tree and alt+h gives them back?`, [ADD, 'Cancel'])
    if (pick !== ADD) return `Cancelled; nothing changed in ${path}.`
  }
  const now = (await $.fs.exists(path)) ? await $.fs.read(path).catch(() => null) : undefined
  if (now !== text) return `${path} changed while you were asked; run /filetree keys again. Nothing changed.`
  const refused = await writeKeys($, place, plan.merge(replace)).catch((err: unknown) => (err instanceof Error ? err.message : String(err)))
  if (refused) return `Did not write: ${refused}.`
  return `Wrote ${path}: alt+l moves the keys to the file tree, alt+h (or Escape) gives them back in the terminal; the Desktop app does not read keybindings.json. Claude Code picks the change up within about 3 seconds.`
}
