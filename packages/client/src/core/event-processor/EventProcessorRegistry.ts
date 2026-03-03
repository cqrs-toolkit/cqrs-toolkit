/**
 * Event processor registry.
 * Manages registration and lookup of event processors.
 */

import type { EventPersistence } from '../../types/events.js'
import type { EventProcessor, ProcessorRegistration } from './types.js'

/**
 * Internal registration with normalized event types.
 */
interface NormalizedRegistration {
  eventTypes: Set<string>
  processor: EventProcessor
  persistenceTypes?: Set<EventPersistence>
}

/**
 * Event processor registry.
 */
export class EventProcessorRegistry {
  private readonly registrations: NormalizedRegistration[] = []
  private readonly eventTypeIndex: Map<string, NormalizedRegistration[]> = new Map()

  /**
   * Register an event processor.
   *
   * @param registration - Processor registration
   */
  register<TEvent = unknown, TModel = unknown>(
    registration: ProcessorRegistration<TEvent, TModel>,
  ): void {
    const eventTypes = Array.isArray(registration.eventTypes)
      ? new Set(registration.eventTypes)
      : new Set([registration.eventTypes])

    const normalized: NormalizedRegistration = {
      eventTypes,
      processor: registration.processor as EventProcessor,
      persistenceTypes: registration.persistenceTypes
        ? new Set(registration.persistenceTypes)
        : undefined,
    }

    this.registrations.push(normalized)

    // Index by event type for fast lookup
    for (const eventType of eventTypes) {
      let processors = this.eventTypeIndex.get(eventType)
      if (!processors) {
        processors = []
        this.eventTypeIndex.set(eventType, processors)
      }
      processors.push(normalized)
    }
  }

  /**
   * Get processors for an event type and persistence.
   *
   * @param eventType - Event type
   * @param persistence - Event persistence type
   * @returns Matching processors
   */
  getProcessors(eventType: string, persistence: EventPersistence): EventProcessor[] {
    const registrations = this.eventTypeIndex.get(eventType) ?? []

    return registrations
      .filter((reg) => {
        // If persistence types are specified, check if the event matches
        if (reg.persistenceTypes && !reg.persistenceTypes.has(persistence)) {
          return false
        }
        return true
      })
      .map((reg) => reg.processor)
  }

  /**
   * Check if there are any processors for an event type.
   *
   * @param eventType - Event type
   * @returns Whether there are processors
   */
  hasProcessors(eventType: string): boolean {
    const processors = this.eventTypeIndex.get(eventType)
    return processors !== undefined && processors.length > 0
  }

  /**
   * Get all registered event types.
   *
   * @returns Set of event types
   */
  getEventTypes(): Set<string> {
    return new Set(this.eventTypeIndex.keys())
  }

  /**
   * Clear all registrations.
   */
  clear(): void {
    this.registrations.length = 0
    this.eventTypeIndex.clear()
  }
}
