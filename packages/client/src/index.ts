/**
 * @swifttt/cqrs-client
 *
 * Offline-capable CQRS/event-sourcing client library.
 *
 * @packageDocumentation
 */

// Public entry point
export { CqrsClient, createCqrsClient } from './createCqrsClient.js'
export type { CqrsClientSyncManager } from './createCqrsClient.js'

// Auto-detection
export { detectMode } from './core/detectMode.js'

// Types
export * from './types/index.js'

// Storage
export {
  ALL_TABLES,
  InMemoryStorage,
  MIGRATIONS,
  SQLiteStorage,
  getPendingMigrations,
  getSchemaVersion,
} from './storage/index.js'
export type {
  CacheKeyRecord,
  CachedEventRecord,
  IStorage,
  Migration,
  QueryOptions,
  ReadModelRecord,
  SQLiteStorageConfig,
  SessionRecord,
  VfsType,
} from './storage/index.js'

// Core components
export {
  CACHE_KEY_NAMESPACE as CACHE_KEY_NS,
  CacheManager,
  deriveCacheKey as deriveCacheKeyFromManager,
  deriveScopedCacheKey,
} from './core/cache-manager/index.js'
export type { AcquireCacheKeyOptions, CacheManagerConfig } from './core/cache-manager/index.js'
export { CommandQueue, CommandSendError } from './core/command-queue/index.js'
export type {
  CommandQueueConfig,
  ICommandQueue,
  ICommandSender,
} from './core/command-queue/index.js'
export { EventCache, GapBuffer } from './core/event-cache/index.js'
export type { CacheEventOptions, EventCacheConfig, EventGap } from './core/event-cache/index.js'
export { EventProcessorRegistry, EventProcessorRunner } from './core/event-processor/index.js'
export type {
  EventProcessor,
  EventProcessorRunnerConfig,
  ParsedEvent,
  ProcessorContext,
  ProcessorRegistration,
  ProcessorResult,
  UpdateOperation,
} from './core/event-processor/index.js'
export { EventBus } from './core/events/index.js'
export { QueryManager } from './core/query-manager/index.js'
export type {
  ListQueryResult,
  QueryManagerConfig,
  QueryOptions as QueryManagerQueryOptions,
  QueryResult,
} from './core/query-manager/index.js'
export { ReadModelStore } from './core/read-model-store/index.js'
export type {
  ReadModel,
  ReadModelQueryOptions,
  ReadModelStoreConfig,
} from './core/read-model-store/index.js'
export { SessionManager } from './core/session/index.js'
export type { AuthState, SessionManagerConfig, SessionState } from './core/session/index.js'
export { ConnectivityManager, SyncManager } from './core/sync-manager/index.js'
export type {
  CollectionSyncStatus,
  ConnectivityManagerConfig,
  ConnectivityState,
  SyncManagerConfig,
} from './core/sync-manager/index.js'

// Adapters
export {
  BaseAdapter,
  DedicatedWorkerAdapter,
  DedicatedWorkerStorageProxy,
  MainThreadAdapter,
  MainThreadTabLockError,
  OnlineOnlyAdapter,
  SharedWorkerAdapter,
  SharedWorkerStorageProxy,
  TabLockError,
} from './adapters/index.js'
export type {
  AdapterStatus,
  DedicatedWorkerAdapterConfig,
  IAdapter,
  SharedWorkerAdapterConfig,
} from './adapters/index.js'

// Protocol (for worker communication)
export * as protocol from './protocol/index.js'

// Utilities
export {
  CACHE_KEY_NAMESPACE,
  DEFAULT_RETRY_CONFIG,
  calculateBackoffDelay,
  deriveCacheKey,
  deriveId,
  generateId,
  retryWithBackoff,
  shouldRetry,
  sleep,
} from './utils/index.js'

// Testing utilities (separate export for tree-shaking)
export * as testing from './testing/index.js'
