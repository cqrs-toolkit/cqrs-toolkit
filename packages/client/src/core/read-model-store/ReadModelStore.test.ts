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
    store = new ReadModelStore({ storage })
  })

  describe('getById', () => {
    it('returns undefined for non-existent record', async () => {
      const result = await store.getById<Todo>('todos', 'non-existent')
      expect(result).toBeUndefined()
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

    it('applies pagination when cacheKey is provided', async () => {
      // Add a third record with the same cacheKey
      await storage.saveReadModel({
        id: 'todo-3',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: JSON.stringify({ id: 'todo-3', title: 'Third', done: false }),
        effectiveData: JSON.stringify({ id: 'todo-3', title: 'Third', done: false }),
        hasLocalChanges: false,
        updatedAt: 3000,
      })

      const models = await store.list<Todo>('todos', { cacheKey: 'cache-1', limit: 1, offset: 1 })

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

    it('preserves local property deletions when updating server baseline', async () => {
      // Create record where description has been locally deleted
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: JSON.stringify({ id: 'todo-1', title: 'Original', description: 'A note' }),
        effectiveData: JSON.stringify({ id: 'todo-1', title: 'Original' }),
        hasLocalChanges: true,
        updatedAt: 1000,
      })

      // Server sends new data that still has description
      await store.setServerData(
        'todos',
        'todo-1',
        { id: 'todo-1', title: 'New', description: 'A note' },
        'cache-1',
      )

      const record = await storage.getReadModel('todos', 'todo-1')
      const effectiveData = JSON.parse(record!.effectiveData)
      // description was locally deleted, so it should stay deleted
      expect(effectiveData.description).toBeUndefined()
      // title was not locally changed (still 'Original' vs server 'Original'),
      // so new server value should be adopted
      expect(effectiveData.title).toBe('New')
      expect(record?.hasLocalChanges).toBe(true)
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
      expect(record).toBeUndefined()
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

  describe('setLocalData', () => {
    it('sets effective data as optimistic with no server baseline', async () => {
      const modified = await store.setLocalData(
        'todos',
        'todo-1',
        { id: 'todo-1', title: 'Optimistic', done: false },
        'cache-1',
      )

      expect(modified).toBe(true)
      const record = await storage.getReadModel('todos', 'todo-1')
      expect(record?.hasLocalChanges).toBe(true)
      expect(record?.serverData).toBeNull()
      expect(JSON.parse(record!.effectiveData)).toEqual({
        id: 'todo-1',
        title: 'Optimistic',
        done: false,
      })
    })

    it('preserves existing server baseline', async () => {
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: JSON.stringify({ id: 'todo-1', title: 'Server', done: false }),
        effectiveData: JSON.stringify({ id: 'todo-1', title: 'Server', done: false }),
        hasLocalChanges: false,
        updatedAt: 1000,
      })

      await store.setLocalData(
        'todos',
        'todo-1',
        { id: 'todo-1', title: 'Optimistic', done: true },
        'cache-1',
      )

      const record = await storage.getReadModel('todos', 'todo-1')
      // Server baseline should be unchanged
      expect(record?.serverData).toBe(
        JSON.stringify({ id: 'todo-1', title: 'Server', done: false }),
      )
      // Effective data should be the new local data
      expect(JSON.parse(record!.effectiveData)).toEqual({
        id: 'todo-1',
        title: 'Optimistic',
        done: true,
      })
      expect(record?.hasLocalChanges).toBe(true)
    })

    it('returns false on identical data', async () => {
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: null,
        effectiveData: JSON.stringify({ id: 'todo-1', title: 'Test' }),
        hasLocalChanges: true,
        updatedAt: 1000,
      })

      const modified = await store.setLocalData(
        'todos',
        'todo-1',
        { id: 'todo-1', title: 'Test' },
        'cache-1',
      )

      expect(modified).toBe(false)
    })
  })

  describe('mergeServerData', () => {
    it('merges partial data into server baseline', async () => {
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: JSON.stringify({ id: 'todo-1', title: 'Original', done: false }),
        effectiveData: JSON.stringify({ id: 'todo-1', title: 'Original', done: false }),
        hasLocalChanges: false,
        updatedAt: 1000,
      })

      const modified = await store.mergeServerData('todos', 'todo-1', { done: true }, 'cache-1')

      expect(modified).toBe(true)
      const record = await storage.getReadModel('todos', 'todo-1')
      expect(JSON.parse(record!.serverData!)).toEqual({
        id: 'todo-1',
        title: 'Original',
        done: true,
      })
      expect(JSON.parse(record!.effectiveData)).toEqual({
        id: 'todo-1',
        title: 'Original',
        done: true,
      })
      expect(record?.hasLocalChanges).toBe(false)
    })

    it('preserves local overlay via three-way merge', async () => {
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: JSON.stringify({ id: 'todo-1', title: 'Original', done: false, count: 0 }),
        effectiveData: JSON.stringify({
          id: 'todo-1',
          title: 'Local Title',
          done: false,
          count: 0,
        }),
        hasLocalChanges: true,
        updatedAt: 1000,
      })

      const modified = await store.mergeServerData('todos', 'todo-1', { count: 5 }, 'cache-1')

      expect(modified).toBe(true)
      const record = await storage.getReadModel('todos', 'todo-1')
      const effectiveData = JSON.parse(record!.effectiveData)
      // Local overlay on title should be preserved
      expect(effectiveData.title).toBe('Local Title')
      // Server merge on count should be applied
      expect(effectiveData.count).toBe(5)
      expect(record?.hasLocalChanges).toBe(true)
    })

    it('merges into non-existent record', async () => {
      const modified = await store.mergeServerData(
        'todos',
        'todo-1',
        { title: 'New', done: false },
        'cache-1',
      )

      expect(modified).toBe(true)
      const record = await storage.getReadModel('todos', 'todo-1')
      expect(JSON.parse(record!.serverData!)).toEqual({ title: 'New', done: false })
      expect(JSON.parse(record!.effectiveData)).toEqual({ title: 'New', done: false })
      expect(record?.hasLocalChanges).toBe(false)
    })
  })

  describe('modified return values', () => {
    it('setServerData returns false on no-op', async () => {
      const data: Todo = { id: 'todo-1', title: 'Test', done: false }
      await store.setServerData('todos', 'todo-1', data, 'cache-1')

      const modified = await store.setServerData('todos', 'todo-1', data, 'cache-1')
      expect(modified).toBe(false)
    })

    it('setServerData returns true when data changes', async () => {
      await store.setServerData<Todo>(
        'todos',
        'todo-1',
        { id: 'todo-1', title: 'Test', done: false },
        'cache-1',
      )

      const modified = await store.setServerData<Todo>(
        'todos',
        'todo-1',
        { id: 'todo-1', title: 'Updated', done: false },
        'cache-1',
      )
      expect(modified).toBe(true)
    })

    it('applyLocalChanges returns false on no-op', async () => {
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: JSON.stringify({ id: 'todo-1', title: 'Test', done: false }),
        effectiveData: JSON.stringify({ id: 'todo-1', title: 'Test', done: true }),
        hasLocalChanges: true,
        updatedAt: 1000,
      })

      const modified = await store.applyLocalChanges<Todo>(
        'todos',
        'todo-1',
        { done: true },
        'cache-1',
      )
      expect(modified).toBe(false)
    })

    it('delete returns false when record does not exist', async () => {
      const modified = await store.delete('todos', 'non-existent')
      expect(modified).toBe(false)
    })

    it('delete returns true when record existed', async () => {
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: null,
        effectiveData: '{}',
        hasLocalChanges: false,
        updatedAt: 1000,
      })

      const modified = await store.delete('todos', 'todo-1')
      expect(modified).toBe(true)
      expect(await store.exists('todos', 'todo-1')).toBe(false)
    })

    it('mergeServerData returns false on no-op', async () => {
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKey: 'cache-1',
        serverData: JSON.stringify({ id: 'todo-1', title: 'Test', done: false }),
        effectiveData: JSON.stringify({ id: 'todo-1', title: 'Test', done: false }),
        hasLocalChanges: false,
        updatedAt: 1000,
      })

      const modified = await store.mergeServerData('todos', 'todo-1', { done: false }, 'cache-1')
      expect(modified).toBe(false)
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
