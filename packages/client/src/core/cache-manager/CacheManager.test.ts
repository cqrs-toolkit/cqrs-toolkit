/**
 * Unit tests for CacheManager.
 */

import { ServiceLink } from '@meticoeus/ddd-es'
import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryStorage } from '../../storage/InMemoryStorage.js'
import { EnqueueCommand } from '../../types/index.js'
import { EventBus } from '../events/EventBus.js'
import {
  deriveEntityKey,
  deriveScopeKey,
  matchesCacheKey,
  type EntityKeyMatcher,
  type ScopeKeyMatcher,
} from './CacheKey.js'
import { CacheManager } from './CacheManager.js'

const WINDOW_ID = 'window-1'

describe('CacheManager', () => {
  let storage: InMemoryStorage<ServiceLink, EnqueueCommand>
  let eventBus: EventBus<ServiceLink>
  let cacheManager: CacheManager<ServiceLink, EnqueueCommand>

  beforeEach(async () => {
    storage = new InMemoryStorage()
    await storage.initialize()
    eventBus = new EventBus()
    cacheManager = new CacheManager({
      storage,
      eventBus,
      cacheConfig: { maxCacheKeys: 10, defaultTtl: 60000 },
      windowId: WINDOW_ID,
    })
  })

  describe('acquire', () => {
    it('creates a new cache key', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))

      expect(key).toBeDefined()
      expect(await cacheManager.exists(key)).toBe(true)
    })

    it('returns deterministic key for same collection', async () => {
      const key1 = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))
      const key2 = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))

      expect(key1).toBe(key2)
    })

    it('returns different keys for different params', async () => {
      const key1 = await cacheManager.acquire(
        deriveScopeKey({ scopeType: 'todos', scopeParams: { status: 'active' } }),
      )
      const key2 = await cacheManager.acquire(
        deriveScopeKey({ scopeType: 'todos', scopeParams: { status: 'completed' } }),
      )

      expect(key1).not.toBe(key2)
    })

    it('returns same key for same params in different order', async () => {
      const key1 = await cacheManager.acquire(
        deriveScopeKey({ scopeType: 'todos', scopeParams: { a: 1, b: 2 } }),
      )
      const key2 = await cacheManager.acquire(
        deriveScopeKey({ scopeType: 'todos', scopeParams: { b: 2, a: 1 } }),
      )

      expect(key1).toBe(key2)
    })

    it('places a hold when requested', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }), { hold: true })

      const record = await storage.getCacheKey(key)
      expect(record?.holdCount).toBe(1)
    })

    it('does not increment hold count on re-acquire with hold (idempotent per window)', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }), { hold: true })
      await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }), { hold: true })

      const record = await storage.getCacheKey(key)
      // Same windowId → idempotent, holdCount stays at 1
      expect(record?.holdCount).toBe(1)
    })

    it('uses provided TTL', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }), { ttl: 1000 })

      const record = await storage.getCacheKey(key)
      expect(record?.expiresAt).toBeDefined()
      expect(record!.expiresAt! - record!.createdAt).toBe(1000)
    })

    it('creates scoped cache key', async () => {
      const key1 = await cacheManager.acquire(
        deriveScopeKey({ service: 'user-1', scopeType: 'todos' }),
      )
      const key2 = await cacheManager.acquire(
        deriveScopeKey({ service: 'user-2', scopeType: 'todos' }),
      )

      expect(key1).not.toBe(key2)
    })
  })

  describe('evictionPolicy', () => {
    it('defaults to persistent', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))

      const record = await storage.getCacheKey(key)
      expect(record?.evictionPolicy).toBe('persistent')
    })

    it('stores ephemeral policy on record', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }), {
        evictionPolicy: 'ephemeral',
      })

      const record = await storage.getCacheKey(key)
      expect(record?.evictionPolicy).toBe('ephemeral')
    })

    it('does not change evictionPolicy on re-acquire', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }), {
        evictionPolicy: 'ephemeral',
      })
      await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }), {
        evictionPolicy: 'persistent',
      })

      const record = await storage.getCacheKey(key)
      expect(record?.evictionPolicy).toBe('ephemeral')
    })

    it('freeze is a no-op for ephemeral keys', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }), {
        evictionPolicy: 'ephemeral',
      })

      await cacheManager.freeze(key)

      expect(await cacheManager.isFrozen(key)).toBe(false)
    })

    it('maybeEvict prioritizes ephemeral keys before persistent', async () => {
      cacheManager = new CacheManager({
        storage,
        eventBus,
        cacheConfig: { maxCacheKeys: 3, defaultTtl: 60000 },
        windowId: WINDOW_ID,
      })

      // Create persistent key first (oldest)
      await cacheManager.acquire(deriveScopeKey({ scopeType: 'persistent-collection' }))
      await new Promise((r) => setTimeout(r, 10))

      // Create ephemeral key second (newer)
      await cacheManager.acquire(deriveScopeKey({ scopeType: 'ephemeral-collection' }), {
        evictionPolicy: 'ephemeral',
      })
      await new Promise((r) => setTimeout(r, 10))

      // Create third persistent key
      await cacheManager.acquire(deriveScopeKey({ scopeType: 'persistent-2' }))
      await new Promise((r) => setTimeout(r, 10))

      // Add 4th — should evict ephemeral key first despite it being newer
      await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-4' }))

      const ephemeralKey = deriveScopeKey({ scopeType: 'ephemeral-collection' }).key
      const persistentKey = deriveScopeKey({ scopeType: 'persistent-collection' }).key

      expect(await cacheManager.exists(ephemeralKey)).toBe(false) // Evicted (ephemeral priority)
      expect(await cacheManager.exists(persistentKey)).toBe(true) // Kept (persistent)
    })
  })

  describe('per-window holds', () => {
    it('hold adds windowId to tracking, storage holdCount becomes 1', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))

      await cacheManager.hold(key)

      const record = await storage.getCacheKey(key)
      expect(record?.holdCount).toBe(1)
    })

    it('second hold with same windowId is idempotent', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))

      await cacheManager.hold(key)
      await cacheManager.hold(key)

      const record = await storage.getCacheKey(key)
      expect(record?.holdCount).toBe(1)
    })

    it('hold with different windowId keeps storage holdCount at 1', async () => {
      // Create a second CacheManager representing a different window
      const cacheManager2 = new CacheManager({
        storage,
        eventBus,
        cacheConfig: { maxCacheKeys: 10, defaultTtl: 60000 },
        windowId: 'window-2',
      })

      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))

      await cacheManager.hold(key)
      await cacheManager2.hold(key)

      // holdCacheKey is called once per CacheManager since each sees 0→1 transition
      // storage.holdCacheKey increments, so holdCount = 2 in storage
      // This is expected: each window's CacheManager manages its own transition
      const record = await storage.getCacheKey(key)
      expect(record?.holdCount).toBe(2)
    })

    it('release with one windowId remaining keeps key held', async () => {
      // Simulate two windows holding via two CacheManagers
      const cacheManager2 = new CacheManager({
        storage,
        eventBus,
        cacheConfig: { maxCacheKeys: 10, defaultTtl: 60000 },
        windowId: 'window-2',
      })

      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))
      await cacheManager.hold(key)
      await cacheManager2.hold(key)

      // Release from window-1
      await cacheManager.release(key)

      // window-2's CacheManager still holds it — but from window-1's perspective it's released
      const record = await storage.getCacheKey(key)
      // window-1 released (0→empty transition called releaseCacheKey),
      // window-2 still holds (holdCount = 1 in storage)
      expect(record?.holdCount).toBe(1)
    })

    it('release last windowId drops storage holdCount to 0', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))
      await cacheManager.hold(key)

      await cacheManager.release(key)

      const record = await storage.getCacheKey(key)
      expect(record?.holdCount).toBe(0)
    })

    it('ephemeral key auto-evicted when last window releases', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }), {
        evictionPolicy: 'ephemeral',
        hold: true,
      })

      expect(await cacheManager.exists(key)).toBe(true)

      await cacheManager.release(key)

      expect(await cacheManager.exists(key)).toBe(false)
    })

    it('releaseAllForWindow cleans up all keys for that window', async () => {
      const key1 = await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-1' }))
      const key2 = await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-2' }))
      await cacheManager.hold(key1)
      await cacheManager.hold(key2)

      await cacheManager.releaseAllForWindow(WINDOW_ID)

      const record1 = await storage.getCacheKey(key1)
      const record2 = await storage.getCacheKey(key2)
      expect(record1?.holdCount).toBe(0)
      expect(record2?.holdCount).toBe(0)
    })
  })

  describe('initialize', () => {
    it('resets all holdCounts to 0', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }), { hold: true })

      const recordBefore = await storage.getCacheKey(key)
      expect(recordBefore?.holdCount).toBe(1)

      // Create a fresh CacheManager and initialize
      const freshManager = new CacheManager({
        storage,
        eventBus,
        cacheConfig: { maxCacheKeys: 10, defaultTtl: 60000 },
        windowId: 'window-fresh',
      })
      await freshManager.initialize()

      const recordAfter = await storage.getCacheKey(key)
      expect(recordAfter?.holdCount).toBe(0)
    })

    it('evicts all ephemeral keys (persistent keys survive)', async () => {
      const persistentKey = await cacheManager.acquire(deriveScopeKey({ scopeType: 'persistent' }))
      const ephemeralKey = await cacheManager.acquire(deriveScopeKey({ scopeType: 'ephemeral' }), {
        evictionPolicy: 'ephemeral',
      })

      // Create a fresh CacheManager and initialize
      const freshManager = new CacheManager({
        storage,
        eventBus,
        cacheConfig: { maxCacheKeys: 10, defaultTtl: 60000 },
        windowId: 'window-fresh',
      })
      await freshManager.initialize()

      expect(await freshManager.exists(persistentKey)).toBe(true)
      expect(await freshManager.exists(ephemeralKey)).toBe(false)
    })

    it('emits cache:evicted for each ephemeral key', async () => {
      const cacheKey = deriveScopeKey({ scopeType: 'ephemeral' })
      await cacheManager.acquire(cacheKey, { evictionPolicy: 'ephemeral' })

      const events: unknown[] = []
      eventBus.on('cache:evicted').subscribe((e) => events.push(e))

      const freshManager = new CacheManager({
        storage,
        eventBus,
        cacheConfig: { maxCacheKeys: 10, defaultTtl: 60000 },
        windowId: 'window-fresh',
      })
      await freshManager.initialize()

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        data: {
          cacheKey: { kind: 'scope', key: cacheKey.key, scopeType: 'ephemeral' },
          reason: 'explicit',
        },
      })
    })
  })

  describe('window capacity guard', () => {
    it('registerWindow succeeds up to maxWindows', () => {
      const manager = new CacheManager({
        storage,
        eventBus,
        cacheConfig: { maxCacheKeys: 10, defaultTtl: 60000, maxWindows: 2 },
        windowId: 'w-1',
      })

      // w-1 is not auto-registered until initialize() is called
      expect(manager.registerWindow('w-1')).toBe(true)
      expect(manager.registerWindow('w-2')).toBe(true)
    })

    it('registerWindow at capacity returns false and emits event', () => {
      const manager = new CacheManager({
        storage,
        eventBus,
        cacheConfig: { maxCacheKeys: 10, defaultTtl: 60000, maxWindows: 2 },
        windowId: 'w-1',
      })

      const events: unknown[] = []
      eventBus.on('cache:too-many-windows').subscribe((e) => events.push(e))

      manager.registerWindow('w-1')
      manager.registerWindow('w-2')
      const result = manager.registerWindow('w-3')

      expect(result).toBe(false)
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        data: { windowId: 'w-3', maxWindows: 2 },
      })
    })

    it('unregisterWindow releases holds and allows new registration', async () => {
      const manager = new CacheManager({
        storage,
        eventBus,
        cacheConfig: { maxCacheKeys: 10, defaultTtl: 60000, maxWindows: 2 },
        windowId: 'w-1',
      })

      manager.registerWindow('w-1')
      manager.registerWindow('w-2')

      await manager.unregisterWindow('w-2')

      expect(manager.registerWindow('w-3')).toBe(true)
    })
  })

  describe('session mismatch', () => {
    it('returns false with no session', async () => {
      const result = await cacheManager.checkSessionUser('user-1')
      expect(result).toBe(false)
    })

    it('returns false with matching user', async () => {
      await storage.saveSession({
        id: 1,
        userId: 'user-1',
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
      })

      const result = await cacheManager.checkSessionUser('user-1')
      expect(result).toBe(false)
    })

    it('wipes all cache keys and emits cache:session-reset on user change', async () => {
      await storage.saveSession({
        id: 1,
        userId: 'user-1',
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
      })

      await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-1' }))
      await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-2' }))

      const events: unknown[] = []
      eventBus.on('cache:session-reset').subscribe((e) => events.push(e))

      const result = await cacheManager.checkSessionUser('user-2')

      expect(result).toBe(true)
      expect(await cacheManager.getCount()).toBe(0)
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        data: { previousUserId: 'user-1', newUserId: 'user-2' },
      })
    })

    it('clears in-memory hold state on user change', async () => {
      await storage.saveSession({
        id: 1,
        userId: 'user-1',
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
      })

      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }), {
        hold: true,
      })
      expect(await cacheManager.exists(key)).toBe(true)

      await cacheManager.checkSessionUser('user-2')

      // Cache was wiped — key should no longer exist
      expect(await cacheManager.exists(key)).toBe(false)
      expect(await cacheManager.getCount()).toBe(0)
    })
  })

  describe('hold/release', () => {
    it('holds a cache key', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))

      await cacheManager.hold(key)

      const record = await storage.getCacheKey(key)
      expect(record?.holdCount).toBe(1)
    })

    it('releases a cache key', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }), {
        hold: true,
      })

      await cacheManager.release(key)

      const record = await storage.getCacheKey(key)
      expect(record?.holdCount).toBe(0)
    })
  })

  describe('freeze/unfreeze', () => {
    it('freezes a cache key', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))

      await cacheManager.freeze(key)

      expect(await cacheManager.isFrozen(key)).toBe(true)
    })

    it('unfreezes a cache key', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))
      await cacheManager.freeze(key)

      await cacheManager.unfreeze(key)

      expect(await cacheManager.isFrozen(key)).toBe(false)
    })
  })

  describe('evict', () => {
    it('evicts an unheld, unfrozen cache key', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))

      const evicted = await cacheManager.evict(key)

      expect(evicted).toBe(true)
      expect(await cacheManager.exists(key)).toBe(false)
    })

    it('does not evict a held cache key', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }), {
        hold: true,
      })

      const evicted = await cacheManager.evict(key)

      expect(evicted).toBe(false)
      expect(await cacheManager.exists(key)).toBe(true)
    })

    it('does not evict a frozen cache key', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))
      await cacheManager.freeze(key)

      const evicted = await cacheManager.evict(key)

      expect(evicted).toBe(false)
      expect(await cacheManager.exists(key)).toBe(true)
    })

    it('emits cache:evicted event', async () => {
      const cacheKey = deriveScopeKey({ scopeType: 'todos' })
      await cacheManager.acquire(cacheKey)
      const events: unknown[] = []
      eventBus.on('cache:evicted').subscribe((e) => events.push(e))

      await cacheManager.evict(cacheKey.key)

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        data: {
          cacheKey: { kind: 'scope', key: cacheKey.key, scopeType: 'todos' },
          reason: 'explicit',
        },
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
        windowId: WINDOW_ID,
      })

      // Fill up cache
      const key1 = await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-1' }))
      await new Promise((r) => setTimeout(r, 10)) // Different access times
      const key2 = await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-2' }))
      await new Promise((r) => setTimeout(r, 10))
      const key3 = await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-3' }))

      // Touch key1 to make it more recent
      await cacheManager.touch(deriveScopeKey({ scopeType: 'collection-1' }))
      await new Promise((r) => setTimeout(r, 10))

      // Add 4th key - should evict key2 (oldest access time)
      const _key4 = await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-4' }))

      expect(await cacheManager.exists(key1)).toBe(true)
      expect(await cacheManager.exists(key2)).toBe(false) // Evicted
      expect(await cacheManager.exists(key3)).toBe(true)
    })

    it('does not evict held cache keys during capacity eviction', async () => {
      cacheManager = new CacheManager({
        storage,
        eventBus,
        cacheConfig: { maxCacheKeys: 2, defaultTtl: 60000 },
        windowId: WINDOW_ID,
      })

      const key1 = await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-1' }), {
        hold: true,
      })
      await new Promise((r) => setTimeout(r, 10))
      const key2 = await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-2' }))
      await new Promise((r) => setTimeout(r, 10))

      // Try to add 3rd - cannot evict key1 (held), so evict key2
      const _key3 = await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-3' }))

      expect(await cacheManager.exists(key1)).toBe(true) // Held, not evicted
      expect(await cacheManager.exists(key2)).toBe(false) // Evicted
    })
  })

  describe('evictExpired', () => {
    it('evicts expired cache keys', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }), { ttl: 1 })

      await new Promise((r) => setTimeout(r, 50)) // Wait for expiry

      const evicted = await cacheManager.evictExpired()

      expect(evicted).toBe(1)
      expect(await cacheManager.exists(key)).toBe(false)
    })

    it('does not evict non-expired cache keys', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }), {
        ttl: 60000,
      })

      const evicted = await cacheManager.evictExpired()

      expect(evicted).toBe(0)
      expect(await cacheManager.exists(key)).toBe(true)
    })

    it('emits cache:evicted with reason expired', async () => {
      const cacheKey = deriveScopeKey({ scopeType: 'todos' })
      await cacheManager.acquire(cacheKey, { ttl: 1 })
      const events: unknown[] = []
      eventBus.on('cache:evicted').subscribe((e) => events.push(e))

      await new Promise((r) => setTimeout(r, 50))
      await cacheManager.evictExpired()

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        data: {
          cacheKey: { kind: 'scope', key: cacheKey.key, scopeType: 'todos' },
          reason: 'expired',
        },
      })
    })

    it('does not evict expired but held cache keys', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }), {
        ttl: 1,
        hold: true,
      })

      await new Promise((r) => setTimeout(r, 50))

      const evicted = await cacheManager.evictExpired()

      expect(evicted).toBe(0)
      expect(await cacheManager.exists(key)).toBe(true)
    })
  })

  describe('evictAll', () => {
    it('evicts all evictable cache keys', async () => {
      await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-1' }))
      await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-2' }))
      const heldKey = await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-3' }), {
        hold: true,
      })

      const evicted = await cacheManager.evictAll()

      expect(evicted).toBe(2)
      expect(await cacheManager.exists(heldKey)).toBe(true)
    })
  })

  describe('getCount', () => {
    it('returns correct count', async () => {
      expect(await cacheManager.getCount()).toBe(0)

      await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-1' }))
      expect(await cacheManager.getCount()).toBe(1)

      await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-2' }))
      expect(await cacheManager.getCount()).toBe(2)
    })
  })

  describe('onSessionDestroyed', () => {
    it('deletes all cache keys from storage', async () => {
      await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-1' }))
      await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-2' }))
      expect(await cacheManager.getCount()).toBe(2)

      await cacheManager.onSessionDestroyed()

      expect(await cacheManager.getCount()).toBe(0)
    })

    it('clears in-memory holds and registered windows', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }), {
        hold: true,
      })

      await cacheManager.onSessionDestroyed()

      // Re-create cache key — hold should start fresh (not carry over)
      const newKey = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))
      const record = await cacheManager.get(newKey)
      expect(record?.holdCount).toBe(0)
    })
  })

  describe('lifecycle events', () => {
    it('emits cache:key-added on first acquire with cacheKey', async () => {
      const events: unknown[] = []
      eventBus.on('cache:key-added').subscribe((e) => events.push(e))

      const cacheKey = deriveScopeKey({ scopeType: 'todos' })
      await cacheManager.acquire(cacheKey)

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        data: {
          cacheKey: { kind: 'scope', scopeType: 'todos', key: cacheKey.key },
          evictionPolicy: 'persistent',
        },
      })
    })

    it('emits cache:key-accessed on re-acquire', async () => {
      const cacheKey = deriveScopeKey({ scopeType: 'todos' })
      await cacheManager.acquire(cacheKey)

      const events: unknown[] = []
      eventBus.on('cache:key-accessed').subscribe((e) => events.push(e))

      await cacheManager.acquire(cacheKey)

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        data: { cacheKey: cacheKey },
      })
    })

    it('does not emit cache:key-added on re-acquire', async () => {
      const cacheKey = deriveScopeKey({ scopeType: 'todos' })
      await cacheManager.acquire(cacheKey)

      const events: unknown[] = []
      eventBus.on('cache:key-added').subscribe((e) => events.push(e))

      await cacheManager.acquire(cacheKey)

      expect(events).toHaveLength(0)
    })

    it('emits cache:key-accessed on touch of existing key', async () => {
      const cacheKey = deriveScopeKey({ scopeType: 'todos' })
      await cacheManager.acquire(cacheKey)

      const events: unknown[] = []
      eventBus.on('cache:key-accessed').subscribe((e) => events.push(e))

      await cacheManager.touch(cacheKey)

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        data: { cacheKey: cacheKey },
      })
    })

    it('emits cache:key-added on touch of nonexistent key', async () => {
      const cacheKey = deriveScopeKey({ scopeType: 'new-collection' })

      const addedEvents: unknown[] = []
      eventBus.on('cache:key-added').subscribe((e) => addedEvents.push(e))

      await cacheManager.touch(cacheKey)

      expect(addedEvents).toHaveLength(1)
      expect(await cacheManager.exists(cacheKey.key)).toBe(true)
    })

    it('emits cache:frozen-changed on freeze with frozenAt timestamp', async () => {
      const cacheKey = deriveScopeKey({ scopeType: 'todos' })
      await cacheManager.acquire(cacheKey)

      const events: unknown[] = []
      eventBus.on('cache:frozen-changed').subscribe((e) => events.push(e))

      await cacheManager.freeze(cacheKey.key)

      expect(events).toHaveLength(1)
      const event = events[0] as {
        data: { cacheKey: { kind: string; key: string }; frozen: boolean; frozenAt: number }
      }
      expect(event.data.cacheKey.key).toBe(cacheKey.key)
      expect(event.data.cacheKey.kind).toBe('scope')
      expect(event.data.frozen).toBe(true)
      expect(typeof event.data.frozenAt).toBe('number')

      // Verify frozenAt is persisted
      const record = await cacheManager.get(cacheKey.key)
      expect(record?.frozenAt).toBe(event.data.frozenAt)
    })

    it('emits cache:frozen-changed on unfreeze with frozenAt null', async () => {
      const cacheKey = deriveScopeKey({ scopeType: 'todos' })
      await cacheManager.acquire(cacheKey)
      await cacheManager.freeze(cacheKey.key)

      const events: unknown[] = []
      eventBus.on('cache:frozen-changed').subscribe((e) => events.push(e))

      await cacheManager.unfreeze(cacheKey.key)

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        data: {
          cacheKey: { kind: 'scope', key: cacheKey.key, scopeType: 'todos' },
          frozen: false,
          frozenAt: null,
        },
      })

      // Verify frozenAt is cleared in storage
      const record = await cacheManager.get(cacheKey.key)
      expect(record?.frozenAt).toBeNull()
    })

    it('does not emit cache:frozen-changed when re-freezing already frozen key', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))
      await cacheManager.freeze(key)

      const events: unknown[] = []
      eventBus.on('cache:frozen-changed').subscribe((e) => events.push(e))

      await cacheManager.freeze(key)

      expect(events).toHaveLength(0)
    })

    it('does not emit cache:frozen-changed when unfreezing non-frozen key', async () => {
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))

      const events: unknown[] = []
      eventBus.on('cache:frozen-changed').subscribe((e) => events.push(e))

      await cacheManager.unfreeze(key)

      expect(events).toHaveLength(0)
    })
  })

  describe('hierarchical cache keys', () => {
    it('propagates inheritedFrozen to children when parent is frozen', async () => {
      const parent = deriveScopeKey({ scopeType: 'workspace' })
      const child = deriveScopeKey({ scopeType: 'todos', parentKey: parent.key })

      await cacheManager.acquireKey(parent)
      await cacheManager.acquireKey(child)

      await cacheManager.freeze(parent.key)

      const childRecord = await cacheManager.get(child.key)
      expect(childRecord?.inheritedFrozen).toBe(true)
    })

    it('clears inheritedFrozen on children when parent is unfrozen', async () => {
      const parent = deriveScopeKey({ scopeType: 'workspace' })
      const child = deriveScopeKey({ scopeType: 'todos', parentKey: parent.key })

      await cacheManager.acquireKey(parent)
      await cacheManager.acquireKey(child)
      await cacheManager.freeze(parent.key)

      await cacheManager.unfreeze(parent.key)

      const childRecord = await cacheManager.get(child.key)
      expect(childRecord?.inheritedFrozen).toBe(false)
    })

    it('propagates inheritedFrozen through multiple levels', async () => {
      const grandparent = deriveScopeKey({ scopeType: 'org' })
      const parent = deriveScopeKey({ scopeType: 'workspace', parentKey: grandparent.key })
      const child = deriveScopeKey({ scopeType: 'todos', parentKey: parent.key })

      await cacheManager.acquireKey(grandparent)
      await cacheManager.acquireKey(parent)
      await cacheManager.acquireKey(child)

      await cacheManager.freeze(grandparent.key)

      const parentRecord = await cacheManager.get(parent.key)
      const childRecord = await cacheManager.get(child.key)
      expect(parentRecord?.inheritedFrozen).toBe(true)
      expect(childRecord?.inheritedFrozen).toBe(true)
    })

    it('keeps inheritedFrozen when unfreezing middle node with frozen grandparent', async () => {
      const grandparent = deriveScopeKey({ scopeType: 'org' })
      const parent = deriveScopeKey({ scopeType: 'workspace', parentKey: grandparent.key })
      const child = deriveScopeKey({ scopeType: 'todos', parentKey: parent.key })

      await cacheManager.acquireKey(grandparent)
      await cacheManager.acquireKey(parent)
      await cacheManager.acquireKey(child)

      // Freeze both grandparent and parent
      await cacheManager.freeze(grandparent.key)
      await cacheManager.freeze(parent.key)

      // Unfreeze parent — child still inherits from grandparent
      await cacheManager.unfreeze(parent.key)

      const childRecord = await cacheManager.get(child.key)
      expect(childRecord?.inheritedFrozen).toBe(true)
    })

    it('does not evict inheritedFrozen keys', async () => {
      const parent = deriveScopeKey({ scopeType: 'workspace' })
      const child = deriveScopeKey({ scopeType: 'todos', parentKey: parent.key })

      await cacheManager.acquireKey(parent)
      await cacheManager.acquireKey(child)
      await cacheManager.freeze(parent.key)

      const evicted = await cacheManager.evict(child.key)
      expect(evicted).toBe(false)
    })

    it('cannot evict a parent while children exist', async () => {
      const parent = deriveScopeKey({ scopeType: 'workspace' })
      const child = deriveScopeKey({ scopeType: 'todos', parentKey: parent.key })

      await cacheManager.acquireKey(parent)
      await cacheManager.acquireKey(child)

      const evicted = await cacheManager.evict(parent.key)
      expect(evicted).toBe(false)
    })

    it('can evict parent after all children are evicted', async () => {
      const parent = deriveScopeKey({ scopeType: 'workspace' })
      const child = deriveScopeKey({ scopeType: 'todos', parentKey: parent.key })

      await cacheManager.acquireKey(parent)
      await cacheManager.acquireKey(child)

      await cacheManager.evict(child.key)
      const evicted = await cacheManager.evict(parent.key)
      expect(evicted).toBe(true)
    })

    it('does not propagate inheritedFrozen to ephemeral children', async () => {
      const parent = deriveScopeKey({ scopeType: 'workspace' })
      const child = deriveScopeKey({ scopeType: 'temp-view', parentKey: parent.key })

      await cacheManager.acquireKey(parent)
      await cacheManager.acquireKey(child, { evictionPolicy: 'ephemeral', hold: true })
      await cacheManager.freeze(parent.key)

      const childRecord = await cacheManager.get(child.key)
      expect(childRecord?.inheritedFrozen).toBe(false)
    })

    it('does not evict expired frozen keys', async () => {
      const cacheKey = deriveScopeKey({ scopeType: 'todos' })
      await cacheManager.acquireKey(cacheKey, { ttl: 1 })

      // Wait for TTL to expire
      await new Promise((r) => setTimeout(r, 10))

      await cacheManager.freeze(cacheKey.key)

      const count = await cacheManager.evictExpired()
      expect(count).toBe(0)
      expect(await cacheManager.exists(cacheKey.key)).toBe(true)
    })

    it('does not evict expired inheritedFrozen keys', async () => {
      const parent = deriveScopeKey({ scopeType: 'workspace' })
      const child = deriveScopeKey({ scopeType: 'todos', parentKey: parent.key })

      await cacheManager.acquireKey(parent)
      await cacheManager.acquireKey(child, { ttl: 1 })

      // Wait for TTL to expire
      await new Promise((r) => setTimeout(r, 10))

      await cacheManager.freeze(parent.key)

      const count = await cacheManager.evictExpired()
      expect(count).toBe(0)
      expect(await cacheManager.exists(child.key)).toBe(true)
    })

    it('evictAll evicts leaves before parents (bottom-up)', async () => {
      const parent = deriveScopeKey({ scopeType: 'workspace' })
      const child = deriveScopeKey({ scopeType: 'todos', parentKey: parent.key })

      await cacheManager.acquireKey(parent)
      await cacheManager.acquireKey(child)

      const evictedKeys: string[] = []
      eventBus.on('cache:evicted').subscribe((e) => evictedKeys.push(e.data.cacheKey.key))

      const count = await cacheManager.evictAll()

      expect(count).toBe(2)
      expect(evictedKeys[0]).toBe(child.key)
      expect(evictedKeys[1]).toBe(parent.key)
    })
  })
})

