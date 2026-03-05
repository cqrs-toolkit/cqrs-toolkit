/**
 * Unit tests for createItemQuery.
 */

import type { IQueryManager, QueryOptions, QueryResult } from '@cqrs-toolkit/client'
import { Subject } from 'rxjs'
import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { createItemQuery } from './createItemQuery.js'

interface Todo {
  id: string
  title: string
  done: boolean
}

const TODO_A: Todo = { id: '1', title: 'Buy milk', done: false }
const TODO_B: Todo = { id: '2', title: 'Walk dog', done: true }

function createMockQueryManager() {
  const collectionUpdate$ = new Subject<string[]>()
  let getByIdResult: QueryResult<Todo>
  const holdSpy = vi.fn<IQueryManager['hold']>().mockResolvedValue(undefined)
  const releaseSpy = vi.fn<IQueryManager['release']>().mockResolvedValue(undefined)
  const getByIdSpy = vi.fn<IQueryManager['getById']>()

  const qm: IQueryManager = {
    async getById<T>(
      _collection: string,
      _id: string,
      options?: QueryOptions,
    ): Promise<QueryResult<T>> {
      getByIdSpy(_collection, _id, options)
      return getByIdResult as unknown as QueryResult<T>
    },
    async list() {
      throw new Error('Not used in item tests')
    },
    async getByIds() {
      throw new Error('Not used in item tests')
    },
    watchCollection() {
      return collectionUpdate$.asObservable()
    },
    watchById() {
      throw new Error('Not used in item tests')
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
    setGetByIdResult(result: QueryResult<Todo>) {
      getByIdResult = result
    },
    holdSpy,
    releaseSpy,
    getByIdSpy,
  }
}

function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0))
}

