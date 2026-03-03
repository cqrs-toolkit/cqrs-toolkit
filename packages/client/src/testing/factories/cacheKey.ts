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
    lastAccessedAt: now,
    holdCount: 0,
    frozen: false,
    expiresAt: null,
    createdAt: now,
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
