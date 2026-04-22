/**
 * Integration test bootstrap utilities.
 *
 * Two bootstrap paths that mirror the production wiring:
 * - {@link bootstrapOnlineOnly} mirrors `createOnlineOnlyClient` — wires on
 *   the main thread and uses an in-memory storage.
 * - {@link bootstrapWorkerSide} mirrors `WorkerOrchestrator.initialize` —
 *   wires the same components that live inside a worker in production, and
 *   uses SQLite via better-sqlite3 to exercise the SQL code path that OPFS
 *   SQLite would hit in a real browser worker.
 *
 * Command files use the in-memory {@link InMemoryCommandFileStore} in both
 * variants — the production difference (OPFS vs. ad-hoc tmp) is a browser
 * concern covered by e2e tests.
 *
 * Each variant returns an {@link IntegrationContext} that exposes the raw
 * internals (for assertions and introspection) AND a fully constructed
 * {@link CqrsClient}. Integration tests should prefer driving the system
 * through `ctx.client` so they exercise the same public surface consumers
 * use (`client.submit`, `client.queryManager`, `client.events$`); the raw
 * internals are exposed for introspection.
 */

import type { Link, ServiceLink } from '@meticoeus/ddd-es'
import type { Observable } from 'rxjs'
import type { IAdapter, IWindowAdapter } from '../../adapters/base/IAdapter.js'
import type { AuthStrategy } from '../../core/auth.js'
import { cookieAuthStrategy } from '../../core/auth.js'
import { CacheManager } from '../../core/cache-manager/CacheManager.js'
import { CacheManagerFacade } from '../../core/cache-manager/CacheManagerFacade.js'
import { CommandIdMappingStore } from '../../core/command-id-mapping-store/CommandIdMappingStore.js'
import type { ICommandIdMappingStore } from '../../core/command-id-mapping-store/ICommandIdMappingStore.js'
import { AnticipatedEventHandler } from '../../core/command-lifecycle/AnticipatedEventHandler.js'
import type { IAnticipatedEvent } from '../../core/command-lifecycle/AnticipatedEventShape.js'
import { IAnticipatedEventHandler } from '../../core/command-lifecycle/IAnticipatedEventHandler.js'
import { createCommandResponseHandler } from '../../core/command-lifecycle/createCommandResponseHandler.js'
import { CommandQueue } from '../../core/command-queue/CommandQueue.js'
import { InMemoryCommandFileStore } from '../../core/command-queue/file-store/InMemoryCommandFileStore.js'
import type { ICommandSender } from '../../core/command-queue/types.js'
import { CommandStore } from '../../core/command-store/CommandStore.js'
import type { ICommandStore } from '../../core/command-store/ICommandStore.js'
import { EventCache } from '../../core/event-cache/EventCache.js'
import { EventProcessorRegistry } from '../../core/event-processor/EventProcessorRegistry.js'
import { EventProcessorRunner } from '../../core/event-processor/EventProcessorRunner.js'
import type { ProcessorRegistration } from '../../core/event-processor/types.js'
import { EventBus } from '../../core/events/EventBus.js'
import { QueryManager } from '../../core/query-manager/QueryManager.js'
import { QueryManagerFacade } from '../../core/query-manager/QueryManagerFacade.js'
import { StableRefQueryManager } from '../../core/query-manager/StableRefQueryManager.js'
import { ReadModelStore } from '../../core/read-model-store/ReadModelStore.js'
import { SessionManager } from '../../core/session/SessionManager.js'
import { ConnectivityManager } from '../../core/sync-manager/ConnectivityManager.js'
import type { IConnectivity } from '../../core/sync-manager/IConnectivityManager.js'
import { type IConnectivityManager } from '../../core/sync-manager/IConnectivityManager.js'
import { SyncManager } from '../../core/sync-manager/SyncManager.js'
import { WriteQueue } from '../../core/write-queue/WriteQueue.js'
import { CqrsClient, type CqrsClientSyncManager } from '../../createCqrsClient.js'
import type { IStorage } from '../../storage/IStorage.js'
import { InMemoryStorage } from '../../storage/InMemoryStorage.js'
import { SQLiteStorage } from '../../storage/SQLiteStorage.js'
import { clientSchema } from '../../storage/schema/client-schema.js'
import { IClientAggregates } from '../../types/aggregates.js'
import type { EnqueueCommand } from '../../types/commands.js'
import type { Collection, NetworkConfig, SchemaMigration } from '../../types/config.js'
import type { CommandHandlerRegistration, IDomainExecutor } from '../../types/domain.js'
import { createDomainExecutor } from '../../types/domain.js'
import type { LibraryEvent } from '../../types/events.js'
import { BetterSqliteDb } from '../BetterSqliteDb.js'
import {
  NoteAggregate,
  NotebookAggregate,
  parseTestStreamId,
  TodoAggregate,
} from '../aggregates.js'
import { createMockCommandSender } from './mock-command-sender.js'

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
  storage: IStorage<TLink, TCommand>,
  sessionManager: SessionManager<TLink, TCommand>,
  anticipatedEventHandler: IAnticipatedEventHandler<TLink, TCommand>,
  commandQueue: CommandQueue<TLink, TCommand, TSchema, TEvent>,
  eventCache: EventCache<TLink, TCommand>,
  cacheManager: CacheManager<TLink, TCommand>,
  registry: EventProcessorRegistry,
  eventProcessor: EventProcessorRunner<TLink, TCommand>,
  readModelStore: ReadModelStore<TLink, TCommand>,
  queryManager: QueryManager<TLink, TCommand>,
  writeQueue: WriteQueue<TLink, TCommand>,
  connectivity: IConnectivityManager<TLink>,
  networkConfig: NetworkConfig,
  auth: AuthStrategy,
  collections: Collection<TLink>[],
  clientAggregates: IClientAggregates<TLink>,
  domainExecutor: IDomainExecutor<TLink, TCommand, TSchema, TEvent> | undefined,
  commandStore: ICommandStore<TLink, TCommand>,
  mappingStore: ICommandIdMappingStore,
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
  /**
   * Per-test override for the internal run timeout enforced by `createRun`.
   * Defaults to the helper's built-in value when omitted. Kept here so the
   * single config object passed to each test covers both wiring and timing.
   * Not consumed by the bootstrap itself — `createRun` reads it.
   */
  timeoutMs?: number
  /**
   * Pre-populate raw storage before any in-memory store initializes. Runs
   * after `storage.initialize()` (migrations are complete by then for the
   * SQL variant) and before the mapping and command stores load their
   * indices from storage — the exact point at which a worker restart sees
   * pre-existing persisted state. Use to simulate a mid-session
   * worker-recreate scenario with specific commands, mappings, or read
   * models already on disk.
   */
  seedStorage?: (storage: IStorage<TLink, TCommand>) => Promise<void> | void
}

