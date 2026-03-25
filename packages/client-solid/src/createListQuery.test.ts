/**
 * Unit tests for createListQuery.
 */

import type {
  IQueryManager,
  ListQueryResult,
  QueryOptions,
  ScopeCacheKey,
} from '@cqrs-toolkit/client'
import { ServiceLink } from '@meticoeus/ddd-es'
import { Subject } from 'rxjs'
import { createRoot } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { createListQuery } from './createListQuery.js'

interface Todo {
  id: string
  title: string
  done: boolean
}

const TODO_A: Todo = { id: '1', title: 'Buy milk', done: false }
const TODO_B: Todo = { id: '2', title: 'Walk dog', done: true }

function scopeKey(key: string): ScopeCacheKey {
  return { kind: 'scope', key, scopeType: 'test' } as unknown as ScopeCacheKey
}

function createMockQueryManager() {
  const collectionUpdate$ = new Subject<string[]>()
  let listResult: ListQueryResult<ServiceLink, Todo>
  const holdSpy = vi.fn<IQueryManager<ServiceLink>['hold']>().mockResolvedValue(undefined)
  const releaseSpy = vi.fn<IQueryManager<ServiceLink>['release']>().mockResolvedValue(undefined)
  const listSpy = vi.fn<IQueryManager<ServiceLink>['list']>()

  const qm: IQueryManager<ServiceLink> = {
    async list<T>(
      _collection: string,
      options?: QueryOptions,
    ): Promise<ListQueryResult<ServiceLink, T>> {
      listSpy(_collection, options)
      return listResult as unknown as ListQueryResult<ServiceLink, T>
    },
    async getById() {
      throw new Error('Not used in list tests')
    },
    async getByIds() {
      throw new Error('Not used in list tests')
    },
    watchCollection() {
      return collectionUpdate$.asObservable()
    },
    watchById() {
      throw new Error('Not used in list tests')
    },
    async exists() {
      return true
    },
    async count() {
      return 0
    },
    async touch() {},
    hold: holdSpy,
    release: releaseSpy,
    async releaseAll() {},
    async destroy() {},
  }

  return {
    qm,
    collectionUpdate$,
    setListResult(result: ListQueryResult<ServiceLink, Todo>) {
      listResult = result
    },
    holdSpy,
    releaseSpy,
    listSpy,
  }
}

function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0))
}

