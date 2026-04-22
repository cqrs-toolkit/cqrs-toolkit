/**
 * Utility process entry point for the Electron CQRS worker.
 *
 * Builds the full CQRS component stack directly — no WorkerOrchestrator.
 * This bootstrap is Electron-specific: it uses BetterSqliteDb for storage,
 * FsCommandFileStore for file uploads, and NodeConnectivityManager for
 * network detection (no navigator.onLine in Node.js).
 *
 * The consumer writes a small worker file:
 * ```typescript
 * import { startElectronWorker } from '@cqrs-toolkit/client-electron/worker'
 * import { cqrsConfig } from './cqrs-config'
 * startElectronWorker(cqrsConfig)
 * ```
 *
 * @packageDocumentation
 */

import type { EnqueueCommand, IAnticipatedEvent, ResolvedConfig } from '@cqrs-toolkit/client'
import {
  CacheManager,
  CommandIdMappingStore,
  CommandQueue,
  CommandStore,
  type CqrsConfig,
  EventBus,
  EventCache,
  EventProcessorRegistry,
  EventProcessorRunner,
  QueryManager,
  ReadModelStore,
  SQLiteStorage,
  SessionManager,
  SyncManager,
  protocol,
  resolveConfig,
} from '@cqrs-toolkit/client'
import {
  AnticipatedEventHandler,
  WriteQueue,
  createCommandResponseHandler,
  createDomainExecutor,
  registerCacheManagerMethods,
  registerCommandQueueMethods,
  registerDebugMethods,
  registerQueryManagerMethods,
  registerSyncManagerMethods,
} from '@cqrs-toolkit/client/internals'
import { type Link, createConsoleLogger, logProvider } from '@meticoeus/ddd-es'
import { BetterSqliteDb } from './BetterSqliteDb.js'
import { FsCommandFileStore } from './FsCommandFileStore.js'
import { NodeConnectivityManager } from './NodeConnectivityManager.js'
import type { ElectronMessagePort, InitMessage } from './types.js'

// Set a default warn-level console logger so logProvider doesn't throw before consumer setup
logProvider.setLogger(createConsoleLogger({ level: 'warn' }))

// Surface uncaught errors — without this, utility process crashes are silent
process.on('uncaughtException', (err) => {
  logProvider.log.error({ err }, '[electron-worker] Uncaught exception')
})
process.on('unhandledRejection', (reason) => {
  logProvider.log.error({ reason }, '[electron-worker] Unhandled rejection')
})

/**
 * Electron utility process parentPort type.
 */
interface ParentPort {
  on(
    event: 'message',
    handler: (event: { data: unknown; ports: ElectronMessagePort[] }) => void,
  ): void
}

/**
 * Bootstrap an Electron utility process with CQRS orchestration.
 *
 * Listens on `process.parentPort` for the init message from the main
 * process bridge, then creates the full component stack.
 *
 * @param config - Shared CQRS config (same object the renderer uses)
 */
export function startElectronWorker<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TSchema,
  TEvent extends IAnticipatedEvent,
>(config: CqrsConfig<TLink, TCommand, TSchema, TEvent>): void {
  const resolved = resolveConfig(config)
  const parentPort = (process as unknown as { parentPort: ParentPort }).parentPort

  parentPort.on('message', (event) => {
    const data = event.data as Record<string, unknown>
    if (data.type !== '@cqrs-toolkit/init') return

    const port = event.ports[0]
    if (!port) {
      logProvider.log.error('Init message received without a transferred MessagePort')
      return
    }

    bootstrapWorker(resolved, port, data as unknown as InitMessage).catch((err) => {
      logProvider.log.error({ err }, 'Failed to initialize Electron CQRS worker')
    })
  })
}

async function bootstrapWorker<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TSchema,
  TEvent extends IAnticipatedEvent,
