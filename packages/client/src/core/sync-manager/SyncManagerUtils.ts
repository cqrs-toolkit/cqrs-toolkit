/**
 * Extract commandId from event metadata (server contract: metadata.commandId).
 */
import type { IPersistedEvent, Link } from '@meticoeus/ddd-es'
import { type Collection, normalizeEventPersistence } from '../../types/index.js'
import type { CacheKeyIdentity } from '../cache-manager/index.js'
import type { ParsedEvent } from '../event-processor/index.js'

/**
 * Resolve WS topics for a cache key from the collection config.
 */
export function resolveTopicsForKey<TLink extends Link>(
  collection: Collection<TLink>,
  cacheKey: CacheKeyIdentity<TLink>,
): readonly string[] {
  if (collection.seedOnInit?.cacheKey.key === cacheKey.key) {
    return collection.seedOnInit.topics
  }
  if (collection.seedOnDemand) {
    return collection.seedOnDemand.subscribeTopics(cacheKey)
  }
  return []
}

/**
 * Convert persisted event to parsed event for processor.
 */
export function toParsedEvent(event: IPersistedEvent, cacheKey: string): ParsedEvent {
  const persistence = normalizeEventPersistence(event)
  const commandId = extractCommandId(event)
  return {
    id: event.id,
    type: event.type,
    streamId: event.streamId,
    persistence,
    data: event.data,
    commandId,
    revision: event.revision,
    position: event.position,
    cacheKey,
  }
}

function extractCommandId(event: IPersistedEvent): string | undefined {
  const metadata = event.metadata
  if (typeof metadata !== 'object' || metadata === null) return undefined
  if ('commandId' in metadata && typeof metadata.commandId === 'string') {
    return metadata.commandId
  }
  return undefined
}
