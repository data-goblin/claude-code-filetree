import type { ClientModule, ClientPointerEvent } from 'claude-code'

export type HitProps = { id: string; keys?: false }
export type HitsProps = { gen: number; rows: number }
type Props = HitProps | HitsProps
type Act = Record<string, string | number | boolean>
type Local = { ref: { self: string; props: Props; hover: number; hoverGen: number; seq: number; last?: Act; unpoint?: () => void; unkey?: () => void; untick?: () => void } }

let active: string | null = null
let last = { key: '', at: 0 }
let seq = 0
const boot = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
const alive = new Map<string, number>()

const isHits = (p: Props): p is HitsProps => 'gen' in p

const Hit: ClientModule<Props, Local> = (props, surface) => {
  const { Box } = surface.elements
  let state = surface.state
  if (state === undefined) {
    const fresh = { ref: { self: isHits(props) ? `\u0000hits:${boot}:${++seq}` : props.id, props, hover: -1, hoverGen: 0, seq: 0 } }
    state = fresh
    surface.setState(state)
  }
  const ref = state.ref
  ref.props = props
  if (!isHits(props)) ref.self = props.id
  const keys = isHits(props) || props.keys !== false
  const rowAt = (p: HitsProps, e: ClientPointerEvent): number => {
    const span = surface.rows > 0 ? surface.rows : p.rows
    const at = Math.floor(((e.fine?.y ?? e.y + 0.5) * p.rows) / span)
    return at >= 0 && at < p.rows ? at : -1
  }
  const act = (data: Act, at: number, gen: number) => {
    ref.hover = at
    ref.hoverGen = gen
    ref.last = { ...data, at, gen, seq: ++ref.seq, self: ref.self }
    surface.post({ ...ref.last, hover: at, hgen: gen })
  }
  ref.unpoint ??= surface.onPointer(e => {
    const p = ref.props
    if (isHits(p)) {
      const at = e.type === 'leave' ? -1 : rowAt(p, e)
      if ((e.type === 'move' && !e.button) || e.type === 'leave') {
        if (at !== ref.hover || (at >= 0 && p.gen !== ref.hoverGen)) {
          ref.hover = at
          ref.hoverGen = p.gen
          surface.post({ ...ref.last, hover: at, hgen: p.gen })
        }
        return
      }
      if (e.type === 'down' && keys) {
        active = ref.self
        alive.set(ref.self, Date.now())
        ref.untick ??= surface.every(500, () => alive.set(ref.self, Date.now()))
      }
      if (at < 0) return
      if (e.type === 'down' && e.button === 'right') act({ copy: true, shift: Boolean(e.shift) }, at, p.gen)
      else if (e.type === 'up' && (e.button ?? 'left') === 'left') act({ press: true, ctrl: Boolean(e.ctrl), shift: Boolean(e.shift) }, at, p.gen)
      return
    }
    if (e.type === 'down' && keys) {
      active = ref.self
      alive.set(ref.self, Date.now())
      ref.untick ??= surface.every(500, () => alive.set(ref.self, Date.now()))
    }
    if (e.type === 'down' && e.button === 'right') surface.post({ copy: p.id, shift: Boolean(e.shift) })
    else if (e.type === 'up' && (e.button ?? 'left') === 'left') surface.post({ press: p.id, ctrl: Boolean(e.ctrl), shift: Boolean(e.shift) })
  })
  if (keys) ref.unkey ??= surface.onKey(e => {
    const now = Date.now()
    if (active !== null && active !== ref.self) {
      if (now - (alive.get(active) ?? 0) < 1500) return
      active = null
    }
    const key = `${e.key}${e.ctrl ? '^' : ''}${e.shift ? '+' : ''}`
    if (active === null && last.key === key && now - last.at < 15) return
    last = { key, at: now }
    active = ref.self
    alive.set(ref.self, now)
    surface.post({ key: e.key, ctrl: Boolean(e.ctrl), shift: Boolean(e.shift) })
  })
  return <Box width="100%" height="100%" />
}

export default Hit
