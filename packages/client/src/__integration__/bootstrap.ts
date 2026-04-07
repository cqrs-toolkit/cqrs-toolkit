/**
 * Integration test bootstrap utilities.
 *
 * Two bootstrap paths that mirror the production wiring:
 * - `bootstrapOnlineOnly()` mirrors `createOnlineOnlyClient()` in createCqrsClient.ts
 * - `bootstrapWorkerSide()` mirrors `WorkerOrchestrator.initialize()` in WorkerOrchestrator.ts
 *
 * Both use InMemoryStorage and InMemoryCommandFileStore so no OPFS or SQLite is needed.
 */

import type { ServiceLink } from '@meticoeus/ddd-es'
import type { AuthStrategy } from '../core/auth.js'
import { cookieAuthStrategy } from '../core/auth.js'
import { CacheManager } from '../core/cache-manager/CacheManager.js'
import { AnticipatedEventHandler } from '../core/command-lifecycle/AnticipatedEventHandler.js'
import type { IAnticipatedEvent } from '../core/command-lifecycle/AnticipatedEventShape.js'
import { createCommandResponseHandler } from '../core/command-lifecycle/createCommandResponseHandler.js'
import { CommandQueue } from '../core/command-queue/CommandQueue.js'
import { InMemoryCommandFileStore } from '../core/command-queue/file-store/InMemoryCommandFileStore.js'
import type { ICommandSender } from '../core/command-queue/types.js'
import { EventCache } from '../core/event-cache/EventCache.js'
import { EventProcessorRegistry } from '../core/event-processor/EventProcessorRegistry.js'
import { EventProcessorRunner } from '../core/event-processor/EventProcessorRunner.js'
import type { ProcessorRegistration } from '../core/event-processor/types.js'
import { EventBus } from '../core/events/EventBus.js'
import { QueryManager } from '../core/query-manager/QueryManager.js'
import { ReadModelStore } from '../core/read-model-store/ReadModelStore.js'
import { SessionManager } from '../core/session/SessionManager.js'
import { ConnectivityManager } from '../core/sync-manager/ConnectivityManager.js'
import { type IConnectivityManager } from '../core/sync-manager/IConnectivityManager.js'
import { SyncManager } from '../core/sync-manager/SyncManager.js'
import { WriteQueue } from '../core/write-queue/WriteQueue.js'
import { InMemoryStorage } from '../storage/InMemoryStorage.js'
import type { EnqueueCommand } from '../types/commands.js'
import type { Collection, NetworkConfig } from '../types/config.js'
import type { CommandHandlerRegistration } from '../types/domain.js'
import { createDomainExecutor } from '../types/domain.js'

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

type TLink = ServiceLink
type TCommand = EnqueueCommand
type TSchema = unknown
type TEvent = IAnticipatedEvent

/** Constructor signature matching SyncManager (and subclasses like TestSyncManager). */
type SyncManagerConstructor = new (
  eventBus: EventBus<TLink>,
  sessionManager: SessionManager<TLink, TCommand>,
  commandQueue: CommandQueue<TLink, TCommand, TSchema, TEvent>,
  eventCache: EventCache<TLink, TCommand>,
  cacheManager: CacheManager<TLink, TCommand>,
  eventProcessor: EventProcessorRunner<TLink, TCommand>,
  readModelStore: ReadModelStore<TLink, TCommand>,
  queryManager: QueryManager<TLink, TCommand>,
  writeQueue: WriteQueue<TLink>,
  connectivity: IConnectivityManager<TLink>,
  networkConfig: NetworkConfig,
  auth: AuthStrategy,
  collections: Collection<TLink>[],
) => SyncManager<TLink, TCommand, TSchema, TEvent>

export interface IntegrationBootstrapConfig {
  collections?: Collection<TLink>[]
  processors?: ProcessorRegistration[]
  commandHandlers?: CommandHandlerRegistration<TLink, TCommand, TSchema, TEvent>[]
  commandSender?: ICommandSender<TLink, TCommand>
  auth?: AuthStrategy
  network?: NetworkConfig
  /** Override SyncManager class for testing (e.g., TestSyncManager with exposed protected methods). */
  SyncManagerClass?: SyncManagerConstructor
}

export interface IntegrationContext {
  storage: InMemoryStorage<TLink, TCommand>
  eventBus: EventBus<TLink>
  sessionManager: SessionManager<TLink, TCommand>
  cacheManager: CacheManager<TLink, TCommand>
  eventCache: EventCache<TLink, TCommand>
  readModelStore: ReadModelStore<TLink, TCommand>
  eventProcessorRunner: EventProcessorRunner<TLink, TCommand>
  anticipatedEventHandler: AnticipatedEventHandler<TLink, TCommand>
  commandQueue: CommandQueue<TLink, TCommand, TSchema, TEvent>
  queryManager: QueryManager<TLink, TCommand>
  writeQueue: WriteQueue<TLink>
  syncManager: SyncManager<TLink, TCommand, TSchema, TEvent>
  destroy(): Promise<void>
}

export type BootstrapFn = (config?: IntegrationBootstrapConfig) => Promise<IntegrationContext>

const DUMMY_NETWORK: NetworkConfig = { baseUrl: 'http://localhost:9999' }

// ---------------------------------------------------------------------------
// Shared wiring logic
// ---------------------------------------------------------------------------

