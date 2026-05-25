/**
 * Unit tests for createListQuery.
 */

import type {
  CollectionSignal,
  CqrsClient,
  EnqueueCommand,
  IQueryManager,
  LibraryEvent,
  ListFilter,
  ListParams,
  ListQueryResult,
  ScopeCacheKey,
} from '@cqrs-toolkit/client'
import { deriveScopeKey } from '@cqrs-toolkit/client'
import { ServiceLink } from '@meticoeus/ddd-es'
import { Subject } from 'rxjs'
import { createComponent, createRoot, createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { CqrsContext } from './context.js'
import { createListQuery } from './createListQuery.js'

interface Todo {
  id: string
  title: string
  done: boolean
}

const TODO_A: Todo = { id: '1', title: 'Buy milk', done: false }
const TODO_B: Todo = { id: '2', title: 'Walk dog', done: true }

function scopeKey(key: string): ScopeCacheKey {
  return { kind: 'scope', key, scopeType: 'test' }
}

function createMockQueryManager() {
  const collectionUpdate$ = new Subject<CollectionSignal>()
  let listResult: ListQueryResult<ServiceLink, Todo>
  const holdSpy = vi.fn<IQueryManager<ServiceLink>['hold']>().mockResolvedValue(undefined)
  const releaseSpy = vi.fn<IQueryManager<ServiceLink>['release']>().mockResolvedValue(undefined)
  const listSpy = vi.fn<IQueryManager<ServiceLink>['list']>()

  const qm: IQueryManager<ServiceLink> = {
    async list<T>(params: ListParams<ServiceLink>): Promise<ListQueryResult<ServiceLink, T>> {
      listSpy(params)
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
    watchList() {
      throw new Error('Not used in list tests — these cover the pull `list` + watchCollection path')
    },
    async getView() {
      throw new Error('Not used in list tests')
    },
    watchView() {
      throw new Error('Not used in list tests')
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

type TClient = CqrsClient<ServiceLink, EnqueueCommand>

function createMockClient(qm: IQueryManager<ServiceLink>): TClient {
  const client: Pick<TClient, 'queryManager' | 'events$'> = {
    queryManager: qm,
    events$: new Subject<LibraryEvent<ServiceLink>>().asObservable(),
  }
  return client as TClient
}

function withContext(client: TClient, fn: (dispose: () => void) => Promise<void>): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    createRoot((dispose) => {
      createComponent(CqrsContext.Provider, {
        value: client,
        get children() {
          fn(dispose).then(resolve, reject)
          return undefined
        },
      })
    })
  })
}

function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0))
}

