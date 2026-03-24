import { logProvider } from '@meticoeus/ddd-es'
import type { Collection, CommandRecord } from '../../types/index.js'
import { CacheManager } from '../cache-manager/index.js'
import type { ParsedEvent } from '../event-processor/index.js'
import { SyncManager } from '../sync-manager/index.js'
import { hasResponseEvents, isResponseEvent } from './ResponseEvent.js'

/**
 * Build the `onCommandResponse` callback wired into the CommandQueue.
 *
 * For each valid event in the response, finds the matching collection via
 * matchesStream, acquires a cache key, converts to ParsedEvent, and routes
 * through SyncManager.processResponseEvents() for gap-aware processing and
 * WS dedup.
 *
 * Uses a lazy SyncManager reference because CommandQueue is created before
 * SyncManager. The lazy ref is safe because onCommandResponse is never called
 * before SyncManager exists (queue starts paused, only processes after resume).
 */
export function createCommandResponseHandler(
  getSyncManager: () => SyncManager,
  cacheManager: CacheManager,
  collections: Collection[],
): (command: CommandRecord, response: unknown) => Promise<void> {
  return async (command: CommandRecord, response: unknown) => {
    if (!hasResponseEvents(response)) return

    const events = response.events
    if (events.length === 0) return

    const parsedEvents: ParsedEvent[] = []

    for (const raw of events) {
      if (!isResponseEvent(raw)) continue

      const collection = collections.find((c) => c.matchesStream(raw.streamId))
      if (!collection) {
        logProvider.log.warn(
          { streamId: raw.streamId, commandId: command.commandId },
          'Could not derive collection from streamId in command response',
        )
        continue
      }

      const cacheKey = await cacheManager.acquire(collection.name)

      parsedEvents.push({
        id: raw.id,
        type: raw.type,
        streamId: raw.streamId,
        persistence: raw.persistence ?? 'Permanent',
        data: raw.data,
        commandId: command.commandId,
        revision: BigInt(raw.revision),
        position: BigInt(raw.position),
        cacheKey,
      })
    }

    if (parsedEvents.length > 0) {
      await getSyncManager().processResponseEvents(parsedEvents)
    }
  }
}
