/**
 * Unit tests for SyncManager — session cascade and response event processing.
 */

import type { IPersistedEvent, ServiceLink } from '@meticoeus/ddd-es'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryStorage } from '../../storage/InMemoryStorage.js'
import { Collection, FetchSeedRecordOptions, SeedRecordPage } from '../../types/config.js'
import { cookieAuthStrategy } from '../auth.js'
import { type CacheKeyIdentity, deriveScopeKey } from '../cache-manager/CacheKey.js'
import { CacheManager } from '../cache-manager/CacheManager.js'
import { IAnticipatedEvent } from '../command-lifecycle/AnticipatedEventShape.js'
import type { IAnticipatedEventHandler } from '../command-queue/CommandQueue.js'
import { CommandQueue } from '../command-queue/CommandQueue.js'
import { EventCache } from '../event-cache/EventCache.js'
import { EventProcessorRegistry } from '../event-processor/EventProcessorRegistry.js'
import type { ParsedEvent } from '../event-processor/EventProcessorRunner.js'
import { EventProcessorRunner } from '../event-processor/EventProcessorRunner.js'
import { ProcessorRegistration } from '../event-processor/index.js'
import { EventBus } from '../events/EventBus.js'
import { QueryManager } from '../query-manager/QueryManager.js'
import { ReadModelStore } from '../read-model-store/ReadModelStore.js'
import type { SessionManager } from '../session/SessionManager.js'
import { SyncManager } from './SyncManager.js'

const DUMMY_NETWORK = { baseUrl: 'http://localhost:3000' }

const TODO_CACHE_KEY = deriveScopeKey({ scopeType: 'todos' })

class TestSyncManager extends SyncManager<ServiceLink, unknown, IAnticipatedEvent> {
  getKnownRevisions(): Map<string, bigint> {
    return this.knownRevisions
  }

  getInvalidationScheduler() {
    return this.invalidationScheduler
  }

  async testHandleWebSocketEvent(event: IPersistedEvent, topics: string[] = []): Promise<void> {
    const cacheKeys = this.resolveCacheKeysFromTopics(event.streamId, topics)
    return this.handleWebSocketEvent({ event, cacheKeys })
  }

  async testSeedOneCollection(
    collection: Collection<ServiceLink>,
    cacheKey: CacheKeyIdentity<ServiceLink>,
    topics: readonly string[],
  ): Promise<{ seeded: boolean; recordCount: number }> {
    const ctx = await this.buildFetchContext()
    return this.seedOneCollection({ collection, cacheKey, topics, ctx })
  }
}

