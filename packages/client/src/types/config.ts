/**
 * Configuration types for the CQRS Client.
 */

import type { ILogger, IPersistedEvent, Link } from '@meticoeus/ddd-es'
import type { AuthStrategy } from '../core/auth.js'
import type {
  CacheKeyIdentity,
  CacheKeyMatcher,
  CacheKeyTemplate,
} from '../core/cache-manager/CacheKey.js'
import type { IAnticipatedEvent } from '../core/command-lifecycle/AnticipatedEventShape.js'
import type { ICommandSender } from '../core/command-queue/types.js'
import { validatePath } from '../core/entity-ref/ref-path.js'
import type { ProcessorRegistration } from '../core/event-processor/types.js'
import { defaultProblemJsonMapper } from '../core/failure-mapper/index.js'
import type { Sort } from '../core/query-manager/types.js'
import type { AnyViewRegistration } from '../core/views/types.js'
import type {
  AggregateConfig,
  DirectIdReference,
  IClientAggregates,
  IdReference,
} from './aggregates.js'
import { EnqueueCommand, type FailureMapper } from './commands.js'
import {
  applyCommandHandlerDefaults,
  type CommandHandlerRegistration,
  type SchemaValidator,
} from './domain.js'
import type { JSONPathExpression } from './json-path.js'

export type ClientAggregatesConfig<TLink extends Link> = IClientAggregates<TLink>

/**
 * Execution mode for the CQRS Client.
 */
export type ClientMode =
  | 'online-only' // Mode A: In-memory, no persistence
  | 'shared-worker' // Mode C: Multi-tab with SharedWorker orchestrator
  | 'dedicated-worker' // Mode B: Single-tab with Dedicated Worker

/**
 * Execution mode for client configuration.
 * Includes 'auto' which detects the best mode for the environment.
 */
export type ClientModeConfig = ClientMode | 'auto'

/**
 * VFS type for SQLite storage.
 */
export type SqliteVfsType = 'opfs' | 'opfs-sahpool'

/**
 * A library-owned schema step.
 *
 * Library steps create infrastructure tables (session, commands, cache_keys, etc.).
 * They are placed by the consumer inside their `SchemaMigration` sequence.
 *
 * Future: `collectionHook: (tableName: string) => string[]` will be added for
 * v2+ library upgrades that need to ALTER pre-existing managed tables.
 * The runner will query `sqlite_master` to introspect which `rm_*` tables
 * actually exist before applying the hook — tables from earlier migrations
 * may have been dropped by the user.
 */
export interface LibraryStep {
  type: 'library'
  /** Identifies this step (e.g., 'init') */
  id: string
  /** Ordering version within library steps (1, 2, 3...) */
  version: number
  /** Infrastructure DDL statements */
  sql: string[]
}

/**
 * A custom column on a managed read-model table.
 *
 * Emitted as a SQLite **VIRTUAL** generated column derived from
 * `_effective_data`. VIRTUAL avoids row-level storage duplication — column
 * values are computed on demand; indexes that reference the column still
 * store their key values (intrinsic to indexing, not to generated-column
 * kind). At 1e5+ rows under OPFS quotas, STORED's per-row duplication is
 * unacceptable; VIRTUAL is the only kind exposed by this surface.
 *
 * Mode A (in-memory) ignores `columns` entirely — they're a SQL-mode concern.
 * The consumer-facing row shape on both backends remains
 * `JSON.parse(_effective_data)`.
 */
