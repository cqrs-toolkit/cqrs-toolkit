/**
 * Unit tests for ReadModelStore.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryStorage } from '../../storage/InMemoryStorage.js'
import { EventBus } from '../events/EventBus.js'
import { ReadModelStore } from './ReadModelStore.js'

interface Todo {
  id: string
  title: string
  done: boolean
}

describe('ReadModelStore', () => {
  let storage: InMemoryStorage
  let eventBus: EventBus
  let store: ReadModelStore

  beforeEach(async () => {
    storage = new InMemoryStorage()
    await storage.initialize()
    eventBus = new EventBus()
    store = new ReadModelStore({ storage, eventBus })
  })

  describe('getById', () => {
    it('returns null for non-existent record', async () => {
      const result = await store.getById<Todo>('todos', 'non-existent')
      expect(result).toBeNull()
    })

    it('returns read model with data', async () => {
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: JSON.stringify({ id: 'todo-1', title: 'Test', done: false }),
        effectiveData: JSON.stringify({ id: 'todo-1', title: 'Test', done: false }),
        hasLocalChanges: false,
        updatedAt: 1000,
      })

      const result = await store.getById<Todo>('todos', 'todo-1')

      expect(result).toMatchObject({
        id: 'todo-1',
        collection: 'todos',
        data: { id: 'todo-1', title: 'Test', done: false },
        hasLocalChanges: false,
      })
    })

    it('returns effective data when local changes exist', async () => {
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: JSON.stringify({ id: 'todo-1', title: 'Original', done: false }),
        effectiveData: JSON.stringify({ id: 'todo-1', title: 'Modified', done: false }),
        hasLocalChanges: true,
        updatedAt: 1000,
      })

      const result = await store.getById<Todo>('todos', 'todo-1')

      expect(result?.data.title).toBe('Modified')
      expect(result?.serverData?.title).toBe('Original')
      expect(result?.hasLocalChanges).toBe(true)
    })
  })

  describe('getByIds', () => {
    it('returns map of found records', async () => {
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
        effectiveData: JSON.stringify({ id: 'todo-2', title: 'Second', done: true }),
        hasLocalChanges: false,
        updatedAt: 1000,
      })

      const result = await store.getByIds<Todo>('todos', ['todo-1', 'todo-2', 'todo-3'])

      expect(result.size).toBe(2)
      expect(result.get('todo-1')?.data.title).toBe('First')
      expect(result.get('todo-2')?.data.title).toBe('Second')
      expect(result.has('todo-3')).toBe(false)
    })
  })

  describe('list', () => {
    beforeEach(async () => {
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
        effectiveData: JSON.stringify({ id: 'todo-2', title: 'Second', done: true }),
        hasLocalChanges: true,
        updatedAt: 2000,
      })
      await storage.saveReadModel({
        id: 'user-1',
        collection: 'users',
        cacheKey: 'cache-2',
        serverData: JSON.stringify({ id: 'user-1', name: 'Alice' }),
        effectiveData: JSON.stringify({ id: 'user-1', name: 'Alice' }),
        hasLocalChanges: false,
        updatedAt: 1000,
      })
    })

    it('returns all records in collection', async () => {
      const todos = await store.list<Todo>('todos')

      expect(todos).toHaveLength(2)
    })

    it('filters by cache key', async () => {
      const models = await store.list<Todo>('todos', { cacheKey: 'cache-1' })

      expect(models).toHaveLength(2)
    })

    it('filters by local changes only', async () => {
      const models = await store.list<Todo>('todos', { localChangesOnly: true })

      expect(models).toHaveLength(1)
      expect(models[0]?.id).toBe('todo-2')
    })

    it('applies pagination', async () => {
      const models = await store.list<Todo>('todos', { limit: 1, offset: 1 })

      expect(models).toHaveLength(1)
    })
  })

  describe('setServerData', () => {
    it('sets server data as baseline', async () => {
      await store.setServerData<Todo>(
        'todos',
        'todo-1',
        { id: 'todo-1', title: 'Test', done: false },
        'cache-1',
      )

      const record = await storage.getReadModel('todos', 'todo-1')
      expect(record?.serverData).toBe(JSON.stringify({ id: 'todo-1', title: 'Test', done: false }))
      expect(record?.effectiveData).toBe(
        JSON.stringify({ id: 'todo-1', title: 'Test', done: false }),
      )
      expect(record?.hasLocalChanges).toBe(false)
    })

    it('preserves local changes when updating server baseline', async () => {
      // Create initial with local changes
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: JSON.stringify({ id: 'todo-1', title: 'Original', done: false }),
        effectiveData: JSON.stringify({ id: 'todo-1', title: 'Modified', done: false }),
        hasLocalChanges: true,
        updatedAt: 1000,
      })

      // Update server baseline
      await store.setServerData<Todo>(
        'todos',
        'todo-1',
        { id: 'todo-1', title: 'From Server', done: true },
        'cache-1',
      )

      const record = await storage.getReadModel('todos', 'todo-1')
      expect(record?.serverData).toBe(
        JSON.stringify({ id: 'todo-1', title: 'From Server', done: true }),
      )
      // Local change (title: Modified) should be preserved on top of new server baseline
      const effectiveData = JSON.parse(record!.effectiveData)
      expect(effectiveData.title).toBe('Modified')
      expect(effectiveData.done).toBe(true) // Server value for fields not locally changed
      expect(record?.hasLocalChanges).toBe(true)
    })
  })

  describe('applyLocalChanges', () => {
    it('applies local changes to existing record', async () => {
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: JSON.stringify({ id: 'todo-1', title: 'Test', done: false }),
        effectiveData: JSON.stringify({ id: 'todo-1', title: 'Test', done: false }),
        hasLocalChanges: false,
        updatedAt: 1000,
      })

      await store.applyLocalChanges<Todo>('todos', 'todo-1', { done: true }, 'cache-1')

      const record = await storage.getReadModel('todos', 'todo-1')
      expect(record?.hasLocalChanges).toBe(true)
      const data = JSON.parse(record!.effectiveData)
      expect(data.done).toBe(true)
      expect(data.title).toBe('Test') // Unchanged
    })

    it('creates new record if none exists', async () => {
      await store.applyLocalChanges<Partial<Todo>>(
        'todos',
        'todo-new',
        { id: 'todo-new', title: 'New Todo' },
        'cache-1',
      )

      const record = await storage.getReadModel('todos', 'todo-new')
      expect(record).toBeTruthy()
      expect(record?.hasLocalChanges).toBe(true)
      expect(record?.serverData).toBeNull()
    })
  })

  describe('clearLocalChanges', () => {
    it('reverts to server baseline', async () => {
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: JSON.stringify({ id: 'todo-1', title: 'Original', done: false }),
        effectiveData: JSON.stringify({ id: 'todo-1', title: 'Modified', done: true }),
        hasLocalChanges: true,
        updatedAt: 1000,
      })

      await store.clearLocalChanges('todos', 'todo-1')

      const record = await storage.getReadModel('todos', 'todo-1')
      expect(record?.hasLocalChanges).toBe(false)
      expect(record?.effectiveData).toBe(record?.serverData)
    })

    it('deletes record if no server baseline', async () => {
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: null,
        effectiveData: JSON.stringify({ id: 'todo-1', title: 'Local Only' }),
        hasLocalChanges: true,
        updatedAt: 1000,
      })

      await store.clearLocalChanges('todos', 'todo-1')

      const record = await storage.getReadModel('todos', 'todo-1')
      expect(record).toBeNull()
    })

    it('does nothing if no local changes', async () => {
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: JSON.stringify({ id: 'todo-1', title: 'Test', done: false }),
        effectiveData: JSON.stringify({ id: 'todo-1', title: 'Test', done: false }),
        hasLocalChanges: false,
        updatedAt: 1000,
      })

      await store.clearLocalChanges('todos', 'todo-1')

      const record = await storage.getReadModel('todos', 'todo-1')
      expect(record).toBeTruthy()
    })
  })

  describe('exists', () => {
    it('returns true for existing record', async () => {
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: null,
        effectiveData: '{}',
        hasLocalChanges: false,
        updatedAt: 1000,
      })

      expect(await store.exists('todos', 'todo-1')).toBe(true)
    })

    it('returns false for non-existing record', async () => {
      expect(await store.exists('todos', 'todo-1')).toBe(false)
    })
  })

  describe('count', () => {
    it('returns correct count', async () => {
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: null,
        effectiveData: '{}',
        hasLocalChanges: false,
        updatedAt: 1000,
      })
      await storage.saveReadModel({
        id: 'todo-2',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: null,
        effectiveData: '{}',
        hasLocalChanges: false,
        updatedAt: 1000,
      })

      expect(await store.count('todos')).toBe(2)
      expect(await store.count('users')).toBe(0)
    })
  })

  describe('delete', () => {
    it('deletes a record', async () => {
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: null,
        effectiveData: '{}',
        hasLocalChanges: false,
        updatedAt: 1000,
      })

      await store.delete('todos', 'todo-1')

      expect(await store.exists('todos', 'todo-1')).toBe(false)
    })
  })
})
