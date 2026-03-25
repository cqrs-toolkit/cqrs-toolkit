/**
 * Unit tests for QueryManager.
 */

import { firstValueFrom, timeout } from 'rxjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryStorage } from '../../storage/InMemoryStorage.js'
import { CacheManager } from '../cache-manager/CacheManager.js'
import { EventBus } from '../events/EventBus.js'
import { ReadModelStore } from '../read-model-store/ReadModelStore.js'
import { QueryManager } from './QueryManager.js'

interface Todo {
  id: string
  title: string
  done: boolean
}

describe('QueryManager', () => {
  let storage: InMemoryStorage
  let eventBus: EventBus
  let cacheManager: CacheManager
  let readModelStore: ReadModelStore
  let queryManager: QueryManager

  beforeEach(async () => {
    storage = new InMemoryStorage()
    await storage.initialize()
    eventBus = new EventBus()
    cacheManager = new CacheManager({ storage, eventBus, windowId: 'test-window' })
    readModelStore = new ReadModelStore({ storage })
    queryManager = new QueryManager({ eventBus, cacheManager, readModelStore })

    // Add some test data
    await storage.saveReadModel({
      id: 'todo-1',
      collection: 'todos',
      cacheKey: 'cache-1',
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
      cacheKey: 'cache-1',
      serverData: JSON.stringify({ id: 'todo-2', title: 'Second', done: true }),
      effectiveData: JSON.stringify({ id: 'todo-2', title: 'Second Modified', done: true }),
      hasLocalChanges: true,
      updatedAt: 2000,
      revision: null,
      position: null,
      _clientMetadata: null,
    })
  })

  afterEach(async () => {
    await queryManager.destroy()
  })

  describe('getById', () => {
    it('returns entity with data', async () => {
      const result = await queryManager.getById<Todo>('todos', 'todo-1')

      expect(result.data).toMatchObject({ id: 'todo-1', title: 'First' })
      expect(result.hasLocalChanges).toBe(false)
      expect(result.cacheKey).toBeDefined()
    })

    it('returns null for non-existent entity', async () => {
      const result = await queryManager.getById<Todo>('todos', 'non-existent')

      expect(result.data).toBeUndefined()
      expect(result.hasLocalChanges).toBe(false)
    })

    it('creates cache key on access', async () => {
      const result = await queryManager.getById<Todo>('todos', 'todo-1')

      const cacheKeyExists = await cacheManager.exists(result.cacheKey.key)
      expect(cacheKeyExists).toBe(true)
    })
  })

  describe('getByIds', () => {
    it('returns map of found entities', async () => {
      const results = await queryManager.getByIds<Todo>('todos', ['todo-1', 'todo-2', 'todo-3'])

      expect(results.size).toBe(3)
      expect(results.get('todo-1')?.data?.title).toBe('First')
      expect(results.get('todo-2')?.data?.title).toBe('Second Modified')
      expect(results.get('todo-3')?.data).toBeUndefined()
    })
  })

  describe('list', () => {
    it('returns all entities in collection', async () => {
      const result = await queryManager.list<Todo>('todos')

      expect(result.data).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(result.hasLocalChanges).toBe(true) // todo-2 has local changes
    })

    it('applies pagination', async () => {
      const result = await queryManager.list<Todo>('todos', { limit: 1, offset: 1 })

      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(2)
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
    it('emits when collection is updated', async () => {
      const updates: string[][] = []

      queryManager.watchCollection('todos').subscribe((ids) => {
        updates.push(ids)
      })

      // Emit update event
      eventBus.emit('readmodel:updated', { collection: 'todos', ids: ['todo-1'] })

      await new Promise((r) => setTimeout(r, 10))

      expect(updates).toHaveLength(1)
      expect(updates[0]).toEqual(['todo-1'])
    })

    it('filters to specific collection', async () => {
      const updates: string[][] = []

      queryManager.watchCollection('todos').subscribe((ids) => {
        updates.push(ids)
      })

      eventBus.emit('readmodel:updated', { collection: 'users', ids: ['user-1'] })
      eventBus.emit('readmodel:updated', { collection: 'todos', ids: ['todo-1'] })

      await new Promise((r) => setTimeout(r, 10))

      expect(updates).toHaveLength(1)
    })
  })

  describe('watchById', () => {
    it('emits initial value', async () => {
      const observable = queryManager.watchById<Todo>('todos', 'todo-1')
      const value = await firstValueFrom(observable.pipe(timeout(100)))

      expect(value).toMatchObject({ id: 'todo-1', title: 'First' })
    })

    it('emits updated value when entity changes', async () => {
      const values: (Todo | undefined)[] = []

      queryManager.watchById<Todo>('todos', 'todo-1').subscribe((v) => {
        values.push(v)
      })

      // Wait for initial value
      await new Promise((r) => setTimeout(r, 10))

      // Update the entity
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
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

      queryManager.watchById<Todo>('todos', 'todo-1').subscribe((v) => {
        values.push(v)
      })

      // Wait for initial load (call 1)
      await new Promise((r) => setTimeout(r, 10))
      expect(values).toHaveLength(1)

      // First update — will trigger call 2 (slow)
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
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
        cacheKey: 'cache-1',
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

      const sub = queryManager.watchById<Todo>('todos', 'todo-1').subscribe(() => {})

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
      const result = await queryManager.getById<Todo>('todos', 'todo-1')
      await queryManager.hold(result.cacheKey.key)

      const cacheKey = await cacheManager.get(result.cacheKey.key)
      expect(cacheKey?.holdCount).toBe(1)
    })

    it('releases a cache key', async () => {
      const result = await queryManager.getById<Todo>('todos', 'todo-1')
      await queryManager.hold(result.cacheKey.key)
      await queryManager.release(result.cacheKey.key)

      const cacheKey = await cacheManager.get(result.cacheKey.key)
      expect(cacheKey?.holdCount).toBe(0)
    })

    it('tracks multiple holds', async () => {
      const result = await queryManager.getById<Todo>('todos', 'todo-1')
      await queryManager.hold(result.cacheKey.key)
      await queryManager.hold(result.cacheKey.key)
      await queryManager.release(result.cacheKey.key)

      const cacheKey = await cacheManager.get(result.cacheKey.key)
      expect(cacheKey?.holdCount).toBe(1)
    })

    it('releases all holds on destroy', async () => {
      const result = await queryManager.getById<Todo>('todos', 'todo-1')
      await queryManager.hold(result.cacheKey.key)
      await queryManager.hold(result.cacheKey.key)

      await queryManager.releaseAll()

      const cacheKey = await cacheManager.get(result.cacheKey.key)
      expect(cacheKey?.holdCount).toBe(0)
    })
  })

  describe('onSessionDestroyed', () => {
    it('clears all active holds without calling cacheManager.release()', async () => {
      const result = await queryManager.getById<Todo>('todos', 'todo-1')
      await queryManager.hold(result.cacheKey.key)
      await queryManager.hold(result.cacheKey.key) // refcount = 2 internally

      queryManager.onSessionDestroyed()

      // Internal tracking was cleared — release should be a no-op (no error, no call to cacheManager)
      // Verify by doing a release — it should not throw or call through
      await queryManager.release(result.cacheKey.key) // no-op since activeHolds was cleared

      // Hold count in storage should still be 1 (we didn't call cacheManager.release)
      const cacheKey = await cacheManager.get(result.cacheKey.key)
      expect(cacheKey?.holdCount).toBe(1)
    })
  })

  describe('releaseForCacheKey', () => {
    it('removes hold tracking for an evicted cache key', async () => {
      const result = await queryManager.getById<Todo>('todos', 'todo-1')
      await queryManager.hold(result.cacheKey.key)
      await queryManager.hold(result.cacheKey.key)

      queryManager.releaseForCacheKey(result.cacheKey.key)

      // Hold count in storage is unchanged (key was evicted, no release call)
      const cacheKey = await cacheManager.get(result.cacheKey.key)
      expect(cacheKey?.holdCount).toBe(1)
    })
  })
})
