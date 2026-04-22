/**
 * Unit tests for CacheManager.
 */

import { ServiceLink } from '@meticoeus/ddd-es'
import { afterEach, describe, expect, it } from 'vitest'
import { InMemoryStorage } from '../../storage/InMemoryStorage.js'
import { createTestWriteQueue } from '../../testing/createTestWriteQueue.js'
import { deriveEntityKey } from '../../testing/fixtures/cacheKey.js'
import { EnqueueCommand } from '../../types/index.js'
import { EventBus } from '../events/EventBus.js'
import { WriteQueue } from '../write-queue/WriteQueue.js'
import {
  deriveScopeKey,
  matchesCacheKey,
  type EntityKeyMatcher,
  type ScopeKeyMatcher,
} from './CacheKey.js'
import { CacheManager, type CacheManagerConfig } from './CacheManager.js'
import { CacheManagerFacade } from './CacheManagerFacade.js'

const WINDOW_ID = 'window-1'

describe('CacheManager', () => {
  let cleanup: (() => void)[] = []

  afterEach(() => {
    for (const fn of cleanup) fn()
    cleanup = []
  })

  async function bootstrap(params: { cacheManagerConfig?: CacheManagerConfig } = {}) {
    const storage = new InMemoryStorage<ServiceLink, EnqueueCommand>()
    await storage.initialize()
    const eventBus = new EventBus<ServiceLink>()
    const writeQueue = createTestWriteQueue(eventBus, cleanup, ['flush-cache-keys'])
    const cacheManager = new CacheManager<ServiceLink, EnqueueCommand>(
      eventBus,
      storage,
      params.cacheManagerConfig ?? { cacheConfig: { maxCacheKeys: 10, defaultTtl: 60000 } },
    )
    cacheManager.setWriteQueue(writeQueue)
    cacheManager.registerWindow(WINDOW_ID)
    const facade = new CacheManagerFacade<ServiceLink>(cacheManager, WINDOW_ID)
    return { cacheManager, facade, eventBus, storage, writeQueue }
  }

  /** Wait for the write queue to drain all pending ops. */
  async function drain(
    writeQueue: WriteQueue<ServiceLink, EnqueueCommand>,
    timeoutMs = 1000,
  ): Promise<void> {
    const start = Date.now()
    while (true) {
      const state = writeQueue.getDebugState()
      if (state.status === 'idle' && state.pendingCount === 0) return
      if (Date.now() - start > timeoutMs) {
        throw new Error(
          `Write queue did not drain within ${timeoutMs}ms (status: ${state.status}, pending: ${state.pendingCount})`,
        )
      }
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }

  describe('acquire', () => {
    it('creates a new cache key', async () => {
      const { cacheManager } = await bootstrap()
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))

      expect(key).toBeDefined()
      expect(await cacheManager.exists(key)).toBe(true)
    })

    it('returns deterministic key for same collection', async () => {
      const { cacheManager } = await bootstrap()
      const key1 = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))
      const key2 = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))

      expect(key1).toBe(key2)
    })

    it('returns different keys for different params', async () => {
      const { cacheManager } = await bootstrap()
      const key1 = await cacheManager.acquire(
        deriveScopeKey({ scopeType: 'todos', scopeParams: { status: 'active' } }),
      )
      const key2 = await cacheManager.acquire(
        deriveScopeKey({ scopeType: 'todos', scopeParams: { status: 'completed' } }),
      )

      expect(key1).not.toBe(key2)
    })

    it('returns same key for same params in different order', async () => {
      const { cacheManager } = await bootstrap()
      const key1 = await cacheManager.acquire(
        deriveScopeKey({ scopeType: 'todos', scopeParams: { a: 1, b: 2 } }),
      )
      const key2 = await cacheManager.acquire(
        deriveScopeKey({ scopeType: 'todos', scopeParams: { b: 2, a: 1 } }),
      )

      expect(key1).toBe(key2)
    })

    it('places a hold when requested', async () => {
      const { facade, storage, writeQueue } = await bootstrap()
      const key = await facade.acquire(deriveScopeKey({ scopeType: 'todos' }), { hold: true })
      await drain(writeQueue)

      const record = await storage.getCacheKey(key)
      expect(record?.holdCount).toBe(1)
    })

    it('does not increment hold count on re-acquire with hold (idempotent per window)', async () => {
      const { facade, storage, writeQueue } = await bootstrap()
      const key = await facade.acquire(deriveScopeKey({ scopeType: 'todos' }), { hold: true })
      await facade.acquire(deriveScopeKey({ scopeType: 'todos' }), { hold: true })
      await drain(writeQueue)

      const record = await storage.getCacheKey(key)
      // Same windowId → idempotent, holdCount stays at 1
      expect(record?.holdCount).toBe(1)
    })

    it('uses provided TTL', async () => {
      const { cacheManager, storage, writeQueue } = await bootstrap()
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }), { ttl: 1000 })
      await drain(writeQueue)

      const record = await storage.getCacheKey(key)
      expect(record?.expiresAt).toBeDefined()
      expect(record!.expiresAt! - record!.createdAt).toBe(1000)
    })

    it('creates scoped cache key', async () => {
      const { cacheManager } = await bootstrap()
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
      const { cacheManager, storage, writeQueue } = await bootstrap()
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))
      await drain(writeQueue)

      const record = await storage.getCacheKey(key)
      expect(record?.evictionPolicy).toBe('persistent')
    })

    it('stores ephemeral policy on record', async () => {
      const { cacheManager, storage, writeQueue } = await bootstrap()
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }), {
        evictionPolicy: 'ephemeral',
      })
      await drain(writeQueue)

      const record = await storage.getCacheKey(key)
      expect(record?.evictionPolicy).toBe('ephemeral')
    })

    it('does not change evictionPolicy on re-acquire', async () => {
      const { cacheManager, storage, writeQueue } = await bootstrap()
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }), {
        evictionPolicy: 'ephemeral',
      })
      await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }), {
        evictionPolicy: 'persistent',
      })
      await drain(writeQueue)

      const record = await storage.getCacheKey(key)
      expect(record?.evictionPolicy).toBe('ephemeral')
    })

    it('freeze is a no-op for ephemeral keys', async () => {
      const { cacheManager, writeQueue } = await bootstrap()
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }), {
        evictionPolicy: 'ephemeral',
      })
      await drain(writeQueue)

      await cacheManager.freeze(key)

      expect(await cacheManager.isFrozen(key)).toBe(false)
    })

    it('maybeEvict prioritizes ephemeral keys before persistent', async () => {
      const { cacheManager, writeQueue } = await bootstrap({
        cacheManagerConfig: { cacheConfig: { maxCacheKeys: 3, defaultTtl: 60000 } },
      })

      // Create persistent key first (oldest)
      await cacheManager.acquire(deriveScopeKey({ scopeType: 'persistent-collection' }))
      await drain(writeQueue)
      await new Promise((r) => setTimeout(r, 10))

      // Create ephemeral key second (newer)
      await cacheManager.acquire(deriveScopeKey({ scopeType: 'ephemeral-collection' }), {
        evictionPolicy: 'ephemeral',
      })
      await drain(writeQueue)
      await new Promise((r) => setTimeout(r, 10))

      // Create third persistent key
      await cacheManager.acquire(deriveScopeKey({ scopeType: 'persistent-2' }))
      await drain(writeQueue)
      await new Promise((r) => setTimeout(r, 10))

      // Add 4th — should evict ephemeral key first despite it being newer
      await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-4' }))
      await drain(writeQueue)

      const ephemeralKey = deriveScopeKey({ scopeType: 'ephemeral-collection' }).key
      const persistentKey = deriveScopeKey({ scopeType: 'persistent-collection' }).key

      expect(await cacheManager.exists(ephemeralKey)).toBe(false) // Evicted (ephemeral priority)
      expect(await cacheManager.exists(persistentKey)).toBe(true) // Kept (persistent)
    })
  })

  describe('per-window holds', () => {
    it('hold adds windowId to tracking, storage holdCount becomes 1', async () => {
      const { facade, storage, writeQueue } = await bootstrap()
      const key = await facade.acquire(deriveScopeKey({ scopeType: 'todos' }))
      await drain(writeQueue)

      await facade.hold(key)
      await drain(writeQueue)

      const record = await storage.getCacheKey(key)
      expect(record?.holdCount).toBe(1)
    })

    it('second hold with same windowId is idempotent', async () => {
      const { facade, storage, writeQueue } = await bootstrap()
      const key = await facade.acquire(deriveScopeKey({ scopeType: 'todos' }))
      await drain(writeQueue)

      await facade.hold(key)
      await facade.hold(key)
      await drain(writeQueue)

      const record = await storage.getCacheKey(key)
      // Same windowId → idempotent, holdCount stays at 1
      expect(record?.holdCount).toBe(1)
    })

    it('hold with different windowId — two facades share one CacheManager', async () => {
      const { cacheManager, storage, writeQueue } = await bootstrap()
      const facade2 = new CacheManagerFacade<ServiceLink>(cacheManager, 'window-2')
      cacheManager.registerWindow('window-2')

      const key = await cacheManager.acquireKey(deriveScopeKey({ scopeType: 'todos' }))
      await drain(writeQueue)

      // Two facades hold the same key from different windows
      await cacheManager.holdForWindow(key.key, WINDOW_ID)
      await facade2.hold(key.key)
      await drain(writeQueue)

      const record = await storage.getCacheKey(key.key)
      expect(record?.holdCount).toBe(2)
    })

    it('release with one windowId remaining keeps key held', async () => {
      const { cacheManager, writeQueue } = await bootstrap()
      const facade2 = new CacheManagerFacade<ServiceLink>(cacheManager, 'window-2')
      cacheManager.registerWindow('window-2')

      const key = await cacheManager.acquireKey(deriveScopeKey({ scopeType: 'todos' }))
      await drain(writeQueue)

      // Both windows hold
      await cacheManager.holdForWindow(key.key, WINDOW_ID)
      await facade2.hold(key.key)
      await drain(writeQueue)

      // Release one window — key still held by the other
      await facade2.release(key.key)
      await drain(writeQueue)

      const record = await cacheManager.get(key.key)
      expect(record?.holdCount).toBe(1)
    })

    it('release last windowId drops storage holdCount to 0', async () => {
      const { facade, storage, writeQueue } = await bootstrap()
      const key = await facade.acquire(deriveScopeKey({ scopeType: 'todos' }))
      await drain(writeQueue)

      await facade.hold(key)
      await drain(writeQueue)

      await facade.release(key)
      await drain(writeQueue)

      const record = await storage.getCacheKey(key)
      expect(record?.holdCount).toBe(0)
    })

    it('ephemeral key auto-evicted when last window releases', async () => {
      const { facade, cacheManager } = await bootstrap()
      const key = await facade.acquire(deriveScopeKey({ scopeType: 'todos' }), {
        evictionPolicy: 'ephemeral',
        hold: true,
      })

      expect(await cacheManager.exists(key)).toBe(true)

      await facade.release(key)

      expect(await cacheManager.exists(key)).toBe(false)
    })

    it('releaseAllForWindow cleans up all keys for that window', async () => {
      const { facade, cacheManager, storage, writeQueue } = await bootstrap()
      const key1 = await facade.acquire(deriveScopeKey({ scopeType: 'collection-1' }))
      const key2 = await facade.acquire(deriveScopeKey({ scopeType: 'collection-2' }))
      await drain(writeQueue)

      await facade.hold(key1)
      await facade.hold(key2)
      await drain(writeQueue)

      await cacheManager.releaseAllForWindow(WINDOW_ID)
      await drain(writeQueue)

      const record1 = await storage.getCacheKey(key1)
      const record2 = await storage.getCacheKey(key2)
      expect(record1?.holdCount).toBe(0)
      expect(record2?.holdCount).toBe(0)
    })
  })

  describe('initialize', () => {
    it('resets all holdCounts to 0', async () => {
      const { facade, eventBus, storage, writeQueue } = await bootstrap()
      const key = await facade.acquire(deriveScopeKey({ scopeType: 'todos' }), { hold: true })
      await drain(writeQueue)

      const recordBefore = await storage.getCacheKey(key)
      expect(recordBefore?.holdCount).toBe(1)

      // Create a fresh CacheManager and initialize
      const freshManager = new CacheManager<ServiceLink, EnqueueCommand>(eventBus, storage, {
        cacheConfig: { maxCacheKeys: 10, defaultTtl: 60000 },
      })
      await freshManager.initialize()

      const recordAfter = await storage.getCacheKey(key)
      expect(recordAfter?.holdCount).toBe(0)
    })

    it('evicts all ephemeral keys (persistent keys survive)', async () => {
      const { cacheManager, eventBus, storage, writeQueue } = await bootstrap()
      const persistentKey = await cacheManager.acquire(deriveScopeKey({ scopeType: 'persistent' }))
      const ephemeralKey = await cacheManager.acquire(deriveScopeKey({ scopeType: 'ephemeral' }), {
        evictionPolicy: 'ephemeral',
      })
      await drain(writeQueue)

      // Create a fresh CacheManager and initialize
      const freshManager = new CacheManager<ServiceLink, EnqueueCommand>(eventBus, storage, {
        cacheConfig: { maxCacheKeys: 10, defaultTtl: 60000 },
      })
      await freshManager.initialize()

      expect(await freshManager.exists(persistentKey)).toBe(true)
      expect(await freshManager.exists(ephemeralKey)).toBe(false)
    })

    it('emits cache:evicted for each ephemeral key', async () => {
      const { cacheManager, eventBus, storage, writeQueue } = await bootstrap()
      const cacheKey = deriveScopeKey({ scopeType: 'ephemeral' })
      await cacheManager.acquire(cacheKey, { evictionPolicy: 'ephemeral' })
      await drain(writeQueue)

      const events: unknown[] = []
      eventBus.on('cache:evicted').subscribe((e) => events.push(e))

      const freshManager = new CacheManager<ServiceLink, EnqueueCommand>(eventBus, storage, {
        cacheConfig: { maxCacheKeys: 10, defaultTtl: 60000 },
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
    it('registerWindow succeeds up to maxWindows', async () => {
      const { eventBus, storage } = await bootstrap()
      const cacheManager = new CacheManager<ServiceLink, EnqueueCommand>(eventBus, storage, {
        cacheConfig: { maxCacheKeys: 10, defaultTtl: 60000, maxWindows: 2 },
      })

      // w-1 is not auto-registered until initialize() is called
      expect(cacheManager.registerWindow('w-1')).toBe(true)
      expect(cacheManager.registerWindow('w-2')).toBe(true)
    })

    it('registerWindow at capacity returns false and emits event', async () => {
      const { eventBus, storage } = await bootstrap()
      const cacheManager = new CacheManager<ServiceLink, EnqueueCommand>(eventBus, storage, {
        cacheConfig: { maxCacheKeys: 10, defaultTtl: 60000, maxWindows: 2 },
      })

      const events: unknown[] = []
      eventBus.on('cache:too-many-windows').subscribe((e) => events.push(e))

      cacheManager.registerWindow('w-1')
      cacheManager.registerWindow('w-2')
      const result = cacheManager.registerWindow('w-3')

      expect(result).toBe(false)
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        data: { windowId: 'w-3', maxWindows: 2 },
      })
    })

    it('unregisterWindow releases holds and allows new registration', async () => {
      const { eventBus, storage } = await bootstrap()
      const cacheManager = new CacheManager<ServiceLink, EnqueueCommand>(eventBus, storage, {
        cacheConfig: { maxCacheKeys: 10, defaultTtl: 60000, maxWindows: 2 },
      })

      cacheManager.registerWindow('w-1')
      cacheManager.registerWindow('w-2')

      await cacheManager.unregisterWindow('w-2')

      expect(cacheManager.registerWindow('w-3')).toBe(true)
    })
  })

  describe('session mismatch', () => {
    it('returns false with no session', async () => {
      const { cacheManager } = await bootstrap()
      const result = await cacheManager.checkSessionUser('user-1')
      expect(result).toBe(false)
    })

    it('returns false with matching user', async () => {
      const { cacheManager, storage } = await bootstrap()
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
      const { cacheManager, eventBus, storage, writeQueue } = await bootstrap()
      await storage.saveSession({
        id: 1,
        userId: 'user-1',
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
      })

      await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-1' }))
      await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-2' }))
      await drain(writeQueue)

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
      const { cacheManager, facade, storage, writeQueue } = await bootstrap()
      await storage.saveSession({
        id: 1,
        userId: 'user-1',
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
      })

      const key = await facade.acquire(deriveScopeKey({ scopeType: 'todos' }), {
        hold: true,
      })
      await drain(writeQueue)
      expect(await cacheManager.exists(key)).toBe(true)

      await cacheManager.checkSessionUser('user-2')

      // Cache was wiped — key should no longer exist
      expect(await cacheManager.exists(key)).toBe(false)
      expect(await cacheManager.getCount()).toBe(0)
    })
  })

  describe('hold/release', () => {
    it('holds a cache key', async () => {
      const { cacheManager, facade, storage, writeQueue } = await bootstrap()
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))
      await drain(writeQueue)

      await facade.hold(key)
      await drain(writeQueue)

      const record = await storage.getCacheKey(key)
      expect(record?.holdCount).toBe(1)
    })

    it('releases a cache key', async () => {
      const { facade, storage, writeQueue } = await bootstrap()
      const key = await facade.acquire(deriveScopeKey({ scopeType: 'todos' }), {
        hold: true,
      })
      await drain(writeQueue)

      await facade.release(key)
      await drain(writeQueue)

      const record = await storage.getCacheKey(key)
      expect(record?.holdCount).toBe(0)
    })
  })

  describe('freeze/unfreeze', () => {
    it('freezes a cache key', async () => {
      const { cacheManager, writeQueue } = await bootstrap()
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))
      await drain(writeQueue)

      await cacheManager.freeze(key)

      expect(await cacheManager.isFrozen(key)).toBe(true)
    })

    it('unfreezes a cache key', async () => {
      const { cacheManager, writeQueue } = await bootstrap()
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))
      await drain(writeQueue)

      await cacheManager.freeze(key)

      await cacheManager.unfreeze(key)

      expect(await cacheManager.isFrozen(key)).toBe(false)
    })
  })

  describe('evict', () => {
    it('evicts an unheld, unfrozen cache key', async () => {
      const { cacheManager, writeQueue } = await bootstrap()
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))
      await drain(writeQueue)

      const evicted = await cacheManager.evict(key)

      expect(evicted).toBe(true)
      expect(await cacheManager.exists(key)).toBe(false)
    })

    it('does not evict a held cache key', async () => {
      const { cacheManager, facade, writeQueue } = await bootstrap()
      const key = await facade.acquire(deriveScopeKey({ scopeType: 'todos' }), {
        hold: true,
      })
      await drain(writeQueue)

      const evicted = await cacheManager.evict(key)

      expect(evicted).toBe(false)
      expect(await cacheManager.exists(key)).toBe(true)
    })

    it('does not evict a frozen cache key', async () => {
      const { cacheManager, writeQueue } = await bootstrap()
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))
      await drain(writeQueue)

      await cacheManager.freeze(key)

      const evicted = await cacheManager.evict(key)

      expect(evicted).toBe(false)
      expect(await cacheManager.exists(key)).toBe(true)
    })

    it('emits cache:evicted event', async () => {
      const { cacheManager, eventBus, writeQueue } = await bootstrap()
      const cacheKey = deriveScopeKey({ scopeType: 'todos' })
      await cacheManager.acquire(cacheKey)
      await drain(writeQueue)

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
      const { cacheManager, writeQueue } = await bootstrap({
        cacheManagerConfig: { cacheConfig: { maxCacheKeys: 3, defaultTtl: 60000 } },
      })

      // Fill up cache
      const key1 = await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-1' }))
      await drain(writeQueue)
      await new Promise((r) => setTimeout(r, 10)) // Different access times
      const key2 = await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-2' }))
      await drain(writeQueue)
      await new Promise((r) => setTimeout(r, 10))
      const key3 = await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-3' }))
      await drain(writeQueue)

      // Touch key1 to make it more recent
      await cacheManager.touch(deriveScopeKey({ scopeType: 'collection-1' }))
      await drain(writeQueue)
      await new Promise((r) => setTimeout(r, 10))

      // Add 4th key - should evict key2 (oldest access time)
      const _key4 = await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-4' }))
      await drain(writeQueue)

      expect(await cacheManager.exists(key1)).toBe(true)
      expect(await cacheManager.exists(key2)).toBe(false) // Evicted
      expect(await cacheManager.exists(key3)).toBe(true)
    })

    it('does not evict held cache keys during capacity eviction', async () => {
      const { cacheManager, facade, writeQueue } = await bootstrap({
        cacheManagerConfig: { cacheConfig: { maxCacheKeys: 2, defaultTtl: 60000 } },
      })

      const key1 = await facade.acquire(deriveScopeKey({ scopeType: 'collection-1' }), {
        hold: true,
      })
      await drain(writeQueue)
      await new Promise((r) => setTimeout(r, 10))
      const key2 = await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-2' }))
      await drain(writeQueue)
      await new Promise((r) => setTimeout(r, 10))

      // Try to add 3rd - cannot evict key1 (held), so evict key2
      const _key3 = await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-3' }))
      await drain(writeQueue)

      expect(await cacheManager.exists(key1)).toBe(true) // Held, not evicted
      expect(await cacheManager.exists(key2)).toBe(false) // Evicted
    })
  })

  describe('evictExpired', () => {
    it('evicts expired cache keys', async () => {
      const { cacheManager, writeQueue } = await bootstrap()
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }), { ttl: 1 })
      await drain(writeQueue)

      await new Promise((r) => setTimeout(r, 50)) // Wait for expiry

      const evicted = await cacheManager.evictExpired()

      expect(evicted).toBe(1)
      expect(await cacheManager.exists(key)).toBe(false)
    })

    it('does not evict non-expired cache keys', async () => {
      const { cacheManager, writeQueue } = await bootstrap()
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }), {
        ttl: 60000,
      })
      await drain(writeQueue)

      const evicted = await cacheManager.evictExpired()

      expect(evicted).toBe(0)
      expect(await cacheManager.exists(key)).toBe(true)
    })

    it('emits cache:evicted with reason expired', async () => {
      const { cacheManager, eventBus, writeQueue } = await bootstrap()
      const cacheKey = deriveScopeKey({ scopeType: 'todos' })
      await cacheManager.acquire(cacheKey, { ttl: 1 })
      await drain(writeQueue)

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
      const { cacheManager, facade, writeQueue } = await bootstrap()
      const key = await facade.acquire(deriveScopeKey({ scopeType: 'todos' }), {
        ttl: 1,
        hold: true,
      })
      await drain(writeQueue)

      await new Promise((r) => setTimeout(r, 50))

      const evicted = await cacheManager.evictExpired()

      expect(evicted).toBe(0)
      expect(await cacheManager.exists(key)).toBe(true)
    })
  })

  describe('evictAll', () => {
    it('evicts all evictable cache keys', async () => {
      const { cacheManager, facade, writeQueue } = await bootstrap()
      await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-1' }))
      await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-2' }))
      const heldKey = await facade.acquire(deriveScopeKey({ scopeType: 'collection-3' }), {
        hold: true,
      })
      await drain(writeQueue)

      const evicted = await cacheManager.evictAll()

      expect(evicted).toBe(2)
      expect(await cacheManager.exists(heldKey)).toBe(true)
    })
  })

  describe('getCount', () => {
    it('returns correct count', async () => {
      const { cacheManager, writeQueue } = await bootstrap()
      expect(await cacheManager.getCount()).toBe(0)

      await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-1' }))
      await drain(writeQueue)
      expect(await cacheManager.getCount()).toBe(1)

      await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-2' }))
      await drain(writeQueue)
      expect(await cacheManager.getCount()).toBe(2)
    })
  })

  describe('onSessionDestroyed', () => {
    it('deletes all cache keys from storage', async () => {
      const { cacheManager, writeQueue } = await bootstrap()
      await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-1' }))
      await cacheManager.acquire(deriveScopeKey({ scopeType: 'collection-2' }))
      await drain(writeQueue)
      expect(await cacheManager.getCount()).toBe(2)

      await cacheManager.onSessionDestroyed()

      expect(await cacheManager.getCount()).toBe(0)
    })

    it('clears in-memory holds and registered windows', async () => {
      const { cacheManager, facade, writeQueue } = await bootstrap()
      const key = await facade.acquire(deriveScopeKey({ scopeType: 'todos' }), {
        hold: true,
      })
      await drain(writeQueue)

      await cacheManager.onSessionDestroyed()

      // Re-create cache key — hold should start fresh (not carry over)
      const newKey = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))
      await drain(writeQueue)
      const record = await cacheManager.get(newKey)
      expect(record?.holdCount).toBe(0)
    })
  })

  describe('lifecycle events', () => {
    it('emits cache:key-added on first acquire with cacheKey', async () => {
      const { cacheManager, eventBus } = await bootstrap()
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
      const { cacheManager, eventBus } = await bootstrap()
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
      const { cacheManager, eventBus } = await bootstrap()
      const cacheKey = deriveScopeKey({ scopeType: 'todos' })
      await cacheManager.acquire(cacheKey)

      const events: unknown[] = []
      eventBus.on('cache:key-added').subscribe((e) => events.push(e))

      await cacheManager.acquire(cacheKey)

      expect(events).toHaveLength(0)
    })

    it('emits cache:key-accessed on touch of existing key', async () => {
      const { cacheManager, eventBus } = await bootstrap()
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
      const { cacheManager, eventBus } = await bootstrap()
      const cacheKey = deriveScopeKey({ scopeType: 'new-collection' })

      const addedEvents: unknown[] = []
      eventBus.on('cache:key-added').subscribe((e) => addedEvents.push(e))

      await cacheManager.touch(cacheKey)

      expect(addedEvents).toHaveLength(1)
      expect(await cacheManager.exists(cacheKey.key)).toBe(true)
    })

    it('emits cache:frozen-changed on freeze with frozenAt timestamp', async () => {
      const { cacheManager, eventBus, writeQueue } = await bootstrap()
      const cacheKey = deriveScopeKey({ scopeType: 'todos' })
      await cacheManager.acquire(cacheKey)
      await drain(writeQueue)

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
      const { cacheManager, eventBus, writeQueue } = await bootstrap()
      const cacheKey = deriveScopeKey({ scopeType: 'todos' })
      await cacheManager.acquire(cacheKey)
      await drain(writeQueue)

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
      const { cacheManager, eventBus, writeQueue } = await bootstrap()
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))
      await drain(writeQueue)

      await cacheManager.freeze(key)

      const events: unknown[] = []
      eventBus.on('cache:frozen-changed').subscribe((e) => events.push(e))

      await cacheManager.freeze(key)

      expect(events).toHaveLength(0)
    })

    it('does not emit cache:frozen-changed when unfreezing non-frozen key', async () => {
      const { cacheManager, eventBus, writeQueue } = await bootstrap()
      const key = await cacheManager.acquire(deriveScopeKey({ scopeType: 'todos' }))
      await drain(writeQueue)

      const events: unknown[] = []
      eventBus.on('cache:frozen-changed').subscribe((e) => events.push(e))

      await cacheManager.unfreeze(key)

      expect(events).toHaveLength(0)
    })
  })

  describe('hierarchical cache keys', () => {
    it('propagates inheritedFrozen to children when parent is frozen', async () => {
      const { cacheManager, writeQueue } = await bootstrap()
      const parent = deriveScopeKey({ scopeType: 'workspace' })
      const child = deriveScopeKey({ scopeType: 'todos', parentKey: parent.key })

      await cacheManager.acquireKey(parent)
      await cacheManager.acquireKey(child)
      await drain(writeQueue)

      await cacheManager.freeze(parent.key)

      const childRecord = await cacheManager.get(child.key)
      expect(childRecord?.inheritedFrozen).toBe(true)
    })

    it('clears inheritedFrozen on children when parent is unfrozen', async () => {
      const { cacheManager, writeQueue } = await bootstrap()
      const parent = deriveScopeKey({ scopeType: 'workspace' })
      const child = deriveScopeKey({ scopeType: 'todos', parentKey: parent.key })

      await cacheManager.acquireKey(parent)
      await cacheManager.acquireKey(child)
      await drain(writeQueue)

      await cacheManager.freeze(parent.key)

      await cacheManager.unfreeze(parent.key)

      const childRecord = await cacheManager.get(child.key)
      expect(childRecord?.inheritedFrozen).toBe(false)
    })

    it('propagates inheritedFrozen through multiple levels', async () => {
      const { cacheManager, writeQueue } = await bootstrap()
      const grandparent = deriveScopeKey({ scopeType: 'org' })
      const parent = deriveScopeKey({ scopeType: 'workspace', parentKey: grandparent.key })
      const child = deriveScopeKey({ scopeType: 'todos', parentKey: parent.key })

      await cacheManager.acquireKey(grandparent)
      await cacheManager.acquireKey(parent)
      await cacheManager.acquireKey(child)
      await drain(writeQueue)

      await cacheManager.freeze(grandparent.key)

      const parentRecord = await cacheManager.get(parent.key)
      const childRecord = await cacheManager.get(child.key)
      expect(parentRecord?.inheritedFrozen).toBe(true)
      expect(childRecord?.inheritedFrozen).toBe(true)
    })

    it('keeps inheritedFrozen when unfreezing middle node with frozen grandparent', async () => {
      const { cacheManager, writeQueue } = await bootstrap()
      const grandparent = deriveScopeKey({ scopeType: 'org' })
      const parent = deriveScopeKey({ scopeType: 'workspace', parentKey: grandparent.key })
      const child = deriveScopeKey({ scopeType: 'todos', parentKey: parent.key })

      await cacheManager.acquireKey(grandparent)
      await cacheManager.acquireKey(parent)
      await cacheManager.acquireKey(child)
      await drain(writeQueue)

      // Freeze both grandparent and parent
      await cacheManager.freeze(grandparent.key)
      await cacheManager.freeze(parent.key)

      // Unfreeze parent — child still inherits from grandparent
      await cacheManager.unfreeze(parent.key)

      const childRecord = await cacheManager.get(child.key)
      expect(childRecord?.inheritedFrozen).toBe(true)
    })

    it('does not evict inheritedFrozen keys', async () => {
      const { cacheManager, writeQueue } = await bootstrap()
      const parent = deriveScopeKey({ scopeType: 'workspace' })
      const child = deriveScopeKey({ scopeType: 'todos', parentKey: parent.key })

      await cacheManager.acquireKey(parent)
      await cacheManager.acquireKey(child)
      await drain(writeQueue)

      await cacheManager.freeze(parent.key)

      const evicted = await cacheManager.evict(child.key)
      expect(evicted).toBe(false)
    })

    it('cannot evict a parent while children exist', async () => {
      const { cacheManager, writeQueue } = await bootstrap()
      const parent = deriveScopeKey({ scopeType: 'workspace' })
      const child = deriveScopeKey({ scopeType: 'todos', parentKey: parent.key })

      await cacheManager.acquireKey(parent)
      await cacheManager.acquireKey(child)
      await drain(writeQueue)

      const evicted = await cacheManager.evict(parent.key)
      expect(evicted).toBe(false)
    })

    it('can evict parent after all children are evicted', async () => {
      const { cacheManager, writeQueue } = await bootstrap()
      const parent = deriveScopeKey({ scopeType: 'workspace' })
      const child = deriveScopeKey({ scopeType: 'todos', parentKey: parent.key })

      await cacheManager.acquireKey(parent)
      await cacheManager.acquireKey(child)
      await drain(writeQueue)

      await cacheManager.evict(child.key)
      const evicted = await cacheManager.evict(parent.key)
      expect(evicted).toBe(true)
    })

    it('does not propagate inheritedFrozen to ephemeral children', async () => {
      const { cacheManager, facade, writeQueue } = await bootstrap()
      const parent = deriveScopeKey({ scopeType: 'workspace' })
      const child = deriveScopeKey({ scopeType: 'temp-view', parentKey: parent.key })

      await cacheManager.acquireKey(parent)
      await facade.acquireKey(child, { evictionPolicy: 'ephemeral', hold: true })
      await drain(writeQueue)

      await cacheManager.freeze(parent.key)

      const childRecord = await cacheManager.get(child.key)
      expect(childRecord?.inheritedFrozen).toBe(false)
    })

    it('does not evict expired frozen keys', async () => {
      const { cacheManager, writeQueue } = await bootstrap()
      const cacheKey = deriveScopeKey({ scopeType: 'todos' })
      await cacheManager.acquireKey(cacheKey, { ttl: 1 })
      await drain(writeQueue)

      // Wait for TTL to expire
      await new Promise((r) => setTimeout(r, 10))

      await cacheManager.freeze(cacheKey.key)

      const count = await cacheManager.evictExpired()
      expect(count).toBe(0)
      expect(await cacheManager.exists(cacheKey.key)).toBe(true)
    })

    it('does not evict expired inheritedFrozen keys', async () => {
      const { cacheManager, writeQueue } = await bootstrap()
      const parent = deriveScopeKey({ scopeType: 'workspace' })
      const child = deriveScopeKey({ scopeType: 'todos', parentKey: parent.key })

      await cacheManager.acquireKey(parent)
      await cacheManager.acquireKey(child, { ttl: 1 })
      await drain(writeQueue)

      // Wait for TTL to expire
      await new Promise((r) => setTimeout(r, 10))

      await cacheManager.freeze(parent.key)

      const count = await cacheManager.evictExpired()
      expect(count).toBe(0)
      expect(await cacheManager.exists(child.key)).toBe(true)
    })

    it('evictAll evicts leaves before parents (bottom-up)', async () => {
      const { cacheManager, eventBus, writeQueue } = await bootstrap()
      const parent = deriveScopeKey({ scopeType: 'workspace' })
      const child = deriveScopeKey({ scopeType: 'todos', parentKey: parent.key })

      await cacheManager.acquireKey(parent)
      await cacheManager.acquireKey(child)
      await drain(writeQueue)

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
