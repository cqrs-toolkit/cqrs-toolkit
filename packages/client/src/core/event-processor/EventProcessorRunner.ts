/**
 * Event processor runner.
 * Executes event processors and applies results to read model store.
 */

import { logProvider } from '@meticoeus/ddd-es'
import type { IStorage, ReadModelRecord } from '../../storage/IStorage.js'
import type { EventPersistence } from '../../types/events.js'
import type { EventBus } from '../events/EventBus.js'
import { EventProcessorRegistry } from './EventProcessorRegistry.js'
import type { EventProcessor, ProcessorContext, ProcessorResult } from './types.js'

/**
 * Event processor runner configuration.
 */
export interface EventProcessorRunnerConfig {
  storage: IStorage
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
  private readonly storage: IStorage
  private readonly eventBus: EventBus
  private readonly registry: EventProcessorRegistry

  constructor(config: EventProcessorRunnerConfig) {
    this.storage = config.storage
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

    // Apply all results
    const updatedIds: string[] = []
    for (const result of allResults) {
      await this.applyResult(result, event.cacheKey)
      updatedIds.push(`${result.collection}:${result.id}`)
    }

    // Emit update event
    if (updatedIds.length > 0) {
      // Group by collection
      const byCollection = new Map<string, string[]>()
      for (const result of allResults) {
        let ids = byCollection.get(result.collection)
        if (!ids) {
          ids = []
          byCollection.set(result.collection, ids)
        }
        ids.push(result.id)
      }

      for (const [collection, ids] of byCollection) {
        this.eventBus.emit('readmodel:updated', { collection, ids })
      }
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
        const record = await this.storage.getReadModel(collection, id)
        if (!record) return undefined
        return JSON.parse(record.effectiveData) as T
      },
    }
  }

  /**
   * Apply a processor result to the read model store.
   */
  private async applyResult(result: ProcessorResult, cacheKey: string): Promise<void> {
    const { collection, id, update, isServerUpdate } = result
    const existing = await this.storage.getReadModel(collection, id)
    const now = Date.now()

    if (update.type === 'delete') {
      if (existing) {
        await this.storage.deleteReadModel(collection, id)
      }
      return
    }

    if (update.type === 'set') {
      const dataJson = JSON.stringify(update.data)
      const record: ReadModelRecord = {
        id,
        collection,
        cacheKey,
        serverData: isServerUpdate ? dataJson : (existing?.serverData ?? null),
        effectiveData: dataJson,
        hasLocalChanges: !isServerUpdate,
        updatedAt: now,
      }
      await this.storage.saveReadModel(record)
      return
    }

    if (update.type === 'merge') {
      // Merge with existing data
      let currentData: Record<string, unknown> = {}
      if (existing) {
        currentData = JSON.parse(existing.effectiveData) as Record<string, unknown>
      }

      const merged = { ...currentData, ...update.data }
      const dataJson = JSON.stringify(merged)

      let serverData = existing?.serverData ?? null
      if (isServerUpdate) {
        // Also merge into server baseline
        let serverBaseline: Record<string, unknown> = {}
        if (serverData) {
          serverBaseline = JSON.parse(serverData) as Record<string, unknown>
        }
        serverData = JSON.stringify({ ...serverBaseline, ...update.data })
      }

      const record: ReadModelRecord = {
        id,
        collection,
        cacheKey,
        serverData,
        effectiveData: dataJson,
        hasLocalChanges: !isServerUpdate || (existing?.hasLocalChanges ?? false),
        updatedAt: now,
      }
      await this.storage.saveReadModel(record)
    }
  }
}
