/**
 * Unit tests for useListQuery.
 *
 * Ported from `client-solid`'s `createListQuery.test.ts`. The Solid
 * `withContext + createRoot + createSignal` pattern is replaced with
 * testing-library's `renderHook` + `rerender`. Assertions mirror Solid's
 * one-for-one; the load-bearing ones (subscription continuity and
 * cache-key-hold continuity across sort / filter changes) are called out in
 * the exploration doc at
 * `docs/projects/client-react/explorations/observable-lifetime-across-rerenders.md`.
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
import { act, renderHook } from '@testing-library/react'
import { type ReactNode } from 'react'
import { Subject } from 'rxjs'
import { describe, expect, it, vi } from 'vitest'
import { CqrsContext } from './context.js'
import { useListQuery } from './useListQuery.js'

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

function wrapperFor(client: TClient): (props: { children: ReactNode }) => JSX.Element {
  return ({ children }) => <CqrsContext.Provider value={client}>{children}</CqrsContext.Provider>
}

function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0))
}

const TODOS_KEY = deriveScopeKey({ scopeType: 'todos' })

interface HookProps {
  collection: string
  cacheKey: ScopeCacheKey | undefined
  limit?: number
  offset?: number
  sort?: ListParams<ServiceLink>['sort']
  filter?: ListFilter
}

describe('useListQuery', () => {
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

    const { result, unmount } = renderHook(
      (props: HookProps) => useListQuery<ServiceLink, Todo>(props),
      {
        initialProps: { collection: 'todos', cacheKey: TODOS_KEY },
        wrapper: wrapperFor(createMockClient(qm)),
      },
    )

    expect(result.current.loading).toBe(true)
    expect(result.current.items).toHaveLength(0)

    await act(async () => {
      await tick()
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.items).toHaveLength(2)
    expect(result.current.items[0]?.title).toBe('Buy milk')
    expect(result.current.items[1]?.title).toBe('Walk dog')
    expect(result.current.total).toBe(2)
    expect(result.current.hasLocalChanges).toBe(false)
    expect(result.current.state.status).toBe('ready')

    unmount()
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

    const { result, unmount } = renderHook(
      (props: HookProps) => useListQuery<ServiceLink, Todo>(props),
      {
        initialProps: { collection: 'todos', cacheKey: TODOS_KEY },
        wrapper: wrapperFor(createMockClient(qm)),
      },
    )

    await act(async () => {
      await tick()
    })

    expect(result.current.items).toHaveLength(1)

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
    await act(async () => {
      collectionUpdate$.next({ type: 'updated', ids: ['2'], commandIds: [] })
      await tick()
    })

    expect(result.current.items).toHaveLength(2)
    expect(result.current.total).toBe(2)

    unmount()
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

    const { result, unmount } = renderHook(
      (props: HookProps) => useListQuery<ServiceLink, Todo>(props),
      {
        initialProps: { collection: 'todos', cacheKey: TODOS_KEY },
        wrapper: wrapperFor(createMockClient(qm)),
      },
    )

    await act(async () => {
      await tick()
    })
    expect(result.current.loading).toBe(false)

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
    await act(async () => {
      collectionUpdate$.next({ type: 'updated', ids: ['2'], commandIds: [] })
    })

    // Loading should not have been set back to true
    expect(result.current.loading).toBe(false)

    await act(async () => {
      await tick()
    })

    expect(result.current.loading).toBe(false)

    unmount()
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

    const { unmount } = renderHook((props: HookProps) => useListQuery<ServiceLink, Todo>(props), {
      initialProps: { collection: 'todos', cacheKey: TODOS_KEY },
      wrapper: wrapperFor(createMockClient(qm)),
    })

    await act(async () => {
      await tick()
    })

    expect(releaseSpy).not.toHaveBeenCalled()

    unmount()

    expect(releaseSpy).toHaveBeenCalledWith('ck-todos')
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

    const { unmount } = renderHook((props: HookProps) => useListQuery<ServiceLink, Todo>(props), {
      initialProps: { collection: 'todos', cacheKey: TODOS_KEY },
      wrapper: wrapperFor(createMockClient(qm)),
    })

    await act(async () => {
      await tick()
    })

    expect(collectionUpdate$.observed).toBe(true)

    unmount()

    expect(collectionUpdate$.observed).toBe(false)
  })

  it('discards stale responses from concurrent fetches', async () => {
    const { qm, collectionUpdate$ } = createMockQueryManager()

    let callCount = 0
    const resolvers: Array<(result: ListQueryResult<ServiceLink, Todo>) => void> = []

    // Override list to capture resolve callbacks
    qm.list = <T,>(): Promise<ListQueryResult<ServiceLink, T>> => {
      callCount++
      return new Promise<ListQueryResult<ServiceLink, T>>((resolve) => {
        resolvers.push(resolve as unknown as (result: ListQueryResult<ServiceLink, Todo>) => void)
      })
    }

    const { result, unmount } = renderHook(
      (props: HookProps) => useListQuery<ServiceLink, Todo>(props),
      {
        initialProps: { collection: 'todos', cacheKey: TODOS_KEY },
        wrapper: wrapperFor(createMockClient(qm)),
      },
    )

    // Initial fetch should have been started
    await act(async () => {
      await tick()
    })
    expect(callCount).toBe(1)

    // Trigger a second fetch before first resolves
    await act(async () => {
      collectionUpdate$.next({ type: 'updated', ids: ['1'], commandIds: [] })
      await tick()
    })
    expect(callCount).toBe(2)

    // Resolve first (stale) fetch
    await act(async () => {
      resolvers[0]?.({
        data: [TODO_A],
        meta: [{ id: '1', updatedAt: 1000 }],
        total: 1,
        hasLocalChanges: false,
        cacheKey: scopeKey('ck-todos'),
      })
      await tick()
    })

    // Should be ignored — items still empty (loading)
    expect(result.current.items).toHaveLength(0)

    // Resolve second (current) fetch
    await act(async () => {
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
    })

    expect(result.current.items).toHaveLength(2)

    unmount()
  })

  it('surfaces seed-failed state on initial fetch error', async () => {
    const { qm } = createMockQueryManager()

    qm.list = () => Promise.reject(new Error('Network failure'))

    const { result, unmount } = renderHook(
      (props: HookProps) => useListQuery<ServiceLink, Todo>(props),
      {
        initialProps: { collection: 'todos', cacheKey: TODOS_KEY },
        wrapper: wrapperFor(createMockClient(qm)),
      },
    )

    await act(async () => {
      await tick()
    })

    expect(result.current.state).toEqual({ status: 'seed-failed', error: 'Network failure' })
    expect(result.current.loading).toBe(false)

    unmount()
  })

  it('populates items on refetch after seed-failed', async () => {
    const { qm, collectionUpdate$ } = createMockQueryManager()

    qm.list = () => Promise.reject(new Error('Network failure'))

    const { result, unmount } = renderHook(
      (props: HookProps) => useListQuery<ServiceLink, Todo>(props),
      {
        initialProps: { collection: 'todos', cacheKey: TODOS_KEY },
        wrapper: wrapperFor(createMockClient(qm)),
      },
    )

    await act(async () => {
      await tick()
    })

    expect(result.current.state).toEqual({ status: 'seed-failed', error: 'Network failure' })

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

    await act(async () => {
      collectionUpdate$.next({ type: 'updated', ids: ['1'], commandIds: [] })
      await tick()
    })

    expect(result.current.items).toHaveLength(1)

    unmount()
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

    const { unmount } = renderHook((props: HookProps) => useListQuery<ServiceLink, Todo>(props), {
      initialProps: { collection: 'todos', cacheKey: TODOS_KEY, limit: 10, offset: 5 },
      wrapper: wrapperFor(createMockClient(qm)),
    })

    await act(async () => {
      await tick()
    })

    expect(listSpy).toHaveBeenCalledWith({
      collection: 'todos',
      hold: true,
      cacheKey: TODOS_KEY,
      limit: 10,
      offset: 5,
      sort: undefined,
      filter: undefined,
    })

    unmount()
  })

  it('re-subscribes and releases old cache key when cacheKey prop changes', async () => {
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

    const { result, rerender, unmount } = renderHook(
      (props: HookProps) => useListQuery<ServiceLink, Todo>(props),
      {
        initialProps: { collection: 'todos', cacheKey: keyA },
        wrapper: wrapperFor(createMockClient(qm)),
      },
    )

    await act(async () => {
      await tick()
    })

    expect(result.current.items).toHaveLength(1)
    expect(listSpy).toHaveBeenCalledWith({
      collection: 'todos',
      hold: true,
      cacheKey: keyA,
      limit: undefined,
      offset: undefined,
      sort: undefined,
      filter: undefined,
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
    await act(async () => {
      rerender({ collection: 'todos', cacheKey: keyB })
      await tick()
    })

    // Old cache key should be released
    expect(releaseSpy).toHaveBeenCalledWith('ck-a')
    expect(result.current.items).toHaveLength(2)

    unmount()
  })

  it('refetches with new params when sort prop changes — without releasing the cache key', async () => {
    const { qm, setListResult, releaseSpy, listSpy } = createMockQueryManager()

    setListResult({
      data: [TODO_A],
      meta: [{ id: '1', updatedAt: 1000 }],
      total: 1,
      hasLocalChanges: false,
      cacheKey: TODOS_KEY,
    })

    const initialSort: ListParams<ServiceLink>['sort'] = [
      { column: 'updated_at', direction: 'desc' },
    ]

    const { result, rerender, unmount } = renderHook(
      (props: HookProps) => useListQuery<ServiceLink, Todo>(props),
      {
        initialProps: { collection: 'todos', cacheKey: TODOS_KEY, sort: initialSort },
        wrapper: wrapperFor(createMockClient(qm)),
      },
    )

    await act(async () => {
      await tick()
    })

    // Initial fetch picked up the starting sort.
    expect(listSpy).toHaveBeenLastCalledWith({
      collection: 'todos',
      hold: true,
      cacheKey: TODOS_KEY,
      limit: undefined,
      offset: undefined,
      sort: initialSort,
      filter: undefined,
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.items).toHaveLength(1)

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
    const newSort: ListParams<ServiceLink>['sort'] = [{ column: 'title', direction: 'asc' }]
    await act(async () => {
      rerender({ collection: 'todos', cacheKey: TODOS_KEY, sort: newSort })
      await tick()
    })

    expect(listSpy).toHaveBeenLastCalledWith({
      collection: 'todos',
      hold: true,
      cacheKey: TODOS_KEY,
      limit: undefined,
      offset: undefined,
      sort: newSort,
      filter: undefined,
    })
    expect(result.current.items).toHaveLength(2)

    // The cache key must not have been released — sort changes are
    // in-session refetches, not session restarts.
    expect(releaseSpy).not.toHaveBeenCalled()

    unmount()
  })

  it('keeps the loading flag stable across a sort-driven refetch', async () => {
    const { qm, setListResult } = createMockQueryManager()

    setListResult({
      data: [TODO_A],
      meta: [{ id: '1', updatedAt: 1000 }],
      total: 1,
      hasLocalChanges: false,
      cacheKey: TODOS_KEY,
    })

    const initialSort: ListParams<ServiceLink>['sort'] = [
      { column: 'updated_at', direction: 'desc' },
    ]

    const { result, rerender, unmount } = renderHook(
      (props: HookProps) => useListQuery<ServiceLink, Todo>(props),
      {
        initialProps: { collection: 'todos', cacheKey: TODOS_KEY, sort: initialSort },
        wrapper: wrapperFor(createMockClient(qm)),
      },
    )

    await act(async () => {
      await tick()
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.state.status).toBe('ready')

    const newSort: ListParams<ServiceLink>['sort'] = [{ column: 'title', direction: 'asc' }]
    await act(async () => {
      rerender({ collection: 'todos', cacheKey: TODOS_KEY, sort: newSort })
      // Don't await tick — the fetch is in flight. The snapshot should
      // still be showing the previous items and ready state.
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.state.status).toBe('ready')
    expect(result.current.items).toHaveLength(1)

    await act(async () => {
      await tick()
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.state.status).toBe('ready')

    unmount()
  })

  it('keeps the watchCollection subscription attached across a sort change', async () => {
    const { qm, setListResult, collectionUpdate$: signal$ } = createMockQueryManager()

    setListResult({
      data: [TODO_A],
      meta: [{ id: '1', updatedAt: 1000 }],
      total: 1,
      hasLocalChanges: false,
      cacheKey: TODOS_KEY,
    })

    const initialSort: ListParams<ServiceLink>['sort'] = [
      { column: 'updated_at', direction: 'desc' },
    ]

    const { rerender, unmount } = renderHook(
      (props: HookProps) => useListQuery<ServiceLink, Todo>(props),
      {
        initialProps: { collection: 'todos', cacheKey: TODOS_KEY, sort: initialSort },
        wrapper: wrapperFor(createMockClient(qm)),
      },
    )

    await act(async () => {
      await tick()
    })
    expect(signal$.observed).toBe(true)

    const newSort: ListParams<ServiceLink>['sort'] = [{ column: 'title', direction: 'asc' }]
    await act(async () => {
      rerender({ collection: 'todos', cacheKey: TODOS_KEY, sort: newSort })
      await tick()
    })

    // Subscription still attached — the same Subject is still observed.
    expect(signal$.observed).toBe(true)

    unmount()
  })

  it('refetches when the filter prop changes — without releasing the cache key', async () => {
    const { qm, setListResult, releaseSpy, listSpy } = createMockQueryManager()

    setListResult({
      data: [],
      meta: [],
      total: 0,
      hasLocalChanges: false,
      cacheKey: TODOS_KEY,
    })

    const initialProps: HookProps = {
      collection: 'todos',
      cacheKey: TODOS_KEY,
      filter: undefined,
    }
    const { rerender, unmount } = renderHook(
      (props: HookProps) => useListQuery<ServiceLink, Todo>(props),
      {
        initialProps,
        wrapper: wrapperFor(createMockClient(qm)),
      },
    )

    await act(async () => {
      await tick()
    })
    const initialCalls = listSpy.mock.calls.length

    const nextFilter: ListFilter = {
      params: { done: true },
      memory: (row) => (row as Todo).done,
      sql: () => ({ sql: 'done = 1', bindings: [] }),
    }
    await act(async () => {
      rerender({ collection: 'todos', cacheKey: TODOS_KEY, filter: nextFilter })
      await tick()
    })

    expect(listSpy.mock.calls.length).toBeGreaterThan(initialCalls)
    expect(listSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ filter: nextFilter, cacheKey: TODOS_KEY }),
    )
    expect(releaseSpy).not.toHaveBeenCalled()

    unmount()
  })

  it('shows loading state when cacheKey is undefined', async () => {
    const { qm, setListResult, listSpy } = createMockQueryManager()

    setListResult({
      data: [TODO_A],
      meta: [{ id: '1', updatedAt: 1000 }],
      total: 1,
      hasLocalChanges: false,
      cacheKey: TODOS_KEY,
    })

    const initialProps: HookProps = { collection: 'todos', cacheKey: undefined }
    const { result, rerender, unmount } = renderHook(
      (props: HookProps) => useListQuery<ServiceLink, Todo>(props),
      {
        initialProps,
        wrapper: wrapperFor(createMockClient(qm)),
      },
    )

    // No fetch should have been made
    expect(listSpy).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(true)
    expect(result.current.items).toHaveLength(0)

    await act(async () => {
      await tick()
    })

    // Still loading — no active query
    expect(result.current.loading).toBe(true)
    expect(result.current.items).toHaveLength(0)

    // Now provide a cache key
    await act(async () => {
      rerender({ collection: 'todos', cacheKey: TODOS_KEY })
      await tick()
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.items).toHaveLength(1)

    unmount()
  })
})
