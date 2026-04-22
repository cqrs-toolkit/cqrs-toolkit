/**
 * Extract commandId from event metadata (server contract: metadata.commandId).
 */
import type { IPersistedEvent, Link } from '@meticoeus/ddd-es'
import { type Collection } from '../../types/index.js'
import type { CacheKeyIdentity } from '../cache-manager/index.js'

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

function extractCommandId(event: IPersistedEvent): string | undefined {
  const metadata = event.metadata
  if (typeof metadata !== 'object' || metadata === null) return undefined
  if ('commandId' in metadata && typeof metadata.commandId === 'string') {
    return metadata.commandId
  }
  return undefined
}
