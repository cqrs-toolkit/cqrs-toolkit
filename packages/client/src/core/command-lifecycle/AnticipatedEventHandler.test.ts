import type { ServiceLink } from '@meticoeus/ddd-es'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InMemoryStorage } from '../../storage/InMemoryStorage.js'
import { createTestWriteQueue } from '../../testing/createTestWriteQueue.js'
import { TodoAggregate } from '../../testing/index.js'
import type { CommandRecord } from '../../types/commands.js'
import type { Collection } from '../../types/config.js'
import { EnqueueCommand } from '../../types/index.js'
import { deriveScopeKey } from '../cache-manager/CacheKey.js'
import { CommandIdMappingStore } from '../command-id-mapping-store/CommandIdMappingStore.js'
import { EventCache } from '../event-cache/EventCache.js'
import { EventProcessorRegistry } from '../event-processor/EventProcessorRegistry.js'
import { EventProcessorRunner } from '../event-processor/EventProcessorRunner.js'
import type { ProcessorRegistration } from '../event-processor/types.js'
import { EventBus } from '../events/EventBus.js'
import { ReadModelStore } from '../read-model-store/ReadModelStore.js'
import { AnticipatedEventHandler } from './AnticipatedEventHandler.js'
import type { IAnticipatedEvent } from './AnticipatedEventShape.js'

type TodoCreatedEvent = IAnticipatedEvent<
  'TodoCreated',
  { readonly id: string; readonly title: string }
>
type UnknownEvent = IAnticipatedEvent<'UnknownEvent', { readonly id: string }>
type TestEvent = TodoCreatedEvent | UnknownEvent

const TODO_CACHE_KEY = deriveScopeKey({ scopeType: 'todos' })

const COLLECTIONS: Collection<ServiceLink>[] = [
  {
    name: 'todos',
    aggregate: TodoAggregate,
    matchesStream: (s) => s.startsWith('nb.Todo-'),
    cacheKeysFromTopics: () => [],
  },
]

