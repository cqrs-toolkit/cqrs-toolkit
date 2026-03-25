/**
 * Cache key test factories.
 */

import type { CacheKeyRecord } from '../../storage/IStorage.js'
import { deriveCacheKey } from '../../utils/uuid.js'

/**
 * Create a test cache key record.
 *
 * @param overrides - Optional field overrides
 * @returns Cache key record
 */
export function createTestCacheKey(overrides: Partial<CacheKeyRecord> = {}): CacheKeyRecord {
  const now = Date.now()
  return {
    key: deriveCacheKey('test-collection'),
    kind: 'scope',
    linkService: null,
    linkType: null,
    linkId: null,
    service: null,
    scopeType: 'test-collection',
    scopeParams: null,
    parentKey: null,
    evictionPolicy: 'persistent',
    frozen: false,
    lastAccessedAt: now,
    expiresAt: null,
    createdAt: now,
    holdCount: 0,
    ...overrides,
  }
}

/**
 * Create a held cache key (cannot be evicted).
 */
export function createHeldCacheKey(overrides: Partial<CacheKeyRecord> = {}): CacheKeyRecord {
  return createTestCacheKey({ holdCount: 1, ...overrides })
}

/**
 * Create a frozen cache key.
 */
export function createFrozenCacheKey(overrides: Partial<CacheKeyRecord> = {}): CacheKeyRecord {
  return createTestCacheKey({ frozen: true, ...overrides })
}

/**
 * Create an expired cache key.
 */
export function createExpiredCacheKey(overrides: Partial<CacheKeyRecord> = {}): CacheKeyRecord {
  return createTestCacheKey({
    expiresAt: Date.now() - 1000, // Expired 1 second ago
    ...overrides,
  })
}
