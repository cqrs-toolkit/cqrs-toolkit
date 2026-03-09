/**
 * Configuration types for the CQRS Client.
 */

import type { IPersistedEvent } from '@meticoeus/ddd-es'
import type { AuthStrategy } from '../core/auth.js'
import type { ICommandSender } from '../core/command-queue/types.js'
import type { ProcessorRegistration } from '../core/event-processor/types.js'
import type { IDomainExecutor } from './domain.js'

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
 * Storage configuration.
 */
export interface StorageConfig {
  /** Database name/path */
  dbName?: string
  /** VFS type (auto-selected based on mode if not specified) */
  vfs?: SqliteVfsType
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
 */
export interface FetchContext {
  readonly baseUrl: string
  readonly headers: Record<string, string>
  readonly signal: AbortSignal
}

/**
 * A read model record returned from a seed endpoint.
 */
export interface SeedRecord {
  id: string
  data: Record<string, unknown>
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
 * A synchronized event collection.
 *
 * Collections define how the library discovers, fetches, and routes events.
 * Consumer code implements the fetch methods to control HTTP conventions.
 */
export interface Collection {
  readonly name: string

  /** WS topic patterns to subscribe to. Return [] for no subscription. */
  getTopics(): string[]

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
  fetchSeedRecords?(
    ctx: FetchContext,
    cursor: string | null,
    limit: number,
  ): Promise<SeedRecordPage>

  /**
   * Fetch a page of events for initial seeding (fallback).
   * Events are processed through event processors to build read models.
   * Prefer fetchSeedRecords when the server provides read model endpoints.
   *
   * Only used if fetchSeedRecords is not defined.
   */
  fetchSeedEvents?(ctx: FetchContext, cursor: string | null, limit: number): Promise<SeedEventPage>

  /**
   * Fetch per-stream events for gap recovery and command response processing.
   * If undefined, gap recovery processes buffered events as-is (lossy).
   */
  fetchStreamEvents?(
    ctx: FetchContext,
    streamId: string,
    afterRevision: bigint,
  ): Promise<IPersistedEvent[]>

  /** Whether to seed on initial sync. Default: true. */
  readonly seedOnInit?: boolean

  /** Page size for seeding. Default: 100. */
  readonly seedPageSize?: number
}

/**
 * Shared CQRS configuration.
 *
 * Contains all domain-level settings shared between the main thread and worker.
 * The consumer writes this once and imports it from both entry points.
 */
export interface CqrsConfig<TCommand = unknown, TEvent = unknown> {
  /**
   * Domain executor for local command validation.
   * If not provided, commands are sent directly without local validation.
   */
  domainExecutor?: IDomainExecutor<TCommand, TEvent>

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
   * Storage configuration (ignored for online-only mode).
   */
  storage?: StorageConfig

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
  collections?: Collection[]

  /**
   * Command sender for submitting commands to the server.
   * If not provided, commands are queued but not sent.
   */
  commandSender?: ICommandSender

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
export interface CqrsClientConfig<TCommand = unknown, TEvent = unknown> extends CqrsConfig<
  TCommand,
  TEvent
> {
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
    dbName: 'cqrs-client',
  },
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
export interface ResolvedConfig<TCommand = unknown, TEvent = unknown> extends Required<
  Omit<
    CqrsConfig<TCommand, TEvent>,
    'domainExecutor' | 'commandSender' | 'workerSetup' | 'collections' | 'processors'
  >
> {
  domainExecutor?: IDomainExecutor<TCommand, TEvent>
  commandSender?: ICommandSender
  workerSetup?: string[]
  collections: Collection[]
  processors: ProcessorRegistration[]
}

/**
 * Resolve shared configuration with defaults.
 */
export function resolveConfig<TCommand, TEvent>(
  config: CqrsConfig<TCommand, TEvent>,
): ResolvedConfig<TCommand, TEvent> {
  return {
    domainExecutor: config.domainExecutor,
    commandSender: config.commandSender,
    auth: config.auth,
    network: {
      ...DEFAULT_CONFIG.network,
      ...config.network,
    },
    storage: {
      ...DEFAULT_CONFIG.storage,
      ...config.storage,
    },
    retry: {
      ...DEFAULT_CONFIG.retry,
      ...config.retry,
    },
    cache: {
      ...DEFAULT_CONFIG.cache,
      ...config.cache,
    },
    collections: config.collections ?? [],
    processors: config.processors ?? [],
    retainTerminal: config.retainTerminal ?? false,
    debug: config.debug ?? false,
    workerSetup: config.workerSetup,
  }
}