>(
  config: ResolvedConfig<TLink, TCommand, TSchema, TEvent>,
  port: ElectronMessagePort,
  init: InitMessage,
): Promise<void> {
  const messageHandler = new protocol.WorkerMessageHandler({
    responseTarget: port,
  })

  // Cleanup function — set by initialize, called by close
  let cleanup: (() => Promise<void>) | undefined

  // Register lifecycle RPCs — initialize builds all components, close tears them down
  messageHandler.registerMethod('orchestrator.initialize', async () => {
    // 1. Database + storage
    const db = new BetterSqliteDb(init.dbPath)
    const storage = new SQLiteStorage<TLink, TCommand>({
      db,
      migrations: config.storage.migrations,
    })
    await storage.initialize()

    // 2. EventBus — bridge broadcasts to renderer
    const eventBus = new EventBus<TLink>()
    const eventBroadcastSub = eventBus.events$.subscribe((event) => {
      messageHandler.broadcastEvent(event.type, event.data, event.debug)
    })

    // 3. Session manager
    const sessionMgr = new SessionManager<TLink, TCommand>(storage, eventBus)
    await sessionMgr.initialize()

    // 4. Event processors
    const registry = new EventProcessorRegistry()
    for (const registration of config.processors) {
      registry.register(registration)
    }

    // 5. Cache manager
    const cacheManager = new CacheManager<TLink, TCommand>(eventBus, storage, {
      cacheConfig: config.cache,
    })
    await cacheManager.initialize()

    // 6. Event cache
    const eventCache = new EventCache<TLink, TCommand>(storage)

    // 6.5. Command id mapping store
    const mappingStore = new CommandIdMappingStore<TLink, TCommand>(storage)
    await mappingStore.initialize()

    // 7. Read model store
    const readModelStore = new ReadModelStore<TLink, TCommand>(eventBus, storage, mappingStore)

    // 8. Event processor runner
    const eventProcessorRunner = new EventProcessorRunner<TLink, TCommand>(
      eventBus,
      registry,
      readModelStore,
    )

    // 9. Write queue
    const writeQueue = new WriteQueue<TLink, TCommand>(eventBus)

    // 10. Anticipated event handler
    const anticipatedEventHandler = new AnticipatedEventHandler(
      eventBus,
      eventCache,
      registry,
      readModelStore,
      config.collections,
      writeQueue,
    )

    // 11. Query manager
    const queryManager = new QueryManager<TLink, TCommand>(eventBus, cacheManager, readModelStore)

    // 11.5. Command store
    const commandStore = new CommandStore(storage, {
      retainTerminal: config.retainTerminal,
    })
    await commandStore.initialize()

    // 12. Command queue
    let syncManagerRef: SyncManager<TLink, TCommand, TSchema, TEvent>
    const fileStore = new FsCommandFileStore(init.filesPath)

    const domainExecutor =
      config.commandHandlers.length === 0
        ? undefined
        : createDomainExecutor<TLink, TCommand, TSchema, TEvent>(config.commandHandlers, {
            schemaValidator: config.schemaValidator,
            queryManager,
          })
    const commandQueue = new CommandQueue<TLink, TCommand, TSchema, TEvent>(
      eventBus,
      storage,
      fileStore,
      anticipatedEventHandler,
      config.aggregates,
      readModelStore,
      commandStore,
      mappingStore,
      {
        domainExecutor,
        commandSender: config.commandSender,
        retryConfig: config.retry,
        retainTerminal: config.retainTerminal,
        onCommandResponse: createCommandResponseHandler<TLink, TCommand, TSchema, TEvent>(
          () => syncManagerRef,
          config.collections,
        ),
      },
    )

    // 13. Connectivity manager (Node.js — assumes network online, health-check based)
    const connectivity = new NodeConnectivityManager<TLink>(eventBus, {
      healthCheckUrl: `${config.network.baseUrl}/health`,
    })

    // 14. Sync manager
    const syncManager = new SyncManager<TLink, TCommand, TSchema, TEvent>(
      eventBus,
      storage,
      sessionMgr,
      anticipatedEventHandler,
      commandQueue,
      eventCache,
      cacheManager,
      registry,
      eventProcessorRunner,
      readModelStore,
      queryManager,
      writeQueue,
      connectivity,
      config.network,
      config.auth,
      config.collections,
      config.aggregates,
      domainExecutor,
      commandStore,
      mappingStore,
    )
    syncManagerRef = syncManager

    await commandQueue.initialize()

    // 15. Register RPC methods
    registerCommandQueueMethods(messageHandler, commandQueue, eventBus)
    registerQueryManagerMethods(messageHandler, queryManager)
    registerCacheManagerMethods(messageHandler, cacheManager)
    registerSyncManagerMethods(messageHandler, syncManager, sessionMgr)

    // 16. File store RPC handlers (renderer → worker file transfer)
    messageHandler.registerMethod('fileStore.savePath', async (args) => {
      const [commandId, fileId, sourcePath] = args as [string, string, string]
      return fileStore.saveFromPath(commandId, fileId, sourcePath)
    })
    messageHandler.registerMethod('fileStore.saveBuffer', async (args) => {
      const [commandId, fileId, buffer, mimeType] = args as [string, string, ArrayBuffer, string]
      return fileStore.save(commandId, fileId, new Blob([buffer], { type: mimeType }))
    })
    messageHandler.registerMethod('fileStore.read', async (args) => {
      const [commandId, fileId] = args as [string, string]
      return fileStore.read(commandId, fileId)
    })
    messageHandler.registerMethod('fileStore.deleteForCommand', async (args) => {
      const [commandId] = args as [string]
      return fileStore.deleteForCommand(commandId)
    })
    messageHandler.registerMethod('fileStore.clear', async () => {
      return fileStore.clear()
    })

    // 17. Window cleanup
    messageHandler.onWindowRemoved(async (windowId: string) => {
      await cacheManager.unregisterWindow(windowId)
    })

    // 17. Hold restoration
    messageHandler.setRestoreHoldsHandler(async (data) => {
      const restoredKeys: string[] = []
      const failedKeys: string[] = []
      for (const key of data.cacheKeys) {
        const exists = await cacheManager.exists(key)
        if (exists) {
          await cacheManager.hold(key)
          restoredKeys.push(key)
        } else {
          failedKeys.push(key)
        }
      }
      return { restoredKeys, failedKeys }
    })

    // 18. Debug support
    let debugRegistered = false
    messageHandler.registerMethod('debug.enable', async () => {
      eventBus.debug = true
      if (!debugRegistered) {
        debugRegistered = true
        registerDebugMethods(messageHandler, {
          commandQueue,
          cacheManager,
          syncManager,
          storage,
          db,
        })
      }
    })

    // 19. Start sync
    await syncManager.start()

    // Capture cleanup for the close handler
    cleanup = async () => {
      writeQueue.destroy()
      eventCache.destroy()
      await syncManager.destroy()
      await queryManager.destroy()
      await commandQueue.destroy()
      await commandStore.destroy()
      await mappingStore.destroy()
      connectivity.destroy()
      eventBroadcastSub.unsubscribe()
      eventBus.complete()
      await db.close()
    }
  })

  messageHandler.registerMethod('orchestrator.close', async () => {
    await cleanup?.()
  })

  // Wire incoming messages from the renderer
  port.on('message', (event) => {
    messageHandler.handleData(event.data)
  })
  port.start()

  // Signal readiness to the renderer
  messageHandler.sendWorkerInstance()
}
