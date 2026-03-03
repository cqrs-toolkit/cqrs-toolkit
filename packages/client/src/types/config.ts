/**
 * Configuration types for the CQRS Client.
 */

import type { ICommandSender } from '../core/command-queue/types.js'
import type { ProcessorRegistration } from '../core/event-processor/types.js'
import type { IDomainExecutor } from './domain.js'

/**
 * Execution mode for the CQRS Client.
 */
export type ExecutionMode =
  | 'online-only' // Mode A: In-memory, no persistence
  | 'shared-worker' // Mode B: Multi-tab with SharedWorker
  | 'dedicated-worker' // Mode C: Single-tab with Dedicated Worker
  | 'main-thread' // Mode D: Single-tab on main thread

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
  /** Function to get auth token */
  getAuthToken?: () => Promise<string | null>
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
}

/**
 * Collection configuration for sync.
 */
export interface CollectionConfig {
  /** Collection name */
  name: string
  /** WebSocket topic pattern for subscribing (e.g., "Todo:*"). If omitted, no WS subscription is sent for this collection. */
  topicPattern?: string
  /**
   * URL path template for fetching per-stream events (gap recovery).
   * `{id}` is replaced with the aggregate ID extracted from the streamId.
   * Example: '/notes/{id}/events'
   */
  streamEventsEndpoint?: string
  /** Sync priority (lower = higher priority) */
  priority?: number
  /** Whether to seed on initial sync */
  seedOnInit?: boolean
  /** Page size for seeding */
  seedPageSize?: number
}

/**
 * Main CQRS Client configuration.
 */
export interface CqrsClientConfig<TCommand = unknown, TEvent = unknown> {
  /**
   * Execution mode.
   * Defaults to 'auto': SharedWorker > Dedicated Worker > Main Thread
   */
  mode?: ExecutionModeConfig

  /**
   * Domain executor for local command validation.
   * If not provided, commands are sent directly without local validation.
   */
  domainExecutor?: IDomainExecutor<TCommand, TEvent>

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
  collections?: CollectionConfig[]

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
   * Worker script URL (for modes B and C).
   * If not provided, uses default bundled worker.
   */
  workerUrl?: string

  /**
   * Module URLs to dynamically import in worker context.
   * Use this to run setup code (e.g., logger bootstrap) inside the worker
   * before storage initialization.
   */
  workerSetup?: string[]
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
  },
  network: {
    timeout: 30000,
  },
} as const

/**
 * Resolved configuration with all defaults applied.
 */
export interface ResolvedConfig<TCommand = unknown, TEvent = unknown> extends Required<
  Omit<
    CqrsClientConfig<TCommand, TEvent>,
    'domainExecutor' | 'commandSender' | 'workerUrl' | 'workerSetup' | 'collections' | 'processors'
  >
> {
  domainExecutor?: IDomainExecutor<TCommand, TEvent>
  commandSender?: ICommandSender
  workerUrl?: string
  workerSetup?: string[]
  collections: CollectionConfig[]
  processors: ProcessorRegistration[]
}

/**
 * Resolve configuration with defaults.
 */
export function resolveConfig<TCommand, TEvent>(
  config: CqrsClientConfig<TCommand, TEvent>,
): ResolvedConfig<TCommand, TEvent> {
  return {
    mode: config.mode ?? DEFAULT_CONFIG.mode,
    domainExecutor: config.domainExecutor,
    commandSender: config.commandSender,
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
    workerUrl: config.workerUrl,
    workerSetup: config.workerSetup,
  }
}
