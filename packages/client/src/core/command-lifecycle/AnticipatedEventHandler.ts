import { noop } from '#utils'
import type { Result } from '@meticoeus/ddd-es'
import { type Link, logProvider } from '@meticoeus/ddd-es'
import { type CommandRecord, EnqueueCommand } from '../../types/commands.js'
import type { Collection } from '../../types/config.js'
import type { EntityId } from '../../types/entities.js'
import { entityIdToString } from '../../types/entities.js'
import type { EventCache } from '../event-cache/EventCache.js'
import type { EventProcessorRegistry } from '../event-processor/EventProcessorRegistry.js'
import type { ProcessorContext, ProcessorResult } from '../event-processor/types.js'
import type { EventBus } from '../events/EventBus.js'
import type { ReadModelStore } from '../read-model-store/ReadModelStore.js'
import { type IWriteQueue, type WriteQueueException } from '../write-queue/IWriteQueue.js'
import type { ApplyAnticipatedOp } from '../write-queue/index.js'
import { type IAnticipatedEvent, isAnticipatedEvent } from './AnticipatedEventShape.js'
import type { IAnticipatedEventHandler } from './IAnticipatedEventHandler.js'

/**
 * Handles anticipated (optimistic) events for in-flight commands.
 *
 * For each valid anticipated event, finds the matching collection via matchesStream,
 * caches via EventCache, then runs processors inline and writes results to the
 * read model store as local overlays (`isServerUpdate: false`).
 *
 * Tracks which entities were updated by each command's anticipated events. On failure
 * or cancellation, reverts those read models to their server baseline.
 */
export class AnticipatedEventHandler<
  TLink extends Link,
  TCommand extends EnqueueCommand,
