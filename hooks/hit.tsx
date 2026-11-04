import type { ClientModule } from 'claude-code'

export type HitProps = { id: string; keys?: false }
type Local = { ref: { id: string; unpoint?: () => void; unkey?: () => void; untick?: () => void } }

let active: string | null = null
let last = { key: '', at: 0 }
const alive = new Map<string, number>()

const Hit: ClientModule<HitProps, Local> = (props, surface) => {
  const { Box } = surface.elements
  let state = surface.state
  if (state === undefined) {
    const fresh = { ref: { id: props.id } }
    state = fresh
    surface.setState(state)
  }
  const ref = state.ref
  ref.id = props.id
  ref.unpoint ??= surface.onPointer(e => {
    if (e.type === 'down' && props.keys !== false) {
      active = ref.id
      alive.set(ref.id, Date.now())
      ref.untick ??= surface.every(500, () => alive.set(ref.id, Date.now()))
    }
    if (e.type === 'down' && e.button === 'right') surface.post({ copy: ref.id, shift: Boolean(e.shift) })
    else if (e.type === 'up' && (e.button ?? 'left') === 'left') surface.post({ press: ref.id, ctrl: Boolean(e.ctrl), shift: Boolean(e.shift) })
  })
  if (props.keys !== false) ref.unkey ??= surface.onKey(e => {
    const now = Date.now()
    if (active !== null && active !== ref.id) {
      if (now - (alive.get(active) ?? 0) < 1500) return
      active = null
    }
    const key = `${e.key}${e.ctrl ? '^' : ''}${e.shift ? '+' : ''}`
    if (active === null && last.key === key && now - last.at < 15) return
    last = { key, at: now }
    active = ref.id
    alive.set(ref.id, now)
    surface.post({ key: e.key, ctrl: Boolean(e.ctrl), shift: Boolean(e.shift) })
  })
  return <Box width="100%" height="100%" />
}

export default Hit
