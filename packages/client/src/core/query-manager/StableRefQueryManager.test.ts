/**
 * Unit tests for StableRefQueryManager.
 */

import { firstValueFrom, Subject, timeout } from 'rxjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StableRefQueryManager } from './StableRefQueryManager.js'
import type { IQueryManager, ItemMeta, ListQueryResult, QueryResult } from './types.js'

interface Todo {
  id: string
  title: string
  done: boolean
}

describe('StableRefQueryManager', () => {
  let inner: IQueryManager & {
    setListResult: (result: ListQueryResult<Todo>) => void
    setGetByIdResult: (result: QueryResult<Todo>) => void
    emitCollectionUpdate: (ids: string[]) => void
  }
  let stableQm: StableRefQueryManager
  let collectionUpdate$: Subject<string[]>

  beforeEach(() => {
    collectionUpdate$ = new Subject<string[]>()
    let listResult: ListQueryResult<Todo>
    let getByIdResult: QueryResult<Todo>

    inner = {
      setListResult(result: ListQueryResult<Todo>) {
        listResult = result
      },
      setGetByIdResult(result: QueryResult<Todo>) {
        getByIdResult = result
      },
      emitCollectionUpdate(ids: string[]) {
        collectionUpdate$.next(ids)
      },

      async getById<T>(): Promise<QueryResult<T>> {
        return getByIdResult as unknown as QueryResult<T>
      },
      async getByIds<T>(_collection: string, ids: string[]): Promise<Map<string, QueryResult<T>>> {
        const results = new Map<string, QueryResult<T>>()
        for (const id of ids) {
          // For simplicity, build a result from the list result
          const idx = listResult.data.findIndex((d) => d.id === id)
          if (idx !== -1) {
            const item = listResult.data[idx]
            const meta = listResult.meta[idx]
            results.set(id, {
              data: item as unknown as T,
              meta,
              hasLocalChanges: false,
              cacheKey: 'ck',
            })
          } else {
            results.set(id, {
              data: undefined,
              meta: undefined,
              hasLocalChanges: false,
              cacheKey: 'ck',
            })
          }
        }
        return results
      },
      async list<T>(): Promise<ListQueryResult<T>> {
        return listResult as unknown as ListQueryResult<T>
      },
      watchCollection() {
        return collectionUpdate$.asObservable()
      },
      watchById() {
        throw new Error('Should not be called on inner — StableRefQueryManager overrides this')
      },
      async exists() {
        return true
      },
      async count() {
        return 0
      },
      async touch() {},
      async hold() {},
      async release() {},
      async releaseAll() {},
      async destroy() {},
    }

    stableQm = new StableRefQueryManager(inner)
  })

  afterEach(async () => {
    await stableQm.destroy()
  })

  describe('list', () => {
    it('returns same reference when (id, updatedAt) unchanged', async () => {
      const todo1: Todo = { id: '1', title: 'Buy milk', done: false }
      const todo2: Todo = { id: '2', title: 'Walk dog', done: true }
      const meta1: ItemMeta = { id: '1', updatedAt: 1000 }
      const meta2: ItemMeta = { id: '2', updatedAt: 2000 }

      inner.setListResult({
        data: [todo1, todo2],
        meta: [meta1, meta2],
        total: 2,
        hasLocalChanges: false,
        cacheKey: 'ck',
      })

      const result1 = await stableQm.list<Todo>('todos')

      // Second call with new object references but same updatedAt
      const todo1Copy: Todo = { id: '1', title: 'Buy milk', done: false }
      const todo2Copy: Todo = { id: '2', title: 'Walk dog', done: true }

      inner.setListResult({
        data: [todo1Copy, todo2Copy],
        meta: [meta1, meta2],
        total: 2,
        hasLocalChanges: false,
        cacheKey: 'ck',
      })

      const result2 = await stableQm.list<Todo>('todos')

      // References should be the same as the first call
      expect(result2.data[0]).toBe(result1.data[0])
      expect(result2.data[1]).toBe(result1.data[1])
    })

    it('returns new reference when updatedAt changes', async () => {
      const todo1: Todo = { id: '1', title: 'Buy milk', done: false }

      inner.setListResult({
        data: [todo1],
        meta: [{ id: '1', updatedAt: 1000 }],
        total: 1,
        hasLocalChanges: false,
        cacheKey: 'ck',
      })

      const result1 = await stableQm.list<Todo>('todos')

      // Same id, different updatedAt
      const todo1Updated: Todo = { id: '1', title: 'Buy oat milk', done: false }

      inner.setListResult({
        data: [todo1Updated],
        meta: [{ id: '1', updatedAt: 2000 }],
        total: 1,
        hasLocalChanges: false,
        cacheKey: 'ck',
      })

      const result2 = await stableQm.list<Todo>('todos')

      expect(result2.data[0]).not.toBe(result1.data[0])
      expect(result2.data[0]).toBe(todo1Updated)
    })

    it('caches new items and cleans removed items', async () => {
      const todo1: Todo = { id: '1', title: 'A', done: false }
      const todo2: Todo = { id: '2', title: 'B', done: false }

      inner.setListResult({
        data: [todo1, todo2],
        meta: [
          { id: '1', updatedAt: 1000 },
          { id: '2', updatedAt: 1000 },
        ],
        total: 2,
        hasLocalChanges: false,
        cacheKey: 'ck',
      })

      const result1 = await stableQm.list<Todo>('todos')

      // Second call: item 2 removed, item 3 added
      const todo3: Todo = { id: '3', title: 'C', done: false }

      inner.setListResult({
        data: [todo1, todo3],
        meta: [
          { id: '1', updatedAt: 1000 },
          { id: '3', updatedAt: 1000 },
        ],
        total: 2,
        hasLocalChanges: false,
        cacheKey: 'ck',
      })

      const result2 = await stableQm.list<Todo>('todos')

      // Item 1 should still be the same reference
      expect(result2.data[0]).toBe(result1.data[0])
      // Item 3 is new
      expect(result2.data[1]).toBe(todo3)
    })

    it('preserves meta field from inner result', async () => {
      const meta: ItemMeta[] = [
        { id: '1', updatedAt: 1000 },
        { id: '2', updatedAt: 2000 },
      ]

      inner.setListResult({
        data: [
          { id: '1', title: 'A', done: false },
          { id: '2', title: 'B', done: false },
        ],
        meta,
        total: 2,
        hasLocalChanges: true,
        cacheKey: 'ck-abc',
      })

      const result = await stableQm.list<Todo>('todos')

      expect(result.meta).toEqual(meta)
      expect(result.total).toBe(2)
      expect(result.hasLocalChanges).toBe(true)
      expect(result.cacheKey).toBe('ck-abc')
    })
  })

  describe('getById', () => {
    it('returns same reference when (id, updatedAt) unchanged', async () => {
      const todo: Todo = { id: '1', title: 'Buy milk', done: false }

      inner.setGetByIdResult({
        data: todo,
        meta: { id: '1', updatedAt: 1000 },
        hasLocalChanges: false,
        cacheKey: 'ck',
      })

      const result1 = await stableQm.getById<Todo>('todos', '1')

      // New object, same updatedAt
      const todoCopy: Todo = { id: '1', title: 'Buy milk', done: false }

      inner.setGetByIdResult({
        data: todoCopy,
        meta: { id: '1', updatedAt: 1000 },
        hasLocalChanges: false,
        cacheKey: 'ck',
      })

      const result2 = await stableQm.getById<Todo>('todos', '1')

      expect(result2.data).toBe(result1.data)
    })

    it('returns new reference when updatedAt changes', async () => {
      inner.setGetByIdResult({
        data: { id: '1', title: 'Old', done: false },
        meta: { id: '1', updatedAt: 1000 },
        hasLocalChanges: false,
        cacheKey: 'ck',
      })

      await stableQm.getById<Todo>('todos', '1')

      const updated: Todo = { id: '1', title: 'New', done: false }
      inner.setGetByIdResult({
        data: updated,
        meta: { id: '1', updatedAt: 2000 },
        hasLocalChanges: false,
        cacheKey: 'ck',
      })

      const result2 = await stableQm.getById<Todo>('todos', '1')

      expect(result2.data).toBe(updated)
    })

    it('passes through undefined data', async () => {
      inner.setGetByIdResult({
        data: undefined,
        meta: undefined,
        hasLocalChanges: false,
        cacheKey: 'ck',
      })

      const result = await stableQm.getById<Todo>('todos', 'missing')

      expect(result.data).toBeUndefined()
      expect(result.meta).toBeUndefined()
    })
  })

  describe('getByIds', () => {
    it('reconciles references per item', async () => {
      const todo1: Todo = { id: '1', title: 'A', done: false }
      const todo2: Todo = { id: '2', title: 'B', done: false }

      // Seed the list cache first
      inner.setListResult({
        data: [todo1, todo2],
        meta: [
          { id: '1', updatedAt: 1000 },
          { id: '2', updatedAt: 2000 },
        ],
        total: 2,
        hasLocalChanges: false,
        cacheKey: 'ck',
      })
      await stableQm.list<Todo>('todos')

      // getByIds with same updatedAt — should reuse references
      const results = await stableQm.getByIds<Todo>('todos', ['1', '2'])

      expect(results.get('1')?.data).toBe(todo1)
      expect(results.get('2')?.data).toBe(todo2)
    })
  })

  describe('watchById', () => {
    it('emits initial value with stable reference', async () => {
      const todo: Todo = { id: '1', title: 'Buy milk', done: false }

      inner.setGetByIdResult({
        data: todo,
        meta: { id: '1', updatedAt: 1000 },
        hasLocalChanges: false,
        cacheKey: 'ck',
      })

      const value = await firstValueFrom(stableQm.watchById<Todo>('todos', '1').pipe(timeout(100)))

      expect(value).toBe(todo)
    })

    it('reuses stable reference on update with same updatedAt', async () => {
      const todo: Todo = { id: '1', title: 'Buy milk', done: false }

      inner.setGetByIdResult({
        data: todo,
        meta: { id: '1', updatedAt: 1000 },
        hasLocalChanges: false,
        cacheKey: 'ck',
      })

      const values: (Todo | undefined)[] = []

      stableQm.watchById<Todo>('todos', '1').subscribe((v) => {
        values.push(v)
      })

      // Wait for initial value
      await new Promise((r) => setTimeout(r, 10))
      expect(values).toHaveLength(1)

      // Emit update with new object but same updatedAt
      const todoCopy: Todo = { id: '1', title: 'Buy milk', done: false }
      inner.setGetByIdResult({
        data: todoCopy,
        meta: { id: '1', updatedAt: 1000 },
        hasLocalChanges: false,
        cacheKey: 'ck',
      })
      inner.emitCollectionUpdate(['1'])

      await new Promise((r) => setTimeout(r, 10))

      // distinctUntilChanged should suppress emission since reference is the same
      expect(values).toHaveLength(1)
    })

    it('emits new value when updatedAt changes', async () => {
      inner.setGetByIdResult({
        data: { id: '1', title: 'Old', done: false },
        meta: { id: '1', updatedAt: 1000 },
        hasLocalChanges: false,
        cacheKey: 'ck',
      })

      const values: (Todo | undefined)[] = []

      stableQm.watchById<Todo>('todos', '1').subscribe((v) => {
        values.push(v)
      })

      await new Promise((r) => setTimeout(r, 10))

      // Emit update with changed updatedAt
      const updated: Todo = { id: '1', title: 'New', done: false }
      inner.setGetByIdResult({
        data: updated,
        meta: { id: '1', updatedAt: 2000 },
        hasLocalChanges: false,
        cacheKey: 'ck',
      })
      inner.emitCollectionUpdate(['1'])

      await new Promise((r) => setTimeout(r, 10))

      expect(values).toHaveLength(2)
      expect(values[1]).toBe(updated)
    })
  })

  describe('passthrough methods', () => {
    it('delegates exists to inner', async () => {
      const spy = vi.spyOn(inner, 'exists')
      await stableQm.exists('todos', '1')
      expect(spy).toHaveBeenCalledWith('todos', '1')
    })

    it('delegates count to inner', async () => {
      const spy = vi.spyOn(inner, 'count')
      await stableQm.count('todos')
      expect(spy).toHaveBeenCalledWith('todos')
    })

    it('delegates touch to inner', async () => {
      const spy = vi.spyOn(inner, 'touch')
      await stableQm.touch('todos')
      expect(spy).toHaveBeenCalledWith('todos')
    })

    it('delegates hold to inner', async () => {
      const spy = vi.spyOn(inner, 'hold')
      await stableQm.hold('ck-1')
      expect(spy).toHaveBeenCalledWith('ck-1')
    })

    it('delegates release to inner', async () => {
      const spy = vi.spyOn(inner, 'release')
      await stableQm.release('ck-1')
      expect(spy).toHaveBeenCalledWith('ck-1')
    })

    it('delegates releaseAll to inner', async () => {
      const spy = vi.spyOn(inner, 'releaseAll')
      await stableQm.releaseAll()
      expect(spy).toHaveBeenCalled()
    })
  })

  describe('destroy', () => {
    it('clears ref cache and destroys inner', async () => {
      const destroySpy = vi.spyOn(inner, 'destroy')

      // Seed cache
      inner.setListResult({
        data: [{ id: '1', title: 'A', done: false }],
        meta: [{ id: '1', updatedAt: 1000 }],
        total: 1,
        hasLocalChanges: false,
        cacheKey: 'ck',
      })
      await stableQm.list<Todo>('todos')

      await stableQm.destroy()

      expect(destroySpy).toHaveBeenCalled()

      // After destroy, a new list call should not reuse old references
      stableQm = new StableRefQueryManager(inner)
      const todo: Todo = { id: '1', title: 'A', done: false }
      inner.setListResult({
        data: [todo],
        meta: [{ id: '1', updatedAt: 1000 }],
        total: 1,
        hasLocalChanges: false,
        cacheKey: 'ck',
      })
      const result = await stableQm.list<Todo>('todos')
      expect(result.data[0]).toBe(todo)
    })
  })
})
