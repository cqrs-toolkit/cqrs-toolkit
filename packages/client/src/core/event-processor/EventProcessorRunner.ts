/**
 * Event processor runner.
 * Executes event processors and applies results to read model store.
 */

import { logProvider } from '@meticoeus/ddd-es'
import type { EventPersistence } from '../../types/events.js'
import type { EventBus } from '../events/EventBus.js'
import type { ReadModelStore } from '../read-model-store/ReadModelStore.js'
import { EventProcessorRegistry } from './EventProcessorRegistry.js'
import type { EventProcessor, ProcessorContext, ProcessorResult } from './types.js'

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
  revision?: string
  cacheKey: string
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
   * @returns IDs of updated read models
   */
  async processEvent(event: ParsedEvent): Promise<string[]> {
    const processors = this.registry.getProcessors(event.type, event.persistence)
    if (processors.length === 0) {
      return []
    }

    const context = this.createContext(event)
    const allResults: ProcessorResult[] = []

    for (const processor of processors) {
      const result = await this.runProcessor(processor, event, context)
      allResults.push(...result)
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

    return updatedIds
  }

  /**
   * Process multiple events in order.
   *
   * @param events - Events to process
   * @returns Total IDs updated
   */
  async processEvents(events: ParsedEvent[]): Promise<string[]> {
    const allUpdated: string[] = []

    for (const event of events) {
      const updated = await this.processEvent(event)
      allUpdated.push(...updated)
    }

    return allUpdated
  }

  /**
   * Run a processor and normalize results.
   */
  private async runProcessor(
    processor: EventProcessor,
    event: ParsedEvent,
    context: ProcessorContext,
  ): Promise<ProcessorResult[]> {
    try {
      const result = processor(event.data, context)

      if (result === undefined) {
        return []
      }

      if (Array.isArray(result)) {
        return result
      }

      return [result]
    } catch (error) {
      // Log error but don't fail processing
      logProvider.log.error({ err: error, eventType: event.type }, 'Event processor error')
      return []
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
