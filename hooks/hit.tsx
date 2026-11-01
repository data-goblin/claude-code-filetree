import type { ClientModule } from 'claude-code'

export type HitProps = { id: string }
type Local = { ref: { id: string; unpoint?: () => void; unkey?: () => void } }

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
    if (e.type === 'down' && e.button === 'right') surface.post({ copy: ref.id, shift: Boolean(e.shift) })
    else if (e.type === 'up' && (e.button ?? 'left') === 'left') surface.post({ press: ref.id, ctrl: Boolean(e.ctrl), shift: Boolean(e.shift) })
  })
  ref.unkey ??= surface.onKey(e => surface.post({ key: e.key, ctrl: Boolean(e.ctrl), shift: Boolean(e.shift) }))
  return <Box width="100%" height="100%" />
}

export default Hit
