/**
 * Panel settings — versioned, persisted as a single wrapped object under
 * `panelSettings` in `chrome.storage.local`, exposed as a singleton service.
 *
 *
 * Design contract:
 *
 * - **External API: read-only queries.** Consumers read settings via
 *   per-field getters on the singleton — `settings.activeTab`,
 *   `settings.networkColumns`, etc. The returned types are deeply
 *   read-only (arrays / records); scalars are immutable by definition.
 *   Mutation is funnelled through one explicit `settings.update(patch)`
 *   entry point that takes a partial.
 *
 * - **Reads always return a value.** Every settings key has a default. A
 *   query for a key the user hasn't customised yields the default, not
 *   `undefined`. The `PanelSettings` shape has no optional fields.
 *
 * - **Persistence: diff-only.** In-memory state is always `defaults ⊕ diff`.
 *   Storage carries only the diff (keys whose value differs from default)
 *   plus the version. `update` recomputes the diff after each patch — keys
 *   set back to the default value are removed from the diff. If the diff is
 *   empty, the storage key is removed entirely (no orphan version record).
 *
 * - **Versioning: only on breaking change.** Adding a new field with a
 *   default is never a breaking change — older stored diffs simply don't
 *   carry that key, and reads fall back to the default. The version is only
 *   bumped (and a migration written) when an _existing_ field's stored
 *   representation changes in a way that older diffs can no longer be
 *   parsed correctly.
 *
 * Per-object versioning: this version belongs to this specific stored
 * object. Any future setting stored under its own root key carries its own
 * version on its own migration cadence.
 */

import type { TabName } from '../components/TabBar.js'
import { DEFAULT_TABS } from '../components/TabBar.js'

// ---------------------------------------------------------------------------
// Public constants / types
// ---------------------------------------------------------------------------

export type PanelTabId =
  | 'commands'
  | 'events'
  | 'cache'
  | 'readModels'
  | 'sync'
  | 'writeQueue'
  | 'eventBus'
  | 'storage'
  | 'network'

export const PANEL_TAB_IDS: readonly PanelTabId[] = [
  'commands',
  'events',
  'cache',
  'readModels',
  'sync',
  'writeQueue',
  'eventBus',
  'storage',
  'network',
] as const

export const NETWORK_COLUMN_IDS = [
  'name',
  'path',
  'url',
  'method',
  'status',
  'scheme',
  'domain',
  'remoteAddress',
  'type',
  'initiator',
  'source',
  'cookies',
  'setCookies',
  'size',
  'time',
  'waterfall',
] as const
export type NetworkColumnId = (typeof NETWORK_COLUMN_IDS)[number]

export const DEFAULT_NETWORK_COLUMNS: readonly NetworkColumnId[] = [
  'name',
  'method',
  'status',
  'type',
  'initiator',
  'source',
  'cookies',
  'size',
  'time',
  'waterfall',
] as const

const PANEL_TAB_ID_SET: ReadonlySet<string> = new Set(PANEL_TAB_IDS)
const TAB_NAME_SET: ReadonlySet<string> = new Set<string>(DEFAULT_TABS)
const NETWORK_COLUMN_ID_SET: ReadonlySet<string> = new Set(NETWORK_COLUMN_IDS)

function isTabName(value: string): value is TabName {
  return TAB_NAME_SET.has(value)
}

function isPanelTabId(value: string): value is PanelTabId {
  return PANEL_TAB_ID_SET.has(value)
}

