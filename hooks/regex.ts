type Test = (c: string) => boolean
type Node =
  | { t: 'char'; test: Test }
  | { t: 'cat'; a: Node[] }
  | { t: 'alt'; a: Node[] }
  | { t: 'rep'; n: Node; min: number; max: number }
  | { t: 'bol' }
  | { t: 'eol' }
type Op =
  | { op: 'char'; test: Test }
  | { op: 'split'; x: number; y: number }
  | { op: 'jmp'; x: number }
  | { op: 'bol' }
  | { op: 'eol' }
  | { op: 'match' }

export const MAX_PROGRAM = 2000
const MAX_REPEAT = 100
const MAX_WORK = 20000

class Unsupported extends Error {}

const DIGIT: Test = c => c >= '0' && c <= '9'
const WORD: Test = c => DIGIT(c) || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_'
const SPACE: Test = c => /\s/.test(c)
const LITERAL_ESCAPES: Record<string, string> = { t: '\t', n: '\n', r: '\r', f: '\f', v: '\v', '0': '\0' }

function classEscape(e: string): Test | null {
  if (e === 'd') return DIGIT
  if (e === 'D') return c => !DIGIT(c)
  if (e === 'w') return WORD
  if (e === 'W') return c => !WORD(c)
  if (e === 's') return SPACE
  if (e === 'S') return c => !SPACE(c)
  return null
}

function literalEscape(e: string): string {
  if (e in LITERAL_ESCAPES) return LITERAL_ESCAPES[e] ?? e
  if (/[A-Za-z0-9]/.test(e)) throw new Unsupported(`\\${e}`)
  return e
}

function parse(src: string, ci: boolean): Node {
  const same = (lit: string): Test => (ci ? c => c.toLowerCase() === lit.toLowerCase() : c => c === lit)
  let i = 0
  const peek = () => src[i]
  const alt = (): Node => {
    const a = [cat()]
    while (peek() === '|') {
      i += 1
      a.push(cat())
    }
    return a.length === 1 ? (a[0] as Node) : { t: 'alt', a }
  }
  const cat = (): Node => {
    const a: Node[] = []
    while (i < src.length && peek() !== '|' && peek() !== ')') a.push(quantified())
    return { t: 'cat', a }
  }
  const bound = (): [number, number] | null => {
    const m = /^\{(\d+)(,(\d*))?\}/.exec(src.slice(i))
    if (!m) return null
    const min = Number(m[1])
    const max = m[2] === undefined ? min : m[3] === '' ? Infinity : Number(m[3])
    if (min > MAX_REPEAT || (max !== Infinity && max > MAX_REPEAT) || max < min) throw new Unsupported('repeat')
    i += m[0].length
    return [min, max]
  }
  const quantified = (): Node => {
    const n = atom()
    const c = peek()
    let range: [number, number] | null = null
    if (c === '*') range = [0, Infinity]
    else if (c === '+') range = [1, Infinity]
    else if (c === '?') range = [0, 1]
    if (range) i += 1
    else if (c === '{') range = bound()
    if (!range) return n
    if (n.t === 'bol' || n.t === 'eol') throw new Unsupported('quantified anchor')
    if (peek() === '?') i += 1
    const after = peek()
    if (after === '*' || after === '+' || after === '?' || (after === '{' && /^\{\d+(,\d*)?\}/.test(src.slice(i)))) throw new Unsupported('nothing to repeat')
    return { t: 'rep', n, min: range[0], max: range[1] }
  }
  const klass = (): Node => {
    i += 1
    let negate = false
    if (peek() === '^') {
      negate = true
      i += 1
    }
    const parts: Test[] = []
    const one = (): string | Test => {
      const c = src[i]
      if (c === undefined) throw new Unsupported('class')
      i += 1
      if (c !== '\\') return c
      const e = src[i]
      if (e === undefined) throw new Unsupported('escape')
      i += 1
      return classEscape(e) ?? literalEscape(e === 'b' ? '\b' : e)
    }
    while (i < src.length && src[i] !== ']') {
      const lo = one()
      if (typeof lo === 'string' && src[i] === '-' && src[i + 1] !== undefined && src[i + 1] !== ']') {
        i += 1
        const hi = one()
        if (typeof hi !== 'string' || hi < lo) throw new Unsupported('range')
        parts.push(c => c >= lo && c <= hi)
      } else parts.push(typeof lo === 'string' ? c => c === lo : lo)
    }
    if (src[i] !== ']') throw new Unsupported('class')
    i += 1
    const any: Test = ci ? c => parts.some(p => p(c) || p(c.toLowerCase()) || p(c.toUpperCase())) : c => parts.some(p => p(c))
    return { t: 'char', test: negate ? c => !any(c) : any }
  }
  const atom = (): Node => {
    const c = peek()
    if (c === undefined) throw new Unsupported('end')
    if (c === '(') {
      i += 1
      if (peek() === '?') {
        if (src[i + 1] !== ':') throw new Unsupported('group')
        i += 2
      }
      const n = alt()
      if (peek() !== ')') throw new Unsupported('group')
      i += 1
      return n
    }
    if (c === ')') throw new Unsupported('paren')
    if (c === '[') return klass()
    if (c === '*' || c === '+' || c === '?') throw new Unsupported('nothing to repeat')
    if (c === '{' && bound()) throw new Unsupported('nothing to repeat')
    i += 1
    if (c === '^') return { t: 'bol' }
    if (c === '$') return { t: 'eol' }
    if (c === '.') return { t: 'char', test: ch => ch !== '\n' && ch !== '\r' && ch !== ' ' && ch !== ' ' }
    if (c === '\\') {
      const e = src[i]
      if (e === undefined) throw new Unsupported('escape')
      i += 1
      const set = classEscape(e)
      if (set) return { t: 'char', test: set }
      const lit = literalEscape(e)
      return { t: 'char', test: same(lit) }
    }
    return { t: 'char', test: same(c) }
  }
  const tree = alt()
  if (i !== src.length) throw new Unsupported('trailing')
  return tree
}

