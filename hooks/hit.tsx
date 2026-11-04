import type { ClientModule } from 'claude-code'

export type HitProps = { id: string }
type Local = { ref: { id: string; unpoint?: () => void; unkey?: () => void } }

let active: string | null = null
let last = { key: '', at: 0 }

const Hit: ClientModule<HitProps, Local> = (props, surface) => {
  const { Box } = surface.elements
  let state = surface.state
  if (state === undefined) {
    state = { ref: { id: props.id } }
    surface.setState(state)
  }
  const ref = state.ref
  ref.id = props.id
  ref.unpoint ??= surface.onPointer(e => {
    if (e.type === 'down') active = ref.id
    if (e.type === 'down' && e.button === 'right') surface.post({ copy: ref.id, shift: Boolean(e.shift) })
    else if (e.type === 'up' && (e.button ?? 'left') === 'left') surface.post({ press: ref.id, ctrl: Boolean(e.ctrl), shift: Boolean(e.shift) })
  })
  ref.unkey ??= surface.onKey(e => {
    if (active !== null && active !== ref.id) return
    const now = Date.now()
    const key = `${e.key}${e.ctrl ? '^' : ''}${e.shift ? '+' : ''}`
    if (active === null && last.key === key && now - last.at < 15) return
    last = { key, at: now }
    surface.post({ key: e.key, ctrl: Boolean(e.ctrl), shift: Boolean(e.shift) })
  })
  return <Box width="100%" height="100%" />
}

export default Hit
