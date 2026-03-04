/**
 * SharedWorker entry point for Mode B.
 *
 * This worker:
 * - Manages SQLite WASM storage
 * - Handles window registrations and heartbeats
 * - Broadcasts events to all connected windows
 * - Enforces single-writer model
 */

/// <reference lib="webworker" />

import { createConsoleLogger, logProvider } from '@meticoeus/ddd-es'
import { EventBus } from '../../core/events/EventBus.js'
import { WorkerMessageHandler } from '../../protocol/MessageChannel.js'
import type { IStorage } from '../../storage/IStorage.js'
import { SQLiteStorage } from '../../storage/SQLiteStorage.js'
import type { StorageConfig } from '../../types/config.js'
import { assert } from '../../utils/assert.js'

// Set a default warn-level console logger so logProvider doesn't throw before consumer setup
logProvider.setLogger(createConsoleLogger({ level: 'warn' }))

declare const self: SharedWorkerGlobalScope

/**
 * Window TTL for liveness detection (30 seconds).
 */
const WINDOW_TTL_MS = 30000

/**
 * Liveness check interval (10 seconds).
 */
const LIVENESS_CHECK_INTERVAL_MS = 10000

/**
 * Storage worker implementation.
 */
class StorageWorker {
  private readonly messageHandler: WorkerMessageHandler
  private readonly eventBus: EventBus
  private storage: IStorage | undefined
  private livenessCheckInterval: ReturnType<typeof setInterval> | undefined

  /** Active window holds by cache key */
  private readonly activeWindowIdsByKey = new Map<string, Set<string>>()

  constructor() {
    this.messageHandler = new WorkerMessageHandler()
    this.eventBus = new EventBus()

    // Register worker setup and storage methods
    this.registerWorkerSetup()
    this.registerStorageMethods()

    // Subscribe to internal events and broadcast to windows
    this.eventBus.events$.subscribe((event) => {
      this.messageHandler.broadcastEvent(event.type, event.payload)
    })

    // Start liveness check
    this.startLivenessCheck()

    // Release holds when a window is removed
    this.messageHandler.onWindowRemoved(async (windowId) => {
      await this.releaseWindowHolds(windowId)
    })

    // Handle hold restoration after worker restart
    this.messageHandler.setRestoreHoldsHandler(async (data) => {
      const restoredKeys: string[] = []
      const failedKeys: string[] = []
      const storage = this.storage

      if (!storage) {
        return { restoredKeys: [], failedKeys: data.cacheKeys }
      }

      for (const key of data.cacheKeys) {
        const cacheKey = await storage.getCacheKey(key)
        if (cacheKey) {
          await storage.holdCacheKey(key)
          this.trackWindowHold(data.windowId, key)
          restoredKeys.push(key)
        } else {
          failedKeys.push(key)
        }
      }

      return { restoredKeys, failedKeys }
    })
  }

  /**
   * Handle a new connection.
   */
  handleConnect(port: MessagePort): void {
    this.messageHandler.handleConnect(port)
  }

  private registerWorkerSetup(): void {
    this.messageHandler.registerMethod('worker.setup', async (args) => {
      const scripts = args[0] as string[]
      for (const url of scripts) {
        await import(/* @vite-ignore */ url)
      }
    })
  }