function compile(node: Node): Op[] {
  const prog: Op[] = []
  const emit = (op: Op) => {
    if (prog.length >= MAX_PROGRAM) throw new Unsupported('too large')
    prog.push(op)
    return prog.length - 1
  }
  let work = 0
  const empty = (n: Node): boolean => n.t === 'cat' ? n.a.every(empty) : n.t === 'alt' ? n.a.every(empty) : n.t === 'rep' ? n.max === 0 || empty(n.n) : false
  const gen = (n: Node): void => {
    if (++work > MAX_WORK) throw new Unsupported('too complex')
    if (n.t === 'rep' && (n.max === 0 || (empty(n.n) && n.n.t !== 'bol' && n.n.t !== 'eol'))) return
    if (n.t === 'char') emit({ op: 'char', test: n.test })
    else if (n.t === 'bol') emit({ op: 'bol' })
    else if (n.t === 'eol') emit({ op: 'eol' })
    else if (n.t === 'cat') for (const x of n.a) gen(x)
    else if (n.t === 'alt') {
      const jumps: number[] = []
      n.a.forEach((x, k) => {
        if (k === n.a.length - 1) {
          gen(x)
          return
        }
        const split = emit({ op: 'split', x: 0, y: 0 })
        gen(x)
        jumps.push(emit({ op: 'jmp', x: 0 }))
        prog[split] = { op: 'split', x: split + 1, y: prog.length }
      })
      for (const j of jumps) prog[j] = { op: 'jmp', x: prog.length }
    } else {
      for (let k = 0; k < n.min; k++) gen(n.n)
      if (n.max === Infinity) {
        const split = emit({ op: 'split', x: 0, y: 0 })
        gen(n.n)
        emit({ op: 'jmp', x: split })
        prog[split] = { op: 'split', x: split + 1, y: prog.length }
      } else {
        const splits: number[] = []
        for (let k = n.min; k < n.max; k++) {
          splits.push(emit({ op: 'split', x: 0, y: 0 }))
          gen(n.n)
        }
        for (const s of splits) prog[s] = { op: 'split', x: s + 1, y: prog.length }
      }
    }
  }
  gen(node)
  emit({ op: 'match' })
  return prog
}

function run(prog: Op[], text: string): boolean {
  const seen = new Int32Array(prog.length).fill(-1)
  let mark = 0
  const add = (into: number[], pc0: number, at: number): boolean => {
    const stack = [pc0]
    while (stack.length) {
      const pc = stack.pop() as number
      if (seen[pc] === mark) continue
      seen[pc] = mark
      const op = prog[pc]
      if (!op) continue
      if (op.op === 'match') return true
      if (op.op === 'jmp') stack.push(op.x)
      else if (op.op === 'split') stack.push(op.y, op.x)
      else if (op.op === 'bol') {
        if (at === 0) stack.push(pc + 1)
      } else if (op.op === 'eol') {
        if (at === text.length) stack.push(pc + 1)
      } else into.push(pc)
    }
    return false
  }
  let list: number[] = []
  if (add(list, 0, 0)) return true
  for (let at = 0; at < text.length; at++) {
    const c = text[at] as string
    mark += 1
    const next: number[] = []
    for (const pc of list) {
      const op = prog[pc]
      if (op?.op === 'char' && op.test(c) && add(next, pc + 1, at + 1)) return true
    }
    if (add(next, 0, at + 1)) return true
    list = next
  }
  return false
}

export function compileRegex(src: string, ignoreCase: boolean): ((text: string) => boolean) | null {
  try {
    const prog = compile(parse(src, ignoreCase))
    return text => run(prog, text)
  } catch (err) {
    if (err instanceof Unsupported) return null
    throw err
  }
}
