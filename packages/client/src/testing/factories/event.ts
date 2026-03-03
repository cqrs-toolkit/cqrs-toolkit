/**
 * Event test factories.
 */

import type { CachedEventRecord } from '../../storage/IStorage.js'
import { deriveCacheKey, generateId } from '../../utils/uuid.js'

/**
 * Create a test cached event record.
 *
 * @param overrides - Optional field overrides
 * @returns Cached event record
 */
export function createTestCachedEvent(
  overrides: Partial<CachedEventRecord> = {},
): CachedEventRecord {
  const now = Date.now()
  return {
    id: generateId(),
    type: 'TestEvent',
    streamId: 'test-stream-1',
    persistence: 'Permanent',
    data: JSON.stringify({ value: 'test' }),
    position: null,
    revision: null,
    commandId: null,
    cacheKey: deriveCacheKey('test-collection'),
    createdAt: now,
    ...overrides,
  }
}

/**
 * Create a permanent event.
 */
export function createPermanentEvent(
  position: bigint,
  revision: bigint,
  overrides: Partial<CachedEventRecord> = {},
): CachedEventRecord {
  return createTestCachedEvent({
    persistence: 'Permanent',
    position: position.toString(),
    revision: revision.toString(),
    ...overrides,
  })
}

/**
 * Create an anticipated event.
 */
export function createAnticipatedEvent(
  commandId: string,
  overrides: Partial<CachedEventRecord> = {},
): CachedEventRecord {
  return createTestCachedEvent({
    persistence: 'Anticipated',
    position: null,
    revision: null,
    commandId,
    ...overrides,
  })
}
