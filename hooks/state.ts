import type { DiffGroups } from './diff'
import type { Target } from './open'
import { parsePalette, type Palette } from './palette'
import type { Background, Column, GrepHit, Indexed, LinkState, Preview, Scan } from './register'
import type { Change, Clock, DateFormat } from './tree'
import type { TermColors } from './term'
import type { FileTree } from '../types'
import type { Timer } from 'claude-code'
import type { Touch } from './work'
import type { Guards } from './guard'
import type { Picture } from './peek'

type Settings = {
  glyphSetting: string
  openWithSetting: string
  binariesInDefaultApp: boolean
  editWithSetting: string
  diffWithSetting: string
  groupSetting: DiffGroups
  targetSetting: Target
  palette: Palette
  splitAt: 'bottom' | 'top'
  jumpMovesClaude: boolean
  followWork: boolean
  followClaude: boolean
  showReads: boolean
  showWrites: boolean
  shimmerOn: boolean
  columnDefault: Column
  showAge: boolean
  dateSetting: DateFormat
  clock: Clock
  showHints: boolean
  showRemote: boolean
  focusOnOpen: boolean
  ignoreNames: string[]
  searchGap: boolean
  sortHeader: boolean
  longFile: number
  autoCollapseDefault: boolean
  shortcutsSetting: 'auto' | 'always' | 'off'
  treemapSetting: 'auto' | 'image' | 'cells' | 'off'
  noDock: boolean
}

export const settings: Settings = {
  glyphSetting: 'auto',
  openWithSetting: '',
  binariesInDefaultApp: false,
  editWithSetting: '',
  diffWithSetting: '',
  groupSetting: 'folder',
  targetSetting: 'auto',
  palette: parsePalette(''),
  splitAt: 'bottom',
  jumpMovesClaude: true,
  followWork: true,
  followClaude: true,
  showReads: true,
  showWrites: true,
  shimmerOn: true,
  columnDefault: 'date',
  showAge: false,
  dateSetting: 'year-month-day',
  clock: '24h',
  showHints: true,
  showRemote: false,
  focusOnOpen: true,
  ignoreNames: [],
  searchGap: true,
  sortHeader: true,
  longFile: 500,
  autoCollapseDefault: false,
  shortcutsSetting: 'auto',
  treemapSetting: 'auto',
  noDock: false,
}

type Machine = {
  lightTerminal: boolean
  noNerd: boolean
  inTmux: boolean
  inHerdr: boolean
  kittyTerm: boolean
  cellPx: { cw: number; ch: number } | null
  termColors: TermColors
  pointer: boolean
  home: string
  imageDenied: boolean
  imageChecked: boolean
}

export const machine: Machine = {
  lightTerminal: false,
  noNerd: false,
  inTmux: false,
  inHerdr: false,
  kittyTerm: false,
  cellPx: null,
  termColors: { palette: {} },
  pointer: true,
  home: '',
  imageDenied: false,
  imageChecked: false,
}

type Tree = {
  cached: FileTree | null
  snapshot: Timer | null
  watcher: { key: string; stop: () => void } | null
  searchIndex: { root: string; paths: Promise<Indexed> } | null
  follow: boolean
}

export const tree: Tree = {
  cached: null,
  snapshot: null,
  watcher: null,
  searchIndex: null,
  follow: true,
}

type Vcs = {
  gitStamp: string | null
  dirty: { root: string; files: Record<string, Change> }
  queuedReads: string[]
  activityId: number
  background: Map<string, Background>
}

export const vcs: Vcs = {
  gitStamp: null,
  dirty: { root: '', files: {} },
  queuedReads: [],
  activityId: 0,
  background: new Map<string, Background>(),
}

type Flashing = {
  blink: Timer | null
  generation: number
  autoOpened: Map<string, number>
  collapseTimer: { cancel: () => void } | null
  collapseAt: number
}

export const flashing: Flashing = {
  blink: null,
  generation: 0,
  autoOpened: new Map<string, number>(),
  collapseTimer: null,
  collapseAt: 0,
}

type Marking = {
  marks: string[]
  markAnchor: string
  markBase: string[]
}

export const marking: Marking = {
  marks: [],
  markAnchor: '',
  markBase: [],
}

type Ui = {
  lastPress: { key: string; at: number }
  hovered: string
  view: { from: number; max: number }
  nativeScroll: boolean
  hintRoot: string
  hintUntil: number
  reloading: number
  reloadSpin: number
  shortcutsShown: boolean
  shortcutsTop: number
  shortcutsMax: number
  shortcutsPage: number
  deskGrepShown: number
  jumpBlur: Timer | null
}

