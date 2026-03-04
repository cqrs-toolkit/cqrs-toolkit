/**
 * Event processor runner.
 * Executes event processors and applies results to read model store.
 */

import { logProvider } from '@meticoeus/ddd-es'
import type { EventPersistence } from '../../types/events.js'
import type { EventBus } from '../events/EventBus.js'
import type { ReadModelStore } from '../read-model-store/ReadModelStore.js'
import { EventProcessorRegistry } from './EventProcessorRegistry.js'
import type {
  EventProcessor,
  InvalidateSignal,
  ProcessorContext,
  ProcessorResult,
} from './types.js'

/**
 * Event processor runner configuration.
 */
export interface EventProcessorRunnerConfig {
  readModelStore: ReadModelStore
  eventBus: EventBus
  registry: EventProcessorRegistry
}

/**
 * Parsed event for processing.
 */
export interface ParsedEvent {
  id: string
  type: string
  streamId: string
  persistence: EventPersistence
  data: unknown
  commandId?: string
  revision: bigint
  position: bigint
  cacheKey: string
}

/**
 * Result of processing one or more events.
 */
export interface ProcessEventResult {
  updatedIds: string[]
  invalidated: boolean
}

/**
 * Event processor runner.
 */
export class EventProcessorRunner {
  private readonly readModelStore: ReadModelStore
  private readonly eventBus: EventBus
  private readonly registry: EventProcessorRegistry

  constructor(config: EventProcessorRunnerConfig) {
    this.readModelStore = config.readModelStore
    this.eventBus = config.eventBus
    this.registry = config.registry
  }

  /**
   * Process an event and apply updates to the read model store.
   *
   * @param event - Parsed event to process
   * @returns IDs of updated read models and whether any processor signalled invalidation
   */
  async processEvent(event: ParsedEvent): Promise<ProcessEventResult> {
    const processors = this.registry.getProcessors(event.type, event.persistence)
    if (processors.length === 0) {
      return { updatedIds: [], invalidated: false }
    }

    const context = this.createContext(event)
    const allResults: ProcessorResult[] = []
    let invalidated = false

    for (const processor of processors) {
      const result = await this.runProcessor(processor, event, context)
      if (result.invalidated) {
        invalidated = true
      }
      allResults.push(...result.results)
    }

    // Apply all results, tracking which actually modified data
    const modifiedByCollection = new Map<string, string[]>()
    const updatedIds: string[] = []

    for (const result of allResults) {
      const modified = await this.applyResult(result, event.cacheKey)
      updatedIds.push(`${result.collection}:${result.id}`)

      if (modified) {
        let ids = modifiedByCollection.get(result.collection)
        if (!ids) {
          ids = []
          modifiedByCollection.set(result.collection, ids)
        }
        ids.push(result.id)
      }
    }

    // Emit update event only for collections with actual changes
    for (const [collection, ids] of modifiedByCollection) {
      this.eventBus.emit('readmodel:updated', { collection, ids })
    }

    return { updatedIds, invalidated }
  }

  /**
   * Process multiple events in order.
   *
   * @param events - Events to process
   * @returns Aggregated result across all events
   */
  async processEvents(events: ParsedEvent[]): Promise<ProcessEventResult> {
    const allUpdated: string[] = []
    let anyInvalidated = false

    for (const event of events) {
      const result = await this.processEvent(event)
      allUpdated.push(...result.updatedIds)
      if (result.invalidated) {
        anyInvalidated = true
      }
    }

    return { updatedIds: allUpdated, invalidated: anyInvalidated }
  }

  /**
   * Run a processor and normalize results.
   */
  private async runProcessor(
    processor: EventProcessor,
    event: ParsedEvent,
    context: ProcessorContext,
  ): Promise<{ results: ProcessorResult[]; invalidated: boolean }> {
    try {
      const result = await processor(event.data, context)

      if (result === undefined) {
        return { results: [], invalidated: false }
      }

      if (isInvalidateSignal(result)) {
        return { results: [], invalidated: true }
      }

      if (Array.isArray(result)) {
        return { results: result, invalidated: false }
      }

      return { results: [result], invalidated: false }
    } catch (error) {
      // Log error but don't fail processing
      logProvider.log.error({ err: error, eventType: event.type }, 'Event processor error')
      return { results: [], invalidated: false }
    }
  }

  /**
   * Create processor context for an event.
   */
  private createContext(event: ParsedEvent): ProcessorContext {
    return {
      persistence: event.persistence,
      commandId: event.commandId,
      revision: event.revision,
      position: event.position,
      streamId: event.streamId,
      eventId: event.id,
      getCurrentState: async <T>(collection: string, id: string): Promise<T | undefined> => {
        const model = await this.readModelStore.getById<T>(collection, id)
        if (!model) return undefined
        return model.data
      },
    }
  }

  /**
   * Apply a processor result to the read model store.
   * Returns true if the data was actually modified.
   */
  private async applyResult(result: ProcessorResult, cacheKey: string): Promise<boolean> {
    const { collection, id, update, isServerUpdate } = result

    if (update.type === 'delete') {
      return this.readModelStore.delete(collection, id)
    }

    if (update.type === 'set') {
      if (isServerUpdate) {
        return this.readModelStore.setServerData(collection, id, update.data, cacheKey)
      }
      return this.readModelStore.setLocalData(collection, id, update.data, cacheKey)
    }

    if (update.type === 'merge') {
      if (isServerUpdate) {
        return this.readModelStore.mergeServerData(collection, id, update.data, cacheKey)
      }
      return this.readModelStore.applyLocalChanges(collection, id, update.data, cacheKey)
    }

    return false
  }
}

/**
 * Type guard for InvalidateSignal.
 */
function isInvalidateSignal(value: unknown): value is InvalidateSignal {
  return (
    typeof value === 'object' &&
    value !== null &&
    'invalidate' in value &&
    value.invalidate === true
  )
}