function mockCommand(
  overrides: Partial<CommandRecord<ServiceLink, EnqueueCommand>> = {},
): CommandRecord<ServiceLink, EnqueueCommand> {
  return {
    commandId: 'cmd-1',
    cacheKey: TODO_CACHE_KEY,
    service: 'default',
    type: 'CreateTodo',
    data: {},
    status: 'pending',
    dependsOn: [],
    blockedBy: [],
    attempts: 0,
    seq: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

describe('AnticipatedEventHandler', () => {
  let cleanup: (() => void)[] = []

  afterEach(() => {
    for (const fn of cleanup) fn()
    cleanup = []
  })

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
    const eventCache = new EventCache<ServiceLink, EnqueueCommand>(storage)
    const mappingStore = new CommandIdMappingStore<ServiceLink, EnqueueCommand>(storage)
    await mappingStore.initialize()
    const readModelStore = new ReadModelStore<ServiceLink, EnqueueCommand>(
      eventBus,
      storage,
      mappingStore,
    )

    const registry = new EventProcessorRegistry()
    registry.register(todoProcessor())
    const runner = new EventProcessorRunner(eventBus, registry, readModelStore)

    const wq = createTestWriteQueue(eventBus, cleanup, ['apply-anticipated'])
    const handler = new AnticipatedEventHandler<ServiceLink, EnqueueCommand>(
      eventBus,
      eventCache,
      registry,
      readModelStore,
      COLLECTIONS,
      wq,
    )

    return { storage, eventBus, eventCache, readModelStore, handler }
  }

  describe('cache', () => {
    it('caches anticipated events and processes them into read models', async () => {
      const { handler, readModelStore } = await bootstrap()
      await handler.cache<TestEvent>({
        command: mockCommand(),
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Buy milk' },
            streamId: 'nb.Todo-todo-1',
          },
        ],
      })

      const models = await readModelStore.list('todos')
      expect(models).toHaveLength(1)
      expect(models[0]?.data).toMatchObject({ id: 'todo-1', title: 'Buy milk' })
    })

    it('tracks updated entity IDs per command', async () => {
      const { handler } = await bootstrap()
      await handler.cache({
        command: mockCommand(),
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Buy milk' },
            streamId: 'nb.Todo-todo-1',
          },
        ],
      })

      expect(handler.getTrackedEntries('cmd-1')).toEqual(['todos:todo-1'])
    })

    it('skips events that do not match any collection', async () => {
      const { handler } = await bootstrap()
      await handler.cache({
        command: mockCommand(),
        events: [{ type: 'UnknownEvent', data: { id: 'x' }, streamId: 'Unknown-x' }],
      })

      expect(handler.getTrackedEntries('cmd-1')).toBeUndefined()
    })

    it('sets _clientMetadata when clientId is provided', async () => {
      const { handler, readModelStore } = await bootstrap()
      await handler.cache({
        command: mockCommand(),
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Buy milk' },
            streamId: 'nb.Todo-todo-1',
          },
        ],
        clientId: 'client-abc',
      })

      const model = await readModelStore.getById('todos', 'todo-1')
      expect(model?._clientMetadata).toEqual({ clientId: 'client-abc' })
    })

    it('caches the event in EventCache', async () => {
      const { eventCache, handler } = await bootstrap()
      await handler.cache({
        command: mockCommand(),
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Buy milk' },
            streamId: 'nb.Todo-todo-1',
          },
        ],
      })

      const events = await eventCache.getAnticipatedEventsByCommand('cmd-1')
      expect(events).toHaveLength(1)
      expect(events[0]?.type).toBe('TodoCreated')
    })

    it('emits readmodel:updated with commandIds', async () => {
      const { eventBus, handler } = await bootstrap()
      const emissions: Array<{ collection: string; commandIds?: string[] }> = []
      eventBus.on('readmodel:updated').subscribe((e) => emissions.push(e.data))

      await handler.cache({
        command: mockCommand(),
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Buy milk' },
            streamId: 'nb.Todo-todo-1',
          },
        ],
      })

      expect(emissions).toHaveLength(1)
      expect(emissions[0]?.collection).toBe('todos')
      expect(emissions[0]?.commandIds).toEqual(['cmd-1'])
    })
  })

  describe('cleanupOnSucceeded', () => {
    it('deletes anticipated events from cache', async () => {
      const { eventCache, handler } = await bootstrap()
      await handler.cache({
        command: mockCommand(),
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Buy milk' },
            streamId: 'nb.Todo-todo-1',
          },
        ],
      })

      await handler.cleanupOnSucceeded('cmd-1')

      const events = await eventCache.getAnticipatedEventsByCommand('cmd-1')
      expect(events).toHaveLength(0)
    })

    it('retains tracking entries for later applied transition', async () => {
      const { handler } = await bootstrap()
      await handler.cache({
        command: mockCommand(),
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Buy milk' },
            streamId: 'nb.Todo-todo-1',
          },
        ],
      })

      await handler.cleanupOnSucceeded('cmd-1')

      expect(handler.getTrackedEntries('cmd-1')).toEqual(['todos:todo-1'])
    })

    it('does not clear local changes — overlay is preserved for the pipeline to supersede', async () => {
      const { handler, readModelStore } = await bootstrap()
      const clearSpy = vi.spyOn(readModelStore, 'clearLocalChanges')

      await handler.cache({
        command: mockCommand(),
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Buy milk' },
            streamId: 'nb.Todo-todo-1',
          },
        ],
      })

      await handler.cleanupOnSucceeded('cmd-1')

      expect(clearSpy).not.toHaveBeenCalled()
    })
  })

  describe('cleanupOnAppliedBatch', () => {
    it('deletes anticipated events from cache for every command in the batch', async () => {
      const { eventCache, handler } = await bootstrap()
      await handler.cache({
        command: mockCommand({ commandId: 'cmd-1' }),
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'A' },
            streamId: 'nb.Todo-todo-1',
          },
        ],
      })
      await handler.cache({
        command: mockCommand({ commandId: 'cmd-2' }),
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-2', title: 'B' },
            streamId: 'nb.Todo-todo-2',
          },
        ],
      })

      await handler.cleanupOnAppliedBatch(['cmd-1', 'cmd-2'])

      expect(await eventCache.getAnticipatedEventsByCommand('cmd-1')).toHaveLength(0)
      expect(await eventCache.getAnticipatedEventsByCommand('cmd-2')).toHaveLength(0)
    })

    it('drops tracking entries for every command in the batch', async () => {
      const { handler } = await bootstrap()
      await handler.cache({
        command: mockCommand({ commandId: 'cmd-1' }),
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'A' },
            streamId: 'nb.Todo-todo-1',
          },
        ],
      })
      await handler.cache({
        command: mockCommand({ commandId: 'cmd-2' }),
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-2', title: 'B' },
            streamId: 'nb.Todo-todo-2',
          },
        ],
      })

      await handler.cleanupOnAppliedBatch(['cmd-1', 'cmd-2'])

      expect(handler.getTrackedEntries('cmd-1')).toBeUndefined()
      expect(handler.getTrackedEntries('cmd-2')).toBeUndefined()
    })

    it('does not call clearLocalChanges — server data has already superseded overlays', async () => {
      const { handler, readModelStore } = await bootstrap()
      const clearSpy = vi.spyOn(readModelStore, 'clearLocalChanges')

      await handler.cache({
        command: mockCommand(),
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Buy milk' },
            streamId: 'nb.Todo-todo-1',
          },
        ],
      })

      await handler.cleanupOnAppliedBatch(['cmd-1'])

      expect(clearSpy).not.toHaveBeenCalled()
    })

    it('accepts arbitrary iterables', async () => {
      const { handler } = await bootstrap()
      await handler.cache({
        command: mockCommand(),
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'A' },
            streamId: 'nb.Todo-todo-1',
          },
        ],
      })

      const ids = new Set(['cmd-1'])
      await handler.cleanupOnAppliedBatch(ids)

      expect(handler.getTrackedEntries('cmd-1')).toBeUndefined()
    })

    it('handles unknown command ids as a no-op', async () => {
      const { handler } = await bootstrap()
      await expect(handler.cleanupOnAppliedBatch(['nonexistent'])).resolves.toBeUndefined()
    })
  })

  describe('cleanupOnFailure', () => {
    it('deletes anticipated events from cache', async () => {
      const { eventCache, handler } = await bootstrap()
      await handler.cache({
        command: mockCommand(),
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Buy milk' },
            streamId: 'nb.Todo-todo-1',
          },
        ],
      })

      await handler.cleanupOnFailure('cmd-1')

      const events = await eventCache.getAnticipatedEventsByCommand('cmd-1')
      expect(events).toHaveLength(0)
    })

    it('deletes tracking entries', async () => {
      const { handler } = await bootstrap()
      await handler.cache({
        command: mockCommand(),
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Buy milk' },
            streamId: 'nb.Todo-todo-1',
          },
        ],
      })

      await handler.cleanupOnFailure('cmd-1')

      expect(handler.getTrackedEntries('cmd-1')).toBeUndefined()
    })

    it('clears local changes for tracked entities (reverts optimistic overlay)', async () => {
      const { handler, readModelStore } = await bootstrap()
      const clearSpy = vi.spyOn(readModelStore, 'clearLocalChanges')

      await handler.cache({
        command: mockCommand(),
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Buy milk' },
            streamId: 'nb.Todo-todo-1',
          },
        ],
      })

      await handler.cleanupOnFailure('cmd-1')

      expect(clearSpy).toHaveBeenCalledWith('todos', 'todo-1')
    })
  })

  describe('regenerate', () => {
    it('replaces anticipated events with new ones', async () => {
      const { handler, readModelStore } = await bootstrap()
      const cmd = mockCommand()
      await handler.cache({
        command: cmd,
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Original' },
            streamId: 'nb.Todo-todo-1',
          },
        ],
      })

      await handler.regenerate<TestEvent>(cmd, [
        {
          type: 'TodoCreated',
          data: { id: 'todo-1', title: 'Regenerated' },
          streamId: 'nb.Todo-todo-1',
        },
      ])

      const model = await readModelStore.getById('todos', 'todo-1')
      expect(model?.data).toMatchObject({ title: 'Regenerated' })
    })

    it('clears old tracking and creates new tracking entries', async () => {
      const { handler, readModelStore } = await bootstrap()
      const clearSpy = vi.spyOn(readModelStore, 'clearLocalChanges')
      const cmd = mockCommand()

      await handler.cache({
        command: cmd,
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Original' },
            streamId: 'nb.Todo-todo-1',
          },
        ],
      })

      await handler.regenerate(cmd, [
        { type: 'TodoCreated', data: { id: 'todo-2', title: 'New' }, streamId: 'nb.Todo-todo-2' },
      ])

      expect(clearSpy).toHaveBeenCalledWith('todos', 'todo-1')
      expect(handler.getTrackedEntries('cmd-1')).toEqual(['todos:todo-2'])
    })
  })

  describe('getTrackedEntries', () => {
    it('returns undefined for unknown commands', async () => {
      const { handler } = await bootstrap()
      expect(handler.getTrackedEntries('nonexistent')).toBeUndefined()
    })
  })

  describe('clearAll', () => {
    it('clears all in-memory tracking state', async () => {
      const { handler } = await bootstrap()
      await handler.cache({
        command: mockCommand(),
        events: [
          {
            type: 'TodoCreated',
            data: { id: 'todo-1', title: 'Buy milk' },
            streamId: 'nb.Todo-todo-1',
          },
        ],
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
