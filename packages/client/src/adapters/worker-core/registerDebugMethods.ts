/**
 * Registers debug RPC methods on the worker message handler.
 * Called lazily on the first `debug.enable` RPC — not at startup.
 */

import type { CacheManager } from '../../core/cache-manager/CacheManager.js'
import type { CommandQueue } from '../../core/command-queue/CommandQueue.js'
import type { SyncManager } from '../../core/sync-manager/SyncManager.js'
import type { WorkerMessageHandler } from '../../protocol/MessageChannel.js'
import type { IStorage } from '../../storage/IStorage.js'

/**
 * Dependencies needed for debug snapshot methods.
 */
export interface DebugMethodDeps {
  commandQueue: CommandQueue
  cacheManager: CacheManager
  syncManager: SyncManager
  storage: IStorage
}

/**
 * Register debug snapshot RPC methods on the worker message handler.
 */
export function registerDebugMethods(handler: WorkerMessageHandler, deps: DebugMethodDeps): void {
  const { commandQueue, cacheManager, syncManager, storage } = deps

  handler.registerMethod('debug.getCommandSnapshot', async () => {
    return commandQueue.listCommands()
  })

  handler.registerMethod('debug.getCacheKeySnapshot', async () => {
    return storage.getAllCacheKeys()
  })

  handler.registerMethod('debug.getCollectionSyncStatus', async () => {
    return syncManager.getAllStatus()
  })

  handler.registerMethod('debug.getReadModels', async (args) => {
    const collection = args[0] as string
    return storage.getReadModelsByCollection(collection)
  })

  handler.registerMethod('debug.getCachedEvents', async (args) => {
    const params = args[0] as { cacheKey?: string; streamId?: string } | undefined
    if (params?.cacheKey) {
      return storage.getCachedEventsByCacheKey(params.cacheKey)
    }
    if (params?.streamId) {
      return storage.getCachedEventsByStream(params.streamId)
    }
    return []
  })

  handler.registerMethod('debug.getStorageStats', async () => {
    const [cacheKeys, readModelCount] = await Promise.all([
      storage.getAllCacheKeys(),
      storage.getReadModelCount(),
    ])
    return {
      cacheKeyCount: cacheKeys.length,
      readModelCount,
    }
  })
}
