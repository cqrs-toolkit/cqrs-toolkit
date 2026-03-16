/**
 * Unit tests for SyncManager — session cascade and response event processing.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryStorage } from '../../storage/InMemoryStorage.js'
import type { Collection } from '../../types/config.js'
import { cookieAuthStrategy } from '../auth.js'
import { CacheManager } from '../cache-manager/CacheManager.js'
import type { IAnticipatedEventHandler } from '../command-queue/CommandQueue.js'
import { CommandQueue } from '../command-queue/CommandQueue.js'
import { EventCache } from '../event-cache/EventCache.js'
import { EventProcessorRegistry } from '../event-processor/EventProcessorRegistry.js'
import type { ParsedEvent } from '../event-processor/EventProcessorRunner.js'
import { EventProcessorRunner } from '../event-processor/EventProcessorRunner.js'
import { EventBus } from '../events/EventBus.js'
import { QueryManager } from '../query-manager/QueryManager.js'
import { ReadModelStore } from '../read-model-store/ReadModelStore.js'
import type { SessionManager } from '../session/SessionManager.js'
import { SyncManager } from './SyncManager.js'

const DUMMY_NETWORK = { baseUrl: 'http://localhost:3000' }

function createSessionManager(): SessionManager {
  return {
    isNetworkPaused: () => true,
    signalAuthenticated: vi.fn().mockResolvedValue({ resumed: false }),
    signalLoggedOut: vi.fn().mockResolvedValue(undefined),
  } as unknown as SessionManager
}

describe('SyncManager', () => {
  let storage: InMemoryStorage
  let eventBus: EventBus
  let cacheManager: CacheManager
  let commandQueue: CommandQueue
  let eventCache: EventCache
  let eventProcessorRunner: EventProcessorRunner
  let readModelStore: ReadModelStore
  let queryManager: QueryManager
  let syncManager: SyncManager

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

    syncManager = new SyncManager({
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
      collections: [
        {
          name: 'todos',
          matchesStream: (streamId: string) => streamId.startsWith('todo-'),
          getTopics: () => ['todos'],
          seedOnInit: false,
        } as unknown as Collection,
      ],
    })
  })

  describe('onSessionDestroyed (via event)', () => {
    it('clears all storage and in-memory state', async () => {
      // Seed some state
      const cacheKey = await cacheManager.acquire('todos')
      await readModelStore.setServerData(
        'todos',
        'todo-1',
        { id: 'todo-1', title: 'Test' },
        cacheKey,
      )
      await queryManager.hold(cacheKey)
      await commandQueue.enqueue({ type: 'CreateTodo', payload: {} })

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
      const syncManagerAny = syncManager as any
      syncManagerAny.knownRevisions.set('todo-1', 0n)

      // Skip revision 1 — go straight to 2
      const events: ParsedEvent[] = [
        {
          id: 'evt-3',
          type: 'TodoUpdated',
          streamId: 'todo-1',
          persistence: 'Permanent',
          data: { id: 'todo-1', title: 'Gap' },
          revision: 2n,
          position: 200n,
          cacheKey: 'cache-1',
        },
      ]

      await syncManager.processResponseEvents(events)

      // A refetch should have been scheduled (we can check pendingRefetches)
      expect(syncManagerAny.pendingRefetches.has('todos')).toBe(true)

      // Clean up timers
      for (const timer of syncManagerAny.pendingRefetches.values()) {
        clearTimeout(timer)
      }
    })
  })

  describe('clearKnownRevisions', () => {
    it('removes specified streamIds from known revisions', () => {
      const syncManagerAny = syncManager as any
      syncManagerAny.knownRevisions.set('stream-1', 5n)
      syncManagerAny.knownRevisions.set('stream-2', 10n)
      syncManagerAny.knownRevisions.set('stream-3', 15n)

      syncManager.clearKnownRevisions(['stream-1', 'stream-3'])

      expect(syncManagerAny.knownRevisions.has('stream-1')).toBe(false)
      expect(syncManagerAny.knownRevisions.has('stream-2')).toBe(true)
      expect(syncManagerAny.knownRevisions.has('stream-3')).toBe(false)
    })
  })
})
