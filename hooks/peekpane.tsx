import type { EngineInterface } from 'claude-code'
import type { Look } from './look'
import type { Layout } from './layout'
import type { Columns } from './columns'
import { stopScans, mapUp } from './scans'
import { previewing, mapping, machine, settings } from './state'
import { peekTarget, readPreview, previewLines } from './preview'
import { inside, relative } from './tree'
import { shortPath } from './util'
import { pictureKind, picture, fitCells, pngOf } from './peek'
import type { RenderElement } from 'claude-code'
import { mapPane } from './mappane'
import { IMAGE_BYTES } from './register'
import type { RowsProps } from './rows'

export async function peekPane($: EngineInterface, c: Look & Layout & Columns) {
  const { e, t, unicode, Box, Text, Button, Client, Image, theme, mutedText, rowColors, splitRows } = c
  if (!splitRows) {
    stopScans()
    return null
  }
  previewing.peekRows = splitRows - 2
  const lock = mapping.mapLock?.cursor === t.cursor ? mapping.mapLock : null
  if (mapping.mapLock && !lock) mapping.mapLock = null
  const target = lock ? '' : peekTarget(t)
  const anchor = target ? '' : (lock?.anchor ?? (t.nodes.find(n => n.id === t.cursor)?.kind === 'dir' ? t.cursor : t.root))
  mapping.mapPick = lock?.pick ?? ''
  stopScans(anchor)
  if (target !== previewing.peekPath) {
    previewing.peekPath = target
    previewing.peeked = null
    previewing.peekTop = previewing.peekWant?.path === target ? previewing.peekWant.top : 0
    previewing.peekWant = null
    if (previewing.peekAt?.path !== target) previewing.peekAt = null
    previewing.overPeek = false
  }
  let start = previewing.peekTop
  const rule = <Text key="peek-rule" {...mutedText}>{'─'.repeat(Math.max(1, e.props.bodyColumns))}</Text>
  const shown = target || anchor
  const name = shown ? (shown === t.root ? shown.split('/').pop() || shown : inside(t.root, shown) ? relative(t.root, shown) : shortPath(shown)) : ''
  const docKind = target ? pictureKind(target) : ''
  const isDoc = docKind === 'pdf' || docKind === 'office'
  const docPixels = Boolean(Image) && !machine.imageDenied && !machine.inTmux && !machine.inHerdr
  const page = isDoc ? (previewing.docPages.get(target) ?? 1) : 0
  const px = Math.round(Math.max(1, e.props.bodyColumns - 1) * (machine.cellPx?.cw ?? 10))
  const raw = target && (!isDoc || docPixels) ? await picture($, target, page, px) : null
  const pic = isDoc && raw && raw.state !== 'ready' && !(raw.state === 'failed' && raw.note === 'encrypted') ? null : raw
  if (isDoc && raw?.state === 'ready' && raw.pages) {
    previewing.docCounts.set(target, raw.pages)
    if (page < raw.pages) void picture($, target, page + 1, px)
  }
  if (!target || pic) previewing.overPeek = false
  let content: RenderElement
  let status = ''
  if (!target && anchor) {
    const map = mapPane($, c, anchor)
    content = map.content
    status = map.status
  } else if (!target) content = <Text {...mutedText}>no file selected</Text>
  else if (pic) {
    if (pic.state === 'ready' && Image) {
      const fit = fitCells(pic, Math.max(1, e.props.bodyColumns - 1), previewing.peekRows)
      status = isDoc ? `p ${page}/${pic.pages ?? '?'}` : `${pic.width}×${pic.height}`
      const raw = await pngOf($, pic)
      const big = Math.floor(raw.length * 3 / 4) > IMAGE_BYTES
      const png = big ? '' : raw
      content = big ? <Text {...mutedText}>{`${name}: too large to preview here`}</Text> : png ? <Image key="peek-image" source={{ png }} columns={fit.columns} rows={fit.rows} alt={name} /> : <Text {...mutedText}>{name}</Text>
    } else content = <Text {...mutedText}>{pic.state === 'pending' ? 'decoding…' : pic.state === 'failed' ? pic.note : 'images show in the terminal'}</Text>
  } else {
    if (isDoc && (previewing.peeked?.path !== target || (docKind === 'pdf' && previewing.peeked.page !== page))) {
      const want = `${target}\0${page}`
      if (previewing.docReading !== want) {
        previewing.docReading = want
        $.clock.after(0, () => void readPreview($, target, page).then(p => {
          if (previewing.docReading !== want) return
          previewing.docReading = ''
          if (previewing.peekPath === target) {
            previewing.peeked = p
            previewing.peekTop = 0
          }
          void $.ui.invalidate('ui.render')
        }, () => {
          if (previewing.docReading === want) previewing.docReading = ''
        }))
      }
      if (previewing.peeked?.path !== target) previewing.peeked = { path: target, text: '', note: 'reading…', page }
    } else if (previewing.peeked?.path !== target) {
      const at = previewing.peekAt?.path === target ? previewing.peekAt : null
      previewing.peeked = await readPreview($, target, 1, at?.line)
      if (at && !at.jumped) {
        at.jumped = true
        start = previewing.peekTop = Math.max(0, at.line - 3 - (previewing.peeked.first ?? 0))
      }
    }
    const first = previewing.peeked.first ?? 0
    const lines = previewing.peeked.text.split('\n')
    const last = Math.max(0, lines.length - previewing.peekRows)
    start = Math.min(start, last)
    const markdown = /\.(md|markdown|mdx|docx|odt|rtf)$/i.test(target)
    const win = previewLines(previewing.peeked.text, start, previewing.peekRows, markdown)
    status = `${docKind === 'pdf' ? `p ${page}${previewing.docCounts.has(target) ? `/${previewing.docCounts.get(target)}` : ''} ` : ''}${previewing.peeked.text ? `${first + start + 1}–${first + Math.min(lines.length, start + previewing.peekRows)}/${first + lines.length}` : ''}`.trim()
    const size = Math.max(1, Math.round((previewing.peekRows * previewing.peekRows) / Math.max(1, lines.length)))
    const bar = lines.length > previewing.peekRows ? { pos: last ? Math.round((start / last) * (previewing.peekRows - size)) : 0, size, thumb: theme.accent, track: theme.muted } : undefined
    if (!previewing.peeked.text) previewing.overPeek = false
    content = previewing.peeked.text
      ? <Client key="peek" module="./rows.tsx" props={{ rows: [], active: '', ...rowColors, pointer: machine.pointer, ...(bar ? { bar } : {}), preview: { text: win.text, path: target, startLine: first + win.top + 1, markdown, rows: previewing.peekRows } } satisfies RowsProps} />
      : <Text {...mutedText}>{raw?.state === 'pending' ? 'converting…' : previewing.peeked.note || 'empty file'}</Text>
  }
  const title = (
    <Box key="peek-title" flexDirection="row" height={1} overflow="hidden">
      <Box flexShrink={1} flexGrow={1} overflow="hidden">
        {anchor && anchor !== t.root && !target ? (
          <Button key="map-up" plain label={`${settings.glyphSetting === 'text' ? 'up ' : unicode ? '↑ ' : '\u{eaa1} '}${name}`} onPress={() => void mapUp($, anchor)} />
        ) : (
          <Text bold wrap="truncate-start">{name}</Text>
        )}
      </Box>
      {status ? <Box flexShrink={0}><Text {...mutedText}>{` ${status}`}</Text></Box> : null}
      {previewing.peeked?.note && previewing.peeked.text && !pic ? <Text {...mutedText}>{' partial'}</Text> : null}
    </Box>
  )
  const box = <Box key="peek-body" flexDirection="column" height={previewing.peekRows} overflow="hidden">{content}</Box>
  return settings.splitAt === 'top'
    ? <Box key="peek-split" flexDirection="column" flexShrink={0}>{title}{box}{rule}</Box>
    : <Box key="peek-split" flexDirection="column" flexShrink={0}>{rule}{title}{box}</Box>
}