> implements IAnticipatedEventHandler<TLink, TCommand> {
  private readonly anticipatedUpdates = new Map<string, string[]>()

  constructor(
    private readonly eventBus: EventBus<TLink>,
    private readonly eventCache: EventCache<TLink, TCommand>,
    private readonly eventProcessorRegistry: EventProcessorRegistry,
    private readonly readModelStore: ReadModelStore<TLink, TCommand>,
    private readonly collections: Collection<TLink>[],
    private readonly writeQueue: IWriteQueue<TLink, TCommand>,
  ) {
    this.writeQueue.register('apply-anticipated', this.onApplyAnticipatedOp.bind(this))
    this.writeQueue.registerEviction('apply-anticipated', noop)
  }

  async cache<TEvent extends IAnticipatedEvent>(params: {
    command: CommandRecord<TLink, TCommand>
    events: TEvent[]
    clientId?: string
  }): Promise<Result<void, WriteQueueException>> {
    return this.writeQueue.enqueue({
      type: 'apply-anticipated',
      command: params.command,
      events: params.events,
      clientId: params.clientId,
    })
  }

  private async onApplyAnticipatedOp(op: ApplyAnticipatedOp<TLink, TCommand>): Promise<void> {
    const { command, events, clientId } = op
    const { commandId } = command
    const cacheKey = command.cacheKey.key
    const updatedIds: string[] = []
    const modifiedByCollection = new Map<string, Set<string>>()

    for (const raw of events) {
      if (!isAnticipatedEvent(raw)) continue

      if (raw.streamId.includes('[object Object]')) {
        logProvider.log.warn(
          { streamId: raw.streamId, type: raw.type, commandId },
          'Anticipated event streamId contains [object Object] — use entityIdToString() or collection.aggregate.getStreamId() to convert EntityRef before constructing streamId',
        )
      }

      const collection = this.collections.find((c) => c.matchesStream(raw.streamId))
      if (!collection) {
        logProvider.log.warn(
          { streamId: raw.streamId, commandId },
          'Could not derive collection from streamId in anticipated event',
        )
        continue
      }

      await this.eventCache.cacheAnticipatedEvent(
        { type: raw.type, data: raw.data, streamId: raw.streamId, commandId },
        { cacheKeys: [cacheKey], commandId },
      )

      const context: ProcessorContext = {
        persistence: 'Anticipated',
        commandId,
        streamId: raw.streamId,
        eventId: '',
      }

      // TODO(error-handling): processor calls are unprotected — a throwing processor
      // will fail the entire apply-anticipated op. Same gap exists in Phase 3 of
      // reconcileFromWsEvents. Both need try/catch with logging + continue.
      const processors = this.eventProcessorRegistry.getProcessors(raw.type, 'Anticipated')
      for (const processor of processors) {
        // TODO(types): modelState is `unknown` on CommandRecord, processor expects `TModel | undefined`.
        // These are incompatible — needs a proper solution for typing model state through the command lifecycle.
        const result = processor(raw.data, command.modelState as any, context)
        if (!result) continue
        if ('invalidate' in result) continue
        const results: ProcessorResult[] = Array.isArray(result) ? result : [result]

        for (const r of results) {
          const rowKey = entityIdToString(r.id as unknown as EntityId)
          if (typeof rowKey !== 'string') continue

          await this.applyLocalResult(r, cacheKey)

          const entryKey = `${r.collection}:${rowKey}`
          updatedIds.push(entryKey)

          let ids = modifiedByCollection.get(r.collection)
          if (!ids) {
            ids = new Set()
            modifiedByCollection.set(r.collection, ids)
          }
          ids.add(rowKey)
        }
      }
    }

    if (updatedIds.length > 0) {
      this.anticipatedUpdates.set(commandId, updatedIds)
    }

    for (const [collection, ids] of modifiedByCollection) {
      this.eventBus.emit('readmodel:updated', {
        collection,
        ids: Array.from(ids),
        commandIds: [commandId],
      })
    }

    if (typeof clientId === 'string') {
      for (const key of updatedIds) {
        const separatorIndex = key.indexOf(':')
        if (separatorIndex === -1) continue
        const col = key.substring(0, separatorIndex)
        const id = key.substring(separatorIndex + 1)
        await this.readModelStore.setClientMetadata(col, id, { clientId })
      }
    }
  }

  private async applyLocalResult(result: ProcessorResult, cacheKey: string): Promise<void> {
    const { collection, update } = result
    const rowKey = entityIdToString(result.id as unknown as EntityId)
    if (typeof rowKey !== 'string') return

    if (update.type === 'delete') {
      await this.readModelStore.delete(collection, rowKey)
      return
    }
    if (update.type === 'set') {
      await this.readModelStore.setLocalData(collection, rowKey, update.data, cacheKey)
      return
    }
    if (update.type === 'merge') {
      await this.readModelStore.applyLocalChanges(collection, rowKey, update.data, cacheKey)
    }
  }

  async cleanupOnSucceeded(commandId: string): Promise<void> {
    // Prune EventCache anticipated entries for the command. The optimistic
    // read-model overlay stays in place — it will be replaced by server
    // data when the sync pipeline drains the command's response events,
    // or evicted when its cache key goes away. `anticipatedUpdates` also
    // stays so the pipeline can migrate the tracked set to `'applied'`.
    await this.eventCache.deleteAnticipatedEvents(commandId)
  }

  async cleanupOnAppliedBatch(commandIds: Iterable<string>): Promise<void> {
    const ids = Array.from(commandIds)
    await this.eventCache.deleteAnticipatedEventsForCommands(ids)
    for (const commandId of ids) {
      this.anticipatedUpdates.delete(commandId)
    }
  }

  async cleanupOnFailure(commandId: string): Promise<void> {
    await this.eventCache.deleteAnticipatedEvents(commandId)

    const tracked = this.anticipatedUpdates.get(commandId)
    this.anticipatedUpdates.delete(commandId)
    if (!tracked) return

    for (const key of tracked) {
      const { collection, id } = parseTrackedKey(key)
      if (!collection || !id) continue
      await this.readModelStore.clearLocalChanges(collection, id)
    }
  }

  async regenerate<TEvent extends IAnticipatedEvent>(
    command: CommandRecord<TLink, TCommand>,
    newEvents: TEvent[],
  ): Promise<void> {
    const { commandId } = command
    await this.eventCache.deleteAnticipatedEvents(commandId)
    const tracked = this.anticipatedUpdates.get(commandId)
    this.anticipatedUpdates.delete(commandId)
    if (tracked) {
      for (const key of tracked) {
        const { collection, id } = parseTrackedKey(key)
        if (!collection || !id) continue
        await this.readModelStore.clearLocalChanges(collection, id)
      }
    }
    await this.cache({ command, events: newEvents })
  }

  getTrackedEntries(commandId: string): string[] | undefined {
    return this.anticipatedUpdates.get(commandId)
  }

  setTrackedEntries(commandId: string, entries: string[]): void {
    this.anticipatedUpdates.set(commandId, entries)
  }

  async clearAll(): Promise<void> {
    this.anticipatedUpdates.clear()
  }
}

function parseTrackedKey(key: string): { collection: string | undefined; id: string | undefined } {
  const separatorIndex = key.indexOf(':')
  if (separatorIndex === -1) return { collection: undefined, id: undefined }
  return {
    collection: key.substring(0, separatorIndex),
    id: key.substring(separatorIndex + 1),
  }
}
