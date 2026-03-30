import { type Link, logProvider, type Result } from '@meticoeus/ddd-es'
import type { TerminalCommandStatus } from '../../types/commands.js'
import type { Collection } from '../../types/config.js'
import { noop } from '../../utils/index.js'
import type { IAnticipatedEventHandler } from '../command-queue/CommandQueue.js'
import type { EventCache } from '../event-cache/EventCache.js'
import type { EventProcessorRunner, ParsedEvent } from '../event-processor/EventProcessorRunner.js'
import type { ReadModelStore } from '../read-model-store/ReadModelStore.js'
import { ApplyAnticipatedOp } from '../write-queue/index.js'
import { IWriteQueue, WriteQueueException } from '../write-queue/IWriteQueue.js'
import { type IAnticipatedEvent, isAnticipatedEventShape } from './AnticipatedEventShape.js'

/**
 * Handles anticipated (optimistic) events for in-flight commands.
 *
 * For each valid anticipated event, finds the matching collection via matchesStream,
 * acquires a cache key, stores via EventCache, then sends through the event processor
 * pipeline with `persistence: 'Anticipated'`.
 *
 * Tracks which entities were updated by each command's anticipated events. On failure
 * or cancellation, reverts those read models to their server baseline.
 */
export class AnticipatedEventHandler<TLink extends Link> implements IAnticipatedEventHandler {
  /** commandId → ["collection:id", ...] tracking which entities were optimistically updated. */
  private anticipatedUpdates = new Map<string, string[]>()

  constructor(
    private readonly eventCache: EventCache<TLink>,
    private readonly eventProcessorRunner: EventProcessorRunner<TLink>,
    private readonly readModelStore: ReadModelStore<TLink>,
    private readonly collections: Collection<TLink>[],
    private readonly writeQueue: IWriteQueue<TLink>,
  ) {
    this.writeQueue.register('apply-anticipated', this.onApplyAnticipatedOp.bind(this))
    this.writeQueue.registerEviction('apply-anticipated', noop)
  }

  async cache<TEvent extends IAnticipatedEvent>(params: {
    commandId: string
    events: TEvent[]
    clientId?: string
    cacheKey: string
  }): Promise<Result<void, WriteQueueException>> {
    return this.writeQueue.enqueue({
      type: 'apply-anticipated',
      commandId: params.commandId,
      events: params.events,
      cacheKey: params.cacheKey,
      clientId: params.clientId,
    })
  }

  private async onApplyAnticipatedOp(op: ApplyAnticipatedOp): Promise<void> {
    const { commandId, events, clientId, cacheKey } = op
    const updatedIds: string[] = []

    for (const raw of events) {
      if (!isAnticipatedEventShape(raw)) continue

      const collection = this.collections.find((c) => c.matchesStream(raw.streamId))
      if (!collection) {
        logProvider.log.warn(
          { streamId: raw.streamId, commandId },
          'Could not derive collection from streamId in anticipated event',
        )
        continue
      }

      const eventId = await this.eventCache.cacheAnticipatedEvent(
        { type: raw.type, data: raw.data, streamId: raw.streamId, commandId },
        { cacheKeys: [cacheKey], commandId },
      )

      const parsed: ParsedEvent = {
        id: eventId,
        type: raw.type,
        streamId: raw.streamId,
        persistence: 'Anticipated',
        data: raw.data,
        commandId,
        cacheKey,
      }

      const result = await this.eventProcessorRunner.processEvent(parsed)
      updatedIds.push(...result.updatedIds)
    }

    if (updatedIds.length > 0) {
      this.anticipatedUpdates.set(commandId, updatedIds)
    }

    // Set _clientMetadata on read model entries created by temp-ID creates.
    // This allows the query primitive to maintain stable identity when the
    // server assigns a different permanent ID during reconciliation.
    if (typeof clientId === 'string') {
      for (const key of updatedIds) {
        const separatorIndex = key.indexOf(':')
        if (separatorIndex === -1) continue
        const collection = key.substring(0, separatorIndex)
        const id = key.substring(separatorIndex + 1)
        await this.readModelStore.setClientMetadata(collection, id, { clientId })
      }
    }
  }

  async cleanup(commandId: string, terminalStatus: TerminalCommandStatus): Promise<void> {
    await this.eventCache.deleteAnticipatedEvents(commandId)

    const tracked = this.anticipatedUpdates.get(commandId)

    // On success, keep anticipatedUpdates entries so getCommandEntities() can
    // resolve them after submit() returns. Consumers need this to discover
    // what entities a command created (e.g., to select a newly created note).
    // Entries are cleaned up on session change (clearAll).
    // On failure/cancellation, delete immediately — the entries are stale.
    if (terminalStatus !== 'succeeded') {
      this.anticipatedUpdates.delete(commandId)
    }

    // Clear local changes for all tracked entities on any terminal state.
    // - Failure/cancellation: reverts optimistic updates to server baseline,
    //   or deletes entries with no server baseline.
    // - Success (update commands): setServerData already cleared hasLocalChanges
    //   via three-way merge, so clearLocalChanges is a no-op.
    // - Success (create commands with client-generated IDs): the anticipated
    //   event created a read model with a client ID that differs from the
    //   server-assigned ID. The entry has serverData === null, so
    //   clearLocalChanges deletes the orphan.
    if (tracked) {
      for (const key of tracked) {
        const separatorIndex = key.indexOf(':')
        if (separatorIndex === -1) continue
        const collection = key.substring(0, separatorIndex)
        const id = key.substring(separatorIndex + 1)
        await this.readModelStore.clearLocalChanges(collection, id)
      }
    }
  }

  async regenerate<TEvent extends IAnticipatedEvent>(
    commandId: string,
    newEvents: TEvent[],
    cacheKey: string,
  ): Promise<void> {
    await this.eventCache.deleteAnticipatedEvents(commandId)
    const tracked = this.anticipatedUpdates.get(commandId)
    this.anticipatedUpdates.delete(commandId)
    if (tracked) {
      for (const key of tracked) {
        const separatorIndex = key.indexOf(':')
        if (separatorIndex === -1) continue
        const collection = key.substring(0, separatorIndex)
        const id = key.substring(separatorIndex + 1)
        await this.readModelStore.clearLocalChanges(collection, id)
      }
    }
    await this.cache({ commandId, events: newEvents, cacheKey })
  }

  getTrackedEntries(commandId: string): string[] | undefined {
    return this.anticipatedUpdates.get(commandId)
  }

  async getAnticipatedEventsForStream(
    streamId: string,
    excludeCommandId: string,
  ): Promise<ParsedEvent[]> {
    const allEvents = await this.eventCache.getEventsByStream(streamId)
    const parsed: ParsedEvent[] = []
    for (const record of allEvents) {
      if (record.persistence !== 'Anticipated') continue
      if (record.commandId === excludeCommandId) continue
      const cacheKey = record.cacheKeys[0]
      if (!cacheKey) continue
      parsed.push({
        id: record.id,
        type: record.type,
        streamId: record.streamId,
        persistence: 'Anticipated',
        data: typeof record.data === 'string' ? JSON.parse(record.data) : record.data,
        commandId: record.commandId ?? undefined,
        cacheKey,
      })
    }
    return parsed
  }

  async clearAll(): Promise<void> {
    this.anticipatedUpdates.clear()
  }
}
