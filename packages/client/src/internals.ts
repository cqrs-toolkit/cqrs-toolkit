/**
 * Internal API for sibling packages in this monorepo.
 *
 * These exports are NOT part of the public API and may change without notice.
 * External consumers: use the main entry point (`@cqrs-toolkit/client`) instead.
 */

// Worker orchestration (utility/worker process side)
export { registerCacheManagerMethods } from './adapters/worker-core/registerCacheManagerMethods.js'
export { registerCommandQueueMethods } from './adapters/worker-core/registerCommandQueueMethods.js'
export { registerDebugMethods } from './adapters/worker-core/registerDebugMethods.js'
export { registerQueryManagerMethods } from './adapters/worker-core/registerQueryManagerMethods.js'
export { registerSyncManagerMethods } from './adapters/worker-core/registerSyncManagerMethods.js'

// Proxy classes (renderer/main-thread side)
export { CacheManagerProxy } from './adapters/proxy/CacheManagerProxy.js'
export { CommandQueueProxy } from './adapters/proxy/CommandQueueProxy.js'
export { ConnectivityProxy } from './adapters/proxy/ConnectivityProxy.js'
export { QueryManagerProxy } from './adapters/proxy/QueryManagerProxy.js'
export { SyncManagerProxy } from './adapters/proxy/SyncManagerProxy.js'

// Command lifecycle (needed by custom bootstraps like Electron)
export { AnticipatedEventHandler } from './core/command-lifecycle/AnticipatedEventHandler.js'
export { createCommandResponseHandler } from './core/command-lifecycle/createCommandResponseHandler.js'

// Write queue
export { WriteQueue } from './core/write-queue/WriteQueue.js'

// Domain executor
export { createDomainExecutor } from './types/domain.js'

// Command file store interface
export type { ICommandFileStore } from './core/command-queue/file-store/ICommandFileStore.js'

// Connectivity manager interface for alternative implementations (e.g., Node.js)
export { AbstractConnectivityManager } from './core/sync-manager/AbstractConnectivityManager.js'
export type { IConnectivityManager } from './core/sync-manager/IConnectivityManager.js'

// Internal interfaces for sibling packages that wire up concrete classes
export type { ICacheManagerInternal } from './core/cache-manager/types.js'
export type { ICommandQueueInternal } from './core/command-queue/types.js'
export type { IQueryManagerInternal } from './core/query-manager/types.js'

// Storage types needed by alternative ISqliteDb implementations
export type { BatchResult, SqliteBatchStatement } from './storage/ISqliteDb.js'