export interface IntegrationContext {
  /**
   * Fully constructed {@link CqrsClient} wrapping the internals below. Prefer
   * driving integration tests through this so they exercise the same public
   * surface consumers use (`client.submit`, `client.queryManager`,
   * `client.events$`); the raw internals are exposed below for introspection
   * and direct assertions.
   */
  client: CqrsClient<TLink, TCommand>
  storage: IStorage<TLink, TCommand>
  eventBus: EventBus<TLink>
  sessionManager: SessionManager<TLink, TCommand>
  cacheManager: CacheManager<TLink, TCommand>
  eventCache: EventCache<TLink, TCommand>
  readModelStore: ReadModelStore<TLink, TCommand>
  eventProcessorRunner: EventProcessorRunner<TLink, TCommand>
  anticipatedEventHandler: AnticipatedEventHandler<TLink, TCommand>
  commandQueue: CommandQueue<TLink, TCommand, TSchema, TEvent>
  queryManager: QueryManager<TLink, TCommand>
  writeQueue: WriteQueue<TLink, TCommand>
  syncManager: SyncManager<TLink, TCommand, TSchema, TEvent>
  mappingStore: ICommandIdMappingStore
  destroy(): Promise<void>
}

export type BootstrapFn = (config?: IntegrationBootstrapConfig) => Promise<IntegrationContext>

const DUMMY_NETWORK: NetworkConfig = { baseUrl: 'http://localhost:9999' }

// ---------------------------------------------------------------------------
// Shared wiring logic
// ---------------------------------------------------------------------------

/**
 * Wire all CQRS components together against a caller-supplied storage.
 *
 * The wiring order is critical — WriteQueue's deferred bootstrap validation
 * asserts that all 6 op handlers and the session reset handler are registered
 * before the next microtask. The handler registration happens in:
 * 1. AnticipatedEventHandler constructor: 'apply-anticipated'
 * 2. SyncManager constructor: 'apply-records', 'apply-seed-events', 'reconcile-ws-events', 'evict-cache-key' + setSessionResetHandler
 * 3. GapRepairCoordinator constructor (inside SyncManager): 'apply-gap-repair'
 */