  private registerStorageMethods(): void {
    // Initialization
    this.messageHandler.registerMethod('storage.initialize', async (args) => {
      if (!this.storage) {
        const config = args[0] as StorageConfig | undefined
        this.storage = new SQLiteStorage({
          vfs: config?.vfs ?? 'opfs',
          dbName: config?.dbName ?? 'cqrs-client',
        })
        await this.storage.initialize()
      }
    })

    this.messageHandler.registerMethod('storage.close', async () => {
      // No-op: SharedWorker manages its own storage lifecycle.
      // Individual windows must not close shared storage.
    })

    this.messageHandler.registerMethod('storage.clear', async () => {
      return this.getStorage().clear()
    })

    // Session methods
    this.messageHandler.registerMethod('storage.getSession', async () => {
      return this.getStorage().getSession()
    })

    this.messageHandler.registerMethod('storage.saveSession', async (args) => {
      return this.getStorage().saveSession(args[0] as Parameters<IStorage['saveSession']>[0])
    })

    this.messageHandler.registerMethod('storage.deleteSession', async () => {
      return this.getStorage().deleteSession()
    })

    this.messageHandler.registerMethod('storage.touchSession', async () => {
      return this.getStorage().touchSession()
    })

    // Cache key methods
    this.messageHandler.registerMethod('storage.getCacheKey', async (args) => {
      return this.getStorage().getCacheKey(args[0] as string)
    })

    this.messageHandler.registerMethod('storage.getAllCacheKeys', async () => {
      return this.getStorage().getAllCacheKeys()
    })

    this.messageHandler.registerMethod('storage.saveCacheKey', async (args) => {
      return this.getStorage().saveCacheKey(args[0] as Parameters<IStorage['saveCacheKey']>[0])
    })

    this.messageHandler.registerMethod('storage.deleteCacheKey', async (args) => {
      return this.getStorage().deleteCacheKey(args[0] as string)
    })

    this.messageHandler.registerMethod('storage.holdCacheKey', async (args, context) => {
      const key = args[0] as string
      await this.getStorage().holdCacheKey(key)
      if (context.windowId) {
        this.trackWindowHold(context.windowId, key)
      }
    })

    this.messageHandler.registerMethod('storage.releaseCacheKey', async (args, context) => {
      const key = args[0] as string
      await this.getStorage().releaseCacheKey(key)
      if (context.windowId) {
        this.untrackWindowHold(context.windowId, key)
      }
    })

    this.messageHandler.registerMethod('storage.touchCacheKey', async (args) => {
      return this.getStorage().touchCacheKey(args[0] as string)
    })

    this.messageHandler.registerMethod('storage.getEvictableCacheKeys', async (args) => {
      return this.getStorage().getEvictableCacheKeys(args[0] as number)
    })

    // Command methods
    this.messageHandler.registerMethod('storage.getCommand', async (args) => {
      return this.getStorage().getCommand(args[0] as string)
    })

    this.messageHandler.registerMethod('storage.getCommands', async (args) => {
      return this.getStorage().getCommands(args[0] as Parameters<IStorage['getCommands']>[0])
    })

    this.messageHandler.registerMethod('storage.getCommandsByStatus', async (args) => {
      return this.getStorage().getCommandsByStatus(
        args[0] as Parameters<IStorage['getCommandsByStatus']>[0],
      )
    })

    this.messageHandler.registerMethod('storage.getCommandsBlockedBy', async (args) => {
      return this.getStorage().getCommandsBlockedBy(args[0] as string)
    })

    this.messageHandler.registerMethod('storage.saveCommand', async (args) => {
      return this.getStorage().saveCommand(args[0] as Parameters<IStorage['saveCommand']>[0])
    })

    this.messageHandler.registerMethod('storage.updateCommand', async (args) => {
      return this.getStorage().updateCommand(
        args[0] as string,
        args[1] as Parameters<IStorage['updateCommand']>[1],
      )
    })

    this.messageHandler.registerMethod('storage.deleteCommand', async (args) => {
      return this.getStorage().deleteCommand(args[0] as string)
    })

    this.messageHandler.registerMethod('storage.deleteAllCommands', async () => {
      return this.getStorage().deleteAllCommands()
    })

    // Cached event methods
    this.messageHandler.registerMethod('storage.getCachedEvent', async (args) => {
      return this.getStorage().getCachedEvent(args[0] as string)
    })

    this.messageHandler.registerMethod('storage.getCachedEventsByCacheKey', async (args) => {
      return this.getStorage().getCachedEventsByCacheKey(args[0] as string)
    })

    this.messageHandler.registerMethod('storage.getCachedEventsByStream', async (args) => {
      return this.getStorage().getCachedEventsByStream(args[0] as string)
    })

    this.messageHandler.registerMethod('storage.getAnticipatedEventsByCommand', async (args) => {
      return this.getStorage().getAnticipatedEventsByCommand(args[0] as string)
    })

    this.messageHandler.registerMethod('storage.saveCachedEvent', async (args) => {
      return this.getStorage().saveCachedEvent(
        args[0] as Parameters<IStorage['saveCachedEvent']>[0],
      )
    })

    this.messageHandler.registerMethod('storage.saveCachedEvents', async (args) => {
      return this.getStorage().saveCachedEvents(
        args[0] as Parameters<IStorage['saveCachedEvents']>[0],
      )
    })

    this.messageHandler.registerMethod('storage.deleteCachedEvent', async (args) => {
      return this.getStorage().deleteCachedEvent(args[0] as string)
    })

    this.messageHandler.registerMethod('storage.deleteAnticipatedEventsByCommand', async (args) => {
      return this.getStorage().deleteAnticipatedEventsByCommand(args[0] as string)
    })

    this.messageHandler.registerMethod('storage.deleteCachedEventsByCacheKey', async (args) => {
      return this.getStorage().deleteCachedEventsByCacheKey(args[0] as string)
    })

    // Read model methods
    this.messageHandler.registerMethod('storage.getReadModel', async (args) => {
      return this.getStorage().getReadModel(args[0] as string, args[1] as string)
    })

    this.messageHandler.registerMethod('storage.getReadModelsByCollection', async (args) => {
      return this.getStorage().getReadModelsByCollection(
        args[0] as string,
        args[1] as Parameters<IStorage['getReadModelsByCollection']>[1],
      )
    })

    this.messageHandler.registerMethod('storage.getReadModelsByCacheKey', async (args) => {
      return this.getStorage().getReadModelsByCacheKey(args[0] as string)
    })

    this.messageHandler.registerMethod('storage.saveReadModel', async (args) => {
      return this.getStorage().saveReadModel(args[0] as Parameters<IStorage['saveReadModel']>[0])
    })

    this.messageHandler.registerMethod('storage.saveReadModels', async (args) => {
      return this.getStorage().saveReadModels(args[0] as Parameters<IStorage['saveReadModels']>[0])
    })

    this.messageHandler.registerMethod('storage.deleteReadModel', async (args) => {
      return this.getStorage().deleteReadModel(args[0] as string, args[1] as string)
    })

    this.messageHandler.registerMethod('storage.deleteReadModelsByCacheKey', async (args) => {
      return this.getStorage().deleteReadModelsByCacheKey(args[0] as string)
    })

    this.messageHandler.registerMethod('storage.deleteReadModelsByCollection', async (args) => {
      return this.getStorage().deleteReadModelsByCollection(args[0] as string)
    })
  }