export interface CustomColumn {
  /**
   * Column name. Must be snake_case, start with a lowercase letter, and not
   * begin with `_` (library-owned prefix) or `__` (library-owned prefix).
   * Must not collide with library-owned columns: `id`, `updated_at`.
   */
  name: string
  type: 'TEXT' | 'INTEGER' | 'REAL'
  /**
   * Simple JSONPath into `_effective_data`. Library emits
   * `json_extract(_effective_data, '<path>')` as the generated-column
   * expression. Mutually exclusive with `expression`.
   *
   * Subset accepted: root `$`, dot members, bracket members (`['key']`),
   * array indexes. Wildcards (`[*]`) are rejected — `json_extract` returns
   * a single scalar, not an array.
   */
  path?: JSONPathExpression
  /**
   * Escape hatch — raw SQLite expression dropped into the
   * `GENERATED ALWAYS AS (...)` clause verbatim. Mutually exclusive with
   * `path`. Use for case-folded sort keys, computed values across multiple
   * fields, or anything `json_extract` alone can't express.
   *
   * Example: `lower(json_extract(_effective_data, '$.name'))`.
   */
  expression?: string
  /**
   * SQLite collating sequence applied to the column. Default `BINARY`.
   *
   * Built-in names — `BINARY`, `NOCASE`, `RTRIM` — are always accepted.
   * `NOCASE` enables index-backed case-insensitive prefix `LIKE` queries.
   *
   * Any other name must be declared on {@link CqrsConfig.collations} and is
   * matched against that registry at schema-build time.
   */
  collation?: string
}

/**
 * An index on a managed read-model table.
 *
 * Declared separately from columns to support composite indexes without
 * forcing every column inside a composite to also carry its own redundant
 * single-column index. Index columns may reference any
 * {@link CustomColumn} on the same table or library-owned columns
 * (`id`, `updated_at`).
 */
export interface CustomIndex {
  /**
   * Optional index name. Defaults to
   * `idx_rm_<table>_<col1>_<col2>_...` based on the column list.
   */
  name?: string
  /** Ordered list of column names — composite-aware. Non-empty. */
  columns: readonly string[]
  unique?: boolean
  /**
   * Partial-index predicate dropped into `WHERE (...)` verbatim. Useful for
   * specializing hot-path filters (e.g.
   * `where: "status IN ('approved', 'submitted')"` to speed up aggregations
   * over a specific subset).
   */
  where?: string
}

/**
 * A managed read model collection.
 *
 * The library owns the table schema — fresh-create DDL via
 * `generateCollectionDDL(def)` produces `rm_{name}` with library-owned
 * bookkeeping columns plus any declared {@link CustomColumn}s and
 * {@link CustomIndex}es.
 */
export interface ManagedCollectionDef {
  type: 'managed'
  name: string
  /**
   * Custom VIRTUAL generated columns extracted from `_effective_data`.
   * Used by SQL views for filter / sort / join expressions. Ignored by
   * the in-memory backend.
   */
  columns?: CustomColumn[]
  /**
   * Indexes — single-column or composite, optional UNIQUE, optional partial
   * (`WHERE` predicate). Reference declared columns or library-owned
   * columns by name.
   */
  indexes?: CustomIndex[]
}

/**
 * A step within a schema migration.
 */
export type MigrationStep = LibraryStep | ManagedCollectionDef

/**
 * A versioned schema migration.
 *
 * Consumers declare migrations incrementally. Each migration adds the new
 * collections (and library steps) introduced in that version.
 */
export interface SchemaMigration {
  version: number
  message: string
  steps: MigrationStep[]
}

/**
 * Storage configuration.
 */
export interface StorageConfig {
  /** Database name/path */
  dbName?: string
  /** VFS type (auto-selected based on mode if not specified) */
  vfs?: SqliteVfsType
  /** Schema migrations — required, non-empty */
  migrations: [SchemaMigration, ...SchemaMigration[]]
}

/**
 * A custom SQLite collating sequence.
 *
 * Names declared here are registered against every database connection the
 * client opens (per-connection registration — collations don't persist in
 * the DB file). Once registered, a {@link CustomColumn} may set
 * `collation: '<name>'` and the same name is used by the JS-side fallback
 * sort in Mode A so list ordering is locale-consistent across backends.
 *
 * Built-in SQLite collations (`BINARY`, `NOCASE`, `RTRIM`) are always
 * available without registration and need not be declared here.
 *
 * The comparator must define a **total order** that is stable for the
 * lifetime of any index that mentions this collation name. Changing the
 * comparator's behaviour after rows are indexed corrupts those indexes;
 * a behaviour change must be accompanied by a schema migration that
 * `REINDEX`es the affected tables.
 */