export function isNetworkColumnId(v: string): v is NetworkColumnId {
  return NETWORK_COLUMN_ID_SET.has(v)
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  return value as Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Settings shape — every field has a default; reads never return undefined.
// ---------------------------------------------------------------------------

interface PanelSettings {
  tabOrder: readonly TabName[]
  panelWidths: Readonly<Partial<Record<PanelTabId, number>>>
  activeTab: TabName
  captureOnStart: boolean
  networkColumns: readonly NetworkColumnId[]
  networkShowHttp: boolean
  networkShowWs: boolean
}

const CURRENT_VERSION = 1
const ROOT_KEY = 'panelSettings'

const DEFAULTS: PanelSettings = Object.freeze({
  tabOrder: Object.freeze([...DEFAULT_TABS]) as readonly TabName[],
  panelWidths: Object.freeze({}) as Readonly<Partial<Record<PanelTabId, number>>>,
  activeTab: 'Network' as TabName,
  captureOnStart: false,
  networkColumns: Object.freeze([...DEFAULT_NETWORK_COLUMNS]) as readonly NetworkColumnId[],
  networkShowHttp: true,
  networkShowWs: true,
})

/**
 * Forward migrations keyed by SOURCE version. `MIGRATIONS[1]` would upgrade
 * a v1 stored diff to v2. Migrations are only needed for _breaking_ changes
 * to existing fields' shapes; adding a new field is not breaking because
 * older diffs simply omit it and reads return the default.
 */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {}

// ---------------------------------------------------------------------------
// Parsers — hardening reads. Each returns either a typed value or `undefined`
// to signal "not present / invalid; fall back to default".
// ---------------------------------------------------------------------------

function parseTabOrder(raw: unknown): readonly TabName[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const seen = new Set<TabName>()
  const out: TabName[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    if (!isTabName(item)) continue
    if (seen.has(item)) continue
    seen.add(item)
    out.push(item)
  }
  // Append any tabs the saved order doesn't include (e.g. after we add a new
  // tab in a future build). They land at the end rather than disappearing.
  for (const tab of DEFAULT_TABS) {
    if (!seen.has(tab)) out.push(tab)
  }
  return out
}

function parsePanelWidths(raw: unknown): Partial<Record<PanelTabId, number>> | undefined {
  const rec = asRecord(raw)
  if (!rec) return undefined
  const out: Partial<Record<PanelTabId, number>> = {}
  for (const k of Object.keys(rec)) {
    if (!isPanelTabId(k)) continue
    const v = rec[k]
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      out[k] = v
    }
  }
  return Object.keys(out).length === 0 ? undefined : out
}

function parseActiveTab(raw: unknown): TabName | undefined {
  if (typeof raw !== 'string') return undefined
  return isTabName(raw) ? raw : undefined
}

function parseBool(raw: unknown): boolean | undefined {
  return typeof raw === 'boolean' ? raw : undefined
}

function parseNetworkColumns(raw: unknown): readonly NetworkColumnId[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: NetworkColumnId[] = []
  const seen = new Set<NetworkColumnId>()
  for (const item of raw) {
    if (typeof item !== 'string') continue
    if (!isNetworkColumnId(item)) continue
    if (seen.has(item)) continue
    seen.add(item)
    out.push(item)
  }
  return out
}

/**
 * Parse a stored diff. Unknown / invalid values are dropped (reads fall back
 * to the default); only validated non-default values survive into the diff.
 */
function parseDiff(raw: Record<string, unknown>): Partial<PanelSettings> {
  const out: Partial<PanelSettings> = {}

  const tabOrder = parseTabOrder(raw['tabOrder'])
  if (tabOrder !== undefined && !sameTabOrder(tabOrder, DEFAULTS.tabOrder)) {
    out.tabOrder = tabOrder
  }
  const panelWidths = parsePanelWidths(raw['panelWidths'])
  if (panelWidths !== undefined) out.panelWidths = panelWidths
  const activeTab = parseActiveTab(raw['activeTab'])
  if (activeTab !== undefined && activeTab !== DEFAULTS.activeTab) out.activeTab = activeTab
  const captureOnStart = parseBool(raw['captureOnStart'])
  if (captureOnStart !== undefined && captureOnStart !== DEFAULTS.captureOnStart) {
    out.captureOnStart = captureOnStart
  }
  const networkColumns = parseNetworkColumns(raw['networkColumns'])
  if (networkColumns !== undefined && !sameColumns(networkColumns, DEFAULTS.networkColumns)) {
    out.networkColumns = networkColumns
  }
  const showHttp = parseBool(raw['networkShowHttp'])
  if (showHttp !== undefined && showHttp !== DEFAULTS.networkShowHttp) {
    out.networkShowHttp = showHttp
  }
  const showWs = parseBool(raw['networkShowWs'])
  if (showWs !== undefined && showWs !== DEFAULTS.networkShowWs) {
    out.networkShowWs = showWs
  }
  return out
}

