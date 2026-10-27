import type { ClientModule } from 'claude-code'

export type ButtonProps = { id: string; label: string; dim: boolean }

// A header button that also tells the hooks module when the pointer is over it, which a Button
// alone doesn't, so the header can say what the button does.
const HeaderButton: ClientModule<ButtonProps, { over: boolean }> = (props, surface) => {
  const { Button } = surface.elements
  surface.onPointer(e => {
    const over = e.type !== 'leave'
    if (over === Boolean(surface.state?.over)) return
    surface.setState({ over })
    surface.post({ over })
  })
  return <Button key={props.id} plain dimColor={props.dim} label={props.label} onPress={() => surface.post({ press: true })} />
}

export default HeaderButton