export interface CollationConfig {
  /**
   * Identifier referenced by {@link CustomColumn.collation}. Must follow the
   * same SQL-identifier rules as a column name (snake_case, starts with a
   * lowercase letter). Names are matched case-insensitively by SQLite, so
   * `locale_en` and `LOCALE_EN` collide.
   */
  name: string
  /**
   * Total-ordering comparator. Wrap an {@link Intl.Collator} for locale-aware
   * sort: `compare: new Intl.Collator('en', { numeric: true }).compare`.
   */
  compare: (a: string, b: string) => number
}

/**
 * Network configuration.
 */
export interface NetworkConfig {
  /** Base URL for API requests */
  baseUrl: string
  /** WebSocket URL for real-time events */
  wsUrl?: string
  /** Request timeout in milliseconds */
  timeout?: number
  /** Custom headers to include in requests */
  headers?: Record<string, string>
}

/**
 * Retry configuration for commands.
 */
export interface RetryConfig {
  /** Maximum retry attempts */
  maxAttempts?: number
  /** Initial delay in milliseconds */
  initialDelay?: number
  /** Maximum delay in milliseconds */
  maxDelay?: number
  /** Backoff multiplier */
  backoffMultiplier?: number
  /** Add random jitter to delays */
  jitter?: boolean
}

/**
 * Cache configuration.
 */
export interface CacheConfig {
  /** Maximum number of cache keys */
  maxCacheKeys?: number
  /** Default TTL for cache keys in milliseconds */
  defaultTtl?: number
  /** Eviction policy */
  evictionPolicy?: 'lru' | 'fifo'
  /** Maximum number of windows/tabs that can hold cache keys simultaneously */
  maxWindows?: number
}

/**
 * Network context passed to collection fetch methods.
 *
 * Contains the resolved base URL and headers from NetworkConfig.
 * If AuthStrategy.getHttpHeaders is configured, the resolved headers are
 * merged in. For cookie-based auth, no special handling is needed — the
 * browser sends cookies automatically with fetch().
 *
 * Collections may add their own headers (e.g., Accept-Profile for versioning,
 * x-tenant-id for tenant context) in their fetch implementations.
 *
 * Shared across multiple fetch calls within a sync cycle.
 * Collections must not mutate this object — copy headers if custom headers are needed.
 */
export interface FetchContext {
  readonly baseUrl: string
  readonly headers: Readonly<Record<string, string>>
  readonly signal: AbortSignal
}

/**
 * A read model record returned from a seed endpoint.
 */
export interface SeedRecord {
  id: string
  data: Record<string, unknown>
  /** Stream revision (bigint as string). */
  revision?: string
  /** Global position (bigint as string). */
  position?: string
}

/**
 * Result of a read model seed page fetch.
 */
export interface SeedRecordPage {
  records: SeedRecord[]
  nextCursor: string | null
}

/**
 * Result of an event seed page fetch.
 * Events are IPersistedEvent from ddd-es — the canonical hydrated event type.
 */
export interface SeedEventPage {
  events: IPersistedEvent[]
  nextCursor: string | null
}

/**
 * Options for {@link Collection.fetchSeedRecords}.
 */
export interface FetchSeedRecordOptions<TLink extends Link> {
  readonly ctx: FetchContext
  readonly cursor: string | null
  readonly limit: number
  /** Cache key identity being seeded — extract scope params for query filtering */
  readonly cacheKey: CacheKeyIdentity<TLink>
}

/**
 * Options for {@link Collection.fetchSeedEvents}.
 */
export interface FetchSeedEventOptions<TLink extends Link> {
  readonly ctx: FetchContext
  readonly cursor: string | null
  readonly limit: number
  /** Cache key identity being seeded — extract scope params for query filtering */
  readonly cacheKey: CacheKeyIdentity<TLink>
}

/**
 * Options for {@link Collection.fetchStreamEvents}.
 */
export interface FetchStreamEventOptions {
  readonly ctx: FetchContext
  readonly streamId: string
  readonly afterRevision: bigint
}

export interface SeedOnInitConfig<TLink extends Link> {
  /**
   * Cache key identity to auto-seed on startup.
   */
  readonly cacheKey: CacheKeyIdentity<TLink>

  /**
   * Web socket topics subscribed to on startup for this collection.
   */
  readonly topics: readonly string[]
}