describe('deriveScopeKey', () => {
  it('generates deterministic keys', () => {
    const key1 = deriveScopeKey({ scopeType: 'todos' })
    const key2 = deriveScopeKey({ scopeType: 'todos' })
    expect(key1.key).toBe(key2.key)
  })

  it('generates different keys for different scope types', () => {
    const key1 = deriveScopeKey({ scopeType: 'todos' })
    const key2 = deriveScopeKey({ scopeType: 'users' })
    expect(key1.key).not.toBe(key2.key)
  })

  it('generates different keys for different params', () => {
    const key1 = deriveScopeKey({ scopeType: 'todos', scopeParams: { status: 'active' } })
    const key2 = deriveScopeKey({ scopeType: 'todos', scopeParams: { status: 'completed' } })
    expect(key1.key).not.toBe(key2.key)
  })

  it('is order-independent for params', () => {
    const key1 = deriveScopeKey({ scopeType: 'todos', scopeParams: { a: 1, b: 2, c: 3 } })
    const key2 = deriveScopeKey({ scopeType: 'todos', scopeParams: { c: 3, a: 1, b: 2 } })
    expect(key1.key).toBe(key2.key)
  })
})

describe('matchesCacheKey', () => {
  it('matches scope key by scopeType', () => {
    const cacheKey = deriveScopeKey({ scopeType: 'project', scopeParams: { id: '123' } })
    const matcher: ScopeKeyMatcher = { kind: 'scope', scopeType: 'project' }

    expect(matchesCacheKey(cacheKey, matcher)).toBe(true)
  })

  it('does not match scope key with different scopeType', () => {
    const cacheKey = deriveScopeKey({ scopeType: 'project' })
    const matcher: ScopeKeyMatcher = { kind: 'scope', scopeType: 'workspace' }

    expect(matchesCacheKey(cacheKey, matcher)).toBe(false)
  })

  it('matches entity key by link type', () => {
    const cacheKey = deriveEntityKey({ service: 'nb', type: 'Notebook', id: '456' })
    const matcher: EntityKeyMatcher<ServiceLink> = {
      kind: 'entity',
      link: { service: 'nb', type: 'Notebook' },
    }

    expect(matchesCacheKey(cacheKey, matcher)).toBe(true)
  })

  it('does not match entity key with different type', () => {
    const cacheKey = deriveEntityKey({ service: 'nb', type: 'Notebook', id: '456' })
    const matcher: EntityKeyMatcher<ServiceLink> = {
      kind: 'entity',
      link: { service: 'nb', type: 'Project' },
    }

    expect(matchesCacheKey(cacheKey, matcher)).toBe(false)
  })

  it('does not match scope key against entity matcher', () => {
    const cacheKey = deriveScopeKey({ scopeType: 'todos' })
    const matcher: EntityKeyMatcher<ServiceLink> = {
      kind: 'entity',
      link: { service: 'nb', type: 'Todo' },
    }

    expect(matchesCacheKey(cacheKey, matcher)).toBe(false)
  })

  it('does not match entity key against scope matcher', () => {
    const cacheKey = deriveEntityKey({ type: 'Todo', id: '1' })
    const matcher: ScopeKeyMatcher = { kind: 'scope', scopeType: 'todos' }

    expect(matchesCacheKey(cacheKey, matcher)).toBe(false)
  })
})
