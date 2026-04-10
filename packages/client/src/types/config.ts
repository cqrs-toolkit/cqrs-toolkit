/**
 * Configuration types for the CQRS Client.
 */

import type { IPersistedEvent, Link } from '@meticoeus/ddd-es'
import type { AuthStrategy } from '../core/auth.js'
import type {
  CacheKeyIdentity,
  CacheKeyMatcher,
  CacheKeyTemplate,
} from '../core/cache-manager/CacheKey.js'
import type { IAnticipatedEvent } from '../core/command-lifecycle/AnticipatedEventShape.js'
import type { ICommandSender } from '../core/command-queue/types.js'
import type { ProcessorRegistration } from '../core/event-processor/types.js'
import type { AggregateConfig, DirectIdReference, IdReference } from './aggregates.js'
import { EnqueueCommand } from './commands.js'
import type { CommandHandlerRegistration, SchemaValidator } from './domain.js'

/**
 * Execution mode for the CQRS Client.
 */
export type ExecutionMode =
  | 'online-only' // Mode A: In-memory, no persistence
  | 'shared-worker' // Mode C: Multi-tab with SharedWorker orchestrator
  | 'dedicated-worker' // Mode B: Single-tab with Dedicated Worker

/**
 * Execution mode for client configuration.
 * Includes 'auto' which detects the best mode for the environment.
 */
export type ExecutionModeConfig = ExecutionMode | 'auto'

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
 * A managed read model collection.
 *
 * The library owns the table schema — `generateCollectionDDL(name)` creates
 * `rm_{name}` with the standard columns.
 */
export interface ManagedCollectionDef {
  type: 'managed'
  name: string
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
   * Command sender for submitting commands to the server.
   * If not provided, commands are queued but not sent.
   */
  commandSender?: ICommandSender<TLink, TCommand>

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
  mode?: ExecutionModeConfig

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
  >
> {
  commandHandlers: CommandHandlerRegistration<TLink, TCommand, TSchema, TEvent>[]
  commandSender?: ICommandSender<TLink, TCommand>
  schemaValidator?: SchemaValidator<unknown>
  workerSetup?: string[]
  collections: Collection<TLink>[]
  processors: ProcessorRegistration[]
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
  return {
    commandHandlers: config.commandHandlers ?? [],
    commandSender: config.commandSender,
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
    retainTerminal: config.retainTerminal ?? false,
    debug: config.debug ?? false,
    workerSetup: config.workerSetup,
  }
}
