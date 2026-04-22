/**
 * Unit tests for StableRefQueryManager.
 */

import { ServiceLink } from '@meticoeus/ddd-es'
import { firstValueFrom, Subject, timeout } from 'rxjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { entityIdToString } from '../../types/entities.js'
import type { CacheKeyIdentity } from '../cache-manager/CacheKey.js'
import { deriveScopeKey } from '../cache-manager/index.js'
import { StableRefQueryManager } from './StableRefQueryManager.js'
import type {
  CollectionSignal,
  GetByIdParams,
  GetByIdsParams,
  IQueryManager,
  ItemMeta,
  ListParams,
  ListQueryResult,
  QueryResult,
} from './types.js'

interface Todo {
  id: string
  title: string
  done: boolean
}

const TODOS_CACHE_KEY = deriveScopeKey({ scopeType: 'todos' })

describe('StableRefQueryManager', () => {
  let cleanup: (() => void)[] = []

  afterEach(() => {
    for (const fn of cleanup) fn()
    cleanup = []
  })

  let inner: IQueryManager<ServiceLink> & {
    setListResult: (result: ListQueryResult<ServiceLink, Todo>) => void
    setGetByIdResult: (result: QueryResult<ServiceLink, Todo>) => void
    emitCollectionUpdate: (ids: string[]) => void
  }
  let stableQm: StableRefQueryManager<ServiceLink>
  let collectionUpdate$: Subject<CollectionSignal>

  beforeEach(() => {
    collectionUpdate$ = new Subject<CollectionSignal>()
    let listResult: ListQueryResult<ServiceLink, Todo>
    let getByIdResult: QueryResult<ServiceLink, Todo>

    inner = {
      setListResult(result: ListQueryResult<ServiceLink, Todo>) {
        listResult = result
      },
      setGetByIdResult(result: QueryResult<ServiceLink, Todo>) {
        getByIdResult = result
      },
      emitCollectionUpdate(ids: string[]) {
        collectionUpdate$.next({ type: 'updated', ids })
      },

      async getById<T>(_params: GetByIdParams<ServiceLink>): Promise<QueryResult<ServiceLink, T>> {
        return getByIdResult as unknown as QueryResult<ServiceLink, T>
      },
      async getByIds<T>(
        params: GetByIdsParams<ServiceLink>,
      ): Promise<Map<string, QueryResult<ServiceLink, T>>> {
        const results = new Map<string, QueryResult<ServiceLink, T>>()
        for (const id of params.ids) {
          const stringId = entityIdToString(id)
          const idx = listResult.data.findIndex((d) => d.id === stringId)
          if (idx !== -1) {
            const item = listResult.data[idx]
            const meta = listResult.meta[idx]
            results.set(stringId, {
              data: item as unknown as T,
              meta,
              hasLocalChanges: false,
              cacheKey: deriveScopeKey({ scopeType: 'ck' }),
            })
          } else {
            results.set(stringId, {
              data: undefined,
              meta: undefined,
              hasLocalChanges: false,
              cacheKey: deriveScopeKey({ scopeType: 'ck' }),
            })
          }
        }
        return results
      },
      async list<T>(_params: ListParams<ServiceLink>): Promise<ListQueryResult<ServiceLink, T>> {
        return listResult as unknown as ListQueryResult<ServiceLink, T>
      },
      watchCollection() {
        return collectionUpdate$.asObservable()
      },
      watchById() {
        throw new Error('Should not be called on inner — StableRefQueryManager overrides this')
      },
      async getLocallyById() {
        return undefined
      },
      async exists() {
        return true
      },
      async count() {
        return 0
      },
      async touch(_cacheKey: CacheKeyIdentity<ServiceLink>) {},
      async hold() {},
      async release() {},
      async releaseAll() {},
      async destroy() {},
    }

    stableQm = new StableRefQueryManager(inner)
    cleanup.push(() => stableQm.destroy())
  })

  describe('list', () => {
    it('returns same reference when (id, revision) unchanged', async () => {
      const todo1: Todo = { id: '1', title: 'Buy milk', done: false }
      const todo2: Todo = { id: '2', title: 'Walk dog', done: true }
      const meta1: ItemMeta = { id: '1', updatedAt: 1000, revision: '1' }
      const meta2: ItemMeta = { id: '2', updatedAt: 2000, revision: '2' }

      inner.setListResult({
        data: [todo1, todo2],
        meta: [meta1, meta2],
        total: 2,
        hasLocalChanges: false,
        cacheKey: deriveScopeKey({ scopeType: 'ck' }),
      })

      const result1 = await stableQm.list<Todo>({ collection: 'todos', cacheKey: TODOS_CACHE_KEY })

      // Second call with new object references but same revision
      const todo1Copy: Todo = { id: '1', title: 'Buy milk', done: false }
      const todo2Copy: Todo = { id: '2', title: 'Walk dog', done: true }

      inner.setListResult({
        data: [todo1Copy, todo2Copy],
        meta: [meta1, meta2],
        total: 2,
        hasLocalChanges: false,
        cacheKey: deriveScopeKey({ scopeType: 'ck' }),
      })

      const result2 = await stableQm.list<Todo>({ collection: 'todos', cacheKey: TODOS_CACHE_KEY })

      // References should be the same as the first call
      expect(result2.data[0]).toBe(result1.data[0])
      expect(result2.data[1]).toBe(result1.data[1])
    })

    it('returns new reference when revision changes', async () => {
      const todo1: Todo = { id: '1', title: 'Buy milk', done: false }

      inner.setListResult({
        data: [todo1],
        meta: [{ id: '1', updatedAt: 1000, revision: '1' }],
        total: 1,
        hasLocalChanges: false,
        cacheKey: deriveScopeKey({ scopeType: 'ck' }),
      })

      const result1 = await stableQm.list<Todo>({ collection: 'todos', cacheKey: TODOS_CACHE_KEY })

      // Same id, different revision
      const todo1Updated: Todo = { id: '1', title: 'Buy oat milk', done: false }

      inner.setListResult({
        data: [todo1Updated],
        meta: [{ id: '1', updatedAt: 2000, revision: '2' }],
        total: 1,
        hasLocalChanges: false,
        cacheKey: deriveScopeKey({ scopeType: 'ck' }),
      })

      const result2 = await stableQm.list<Todo>({ collection: 'todos', cacheKey: TODOS_CACHE_KEY })

      expect(result2.data[0]).not.toBe(result1.data[0])
      expect(result2.data[0]).toBe(todo1Updated)
    })

    it('caches new items and cleans removed items', async () => {
      const todo1: Todo = { id: '1', title: 'A', done: false }
      const todo2: Todo = { id: '2', title: 'B', done: false }

      inner.setListResult({
        data: [todo1, todo2],
        meta: [
          { id: '1', updatedAt: 1000, revision: '1' },
          { id: '2', updatedAt: 1000, revision: '1' },
        ],
        total: 2,
        hasLocalChanges: false,
        cacheKey: deriveScopeKey({ scopeType: 'ck' }),
      })

      const result1 = await stableQm.list<Todo>({ collection: 'todos', cacheKey: TODOS_CACHE_KEY })

      // Second call: item 2 removed, item 3 added
      const todo3: Todo = { id: '3', title: 'C', done: false }

      inner.setListResult({
        data: [todo1, todo3],
        meta: [
          { id: '1', updatedAt: 1000, revision: '1' },
          { id: '3', updatedAt: 1000, revision: '1' },
        ],
        total: 2,
        hasLocalChanges: false,
        cacheKey: deriveScopeKey({ scopeType: 'ck' }),
      })

      const result2 = await stableQm.list<Todo>({ collection: 'todos', cacheKey: TODOS_CACHE_KEY })

      // Item 1 should still be the same reference
      expect(result2.data[0]).toBe(result1.data[0])
      // Item 3 is new
      expect(result2.data[1]).toBe(todo3)
    })

    it('preserves meta field from inner result', async () => {
      const meta: ItemMeta[] = [
        { id: '1', updatedAt: 1000, revision: '1' },
        { id: '2', updatedAt: 2000, revision: '2' },
      ]

      const cacheKey = deriveScopeKey({ scopeType: 'ck-abc' })
      inner.setListResult({
        data: [
          { id: '1', title: 'A', done: false },
          { id: '2', title: 'B', done: false },
        ],
        meta,
        total: 2,
        hasLocalChanges: true,
        cacheKey,
      })

      const result = await stableQm.list<Todo>({ collection: 'todos', cacheKey: TODOS_CACHE_KEY })

      expect(result.meta).toEqual(meta)
      expect(result.total).toBe(2)
      expect(result.hasLocalChanges).toBe(true)
      expect(result.cacheKey.key).toBe(cacheKey.key)
    })
  })

  describe('getById', () => {
    it('returns same reference when (id, revision) unchanged', async () => {
      const todo: Todo = { id: '1', title: 'Buy milk', done: false }

      inner.setGetByIdResult({
        data: todo,
        meta: { id: '1', updatedAt: 1000, revision: '1' },
        hasLocalChanges: false,
        cacheKey: deriveScopeKey({ scopeType: 'ck' }),
      })

      const result1 = await stableQm.getById<Todo>({
        collection: 'todos',
        id: '1',
        cacheKey: TODOS_CACHE_KEY,
      })

      // New object, same updatedAt
      const todoCopy: Todo = { id: '1', title: 'Buy milk', done: false }

      inner.setGetByIdResult({
        data: todoCopy,
        meta: { id: '1', updatedAt: 1000, revision: '1' },
        hasLocalChanges: false,
        cacheKey: deriveScopeKey({ scopeType: 'ck' }),
      })

      const result2 = await stableQm.getById<Todo>({
        collection: 'todos',
        id: '1',
        cacheKey: TODOS_CACHE_KEY,
      })

      expect(result2.data).toBe(result1.data)
    })

    it('returns new reference when revision changes', async () => {
      inner.setGetByIdResult({
        data: { id: '1', title: 'Old', done: false },
        meta: { id: '1', updatedAt: 1000, revision: '1' },
        hasLocalChanges: false,
        cacheKey: deriveScopeKey({ scopeType: 'ck' }),
      })

      await stableQm.getById<Todo>({ collection: 'todos', id: '1', cacheKey: TODOS_CACHE_KEY })

      const updated: Todo = { id: '1', title: 'New', done: false }
      inner.setGetByIdResult({
        data: updated,
        meta: { id: '1', updatedAt: 2000, revision: '2' },
        hasLocalChanges: false,
        cacheKey: deriveScopeKey({ scopeType: 'ck' }),
      })

      const result2 = await stableQm.getById<Todo>({
        collection: 'todos',
        id: '1',
        cacheKey: TODOS_CACHE_KEY,
      })

      expect(result2.data).toBe(updated)
    })

    it('passes through undefined data', async () => {
      inner.setGetByIdResult({
        data: undefined,
        meta: undefined,
        hasLocalChanges: false,
        cacheKey: deriveScopeKey({ scopeType: 'ck' }),
      })

      const result = await stableQm.getById<Todo>({
        collection: 'todos',
        id: 'missing',
        cacheKey: TODOS_CACHE_KEY,
      })

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
          { id: '1', updatedAt: 1000, revision: '1' },
          { id: '2', updatedAt: 2000, revision: '2' },
        ],
        total: 2,
        hasLocalChanges: false,
        cacheKey: deriveScopeKey({ scopeType: 'ck' }),
      })
      await stableQm.list<Todo>({ collection: 'todos', cacheKey: TODOS_CACHE_KEY })

      // getByIds with same revision — should reuse references
      const results = await stableQm.getByIds<Todo>({
        collection: 'todos',
        ids: ['1', '2'],
        cacheKey: TODOS_CACHE_KEY,
      })

      expect(results.get('1')?.data).toBe(todo1)
      expect(results.get('2')?.data).toBe(todo2)
    })
  })

  describe('watchById', () => {
    it('emits initial value with stable reference', async () => {
      const todo: Todo = { id: '1', title: 'Buy milk', done: false }

      inner.setGetByIdResult({
        data: todo,
        meta: { id: '1', updatedAt: 1000, revision: '1' },
        hasLocalChanges: false,
        cacheKey: deriveScopeKey({ scopeType: 'ck' }),
      })

      const value = await firstValueFrom(
        stableQm
          .watchById<Todo>({ collection: 'todos', id: '1', cacheKey: TODOS_CACHE_KEY })
          .pipe(timeout(100)),
      )

      expect(value).toBe(todo)
    })

    it('reuses stable reference on update with same revision', async () => {
      const todo: Todo = { id: '1', title: 'Buy milk', done: false }

      inner.setGetByIdResult({
        data: todo,
        meta: { id: '1', updatedAt: 1000, revision: '1' },
        hasLocalChanges: false,
        cacheKey: deriveScopeKey({ scopeType: 'ck' }),
      })

      const values: (Todo | undefined)[] = []

      stableQm
        .watchById<Todo>({ collection: 'todos', id: '1', cacheKey: TODOS_CACHE_KEY })
        .subscribe((v) => {
          values.push(v)
        })

      // Wait for initial value
      await new Promise((r) => setTimeout(r, 10))
      expect(values).toHaveLength(1)

      // Emit update with new object but same revision
      const todoCopy: Todo = { id: '1', title: 'Buy milk', done: false }
      inner.setGetByIdResult({
        data: todoCopy,
        meta: { id: '1', updatedAt: 1000, revision: '1' },
        hasLocalChanges: false,
        cacheKey: deriveScopeKey({ scopeType: 'ck' }),
      })
      inner.emitCollectionUpdate(['1'])

      await new Promise((r) => setTimeout(r, 10))

      // distinctUntilChanged should suppress emission since reference is the same
      expect(values).toHaveLength(1)
    })

    it('emits new value when revision changes', async () => {
      inner.setGetByIdResult({
        data: { id: '1', title: 'Old', done: false },
        meta: { id: '1', updatedAt: 1000, revision: '1' },
        hasLocalChanges: false,
        cacheKey: deriveScopeKey({ scopeType: 'ck' }),
      })

      const values: (Todo | undefined)[] = []

      stableQm
        .watchById<Todo>({ collection: 'todos', id: '1', cacheKey: TODOS_CACHE_KEY })
        .subscribe((v) => {
          values.push(v)
        })

      await new Promise((r) => setTimeout(r, 10))

      // Emit update with changed revision
      const updated: Todo = { id: '1', title: 'New', done: false }
      inner.setGetByIdResult({
        data: updated,
        meta: { id: '1', updatedAt: 2000, revision: '2' },
        hasLocalChanges: false,
        cacheKey: deriveScopeKey({ scopeType: 'ck' }),
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
      await stableQm.touch(TODOS_CACHE_KEY)
      expect(spy).toHaveBeenCalledWith(TODOS_CACHE_KEY)
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
        meta: [{ id: '1', updatedAt: 1000, revision: '1' }],
        total: 1,
        hasLocalChanges: false,
        cacheKey: deriveScopeKey({ scopeType: 'ck' }),
      })
      await stableQm.list<Todo>({ collection: 'todos', cacheKey: TODOS_CACHE_KEY })

      await stableQm.destroy()

      expect(destroySpy).toHaveBeenCalled()

      // After destroy, a new list call should not reuse old references
      stableQm = new StableRefQueryManager(inner)
      const todo: Todo = { id: '1', title: 'A', done: false }
      inner.setListResult({
        data: [todo],
        meta: [{ id: '1', updatedAt: 1000, revision: '1' }],
        total: 1,
        hasLocalChanges: false,
        cacheKey: deriveScopeKey({ scopeType: 'ck' }),
      })
      const result = await stableQm.list<Todo>({ collection: 'todos', cacheKey: TODOS_CACHE_KEY })
      expect(result.data[0]).toBe(todo)
    })
  })
})