export interface SeedOnDemandConfig<TLink extends Link> {
  /**
   * Cache key types that activate this collection for on-demand seeding.
   * When `client.seed(identity)` is called and the identity matches one of
   * these matchers, this collection is seeded under that cache key.
   */
  readonly keyTypes: readonly CacheKeyMatcher<TLink>[]

  /**
   * Web socket topic patterns to subscribe to for a given cache key.
   * Called when a cache key is acquired (seeded or on-demand).
   * Return `[]` for no subscription.
   *
   * @param cacheKey - Cache key identity being subscribed
   * @returns Topic patterns for WS subscription
   */
  subscribeTopics(cacheKey: CacheKeyIdentity<TLink>): string[]
}

/**
 * A synchronized event collection backed by exactly one primary aggregate.
 *
 * Collections define how the library discovers, fetches, and routes events.
 * Consumer code implements the fetch methods to control HTTP conventions.
 *
 * Parameterized on `TLink` so multi-service apps using `ServiceLink`
 * get typed entity cache keys with required `service` field.
 *
 * The 1-to-1 relationship with an aggregate is enforced by the required
 * `aggregate` field. A separate `CompositeCollection` type built from multiple
 * aggregates is future work, pending a strong example case to design against —
 * it will not be a variant of this interface.
 */
export interface Collection<TLink extends Link> {
  readonly name: string

  /**
   * The primary aggregate this collection tracks.
   * Provides stream ID derivation and aggregate identity (type, service for ServiceLink).
   */
  readonly aggregate: AggregateConfig<TLink>

  /**
   * Declares which paths in this collection's read model data contain references
   * to aggregate IDs or links. Used by the event processor for overlay event reconciliation
   * when an anticipated create resolves to a server ID.
   *
   * Each entry is either a {@link DirectIdReference} (path points at a plain string ID)
   * or a {@link LinkIdReference} (path points at a `Link` object whose `type`/`service`
   * are validated against the declared aggregates before its `id` is rewritten).
   *
   * The self-ID at `$.id` is injected automatically by `resolveConfig` using this
   * collection's `aggregate` — no need to declare it manually. You must declare all other
   * references to an aggregate id/link (e.g. `notebookId` on a Note pointing at the Notebook aggregate).
   */
  readonly idReferences?: readonly IdReference<TLink>[]

  /**
   * JSONPath into the read model data where the aggregate's stream revision lives.
   * Used to advance `AggregateChain.lastKnownRevision` when server data arrives via
   * seed, refetch, or snapshot — so subsequent AutoRevision commands resolve against
   * the latest confirmed revision, not a stale command-success value.
   *
   * Examples: `'$.revision'`, `'$.latestRevision'`.
   * Absent means chain revision is not updated from read model records (only from
   * WS events and command responses).
   */
  readonly revisionPath?: JSONPathExpression

  /**
   * Derive cache key identities from WS event topics.
   * Called at WS ingestion to resolve which cache keys an event belongs to.
   * The returned identities are attached to the event before processing —
   * no further topic resolution happens downstream.
   *
   * @param topics - Topic strings from the WS event message
   * @returns Cache key identities or templates. Templates (no `.key`) are resolved
   *   by the caller via `registerCacheKeySync`.
   */
  cacheKeysFromTopics(
    topics: readonly string[],
  ): (CacheKeyIdentity<TLink> | CacheKeyTemplate<TLink>)[]

  /**
   * Auto-seed this collection on startup.
   * If undefined, this collection is not seeded on init — data must be
   * loaded on demand (e.g., via consumer-driven seeding on navigation).
   */
  readonly seedOnInit?: SeedOnInitConfig<TLink>

  /**
   * On-demand seeding configuration.
   * If undefined, this collection does not support on-demand (lazily-loaded) seeding.
   */
  readonly seedOnDemand?: SeedOnDemandConfig<TLink>