async function wireComponents(
  config: IntegrationBootstrapConfig,
  storage: IStorage<TLink, TCommand>,
): Promise<IntegrationContext> {
  const collections = config.collections ?? []
  const processors = config.processors ?? []
  const commandHandlers = config.commandHandlers ?? []
  const auth = config.auth ?? cookieAuthStrategy
  const network = config.network ?? DUMMY_NETWORK

  // 0. Seed pre-existing persisted state BEFORE any in-memory store
  //    initializes. The mapping store and command store both snapshot from
  //    storage at initialize time, so any seed writes that happen after
  //    those inits are invisible to chain rebuild and command replay.
  if (config.seedStorage) {
    await config.seedStorage(storage)
  }

  // 1. EventBus
  const eventBus = new EventBus<TLink>()

  // 2. SessionManager
  const sessionManager = new SessionManager<TLink, TCommand>(storage, eventBus)
  await sessionManager.initialize()

  // 3. Event processor registry
  const registry = new EventProcessorRegistry()
  for (const registration of processors) {
    registry.register(registration)
  }

  // 4. CacheManager
  const cacheManager = new CacheManager<TLink, TCommand>(eventBus, storage, {})
  await cacheManager.initialize()

  // 5. EventCache + ReadModelStore
  const eventCache = new EventCache<TLink, TCommand>(storage)
  const mappingStore = new CommandIdMappingStore<TLink, TCommand>(storage)
  await mappingStore.initialize()
  const readModelStore = new ReadModelStore<TLink, TCommand>(eventBus, storage, mappingStore)

  // 6. EventProcessorRunner
  const eventProcessorRunner = new EventProcessorRunner<TLink, TCommand>(
    eventBus,
    registry,
    readModelStore,
  )

  // 7. WriteQueue
  const writeQueue = new WriteQueue<TLink, TCommand>(eventBus)

  // 8. CommandStore
  const commandStore = new CommandStore(storage)
  await commandStore.initialize()

  // 9. AnticipatedEventHandler (registers 'apply-anticipated' on writeQueue)
  const anticipatedEventHandler = new AnticipatedEventHandler<TLink, TCommand>(
    eventBus,
    eventCache,
    registry,
    readModelStore,
    collections,
    writeQueue,
  )

  // 10. QueryManager
  const queryManager = new QueryManager<TLink, TCommand>(eventBus, cacheManager, readModelStore)

  // 11. CommandQueue (with optional DomainExecutor)
  let syncManagerRef: SyncManager<TLink, TCommand, TSchema, TEvent>

  const fileStore = new InMemoryCommandFileStore()

  const aggregates: IClientAggregates<ServiceLink> = {
    aggregates: [TodoAggregate, NoteAggregate, NotebookAggregate],
    parseStreamId: parseTestStreamId,
  }

  const domainExecutor =
    commandHandlers.length === 0
      ? undefined
      : createDomainExecutor<TLink, TCommand, TSchema, TEvent>(commandHandlers)
  const commandQueue = new CommandQueue<TLink, TCommand, TSchema, TEvent>(
    eventBus,
    storage,
    fileStore,
    anticipatedEventHandler,
    aggregates,
    readModelStore,
    commandStore,
    mappingStore,
    {
      domainExecutor,
      commandSender: config.commandSender ?? createMockCommandSender(),
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
    storage,
    sessionManager,
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
    network,
    auth,
    collections,
    aggregates,
    domainExecutor,
    commandStore,
    mappingStore,
  )
  syncManagerRef = syncManager

  // Wire cross-dependencies (property-set to break circular refs)
  cacheManager.setWriteQueue(writeQueue)
  cacheManager.setCommandQueue(commandQueue)
  commandQueue.setCacheManager(cacheManager)

  // Rebuild in-memory chain state from any persisted commands (seeded via
  // `config.seedStorage` or carried over from a prior session). Must run
  // before the queue resumes or any new command is enqueued so chain
  // lookups see the right `latestCommandId` / `lastKnownRevision`.
  await commandQueue.initialize()

  // 13. Wrap the wired internals as a full CqrsClient.
  const client = buildIntegrationClient({
    storage,
    eventBus,
    sessionManager,
    cacheManager,
    commandQueue,
    queryManager,
    syncManager,
  })

  async function destroy(): Promise<void> {
    // Pause the command queue to stop new processPendingCommands calls.
    // commandQueue.destroy() below awaits the same processingPromise, so we
    // don't need to await pause's drain here — but the returned promise must
    // not be left floating.
    await commandQueue.pause()
    // Wait for any in-flight WriteQueue processing to settle
    if (writeQueue.getDebugState().status === 'processing') {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    writeQueue.destroy()
    eventCache.destroy()
    await syncManager.destroy()
    await queryManager.destroy()
    await commandQueue.destroy()
    await commandStore.destroy()
    await mappingStore.destroy()
    eventBus.complete()
    await storage.close()
  }

  return {
    client,
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
    mappingStore,
    destroy,
  }
}

// ---------------------------------------------------------------------------
// Public bootstrap functions
// ---------------------------------------------------------------------------

/**
 * Bootstrap the online-only wiring path (main-thread components) against an
 * {@link InMemoryStorage}. Mirrors `createOnlineOnlyClient`.
 */
export const bootstrapOnlineOnly: BootstrapFn = async (config = {}) => {
  const storage = new InMemoryStorage<TLink, TCommand>()
  await storage.initialize()
  return wireComponents(config, storage)
}

/**
 * Bootstrap the worker-side wiring path (components that live inside a worker
 * in production) against an {@link SQLiteStorage} backed by better-sqlite3.
 * Mirrors `WorkerOrchestrator.initialize`.
 *
 * Worker-side production uses SQLite (OPFS-backed in the browser); the test
 * variant uses the same {@link SQLiteStorage} via better-sqlite3 so the SQL
 * code path is actually exercised. Command files use the in-memory file store
 * in both variants — OPFS vs. ad-hoc tmp is a browser-level concern covered
 * by e2e tests.
 */
export const bootstrapWorkerSide: BootstrapFn = async (config = {}) => {
  const collections = config.collections ?? []
  const collectionNames = collections.map((c) => c.name)
  const migrations: [SchemaMigration, ...SchemaMigration[]] = [
    {
      version: 1,
      message: 'Integration test schema',
      steps: [
        clientSchema.init,
        ...collectionNames.map((name) => ({ type: 'managed' as const, name })),
      ],
    },
  ]

  const db = new BetterSqliteDb()
  const storage = new SQLiteStorage<TLink, TCommand>({ db, migrations })
  await storage.initialize()
  return wireComponents(config, storage)
}

// ---------------------------------------------------------------------------
// Integration-client construction
// ---------------------------------------------------------------------------

interface IntegrationClientParts<TL extends Link, TC extends EnqueueCommand> {
  storage: IStorage<TL, TC>
  eventBus: EventBus<TL>
  sessionManager: SessionManager<TL, TC>
  cacheManager: CacheManager<TL, TC>
  commandQueue: CommandQueue<TL, TC, TSchema, TEvent>
  queryManager: QueryManager<TL, TC>
  syncManager: SyncManager<TL, TC, TSchema, TEvent>
}

/**
 * Wrap an already-wired set of integration components as a full {@link CqrsClient},
 * matching the facade + sync-manager layering that `createOnlineOnlyClient`
 * performs for production. The bootstrap variants call this after wiring.
 */
export function buildIntegrationClient<TL extends Link, TC extends EnqueueCommand>(
  parts: IntegrationClientParts<TL, TC>,
): CqrsClient<TL, TC> {
  const windowId = crypto.randomUUID()

  const adapter: IWindowAdapter<TL, TC> = {
    kind: 'window',
    status: 'ready',
    events$: parts.eventBus.events$ as Observable<LibraryEvent<TL>>,
    storage: parts.storage,
    eventBus: parts.eventBus,
    sessionManager: parts.sessionManager,
    async initialize() {},
    async close() {},
  }

  const queryManagerFacade = new QueryManagerFacade<TL>(parts.queryManager, windowId)
  const stableQueryManager = new StableRefQueryManager<TL>(queryManagerFacade)

  const cacheManagerFacade = new CacheManagerFacade<TL>(parts.cacheManager, windowId)
  parts.cacheManager.registerWindow(windowId)

  const syncManagerFacade: CqrsClientSyncManager<TL> = {
    getCollectionStatus: (collection, cacheKey) =>
      Promise.resolve(parts.syncManager.getCollectionStatus(collection, cacheKey)),
    getAllStatus: () => Promise.resolve(parts.syncManager.getAllStatus()),
    getSeedStatus: (cacheKey) => Promise.resolve(parts.syncManager.getSeedStatus(cacheKey)),
    seed: (cacheKey) => parts.syncManager.seed(cacheKey),
    setAuthenticated: (params) => parts.syncManager.setAuthenticated(params),
    setUnauthenticated: () => parts.syncManager.setUnauthenticated(),
    get connectivity(): IConnectivity {
      return parts.syncManager.getConnectivity()
    },
  }

  // The bootstrap's destroy() handles component teardown; the client's close
  // path only needs to clean up the ref cache on the StableRefQueryManager it
  // wraps around the shared QueryManager instance.
  const closeResources = async (): Promise<void> => {
    await stableQueryManager.destroy()
  }

  return new CqrsClient<TL, TC>(
    adapter as IAdapter<TL, TC>,
    cacheManagerFacade,
    parts.commandQueue,
    stableQueryManager,
    syncManagerFacade,
    closeResources,
    'online-only',
  )
}
