/**
 * Event processor runner.
 * Executes event processors and applies results to read model store.
 */

import { logProvider } from '@meticoeus/ddd-es'
import type { EventPersistence } from '../../types/events.js'
import type { IAnticipatedEventHandler } from '../command-queue/CommandQueue.js'
import type { EventBus } from '../events/EventBus.js'
import type { ReadModelStore, RevisionMeta } from '../read-model-store/ReadModelStore.js'
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
  /** Anticipated event handler for create reconciliation. Optional — only needed with command handlers. */
  anticipatedEventHandler?: IAnticipatedEventHandler
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
  revision?: bigint
  position?: bigint
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
  private anticipatedEventHandler?: IAnticipatedEventHandler

  constructor(config: EventProcessorRunnerConfig) {
    this.readModelStore = config.readModelStore
    this.eventBus = config.eventBus
    this.registry = config.registry
    this.anticipatedEventHandler = config.anticipatedEventHandler
  }

  /**
   * Set the anticipated event handler after construction (breaks circular dependency
   * when the handler needs the runner and the runner needs the handler).
   */
  setAnticipatedEventHandler(handler: IAnticipatedEventHandler): void {
    this.anticipatedEventHandler = handler
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

    // Build revision metadata for server-update writes (permanent events only)
    const revisionMeta: RevisionMeta | undefined =
      event.persistence === 'Permanent' && event.revision !== undefined
        ? {
            revision: String(event.revision),
            position: event.position !== undefined ? String(event.position) : undefined,
          }
        : undefined

    // Check for create reconciliation: a permanent event replacing an anticipated create
    // that used a different (client-generated) ID. This copies anticipated overlays from
    // the old stream, deletes the old entry, and prepares overlays for re-application.
    const reconciliation = await this.reconcileAnticipatedCreate(event, allResults)

    // Apply all results, tracking which actually modified data
    const modifiedByCollection = new Map<string, string[]>()
    const updatedIds: string[] = []

    // Include reconciled (deleted) entries in the modified set so the UI refreshes
    for (const entry of reconciliation.deletedEntries) {
      const separatorIndex = entry.indexOf(':')
      if (separatorIndex === -1) continue
      const collection = entry.substring(0, separatorIndex)
      const id = entry.substring(separatorIndex + 1)
      let ids = modifiedByCollection.get(collection)
      if (!ids) {
        ids = []
        modifiedByCollection.set(collection, ids)
      }
      ids.push(id)
      updatedIds.push(entry)
    }

    for (const result of allResults) {
      const modified = await this.applyResult(result, event.cacheKey, revisionMeta)
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

    // Apply deferred _clientMetadata from reconciled entries. The old entry's
    // metadata was captured before deletion; the new entry now exists after
    // applyResult, so we can set it.
    for (const meta of reconciliation.deferredMetadata) {
      await this.readModelStore.setClientMetadata(meta.collection, meta.id, {
        clientId: meta.clientId,
        reconciledAt: Date.now(),
      })
    }

    // Re-apply anticipated overlays from dependent commands onto the new server-ID entry.
    // These were copied from the old stream before deletion, with client IDs replaced.
    for (const overlay of reconciliation.overlayEvents) {
      const overlayResult = await this.processOverlayEvent(overlay)
      for (const id of overlayResult.updatedIds) {
        updatedIds.push(id)
        const separatorIndex = id.indexOf(':')
        if (separatorIndex === -1) continue
        const collection = id.substring(0, separatorIndex)
        const entryId = id.substring(separatorIndex + 1)
        let ids = modifiedByCollection.get(collection)
        if (!ids) {
          ids = []
          modifiedByCollection.set(collection, ids)
        }
        ids.push(entryId)
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
   * Check if a permanent event is replacing an anticipated create with a different ID.
   * If so:
   * 1. Copy anticipated overlay events from the old stream (excluding the create event)
   * 2. Transform them: replace client IDs with server IDs in data and streamId
   * 3. Delete the old (client-ID) read model entry
   * 4. Return the transformed overlays for re-application after applyResult
   *
   * This ensures the UI never sees a duplicate or loses overlays — everything happens
   * atomically within a single processEvent call (one readmodel:updated emission).
   */
  private async reconcileAnticipatedCreate(
    event: ParsedEvent,
    processorResults: ProcessorResult[],
  ): Promise<{
    deletedEntries: string[]
    overlayEvents: ParsedEvent[]
    deferredMetadata: Array<{ collection: string; id: string; clientId: string }>
  }> {
    const empty = { deletedEntries: [], overlayEvents: [], deferredMetadata: [] }

    // Only reconcile non-anticipated events with a commandId
    if (event.persistence === 'Anticipated') return empty
    if (!event.commandId) return empty
    if (!this.anticipatedEventHandler) return empty

    const tracked = this.anticipatedEventHandler.getTrackedEntries(event.commandId)
    if (!tracked || tracked.length === 0) return empty

    const deletedEntries: string[] = []
    const overlayEvents: ParsedEvent[] = []
    const deferredMetadata: Array<{ collection: string; id: string; clientId: string }> = []

    for (const result of processorResults) {
      for (const entry of tracked) {
        const separatorIndex = entry.indexOf(':')
        if (separatorIndex === -1) continue
        const trackedCollection = entry.substring(0, separatorIndex)
        const trackedId = entry.substring(separatorIndex + 1)

        if (trackedCollection !== result.collection || trackedId === result.id) continue

        // This is a create reconciliation: client ID → server ID.

        // Step 1: Copy anticipated events from the old stream (excluding create command's events)
        const oldStreamEvents = await this.anticipatedEventHandler.getAnticipatedEventsForStream(
          event.streamId.replace(result.id, trackedId), // Derive old stream ID
          event.commandId,
        )

        // Step 2: Transform — replace client IDs with server IDs
        for (const oldEvent of oldStreamEvents) {
          overlayEvents.push({
            ...oldEvent,
            streamId: oldEvent.streamId.replaceAll(trackedId, result.id),
            data: patchEntityId(oldEvent.data, trackedId, result.id),
          })
        }

        // Step 3: Capture _clientMetadata from old entry before deleting.
        // The old entry has no serverData (purely anticipated), so it will be
        // destroyed. The metadata is preserved and applied to the new server-ID
        // entry after applyResult creates it (deferred).
        const oldModel = await this.readModelStore.getById(trackedCollection, trackedId)
        if (oldModel?._clientMetadata) {
          deferredMetadata.push({
            collection: result.collection,
            id: result.id,
            clientId: oldModel._clientMetadata.clientId,
          })
        }

        // Step 4: Delete old entry
        await this.readModelStore.delete(trackedCollection, trackedId)
        deletedEntries.push(entry)

        logProvider.log.debug(
          {
            commandId: event.commandId,
            collection: trackedCollection,
            clientId: trackedId,
            serverId: result.id,
            overlayCount: oldStreamEvents.length,
          },
          'Reconciled anticipated create: replaced client ID with server ID',
        )
      }
    }

    return { deletedEntries, overlayEvents, deferredMetadata }
  }

  /**
   * Process an overlay event (anticipated event being re-applied after reconciliation).
   * Runs the event through processors and applies results, but does NOT emit notifications.
   */
  private async processOverlayEvent(event: ParsedEvent): Promise<ProcessEventResult> {
    const processors = this.registry.getProcessors(event.type, event.persistence)
    if (processors.length === 0) return { updatedIds: [], invalidated: false }

    const context = this.createContext(event)
    const allResults: ProcessorResult[] = []

    for (const processor of processors) {
      const result = await this.runProcessor(processor, event, context)
      allResults.push(...result.results)
    }

    const updatedIds: string[] = []
    for (const result of allResults) {
      await this.applyResult(result, event.cacheKey)
      updatedIds.push(`${result.collection}:${result.id}`)
    }

    return { updatedIds, invalidated: false }
  }

  /**
   * Apply a processor result to the read model store.
   * Returns true if the data was actually modified.
   */
  private async applyResult(
    result: ProcessorResult,
    cacheKey: string,
    revisionMeta?: RevisionMeta,
  ): Promise<boolean> {
    const { collection, id, update, isServerUpdate } = result

    if (update.type === 'delete') {
      return this.readModelStore.delete(collection, id)
    }

    if (update.type === 'set') {
      if (isServerUpdate) {
        return this.readModelStore.setServerData(
          collection,
          id,
          update.data,
          cacheKey,
          revisionMeta,
        )
      }
      return this.readModelStore.setLocalData(collection, id, update.data, cacheKey)
    }

    if (update.type === 'merge') {
      if (isServerUpdate) {
        return this.readModelStore.mergeServerData(
          collection,
          id,
          update.data,
          cacheKey,
          revisionMeta,
        )
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

/**
 * Replace the entity self-ID in event data (ddd-es convention: `data.id`).
 * Returns a shallow copy with `id` replaced, or the original data unchanged if no match.
 */
function patchEntityId(data: unknown, oldId: string, newId: string): unknown {
  if (typeof data !== 'object' || data === null) return data
  if (!('id' in data) || data.id !== oldId) return data
  return { ...data, id: newId }
}
