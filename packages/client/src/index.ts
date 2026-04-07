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

// Auth
export { cookieAuthStrategy } from './core/auth.js'
export type { AuthStrategy } from './core/auth.js'

// Auto-detection
export { detectMode } from './core/detectMode.js'

// Types
export * from './types/index.js'

// Anticipated event shape
export type { IAnticipatedEvent } from './core/command-lifecycle/AnticipatedEventShape.js'

// Storage
export {
  InMemoryStorage,
  LocalSqliteDb,
  SQLiteStorage,
  clientSchema,
  loadAndOpenDb,
} from './storage/index.js'
export type {
  CacheKeyRecord,
  CachedEventRecord,
  ClientMetadata,
  ISqliteDb,
  IStorage,
  IStorageQueryOptions,
  LoadAndOpenDbConfig,
  ReadModelRecord,
  SQLiteStorageConfig,
  SessionRecord,
  VfsType,
} from './storage/index.js'

// Core components
export {
  CACHE_KEY_NAMESPACE as CACHE_KEY_NS,
  CacheManager,
  deriveEntityKey,
  deriveScopeKey,
  hydrateCacheKeyIdentity,
  matchesCacheKey,
} from './core/cache-manager/index.js'
export type {
  AcquireCacheKeyOptions,
  CacheKeyIdentity,
  CacheKeyMatcher,
  CacheManagerConfig,
  EntityCacheKey,
  EntityKeyMatcher,
  ICacheManager,
  ScopeCacheKey,
  ScopeKeyMatcher,
} from './core/cache-manager/index.js'
export { CommandQueue, CommandSendException } from './core/command-queue/index.js'
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
  InvalidateSignal,
  ParsedEvent,
  ProcessEventResult,
  ProcessorContext,
  ProcessorRegistration,
  ProcessorResult,
  ProcessorReturn,
  UpdateOperation,
} from './core/event-processor/index.js'
export { EventBus } from './core/events/index.js'
export { QueryManager, StableRefQueryManager } from './core/query-manager/index.js'
export type {
  CollectionSignal,
  GetByIdParams,
  GetByIdsParams,
  IQueryManager,
  ItemMeta,
  ListParams,
  ListQueryResult,
  QueryManagerConfig,
  QueryOptions,
  QueryResult,
} from './core/query-manager/index.js'
export { ReadModelStore } from './core/read-model-store/index.js'
export type {
  ReadModel,
  ReadModelQueryOptions,
  ReadModelStoreConfig,
  RevisionMeta,
} from './core/read-model-store/index.js'
export { SessionManager } from './core/session/index.js'
export type { AuthState, SessionManagerConfig, SessionState } from './core/session/index.js'
export { ConnectivityManager, SyncManager } from './core/sync-manager/index.js'
export type {
  CollectionSyncStatus,
  ConnectivityManagerConfig,
  ConnectivityState,
  IConnectivity,
  WsConnectionState,
} from './core/sync-manager/index.js'

// Adapters
export {
  DedicatedWorkerAdapter,
  OnlineOnlyAdapter,
  SharedWorkerAdapter,
  TabLockError,
} from './adapters/index.js'
export type {
  AdapterStatus,
  DedicatedWorkerAdapterConfig,
  IAdapter,
  IWindowAdapter,
  IWorkerAdapter,
  SharedWorkerAdapterConfig,
} from './adapters/index.js'

// Worker entry points (consumer calls from their worker script)
export {
  OpfsUnavailableException,
  startDedicatedWorker,
  startSharedWorker,
  startSqliteWorker,
} from './adapters/worker-core/index.js'

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
  serializeBigint,
  shouldRetry,
  sleep,
} from './utils/index.js'

// Testing utilities (separate export for tree-shaking)
export * as testing from './testing/index.js'