function sameTabOrder(a: readonly TabName[], b: readonly TabName[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function sameColumns(a: readonly NetworkColumnId[], b: readonly NetworkColumnId[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function valueEqualsDefault<K extends keyof PanelSettings>(
  key: K,
  value: PanelSettings[K],
): boolean {
  const def = DEFAULTS[key]
  if (key === 'tabOrder') {
    return sameTabOrder(value as readonly TabName[], def as readonly TabName[])
  }
  if (key === 'networkColumns') {
    return sameColumns(value as readonly NetworkColumnId[], def as readonly NetworkColumnId[])
  }
  if (key === 'panelWidths') {
    const v = value as Readonly<Partial<Record<PanelTabId, number>>>
    return Object.keys(v).length === 0
  }
  return value === def
}

// ---------------------------------------------------------------------------
// Singleton settings service
// ---------------------------------------------------------------------------

class SettingsService {
  private diff: Partial<PanelSettings> = {}
  private state: PanelSettings = DEFAULTS
  private ready = false

  /** Async lifecycle hook — must be awaited once before any reads. */
  async init(): Promise<void> {
    if (this.ready) return
    try {
      const result = await chrome.storage.local.get(ROOT_KEY)
      const stored = asRecord(result[ROOT_KEY])
      this.diff = stored ? parseDiff(applyForwardMigrations(stored)) : {}
    } catch {
      this.diff = {}
    } finally {
      this.recomputeState()
      this.ready = true
    }
  }

  // Per-field read accessors. Each returns the user's stored value if it
  // differs from the default, otherwise the default. Types are read-only,
  // so callers can't mutate the returned arrays/objects to back-channel
  // into state — all writes go through `update`.

  get tabOrder(): readonly TabName[] {
    return this.state.tabOrder
  }
  get panelWidths(): Readonly<Partial<Record<PanelTabId, number>>> {
    return this.state.panelWidths
  }
  get activeTab(): TabName {
    return this.state.activeTab
  }
  get captureOnStart(): boolean {
    return this.state.captureOnStart
  }
  get networkColumns(): readonly NetworkColumnId[] {
    return this.state.networkColumns
  }
  get networkShowHttp(): boolean {
    return this.state.networkShowHttp
  }
  get networkShowWs(): boolean {
    return this.state.networkShowWs
  }

  /**
   * Apply a partial update: mutate the in-memory state immediately, then
   * persist. Keys whose value matches the default are removed from the
   * persisted diff; if the diff becomes empty, the storage key is removed
   * outright.
   *
   * Most call sites fire-and-forget the returned promise; it's there for
   * tests and the occasional caller that wants confirmation the write hit
   * storage.
   */
  update(patch: Partial<PanelSettings>): Promise<void> {
    const nextDiff: Partial<PanelSettings> = { ...this.diff }
    for (const key of Object.keys(patch) as (keyof PanelSettings)[]) {
      const value = patch[key]
      if (value === undefined) continue
      if (valueEqualsDefault(key, value)) {
        delete nextDiff[key]
      } else {
        setDiffValue(nextDiff, key, value)
      }
    }
    this.diff = nextDiff
    this.recomputeState()
    if (Object.keys(this.diff).length === 0) {
      return chrome.storage.local.remove(ROOT_KEY)
    }
    return chrome.storage.local.set({
      [ROOT_KEY]: { version: CURRENT_VERSION, ...this.diff },
    })
  }

  /**
   * Wipe all stored preferences back to defaults. Optionally take a
   * follow-up patch so a caller can keep one or two fields after the
   * reset — used by the About/Settings panel to keep `activeTab` on
   * itself so the user doesn't get teleported to the default tab.
   */
  reset(postPatch?: Partial<PanelSettings>): Promise<void> {
    this.diff = {}
    this.recomputeState()
    if (postPatch) return this.update(postPatch)
    return chrome.storage.local.remove(ROOT_KEY)
  }

  private recomputeState(): void {
    this.state = { ...DEFAULTS, ...this.diff }
  }
}

/**
 * Type-narrowed assignment helper. Lets us iterate the patch keys generically
 * while keeping `nextDiff[key] = value` type-safe — `Partial<PanelSettings>`
 * doesn't tolerate the indirect `nextDiff[key] = patch[key]` form on its
 * own without per-key narrowing.
 */
function setDiffValue<K extends keyof PanelSettings>(
  diff: Partial<PanelSettings>,
  key: K,
  value: PanelSettings[K],
): void {
  diff[key] = value
}

function applyForwardMigrations(stored: Record<string, unknown>): Record<string, unknown> {
  let current: Record<string, unknown> = stored
  let guard = 32
  while (guard-- > 0) {
    const versionRaw = current['version']
    const version = typeof versionRaw === 'number' ? versionRaw : 1
    if (version >= CURRENT_VERSION) break
    const migrate = MIGRATIONS[version]
    if (!migrate) {
      // Unsupported old version with no migration path — transparent reset
      // to defaults (return an empty record so parseDiff yields {}).
      return {}
    }
    current = migrate(current)
  }
  return current
}

export const settings = new SettingsService()
