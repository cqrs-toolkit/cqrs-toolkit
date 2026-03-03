/**
 * Dedicated Worker entry point for Mode C.
 *
 * This worker:
 * - Manages SQLite WASM storage
 * - Enforces single-tab operation via tab lock
 * - Broadcasts events to the connected window
 */

/// <reference lib="webworker" />

import { createConsoleLogger, logProvider } from '@meticoeus/ddd-es'
import assert from 'node:assert'
import { EventBus } from '../../core/events/EventBus.js'
import { WorkerMessageHandler } from '../../protocol/MessageChannel.js'
import type { IStorage } from '../../storage/IStorage.js'
import { SQLiteStorage } from '../../storage/SQLiteStorage.js'

// Set a default warn-level console logger so logProvider doesn't throw before consumer setup
logProvider.setLogger(createConsoleLogger({ level: 'warn' }))

declare const self: DedicatedWorkerGlobalScope

/**
 * Storage worker implementation for Dedicated Worker mode.
 */
class DedicatedStorageWorker {
  private readonly messageHandler: WorkerMessageHandler
  private readonly eventBus: EventBus
  private storage: IStorage | undefined

  constructor() {
    this.messageHandler = new WorkerMessageHandler()
    this.eventBus = new EventBus()

    // Register worker setup and storage methods
    this.registerWorkerSetup()
    this.registerStorageMethods()

    // Subscribe to internal events and broadcast to window
    this.eventBus.events$.subscribe((event) => {
      this.messageHandler.broadcastEvent(event.type, event.payload)
    })
  }

  /**
   * Handle a message from the window.
   */
  handleMessage(event: MessageEvent): void {
    this.messageHandler.handleMessageEvent(event)
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
    this.messageHandler.registerMethod('storage.initialize', async () => {
      if (!this.storage) {
        this.storage = new SQLiteStorage({
          vfs: 'opfs',
          dbName: 'cqrs-client',
        })
        await this.storage.initialize()
      }
    })

    this.messageHandler.registerMethod('storage.close', async () => {
      if (this.storage) {
        await this.storage.close()
        this.storage = undefined
      }
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

    this.messageHandler.registerMethod('storage.holdCacheKey', async (args) => {
      return this.getStorage().holdCacheKey(args[0] as string)
    })

    this.messageHandler.registerMethod('storage.releaseCacheKey', async (args) => {
      return this.getStorage().releaseCacheKey(args[0] as string)
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
}

// Create worker instance
const worker = new DedicatedStorageWorker()

// Handle messages
self.onmessage = (event: MessageEvent) => {
  worker.handleMessage(event)
}