  private getStorage(): IStorage {
    assert(this.storage, 'Storage not initialized')
    return this.storage
  }

  private startLivenessCheck(): void {
    this.livenessCheckInterval = setInterval(() => {
      this.checkWindowLiveness().catch((err) => {
        logProvider.log.error({ err }, 'Liveness check failed')
      })
    }, LIVENESS_CHECK_INTERVAL_MS)
  }

  private async checkWindowLiveness(): Promise<void> {
    const deadWindows = this.messageHandler.getDeadWindows(WINDOW_TTL_MS)
    for (const windowId of deadWindows) {
      await this.messageHandler.removeWindow(windowId)
    }
  }

  private async releaseWindowHolds(windowId: string): Promise<void> {
    const storage = this.storage
    if (!storage) return

    for (const [cacheKey, windowIds] of this.activeWindowIdsByKey) {
      if (windowIds.has(windowId)) {
        windowIds.delete(windowId)

        if (windowIds.size === 0) {
          this.activeWindowIdsByKey.delete(cacheKey)
          await storage.releaseCacheKey(cacheKey)
        }
      }
    }
  }

  /**
   * Track a window hold on a cache key.
   */
  trackWindowHold(windowId: string, cacheKey: string): void {
    let windowIds = this.activeWindowIdsByKey.get(cacheKey)
    if (!windowIds) {
      windowIds = new Set()
      this.activeWindowIdsByKey.set(cacheKey, windowIds)
    }
    windowIds.add(windowId)
  }

  /**
   * Untrack a window hold on a cache key.
   */
  untrackWindowHold(windowId: string, cacheKey: string): void {
    const windowIds = this.activeWindowIdsByKey.get(cacheKey)
    if (windowIds) {
      windowIds.delete(windowId)
      if (windowIds.size === 0) {
        this.activeWindowIdsByKey.delete(cacheKey)
      }
    }
  }
}

// Create worker instance
const worker = new StorageWorker()

// Handle connections
self.onconnect = (event: MessageEvent) => {
  const port = event.ports[0]
  if (port) {
    worker.handleConnect(port)
  }
}
