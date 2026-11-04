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

function run(prog: Op[], text: string, work: { left: number }): boolean {
  const seen = new Int32Array(prog.length).fill(-1)
  let mark = 0
  const add = (into: number[], pc0: number, at: number): boolean => {
    const stack = [pc0]
    while (stack.length) {
      const pc = stack.pop() as number
      if (seen[pc] === mark) continue
      seen[pc] = mark
      if (--work.left < 0) return false
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
    if (work.left < 0) return false
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

function longest(prog: Op[], text: string, from: number, work: { left: number }): number {
  const seen = new Int32Array(prog.length).fill(-1)
  let mark = 0
  let best = -1
  const add = (into: number[], pc0: number, at: number): void => {
    const stack = [pc0]
    while (stack.length) {
      const pc = stack.pop() as number
      if (seen[pc] === mark) continue
      seen[pc] = mark
      if (--work.left < 0) return
      const op = prog[pc]
      if (!op) continue
      if (op.op === 'match') best = Math.max(best, at)
      else if (op.op === 'jmp') stack.push(op.x)
      else if (op.op === 'split') stack.push(op.y, op.x)
      else if (op.op === 'bol') {
        if (at === 0) stack.push(pc + 1)
      } else if (op.op === 'eol') {
        if (at === text.length) stack.push(pc + 1)
      } else into.push(pc)
    }
  }
  let list: number[] = []
  add(list, 0, from)
  for (let at = from; at < text.length && list.length; at++) {
    if (--work.left < 0) return -1
    const c = text[at] as string
    mark += 1
    const next: number[] = []
    for (const pc of list) {
      const op = prog[pc]
      if (op?.op === 'char' && op.test(c)) add(next, pc + 1, at + 1)
      if (work.left < 0) return -1
    }
    list = next
  }
  return work.left < 0 ? -1 : best
}

const SPAN_WORK = 20_000
const SPAN_POOL = 200_000
const SPAN_WINDOW_MS = 250
const spanPool = { left: SPAN_POOL, at: 0 }
let spanMemo: { key: string; fn: ((text: string) => [number, number][]) | null } | null = null

export function compileSpans(src: string, ignoreCase: boolean): ((text: string) => [number, number][]) | null {
  const key = `${ignoreCase ? 'i' : 'c'}${src}`
  if (spanMemo?.key === key) return spanMemo.fn
  const fn = buildSpans(src, ignoreCase)
  spanMemo = { key, fn }
  spanPool.left = SPAN_POOL
  spanPool.at = Date.now()
  return fn
}

function buildSpans(src: string, ignoreCase: boolean): ((text: string) => [number, number][]) | null {
  try {
    const prog = compile(parse(src, ignoreCase))
    return text => {
      const out: [number, number][] = []
      const now = Date.now()
      if (now - spanPool.at > SPAN_WINDOW_MS) {
        spanPool.left = SPAN_POOL
        spanPool.at = now
      }
      const grant = Math.min(SPAN_WORK, spanPool.left)
      const work = { left: grant }
      for (let at = 0; at < text.length && work.left > 0; ) {
        const end = longest(prog, text, at, work)
        if (end > at) {
          out.push([at, end])
          at = end
        } else at += 1
      }
      spanPool.left -= grant - Math.max(0, work.left)
      return out
    }
  } catch (err) {
    if (err instanceof Unsupported) return null
    throw err
  }
}

export function compileRegex(src: string, ignoreCase: boolean, work: { left: number } = { left: Infinity }): ((text: string) => boolean) | null {
  try {
    const prog = compile(parse(src, ignoreCase))
    return text => run(prog, text, work)
  } catch (err) {
    if (err instanceof Unsupported) return null
    throw err
  }
}

const ERE_SPECIAL = '.[]()*+?{}|^$\\'
const ERE_OUT: Record<string, string> = { d: '[0-9]', D: '[^0-9]', w: '[0-9A-Za-z_]', W: '[^0-9A-Za-z_]', S: '[^ \t\r\f\v]' }
const ERE_IN: Record<string, string> = { d: '0-9', w: '0-9A-Za-z_' }
const ERE_TEXT: Record<string, string> = { t: '\t', r: '\r', f: '\f', v: '\v' }
const PLAIN = /^[ -~]$/

function ereClass(src: string, i: number): { ere: string; next: number } | null {
  let j = i + 1
  let head = '['
  if (src[j] === '^') {
    head += '^'
    j += 1
  }
  if (src[j] === ']') return null
  const toks: { ch?: string; set?: string; dash?: boolean }[] = []
  while (j < src.length && src[j] !== ']') {
    const c = src[j] ?? ''
    if (c === '\\') {
      const e = src[j + 1]
      if (e === undefined) return null
      j += 2
      if (e in ERE_IN) toks.push({ set: ERE_IN[e] })
      else if (/[A-Za-z0-9]/.test(e) || ']\\-^['.includes(e) || !PLAIN.test(e)) return null
      else toks.push({ ch: e })
      continue
    }
    if (c === '[' || c === '^' || !PLAIN.test(c)) return null
    toks.push(c === '-' ? { dash: true } : { ch: c })
    j += 1
  }
  if (src[j] !== ']') return null
  let body = ''
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k] ?? {}
    const hi = toks[k + 2]
    if (t.set !== undefined) body += t.set
    else if (t.dash) {
      if (k !== 0 && k !== toks.length - 1) return null
    } else if (toks[k + 1]?.dash && hi?.ch !== undefined) {
      body += `${t.ch}-${hi.ch}`
      k += 2
    } else body += t.ch
  }
  if (toks[0]?.dash || toks[toks.length - 1]?.dash) body += '-'
  return { ere: `${head}${body}]`, next: j + 1 }
}

export function toEre(src: string): string | null {
  if (/[^\x00-\x7f]/.test(src)) return null
  let out = ''
  let quant = false
  let empty = true
  for (let i = 0; i < src.length; i++) {
    const c = src[i] ?? ''
    if (c === '\\') {
      const e = src[i + 1]
      if (e === undefined) return null
      i += 1
      if (e in ERE_OUT) {
        if (ERE_OUT[e]?.startsWith('[^')) return null
        out += ERE_OUT[e]
      }
      else if (e in ERE_TEXT) out += ERE_TEXT[e]
      else if (ERE_SPECIAL.includes(e)) out += `\\${e}`
      else if (PLAIN.test(e) && !/[A-Za-z0-9]/.test(e)) out += e
      else return null
      quant = false
      empty = false
      continue
    }
    if (c === '[') {
      const cls = ereClass(src, i)
      if (!cls || cls.ere.startsWith('[^')) return null
      out += cls.ere
      i = cls.next - 1
      quant = false
      empty = false
      continue
    }
    if (c === '(') {
      if (src[i + 1] === '?') {
        if (src[i + 2] !== ':') return null
        i += 2
      }
      out += '('
      quant = false
      empty = true
      continue
    }
    if (c === '|' || c === ')') {
      if (empty) return null
      out += c
      quant = false
      empty = c === '|'
      continue
    }
    if (c === '*' || c === '+' || c === '?') {
      if (quant && c === '?') {
        quant = false
        continue
      }
      if (empty) return null
      out += c
      quant = true
      continue
    }
    if (c === '{') {
      const m = /^\{\d+(,\d*)?\}/.exec(src.slice(i))
      if (m && !empty) {
        out += m[0]
        i += m[0].length - 1
        quant = true
        continue
      }
      out += '\\{'
    } else if (c === '\n' || c === '\0' || c === '.') return null
    else out += c
    quant = false
    empty = false
  }
  return empty ? null : out
}
