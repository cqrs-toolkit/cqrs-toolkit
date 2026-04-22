/**
 * Unit tests for EventProcessorRegistry and EventProcessorRunner.
 */

import { describe, expect, it, vi } from 'vitest'
import { EventProcessorRegistry } from './EventProcessorRegistry.js'

describe('EventProcessorRegistry', () => {
  describe('register', () => {
    it('registers a processor for a single event type', () => {
      const registry = new EventProcessorRegistry()
      registry.register({
        eventTypes: 'TodoCreated',
        processor: () => undefined,
      })

      expect(registry.hasProcessors('TodoCreated')).toBe(true)
      expect(registry.hasProcessors('OtherEvent')).toBe(false)
    })

    it('registers a processor for multiple event types', () => {
      const registry = new EventProcessorRegistry()
      registry.register({
        eventTypes: ['TodoCreated', 'TodoUpdated'],
        processor: () => undefined,
      })

      expect(registry.hasProcessors('TodoCreated')).toBe(true)
      expect(registry.hasProcessors('TodoUpdated')).toBe(true)
    })

    it('allows multiple processors for same event type', () => {
      const registry = new EventProcessorRegistry()
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
      const registry = new EventProcessorRegistry()
      const processor = vi.fn()
      registry.register({
        eventTypes: 'TodoCreated',
        processor,
      })

      const processors = registry.getProcessors('TodoCreated', 'Permanent')
      expect(processors).toContain(processor)
    })

    it('filters by persistence type', () => {
      const registry = new EventProcessorRegistry()
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
      const registry = new EventProcessorRegistry()
      const processors = registry.getProcessors('UnknownEvent', 'Permanent')
      expect(processors).toHaveLength(0)
    })
  })

  describe('getEventTypes', () => {
    it('returns all registered event types', () => {
      const registry = new EventProcessorRegistry()
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
      const registry = new EventProcessorRegistry()
      registry.register({ eventTypes: 'TodoCreated', processor: () => undefined })
      registry.clear()

      expect(registry.hasProcessors('TodoCreated')).toBe(false)
    })
  })
})
