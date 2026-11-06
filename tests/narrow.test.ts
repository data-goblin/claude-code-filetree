import { expect, test } from 'claude-code/testing'
import { narrowEmoji } from '../hooks/term'

test('narrowing emoji drops the presentation selector from prose', () => {
  expect(narrowEmoji('pinned ⚠️ done ➡️ next')).toBe('pinned ⚠ done ➡ next')
})

test('narrowing emoji keeps code spans, fenced code and link targets literal', () => {
  const span = 'run `cat "⚠️.txt"` now ⚠️'
  expect(narrowEmoji(span)).toBe('run `cat "⚠️.txt"` now ⚠')
  const fence = '⚠️ before\n```sh\ncat "⚠️.txt"\n```\nafter ⚠️'
  expect(narrowEmoji(fence)).toBe('⚠ before\n```sh\ncat "⚠️.txt"\n```\nafter ⚠')
  const open = 'tip ⚠️\n~~~\nls ⚠️'
  expect(narrowEmoji(open)).toBe('tip ⚠\n~~~\nls ⚠️')
  const link = 'see [⚠️ notes](https://x.dev/⚠️) and <https://y.dev/⚠️> or https://z.dev/⚠️'
  expect(narrowEmoji(link)).toBe('see [⚠ notes](https://x.dev/⚠️) and <https://y.dev/⚠️> or https://z.dev/⚠️')
})