  /**
   * List-query settings — apply to both pull (`list`) and push (`watchList`).
   */
  readonly list?: {
    /**
     * Whether `total` is part of the list/watchList contract for this collection.
     *
     * When `false` (default), {@link ListQueryResult.total} is `undefined` and
     * `watchList` does not issue count re-fetches.
     *
     * When `true`, `list()` returns the cache-key-scoped row count as `total`,
     * and `watchList` issues a count re-fetch on `created` / `deleted` events
     * in a watched cache key so `total` stays current across off-page changes.
     * Tracked-id matches re-fetch the data page (and the total along with it).
     */
    readonly total?: boolean
    /**
     * Default sort applied when a `list` / `watchList` call does not
     * supply its own {@link ListParams.sort}. Reference declared custom
     * columns or library-owned columns (`id`, `updated_at`).
     */
    readonly defaultSort?: Sort
  }

  /**
   * Test whether a streamId belongs to this collection.
   * Called for WS events and command response events to route them.
   * Multiple collections may match the same streamId.
   */
  matchesStream(streamId: string): boolean

  /**
   * Fetch a page of pre-computed read model records for initial seeding.
   * This is the primary seeding mechanism — records go directly into the
   * read model store without event processing.
   *
   * If undefined, falls back to fetchSeedEvents (event-based seeding).
   * If neither is defined, seeding is skipped for this collection.
   */
  fetchSeedRecords?(opts: FetchSeedRecordOptions<TLink>): Promise<SeedRecordPage>

  /**
   * Fetch a page of events for initial seeding (fallback).
   * Events are processed through event processors to build read models.
   * Prefer fetchSeedRecords when the server provides read model endpoints.
   *
   * Only used if fetchSeedRecords is not defined.
   */
  fetchSeedEvents?(opts: FetchSeedEventOptions<TLink>): Promise<SeedEventPage>

  /**
   * Fetch per-stream events for gap recovery and command response processing.
   * If undefined, gap recovery processes buffered events as-is (lossy).
   */
  fetchStreamEvents?(opts: FetchStreamEventOptions): Promise<IPersistedEvent[]>

  /** Page size for seeding. Default: 100. */
  readonly seedPageSize?: number
}

export interface CollectionWithSeedOnInit<TLink extends Link> extends Collection<TLink> {
  readonly seedOnInit: SeedOnInitConfig<TLink>
}

export interface CollectionWithSeedOnDemand<TLink extends Link> extends Collection<TLink> {
  readonly seedOnDemand: SeedOnDemandConfig<TLink>
}

export interface CollectionWithFetchStreamEvents<TLink extends Link> extends Collection<TLink> {
  fetchStreamEvents(opts: FetchStreamEventOptions): Promise<IPersistedEvent[]>
}

export function isCollectionWithFetchStreamEvents<TLink extends Link>(
  c: Collection<TLink> | undefined,
): c is CollectionWithFetchStreamEvents<TLink> {
  if (!c?.fetchStreamEvents) return false
  return true
}

function injectCollectionDefaults<TLink extends Link>(
  collections: Collection<TLink>[] | undefined,
): Collection<TLink>[] | undefined {
  if (!collections) return undefined

  return collections.map((c) => {
    // check if collection is a composite collection when that is implemented
    if (!c.aggregate) return c

    // mutable reference
    const col = c as { idReferences?: readonly IdReference<TLink>[] }
    if (!col.idReferences) {
      col.idReferences = [{ aggregate: c.aggregate, path: '$.id' }]
    } else if (!col.idReferences.some((r) => r.path === '$.id')) {
      col.idReferences = [{ aggregate: c.aggregate, path: '$.id' }, ...col.idReferences]
    }

    return c
  })
}

function tryValidateRegistrationPath(path: JSONPathExpression, where: string): void {
  try {
    validatePath(path)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`${where}: ${message}`)
  }
}

function validateRegistrationPaths<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TSchema,
  TEvent extends IAnticipatedEvent,
