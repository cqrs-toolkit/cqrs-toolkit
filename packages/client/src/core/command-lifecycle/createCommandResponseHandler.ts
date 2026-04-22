import { type IPersistedEvent, type Link, logProvider } from '@meticoeus/ddd-es'
import { hydrateSerializedEvent } from '../../types/events.js'
import { Collection, CommandRecord, EnqueueCommand } from '../../types/index.js'
import { SyncManager } from '../sync-manager/index.js'
import type { IAnticipatedEvent } from './AnticipatedEventShape.js'
import { hasResponseEvents, isResponseEvent } from './ResponseEvent.js'

/**
 * Build the `onCommandResponse` callback wired into the CommandQueue.
 *
 * For each valid event in the response, finds the matching collection via
 * matchesStream, hydrates the serialized event into an `IPersistedEvent`,
 * and hands the batch to `SyncManager.handleCommandResponseEvents` — the
 * same batched drain entry used by the WS path. Fire-and-forget: the
 * callback does not await event processing. Command lifecycle resolution
 * is driven by `response.id` + `response.nextExpectedRevision` in the
 * CommandQueue, not by whether these events have been applied.
 *
 * Uses a lazy SyncManager reference because CommandQueue is created before
 * SyncManager. The lazy ref is safe because onCommandResponse is never called
 * before SyncManager exists (queue starts paused, only processes after resume).
 */
export function createCommandResponseHandler<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TSchema,
  TEvent extends IAnticipatedEvent,
>(
  getSyncManager: () => SyncManager<TLink, TCommand, TSchema, TEvent>,
  collections: Collection<TLink>[],
): (command: CommandRecord<TLink, TCommand>, response: unknown) => Promise<void> {
  return async (command: CommandRecord<TLink, TCommand>, response: unknown) => {
    if (!hasResponseEvents(response)) return

    const events = response.events
    if (events.length === 0) return

    const persistedEvents: IPersistedEvent[] = []

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

      persistedEvents.push(hydrateSerializedEvent(raw))
    }

    if (persistedEvents.length === 0) return

    getSyncManager().handleCommandResponseEvents(persistedEvents, command.cacheKey)
  }
}