describe('createListQuery', () => {
  it('fetches initially and transitions loading to false', async () => {
    const { qm, setListResult } = createMockQueryManager()

    setListResult({
      data: [TODO_A, TODO_B],
      meta: [
        { id: '1', updatedAt: 1000 },
        { id: '2', updatedAt: 2000 },
      ],
      total: 2,
      hasLocalChanges: false,
      cacheKey: scopeKey('ck-todos'),
    })

    await createRoot(async (dispose) => {
      const state = createListQuery<ServiceLink, Todo>(qm, 'todos')

      expect(state.loading).toBe(true)
      expect(state.items).toHaveLength(0)

      await tick()

      expect(state.loading).toBe(false)
      expect(state.items).toHaveLength(2)
      expect(state.items[0]?.title).toBe('Buy milk')
      expect(state.items[1]?.title).toBe('Walk dog')
      expect(state.total).toBe(2)
      expect(state.hasLocalChanges).toBe(false)
      expect(state.error).toBeUndefined()

      dispose()
    })
  })

  it('subscribes to watchCollection and refetches on update', async () => {
    const { qm, setListResult, collectionUpdate$ } = createMockQueryManager()

    setListResult({
      data: [TODO_A],
      meta: [{ id: '1', updatedAt: 1000 }],
      total: 1,
      hasLocalChanges: false,
      cacheKey: scopeKey('ck-todos'),
    })

    await createRoot(async (dispose) => {
      const state = createListQuery<ServiceLink, Todo>(qm, 'todos')
      await tick()

      expect(state.items).toHaveLength(1)

      // Update result and emit collection change
      setListResult({
        data: [TODO_A, TODO_B],
        meta: [
          { id: '1', updatedAt: 1000 },
          { id: '2', updatedAt: 2000 },
        ],
        total: 2,
        hasLocalChanges: false,
        cacheKey: scopeKey('ck-todos'),
      })
      collectionUpdate$.next(['2'])

      await tick()

      expect(state.items).toHaveLength(2)
      expect(state.total).toBe(2)

      dispose()
    })
  })

  it('does not toggle loading on subsequent refetches', async () => {
    const { qm, setListResult, collectionUpdate$ } = createMockQueryManager()

    setListResult({
      data: [TODO_A],
      meta: [{ id: '1', updatedAt: 1000 }],
      total: 1,
      hasLocalChanges: false,
      cacheKey: scopeKey('ck-todos'),
    })

    await createRoot(async (dispose) => {
      const state = createListQuery<ServiceLink, Todo>(qm, 'todos')
      await tick()

      expect(state.loading).toBe(false)

      // Trigger refetch — loading should stay false
      setListResult({
        data: [TODO_A, TODO_B],
        meta: [
          { id: '1', updatedAt: 1000 },
          { id: '2', updatedAt: 2000 },
        ],
        total: 2,
        hasLocalChanges: false,
        cacheKey: scopeKey('ck-todos'),
      })
      collectionUpdate$.next(['2'])

      // Loading should not have been set back to true
      expect(state.loading).toBe(false)

      await tick()

      expect(state.loading).toBe(false)

      dispose()
    })
  })

  it('holds cache key on first fetch and releases on dispose', async () => {
    const { qm, setListResult, releaseSpy } = createMockQueryManager()

    setListResult({
      data: [TODO_A],
      meta: [{ id: '1', updatedAt: 1000 }],
      total: 1,
      hasLocalChanges: false,
      cacheKey: scopeKey('ck-todos'),
    })

    await createRoot(async (dispose) => {
      createListQuery<ServiceLink, Todo>(qm, 'todos')
      await tick()

      expect(releaseSpy).not.toHaveBeenCalled()

      dispose()

      expect(releaseSpy).toHaveBeenCalledWith('ck-todos')
    })
  })

  it('unsubscribes on dispose', async () => {
    const { qm, setListResult, collectionUpdate$ } = createMockQueryManager()

    setListResult({
      data: [TODO_A],
      meta: [{ id: '1', updatedAt: 1000 }],
      total: 1,
      hasLocalChanges: false,
      cacheKey: scopeKey('ck-todos'),
    })

    await createRoot(async (dispose) => {
      createListQuery<ServiceLink, Todo>(qm, 'todos')
      await tick()

      expect(collectionUpdate$.observed).toBe(true)

      dispose()

      expect(collectionUpdate$.observed).toBe(false)
    })
  })

  it('discards stale responses from concurrent fetches', async () => {
    const { qm, collectionUpdate$ } = createMockQueryManager()

    let callCount = 0
    const resolvers: Array<(result: ListQueryResult<ServiceLink, Todo>) => void> = []

    // Override list to capture resolve callbacks
    qm.list = <T>(): Promise<ListQueryResult<ServiceLink, T>> => {
      callCount++
      return new Promise<ListQueryResult<ServiceLink, T>>((resolve) => {
        resolvers.push(resolve as unknown as (result: ListQueryResult<ServiceLink, Todo>) => void)
      })
    }

    await createRoot(async (dispose) => {
      const state = createListQuery<ServiceLink, Todo>(qm, 'todos')

      // Wait for initial fetch to be started
      await tick()
      expect(callCount).toBe(1)

      // Trigger a second fetch before first resolves
      collectionUpdate$.next(['1'])
      await tick()
      expect(callCount).toBe(2)

      // Resolve first (stale) fetch
      resolvers[0]?.({
        data: [TODO_A],
        meta: [{ id: '1', updatedAt: 1000 }],
        total: 1,
        hasLocalChanges: false,
        cacheKey: scopeKey('ck-todos'),
      })
      await tick()

      // Should be ignored — items still empty (loading)
      expect(state.items).toHaveLength(0)

      // Resolve second (current) fetch
      resolvers[1]?.({
        data: [TODO_A, TODO_B],
        meta: [
          { id: '1', updatedAt: 1000 },
          { id: '2', updatedAt: 2000 },
        ],
        total: 2,
        hasLocalChanges: false,
        cacheKey: scopeKey('ck-todos'),
      })
      await tick()

      expect(state.items).toHaveLength(2)

      dispose()
    })
  })

  it('surfaces errors in store.error and clears on next success', async () => {
    const { qm, setListResult, collectionUpdate$ } = createMockQueryManager()

    const testError = new Error('Network failure')
    qm.list = () => Promise.reject(testError)

    await createRoot(async (dispose) => {
      const state = createListQuery<ServiceLink, Todo>(qm, 'todos')
      await tick()

      expect(state.error).toBe(testError)
      expect(state.loading).toBe(false)

      // Fix the error and refetch
      setListResult({
        data: [TODO_A],
        meta: [{ id: '1', updatedAt: 1000 }],
        total: 1,
        hasLocalChanges: false,
        cacheKey: scopeKey('ck-todos'),
      })
      qm.list = async <T>(): Promise<ListQueryResult<ServiceLink, T>> => {
        return (await Promise.resolve(
          setListResult as unknown as ListQueryResult<ServiceLink, T>,
        )) as unknown as ListQueryResult<ServiceLink, T>
      }
      // Restore proper list implementation
      const origQm = createMockQueryManager()
      origQm.setListResult({
        data: [TODO_A],
        meta: [{ id: '1', updatedAt: 1000 }],
        total: 1,
        hasLocalChanges: false,
        cacheKey: scopeKey('ck-todos'),
      })
      qm.list = origQm.qm.list.bind(origQm.qm)

      collectionUpdate$.next(['1'])
      await tick()

      expect(state.error).toBeUndefined()
      expect(state.items).toHaveLength(1)

      dispose()
    })
  })

  it('passes through query options with hold always true', async () => {
    const { qm, setListResult, listSpy } = createMockQueryManager()

    setListResult({
      data: [],
      meta: [],
      total: 0,
      hasLocalChanges: false,
      cacheKey: scopeKey('ck-todos'),
    })

    await createRoot(async (dispose) => {
      createListQuery<ServiceLink, Todo>(qm, 'todos', { limit: 10, offset: 5 })
      await tick()

      expect(listSpy).toHaveBeenCalledWith('todos', {
        hold: true,
        limit: 10,
        offset: 5,
      })

      dispose()
    })
  })
})