>(resolved: ResolvedConfig<TLink, TCommand, TSchema, TEvent>): void {
  for (const collection of resolved.collections) {
    if (collection.revisionPath) {
      tryValidateRegistrationPath(
        collection.revisionPath,
        `Collection '${collection.name}' revisionPath`,
      )
    }
    if (collection.idReferences) {
      for (const ref of collection.idReferences) {
        tryValidateRegistrationPath(ref.path, `Collection '${collection.name}' idReference path`)
      }
    }
  }
  for (const handler of resolved.commandHandlers) {
    if (handler.commandIdReferences) {
      for (const ref of handler.commandIdReferences) {
        tryValidateRegistrationPath(
          ref.path,
          `Command '${handler.commandType}' commandIdReference path`,
        )
      }
    }
    if (handler.responseIdReferences) {
      for (const ref of handler.responseIdReferences) {
        tryValidateRegistrationPath(
          ref.path,
          `Command '${handler.commandType}' responseIdReference path`,
        )
        if (ref.revisionPath) {
          tryValidateRegistrationPath(
            ref.revisionPath,
            `Command '${handler.commandType}' responseIdReference revisionPath`,
          )
        }
      }
    }
  }
  for (const view of resolved.views) {
    for (const join of view.joinSources) {
      tryValidateRegistrationPath(
        join.referencedIdPath,
        `View '${view.name}' joinSource '${join.collection}' referencedIdPath`,
      )
      if (join.referencingIdPath !== undefined) {
        tryValidateRegistrationPath(
          join.referencingIdPath,
          `View '${view.name}' joinSource '${join.collection}' referencingIdPath`,
        )
      }
    }
  }
  for (const migration of resolved.storage.migrations) {
    for (const step of migration.steps) {
      if (step.type !== 'managed' || !step.columns) continue
      for (const column of step.columns) {
        if (column.path !== undefined) {
          tryValidateRegistrationPath(
            column.path,
            `Migration v${migration.version} collection '${step.name}' column '${column.name}' path`,
          )
        }
      }
    }
  }
}

function injectCommandHandlerDefaults<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TSchema,
  TEvent extends IAnticipatedEvent,
>(
  handlers: CommandHandlerRegistration<TLink, TCommand, TSchema, TEvent>[] | undefined,
): CommandHandlerRegistration<TLink, TCommand, TSchema, TEvent>[] {
  if (!handlers) return []
  return handlers.map((h) => applyCommandHandlerDefaults(h))
}

/**
 * Shared CQRS configuration.
 *
 * Contains all domain-level settings shared between the main thread and worker.
 * The consumer writes this once and imports it from both entry points.
 */
export interface CqrsConfig<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TSchema = unknown,
  TEvent extends IAnticipatedEvent = IAnticipatedEvent,