const TODOS_KEY = deriveScopeKey({ scopeType: 'todos' })

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

    await withContext(createMockClient(qm), async (dispose) => {
      const state = createListQuery<ServiceLink, Todo>({
        collection: 'todos',
        cacheKey: TODOS_KEY,
      })

      expect(state.loading).toBe(true)
      expect(state.items).toHaveLength(0)

      await tick()

      expect(state.loading).toBe(false)
      expect(state.items).toHaveLength(2)
      expect(state.items[0]?.title).toBe('Buy milk')
      expect(state.items[1]?.title).toBe('Walk dog')
      expect(state.total).toBe(2)
      expect(state.hasLocalChanges).toBe(false)
      expect(state.state.status).toBe('ready')

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

    await withContext(createMockClient(qm), async (dispose) => {
      const state = createListQuery<ServiceLink, Todo>({
        collection: 'todos',
        cacheKey: TODOS_KEY,
      })
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
      collectionUpdate$.next({ type: 'updated', ids: ['2'], commandIds: [] })

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

    await withContext(createMockClient(qm), async (dispose) => {
      const state = createListQuery<ServiceLink, Todo>({
        collection: 'todos',
        cacheKey: TODOS_KEY,
      })
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
      collectionUpdate$.next({ type: 'updated', ids: ['2'], commandIds: [] })

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

    await withContext(createMockClient(qm), async (dispose) => {
      createListQuery<ServiceLink, Todo>({
        collection: 'todos',
        cacheKey: TODOS_KEY,
      })
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

    await withContext(createMockClient(qm), async (dispose) => {
      createListQuery<ServiceLink, Todo>({
        collection: 'todos',
        cacheKey: TODOS_KEY,
      })
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

    await withContext(createMockClient(qm), async (dispose) => {
      const state = createListQuery<ServiceLink, Todo>({
        collection: 'todos',
        cacheKey: TODOS_KEY,
      })

      // Wait for initial fetch to be started
      await tick()
      expect(callCount).toBe(1)

      // Trigger a second fetch before first resolves
      collectionUpdate$.next({ type: 'updated', ids: ['1'], commandIds: [] })
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

  it('surfaces seed-failed state on initial fetch error', async () => {
    const { qm } = createMockQueryManager()

    qm.list = () => Promise.reject(new Error('Network failure'))

    await withContext(createMockClient(qm), async (dispose) => {
      const state = createListQuery<ServiceLink, Todo>({
        collection: 'todos',
        cacheKey: TODOS_KEY,
      })
      await tick()

      expect(state.state).toEqual({ status: 'seed-failed', error: 'Network failure' })
      expect(state.loading).toBe(false)

      dispose()
    })
  })

  it('populates items on refetch after seed-failed', async () => {
    const { qm, setListResult, collectionUpdate$ } = createMockQueryManager()

    qm.list = () => Promise.reject(new Error('Network failure'))

    await withContext(createMockClient(qm), async (dispose) => {
      const state = createListQuery<ServiceLink, Todo>({
        collection: 'todos',
        cacheKey: TODOS_KEY,
      })
      await tick()

      expect(state.state).toEqual({ status: 'seed-failed', error: 'Network failure' })

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

      collectionUpdate$.next({ type: 'updated', ids: ['1'], commandIds: [] })
      await tick()

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

    await withContext(createMockClient(qm), async (dispose) => {
      createListQuery<ServiceLink, Todo>({
        collection: 'todos',
        cacheKey: TODOS_KEY,
        limit: 10,
        offset: 5,
      })
      await tick()

      expect(listSpy).toHaveBeenCalledWith({
        collection: 'todos',
        hold: true,
        cacheKey: TODOS_KEY,
        limit: 10,
        offset: 5,
      })

      dispose()
    })
  })

  it('re-subscribes and releases old cache key when cacheKey accessor changes', async () => {
    const { qm, setListResult, releaseSpy, listSpy } = createMockQueryManager()

    const keyA = scopeKey('ck-a')
    const keyB = scopeKey('ck-b')

    setListResult({
      data: [TODO_A],
      meta: [{ id: '1', updatedAt: 1000 }],
      total: 1,
      hasLocalChanges: false,
      cacheKey: keyA,
    })

    await withContext(createMockClient(qm), async (dispose) => {
      const [key, setKey] = createSignal<ScopeCacheKey>(keyA)
      const state = createListQuery<ServiceLink, Todo>({
        collection: 'todos',
        cacheKey: key,
      })
      await tick()

      expect(state.items).toHaveLength(1)
      expect(listSpy).toHaveBeenCalledWith({
        collection: 'todos',
        hold: true,
        cacheKey: keyA,
      })

      // Switch cache key
      setListResult({
        data: [TODO_A, TODO_B],
        meta: [
          { id: '1', updatedAt: 1000 },
          { id: '2', updatedAt: 2000 },
        ],
        total: 2,
        hasLocalChanges: false,
        cacheKey: keyB,
      })
      setKey(keyB)
      await tick()

      // Old cache key should be released
      expect(releaseSpy).toHaveBeenCalledWith('ck-a')
      expect(state.items).toHaveLength(2)

      dispose()
    })
  })

  it('refetches with new params when sort accessor changes — without releasing the cache key', async () => {
    const { qm, setListResult, releaseSpy, listSpy } = createMockQueryManager()

    setListResult({
      data: [TODO_A],
      meta: [{ id: '1', updatedAt: 1000 }],
      total: 1,
      hasLocalChanges: false,
      cacheKey: TODOS_KEY,
    })

    await withContext(createMockClient(qm), async (dispose) => {
      const [sort, setSort] = createSignal<ListParams<ServiceLink>['sort']>([
        { column: 'updated_at', direction: 'desc' },
      ])
      const state = createListQuery<ServiceLink, Todo>({
        collection: 'todos',
        cacheKey: TODOS_KEY,
        sort,
      })
      await tick()

      // Initial fetch picked up the starting sort.
      expect(listSpy).toHaveBeenLastCalledWith({
        collection: 'todos',
        hold: true,
        cacheKey: TODOS_KEY,
        limit: undefined,
        offset: undefined,
        sort: [{ column: 'updated_at', direction: 'desc' }],
        filter: undefined,
      })
      expect(state.loading).toBe(false)
      expect(state.items).toHaveLength(1)

      // Change the sort — should refetch with the new value.
      setListResult({
        data: [TODO_B, TODO_A],
        meta: [
          { id: '2', updatedAt: 2000 },
          { id: '1', updatedAt: 1000 },
        ],
        total: 2,
        hasLocalChanges: false,
        cacheKey: TODOS_KEY,
      })
      setSort([{ column: 'title', direction: 'asc' }])
      await tick()

      expect(listSpy).toHaveBeenLastCalledWith({
        collection: 'todos',
        hold: true,
        cacheKey: TODOS_KEY,
        limit: undefined,
        offset: undefined,
        sort: [{ column: 'title', direction: 'asc' }],
        filter: undefined,
      })
      expect(state.items).toHaveLength(2)

      // The cache key must not have been released — sort changes are
      // in-session refetches, not session restarts.
      expect(releaseSpy).not.toHaveBeenCalled()

      dispose()
    })
  })

  it('keeps the loading flag stable across a sort-driven refetch', async () => {
    // Sort changes route through the same in-session fetch path as
    // watchCollection signals do — they must not flip `loading` back to
    // true, otherwise consumers would see a flash of empty/loading UI on
    // every UI-driven sort tweak.
    const { qm, setListResult } = createMockQueryManager()

    setListResult({
      data: [TODO_A],
      meta: [{ id: '1', updatedAt: 1000 }],
      total: 1,
      hasLocalChanges: false,
      cacheKey: TODOS_KEY,
    })

    await withContext(createMockClient(qm), async (dispose) => {
      const [sort, setSort] = createSignal<ListParams<ServiceLink>['sort']>([
        { column: 'updated_at', direction: 'desc' },
      ])
      const state = createListQuery<ServiceLink, Todo>({
        collection: 'todos',
        cacheKey: TODOS_KEY,
        sort,
      })
      await tick()
      expect(state.loading).toBe(false)
      expect(state.state.status).toBe('ready')

      setSort([{ column: 'title', direction: 'asc' }])
      // Don't tick yet — the fetch is in flight. The store should still
      // be showing the previous items and ready state.
      expect(state.loading).toBe(false)
      expect(state.state.status).toBe('ready')
      expect(state.items).toHaveLength(1)

      await tick()
      expect(state.loading).toBe(false)
      expect(state.state.status).toBe('ready')
    })
  })

  it('keeps the watchCollection subscription attached across a sort change', async () => {
    // Sort changes must not unsubscribe and resubscribe — that drops any
    // optimization the QueryManager makes around subscription identity
    // and would shuffle WS topic state on top of the cache-key churn.
    const { qm, setListResult, collectionUpdate$: signal$ } = createMockQueryManager()

    setListResult({
      data: [TODO_A],
      meta: [{ id: '1', updatedAt: 1000 }],
      total: 1,
      hasLocalChanges: false,
      cacheKey: TODOS_KEY,
    })

    await withContext(createMockClient(qm), async (dispose) => {
      const [sort, setSort] = createSignal<ListParams<ServiceLink>['sort']>([
        { column: 'updated_at', direction: 'desc' },
      ])
      createListQuery<ServiceLink, Todo>({
        collection: 'todos',
        cacheKey: TODOS_KEY,
        get sort() {
          return sort()
        },
      })
      await tick()
      expect(signal$.observed).toBe(true)

      setSort([{ column: 'title', direction: 'asc' }])
      await tick()

      // Subscription still attached — the same Subject is still observed.
      expect(signal$.observed).toBe(true)

      dispose()
    })
  })

  it('refetches when the filter accessor changes — without releasing the cache key', async () => {
    const { qm, setListResult, releaseSpy, listSpy } = createMockQueryManager()

    setListResult({
      data: [],
      meta: [],
      total: 0,
      hasLocalChanges: false,
      cacheKey: TODOS_KEY,
    })

    await withContext(createMockClient(qm), async (dispose) => {
      const [filter, setFilter] = createSignal<ListFilter | undefined>(undefined)
      createListQuery<ServiceLink, Todo>({
        collection: 'todos',
        cacheKey: TODOS_KEY,
        filter,
      })
      await tick()
      const initialCalls = listSpy.mock.calls.length

      const nextFilter: ListFilter = {
        params: { done: true },
        memory: (row) => (row as Todo).done,
        sql: () => ({ sql: 'done = 1', bindings: [] }),
      }
      setFilter(nextFilter)
      await tick()

      expect(listSpy.mock.calls.length).toBeGreaterThan(initialCalls)
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ filter: nextFilter, cacheKey: TODOS_KEY }),
      )
      expect(releaseSpy).not.toHaveBeenCalled()

      dispose()
    })
  })

  it('shows loading state when cacheKey accessor returns undefined', async () => {
    const { qm, setListResult, listSpy } = createMockQueryManager()

    setListResult({
      data: [TODO_A],
      meta: [{ id: '1', updatedAt: 1000 }],
      total: 1,
      hasLocalChanges: false,
      cacheKey: TODOS_KEY,
    })

    await withContext(createMockClient(qm), async (dispose) => {
      const [key, setKey] = createSignal<ScopeCacheKey | undefined>(undefined)
      const state = createListQuery<ServiceLink, Todo>({
        collection: 'todos',
        cacheKey: key,
      })

      // No fetch should have been made
      expect(listSpy).not.toHaveBeenCalled()
      expect(state.loading).toBe(true)
      expect(state.items).toHaveLength(0)

      await tick()

      // Still loading — no active query
      expect(state.loading).toBe(true)
      expect(state.items).toHaveLength(0)

      // Now provide a cache key
      setKey(TODOS_KEY)
      await tick()

      expect(state.loading).toBe(false)
      expect(state.items).toHaveLength(1)

      dispose()
    })
  })
})
