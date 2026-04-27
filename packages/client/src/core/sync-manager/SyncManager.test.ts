/**
 * Unit tests for SyncManager — session cascade and response event processing.
 */

import type { Result, ServiceLink } from '@meticoeus/ddd-es'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InMemoryStorage } from '../../storage/InMemoryStorage.js'
import { createTestWriteQueue } from '../../testing/createTestWriteQueue.js'
import { itemDomainExecutor } from '../../testing/domainExecutor.js'
import {
  NoteAggregate,
  NotebookAggregate,
  parseTestStreamId,
  TodoAggregate,
} from '../../testing/index.js'
import { IClientAggregates } from '../../types/aggregates.js'
import type { CommandRecord } from '../../types/commands.js'
import { Collection, FetchSeedRecordOptions, SeedRecordPage } from '../../types/config.js'
import { EnqueueCommand, IDomainExecutor } from '../../types/index.js'
import { cookieAuthStrategy } from '../auth.js'
import { type CacheKeyIdentity, deriveScopeKey } from '../cache-manager/CacheKey.js'
import { CacheManager } from '../cache-manager/CacheManager.js'
import { CommandIdMappingStore } from '../command-id-mapping-store/CommandIdMappingStore.js'
import { IAnticipatedEvent } from '../command-lifecycle/AnticipatedEventShape.js'
import type { IAnticipatedEventHandler } from '../command-lifecycle/IAnticipatedEventHandler.js'
import { CommandQueue } from '../command-queue/CommandQueue.js'
import { InMemoryCommandFileStore } from '../command-queue/file-store/InMemoryCommandFileStore.js'
import { CommandStore } from '../command-store/CommandStore.js'
import { EventCache } from '../event-cache/EventCache.js'
import { EventProcessorRegistry } from '../event-processor/EventProcessorRegistry.js'
import { ProcessorRegistration } from '../event-processor/index.js'
import { EventBus } from '../events/EventBus.js'
import { QueryManager } from '../query-manager/QueryManager.js'
import { ReadModelStore } from '../read-model-store/ReadModelStore.js'
import type { SessionManager } from '../session/SessionManager.js'
import { WriteQueue } from '../write-queue/index.js'
import type { WriteQueueException } from '../write-queue/IWriteQueue.js'
import { SessionResetException } from '../write-queue/IWriteQueue.js'
import { ConnectivityManager } from './ConnectivityManager.js'
import { SyncManager } from './SyncManager.js'

const DUMMY_NETWORK = { baseUrl: 'http://localhost:3000' }

const TODO_CACHE_KEY = deriveScopeKey({ scopeType: 'todos' })

class TestSyncManager extends SyncManager<ServiceLink, EnqueueCommand, unknown, IAnticipatedEvent> {
  getKnownRevisions(): Map<string, bigint> {
    return this.knownRevisions
  }

  async testSeedOneCollection(
    collection: Collection<ServiceLink>,
    cacheKey: CacheKeyIdentity<ServiceLink>,
    topics: readonly string[],
  ): Promise<Result<{ seeded: boolean; recordCount: number }, WriteQueueException>> {
    const ctx = await this.buildFetchContext()
    return this.seedOneCollection({ collection, cacheKey, topics, ctx })
  }

  testEvaluateCoverageForBatch(
    succeededCommands: readonly CommandRecord<ServiceLink, EnqueueCommand>[],
  ): {
    applied: CommandRecord<ServiceLink, EnqueueCommand>[]
  } {
    return this.evaluateCoverageForBatch(succeededCommands)
  }
}

