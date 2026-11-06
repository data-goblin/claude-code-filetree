import { collator } from './tree'

export const GOTO_LIMIT = 50

export function pathParts(text: string): { head: string; frag: string } {
  const cut = text.lastIndexOf('/')
  return { head: text.slice(0, cut + 1), frag: text.slice(cut + 1) }
}

export function folderMatches(names: string[], frag: string): string[] {
  const want = frag.toLowerCase()
  return names.filter(n => n.toLowerCase().startsWith(want) && (want.startsWith('.') || !n.startsWith('.'))).sort(collator.compare)
}

export function completion(head: string, frag: string, names: string[]): string {
  if (frag === '..' || (frag === '~' && !head)) return `${frag}/`
  const [first, ...rest] = names
  if (first === undefined) return ''
  if (rest.length === 0) return `${first}/`
  let n = frag.length
  while (n < first.length && rest.every(x => x[n]?.toLowerCase() === first[n]?.toLowerCase())) n++
  return n > frag.length ? first.slice(0, n) : ''
}
