import type { ServiceLink } from '@meticoeus/ddd-es'
import { describe, expect, it, vi } from 'vitest'
import { InMemoryStorage } from '../../storage/InMemoryStorage.js'
import type { Collection } from '../../types/config.js'
import { EnqueueCommand } from '../../types/index.js'
import { EventCache } from '../event-cache/EventCache.js'
import { EventProcessorRegistry } from '../event-processor/EventProcessorRegistry.js'
import { EventProcessorRunner } from '../event-processor/EventProcessorRunner.js'
import type { ProcessorRegistration } from '../event-processor/types.js'
import { EventBus } from '../events/EventBus.js'
import { ReadModelStore } from '../read-model-store/ReadModelStore.js'
import { WriteQueue } from '../write-queue/WriteQueue.js'
import { ALL_OP_TYPES } from '../write-queue/operations.js'
import { AnticipatedEventHandler } from './AnticipatedEventHandler.js'
import type { IAnticipatedEvent } from './AnticipatedEventShape.js'

type TodoCreatedEvent = IAnticipatedEvent<
  'TodoCreated',
  { readonly id: string; readonly title: string }
>
type UnknownEvent = IAnticipatedEvent<'UnknownEvent', { readonly id: string }>
type TestEvent = TodoCreatedEvent | UnknownEvent

const CACHE_KEY = 'ck-todos'

const COLLECTIONS: Collection<ServiceLink>[] = [
  {
    name: 'todos',
    matchesStream: (s) => s.startsWith('Todo-'),
    cacheKeysFromTopics: () => [],
  },
]

