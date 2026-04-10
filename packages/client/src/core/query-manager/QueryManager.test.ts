/**
 * Unit tests for QueryManager.
 */

import { ServiceLink } from '@meticoeus/ddd-es'
import { firstValueFrom, timeout } from 'rxjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryStorage } from '../../storage/InMemoryStorage.js'
import { createTestWriteQueue } from '../../testing/createTestWriteQueue.js'
import { EnqueueCommand } from '../../types/index.js'
import { deriveScopeKey } from '../cache-manager/CacheKey.js'
import { CacheManager } from '../cache-manager/CacheManager.js'
import { EventBus } from '../events/EventBus.js'
import { ReadModelStore } from '../read-model-store/ReadModelStore.js'
import { QueryManager } from './QueryManager.js'
import { QueryManagerFacade } from './QueryManagerFacade.js'
import type { CollectionSignal } from './types.js'

const WINDOW_ID = 'test-window'

interface Todo {
  id: string
  title: string
  done: boolean
}

const TODOS_CACHE_KEY = deriveScopeKey({ scopeType: 'todos' })

describe('QueryManager', () => {
  let cleanup: (() => void)[] = []

  afterEach(() => {
    for (const fn of cleanup) fn()
    cleanup = []
  })

  let storage: InMemoryStorage<ServiceLink, EnqueueCommand>
  let eventBus: EventBus<ServiceLink>
  let cacheManager: CacheManager<ServiceLink, EnqueueCommand>
  let readModelStore: ReadModelStore<ServiceLink, EnqueueCommand>
  let queryManager: QueryManager<ServiceLink, EnqueueCommand>
  let facade: QueryManagerFacade<ServiceLink>
  beforeEach(async () => {
    storage = new InMemoryStorage()
    await storage.initialize()
    eventBus = new EventBus()
    const writeQueue = createTestWriteQueue(eventBus, cleanup, ['flush-cache-keys'])
    cacheManager = new CacheManager(storage, eventBus)
    cacheManager.setWriteQueue(writeQueue)
    readModelStore = new ReadModelStore(storage)
    queryManager = new QueryManager(eventBus, cacheManager, readModelStore)
    cleanup.push(() => queryManager.destroy())
    facade = new QueryManagerFacade(queryManager, WINDOW_ID)

    // Add some test data — cacheKey must match what QueryManager derives for 'todos'
    const todosCacheKey = deriveScopeKey({ scopeType: 'todos' }).key
    await storage.saveReadModel({
      id: 'todo-1',
      collection: 'todos',
      cacheKeys: [todosCacheKey],
      serverData: JSON.stringify({ id: 'todo-1', title: 'First', done: false }),
      effectiveData: JSON.stringify({ id: 'todo-1', title: 'First', done: false }),
      hasLocalChanges: false,
      updatedAt: 1000,
      revision: null,
      position: null,
      _clientMetadata: null,
    })
    await storage.saveReadModel({
      id: 'todo-2',
      collection: 'todos',
      cacheKeys: [todosCacheKey],
      serverData: JSON.stringify({ id: 'todo-2', title: 'Second', done: true }),
      effectiveData: JSON.stringify({ id: 'todo-2', title: 'Second Modified', done: true }),
      hasLocalChanges: true,
      updatedAt: 2000,
      revision: null,
      position: null,
      _clientMetadata: null,
    })
  })

  describe('getById', () => {
    it('returns entity with data', async () => {
      const result = await queryManager.getById<Todo>({
        collection: 'todos',
        id: 'todo-1',
        cacheKey: TODOS_CACHE_KEY,
      })

      expect(result.data).toMatchObject({ id: 'todo-1', title: 'First' })
      expect(result.hasLocalChanges).toBe(false)
      expect(result.cacheKey).toBeDefined()
    })

    it('returns null for non-existent entity', async () => {
      const result = await queryManager.getById<Todo>({
        collection: 'todos',
        id: 'non-existent',
        cacheKey: TODOS_CACHE_KEY,
      })

      expect(result.data).toBeUndefined()
      expect(result.hasLocalChanges).toBe(false)
    })

    it('creates cache key on access', async () => {
      const result = await queryManager.getById<Todo>({
        collection: 'todos',
        id: 'todo-1',
        cacheKey: TODOS_CACHE_KEY,
      })

      const cacheKeyExists = await cacheManager.exists(result.cacheKey.key)
      expect(cacheKeyExists).toBe(true)
    })
  })

  describe('getByIds', () => {
    it('returns map of found entities', async () => {
      const results = await queryManager.getByIds<Todo>({
        collection: 'todos',
        ids: ['todo-1', 'todo-2', 'todo-3'],
        cacheKey: TODOS_CACHE_KEY,
      })

      expect(results.size).toBe(3)
      expect(results.get('todo-1')?.data?.title).toBe('First')
      expect(results.get('todo-2')?.data?.title).toBe('Second Modified')
      expect(results.get('todo-3')?.data).toBeUndefined()
    })
  })

  describe('list', () => {
    it('returns all entities in collection', async () => {
      const result = await queryManager.list<Todo>({
        collection: 'todos',
        cacheKey: TODOS_CACHE_KEY,
      })

      expect(result.data).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(result.hasLocalChanges).toBe(true) // todo-2 has local changes
    })

    it('applies pagination', async () => {
      const result = await queryManager.list<Todo>({
        collection: 'todos',
        cacheKey: TODOS_CACHE_KEY,
        limit: 1,
        offset: 1,
      })

      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(2)
    })

    it('filters by cacheKey when provided', async () => {
      // Add a record under a different cache key
      const otherKey = deriveScopeKey({ scopeType: 'todos', scopeParams: { filter: 'done' } })
      await storage.saveReadModel({
        id: 'todo-done',
        collection: 'todos',
        cacheKeys: [otherKey.key],
        serverData: JSON.stringify({ id: 'todo-done', title: 'Done', done: true }),
        effectiveData: JSON.stringify({ id: 'todo-done', title: 'Done', done: true }),
        hasLocalChanges: false,
        updatedAt: 3000,
        revision: null,
        position: null,
        _clientMetadata: null,
      })

      // List with the other cache key — should only return its record
      const result = await queryManager.list<Todo>({
        collection: 'todos',
        cacheKey: otherKey,
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0]?.id).toBe('todo-done')
    })
  })

  describe('exists', () => {
    it('returns true for existing entity', async () => {
      expect(await queryManager.exists('todos', 'todo-1')).toBe(true)
    })

    it('returns false for non-existing entity', async () => {
      expect(await queryManager.exists('todos', 'non-existent')).toBe(false)
    })
  })

  describe('count', () => {
    it('returns correct count', async () => {
      expect(await queryManager.count('todos')).toBe(2)
      expect(await queryManager.count('users')).toBe(0)
    })
  })

  describe('watchCollection', () => {
    it('emits updated signal when collection is updated', async () => {
      const signals: CollectionSignal[] = []

      queryManager.watchCollection('todos').subscribe((signal) => {
        signals.push(signal)
      })

      eventBus.emit('readmodel:updated', { collection: 'todos', ids: ['todo-1'] })

      await new Promise((r) => setTimeout(r, 10))

      expect(signals).toHaveLength(1)
      expect(signals[0]).toEqual({ type: 'updated', ids: ['todo-1'] })
    })

    it('filters to specific collection', async () => {
      const signals: CollectionSignal[] = []

      queryManager.watchCollection('todos').subscribe((signal) => {
        signals.push(signal)
      })

      eventBus.emit('readmodel:updated', { collection: 'users', ids: ['user-1'] })
      eventBus.emit('readmodel:updated', { collection: 'todos', ids: ['todo-1'] })

      await new Promise((r) => setTimeout(r, 10))

      expect(signals).toHaveLength(1)
    })

    it('emits seed-completed signal', async () => {
      const signals: CollectionSignal[] = []

      queryManager.watchCollection('todos').subscribe((signal) => {
        signals.push(signal)
      })

      eventBus.emit('sync:seed-completed', {
        collection: 'todos',
        cacheKey: deriveScopeKey({ scopeType: 'todos' }),
        recordCount: 5,
      })

      await new Promise((r) => setTimeout(r, 10))

      expect(signals).toHaveLength(1)
      expect(signals[0]).toEqual({ type: 'seed-completed', recordCount: 5 })
    })

    it('emits sync-failed signal', async () => {
      const signals: CollectionSignal[] = []

      queryManager.watchCollection('todos').subscribe((signal) => {
        signals.push(signal)
      })

      eventBus.emit('sync:failed', { collection: 'todos', error: 'Network error' })

      await new Promise((r) => setTimeout(r, 10))

      expect(signals).toHaveLength(1)
      expect(signals[0]).toEqual({ type: 'sync-failed', error: 'Network error' })
    })
  })

  describe('watchById', () => {
    it('emits initial value', async () => {
      const observable = queryManager.watchById<Todo>({
        collection: 'todos',
        id: 'todo-1',
        cacheKey: TODOS_CACHE_KEY,
      })
      const value = await firstValueFrom(observable.pipe(timeout(100)))

      expect(value).toMatchObject({ id: 'todo-1', title: 'First' })
    })

    it('emits updated value when entity changes', async () => {
      const values: (Todo | undefined)[] = []

      queryManager
        .watchById<Todo>({
          collection: 'todos',
          id: 'todo-1',
          cacheKey: TODOS_CACHE_KEY,
        })
        .subscribe((v) => {
          values.push(v)
        })

      // Wait for initial value
      await new Promise((r) => setTimeout(r, 10))

      // Update the entity
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKeys: ['cache-1'],
        serverData: JSON.stringify({ id: 'todo-1', title: 'Updated', done: false }),
        effectiveData: JSON.stringify({ id: 'todo-1', title: 'Updated', done: false }),
        hasLocalChanges: false,
        updatedAt: 3000,
        revision: null,
        position: null,
        _clientMetadata: null,
      })

      // Emit update notification
      eventBus.emit('readmodel:updated', { collection: 'todos', ids: ['todo-1'] })

      await new Promise((r) => setTimeout(r, 10))

      expect(values.length).toBeGreaterThanOrEqual(2)
      expect(values[values.length - 1]?.title).toBe('Updated')
    })

    it('delivers the latest read when rapid updates cause out-of-order resolution', async () => {
      const values: (Todo | undefined)[] = []

      // Control resolution order of getById calls.
      // We'll make the first update's read resolve AFTER the second update's read,
      // simulating the stale-read race.
      let callCount = 0
      const originalGetById = readModelStore.getById.bind(readModelStore)
      let resolveSlowCall: (() => void) | undefined

      vi.spyOn(readModelStore, 'getById').mockImplementation(async (collection, id) => {
        callCount++
        const currentCall = callCount
        const result = await originalGetById(collection, id)

        // Make the 2nd call (first update read) slow — it resolves after the 3rd call
        if (currentCall === 2) {
          await new Promise<void>((resolve) => {
            resolveSlowCall = resolve
          })
        }

        return result
      })

      queryManager
        .watchById<Todo>({
          collection: 'todos',
          id: 'todo-1',
          cacheKey: TODOS_CACHE_KEY,
        })
        .subscribe((v) => {
          values.push(v)
        })

      // Wait for initial load (call 1)
      await new Promise((r) => setTimeout(r, 10))
      expect(values).toHaveLength(1)

      // First update — will trigger call 2 (slow)
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKeys: ['cache-1'],
        serverData: JSON.stringify({ id: 'todo-1', title: 'Stale', done: false }),
        effectiveData: JSON.stringify({ id: 'todo-1', title: 'Stale', done: false }),
        hasLocalChanges: false,
        updatedAt: 3000,
        revision: null,
        position: null,
        _clientMetadata: null,
      })
      eventBus.emit('readmodel:updated', { collection: 'todos', ids: ['todo-1'] })

      // Second update — triggers call 3 (fast, resolves before call 2)
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKeys: ['cache-1'],
        serverData: JSON.stringify({ id: 'todo-1', title: 'Latest', done: false }),
        effectiveData: JSON.stringify({ id: 'todo-1', title: 'Latest', done: false }),
        hasLocalChanges: false,
        updatedAt: 4000,
        revision: null,
        position: null,
        _clientMetadata: null,
      })
      eventBus.emit('readmodel:updated', { collection: 'todos', ids: ['todo-1'] })

      // Let the fast call (3) resolve
      await new Promise((r) => setTimeout(r, 10))

      // Now let the slow call (2) resolve — switchMap should have cancelled it
      resolveSlowCall!()
      await new Promise((r) => setTimeout(r, 10))

      // The final value must be "Latest", not "Stale"
      const lastValue = values[values.length - 1]
      expect(lastValue?.title).toBe('Latest')

      // "Stale" should never appear in the emitted values
      expect(values.every((v) => v?.title !== 'Stale')).toBe(true)
    })

    it('does not call getById after unsubscribe', async () => {
      const getByIdSpy = vi.spyOn(readModelStore, 'getById')

      const sub = queryManager
        .watchById<Todo>({
          collection: 'todos',
          id: 'todo-1',
          cacheKey: TODOS_CACHE_KEY,
        })
        .subscribe(() => {})

      // Wait for initial load
      await new Promise((r) => setTimeout(r, 10))

      const callCountBeforeUnsub = getByIdSpy.mock.calls.length

      // Unsubscribe
      sub.unsubscribe()

      // Emit update after unsubscribe
      eventBus.emit('readmodel:updated', { collection: 'todos', ids: ['todo-1'] })

      await new Promise((r) => setTimeout(r, 10))

      // getById should NOT have been called again after unsubscribe
      expect(getByIdSpy.mock.calls.length).toBe(callCountBeforeUnsub)
    })
  })

  describe('hold/release', () => {
    it('holds a cache key', async () => {
      const result = await queryManager.getById<Todo>({
        collection: 'todos',
        id: 'todo-1',
        cacheKey: TODOS_CACHE_KEY,
      })
      await facade.hold(result.cacheKey.key)

      const cacheKey = await cacheManager.get(result.cacheKey.key)
      expect(cacheKey?.holdCount).toBe(1)
    })

    it('releases a cache key', async () => {
      const result = await queryManager.getById<Todo>({
        collection: 'todos',
        id: 'todo-1',
        cacheKey: TODOS_CACHE_KEY,
      })
      await facade.hold(result.cacheKey.key)
      await facade.release(result.cacheKey.key)

      const cacheKey = await cacheManager.get(result.cacheKey.key)
      expect(cacheKey?.holdCount).toBe(0)
    })

    it('tracks multiple holds', async () => {
      const result = await queryManager.getById<Todo>({
        collection: 'todos',
        id: 'todo-1',
        cacheKey: TODOS_CACHE_KEY,
      })
      await facade.hold(result.cacheKey.key)
      await facade.hold(result.cacheKey.key)
      await facade.release(result.cacheKey.key)

      const cacheKey = await cacheManager.get(result.cacheKey.key)
      expect(cacheKey?.holdCount).toBe(1)
    })

    it('releases all holds on destroy', async () => {
      const result = await queryManager.getById<Todo>({
        collection: 'todos',
        id: 'todo-1',
        cacheKey: TODOS_CACHE_KEY,
      })
      await facade.hold(result.cacheKey.key)
      await facade.hold(result.cacheKey.key)

      await facade.releaseAll()

      const cacheKey = await cacheManager.get(result.cacheKey.key)
      expect(cacheKey?.holdCount).toBe(0)
    })
  })

  describe('onSessionDestroyed', () => {
    it('clears all active holds without calling cacheManager.release()', async () => {
      const result = await queryManager.getById<Todo>({
        collection: 'todos',
        id: 'todo-1',
        cacheKey: TODOS_CACHE_KEY,
      })
      await facade.hold(result.cacheKey.key)
      await facade.hold(result.cacheKey.key) // refcount = 2 internally

      queryManager.onSessionDestroyed()

      // Internal tracking was cleared — release should be a no-op (no error, no call to cacheManager)
      await facade.release(result.cacheKey.key) // no-op since activeHolds was cleared

      // Hold count in storage should still be 1 (we didn't call cacheManager.release)
      const cacheKey = await cacheManager.get(result.cacheKey.key)
      expect(cacheKey?.holdCount).toBe(1)
    })
  })

  describe('releaseForCacheKey', () => {
    it('removes hold tracking for an evicted cache key', async () => {
      const result = await queryManager.getById<Todo>({
        collection: 'todos',
        id: 'todo-1',
        cacheKey: TODOS_CACHE_KEY,
      })
      await facade.hold(result.cacheKey.key)
      await facade.hold(result.cacheKey.key)

      queryManager.releaseForCacheKey(result.cacheKey.key)

      // Hold count in storage is unchanged (key was evicted, no release call)
      const cacheKey = await cacheManager.get(result.cacheKey.key)
      expect(cacheKey?.holdCount).toBe(1)
    })
  })
})
