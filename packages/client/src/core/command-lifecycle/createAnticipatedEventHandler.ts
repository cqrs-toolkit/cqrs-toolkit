import { type Link, logProvider } from '@meticoeus/ddd-es'
import type { TerminalCommandStatus } from '../../types/commands.js'
import type { Collection } from '../../types/config.js'
import type { CacheManager } from '../cache-manager/CacheManager.js'
import type { IAnticipatedEventHandler } from '../command-queue/CommandQueue.js'
import type { EventCache } from '../event-cache/EventCache.js'
import type { EventProcessorRunner, ParsedEvent } from '../event-processor/EventProcessorRunner.js'
import type { ReadModelStore } from '../read-model-store/ReadModelStore.js'
import { isAnticipatedEventShape } from './AnticipatedEventShape.js'

/**
 * Factory for the anticipated event handler.
 *
 * For each valid anticipated event, finds the matching collection via matchesStream,
 * acquires a cache key, stores via EventCache, then sends through the event processor
 * pipeline with `persistence: 'Anticipated'`.
 *
 * Tracks which entities were updated by each command's anticipated events. On failure
 * or cancellation, reverts those read models to their server baseline.
 */
export function createAnticipatedEventHandler<TLink extends Link>(
  eventCache: EventCache,
  cacheManager: CacheManager<TLink>,
  eventProcessorRunner: EventProcessorRunner,
  readModelStore: ReadModelStore,
  collections: Collection<TLink>[],
): IAnticipatedEventHandler {
  /** commandId → ["collection:id", ...] tracking which entities were optimistically updated. */
  const anticipatedUpdates = new Map<string, string[]>()

  return {
    async cache(commandId: string, events: unknown[], clientId?: string): Promise<void> {
      const updatedIds: string[] = []

      for (const raw of events) {
        if (!isAnticipatedEventShape(raw)) continue

        const collection = collections.find((c) => c.matchesStream(raw.streamId))
        if (!collection) {
          logProvider.log.warn(
            { streamId: raw.streamId, commandId },
            'Could not derive collection from streamId in anticipated event',
          )
          continue
        }

        // TODO(lazy-load): The cache key for lazily-loaded collections should come from
        // the active scope the command was issued against, not from a static seedCacheKey.
        if (!collection.seedCacheKey) {
          logProvider.log.warn(
            { streamId: raw.streamId, commandId },
            'Collection has no seedCacheKey for anticipated event',
          )
          continue
        }
        const cacheKey = await cacheManager.acquire(collection.seedCacheKey)

        const eventId = await eventCache.cacheAnticipatedEvent(
          { type: raw.type, data: raw.data, streamId: raw.streamId, commandId },
          { cacheKey, commandId },
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

        const result = await eventProcessorRunner.processEvent(parsed)
        updatedIds.push(...result.updatedIds)
      }

      if (updatedIds.length > 0) {
        anticipatedUpdates.set(commandId, updatedIds)
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
          await readModelStore.setClientMetadata(collection, id, { clientId })
        }
      }
    },

    async cleanup(commandId: string, terminalStatus: TerminalCommandStatus): Promise<void> {
      await eventCache.deleteAnticipatedEvents(commandId)

      const tracked = anticipatedUpdates.get(commandId)

      // On success, keep anticipatedUpdates entries so getCommandEntities() can
      // resolve them after submit() returns. Consumers need this to discover
      // what entities a command created (e.g., to select a newly created note).
      // Entries are cleaned up on session change (clearAll).
      // On failure/cancellation, delete immediately — the entries are stale.
      if (terminalStatus !== 'succeeded') {
        anticipatedUpdates.delete(commandId)
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
          await readModelStore.clearLocalChanges(collection, id)
        }
      }
    },

    async regenerate(commandId: string, newEvents: unknown[]): Promise<void> {
      await eventCache.deleteAnticipatedEvents(commandId)
      const tracked = anticipatedUpdates.get(commandId)
      anticipatedUpdates.delete(commandId)
      if (tracked) {
        for (const key of tracked) {
          const separatorIndex = key.indexOf(':')
          if (separatorIndex === -1) continue
          const collection = key.substring(0, separatorIndex)
          const id = key.substring(separatorIndex + 1)
          await readModelStore.clearLocalChanges(collection, id)
        }
      }
      await this.cache(commandId, newEvents)
    },

    getTrackedEntries(commandId: string): string[] | undefined {
      return anticipatedUpdates.get(commandId)
    },

    async getAnticipatedEventsForStream(
      streamId: string,
      excludeCommandId: string,
    ): Promise<ParsedEvent[]> {
      const allEvents = await eventCache.getEventsByStream(streamId)
      const parsed: ParsedEvent[] = []
      for (const record of allEvents) {
        if (record.persistence !== 'Anticipated') continue
        if (record.commandId === excludeCommandId) continue
        parsed.push({
          id: record.id,
          type: record.type,
          streamId: record.streamId,
          persistence: 'Anticipated',
          data: typeof record.data === 'string' ? JSON.parse(record.data) : record.data,
          commandId: record.commandId ?? undefined,
          cacheKey: record.cacheKey,
        })
      }
      return parsed
    },

    async clearAll(): Promise<void> {
      anticipatedUpdates.clear()
    },
  }
}
