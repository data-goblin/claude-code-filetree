import type { ClientModule } from 'claude-code'

export type ButtonProps = { id: string; label: string; dim: boolean; color?: string }

const HeaderButton: ClientModule<ButtonProps, { over: boolean }> = (props, surface) => {
  const { Box, Button, Text } = surface.elements
  surface.onPointer(e => {
    const over = e.type !== 'leave'
    const press = !props.label && e.type === 'up' && (e.button ?? 'left') === 'left'
    const changed = over !== Boolean(surface.state?.over)
    if (changed) surface.setState({ over })
    if (press) surface.post({ press: true })
    else if (changed) surface.post({ over })
  })
  if (!props.label) return <Box width="100%" height="100%" />
  if (props.color && !props.dim) return <Button key={props.id} plain label={props.label} onPress={() => surface.post({ press: true })}><Text color={props.color}>{props.label}</Text></Button>
  return <Button key={props.id} plain dimColor={props.dim} label={props.label} onPress={() => surface.post({ press: true })} />
}

export default HeaderButton