describe('createItemQuery', () => {
  it('fetches initially and transitions loading to false', async () => {
    const { qm, setGetByIdResult } = createMockQueryManager()

    setGetByIdResult({
      data: TODO_A,
      meta: { id: '1', updatedAt: 1000 },
      hasLocalChanges: false,
      cacheKey: 'ck-todos-1',
    })

    await createRoot(async (dispose) => {
      const state = createItemQuery<Todo>(qm, 'todos', () => '1')

      expect(state.loading).toBe(true)
      expect(state.data).toBeUndefined()

      await tick()

      expect(state.loading).toBe(false)
      expect(state.data?.id).toBe('1')
      expect(state.data?.title).toBe('Buy milk')
      expect(state.hasLocalChanges).toBe(false)
      expect(state.error).toBeUndefined()

      dispose()
    })
  })

  it('handles not-found (data undefined)', async () => {
    const { qm, setGetByIdResult } = createMockQueryManager()

    setGetByIdResult({
      data: undefined,
      meta: undefined,
      hasLocalChanges: false,
      cacheKey: 'ck-todos-missing',
    })

    await createRoot(async (dispose) => {
      const state = createItemQuery<Todo>(qm, 'todos', () => 'missing')
      await tick()

      expect(state.loading).toBe(false)
      expect(state.data).toBeUndefined()

      dispose()
    })
  })

  it('refetches on watchCollection emission matching ID', async () => {
    const { qm, setGetByIdResult, collectionUpdate$ } = createMockQueryManager()

    setGetByIdResult({
      data: TODO_A,
      meta: { id: '1', updatedAt: 1000 },
      hasLocalChanges: false,
      cacheKey: 'ck-todos-1',
    })

    await createRoot(async (dispose) => {
      const state = createItemQuery<Todo>(qm, 'todos', () => '1')
      await tick()

      expect(state.data?.title).toBe('Buy milk')

      // Update and emit
      const updated: Todo = { id: '1', title: 'Buy oat milk', done: false }
      setGetByIdResult({
        data: updated,
        meta: { id: '1', updatedAt: 2000 },
        hasLocalChanges: false,
        cacheKey: 'ck-todos-1',
      })
      collectionUpdate$.next(['1'])
      await tick()

      expect(state.data?.title).toBe('Buy oat milk')

      dispose()
    })
  })

  it('ignores emissions for other IDs', async () => {
    const { qm, setGetByIdResult, collectionUpdate$, getByIdSpy } = createMockQueryManager()

    setGetByIdResult({
      data: TODO_A,
      meta: { id: '1', updatedAt: 1000 },
      hasLocalChanges: false,
      cacheKey: 'ck-todos-1',
    })

    await createRoot(async (dispose) => {
      createItemQuery<Todo>(qm, 'todos', () => '1')
      await tick()

      const callCountAfterInit = getByIdSpy.mock.calls.length

      // Emit for a different ID
      collectionUpdate$.next(['2', '3'])
      await tick()

      // Should not have triggered another fetch
      expect(getByIdSpy.mock.calls.length).toBe(callCountAfterInit)

      dispose()
    })
  })

  it('re-subscribes and releases old cache key on ID change', async () => {
    const { qm, setGetByIdResult, releaseSpy } = createMockQueryManager()

    setGetByIdResult({
      data: TODO_A,
      meta: { id: '1', updatedAt: 1000 },
      hasLocalChanges: false,
      cacheKey: 'ck-todos-1',
    })

    await createRoot(async (dispose) => {
      const [id, setId] = createSignal('1')
      const state = createItemQuery<Todo>(qm, 'todos', id)
      await tick()

      expect(state.data?.id).toBe('1')

      // Switch to a new ID
      setGetByIdResult({
        data: TODO_B,
        meta: { id: '2', updatedAt: 2000 },
        hasLocalChanges: false,
        cacheKey: 'ck-todos-2',
      })
      setId('2')
      await tick()

      // Old cache key should be released
      expect(releaseSpy).toHaveBeenCalledWith('ck-todos-1')

      expect(state.data?.id).toBe('2')
      expect(state.data?.title).toBe('Walk dog')

      dispose()
    })
  })

  it('resets loading to true on ID change', async () => {
    const { qm, setGetByIdResult } = createMockQueryManager()

    let resolveSecondFetch: ((result: QueryResult<Todo>) => void) | undefined
    let callCount = 0

    setGetByIdResult({
      data: TODO_A,
      meta: { id: '1', updatedAt: 1000 },
      hasLocalChanges: false,
      cacheKey: 'ck-todos-1',
    })

    await createRoot(async (dispose) => {
      const [id, setId] = createSignal('1')
      const state = createItemQuery<Todo>(qm, 'todos', id)
      await tick()

      expect(state.loading).toBe(false)

      // Override getById to capture second fetch
      qm.getById = <T>(): Promise<QueryResult<T>> => {
        callCount++
        return new Promise<QueryResult<T>>((resolve) => {
          resolveSecondFetch = resolve as unknown as (result: QueryResult<Todo>) => void
        })
      }

      setId('2')
      await tick()

      // Loading should be true while second fetch is pending
      expect(state.loading).toBe(true)

      // Resolve
      resolveSecondFetch?.({
        data: TODO_B,
        meta: { id: '2', updatedAt: 2000 },
        hasLocalChanges: false,
        cacheKey: 'ck-todos-2',
      })
      await tick()

      expect(state.loading).toBe(false)
      expect(callCount).toBe(1)

      dispose()
    })
  })

  it('surfaces errors in store.error', async () => {
    const { qm } = createMockQueryManager()

    const testError = new Error('Network failure')
    qm.getById = () => Promise.reject(testError)

    await createRoot(async (dispose) => {
      const state = createItemQuery<Todo>(qm, 'todos', () => '1')
      await tick()

      expect(state.error).toBe(testError)
      expect(state.loading).toBe(false)

      dispose()
    })
  })

  it('holds cache key and releases on dispose', async () => {
    const { qm, setGetByIdResult, releaseSpy } = createMockQueryManager()

    setGetByIdResult({
      data: TODO_A,
      meta: { id: '1', updatedAt: 1000 },
      hasLocalChanges: false,
      cacheKey: 'ck-todos-1',
    })

    await createRoot(async (dispose) => {
      createItemQuery<Todo>(qm, 'todos', () => '1')
      await tick()

      expect(releaseSpy).not.toHaveBeenCalled()

      dispose()

      expect(releaseSpy).toHaveBeenCalledWith('ck-todos-1')
    })
  })

  it('unsubscribes on dispose', async () => {
    const { qm, setGetByIdResult, collectionUpdate$ } = createMockQueryManager()

    setGetByIdResult({
      data: TODO_A,
      meta: { id: '1', updatedAt: 1000 },
      hasLocalChanges: false,
      cacheKey: 'ck-todos-1',
    })

    await createRoot(async (dispose) => {
      createItemQuery<Todo>(qm, 'todos', () => '1')
      await tick()

      expect(collectionUpdate$.observed).toBe(true)

      dispose()

      expect(collectionUpdate$.observed).toBe(false)
    })
  })

  it('discards stale responses on concurrent ID changes', async () => {
    const { qm } = createMockQueryManager()

    const resolvers: Array<(result: QueryResult<Todo>) => void> = []

    qm.getById = <T>(): Promise<QueryResult<T>> => {
      return new Promise<QueryResult<T>>((resolve) => {
        resolvers.push(resolve as unknown as (result: QueryResult<Todo>) => void)
      })
    }

    await createRoot(async (dispose) => {
      const [id, setId] = createSignal('1')
      const state = createItemQuery<Todo>(qm, 'todos', id)
      await tick()

      // Switch ID before first fetch resolves
      setId('2')
      await tick()

      // Resolve first (stale) fetch
      resolvers[0]?.({
        data: TODO_A,
        meta: { id: '1', updatedAt: 1000 },
        hasLocalChanges: false,
        cacheKey: 'ck-todos-1',
      })
      await tick()

      // Should be ignored
      expect(state.data).toBeUndefined()

      // Resolve second (current) fetch
      resolvers[1]?.({
        data: TODO_B,
        meta: { id: '2', updatedAt: 2000 },
        hasLocalChanges: false,
        cacheKey: 'ck-todos-2',
      })
      await tick()

      expect(state.data?.id).toBe('2')

      dispose()
    })
  })

  it('passes through query options with hold always true', async () => {
    const { qm, setGetByIdResult, getByIdSpy } = createMockQueryManager()

    setGetByIdResult({
      data: TODO_A,
      meta: { id: '1', updatedAt: 1000 },
      hasLocalChanges: false,
      cacheKey: 'ck-todos-1',
    })

    await createRoot(async (dispose) => {
      createItemQuery<Todo>(qm, 'todos', () => '1', { scope: 'user-1' })
      await tick()

      expect(getByIdSpy).toHaveBeenCalledWith('todos', '1', {
        hold: true,
        scope: 'user-1',
      })

      dispose()
    })
  })
})