/**
 * Wire all CQRS components together.
 *
 * The wiring order is critical — WriteQueue's deferred bootstrap validation
 * asserts that all 6 op handlers and the session reset handler are registered
 * before the next microtask. The handler registration happens in:
 * 1. AnticipatedEventHandler constructor: 'apply-anticipated'
 * 2. SyncManager constructor: 'apply-records', 'apply-seed-events', 'apply-ws-event', 'evict-cache-key' + setSessionResetHandler
 * 3. GapRepairCoordinator constructor (inside SyncManager): 'apply-gap-repair'
 */
async function wireComponents(
  config: IntegrationBootstrapConfig = {},
): Promise<IntegrationContext> {
  const collections = config.collections ?? []
  const processors = config.processors ?? []
  const commandHandlers = config.commandHandlers ?? []
  const auth = config.auth ?? cookieAuthStrategy
  const network = config.network ?? DUMMY_NETWORK

  // 1. Storage + initialize
  const storage = new InMemoryStorage<TLink, TCommand>()
  await storage.initialize()

  // 2. EventBus
  const eventBus = new EventBus<TLink>()

  // 3. SessionManager
  const sessionManager = new SessionManager<TLink, TCommand>(storage, eventBus)
  await sessionManager.initialize()

  // 4. Event processor registry
  const registry = new EventProcessorRegistry()
  for (const registration of processors) {
    registry.register(registration)
  }

  // 5. CacheManager
  const cacheManager = new CacheManager<TLink, TCommand>(storage, eventBus, {
    windowId: 'integration-test',
  })
  await cacheManager.initialize()

  // 6. EventCache + ReadModelStore
  const eventCache = new EventCache<TLink, TCommand>(storage, eventBus)
  const readModelStore = new ReadModelStore<TLink, TCommand>(storage)

  // 7. EventProcessorRunner
  const eventProcessorRunner = new EventProcessorRunner<TLink, TCommand>(
    readModelStore,
    eventBus,
    registry,
  )

  // 8. WriteQueue
  const writeQueue = new WriteQueue<TLink>(eventBus)

  // 9. AnticipatedEventHandler (registers 'apply-anticipated' on writeQueue)
  const anticipatedEventHandler = new AnticipatedEventHandler<TLink, TCommand>(
    eventCache,
    eventProcessorRunner,
    readModelStore,
    collections,
    writeQueue,
  )
  eventProcessorRunner.setAnticipatedEventHandler(anticipatedEventHandler)

  // 10. QueryManager
  const queryManager = new QueryManager<TLink, TCommand>(eventBus, cacheManager, readModelStore)

  // 11. CommandQueue (with optional DomainExecutor)
  let syncManagerRef: SyncManager<TLink, TCommand, TSchema, TEvent>

  const fileStore = new InMemoryCommandFileStore()

  const commandQueue = new CommandQueue<TLink, TCommand, TSchema, TEvent>(
    storage,
    eventBus,
    fileStore,
    anticipatedEventHandler,
    {
      ...(() => {
        if (commandHandlers.length === 0) return {}
        const executor = createDomainExecutor<TLink, TCommand, TSchema, TEvent>(commandHandlers)
        return { domainExecutor: executor, handlerMetadata: executor }
      })(),
      commandSender: config.commandSender,
      onCommandResponse: createCommandResponseHandler<TLink, TCommand, TSchema, TEvent>(
        () => syncManagerRef,
        collections,
      ),
    },
  )

  // 12. SyncManager (registers remaining WriteQueue handlers + session reset)
  const connectivity = new ConnectivityManager(eventBus)
  const SyncManagerCtor = config.SyncManagerClass ?? SyncManager
  const syncManager = new SyncManagerCtor(
    eventBus,
    sessionManager,
    commandQueue,
    eventCache,
    cacheManager,
    eventProcessorRunner,
    readModelStore,
    queryManager,
    writeQueue,
    connectivity,
    network,
    auth,
    collections,
  )
  syncManagerRef = syncManager

  // Cleanup function
  async function destroy(): Promise<void> {
    writeQueue.destroy()
    eventCache.destroy()
    await syncManager.destroy()
    await queryManager.destroy()
    await commandQueue.destroy()
    eventBus.complete()
    await storage.close()
  }

  return {
    storage,
    eventBus,
    sessionManager,
    cacheManager,
    eventCache,
    readModelStore,
    eventProcessorRunner,
    anticipatedEventHandler,
    commandQueue,
    queryManager,
    writeQueue,
    syncManager,
    destroy,
  }
}

// ---------------------------------------------------------------------------
// Public bootstrap functions
// ---------------------------------------------------------------------------

/**
 * Bootstrap all components using the online-only wiring path.
 * Mirrors `createOnlineOnlyClient()` in createCqrsClient.ts.
 */
export const bootstrapOnlineOnly: BootstrapFn = wireComponents

/**
 * Bootstrap all components using the worker-side wiring path.
 * Mirrors `WorkerOrchestrator.initialize()` in WorkerOrchestrator.ts.
 *
 * The component wiring is identical to online-only when using InMemoryStorage.
 * The production difference is:
 * - SQLiteStorage instead of InMemoryStorage
 * - OpfsCommandFileStore instead of InMemoryCommandFileStore
 * - RPC method registration on WorkerMessageHandler
 * - EventBus broadcast bridge to main thread
 * - Window lifecycle management (holds restoration, dead window cleanup)
 *
 * These browser/worker-specific concerns are tested by e2e tests.
 * This bootstrap verifies the component wiring logic is correct.
 */
export const bootstrapWorkerSide: BootstrapFn = wireComponents