> {
  /**
   * Schema validator implementation for structural validation.
   * Required if any command handler registration has a `schema` property.
   * The generic `TSchema` enforces that the validator and all registrations
   * agree on the schema type (JSONSchema7, z.ZodType, etc.).
   */
  schemaValidator?: SchemaValidator<TSchema>

  /**
   * Aggregate registry and stream ID parser.
   */
  aggregates: ClientAggregatesConfig<TLink>

  /**
   * Command handler registrations for local validation and optimistic updates.
   * Each handler validates command data and produces anticipated events.
   * If not provided, commands are sent directly without local validation.
   */
  commandHandlers?: CommandHandlerRegistration<TLink, TCommand, TSchema, TEvent>[]

  /**
   * Auth strategy for transport-level authentication.
   * Controls how HTTP requests and WebSocket connections are authenticated.
   * Use `cookieAuthStrategy` for cookie-based auth (all hooks are noop).
   */
  auth: AuthStrategy

  /**
   * Network configuration.
   */
  network: NetworkConfig

  /**
   * Storage configuration.
   */
  storage: StorageConfig

  /**
   * Custom SQLite collating sequences. Registered against every database
   * connection the client opens; referenced from {@link CustomColumn.collation}
   * by name. The same comparator is used by the JS-side fallback sort in
   * Mode A so list ordering stays consistent across backends. See
   * {@link CollationConfig}.
   */
  collations?: readonly CollationConfig[]

  /**
   * Retry configuration for commands.
   */
  retry?: RetryConfig

  /**
   * Cache configuration.
   */
  cache?: CacheConfig

  /**
   * Collection configurations.
   */
  collections?: Collection<TLink>[]

  /**
   * Cross-collection view registrations. Each entry pairs a sync in-memory
   * implementation with an async SQL implementation; the library dispatches
   * based on the active storage backend.
   *
   * View names must be unique; duplicates throw at executor construction.
   * Each registration's `cacheKeys` callback resolves the declared keys per
   * call. {@link IQueryManager.getView} and {@link IQueryManager.watchView}
   * are both hold-agnostic — they touch the resolved identities (so any
   * existing holds don't age out) but don't pin them. `createViewQuery` in
   * `@cqrs-toolkit/client-solid` wraps `watchView` and holds the resolved
   * identities for the subscription's lifetime; direct `getView` /
   * `watchView` callers own whatever lifecycle they want.
   */
  views?: AnyViewRegistration<TLink>[]

  /**
   * Command sender for submitting commands to the server.
   * If not provided, commands are queued but not sent.
   */
  commandSender?: ICommandSender<TLink, TCommand>

  /**
   * Project-wide pluggable mapping from {@link ServerErrorResponse} (parsed
   * server error) to {@link FailureDescriptor}. Runs when no per-command
   * `mapFailure` on a {@link CommandHandlerRegistration} is defined for the
   * failing command type. Defaults to `defaultProblemJsonMapper` (RFC 9457
   * problem+json — the project's canonical error format) when omitted.
   *
   * Consumers using a different convention (ld+json, bespoke `body.name`,
   * etc.) supply their own implementation. Library-shipped helpers in
   * `core/failure-mapper` (`defaultStatusMapper`, `defaultLdJsonMapper`,
   * etc.) compose into custom mappers.
   *
   * Resolution: per-command `mapFailure` is the sole arbiter when defined
   * (no automatic cascade). Consumers wanting "global behaviour for non-
   * special cases" import this function reference directly inside the
   * per-command handler and call it explicitly.
   */
  mapFailure?: FailureMapper

  /**
   * Event processors to register.
   * Processors transform domain events into read model updates.
   */
  processors?: ProcessorRegistration[]

  /**
   * Retain terminal commands in storage for debugging/introspection.
   */
  retainTerminal?: boolean

  /**
   * Enable debug logging.
   */
  debug?: boolean

  /**
   * Logger to install via `logProvider.setLogger(...)` at bootstrap.
   *
   * When provided, the client honours it verbatim — consumers wiring Pino
   * or their own transport keep full control over level, format, and
   * destination. When omitted, the client falls back to the built-in
   * wiring: {@link EventBusLogger} in debug mode (so log calls land on
   * `client.events$` alongside library events) or a plain console logger
   * at `warn` otherwise.
   *
   * Applies on both main thread and worker — pass the same logger via the
   * shared config and both sides install it.
   */
  logger?: ILogger

  /**
   * Module URLs to dynamically import before initialization.
   * Use this to run setup code (e.g., logger bootstrap) inside the worker
   * before storage initialization.
   */
  workerSetup?: string[]
}

/**
 * Main-thread CQRS Client configuration.
 *
 * Extends the shared config with main-thread-only concerns:
 * mode selection and worker script URL.
 */
export interface CqrsClientConfig<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TSchema = unknown,
  TEvent extends IAnticipatedEvent = IAnticipatedEvent,
> extends CqrsConfig<TLink, TCommand, TSchema, TEvent> {
  /**
   * Execution mode.
   * Defaults to 'auto': SharedWorker > Dedicated Worker > Online-only
   */
  mode?: ClientModeConfig

  /**
   * SharedWorker script URL (Mode C) or DedicatedWorker script URL (Mode B).
   * Points to the consumer's worker entry point that calls
   * startDedicatedWorker() or startSharedWorker().
   */
  workerUrl?: string

  /**
   * Per-tab SQLite DedicatedWorker URL for Mode C.
   * Each tab spawns a DedicatedWorker at this URL for SQLite I/O
   * (OPFS `createSyncAccessHandle` requires a DedicatedWorker context).
   *
   * Required for shared-worker mode. Must be resolved on the main thread
   * where the bundler can process asset URL imports (e.g., Vite's
   * `?worker&url` suffix).
   */
  sqliteWorkerUrl?: string
}

/**
 * Default configuration values.
 */