describe('SyncManager', () => {
  let storage: InMemoryStorage<ServiceLink>
  let eventBus: EventBus<ServiceLink>
  let cacheManager: CacheManager<ServiceLink>
  let commandQueue: CommandQueue<ServiceLink, unknown, IAnticipatedEvent>
  let eventCache: EventCache<ServiceLink>
  let eventProcessorRunner: EventProcessorRunner<ServiceLink>
  let readModelStore: ReadModelStore<ServiceLink>
  let queryManager: QueryManager<ServiceLink>
  let syncManager: TestSyncManager

  beforeEach(async () => {
    storage = new InMemoryStorage()
    await storage.initialize()
    eventBus = new EventBus()

    cacheManager = new CacheManager({ storage, eventBus, windowId: 'test' })
    await cacheManager.initialize()

    eventCache = new EventCache({ storage, eventBus })
    readModelStore = new ReadModelStore({ storage })

    const registry = new EventProcessorRegistry()
    eventProcessorRunner = new EventProcessorRunner({ readModelStore, eventBus, registry })

    const anticipatedEventHandler: IAnticipatedEventHandler = {
      cache: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn().mockResolvedValue(undefined),
      regenerate: vi.fn().mockResolvedValue(undefined),
      getTrackedEntries: vi.fn().mockReturnValue(undefined),
      getAnticipatedEventsForStream: vi.fn().mockResolvedValue([]),
      clearAll: vi.fn().mockResolvedValue(undefined),
    }

    commandQueue = new CommandQueue({ storage, eventBus, anticipatedEventHandler })

    queryManager = new QueryManager({ eventBus, cacheManager, readModelStore })

    const todosCollection: Collection<ServiceLink> = {
      name: 'todos',
      cacheKeysFromTopics(topics: readonly string[]) {
        return [TODO_CACHE_KEY]
      },
      matchesStream: (streamId: string) => streamId.startsWith('todo-'),
      seedOnInit: { cacheKey: TODO_CACHE_KEY, topics: ['todos'] },
    }
    syncManager = new TestSyncManager({
      eventBus,
      sessionManager: createSessionManager(),
      commandQueue,
      eventCache,
      cacheManager,
      eventProcessor: eventProcessorRunner,
      readModelStore,
      queryManager,
      networkConfig: DUMMY_NETWORK,
      auth: cookieAuthStrategy,
      collections: [todosCollection],
    })
  })

  describe('onSessionDestroyed (via event)', () => {
    it('clears all storage and in-memory state', async () => {
      // Seed some state
      const cacheKey = await cacheManager.acquire(TODO_CACHE_KEY)
      await readModelStore.setServerData(
        'todos',
        'todo-1',
        { id: 'todo-1', title: 'Test' },
        cacheKey,
      )
      await queryManager.hold(cacheKey)
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

  describe('processResponseEvents', () => {
    it('caches events and processes them through event processor', async () => {
      const processEventSpy = vi.spyOn(eventProcessorRunner, 'processEvent')

      const events: ParsedEvent[] = [
        {
          id: 'evt-1',
          type: 'TodoCreated',
          streamId: 'todo-1',
          persistence: 'Permanent',
          data: { id: 'todo-1', title: 'Test' },
          revision: 0n,
          position: 100n,
          cacheKey: 'cache-1',
        },
      ]

      await syncManager.processResponseEvents(events)

      // Event should be cached for WS dedup
      const cached = await eventCache.getEvent('evt-1')
      expect(cached).toBeDefined()

      // Event should have been processed
      expect(processEventSpy).toHaveBeenCalledTimes(1)
    })

    it('advances known revisions on happy path', async () => {
      const events: ParsedEvent[] = [
        {
          id: 'evt-1',
          type: 'TodoCreated',
          streamId: 'todo-1',
          persistence: 'Permanent',
          data: { id: 'todo-1', title: 'Test' },
          revision: 0n,
          position: 100n,
          cacheKey: 'cache-1',
        },
        {
          id: 'evt-2',
          type: 'TodoUpdated',
          streamId: 'todo-1',
          persistence: 'Permanent',
          data: { id: 'todo-1', title: 'Updated' },
          revision: 1n,
          position: 101n,
          cacheKey: 'cache-1',
        },
      ]

      await syncManager.processResponseEvents(events)

      // Both events should be cached
      expect(await eventCache.getEvent('evt-1')).toBeDefined()
      expect(await eventCache.getEvent('evt-2')).toBeDefined()
    })

    it('schedules refetch when gap is detected', async () => {
      // Set known revision so there is a gap
      syncManager.getKnownRevisions().set('todo-1', 0n)

      // Skip revision 1 — go straight to 2, using the actual seed cache key
      const events: ParsedEvent[] = [
        {
          id: 'evt-3',
          type: 'TodoUpdated',
          streamId: 'todo-1',
          persistence: 'Permanent',
          data: { id: 'todo-1', title: 'Gap' },
          revision: 2n,
          position: 200n,
          cacheKey: TODO_CACHE_KEY.key,
        },
      ]

      await syncManager.processResponseEvents(events)

      // A refetch should have been scheduled for the (collection, cacheKey) pair

      expect(syncManager.getInvalidationScheduler().hasPending('todos', TODO_CACHE_KEY.key)).toBe(
        true,
      )

      // Clean up timers
      syncManager.getInvalidationScheduler().cancelAll()
    })
  })

  describe('clearKnownRevisions', () => {
    it('removes specified streamIds from known revisions', () => {
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
        cacheKeysFromTopics(topics: readonly string[]) {
          return []
        },
        seedOnDemand: {
          keyTypes: [{ kind: 'scope', scopeType: 'notebook-notes' }],
          subscribeTopics: () => [],
        },
        matchesStream: (streamId: string) => streamId.startsWith('note-'),
        fetchSeedRecords,
      }

      // Create a SyncManager with the notes collection
      const sm = new SyncManager<ServiceLink, unknown, IAnticipatedEvent>({
        eventBus,
        sessionManager: createSessionManager(),
        commandQueue,
        eventCache,
        cacheManager,
        eventProcessor: eventProcessorRunner,
        readModelStore,
        queryManager,
        networkConfig: DUMMY_NETWORK,
        auth: cookieAuthStrategy,
        collections: [notesCollection],
      })

      const cacheKey = deriveScopeKey({
        scopeType: 'notebook-notes',
        scopeParams: { notebookId: 'nb-1' },
      })

      await cacheManager.acquireKey(cacheKey)
      await sm.seedForKey(cacheKey)

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
        cacheKeysFromTopics(topics: readonly string[]) {
          return []
        },
        seedOnDemand: {
          keyTypes: [{ kind: 'scope', scopeType: 'notebook-notes' }],
          subscribeTopics: () => [],
        },
        matchesStream: (streamId: string) => streamId.startsWith('note-'),
        fetchSeedRecords,
      }

      const sm = new SyncManager<ServiceLink, unknown, IAnticipatedEvent>({
        eventBus,
        sessionManager: createSessionManager(),
        commandQueue,
        eventCache,
        cacheManager,
        eventProcessor: eventProcessorRunner,
        readModelStore,
        queryManager,
        networkConfig: DUMMY_NETWORK,
        auth: cookieAuthStrategy,
        collections: [notesCollection],
      })

      const cacheKey = deriveScopeKey({
        scopeType: 'notebook-notes',
        scopeParams: { notebookId: 'nb-1' },
      })

      // Acquire key first
      await cacheManager.acquireKey(cacheKey)

      // First call seeds
      await sm.seedForKey(cacheKey)
      expect(fetchSeedRecords).toHaveBeenCalledOnce()

      // Second call with the same cacheKey is a no-op
      await sm.seedForKey(cacheKey)
      expect(fetchSeedRecords).toHaveBeenCalledOnce()
    })

    it('does not seed collections that do not match keyTypes', async () => {
      const fetchSeedRecords = vi.fn()

      const todosCollection: Collection<ServiceLink> = {
        name: 'todos',
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

      const sm = new SyncManager<ServiceLink, unknown, IAnticipatedEvent>({
        eventBus,
        sessionManager: createSessionManager(),
        commandQueue,
        eventCache,
        cacheManager,
        eventProcessor: eventProcessorRunner,
        readModelStore,
        queryManager,
        networkConfig: DUMMY_NETWORK,
        auth: cookieAuthStrategy,
        collections: [todosCollection],
      })

      // Seed with a key type that doesn't match todos
      const cacheKey = deriveScopeKey({ scopeType: 'notebook-notes' })
      await sm.seedForKey(cacheKey)

      expect(fetchSeedRecords).not.toHaveBeenCalled()
    })
  })

  describe('seed (full lifecycle)', () => {
    function createNotesCollection(
      fetchSeedRecords: (opts: FetchSeedRecordOptions<ServiceLink>) => Promise<SeedRecordPage>,
    ): Collection<ServiceLink> {
      return {
        name: 'notes',
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

    function createSm(collections: Collection<ServiceLink>[]) {
      return new SyncManager<ServiceLink, unknown, IAnticipatedEvent>({
        eventBus,
        sessionManager: createSessionManager(),
        commandQueue,
        eventCache,
        cacheManager,
        eventProcessor: eventProcessorRunner,
        readModelStore,
        queryManager,
        networkConfig: DUMMY_NETWORK,
        auth: cookieAuthStrategy,
        collections,
      })
    }

    it('resolves immediately when already seeded', async () => {
      const fetchSeedRecords = vi.fn().mockResolvedValue({
        records: [{ id: 'note-1', data: { id: 'note-1' } }],
        nextCursor: null,
      } satisfies SeedRecordPage)

      const sm = createSm([createNotesCollection(fetchSeedRecords)])
      await sm.start()

      const cacheKey = deriveScopeKey({ scopeType: 'notebook-notes' })

      // First seed — acquires key, seeds, waits for settlement
      await sm.seed(cacheKey)
      expect(fetchSeedRecords).toHaveBeenCalledOnce()

      // Second seed — already seeded, resolves immediately without re-fetching
      await sm.seed(cacheKey)
      expect(fetchSeedRecords).toHaveBeenCalledOnce()

      await sm.destroy()
    })

    it('acquires key and waits for settlement when unseeded', async () => {
      const fetchSeedRecords = vi.fn().mockResolvedValue({
        records: [{ id: 'note-1', data: { id: 'note-1' } }],
        nextCursor: null,
      } satisfies SeedRecordPage)

      const sm = createSm([createNotesCollection(fetchSeedRecords)])
      await sm.start()

      const cacheKey = deriveScopeKey({ scopeType: 'notebook-notes' })
      await sm.seed(cacheKey)

      // Key was acquired
      expect(await cacheManager.exists(cacheKey.key)).toBe(true)

      // Data was seeded
      const models = await readModelStore.list('notes', { cacheKey: cacheKey.key })
      expect(models).toHaveLength(1)

      await sm.destroy()
    })

    it('emits cache:seed-settled with correct payload', async () => {
      const fetchSeedRecords = vi.fn().mockResolvedValue({
        records: [{ id: 'note-1', data: { id: 'note-1' } }],
        nextCursor: null,
      } satisfies SeedRecordPage)

      const sm = createSm([createNotesCollection(fetchSeedRecords)])
      await sm.start()

      const events: unknown[] = []
      eventBus.on('cache:seed-settled').subscribe((e) => events.push(e))

      const cacheKey = deriveScopeKey({ scopeType: 'notebook-notes' })
      await sm.seed(cacheKey)

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        data: {
          cacheKey: cacheKey,
          status: 'succeeded',
          collections: [{ name: 'notes', seeded: true }],
        },
      })

      await sm.destroy()
    })
  })

  describe('cache key lifecycle events', () => {
    it('auto-seeds on cache:key-added when keyTypes match', async () => {
      const fetchSeedRecords = vi.fn().mockResolvedValue({
        records: [{ id: 'note-1', data: { id: 'note-1', title: 'Hello' } }],
        nextCursor: null,
      } satisfies SeedRecordPage)

      const notesCollection: Collection<ServiceLink> = {
        name: 'notes',
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

      const sm = new SyncManager<ServiceLink, unknown, IAnticipatedEvent>({
        eventBus,
        sessionManager: createSessionManager(),
        commandQueue,
        eventCache,
        cacheManager,
        eventProcessor: eventProcessorRunner,
        readModelStore,
        queryManager,
        networkConfig: DUMMY_NETWORK,
        auth: cookieAuthStrategy,
        collections: [notesCollection],
      })

      await sm.start()

      // Acquiring a matching key should trigger auto-seed via cache:key-added
      const cacheKey = deriveScopeKey({
        scopeType: 'notebook-notes',
        scopeParams: { notebookId: 'nb-1' },
      })
      await cacheManager.acquireKey(cacheKey)

      // Allow async event handler to complete
      await new Promise((r) => setTimeout(r, 50))

      expect(fetchSeedRecords).toHaveBeenCalledOnce()

      await sm.destroy()
    })

    it('does not auto-seed when keyTypes do not match', async () => {
      const fetchSeedRecords = vi.fn()

      const todosCollection: Collection<ServiceLink> = {
        name: 'todos',
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

      const sm = new SyncManager<ServiceLink, unknown, IAnticipatedEvent>({
        eventBus,
        sessionManager: createSessionManager(),
        commandQueue,
        eventCache,
        cacheManager,
        eventProcessor: eventProcessorRunner,
        readModelStore,
        queryManager,
        networkConfig: DUMMY_NETWORK,
        auth: cookieAuthStrategy,
        collections: [todosCollection],
      })

      await sm.start()

      // Acquire a key that doesn't match todos
      await cacheManager.acquireKey(deriveScopeKey({ scopeType: 'unrelated' }))

      await new Promise((r) => setTimeout(r, 50))

      expect(fetchSeedRecords).not.toHaveBeenCalled()

      await sm.destroy()
    })

    it('cleans up seed status on cache:evicted', async () => {
      const notesCollection: Collection<ServiceLink> = {
        name: 'notes',
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

      const sm = new SyncManager<ServiceLink, unknown, IAnticipatedEvent>({
        eventBus,
        sessionManager: createSessionManager(),
        commandQueue,
        eventCache,
        cacheManager,
        eventProcessor: eventProcessorRunner,
        readModelStore,
        queryManager,
        networkConfig: DUMMY_NETWORK,
        auth: cookieAuthStrategy,
        collections: [notesCollection],
      })

      await sm.start()

      const cacheKey = deriveScopeKey({ scopeType: 'notebook-notes' })
      // Acquire key first (seedForKey assumes key is already in storage)
      await cacheManager.acquireKey(cacheKey)
      await sm.seedForKey(cacheKey)

      // Verify data exists
      const beforeModels = await readModelStore.list('notes', { cacheKey: cacheKey.key })
      expect(beforeModels).toHaveLength(1)

      // Evict the key
      await cacheManager.evict(cacheKey.key)

      // Allow async eviction handler to complete
      await new Promise((r) => setTimeout(r, 50))

      // Seed status should be cleaned up
      const status = sm.getCollectionStatus('notes')
      expect(status).toBeUndefined()

      await sm.destroy()
    })
  })

  describe('WS event routing (handleWebSocketEvent)', () => {
    function createPersistedEvent(overrides: Partial<IPersistedEvent> = {}): IPersistedEvent {
      return {
        id: 'event-1',
        type: 'NoteCreated',
        streamId: 'Note-note-1',
        data: { id: 'note-1', title: 'Hello' },
        metadata: { correlationId: 'test' },
        created: new Date().toISOString(),
        revision: 0n,
        position: 100n,
        ...overrides,
      }
    }

    it('processes WS event for all active cache keys', async () => {
      const notesCollection: Collection<ServiceLink> = {
        name: 'notes',
        cacheKeysFromTopics: (topics) =>
          topics
            .filter((t) => t.startsWith('Notebook:'))
            .map((t) =>
              deriveScopeKey({
                scopeType: 'notebook-notes',
                scopeParams: { nb: t.split(':')[1] },
              }),
            ),
        seedOnDemand: {
          keyTypes: [{ kind: 'scope', scopeType: 'notebook-notes' }],
          subscribeTopics: () => [],
        },
        matchesStream: (s) => s.startsWith('Note-'),
        fetchSeedRecords: vi.fn().mockResolvedValue({ records: [], nextCursor: null }),
      } satisfies Collection<ServiceLink>

      const sm = createTestableSm(
        [notesCollection],
        [
          {
            eventTypes: 'NoteCreated',
            processor: (data: { id: string }) => ({
              collection: 'notes',
              id: data.id,
              update: { type: 'set', data },
              isServerUpdate: true,
            }),
          },
        ],
      )

      // Seed two different cache keys for the same collection
      const keyA = deriveScopeKey({ scopeType: 'notebook-notes', scopeParams: { nb: 'a' } })
      const keyB = deriveScopeKey({ scopeType: 'notebook-notes', scopeParams: { nb: 'b' } })
      await cacheManager.acquireKey(keyA)
      await cacheManager.acquireKey(keyB)
      await sm.seedForKey(keyA)
      await sm.seedForKey(keyB)

      // Process a WS event with topics for both notebooks
      await sm.testHandleWebSocketEvent(createPersistedEvent(), ['Notebook:a', 'Notebook:b'])

      // Verify the event was cached with both cache key associations
      const cachedEvent = await storage.getCachedEvent('event-1')
      expect(cachedEvent?.cacheKeys).toContain(keyA.key)
      expect(cachedEvent?.cacheKeys).toContain(keyB.key)

      // Read model exists (last write wins — both keys process, second overwrites first)
      // TODO: read model junction table needed for true per-key read model records
      const allModels = await readModelStore.list('notes')
      expect(allModels).toHaveLength(1)
      expect(allModels[0]?.data).toMatchObject({ id: 'note-1' })
    })

    it('skips WS event when no active keys for collection', async () => {
      const notesCollection: Collection<ServiceLink> = {
        name: 'notes',
        cacheKeysFromTopics(topics: readonly string[]) {
          return []
        },
        seedOnDemand: {
          keyTypes: [{ kind: 'scope', scopeType: 'notebook-notes' }],
          subscribeTopics: () => [],
        },
        matchesStream: (s) => s.startsWith('Note-'),
      }

      const sm = createTestableSm(
        [notesCollection],
        [
          {
            eventTypes: 'NoteCreated',
            processor: (data: { id: string }) => ({
              collection: 'notes',
              id: data.id,
              update: { type: 'set', data },
              isServerUpdate: true,
            }),
          },
        ],
      )

      // No keys seeded — event should be dropped
      await sm.testHandleWebSocketEvent(createPersistedEvent())

      // No read models should exist
      const models = await readModelStore.list('notes')
      expect(models).toHaveLength(0)
    })

    it('adds cache key associations for duplicate WS events', async () => {
      const notesCollection: Collection<ServiceLink> = {
        name: 'notes',
        cacheKeysFromTopics: (topics) =>
          topics
            .filter((t) => t.startsWith('Notebook:'))
            .map((t) =>
              deriveScopeKey({
                scopeType: 'notebook-notes',
                scopeParams: { nb: t.split(':')[1] },
              }),
            ),
        seedOnDemand: {
          keyTypes: [{ kind: 'scope', scopeType: 'notebook-notes' }],
          subscribeTopics: () => [],
        },
        matchesStream: (s) => s.startsWith('Note-'),
        fetchSeedRecords: vi.fn().mockResolvedValue({ records: [], nextCursor: null }),
      }

      const sm = createTestableSm(
        [notesCollection],
        [
          {
            eventTypes: 'NoteCreated',
            processor: (data: { id: string }) => ({
              collection: 'notes',
              id: data.id,
              update: { type: 'set', data },
              isServerUpdate: true,
            }),
          },
        ],
      )

      // Seed first key and process event with topic for notebook A
      const keyA = deriveScopeKey({ scopeType: 'notebook-notes', scopeParams: { nb: 'a' } })
      await cacheManager.acquireKey(keyA)
      await sm.seedForKey(keyA)
      await sm.testHandleWebSocketEvent(createPersistedEvent(), ['Notebook:a'])

      // Seed second key and process same event again with topic for notebook B (duplicate event)
      const keyB = deriveScopeKey({ scopeType: 'notebook-notes', scopeParams: { nb: 'b' } })
      await cacheManager.acquireKey(keyB)
      await sm.seedForKey(keyB)
      await sm.testHandleWebSocketEvent(createPersistedEvent(), ['Notebook:b'])

      // Event should have both cache key associations
      const event = await storage.getCachedEvent('event-1')
      expect(event?.cacheKeys).toContain(keyA.key)
      expect(event?.cacheKeys).toContain(keyB.key)
    })

    it('repairs gap when WS event arrives after record-based seeding', async () => {
      const fetchStreamEvents = vi.fn().mockResolvedValue([
        {
          id: 'missed-event',
          type: 'NotebookNameUpdated',
          streamId: 'Notebook-nb-1',
          data: { id: 'nb-1', name: 'Updated', updatedAt: new Date().toISOString() },
          metadata: { correlationId: 'test' },
          created: new Date().toISOString(),
          revision: 1n,
          position: 201n,
        },
      ])

      const notebooksCollection = {
        name: 'notebooks',
        cacheKeysFromTopics(topics: readonly string[]) {
          return [deriveScopeKey({ scopeType: 'notebooks' })]
        },
        seedOnInit: {
          cacheKey: deriveScopeKey({ scopeType: 'notebooks' }),
          topics: ['Notebook:*'],
        },
        matchesStream: (s) => s.startsWith('Notebook-'),
        getStreamId: (id) => `Notebook-${id}`,
        fetchSeedRecords: vi.fn().mockResolvedValue({
          records: [
            {
              id: 'nb-1',
              data: { id: 'nb-1', name: 'Original', tags: [], createdAt: new Date().toISOString() },
              revision: '0',
            },
          ],
          nextCursor: null,
        }),
        fetchStreamEvents: ({ afterRevision }) => {
          // Only return the missed event when asked for events after revision 0
          if (afterRevision === 0n) return fetchStreamEvents()
          return Promise.resolve([])
        },
      } satisfies Collection<ServiceLink>

      const sm = createTestableSm(
        [notebooksCollection],
        [
          {
            eventTypes: 'NotebookNameUpdated',
            processor: (data: { id: string; name: string }) => ({
              collection: 'notebooks',
              id: data.id,
              update: { type: 'merge', data: { name: data.name } },
              isServerUpdate: true,
            }),
          },
          {
            eventTypes: 'NotebookTagAdded',
            processor: (data: { id: string; tag: string }) => ({
              collection: 'notebooks',
              id: data.id,
              update: { type: 'merge', data: { tag: data.tag } },
              isServerUpdate: true,
            }),
          },
        ],
      )

      await sm.start()

      // Seed the collection directly (simulates what doStartSync does after auth)
      await cacheManager.acquireKey(notebooksCollection.seedOnInit.cacheKey)
      await sm.testSeedOneCollection(
        notebooksCollection,
        notebooksCollection.seedOnInit.cacheKey,
        notebooksCollection.seedOnInit.topics,
      )

      // Verify seed populated read model and knownRevisions
      const seededModels = await readModelStore.list('notebooks', {
        cacheKey: notebooksCollection.seedOnInit.cacheKey.key,
      })
      expect(seededModels).toHaveLength(1)
      expect(seededModels[0]?.data).toMatchObject({ name: 'Original' })

      // Simulate WS event at revision 2, skipping revision 1 (the rename)
      await sm.testHandleWebSocketEvent(
        {
          id: 'ws-event',
          type: 'NotebookTagAdded',
          streamId: 'Notebook-nb-1',
          data: { id: 'nb-1', tag: 'trigger-tag' },
          metadata: { correlationId: 'test' },
          created: new Date().toISOString(),
          revision: 2n,
          position: 202n,
        },
        ['Notebook:nb-1'],
      )

      // Allow async gap repair to complete
      await new Promise((r) => setTimeout(r, 100))

      // Gap repair should have fetched the missed event (revision 1)
      expect(fetchStreamEvents).toHaveBeenCalled()

      // Both events should have been processed:
      // - revision 1 (NotebookNameUpdated → name: 'Updated')
      // - revision 2 (NotebookTagAdded → tag: 'trigger-tag')
      const models = await readModelStore.list('notebooks', {
        cacheKey: notebooksCollection.seedOnInit.cacheKey.key,
      })
      expect(models).toHaveLength(1)
      expect(models[0]?.data).toMatchObject({ name: 'Updated' })

      await sm.destroy()
    })
  })

  function createTestableSm(
    collections: Collection<ServiceLink>[],
    processors: ProcessorRegistration<unknown, Record<string, unknown>>[] = [],
  ): TestSyncManager {
    const registry = new EventProcessorRegistry()
    for (const p of processors) {
      registry.register(p)
    }
    const runner = new EventProcessorRunner({ readModelStore, eventBus, registry })

    return new TestSyncManager({
      eventBus,
      sessionManager: createSessionManager(),
      commandQueue,
      eventCache,
      cacheManager,
      eventProcessor: runner,
      readModelStore,
      queryManager,
      networkConfig: DUMMY_NETWORK,
      auth: cookieAuthStrategy,
      collections,
    })
  }
})

function createSessionManager(): SessionManager<ServiceLink> {
  return {
    isNetworkPaused: () => true,
    signalAuthenticated: vi.fn().mockResolvedValue({ resumed: false }),
    signalLoggedOut: vi.fn().mockResolvedValue(undefined),
  } as unknown as SessionManager<ServiceLink>
}
