import type { Theme } from '../types'

export type Palette = {
  theme: Partial<Theme>
  git: Record<string, string>
  add?: string
  del?: string
  hover?: string
  unknown: string[]
}

export const ADD_COLOR = '#98c379'
export const DEL_COLOR = '#e06c75'
export const LIGHT_ADD_COLOR = '#14532d'
export const LIGHT_DEL_COLOR = '#7f1d1d'
export const LIGHT_HOVER = '#f0f2f5'

const THEME_KEYS = ['fg', 'bg', 'accent', 'muted', 'urgent', 'selection'] as const
const GIT_KEYS: Record<string, string[]> = { added: ['A', '?'], modified: ['M', 'T'], renamed: ['R', 'C'] }
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

export function parsePalette(text: unknown): Palette {
  const out: Palette = { theme: {}, git: {}, unknown: [] }
  if (typeof text !== 'string') return out
  for (const pair of text.split(/[\s,;]+/).filter(Boolean)) {
    const [rawKey, value = ''] = pair.split('=')
    const key = (rawKey ?? '').trim().toLowerCase()
    if (!HEX.test(value.trim())) {
      out.unknown.push(pair)
      continue
    }
    const color = value.trim().toLowerCase().replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3')
    if ((THEME_KEYS as readonly string[]).includes(key)) out.theme[key as (typeof THEME_KEYS)[number]] = color
    else if (key in GIT_KEYS) for (const status of GIT_KEYS[key] ?? []) out.git[status] = color
    else if (key === 'add' || key === 'del' || key === 'hover') out[key] = color
    else out.unknown.push(pair)
  }
  return out
}