export const DEFAULT_CONFIG = {
  mode: 'auto' as const,
  storage: {
    dbName: 'cqrs-client-sqlite',
  } satisfies Omit<StorageConfig, 'migrations'>,
  retry: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
  },
  cache: {
    maxCacheKeys: 1000,
    defaultTtl: 30 * 60 * 1000, // 30 minutes
    evictionPolicy: 'lru' as const,
    maxWindows: 10,
  },
  network: {
    timeout: 30000,
  },
} as const

/**
 * Resolved shared configuration with all defaults applied.
 */
export interface ResolvedConfig<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TSchema,
  TEvent extends IAnticipatedEvent,
> extends Required<
  Omit<
    CqrsConfig<TLink, TCommand, TSchema, TEvent>,
    | 'commandHandlers'
    | 'commandSender'
    | 'schemaValidator'
    | 'workerSetup'
    | 'collections'
    | 'processors'
    | 'logger'
    | 'views'
  >
> {
  commandHandlers: CommandHandlerRegistration<TLink, TCommand, TSchema, TEvent>[]
  commandSender?: ICommandSender<TLink, TCommand>
  schemaValidator?: SchemaValidator<unknown>
  workerSetup?: string[]
  collections: Collection<TLink>[]
  processors: ProcessorRegistration[]
  views: AnyViewRegistration<TLink>[]
  logger?: ILogger
}

/**
 * Resolve shared configuration with defaults.
 */
export function resolveConfig<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TSchema,
  TEvent extends IAnticipatedEvent,
>(
  config: CqrsConfig<TLink, TCommand, TSchema, TEvent>,
): ResolvedConfig<TLink, TCommand, TSchema, TEvent> {
  const resolved: ResolvedConfig<TLink, TCommand, TSchema, TEvent> = {
    aggregates: config.aggregates,
    commandHandlers: injectCommandHandlerDefaults(config.commandHandlers),
    commandSender: config.commandSender,
    mapFailure: config.mapFailure ?? defaultProblemJsonMapper,
    schemaValidator: config.schemaValidator,
    auth: config.auth,
    network: {
      ...DEFAULT_CONFIG.network,
      ...config.network,
    },
    storage: {
      dbName: config.storage.dbName ?? DEFAULT_CONFIG.storage.dbName,
      vfs: config.storage.vfs,
      migrations: config.storage.migrations,
    },
    collations: config.collations ?? [],
    retry: {
      ...DEFAULT_CONFIG.retry,
      ...config.retry,
    },
    cache: {
      ...DEFAULT_CONFIG.cache,
      ...config.cache,
    },
    collections: injectCollectionDefaults(config.collections) ?? [],
    processors: config.processors ?? [],
    views: config.views ?? [],
    retainTerminal: config.retainTerminal ?? false,
    debug: config.debug ?? hasDevtools(),
    logger: config.logger,
    workerSetup: config.workerSetup,
  }
  validateRegistrationPaths(resolved)
  return resolved
}

/**
 * Devtools-extension presence probe for the auto-default of `config.debug`.
 *
 * Returns `true` when `globalThis.__CQRS_TOOLKIT_DEVTOOLS__` is set — the
 * extension's content script installs this in MAIN world at document_start
 * on every URL while the extension is enabled, independent of whether the
 * devtools window is open.
 *
 * Page-side this works as expected: the hook is established before
 * `createCqrsClient` runs.
 *
 * Worker-side this returns `false` at worker startup — workers have no
 * `window` and the CDP-injected hook only arrives later, when the panel
 * attaches. The worker therefore resolves `debug` to `false` by default
 * and is upgraded to `true` when the page sends the `debug.enable` RPC
 * after itself resolving `debug = true`. The orchestrator's RPC handler
 * flips the worker-side debug-consuming components' mutable `debug` fields.
 *
 * An explicit `config.debug` value (`true` or `false`) takes precedence
 * over this probe in both contexts.
 */
export function hasDevtools(): boolean {
  if (typeof globalThis === 'undefined') return false
  // `globalThis` is sealed against arbitrary string indexing; the
  // extension installs `__CQRS_TOOLKIT_DEVTOOLS__` from outside this
  // package's type graph, so probe via a widened view.
  const g = globalThis as unknown as Record<string, unknown>
  return g['__CQRS_TOOLKIT_DEVTOOLS__'] !== undefined
}