describe('AnticipatedEventHandler', () => {
  interface BootstrapResult {
    storage: InMemoryStorage<ServiceLink, EnqueueCommand>
    eventBus: EventBus<ServiceLink>
    eventCache: EventCache<ServiceLink, EnqueueCommand>
    readModelStore: ReadModelStore<ServiceLink, EnqueueCommand>
    handler: AnticipatedEventHandler<ServiceLink, EnqueueCommand>
  }

  async function bootstrap(): Promise<BootstrapResult> {
    const storage = new InMemoryStorage<ServiceLink, EnqueueCommand>()
    await storage.initialize()
    const eventBus = new EventBus<ServiceLink>()
    const eventCache = new EventCache<ServiceLink, EnqueueCommand>({ storage, eventBus })
    const readModelStore = new ReadModelStore<ServiceLink, EnqueueCommand>({ storage })

    const registry = new EventProcessorRegistry()
    registry.register(todoProcessor())
    const runner = new EventProcessorRunner(readModelStore, eventBus, registry)

    const wq = createTestWriteQueue(eventBus)
    const handler = new AnticipatedEventHandler<ServiceLink, EnqueueCommand>(
      eventCache,
      runner,
      readModelStore,
      COLLECTIONS,
      wq,
    )

    return {
      storage,
      eventBus,
      eventCache,
      readModelStore,
      handler,
    }
  }

  describe('cache', () => {
    it('caches anticipated events and processes them into read models', async () => {
      const { handler, readModelStore } = await bootstrap()
      await handler.cache<TestEvent>({
        commandId: 'cmd-1',
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Buy milk' },
            streamId: 'Todo-todo-1',
          },
        ],
        cacheKey: CACHE_KEY,
      })

      const models = await readModelStore.list('todos')
      expect(models).toHaveLength(1)
      expect(models[0]?.data).toMatchObject({ id: 'todo-1', title: 'Buy milk' })
    })

    it('tracks updated entity IDs per command', async () => {
      const { handler } = await bootstrap()
      await handler.cache({
        commandId: 'cmd-1',
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Buy milk' },
            streamId: 'Todo-todo-1',
          },
        ],
        cacheKey: CACHE_KEY,
      })

      expect(handler.getTrackedEntries('cmd-1')).toEqual(['todos:todo-1'])
    })

    it('skips events that do not match any collection', async () => {
      const { handler } = await bootstrap()
      await handler.cache({
        commandId: 'cmd-1',
        events: [{ type: 'UnknownEvent', data: { id: 'x' }, streamId: 'Unknown-x' }],
        cacheKey: CACHE_KEY,
      })

      expect(handler.getTrackedEntries('cmd-1')).toBeUndefined()
    })

    it('sets _clientMetadata when clientId is provided', async () => {
      const { handler, readModelStore } = await bootstrap()
      await handler.cache({
        commandId: 'cmd-1',
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Buy milk' },
            streamId: 'Todo-todo-1',
          },
        ],
        clientId: 'client-abc',
        cacheKey: CACHE_KEY,
      })

      const model = await readModelStore.getById('todos', 'todo-1')
      expect(model?._clientMetadata).toEqual({ clientId: 'client-abc' })
    })

    it('caches the event in EventCache', async () => {
      const { eventCache, handler } = await bootstrap()
      await handler.cache({
        commandId: 'cmd-1',
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Buy milk' },
            streamId: 'Todo-todo-1',
          },
        ],
        cacheKey: CACHE_KEY,
      })

      const events = await eventCache.getAnticipatedEventsByCommand('cmd-1')
      expect(events).toHaveLength(1)
      expect(events[0]?.type).toBe('TodoCreated')
    })
  })

  describe('cleanup', () => {
    it('deletes anticipated events from cache on any terminal status', async () => {
      const { eventCache, handler } = await bootstrap()
      await handler.cache({
        commandId: 'cmd-1',
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Buy milk' },
            streamId: 'Todo-todo-1',
          },
        ],
        cacheKey: CACHE_KEY,
      })

      await handler.cleanup('cmd-1', 'succeeded')

      const events = await eventCache.getAnticipatedEventsByCommand('cmd-1')
      expect(events).toHaveLength(0)
    })

    it('retains tracking entries on success for getCommandEntities', async () => {
      const { handler } = await bootstrap()
      await handler.cache({
        commandId: 'cmd-1',
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Buy milk' },
            streamId: 'Todo-todo-1',
          },
        ],
        cacheKey: CACHE_KEY,
      })

      await handler.cleanup('cmd-1', 'succeeded')

      expect(handler.getTrackedEntries('cmd-1')).toEqual(['todos:todo-1'])
    })

    it('deletes tracking entries on failure', async () => {
      const { handler, readModelStore } = await bootstrap()
      await handler.cache({
        commandId: 'cmd-1',
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Buy milk' },
            streamId: 'Todo-todo-1',
          },
        ],
        cacheKey: CACHE_KEY,
      })

      await handler.cleanup('cmd-1', 'failed')

      expect(handler.getTrackedEntries('cmd-1')).toBeUndefined()
    })

    it('clears local changes for tracked entities', async () => {
      const { handler, readModelStore } = await bootstrap()
      const clearSpy = vi.spyOn(readModelStore, 'clearLocalChanges')

      await handler.cache({
        commandId: 'cmd-1',
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Buy milk' },
            streamId: 'Todo-todo-1',
          },
        ],
        cacheKey: CACHE_KEY,
      })

      await handler.cleanup('cmd-1', 'failed')

      expect(clearSpy).toHaveBeenCalledWith('todos', 'todo-1')
    })
  })

  describe('regenerate', () => {
    it('replaces anticipated events with new ones', async () => {
      const { handler, readModelStore } = await bootstrap()
      await handler.cache({
        commandId: 'cmd-1',
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Original' },
            streamId: 'Todo-todo-1',
          },
        ],
        cacheKey: CACHE_KEY,
      })

      await handler.regenerate<TestEvent>(
        'cmd-1',
        [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Regenerated' },
            streamId: 'Todo-todo-1',
          },
        ],
        CACHE_KEY,
      )

      const model = await readModelStore.getById('todos', 'todo-1')
      expect(model?.data).toMatchObject({ title: 'Regenerated' })
    })

    it('clears old tracking and creates new tracking entries', async () => {
      const { handler, readModelStore } = await bootstrap()
      const clearSpy = vi.spyOn(readModelStore, 'clearLocalChanges')

      await handler.cache({
        commandId: 'cmd-1',
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Original' },
            streamId: 'Todo-todo-1',
          },
        ],
        cacheKey: CACHE_KEY,
      })

      await handler.regenerate(
        'cmd-1',
        [{ type: 'TodoCreated', data: { id: 'todo-2', title: 'New' }, streamId: 'Todo-todo-2' }],
        CACHE_KEY,
      )

      // Old entry was cleared
      expect(clearSpy).toHaveBeenCalledWith('todos', 'todo-1')
      // New entry is tracked
      expect(handler.getTrackedEntries('cmd-1')).toEqual(['todos:todo-2'])
    })
  })

  describe('getTrackedEntries', () => {
    it('returns undefined for unknown commands', async () => {
      const { handler } = await bootstrap()
      expect(handler.getTrackedEntries('nonexistent')).toBeUndefined()
    })
  })

  describe('getAnticipatedEventsForStream', () => {
    it('returns anticipated events for stream excluding a command', async () => {
      const { handler } = await bootstrap()
      await handler.cache({
        commandId: 'cmd-1',
        events: [
          { type: 'TodoCreated', data: { id: 'todo-1', title: 'First' }, streamId: 'Todo-todo-1' },
        ],
        cacheKey: CACHE_KEY,
      })
      await handler.cache({
        commandId: 'cmd-2',
        events: [
          { type: 'TodoCreated', data: { id: 'todo-1', title: 'Second' }, streamId: 'Todo-todo-1' },
        ],
        cacheKey: CACHE_KEY,
      })

      const events = await handler.getAnticipatedEventsForStream('Todo-todo-1', 'cmd-1')

      expect(events).toHaveLength(1)
      expect(events[0]?.commandId).toBe('cmd-2')
    })

    it('returns empty array when no matching events', async () => {
      const { handler } = await bootstrap()
      const events = await handler.getAnticipatedEventsForStream('Todo-todo-1', 'cmd-1')
      expect(events).toEqual([])
    })
  })

  describe('clearAll', () => {
    it('clears all in-memory tracking state', async () => {
      const { handler } = await bootstrap()
      await handler.cache({
        commandId: 'cmd-1',
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Buy milk' },
            streamId: 'Todo-todo-1',
          },
        ],
        cacheKey: CACHE_KEY,
      })

      await handler.clearAll()

      expect(handler.getTrackedEntries('cmd-1')).toBeUndefined()
    })
  })
})

function todoProcessor(): ProcessorRegistration<{ id: string; title: string }> {
  return {
    eventTypes: 'TodoCreated',
    processor: (data) => ({
      collection: 'todos',
      id: data.id,
      update: { type: 'set', data },
      isServerUpdate: false,
    }),
  }
}

function createTestWriteQueue(eventBus: EventBus<ServiceLink>): WriteQueue<ServiceLink> {
  const wq = new WriteQueue<ServiceLink>(eventBus)
  wq.setSessionResetHandler(vi.fn(async () => {}))
  for (const type of ALL_OP_TYPES) {
    if (type === 'apply-anticipated') continue
    wq.register(
      type,
      vi.fn(async () => {}),
    )
    wq.registerEviction(type, () => {})
  }
  return wq
}
