/**
 * Cache key test factories.
 */

import { deriveCacheKey } from '#utils'
import type { Link } from '@meticoeus/ddd-es'
import { v5 as uuidv5 } from 'uuid'
import { CACHE_KEY_NAMESPACE, type EntityCacheKey } from '../../core/cache-manager/CacheKey.js'
import type { CacheKeyRecord } from '../../storage/IStorage.js'

/**
 * Derive a deterministic entity cache key for tests.
 * Uses UUID v5 derivation — only for tests, not production code.
 * Production code should use `registerCacheKey` on the CacheManager.
 */
export function deriveEntityKey<TLink extends Link>(
  link: TLink,
  parentKey?: string,
): EntityCacheKey<TLink> {
  const parts: string[] = []
  if ('service' in link && typeof link.service === 'string') {
    parts.push(link.service)
  }
  parts.push(link.type, link.id)
  const input = `entity:${parts.join(':')}`
  return {
    kind: 'entity',
    key: uuidv5(input, CACHE_KEY_NAMESPACE),
    link,
    parentKey,
  }
}

/**
 * Create a test cache key record with sensible defaults.
 *
 * Enforces coherence between `frozen` and `frozenAt`:
 * - `frozen: true` without explicit `frozenAt` → `frozenAt` set to current time
 * - `frozen: false` → `frozenAt` forced to `null`
 *
 * @param overrides - Optional field overrides
 * @returns Cache key record
 */
export function createTestCacheKey(overrides: Partial<CacheKeyRecord> = {}): CacheKeyRecord {
  const now = Date.now()
  const base: CacheKeyRecord = {
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
    frozenAt: null,
    inheritedFrozen: false,
    lastAccessedAt: now,
    expiresAt: null,
    createdAt: now,
    holdCount: 0,
    estimatedSizeBytes: null,
    pendingIdMappings: null,
    ...overrides,
  }

  // Enforce frozen ↔ frozenAt coherence
  if (base.frozen && base.frozenAt === null) {
    base.frozenAt = now
  } else if (!base.frozen) {
    base.frozenAt = null
  }

  return base
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
