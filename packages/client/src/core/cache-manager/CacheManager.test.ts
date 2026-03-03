/**
 * Unit tests for CacheManager.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryStorage } from '../../storage/InMemoryStorage.js'
import { EventBus } from '../events/EventBus.js'
import { deriveCacheKey } from './CacheKey.js'
import { CacheManager } from './CacheManager.js'

describe('CacheManager', () => {
  let storage: InMemoryStorage
  let eventBus: EventBus
  let cacheManager: CacheManager

  beforeEach(async () => {
    storage = new InMemoryStorage()
    await storage.initialize()
    eventBus = new EventBus()
    cacheManager = new CacheManager({
      storage,
      eventBus,
      cacheConfig: { maxCacheKeys: 10, defaultTtl: 60000 },
    })
  })

  describe('acquire', () => {
    it('creates a new cache key', async () => {
      const key = await cacheManager.acquire('todos')

      expect(key).toBeDefined()
      expect(await cacheManager.exists(key)).toBe(true)
    })

    it('returns deterministic key for same collection', async () => {
      const key1 = await cacheManager.acquire('todos')
      const key2 = await cacheManager.acquire('todos')

      expect(key1).toBe(key2)
    })

    it('returns different keys for different params', async () => {
      const key1 = await cacheManager.acquire('todos', { status: 'active' })
      const key2 = await cacheManager.acquire('todos', { status: 'completed' })

      expect(key1).not.toBe(key2)
    })

    it('returns same key for same params in different order', async () => {
      const key1 = await cacheManager.acquire('todos', { a: 1, b: 2 })
      const key2 = await cacheManager.acquire('todos', { b: 2, a: 1 })

      expect(key1).toBe(key2)
    })

    it('places a hold when requested', async () => {
      const key = await cacheManager.acquire('todos', undefined, { hold: true })

      const record = await storage.getCacheKey(key)
      expect(record?.holdCount).toBe(1)
    })

    it('increments hold count on re-acquire with hold', async () => {
      const key = await cacheManager.acquire('todos', undefined, { hold: true })
      await cacheManager.acquire('todos', undefined, { hold: true })

      const record = await storage.getCacheKey(key)
      expect(record?.holdCount).toBe(2)
    })

    it('uses provided TTL', async () => {
      const key = await cacheManager.acquire('todos', undefined, { ttl: 1000 })

      const record = await storage.getCacheKey(key)
      expect(record?.expiresAt).toBeDefined()
      expect(record!.expiresAt! - record!.createdAt).toBe(1000)
    })

    it('creates scoped cache key', async () => {
      const key1 = await cacheManager.acquire('todos', undefined, { scope: 'user-1' })
      const key2 = await cacheManager.acquire('todos', undefined, { scope: 'user-2' })

      expect(key1).not.toBe(key2)
    })
  })

  describe('hold/release', () => {
    it('holds a cache key', async () => {
      const key = await cacheManager.acquire('todos')

      await cacheManager.hold(key)

      const record = await storage.getCacheKey(key)
      expect(record?.holdCount).toBe(1)
    })

    it('releases a cache key', async () => {
      const key = await cacheManager.acquire('todos', undefined, { hold: true })

      await cacheManager.release(key)

      const record = await storage.getCacheKey(key)
      expect(record?.holdCount).toBe(0)
    })

    it('supports multiple holds', async () => {
      const key = await cacheManager.acquire('todos')

      await cacheManager.hold(key)
      await cacheManager.hold(key)
      await cacheManager.release(key)

      const record = await storage.getCacheKey(key)
      expect(record?.holdCount).toBe(1)
    })
  })

  describe('freeze/unfreeze', () => {
    it('freezes a cache key', async () => {
      const key = await cacheManager.acquire('todos')

      await cacheManager.freeze(key)

      expect(await cacheManager.isFrozen(key)).toBe(true)
    })

    it('unfreezes a cache key', async () => {
      const key = await cacheManager.acquire('todos')
      await cacheManager.freeze(key)

      await cacheManager.unfreeze(key)

      expect(await cacheManager.isFrozen(key)).toBe(false)
    })
  })

  describe('evict', () => {
    it('evicts an unheld, unfrozen cache key', async () => {
      const key = await cacheManager.acquire('todos')

      const evicted = await cacheManager.evict(key)

      expect(evicted).toBe(true)
      expect(await cacheManager.exists(key)).toBe(false)
    })

    it('does not evict a held cache key', async () => {
      const key = await cacheManager.acquire('todos', undefined, { hold: true })

      const evicted = await cacheManager.evict(key)

      expect(evicted).toBe(false)
      expect(await cacheManager.exists(key)).toBe(true)
    })

    it('does not evict a frozen cache key', async () => {
      const key = await cacheManager.acquire('todos')
      await cacheManager.freeze(key)

      const evicted = await cacheManager.evict(key)

      expect(evicted).toBe(false)
      expect(await cacheManager.exists(key)).toBe(true)
    })

    it('emits cache:evicted event', async () => {
      const key = await cacheManager.acquire('todos')
      const events: unknown[] = []
      eventBus.on('cache:evicted').subscribe((e) => events.push(e))

      await cacheManager.evict(key)

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        payload: { cacheKey: key, reason: 'explicit' },
      })
    })
  })

  describe('automatic eviction', () => {
    it('evicts LRU cache key when at capacity', async () => {
      // Create cache manager with low max
      cacheManager = new CacheManager({
        storage,
        eventBus,
        cacheConfig: { maxCacheKeys: 3, defaultTtl: 60000 },
      })

      // Fill up cache
      const key1 = await cacheManager.acquire('collection-1')
      await new Promise((r) => setTimeout(r, 10)) // Different access times
      const key2 = await cacheManager.acquire('collection-2')
      await new Promise((r) => setTimeout(r, 10))
      const key3 = await cacheManager.acquire('collection-3')

      // Touch key1 to make it more recent
      await cacheManager.touch(key1)
      await new Promise((r) => setTimeout(r, 10))

      // Add 4th key - should evict key2 (oldest access time)
      const _key4 = await cacheManager.acquire('collection-4')

      expect(await cacheManager.exists(key1)).toBe(true)
      expect(await cacheManager.exists(key2)).toBe(false) // Evicted
      expect(await cacheManager.exists(key3)).toBe(true)
    })

    it('does not evict held cache keys during capacity eviction', async () => {
      cacheManager = new CacheManager({
        storage,
        eventBus,
        cacheConfig: { maxCacheKeys: 2, defaultTtl: 60000 },
      })

      const key1 = await cacheManager.acquire('collection-1', undefined, { hold: true })
      await new Promise((r) => setTimeout(r, 10))
      const key2 = await cacheManager.acquire('collection-2')
      await new Promise((r) => setTimeout(r, 10))

      // Try to add 3rd - cannot evict key1 (held), so evict key2
      const _key3 = await cacheManager.acquire('collection-3')

      expect(await cacheManager.exists(key1)).toBe(true) // Held, not evicted
      expect(await cacheManager.exists(key2)).toBe(false) // Evicted
    })
  })

  describe('evictExpired', () => {
    it('evicts expired cache keys', async () => {
      const key = await cacheManager.acquire('todos', undefined, { ttl: 1 })

      await new Promise((r) => setTimeout(r, 50)) // Wait for expiry

      const evicted = await cacheManager.evictExpired()

      expect(evicted).toBe(1)
      expect(await cacheManager.exists(key)).toBe(false)
    })

    it('does not evict non-expired cache keys', async () => {
      const key = await cacheManager.acquire('todos', undefined, { ttl: 60000 })

      const evicted = await cacheManager.evictExpired()

      expect(evicted).toBe(0)
      expect(await cacheManager.exists(key)).toBe(true)
    })

    it('emits cache:evicted with reason expired', async () => {
      const key = await cacheManager.acquire('todos', undefined, { ttl: 1 })
      const events: unknown[] = []
      eventBus.on('cache:evicted').subscribe((e) => events.push(e))

      await new Promise((r) => setTimeout(r, 50))
      await cacheManager.evictExpired()

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        payload: { cacheKey: key, reason: 'expired' },
      })
    })

    it('does not evict expired but held cache keys', async () => {
      const key = await cacheManager.acquire('todos', undefined, { ttl: 1, hold: true })

      await new Promise((r) => setTimeout(r, 50))

      const evicted = await cacheManager.evictExpired()

      expect(evicted).toBe(0)
      expect(await cacheManager.exists(key)).toBe(true)
    })
  })

  describe('evictAll', () => {
    it('evicts all evictable cache keys', async () => {
      await cacheManager.acquire('collection-1')
      await cacheManager.acquire('collection-2')
      const heldKey = await cacheManager.acquire('collection-3', undefined, { hold: true })

      const evicted = await cacheManager.evictAll()

      expect(evicted).toBe(2)
      expect(await cacheManager.exists(heldKey)).toBe(true)
    })
  })

  describe('getCount', () => {
    it('returns correct count', async () => {
      expect(await cacheManager.getCount()).toBe(0)

      await cacheManager.acquire('collection-1')
      expect(await cacheManager.getCount()).toBe(1)

      await cacheManager.acquire('collection-2')
      expect(await cacheManager.getCount()).toBe(2)
    })
  })
})

describe('deriveCacheKey', () => {
  it('generates deterministic keys', () => {
    const key1 = deriveCacheKey('todos')
    const key2 = deriveCacheKey('todos')
    expect(key1).toBe(key2)
  })

  it('generates different keys for different collections', () => {
    const key1 = deriveCacheKey('todos')
    const key2 = deriveCacheKey('users')
    expect(key1).not.toBe(key2)
  })

  it('generates different keys for different params', () => {
    const key1 = deriveCacheKey('todos', { status: 'active' })
    const key2 = deriveCacheKey('todos', { status: 'completed' })
    expect(key1).not.toBe(key2)
  })

  it('is order-independent for params', () => {
    const key1 = deriveCacheKey('todos', { a: 1, b: 2, c: 3 })
    const key2 = deriveCacheKey('todos', { c: 3, a: 1, b: 2 })
    expect(key1).toBe(key2)
  })
})
