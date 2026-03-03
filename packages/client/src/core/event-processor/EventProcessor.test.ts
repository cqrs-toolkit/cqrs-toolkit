/**
 * Unit tests for EventProcessorRegistry and EventProcessorRunner.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryStorage } from '../../storage/InMemoryStorage.js'
import { EventBus } from '../events/EventBus.js'
import { EventProcessorRegistry } from './EventProcessorRegistry.js'
import { EventProcessorRunner, type ParsedEvent } from './EventProcessorRunner.js'
import type { ProcessorContext, ProcessorResult } from './types.js'

describe('EventProcessorRegistry', () => {
  let registry: EventProcessorRegistry

  beforeEach(() => {
    registry = new EventProcessorRegistry()
  })

  describe('register', () => {
    it('registers a processor for a single event type', () => {
      registry.register({
        eventTypes: 'TodoCreated',
        processor: () => null,
      })

      expect(registry.hasProcessors('TodoCreated')).toBe(true)
      expect(registry.hasProcessors('OtherEvent')).toBe(false)
    })

    it('registers a processor for multiple event types', () => {
      registry.register({
        eventTypes: ['TodoCreated', 'TodoUpdated'],
        processor: () => null,
      })

      expect(registry.hasProcessors('TodoCreated')).toBe(true)
      expect(registry.hasProcessors('TodoUpdated')).toBe(true)
    })

    it('allows multiple processors for same event type', () => {
      registry.register({
        eventTypes: 'TodoCreated',
        processor: () => null,
      })
      registry.register({
        eventTypes: 'TodoCreated',
        processor: () => null,
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
      registry.register({ eventTypes: 'EventA', processor: () => null })
      registry.register({ eventTypes: ['EventB', 'EventC'], processor: () => null })

      const types = registry.getEventTypes()
      expect(types).toContain('EventA')
      expect(types).toContain('EventB')
      expect(types).toContain('EventC')
    })
  })

  describe('clear', () => {
    it('removes all registrations', () => {
      registry.register({ eventTypes: 'TodoCreated', processor: () => null })
      registry.clear()

      expect(registry.hasProcessors('TodoCreated')).toBe(false)
    })
  })
})

describe('EventProcessorRunner', () => {
  let storage: InMemoryStorage
  let eventBus: EventBus
  let registry: EventProcessorRegistry
  let runner: EventProcessorRunner

  beforeEach(async () => {
    storage = new InMemoryStorage()
    await storage.initialize()
    eventBus = new EventBus()
    registry = new EventProcessorRegistry()
    runner = new EventProcessorRunner({ storage, eventBus, registry })
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

      const event: ParsedEvent = {
        id: 'event-1',
        type: 'TodoCreated',
        streamId: 'todo-1',
        persistence: 'Permanent',
        data: { id: 'todo-1', title: 'Test todo' },
        cacheKey: 'cache-1',
      }

      const updated = await runner.processEvent(event)

      expect(updated).toContain('todos:todo-1')

      const record = await storage.getReadModel('todos', 'todo-1')
      expect(record).toBeTruthy()
      expect(JSON.parse(record!.effectiveData)).toEqual({ id: 'todo-1', title: 'Test todo' })
    })

    it('returns empty array when no processors match', async () => {
      const event: ParsedEvent = {
        id: 'event-1',
        type: 'UnknownEvent',
        streamId: 'stream-1',
        persistence: 'Permanent',
        data: {},
        cacheKey: 'cache-1',
      }

      const updated = await runner.processEvent(event)

      expect(updated).toHaveLength(0)
    })

    it('handles processor returning null', async () => {
      registry.register({
        eventTypes: 'TodoCreated',
        processor: () => null,
      })

      const event: ParsedEvent = {
        id: 'event-1',
        type: 'TodoCreated',
        streamId: 'todo-1',
        persistence: 'Permanent',
        data: { id: 'todo-1' },
        cacheKey: 'cache-1',
      }

      const updated = await runner.processEvent(event)

      expect(updated).toHaveLength(0)
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

      const event: ParsedEvent = {
        id: 'event-1',
        type: 'BatchCreated',
        streamId: 'batch-1',
        persistence: 'Permanent',
        data: {
          items: [
            { id: 'item-1', name: 'First' },
            { id: 'item-2', name: 'Second' },
          ],
        },
        cacheKey: 'cache-1',
      }

      const updated = await runner.processEvent(event)

      expect(updated).toContain('items:item-1')
      expect(updated).toContain('items:item-2')
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

      const event: ParsedEvent = {
        id: 'event-2',
        type: 'TodoUpdated',
        streamId: 'todo-1',
        persistence: 'Permanent',
        data: { done: true },
        cacheKey: 'cache-1',
      }

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

      const event: ParsedEvent = {
        id: 'event-3',
        type: 'TodoDeleted',
        streamId: 'todo-1',
        persistence: 'Permanent',
        data: { id: 'todo-1' },
        cacheKey: 'cache-1',
      }

      await runner.processEvent(event)

      const record = await storage.getReadModel('todos', 'todo-1')
      expect(record).toBeNull()
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
      })

      let capturedContext: ProcessorContext | null = null
      let currentState: { id: string; count: number } | null = null

      registry.register({
        eventTypes: 'CountIncremented',
        processor: (_event, context): ProcessorResult | null => {
          capturedContext = context
          // Note: getCurrentState is async but we need to handle it synchronously here
          // In real usage, processors would be called with pre-loaded state
          // For this test, we just verify the context is provided
          return {
            collection: 'todos',
            id: 'todo-1',
            update: { type: 'merge', data: { count: 6 } },
            isServerUpdate: true,
          }
        },
      })

      const event: ParsedEvent = {
        id: 'event-1',
        type: 'CountIncremented',
        streamId: 'todo-1',
        persistence: 'Permanent',
        data: {},
        cacheKey: 'cache-1',
      }

      await runner.processEvent(event)

      expect(capturedContext).not.toBeNull()
      expect(capturedContext!.persistence).toBe('Permanent')
      expect(typeof capturedContext!.getCurrentState).toBe('function')

      const record = await storage.getReadModel('todos', 'todo-1')
      const data = JSON.parse(record!.effectiveData)
      expect(data.count).toBe(6)
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

      const event: ParsedEvent = {
        id: 'event-1',
        type: 'TodoCreated',
        streamId: 'todo-1',
        persistence: 'Permanent',
        data: { id: 'todo-1' },
        cacheKey: 'cache-1',
      }

      await runner.processEvent(event)

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        payload: { collection: 'todos', ids: ['todo-1'] },
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

      const event: ParsedEvent = {
        id: 'event-1',
        type: 'TodoCreated',
        streamId: 'todo-1',
        persistence: 'Anticipated',
        data: { id: 'todo-1', title: 'Test' },
        commandId: 'cmd-1',
        cacheKey: 'cache-1',
      }

      await runner.processEvent(event)

      const record = await storage.getReadModel('todos', 'todo-1')
      expect(record?.hasLocalChanges).toBe(true)
      expect(record?.serverData).toBeNull()
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
        {
          id: 'event-1',
          type: 'EventA',
          streamId: 'stream-1',
          persistence: 'Permanent',
          data: { name: 'first' },
          cacheKey: 'cache-1',
        },
        {
          id: 'event-2',
          type: 'EventB',
          streamId: 'stream-1',
          persistence: 'Permanent',
          data: { name: 'second' },
          cacheKey: 'cache-1',
        },
      ]

      await runner.processEvents(events)

      expect(processedOrder).toEqual(['first', 'second'])
    })
  })
})