describe('SyncManager', () => {
  let cleanup: (() => void)[] = []

  afterEach(() => {
    for (const fn of cleanup) fn()
    cleanup = []
  })

  interface BootstrapParams {
    collections?: Collection<ServiceLink>[]
    processors?: ProcessorRegistration<unknown, Record<string, unknown>>[]
    domainExecutor?: IDomainExecutor<ServiceLink, EnqueueCommand, unknown, IAnticipatedEvent>
  }

  interface BootstrapResult {
    storage: InMemoryStorage<ServiceLink, EnqueueCommand>
    eventBus: EventBus<ServiceLink>
    cacheManager: CacheManager<ServiceLink, EnqueueCommand>
    eventCache: EventCache<ServiceLink, EnqueueCommand>
    readModelStore: ReadModelStore<ServiceLink, EnqueueCommand>
    registry: EventProcessorRegistry
    anticipatedEventHandler: IAnticipatedEventHandler<ServiceLink, EnqueueCommand>
    aggregates: IClientAggregates<ServiceLink>
    commandQueue: CommandQueue<ServiceLink, EnqueueCommand, unknown, IAnticipatedEvent>
    queryManager: QueryManager<ServiceLink, EnqueueCommand>
    todosCollection: Collection<ServiceLink>
    sessionManager: SessionManager<ServiceLink, EnqueueCommand>
    writeQueue: WriteQueue<ServiceLink, EnqueueCommand>
    connectivity: ConnectivityManager<ServiceLink>
  }

  async function bootstrap(
    params: BootstrapParams & { customSyncManager: true },
  ): Promise<BootstrapResult & { syncManager: undefined }>
  async function bootstrap(
    params?: BootstrapParams,
  ): Promise<BootstrapResult & { syncManager: TestSyncManager }>
  async function bootstrap(
    params?: BootstrapParams & { customSyncManager?: boolean },
  ): Promise<BootstrapResult & { syncManager: TestSyncManager | undefined }> {
    const storage = new InMemoryStorage<ServiceLink, EnqueueCommand>()
    await storage.initialize()
    const eventBus = new EventBus<ServiceLink>()

    const cacheManager = new CacheManager<ServiceLink, EnqueueCommand>(eventBus, storage)
    await cacheManager.initialize()

    const eventCache = new EventCache<ServiceLink, EnqueueCommand>(storage)
    const mappingStore = new CommandIdMappingStore<ServiceLink, EnqueueCommand>(storage)
    await mappingStore.initialize()
    const readModelStore = new ReadModelStore<ServiceLink, EnqueueCommand>(
      eventBus,
      storage,
      mappingStore,
    )

    const registry = new EventProcessorRegistry()
    for (const p of params?.processors ?? []) {
      registry.register(p)
    }
    const todosCollection: Collection<ServiceLink> = {
      name: 'todos',
      aggregate: TodoAggregate,
      cacheKeysFromTopics(topics: readonly string[]) {
        return [TODO_CACHE_KEY]
      },
      matchesStream: (streamId: string) => streamId.startsWith('nb.Todo-'),
      seedOnInit: { cacheKey: TODO_CACHE_KEY, topics: ['todos'] },
    }
    const sessionManager = createSessionManager()
    const writeQueue = createTestWriteQueue(
      eventBus,
      cleanup,
      [
        'apply-records',
        'apply-seed-events',
        'apply-gap-repair',
        'reconcile-ws-events',
        'evict-cache-key',
        'flush-cache-keys',
      ],
      {
        onSessionReset: 'unset',
      },
    )

    const anticipatedEventHandler: IAnticipatedEventHandler<ServiceLink, EnqueueCommand> = {
      cache: vi.fn().mockResolvedValue(undefined),
      cleanupOnSucceeded: vi.fn().mockResolvedValue(undefined),
      cleanupOnAppliedBatch: vi.fn().mockResolvedValue(undefined),
      cleanupOnFailure: vi.fn().mockResolvedValue(undefined),
      regenerate: vi.fn().mockResolvedValue(undefined),
      getTrackedEntries: vi.fn().mockReturnValue(undefined),
      setTrackedEntries: vi.fn(),
      clearAll: vi.fn().mockResolvedValue(undefined),
    }

    const fileStore = new InMemoryCommandFileStore()

    const aggregates: IClientAggregates<ServiceLink> = {
      aggregates: [TodoAggregate, NoteAggregate, NotebookAggregate],
      parseStreamId: parseTestStreamId,
    }

    const commandStore = new CommandStore(storage)
    await commandStore.initialize()

    const commandQueue = new CommandQueue<ServiceLink, EnqueueCommand, unknown, IAnticipatedEvent>(
      eventBus,
      storage,
      cacheManager,
      fileStore,
      anticipatedEventHandler,
      params?.collections ?? [todosCollection],
      aggregates,
      readModelStore,
      commandStore,
      mappingStore,
    )
    cacheManager.setWriteQueue(writeQueue)
    cacheManager.setCommandQueue(commandQueue)

    const queryManager = new QueryManager<ServiceLink, EnqueueCommand>(
      eventBus,
      cacheManager,
      readModelStore,
    )

    const connectivity = new ConnectivityManager(eventBus)

    const syncManager = params?.customSyncManager
      ? undefined
      : new TestSyncManager(
          eventBus,
          storage,
          sessionManager,
          anticipatedEventHandler,
          commandQueue,
          eventCache,
          cacheManager,
          registry,
          readModelStore,
          queryManager,
          writeQueue,
          connectivity,
          DUMMY_NETWORK,
          cookieAuthStrategy,
          params?.collections ?? [todosCollection],
          aggregates,
          params?.domainExecutor ?? itemDomainExecutor,
          commandStore,
          mappingStore,
        )

    return {
      storage,
      eventBus,
      cacheManager,
      eventCache,
      readModelStore,
      registry,
      anticipatedEventHandler,
      aggregates,
      commandQueue,
      queryManager,
      todosCollection,
      sessionManager,
      writeQueue,
      syncManager,
      connectivity,
    }
  }

  describe('onSessionDestroyed (via event)', () => {
    it('clears all storage and in-memory state', async () => {
      const { cacheManager, commandQueue, eventBus, queryManager, readModelStore, syncManager } =
        await bootstrap()
      // Seed some state
      const cacheKey = await cacheManager.acquire(TODO_CACHE_KEY)
      await readModelStore.setServerData(
        'todos',
        'todo-1',
        { id: 'todo-1', title: 'Test' },
        cacheKey,
      )
      queryManager.holdForWindow(cacheKey, 'test')
      await commandQueue.enqueue({
        command: { type: 'CreateTodo', data: {} },
        cacheKey: TODO_CACHE_KEY,
      })

      // Start SyncManager so it subscribes to session:destroyed
      await syncManager.start()

      // Emit session:destroyed
      eventBus.emit('session:destroyed', { reason: 'explicit' })

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Cache keys should be gone
      expect(await cacheManager.getCount()).toBe(0)

      // Commands should be gone
      const commands = await commandQueue.listCommands()
      expect(commands).toHaveLength(0)

      // Command queue should be paused
      expect(commandQueue.isPaused()).toBe(true)

      await syncManager.destroy()
    })
  })

  describe('clearKnownRevisions', () => {
    it('removes specified streamIds from known revisions', async () => {
      const { syncManager } = await bootstrap()

      const revisions = syncManager.getKnownRevisions()
      revisions.set('stream-1', 5n)
      revisions.set('stream-2', 10n)
      revisions.set('stream-3', 15n)

      syncManager.clearKnownRevisions(['stream-1', 'stream-3'])

      expect(revisions.has('stream-1')).toBe(false)
      expect(revisions.has('stream-2')).toBe(true)
      expect(revisions.has('stream-3')).toBe(false)
    })
  })

  describe('seedForKey', () => {
    it('seeds matching collections under the provided cache key', async () => {
      const fetchSeedRecords = vi.fn().mockResolvedValue({
        records: [{ id: 'note-1', data: { id: 'note-1', title: 'Hello' } }],
        nextCursor: null,
      } satisfies SeedRecordPage)

      const notesCollection: Collection<ServiceLink> = {
        name: 'notes',
        aggregate: NoteAggregate,
        cacheKeysFromTopics(topics: readonly string[]) {
          return []
        },
        seedOnDemand: {
          keyTypes: [{ kind: 'scope', scopeType: 'notebook-notes' }],
          subscribeTopics: () => [],
        },
        matchesStream: (streamId: string) => streamId.startsWith('nb.Note-'),
        fetchSeedRecords,
      }

      const { cacheManager, readModelStore, syncManager } = await bootstrap({
        collections: [notesCollection],
      })

      const cacheKey = deriveScopeKey({
        scopeType: 'notebook-notes',
        scopeParams: { notebookId: 'nb-1' },
      })

      await cacheManager.acquireKey(cacheKey)
      await syncManager.seedForKey(cacheKey)

      // Verify fetchSeedRecords was called with the cacheKey in options
      expect(fetchSeedRecords).toHaveBeenCalledOnce()
      const opts = fetchSeedRecords.mock.calls[0]![0]
      expect(opts.cacheKey).toMatchObject({ kind: 'scope', scopeType: 'notebook-notes' })
      expect(opts.cacheKey.scopeParams).toEqual({ notebookId: 'nb-1' })

      // Verify the record was stored under the correct cache key
      const models = await readModelStore.list('notes', { cacheKey: cacheKey.key })
      expect(models).toHaveLength(1)
      expect(models[0]?.data).toMatchObject({ id: 'note-1', title: 'Hello' })
    })

    it('is idempotent — does not re-seed an already seeded (collection, cacheKey) pair', async () => {
      const fetchSeedRecords = vi.fn().mockResolvedValue({
        records: [{ id: 'note-1', data: { id: 'note-1', title: 'Hello' } }],
        nextCursor: null,
      } satisfies SeedRecordPage)

      const notesCollection: Collection<ServiceLink> = {
        name: 'notes',
        aggregate: NoteAggregate,
        cacheKeysFromTopics(topics: readonly string[]) {
          return []
        },
        seedOnDemand: {
          keyTypes: [{ kind: 'scope', scopeType: 'notebook-notes' }],
          subscribeTopics: () => [],
        },
        matchesStream: (streamId: string) => streamId.startsWith('nb.Note-'),
        fetchSeedRecords,
      }

      const { cacheManager, syncManager } = await bootstrap({ collections: [notesCollection] })

      const cacheKey = deriveScopeKey({
        scopeType: 'notebook-notes',
        scopeParams: { notebookId: 'nb-1' },
      })

      // Acquire key first
      await cacheManager.acquireKey(cacheKey)

      // First call seeds
      await syncManager.seedForKey(cacheKey)
      expect(fetchSeedRecords).toHaveBeenCalledOnce()

      // Second call with the same cacheKey is a no-op
      await syncManager.seedForKey(cacheKey)
      expect(fetchSeedRecords).toHaveBeenCalledOnce()
    })

    it('does not seed collections that do not match keyTypes', async () => {
      const fetchSeedRecords = vi.fn()

      const todosCollection: Collection<ServiceLink> = {
        name: 'todos',
        aggregate: TodoAggregate,
        cacheKeysFromTopics(topics: readonly string[]) {
          return []
        },
        seedOnDemand: {
          keyTypes: [{ kind: 'scope', scopeType: 'todos' }],
          subscribeTopics: () => [],
        },
        matchesStream: () => false,
        fetchSeedRecords,
      }

      const { syncManager } = await bootstrap({ collections: [todosCollection] })

      // Seed with a key type that doesn't match todos
      const cacheKey = deriveScopeKey({ scopeType: 'notebook-notes' })
      await syncManager.seedForKey(cacheKey)

      expect(fetchSeedRecords).not.toHaveBeenCalled()
    })

    it('session reset during seed discards pending apply-records ops', async () => {
      const {
        aggregates,
        cacheManager,
        anticipatedEventHandler,
        commandQueue,
        eventBus,
        eventCache,
        registry,
        queryManager,
        readModelStore,
        sessionManager,
        storage,
        writeQueue,
        connectivity,
      } = await bootstrap({ customSyncManager: true })

      let resolveReset: (() => void) | undefined = undefined

      class BlockingResetSyncManager extends TestSyncManager {
        protected override async onSessionDestroyed(): Promise<void> {
          await new Promise<void>((resolve) => {
            resolveReset = resolve
          })
          await super.onSessionDestroyed()
        }
      }

      const fetchSeedRecords = vi.fn(async () => {
        return {
          records: [{ id: 'note-1', data: { id: 'note-1', title: 'Hello' } }],
          nextCursor: null,
        } satisfies SeedRecordPage
      })

      const notesCollection: Collection<ServiceLink> = {
        name: 'notes',
        aggregate: NoteAggregate,
        cacheKeysFromTopics: () => [],
        seedOnDemand: {
          keyTypes: [{ kind: 'scope', scopeType: 'notebook-notes' }],
          subscribeTopics: () => [],
        },
        matchesStream: () => false,
        fetchSeedRecords,
      }

      const blockingCommandStore = new CommandStore(storage)
      await blockingCommandStore.initialize()
      const blockingMappingStore = new CommandIdMappingStore<ServiceLink, EnqueueCommand>(storage)
      await blockingMappingStore.initialize()

      const syncManager = new BlockingResetSyncManager(
        eventBus,
        storage,
        sessionManager,
        anticipatedEventHandler,
        commandQueue,
        eventCache,
        cacheManager,
        registry,
        readModelStore,
        queryManager,
        writeQueue,
        connectivity,
        DUMMY_NETWORK,
        cookieAuthStrategy,
        [notesCollection],
        aggregates,
        itemDomainExecutor,
        blockingCommandStore,
        blockingMappingStore,
      )

      const cacheKey = deriveScopeKey({ scopeType: 'notebook-notes' })
      await cacheManager.acquireKey(cacheKey)

      // Seed successfully first
      const seedResult = await syncManager.testSeedOneCollection(notesCollection, cacheKey, [])
      expect(seedResult.ok).toBe(true)

      const models = await readModelStore.list('notes', { cacheKey: cacheKey.key })
      expect(models).toHaveLength(1)

      // Start session reset — onSessionDestroyed blocks, keeping queue in 'resetting'
      const resetPromise = writeQueue.resetSession('user-changed')

      // Enqueue during reset returns Err(SessionResetException)
      const result = await writeQueue.enqueue({
        type: 'apply-records',
        collection: 'notes',
        cacheKey,
        records: [{ id: 'note-2', data: { id: 'note-2' } }],
        source: 'seed',
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toBeInstanceOf(SessionResetException)

      // Release the reset
      resolveReset!()
      await resetPromise

      writeQueue.destroy()
    })
  })

  describe('seed (full lifecycle)', () => {
    it('resolves immediately when already seeded', async () => {
      const fetchSeedRecords = vi.fn().mockResolvedValue({
        records: [{ id: 'note-1', data: { id: 'note-1' } }],
        nextCursor: null,
      } satisfies SeedRecordPage)

      const { syncManager } = await bootstrap({
        collections: [createNotesCollection(fetchSeedRecords)],
      })
      await syncManager.start()

      const cacheKey = deriveScopeKey({ scopeType: 'notebook-notes' })

      // First seed — acquires key, seeds, waits for settlement
      await syncManager.seed(cacheKey)
      expect(fetchSeedRecords).toHaveBeenCalledOnce()

      // Second seed — already seeded, resolves immediately without re-fetching
      await syncManager.seed(cacheKey)
      expect(fetchSeedRecords).toHaveBeenCalledOnce()

      await syncManager.destroy()
    })

    it('acquires key and waits for settlement when unseeded', async () => {
      const {
        aggregates,
        cacheManager,
        anticipatedEventHandler,
        commandQueue,
        eventBus,
        eventCache,
        registry,
        queryManager,
        readModelStore,
        sessionManager,
        storage,
        writeQueue,
        connectivity,
      } = await bootstrap({ customSyncManager: true })

      const fetchSeedRecords = vi.fn().mockResolvedValue({
        records: [{ id: 'note-1', data: { id: 'note-1' } }],
        nextCursor: null,
      } satisfies SeedRecordPage)

      const seedCommandStore = new CommandStore(storage)
      await seedCommandStore.initialize()
      const seedMappingStore = new CommandIdMappingStore<ServiceLink, EnqueueCommand>(storage)
      await seedMappingStore.initialize()

      const syncManager = new SyncManager<ServiceLink, EnqueueCommand, unknown, IAnticipatedEvent>(
        eventBus,
        storage,
        sessionManager,
        anticipatedEventHandler,
        commandQueue,
        eventCache,
        cacheManager,
        registry,
        readModelStore,
        queryManager,
        writeQueue,
        connectivity,
        DUMMY_NETWORK,
        cookieAuthStrategy,
        [createNotesCollection(fetchSeedRecords)],
        aggregates,
        itemDomainExecutor,
        seedCommandStore,
        seedMappingStore,
      )
      await syncManager.start()

      const cacheKey = deriveScopeKey({ scopeType: 'notebook-notes' })
      await syncManager.seed(cacheKey)

      // Key was acquired
      expect(await cacheManager.exists(cacheKey.key)).toBe(true)

      // Data was seeded
      const models = await readModelStore.list('notes', { cacheKey: cacheKey.key })
      expect(models).toHaveLength(1)

      await syncManager.destroy()
    })

    it('emits cache:seed-settled with correct payload', async () => {
      const fetchSeedRecords = vi.fn().mockResolvedValue({
        records: [{ id: 'note-1', data: { id: 'note-1' } }],
        nextCursor: null,
      } satisfies SeedRecordPage)

      const { eventBus, syncManager } = await bootstrap({
        collections: [createNotesCollection(fetchSeedRecords)],
      })
      await syncManager.start()

      const events: unknown[] = []
      eventBus.on('cache:seed-settled').subscribe((e) => events.push(e))

      const cacheKey = deriveScopeKey({ scopeType: 'notebook-notes' })
      await syncManager.seed(cacheKey)

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        data: {
          cacheKey: cacheKey,
          status: 'succeeded',
          collections: [{ name: 'notes', seeded: true }],
        },
      })

      await syncManager.destroy()
    })

    function createNotesCollection(
      fetchSeedRecords: (opts: FetchSeedRecordOptions<ServiceLink>) => Promise<SeedRecordPage>,
    ): Collection<ServiceLink> {
      return {
        name: 'notes',
        aggregate: NoteAggregate,
        cacheKeysFromTopics(topics: readonly string[]) {
          return []
        },
        seedOnDemand: {
          keyTypes: [{ kind: 'scope', scopeType: 'notebook-notes' }],
          subscribeTopics: () => [],
        },
        matchesStream: () => false,
        fetchSeedRecords,
      }
    }
  })

  describe('cache key lifecycle events', () => {
    it('auto-seeds on cache:key-added when keyTypes match', async () => {
      const fetchSeedRecords = vi.fn().mockResolvedValue({
        records: [{ id: 'note-1', data: { id: 'note-1', title: 'Hello' } }],
        nextCursor: null,
      } satisfies SeedRecordPage)

      const notesCollection: Collection<ServiceLink> = {
        name: 'notes',
        aggregate: NoteAggregate,
        cacheKeysFromTopics(topics: readonly string[]) {
          return []
        },
        seedOnDemand: {
          keyTypes: [{ kind: 'scope', scopeType: 'notebook-notes' }],
          subscribeTopics: () => [],
        },
        matchesStream: () => false,
        fetchSeedRecords,
      }

      const { cacheManager, syncManager } = await bootstrap({ collections: [notesCollection] })
      await syncManager.start()

      // Acquiring a matching key should trigger auto-seed via cache:key-added
      const cacheKey = deriveScopeKey({
        scopeType: 'notebook-notes',
        scopeParams: { notebookId: 'nb-1' },
      })
      await cacheManager.acquireKey(cacheKey)

      // Allow async event handler to complete
      await new Promise((r) => setTimeout(r, 50))

      expect(fetchSeedRecords).toHaveBeenCalledOnce()

      await syncManager.destroy()
    })

    it('does not auto-seed when keyTypes do not match', async () => {
      const fetchSeedRecords = vi.fn()

      const todosCollection: Collection<ServiceLink> = {
        name: 'todos',
        aggregate: TodoAggregate,
        cacheKeysFromTopics(topics: readonly string[]) {
          return []
        },
        seedOnDemand: {
          keyTypes: [{ kind: 'scope', scopeType: 'todos' }],
          subscribeTopics: () => [],
        },
        matchesStream: () => false,
        fetchSeedRecords,
      }

      const { cacheManager, syncManager } = await bootstrap({ collections: [todosCollection] })
      await syncManager.start()

      // Acquire a key that doesn't match todos
      await cacheManager.acquireKey(deriveScopeKey({ scopeType: 'unrelated' }))

      await new Promise((r) => setTimeout(r, 50))

      expect(fetchSeedRecords).not.toHaveBeenCalled()

      await syncManager.destroy()
    })

    it('cleans up seed status on cache:evicted', async () => {
      const notesCollection: Collection<ServiceLink> = {
        name: 'notes',
        aggregate: NoteAggregate,
        cacheKeysFromTopics(topics: readonly string[]) {
          return []
        },
        seedOnDemand: {
          keyTypes: [{ kind: 'scope', scopeType: 'notebook-notes' }],
          subscribeTopics: () => [],
        },
        matchesStream: () => false,
        fetchSeedRecords: vi.fn().mockResolvedValue({
          records: [{ id: 'note-1', data: { id: 'note-1' } }],
          nextCursor: null,
        } satisfies SeedRecordPage),
      }

      const { cacheManager, readModelStore, syncManager } = await bootstrap({
        collections: [notesCollection],
      })
      await syncManager.start()

      const cacheKey = deriveScopeKey({ scopeType: 'notebook-notes' })
      // Acquire key first (seedForKey assumes key is already in storage)
      await cacheManager.acquireKey(cacheKey)
      await syncManager.seedForKey(cacheKey)

      // Verify data exists
      const beforeModels = await readModelStore.list('notes', { cacheKey: cacheKey.key })
      expect(beforeModels).toHaveLength(1)

      // Evict the key
      await cacheManager.evict(cacheKey.key)

      // Allow async eviction handler to complete
      await new Promise((r) => setTimeout(r, 50))

      // Seed status should be cleaned up
      const status = syncManager.getCollectionStatus('notes', cacheKey)
      expect(status).toBeUndefined()

      await syncManager.destroy()
    })
  })

  // WS event routing tests have been migrated to the batched-drain
  // integration tests in pipeline.integration.test.ts. The old per-event
  // `onApplyWsEventOp` path is dead code; these tests exercised it via
  // `testHandleWebSocketEvent`. Coverage equivalence:
  //   - multi-cacheKey routing → pipeline.integration.test.ts "event routed to multiple cache keys"
  //   - duplicate dedup → pipeline.integration.test.ts "duplicate event in a single batch is deduped"
  //   - no-active-keys drop → drain dedup pass drops entries with empty cacheKeys
  //   - gap repair after seeding → pipeline.integration.test.ts "out-of-order event is dropped"

  // ---------------------------------------------------------------------
  // Coverage evaluator — `evaluateCoverageForBatch`
  //
  // Drives the `'succeeded' → 'applied'` transition inside the sync pipeline.
  // For each in-scope succeeded command, compares the primary aggregate's
  // post-batch `knownRevisions` against the command response's
  // `nextExpectedRevision`. Commands without a registration are skipped here
  // (slipped to applied at succeed time by CommandQueue's escape hatch).
  // Cache-key eviction also transitions to applied.
  // Integration coverage lives in `pipeline.integration.test.ts`.
  // ---------------------------------------------------------------------
  describe('evaluateCoverageForBatch', () => {
    const TEST_CACHE_KEY = deriveScopeKey({ scopeType: 'evaluate-coverage-test' })

    function succeededCommand(
      overrides: Partial<CommandRecord<ServiceLink, EnqueueCommand>> & {
        commandId: string
        type: string
      },
    ): CommandRecord<ServiceLink, EnqueueCommand> {
      const { commandId, type, cacheKey, serverResponse, ...rest } = overrides
      return {
        commandId,
        cacheKey: cacheKey ?? TEST_CACHE_KEY,
        service: 'default',
        type,
        data: {},
        status: 'succeeded',
        dependsOn: [],
        blockedBy: [],
        attempts: 1,
        serverResponse: serverResponse ?? { id: commandId, nextExpectedRevision: '0' },
        seq: 0,
        createdAt: 1000,
        updatedAt: 1000,
        ...rest,
      }
    }

    it('skips commands when no domainExecutor is configured', async () => {
      const { syncManager, cacheManager } = await bootstrap()
      await cacheManager.acquire(TEST_CACHE_KEY)

      const command = succeededCommand({
        commandId: 'cmd-no-executor',
        type: 'CreateItem',
      })

      const result = syncManager.testEvaluateCoverageForBatch([command])

      expect(result.applied).toEqual([])
    })

    it('skips commands whose type has no registration', async () => {
      const { syncManager, cacheManager } = await bootstrap({
        domainExecutor: itemDomainExecutor,
      })
      await cacheManager.acquire(TEST_CACHE_KEY)

      const command = succeededCommand({
        commandId: 'cmd-no-reg',
        type: 'UnknownCommand',
      })

      const result = syncManager.testEvaluateCoverageForBatch([command])

      expect(result.applied).toEqual([])
    })

    it('transitions to applied when the cache key is evicted', async () => {
      const { syncManager } = await bootstrap({ domainExecutor: itemDomainExecutor })
      // Do NOT acquire TEST_CACHE_KEY — it is absent from the cache manager.

      const command = succeededCommand({
        commandId: 'cmd-evicted',
        type: 'CreateItem',
      })

      const result = syncManager.testEvaluateCoverageForBatch([command])

      expect(result.applied).toHaveLength(1)
      expect(result.applied[0]!.commandId).toBe('cmd-evicted')
    })

    it('skips commands whose serverResponse has no id', async () => {
      const { syncManager, cacheManager } = await bootstrap({
        domainExecutor: itemDomainExecutor,
      })
      await cacheManager.acquire(TEST_CACHE_KEY)

      const command = succeededCommand({
        commandId: 'cmd-no-id',
        type: 'CreateItem',
        serverResponse: { nextExpectedRevision: '0' },
      })

      const result = syncManager.testEvaluateCoverageForBatch([command])

      expect(result.applied).toEqual([])
    })

    it('skips commands whose serverResponse has no nextExpectedRevision', async () => {
      const { syncManager, cacheManager } = await bootstrap({
        domainExecutor: itemDomainExecutor,
      })
      await cacheManager.acquire(TEST_CACHE_KEY)

      const command = succeededCommand({
        commandId: 'cmd-no-revision',
        type: 'CreateItem',
        serverResponse: { id: 'item-a' },
      })

      const result = syncManager.testEvaluateCoverageForBatch([command])

      expect(result.applied).toEqual([])
    })

    it('skips commands whose nextExpectedRevision cannot be parsed as bigint', async () => {
      const { syncManager, cacheManager } = await bootstrap({
        domainExecutor: itemDomainExecutor,
      })
      await cacheManager.acquire(TEST_CACHE_KEY)
      syncManager.getKnownRevisions().set('nb.Item-item-a', 0n)

      const command = succeededCommand({
        commandId: 'cmd-unparsable',
        type: 'CreateItem',
        serverResponse: { id: 'item-a', nextExpectedRevision: 'not-a-bigint' },
      })

      const result = syncManager.testEvaluateCoverageForBatch([command])

      expect(result.applied).toEqual([])
    })

    it('skips commands whose primary stream has no knownRevisions entry', async () => {
      const { syncManager, cacheManager } = await bootstrap({
        domainExecutor: itemDomainExecutor,
      })
      await cacheManager.acquire(TEST_CACHE_KEY)
      // Intentionally leave knownRevisions empty for nb.Item-item-a.

      const command = succeededCommand({
        commandId: 'cmd-unknown-stream',
        type: 'CreateItem',
        serverResponse: { id: 'item-a', nextExpectedRevision: '0' },
      })

      const result = syncManager.testEvaluateCoverageForBatch([command])

      expect(result.applied).toEqual([])
    })

    it('does not transition when knownRevision is below nextExpectedRevision', async () => {
      const { syncManager, cacheManager } = await bootstrap({
        domainExecutor: itemDomainExecutor,
      })
      await cacheManager.acquire(TEST_CACHE_KEY)
      syncManager.getKnownRevisions().set('nb.Item-item-a', 0n)

      const command = succeededCommand({
        commandId: 'cmd-below',
        type: 'CreateItem',
        serverResponse: { id: 'item-a', nextExpectedRevision: '1' },
      })

      const result = syncManager.testEvaluateCoverageForBatch([command])

      expect(result.applied).toEqual([])
    })

    it('transitions to applied when knownRevision equals nextExpectedRevision', async () => {
      const { syncManager, cacheManager } = await bootstrap({
        domainExecutor: itemDomainExecutor,
      })
      await cacheManager.acquire(TEST_CACHE_KEY)
      syncManager.getKnownRevisions().set('nb.Item-item-a', 0n)

      const command = succeededCommand({
        commandId: 'cmd-equal',
        type: 'CreateItem',
        serverResponse: { id: 'item-a', nextExpectedRevision: '0' },
      })

      const result = syncManager.testEvaluateCoverageForBatch([command])

      expect(result.applied).toHaveLength(1)
      expect(result.applied[0]!.commandId).toBe('cmd-equal')
    })

    it('transitions to applied when knownRevision exceeds nextExpectedRevision', async () => {
      const { syncManager, cacheManager } = await bootstrap({
        domainExecutor: itemDomainExecutor,
      })
      await cacheManager.acquire(TEST_CACHE_KEY)
      syncManager.getKnownRevisions().set('nb.Item-item-a', 10n)

      const command = succeededCommand({
        commandId: 'cmd-above',
        type: 'CreateItem',
        serverResponse: { id: 'item-a', nextExpectedRevision: '5' },
      })

      const result = syncManager.testEvaluateCoverageForBatch([command])

      expect(result.applied).toHaveLength(1)
      expect(result.applied[0]!.commandId).toBe('cmd-above')
    })

    it('processes a mixed batch independently per command', async () => {
      const { syncManager, cacheManager } = await bootstrap({
        domainExecutor: itemDomainExecutor,
      })
      await cacheManager.acquire(TEST_CACHE_KEY)
      syncManager.getKnownRevisions().set('nb.Item-item-applied', 3n)
      syncManager.getKnownRevisions().set('nb.Item-item-below', 0n)

      const applied = succeededCommand({
        commandId: 'cmd-applied',
        type: 'CreateItem',
        serverResponse: { id: 'item-applied', nextExpectedRevision: '3' },
      })
      const below = succeededCommand({
        commandId: 'cmd-below',
        type: 'CreateItem',
        serverResponse: { id: 'item-below', nextExpectedRevision: '5' },
      })
      const evicted = succeededCommand({
        commandId: 'cmd-evicted',
        type: 'CreateItem',
        cacheKey: deriveScopeKey({ scopeType: 'not-acquired' }),
        serverResponse: { id: 'item-e', nextExpectedRevision: '0' },
      })
      const noReg = succeededCommand({
        commandId: 'cmd-no-reg',
        type: 'UnknownCommand',
      })

      const result = syncManager.testEvaluateCoverageForBatch([applied, below, evicted, noReg])

      expect(result.applied.map((c) => c.commandId).sort()).toEqual(['cmd-applied', 'cmd-evicted'])
    })
  })
})

function createSessionManager(): SessionManager<ServiceLink, EnqueueCommand> {
  return {
    isNetworkPaused: () => true,
    signalAuthenticated: vi.fn().mockResolvedValue({ resumed: false }),
    signalLoggedOut: vi.fn().mockResolvedValue(undefined),
  } as unknown as SessionManager<ServiceLink, EnqueueCommand>
}
