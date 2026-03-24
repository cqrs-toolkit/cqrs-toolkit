/**
 * Unit tests for EventProcessorRegistry and EventProcessorRunner.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryStorage } from '../../storage/InMemoryStorage.js'
import type { IAnticipatedEventHandler } from '../command-queue/CommandQueue.js'
import { EventBus } from '../events/EventBus.js'
import { ReadModelStore } from '../read-model-store/ReadModelStore.js'
import { EventProcessorRegistry } from './EventProcessorRegistry.js'
import { EventProcessorRunner, type ParsedEvent } from './EventProcessorRunner.js'
import type { ProcessorContext, ProcessorResult } from './types.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_REVISION = 1n
const DEFAULT_POSITION = 100n

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeParsedEvent(overrides: Partial<ParsedEvent> = {}): ParsedEvent {
  return {
    id: 'event-1',
    type: 'TestEvent',
    streamId: 'stream-1',
    persistence: 'Permanent',
    data: {},
    revision: DEFAULT_REVISION,
    position: DEFAULT_POSITION,
    cacheKey: 'cache-1',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EventProcessorRegistry', () => {
  let registry: EventProcessorRegistry

  beforeEach(() => {
    registry = new EventProcessorRegistry()
  })

  describe('register', () => {
    it('registers a processor for a single event type', () => {
      registry.register({
        eventTypes: 'TodoCreated',
        processor: () => undefined,
      })

      expect(registry.hasProcessors('TodoCreated')).toBe(true)
      expect(registry.hasProcessors('OtherEvent')).toBe(false)
    })

    it('registers a processor for multiple event types', () => {
      registry.register({
        eventTypes: ['TodoCreated', 'TodoUpdated'],
        processor: () => undefined,
      })

      expect(registry.hasProcessors('TodoCreated')).toBe(true)
      expect(registry.hasProcessors('TodoUpdated')).toBe(true)
    })

    it('allows multiple processors for same event type', () => {
      registry.register({
        eventTypes: 'TodoCreated',
        processor: () => undefined,
      })
      registry.register({
        eventTypes: 'TodoCreated',
        processor: () => undefined,
      })

      const processors = registry.getProcessors('TodoCreated', 'Permanent')
      expect(processors).toHaveLength(2)
    })
  })

  describe('getProcessors', () => {
    it('returns processors for matching event type', () => {
      const processor = vi.fn()
      registry.register({
        eventTypes: 'TodoCreated',
        processor,
      })

      const processors = registry.getProcessors('TodoCreated', 'Permanent')
      expect(processors).toContain(processor)
    })

    it('filters by persistence type', () => {
      const permanentProcessor = vi.fn()
      const anticipatedProcessor = vi.fn()

      registry.register({
        eventTypes: 'TodoCreated',
        processor: permanentProcessor,
        persistenceTypes: ['Permanent'],
      })

      registry.register({
        eventTypes: 'TodoCreated',
        processor: anticipatedProcessor,
        persistenceTypes: ['Anticipated'],
      })

      const forPermanent = registry.getProcessors('TodoCreated', 'Permanent')
      expect(forPermanent).toContain(permanentProcessor)
      expect(forPermanent).not.toContain(anticipatedProcessor)

      const forAnticipated = registry.getProcessors('TodoCreated', 'Anticipated')
      expect(forAnticipated).toContain(anticipatedProcessor)
      expect(forAnticipated).not.toContain(permanentProcessor)
    })

    it('returns empty array for unknown event type', () => {
      const processors = registry.getProcessors('UnknownEvent', 'Permanent')
      expect(processors).toHaveLength(0)
    })
  })

  describe('getEventTypes', () => {
    it('returns all registered event types', () => {
      registry.register({ eventTypes: 'EventA', processor: () => undefined })
      registry.register({ eventTypes: ['EventB', 'EventC'], processor: () => undefined })

      const types = registry.getEventTypes()
      expect(types).toContain('EventA')
      expect(types).toContain('EventB')
      expect(types).toContain('EventC')
    })
  })

  describe('clear', () => {
    it('removes all registrations', () => {
      registry.register({ eventTypes: 'TodoCreated', processor: () => undefined })
      registry.clear()

      expect(registry.hasProcessors('TodoCreated')).toBe(false)
    })
  })
})

describe('EventProcessorRunner', () => {
  let storage: InMemoryStorage
  let eventBus: EventBus
  let registry: EventProcessorRegistry
  let readModelStore: ReadModelStore
  let runner: EventProcessorRunner

  beforeEach(async () => {
    storage = new InMemoryStorage()
    await storage.initialize()
    eventBus = new EventBus()
    registry = new EventProcessorRegistry()
    readModelStore = new ReadModelStore({ storage })
    runner = new EventProcessorRunner({ readModelStore, eventBus, registry })
  })

  describe('processEvent', () => {
    it('processes event and creates read model', async () => {
      registry.register({
        eventTypes: 'TodoCreated',
        processor: (event: { id: string; title: string }): ProcessorResult => ({
          collection: 'todos',
          id: event.id,
          update: { type: 'set', data: event },
          isServerUpdate: true,
        }),
      })

      const event = makeParsedEvent({
        type: 'TodoCreated',
        streamId: 'todo-1',
        data: { id: 'todo-1', title: 'Test todo' },
      })

      const result = await runner.processEvent(event)

      expect(result.updatedIds).toContain('todos:todo-1')
      expect(result.invalidated).toBe(false)

      const record = await storage.getReadModel('todos', 'todo-1')
      expect(record).toBeTruthy()
      expect(JSON.parse(record!.effectiveData)).toEqual({ id: 'todo-1', title: 'Test todo' })
    })

    it('returns empty result when no processors match', async () => {
      const event = makeParsedEvent({ type: 'UnknownEvent' })

      const result = await runner.processEvent(event)

      expect(result.updatedIds).toHaveLength(0)
      expect(result.invalidated).toBe(false)
    })

    it('handles processor returning undefined', async () => {
      registry.register({
        eventTypes: 'TodoCreated',
        processor: () => undefined,
      })

      const event = makeParsedEvent({
        type: 'TodoCreated',
        streamId: 'todo-1',
        data: { id: 'todo-1' },
      })

      const result = await runner.processEvent(event)

      expect(result.updatedIds).toHaveLength(0)
      expect(result.invalidated).toBe(false)
    })

    it('handles processor returning multiple results', async () => {
      registry.register({
        eventTypes: 'BatchCreated',
        processor: (event: { items: { id: string; name: string }[] }): ProcessorResult[] =>
          event.items.map((item) => ({
            collection: 'items',
            id: item.id,
            update: { type: 'set', data: item },
            isServerUpdate: true,
          })),
      })

      const event = makeParsedEvent({
        type: 'BatchCreated',
        streamId: 'batch-1',
        data: {
          items: [
            { id: 'item-1', name: 'First' },
            { id: 'item-2', name: 'Second' },
          ],
        },
      })

      const result = await runner.processEvent(event)

      expect(result.updatedIds).toContain('items:item-1')
      expect(result.updatedIds).toContain('items:item-2')
    })

    it('handles merge updates', async () => {
      // Create initial record
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: JSON.stringify({ id: 'todo-1', title: 'Original', done: false }),
        effectiveData: JSON.stringify({ id: 'todo-1', title: 'Original', done: false }),
        hasLocalChanges: false,
        updatedAt: Date.now(),
        _clientMetadata: null,
      })

      registry.register({
        eventTypes: 'TodoUpdated',
        processor: (event: { done: boolean }): ProcessorResult => ({
          collection: 'todos',
          id: 'todo-1',
          update: { type: 'merge', data: { done: event.done } },
          isServerUpdate: true,
        }),
      })

      const event = makeParsedEvent({
        type: 'TodoUpdated',
        streamId: 'todo-1',
        data: { done: true },
      })

      await runner.processEvent(event)

      const record = await storage.getReadModel('todos', 'todo-1')
      const data = JSON.parse(record!.effectiveData)
      expect(data).toEqual({ id: 'todo-1', title: 'Original', done: true })
    })

    it('handles delete updates', async () => {
      // Create initial record
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: JSON.stringify({ id: 'todo-1', title: 'Test' }),
        effectiveData: JSON.stringify({ id: 'todo-1', title: 'Test' }),
        hasLocalChanges: false,
        updatedAt: Date.now(),
        _clientMetadata: null,
      })

      registry.register({
        eventTypes: 'TodoDeleted',
        processor: (event: { id: string }): ProcessorResult => ({
          collection: 'todos',
          id: event.id,
          update: { type: 'delete' },
          isServerUpdate: true,
        }),
      })

      const event = makeParsedEvent({
        type: 'TodoDeleted',
        streamId: 'todo-1',
        data: { id: 'todo-1' },
      })

      await runner.processEvent(event)

      const record = await storage.getReadModel('todos', 'todo-1')
      expect(record).toBeUndefined()
    })

    it('provides context with getCurrentState', async () => {
      // Create initial record
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: JSON.stringify({ id: 'todo-1', count: 5 }),
        effectiveData: JSON.stringify({ id: 'todo-1', count: 5 }),
        hasLocalChanges: false,
        updatedAt: Date.now(),
        _clientMetadata: null,
      })

      let capturedContext: ProcessorContext | undefined

      registry.register({
        eventTypes: 'CountIncremented',
        processor: (_event, context): ProcessorResult => {
          capturedContext = context
          return {
            collection: 'todos',
            id: 'todo-1',
            update: { type: 'merge', data: { count: 6 } },
            isServerUpdate: true,
          }
        },
      })

      const event = makeParsedEvent({
        type: 'CountIncremented',
        streamId: 'todo-1',
        revision: 5n,
        position: 200n,
      })

      await runner.processEvent(event)

      expect(capturedContext).toBeDefined()
      expect(capturedContext!.persistence).toBe('Permanent')
      expect(typeof capturedContext!.getCurrentState).toBe('function')

      const record = await storage.getReadModel('todos', 'todo-1')
      const data = JSON.parse(record!.effectiveData)
      expect(data.count).toBe(6)
    })

    it('context includes streamId, eventId, position, and revision', async () => {
      let capturedContext: ProcessorContext | undefined

      registry.register({
        eventTypes: 'TestEvent',
        processor: (_event, context) => {
          capturedContext = context
          return undefined
        },
      })

      const event = makeParsedEvent({
        id: 'evt-42',
        streamId: 'stream-abc',
        revision: 7n,
        position: 500n,
      })

      await runner.processEvent(event)

      expect(capturedContext).toBeDefined()
      expect(capturedContext!.streamId).toBe('stream-abc')
      expect(capturedContext!.eventId).toBe('evt-42')
      expect(capturedContext!.position).toBe(500n)
      expect(capturedContext!.revision).toBe(7n)
    })

    it('supports async processor using getCurrentState', async () => {
      // Seed existing state
      await storage.saveReadModel({
        id: 'counter-1',
        collection: 'counters',
        cacheKey: 'cache-1',
        serverData: JSON.stringify({ id: 'counter-1', value: 10 }),
        effectiveData: JSON.stringify({ id: 'counter-1', value: 10 }),
        hasLocalChanges: false,
        updatedAt: Date.now(),
        _clientMetadata: null,
      })

      registry.register({
        eventTypes: 'Incremented',
        async processor(_event, context) {
          const current = await context.getCurrentState<{ id: string; value: number }>(
            'counters',
            'counter-1',
          )
          const newValue = (current?.value ?? 0) + 1
          return {
            collection: 'counters',
            id: 'counter-1',
            update: { type: 'set', data: { id: 'counter-1', value: newValue } },
            isServerUpdate: true,
          }
        },
      })

      const event = makeParsedEvent({ type: 'Incremented', streamId: 'counter-1' })

      const result = await runner.processEvent(event)

      expect(result.updatedIds).toContain('counters:counter-1')
      const record = await storage.getReadModel('counters', 'counter-1')
      expect(JSON.parse(record!.effectiveData)).toEqual({ id: 'counter-1', value: 11 })
    })

    it('processor returning { invalidate: true } sets invalidated flag', async () => {
      registry.register({
        eventTypes: 'ComplexEvent',
        processor: () => ({ invalidate: true as const }),
      })

      const event = makeParsedEvent({ type: 'ComplexEvent' })

      const result = await runner.processEvent(event)

      expect(result.invalidated).toBe(true)
      expect(result.updatedIds).toHaveLength(0)
    })

    it('async processor returning { invalidate: true } sets invalidated flag', async () => {
      registry.register({
        eventTypes: 'ComplexEvent',
        async processor(_event, context) {
          const state = await context.getCurrentState('items', 'item-1')
          if (!state) {
            return { invalidate: true as const }
          }
          return undefined
        },
      })

      const event = makeParsedEvent({ type: 'ComplexEvent' })

      const result = await runner.processEvent(event)

      expect(result.invalidated).toBe(true)
      expect(result.updatedIds).toHaveLength(0)
    })

    it('emits readmodel:updated event', async () => {
      registry.register({
        eventTypes: 'TodoCreated',
        processor: (event: { id: string }): ProcessorResult => ({
          collection: 'todos',
          id: event.id,
          update: { type: 'set', data: event },
          isServerUpdate: true,
        }),
      })

      const events: unknown[] = []
      eventBus.on('readmodel:updated').subscribe((e) => events.push(e))

      const event = makeParsedEvent({
        type: 'TodoCreated',
        streamId: 'todo-1',
        data: { id: 'todo-1' },
      })

      await runner.processEvent(event)

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        data: { collection: 'todos', ids: ['todo-1'] },
      })
    })

    it('marks anticipated events as local changes', async () => {
      registry.register({
        eventTypes: 'TodoCreated',
        processor: (event: { id: string; title: string }): ProcessorResult => ({
          collection: 'todos',
          id: event.id,
          update: { type: 'set', data: event },
          isServerUpdate: false, // Anticipated
        }),
      })

      const event = makeParsedEvent({
        type: 'TodoCreated',
        streamId: 'todo-1',
        persistence: 'Anticipated',
        data: { id: 'todo-1', title: 'Test' },
        commandId: 'cmd-1',
      })

      await runner.processEvent(event)

      const record = await storage.getReadModel('todos', 'todo-1')
      expect(record?.hasLocalChanges).toBe(true)
      expect(record?.serverData).toBeNull()
    })

    it('set + server update preserves existing local overlay', async () => {
      // Simulate: anticipated event created an optimistic record
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: JSON.stringify({ id: 'todo-1', title: 'Original', done: false }),
        effectiveData: JSON.stringify({ id: 'todo-1', title: 'Optimistic Title', done: false }),
        hasLocalChanges: true,
        updatedAt: Date.now(),
        _clientMetadata: null,
      })

      registry.register({
        eventTypes: 'TodoUpdated',
        processor: (event: { id: string; title: string; done: boolean }): ProcessorResult => ({
          collection: 'todos',
          id: event.id,
          update: { type: 'set', data: event },
          isServerUpdate: true,
        }),
      })

      // Server confirms with different title — but local overlay changed title
      const event = makeParsedEvent({
        type: 'TodoUpdated',
        streamId: 'todo-1',
        data: { id: 'todo-1', title: 'Server Title', done: true },
      })

      await runner.processEvent(event)

      const record = await storage.getReadModel('todos', 'todo-1')
      const effectiveData = JSON.parse(record!.effectiveData)
      // Local overlay (title: 'Optimistic Title') should be preserved via three-way merge
      expect(effectiveData.title).toBe('Optimistic Title')
      // Server value for non-locally-changed field should be adopted
      expect(effectiveData.done).toBe(true)
      expect(record?.hasLocalChanges).toBe(true)
    })

    it('merge + server update preserves local overlay', async () => {
      // Anticipated event created an optimistic overlay on title
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: JSON.stringify({ id: 'todo-1', title: 'Original', done: false, count: 0 }),
        effectiveData: JSON.stringify({
          id: 'todo-1',
          title: 'Optimistic Title',
          done: false,
          count: 0,
        }),
        hasLocalChanges: true,
        updatedAt: Date.now(),
        _clientMetadata: null,
      })

      registry.register({
        eventTypes: 'CountIncremented',
        processor: (): ProcessorResult => ({
          collection: 'todos',
          id: 'todo-1',
          update: { type: 'merge', data: { count: 1 } },
          isServerUpdate: true,
        }),
      })

      const event = makeParsedEvent({
        type: 'CountIncremented',
        streamId: 'todo-1',
      })

      await runner.processEvent(event)

      const record = await storage.getReadModel('todos', 'todo-1')
      const effectiveData = JSON.parse(record!.effectiveData)
      // Local overlay (title) should be preserved
      expect(effectiveData.title).toBe('Optimistic Title')
      // Server merge (count) should be applied
      expect(effectiveData.count).toBe(1)
      expect(record?.hasLocalChanges).toBe(true)
    })

    it('does not emit readmodel:updated when data is unchanged', async () => {
      // Create a record with known data
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: JSON.stringify({ id: 'todo-1', title: 'Test' }),
        effectiveData: JSON.stringify({ id: 'todo-1', title: 'Test' }),
        hasLocalChanges: false,
        updatedAt: Date.now(),
        _clientMetadata: null,
      })

      // Processor returns the same data
      registry.register({
        eventTypes: 'TodoUpdated',
        processor: (): ProcessorResult => ({
          collection: 'todos',
          id: 'todo-1',
          update: { type: 'set', data: { id: 'todo-1', title: 'Test' } },
          isServerUpdate: true,
        }),
      })

      const events: unknown[] = []
      eventBus.on('readmodel:updated').subscribe((e) => events.push(e))

      const event = makeParsedEvent({
        type: 'TodoUpdated',
        streamId: 'todo-1',
      })

      await runner.processEvent(event)

      expect(events).toHaveLength(0)
    })
  })

  describe('processEvents', () => {
    it('processes multiple events in order', async () => {
      const processedOrder: string[] = []

      registry.register({
        eventTypes: ['EventA', 'EventB'],
        processor: (event: { name: string }): ProcessorResult => {
          processedOrder.push(event.name)
          return {
            collection: 'items',
            id: event.name,
            update: { type: 'set', data: event },
            isServerUpdate: true,
          }
        },
      })

      const events: ParsedEvent[] = [
        makeParsedEvent({
          type: 'EventA',
          data: { name: 'first' },
        }),
        makeParsedEvent({
          id: 'event-2',
          type: 'EventB',
          data: { name: 'second' },
        }),
      ]

      await runner.processEvents(events)

      expect(processedOrder).toEqual(['first', 'second'])
    })

    it('aggregates invalidated across batch (OR semantics)', async () => {
      registry.register({
        eventTypes: 'NormalEvent',
        processor: (event: { id: string }): ProcessorResult => ({
          collection: 'items',
          id: event.id,
          update: { type: 'set', data: event },
          isServerUpdate: true,
        }),
      })

      registry.register({
        eventTypes: 'InvalidatingEvent',
        processor: () => ({ invalidate: true as const }),
      })

      const events: ParsedEvent[] = [
        makeParsedEvent({
          type: 'NormalEvent',
          data: { id: 'item-1' },
        }),
        makeParsedEvent({
          id: 'event-2',
          type: 'InvalidatingEvent',
        }),
        makeParsedEvent({
          id: 'event-3',
          type: 'NormalEvent',
          data: { id: 'item-2' },
        }),
      ]

      const result = await runner.processEvents(events)

      expect(result.invalidated).toBe(true)
      expect(result.updatedIds).toContain('items:item-1')
      expect(result.updatedIds).toContain('items:item-2')
    })
  })

  describe('reconcileAnticipatedCreate', () => {
    const CLIENT_ID = 'client-abc-123'
    const SERVER_ID = 'server-xyz-789'

    function createAnticipatedEventHandler(): IAnticipatedEventHandler & {
      getTrackedEntries: ReturnType<typeof vi.fn>
      getAnticipatedEventsForStream: ReturnType<typeof vi.fn>
    } {
      return {
        cache: vi.fn().mockResolvedValue(undefined),
        cleanup: vi.fn().mockResolvedValue(undefined),
        regenerate: vi.fn().mockResolvedValue(undefined),
        getTrackedEntries: vi.fn().mockReturnValue(undefined),
        getAnticipatedEventsForStream: vi.fn().mockResolvedValue([]),
        clearAll: vi.fn().mockResolvedValue(undefined),
      }
    }

    function registerCreateProcessor(): void {
      registry.register({
        eventTypes: 'TodoCreated',
        processor: (event: { id: string; title: string }): ProcessorResult => ({
          collection: 'todos',
          id: event.id,
          update: { type: 'set', data: event },
          isServerUpdate: true,
        }),
      })
    }

    function registerUpdateProcessor(): void {
      registry.register({
        eventTypes: 'TodoTitleUpdated',
        processor: (event: { id: string; title: string }): ProcessorResult => ({
          collection: 'todos',
          id: event.id,
          update: { type: 'merge', data: { title: event.title } },
          isServerUpdate: false,
        }),
      })
    }

    it('skips reconciliation for anticipated events', async () => {
      const handler = createAnticipatedEventHandler()
      runner.setAnticipatedEventHandler(handler)
      registerCreateProcessor()

      const event = makeParsedEvent({
        type: 'TodoCreated',
        persistence: 'Anticipated',
        commandId: 'cmd-1',
        data: { id: CLIENT_ID, title: 'Test' },
      })

      await runner.processEvent(event)

      expect(handler.getTrackedEntries).not.toHaveBeenCalled()
    })

    it('skips reconciliation when no commandId', async () => {
      const handler = createAnticipatedEventHandler()
      runner.setAnticipatedEventHandler(handler)
      registerCreateProcessor()

      const event = makeParsedEvent({
        type: 'TodoCreated',
        data: { id: SERVER_ID, title: 'Test' },
        // no commandId
      })

      await runner.processEvent(event)

      expect(handler.getTrackedEntries).not.toHaveBeenCalled()
    })

    it('skips reconciliation when no tracked entries', async () => {
      const handler = createAnticipatedEventHandler()
      handler.getTrackedEntries.mockReturnValue(undefined)
      runner.setAnticipatedEventHandler(handler)
      registerCreateProcessor()

      const event = makeParsedEvent({
        type: 'TodoCreated',
        commandId: 'cmd-1',
        data: { id: SERVER_ID, title: 'Test' },
      })

      await runner.processEvent(event)

      expect(handler.getTrackedEntries).toHaveBeenCalledWith('cmd-1')
      expect(handler.getAnticipatedEventsForStream).not.toHaveBeenCalled()
    })

    it('skips reconciliation when tracked ID matches server ID', async () => {
      const handler = createAnticipatedEventHandler()
      handler.getTrackedEntries.mockReturnValue([`todos:${SERVER_ID}`])
      runner.setAnticipatedEventHandler(handler)
      registerCreateProcessor()

      const event = makeParsedEvent({
        type: 'TodoCreated',
        commandId: 'cmd-1',
        streamId: `Todo-${SERVER_ID}`,
        data: { id: SERVER_ID, title: 'Test' },
      })

      await runner.processEvent(event)

      // trackedId === result.id, so no reconciliation
      expect(handler.getAnticipatedEventsForStream).not.toHaveBeenCalled()
    })

    it('deletes old entry and creates server entry when IDs differ', async () => {
      const handler = createAnticipatedEventHandler()
      handler.getTrackedEntries.mockReturnValue([`todos:${CLIENT_ID}`])
      handler.getAnticipatedEventsForStream.mockResolvedValue([])
      runner.setAnticipatedEventHandler(handler)
      registerCreateProcessor()

      // Seed old entry under client ID
      await storage.saveReadModel({
        id: CLIENT_ID,
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: null,
        effectiveData: JSON.stringify({ id: CLIENT_ID, title: 'Optimistic' }),
        hasLocalChanges: true,
        updatedAt: Date.now(),
        _clientMetadata: null,
      })

      const event = makeParsedEvent({
        type: 'TodoCreated',
        commandId: 'cmd-1',
        streamId: `Todo-${SERVER_ID}`,
        data: { id: SERVER_ID, title: 'Confirmed' },
      })

      const result = await runner.processEvent(event)

      // Old entry deleted
      const oldRecord = await storage.getReadModel('todos', CLIENT_ID)
      expect(oldRecord).toBeUndefined()

      // New entry created under server ID
      const newRecord = await storage.getReadModel('todos', SERVER_ID)
      expect(newRecord).toBeDefined()
      expect(JSON.parse(newRecord!.effectiveData)).toEqual({ id: SERVER_ID, title: 'Confirmed' })

      // Both IDs in updatedIds
      expect(result.updatedIds).toContain(`todos:${CLIENT_ID}`)
      expect(result.updatedIds).toContain(`todos:${SERVER_ID}`)
    })

    it('re-applies overlay events with patched entity ID', async () => {
      const handler = createAnticipatedEventHandler()
      handler.getTrackedEntries.mockReturnValue([`todos:${CLIENT_ID}`])

      // Overlay: a title update from a dependent command, still referencing client ID
      const overlayEvent: ParsedEvent = {
        id: 'overlay-evt-1',
        type: 'TodoTitleUpdated',
        streamId: `Todo-${CLIENT_ID}`,
        persistence: 'Anticipated',
        data: { id: CLIENT_ID, title: 'Updated Title' },
        commandId: 'cmd-2',
        cacheKey: 'cache-1',
      }
      handler.getAnticipatedEventsForStream.mockResolvedValue([overlayEvent])
      runner.setAnticipatedEventHandler(handler)

      registerCreateProcessor()
      registerUpdateProcessor()

      const event = makeParsedEvent({
        type: 'TodoCreated',
        commandId: 'cmd-1',
        streamId: `Todo-${SERVER_ID}`,
        data: { id: SERVER_ID, title: 'Confirmed' },
      })

      await runner.processEvent(event)

      // getAnticipatedEventsForStream called with old stream ID, excluding the create command
      expect(handler.getAnticipatedEventsForStream).toHaveBeenCalledWith(
        `Todo-${CLIENT_ID}`,
        'cmd-1',
      )

      // Server entry has title from overlay (merged on top of the create)
      const record = await storage.getReadModel('todos', SERVER_ID)
      expect(record).toBeDefined()
      const data = JSON.parse(record!.effectiveData)
      expect(data.title).toBe('Updated Title')
      expect(data.id).toBe(SERVER_ID)
    })

    it('emits single readmodel:updated with both deleted and created IDs', async () => {
      const handler = createAnticipatedEventHandler()
      handler.getTrackedEntries.mockReturnValue([`todos:${CLIENT_ID}`])
      handler.getAnticipatedEventsForStream.mockResolvedValue([])
      runner.setAnticipatedEventHandler(handler)
      registerCreateProcessor()

      // Seed old entry
      await storage.saveReadModel({
        id: CLIENT_ID,
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: null,
        effectiveData: JSON.stringify({ id: CLIENT_ID, title: 'Optimistic' }),
        hasLocalChanges: true,
        updatedAt: Date.now(),
        _clientMetadata: null,
      })

      const emissions: unknown[] = []
      eventBus.on('readmodel:updated').subscribe((e) => emissions.push(e))

      const event = makeParsedEvent({
        type: 'TodoCreated',
        commandId: 'cmd-1',
        streamId: `Todo-${SERVER_ID}`,
        data: { id: SERVER_ID, title: 'Confirmed' },
      })

      await runner.processEvent(event)

      // Single emission containing both IDs
      expect(emissions).toHaveLength(1)
      const data = (emissions[0] as { data: { collection: string; ids: string[] } }).data
      expect(data.collection).toBe('todos')
      expect(data.ids).toContain(CLIENT_ID)
      expect(data.ids).toContain(SERVER_ID)
    })
  })
})
