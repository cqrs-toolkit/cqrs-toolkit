/**
 * Unit tests for QueryManager.
 */

import { firstValueFrom, timeout } from 'rxjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
    cacheManager = new CacheManager({ storage, eventBus })
    readModelStore = new ReadModelStore({ storage, eventBus })
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
    })
    await storage.saveReadModel({
      id: 'todo-2',
      collection: 'todos',
      cacheKey: 'cache-1',
      serverData: JSON.stringify({ id: 'todo-2', title: 'Second', done: true }),
      effectiveData: JSON.stringify({ id: 'todo-2', title: 'Second Modified', done: true }),
      hasLocalChanges: true,
      updatedAt: 2000,
    })
  })

  afterEach(() => {
    queryManager.destroy()
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

      expect(result.data).toBeNull()
      expect(result.hasLocalChanges).toBe(false)
    })

    it('creates cache key on access', async () => {
      const result = await queryManager.getById<Todo>('todos', 'todo-1')

      const cacheKeyExists = await cacheManager.exists(result.cacheKey)
      expect(cacheKeyExists).toBe(true)
    })
  })

  describe('getByIds', () => {
    it('returns map of found entities', async () => {
      const results = await queryManager.getByIds<Todo>('todos', ['todo-1', 'todo-2', 'todo-3'])

      expect(results.size).toBe(3)
      expect(results.get('todo-1')?.data?.title).toBe('First')
      expect(results.get('todo-2')?.data?.title).toBe('Second Modified')
      expect(results.get('todo-3')?.data).toBeNull()
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
      const values: (Todo | null)[] = []

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
      })

      // Emit update notification
      eventBus.emit('readmodel:updated', { collection: 'todos', ids: ['todo-1'] })

      await new Promise((r) => setTimeout(r, 10))

      expect(values.length).toBeGreaterThanOrEqual(2)
      expect(values[values.length - 1]?.title).toBe('Updated')
    })
  })

  describe('hold/release', () => {
    it('holds a cache key', async () => {
      const result = await queryManager.getById<Todo>('todos', 'todo-1')
      await queryManager.hold(result.cacheKey)

      const cacheKey = await cacheManager.get(result.cacheKey)
      expect(cacheKey?.holdCount).toBe(1)
    })

    it('releases a cache key', async () => {
      const result = await queryManager.getById<Todo>('todos', 'todo-1')
      await queryManager.hold(result.cacheKey)
      await queryManager.release(result.cacheKey)

      const cacheKey = await cacheManager.get(result.cacheKey)
      expect(cacheKey?.holdCount).toBe(0)
    })

    it('tracks multiple holds', async () => {
      const result = await queryManager.getById<Todo>('todos', 'todo-1')
      await queryManager.hold(result.cacheKey)
      await queryManager.hold(result.cacheKey)
      await queryManager.release(result.cacheKey)

      const cacheKey = await cacheManager.get(result.cacheKey)
      expect(cacheKey?.holdCount).toBe(1)
    })

    it('releases all holds on destroy', async () => {
      const result = await queryManager.getById<Todo>('todos', 'todo-1')
      await queryManager.hold(result.cacheKey)
      await queryManager.hold(result.cacheKey)

      await queryManager.releaseAll()

      const cacheKey = await cacheManager.get(result.cacheKey)
      expect(cacheKey?.holdCount).toBe(0)
    })
  })
})