export const ui: Ui = {
  lastPress: { key: '', at: 0 },
  hovered: '',
  view: { from: 0, max: 0 },
  nativeScroll: false,
  hintRoot: '',
  hintUntil: 0,
  reloading: 0,
  reloadSpin: 0,
  shortcutsShown: false,
  shortcutsTop: 0,
  shortcutsMax: 0,
  shortcutsPage: 1,
  deskGrepShown: Infinity,
  jumpBlur: null,
}

type Previewing = {
  previewLine: number
  previewed: Preview | null
  previewRows: number
  previewDesk: boolean
  previewActs: Map<string, () => void>
  deskLine: { path: string; top: number; scrolled: boolean; line: number } | null
  peeked: Preview | null
  peekWant: { path: string; top: number } | null
  peekAt: { path: string; line: number; jumped: boolean } | null
  peekPath: string
  peekRows: number
  peekTop: number
  overPeek: boolean
  splitShown: boolean
  docPages: Map<string, number>
  docCounts: Map<string, number>
  docReading: string
}

export const previewing: Previewing = {
  previewLine: 1,
  previewed: null,
  previewRows: 20,
  previewDesk: false,
  previewActs: new Map<string, () => void>(),
  deskLine: null,
  peeked: null,
  peekWant: null,
  peekAt: null,
  peekPath: '',
  peekRows: 8,
  peekTop: 0,
  overPeek: false,
  splitShown: false,
  docPages: new Map<string, number>(),
  docCounts: new Map<string, number>(),
  docReading: '',
}

type Pics = {
  pictures: Map<string, { sig: string; picture: Picture; retried?: boolean }>
  pictureBase: string
  pictureSession: string
  sessionDir: string
}

export const pics: Pics = {
  pictures: new Map<string, { sig: string; picture: Picture; retried?: boolean }>(),
  pictureBase: '',
  pictureSession: '',
  sessionDir: '',
}

type Working = {
  workTouches: Touch[]
  workLast: number
  mainBusy: boolean
}

export const working: Working = {
  workTouches: [],
  workLast: 0,
  mainBusy: false,
}

type Linking = {
  links: Set<string>
  linkStates: Map<string, LinkState | null>
}

export const linking: Linking = {
  links: new Set<string>(),
  linkStates: new Map<string, LinkState | null>(),
}

type Guarding = {
  guards: Guards
  guardsLoaded: Promise<void> | null
  outside: string[]
}

export const guarding: Guarding = {
  guards: {},
  guardsLoaded: null,
  outside: [],
}

type Mapping = {
  mapLock: { anchor: string; pick: string; cursor: string } | null
  mapAnchor: string
  mapPick: string
  mapImage: { key: string; png: string } | null
  scans: Map<string, Scan>
}

export const mapping: Mapping = {
  mapLock: null,
  mapAnchor: '',
  mapPick: '',
  mapImage: null,
  scans: new Map<string, Scan>(),
}

type Metrics = {
  sizeEpoch: number
  timeQueue: [string, number][]
  timing: Set<string>
  timeFailed: Set<string>
  timeTries: Map<string, number>
  locTries: Map<string, number>
  dirTimes: Map<string, [number, number]>
  sizeQueue: string[]
  locCache: Map<string, number>
  fileCounts: Map<string, number>
  counting: Set<string>
  countTries: Map<string, number>
  countQueue: string[]
  locListed: Set<string>
  locBusy: Set<string>
  locQueue: [string, boolean][]
  sizing: Set<string>
}

export const metrics: Metrics = {
  sizeEpoch: 0,
  timeQueue: [],
  timing: new Set<string>(),
  timeFailed: new Set<string>(),
  timeTries: new Map<string, number>(),
  locTries: new Map<string, number>(),
  dirTimes: new Map<string, [number, number]>(),
  sizeQueue: [],
  locCache: new Map<string, number>(),
  fileCounts: new Map<string, number>(),
  counting: new Set<string>(),
  countTries: new Map<string, number>(),
  countQueue: [],
  locListed: new Set<string>(),
  locBusy: new Set<string>(),
  locQueue: [],
  sizing: new Set<string>(),
}

export const grep = { key: '', rows: [] as GrepHit[], sel: 0, seq: 0, capped: false, busy: false, note: '', stop: null as (() => void) | null }

export const zjump = { on: false, query: '', sel: 0, rows: [] as string[], seq: 0, held: false, focused: false, when: {} as Record<string, number> }
