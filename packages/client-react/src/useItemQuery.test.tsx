/**
 * Unit tests for useItemQuery.
 *
 * Ported from `client-solid`'s `createItemQuery.test.ts`.
 */

import type {
  CollectionSignal,
  CqrsClient,
  EnqueueCommand,
  GetByIdParams,
  IQueryManager,
  LibraryEvent,
  QueryResult,
  ScopeCacheKey,
} from '@cqrs-toolkit/client'
import { deriveScopeKey } from '@cqrs-toolkit/client'
import { ServiceLink } from '@meticoeus/ddd-es'
import { act, renderHook } from '@testing-library/react'
import { type ReactNode } from 'react'
import { Observable, Subject } from 'rxjs'
import { describe, expect, it, vi } from 'vitest'
import { CqrsContext } from './context.js'
import { useItemQuery } from './useItemQuery.js'

interface Todo {
  id: string
  title: string
  done: boolean
}

const TODO_A: Todo = { id: '1', title: 'Buy milk', done: false }
const TODO_B: Todo = { id: '2', title: 'Walk dog', done: true }

const TODOS_CACHE_KEY = deriveScopeKey({ scopeType: 'todos' })

function scopeKey(key: string): ScopeCacheKey {
  return { kind: 'scope', key, scopeType: 'test' }
}

function createMockQueryManager() {
  const collectionUpdate$ = new Subject<CollectionSignal>()
  let getByIdResult: QueryResult<ServiceLink, Todo>
  const holdSpy = vi.fn<IQueryManager<ServiceLink>['hold']>().mockResolvedValue(undefined)
  const releaseSpy = vi.fn<IQueryManager<ServiceLink>['release']>().mockResolvedValue(undefined)
  const getByIdSpy = vi.fn<IQueryManager<ServiceLink>['getById']>()

  const qm: IQueryManager<ServiceLink> = {
    async getById<T>(params: GetByIdParams<ServiceLink>): Promise<QueryResult<ServiceLink, T>> {
      getByIdSpy(params)
      return getByIdResult as unknown as QueryResult<ServiceLink, T>
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
    watchList() {
      throw new Error('Not used in item tests')
    },
    async getView() {
      throw new Error('Not used in item tests')
    },
    watchView() {
      throw new Error('Not used in item tests')
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
    setGetByIdResult(result: QueryResult<ServiceLink, Todo>) {
      getByIdResult = result
    },
    holdSpy,
    releaseSpy,
    getByIdSpy,
  }
}

type TClient = CqrsClient<ServiceLink, EnqueueCommand>

function createMockClient(
  qm: IQueryManager<ServiceLink>,
  events$?: Observable<LibraryEvent<ServiceLink>>,
): TClient {
  const client: Pick<TClient, 'queryManager' | 'events$'> = {
    queryManager: qm,
    events$: events$ ?? new Subject<LibraryEvent<ServiceLink>>().asObservable(),
  }
  return client as TClient
}

function wrapperFor(client: TClient): (props: { children: ReactNode }) => JSX.Element {
  return ({ children }) => <CqrsContext.Provider value={client}>{children}</CqrsContext.Provider>
}

function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0))
}

interface HookProps {
  collection: string
  id: string
  cacheKey: ScopeCacheKey | undefined
}

describe('useItemQuery', () => {
  it('fetches initially and transitions loading to false', async () => {
    const { qm, setGetByIdResult } = createMockQueryManager()

    setGetByIdResult({
      data: TODO_A,
      meta: { id: '1', updatedAt: 1000 },
      hasLocalChanges: false,
      cacheKey: scopeKey('ck-todos-1'),
    })

    const { result, unmount } = renderHook(
      (props: HookProps) => useItemQuery<ServiceLink, Todo>(props),
      {
        initialProps: { collection: 'todos', id: '1', cacheKey: TODOS_CACHE_KEY },
        wrapper: wrapperFor(createMockClient(qm)),
      },
    )

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeUndefined()

    await act(async () => {
      await tick()
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.data?.id).toBe('1')
    expect(result.current.data?.title).toBe('Buy milk')
    expect(result.current.hasLocalChanges).toBe(false)
    expect(result.current.error).toBeUndefined()

    unmount()
  })

  it('passes id through to getById', async () => {
    const { qm, setGetByIdResult, getByIdSpy } = createMockQueryManager()

    setGetByIdResult({
      data: TODO_A,
      meta: { id: '1', updatedAt: 1000 },
      hasLocalChanges: false,
      cacheKey: scopeKey('ck-todos-1'),
    })

    const { result, unmount } = renderHook(
      (props: HookProps) => useItemQuery<ServiceLink, Todo>(props),
      {
        initialProps: { collection: 'todos', id: '1', cacheKey: TODOS_CACHE_KEY },
        wrapper: wrapperFor(createMockClient(qm)),
      },
    )
    await act(async () => {
      await tick()
    })

    expect(result.current.data?.id).toBe('1')
    expect(getByIdSpy).toHaveBeenCalledWith({
      collection: 'todos',
      id: '1',
      cacheKey: TODOS_CACHE_KEY,
      hold: true,
    })

    unmount()
  })

  it('handles not-found (data undefined)', async () => {
    const { qm, setGetByIdResult } = createMockQueryManager()

    setGetByIdResult({
      data: undefined,
      meta: undefined,
      hasLocalChanges: false,
      cacheKey: scopeKey('ck-todos-missing'),
    })

    const { result, unmount } = renderHook(
      (props: HookProps) => useItemQuery<ServiceLink, Todo>(props),
      {
        initialProps: { collection: 'todos', id: 'missing', cacheKey: TODOS_CACHE_KEY },
        wrapper: wrapperFor(createMockClient(qm)),
      },
    )
    await act(async () => {
      await tick()
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeUndefined()

    unmount()
  })

  it('refetches on watchCollection emission matching ID', async () => {
    const { qm, setGetByIdResult, collectionUpdate$ } = createMockQueryManager()

    setGetByIdResult({
      data: TODO_A,
      meta: { id: '1', updatedAt: 1000 },
      hasLocalChanges: false,
      cacheKey: scopeKey('ck-todos-1'),
    })

    const { result, unmount } = renderHook(
      (props: HookProps) => useItemQuery<ServiceLink, Todo>(props),
      {
        initialProps: { collection: 'todos', id: '1', cacheKey: TODOS_CACHE_KEY },
        wrapper: wrapperFor(createMockClient(qm)),
      },
    )
    await act(async () => {
      await tick()
    })

    expect(result.current.data?.title).toBe('Buy milk')

    const updated: Todo = { id: '1', title: 'Buy oat milk', done: false }
    setGetByIdResult({
      data: updated,
      meta: { id: '1', updatedAt: 2000 },
      hasLocalChanges: false,
      cacheKey: scopeKey('ck-todos-1'),
    })
    await act(async () => {
      collectionUpdate$.next({ type: 'updated', ids: ['1'], commandIds: [] })
      await tick()
    })

    expect(result.current.data?.title).toBe('Buy oat milk')

    unmount()
  })

  it('ignores emissions for other IDs', async () => {
    const { qm, setGetByIdResult, collectionUpdate$, getByIdSpy } = createMockQueryManager()

    setGetByIdResult({
      data: TODO_A,
      meta: { id: '1', updatedAt: 1000 },
      hasLocalChanges: false,
      cacheKey: scopeKey('ck-todos-1'),
    })

    const { unmount } = renderHook((props: HookProps) => useItemQuery<ServiceLink, Todo>(props), {
      initialProps: { collection: 'todos', id: '1', cacheKey: TODOS_CACHE_KEY },
      wrapper: wrapperFor(createMockClient(qm)),
    })
    await act(async () => {
      await tick()
    })

    const callCountAfterInit = getByIdSpy.mock.calls.length

    await act(async () => {
      collectionUpdate$.next({ type: 'updated', ids: ['2', '3'], commandIds: [] })
      await tick()
    })

    expect(getByIdSpy.mock.calls.length).toBe(callCountAfterInit)

    unmount()
  })

  it('re-subscribes and releases old cache key on ID change', async () => {
    const { qm, setGetByIdResult, releaseSpy } = createMockQueryManager()

    setGetByIdResult({
      data: TODO_A,
      meta: { id: '1', updatedAt: 1000 },
      hasLocalChanges: false,
      cacheKey: scopeKey('ck-todos-1'),
    })

    const { result, rerender, unmount } = renderHook(
      (props: HookProps) => useItemQuery<ServiceLink, Todo>(props),
      {
        initialProps: { collection: 'todos', id: '1', cacheKey: TODOS_CACHE_KEY },
        wrapper: wrapperFor(createMockClient(qm)),
      },
    )
    await act(async () => {
      await tick()
    })

    expect(result.current.data?.id).toBe('1')

    setGetByIdResult({
      data: TODO_B,
      meta: { id: '2', updatedAt: 2000 },
      hasLocalChanges: false,
      cacheKey: scopeKey('ck-todos-2'),
    })
    await act(async () => {
      rerender({ collection: 'todos', id: '2', cacheKey: TODOS_CACHE_KEY })
      await tick()
    })

    expect(releaseSpy).toHaveBeenCalledWith('ck-todos-1')

    expect(result.current.data?.id).toBe('2')
    expect(result.current.data?.title).toBe('Walk dog')

    unmount()
  })

  it('resets loading to true on ID change', async () => {
    const { qm, setGetByIdResult } = createMockQueryManager()

    let resolveSecondFetch: ((result: QueryResult<ServiceLink, Todo>) => void) | undefined
    let callCount = 0

    setGetByIdResult({
      data: TODO_A,
      meta: { id: '1', updatedAt: 1000 },
      hasLocalChanges: false,
      cacheKey: scopeKey('ck-todos-1'),
    })

    const { result, rerender, unmount } = renderHook(
      (props: HookProps) => useItemQuery<ServiceLink, Todo>(props),
      {
        initialProps: { collection: 'todos', id: '1', cacheKey: TODOS_CACHE_KEY },
        wrapper: wrapperFor(createMockClient(qm)),
      },
    )
    await act(async () => {
      await tick()
    })

    expect(result.current.loading).toBe(false)

    // Override getById to capture second fetch
    qm.getById = <T,>(): Promise<QueryResult<ServiceLink, T>> => {
      callCount++
      return new Promise<QueryResult<ServiceLink, T>>((resolve) => {
        resolveSecondFetch = resolve as unknown as (result: QueryResult<ServiceLink, Todo>) => void
      })
    }

    await act(async () => {
      rerender({ collection: 'todos', id: '2', cacheKey: TODOS_CACHE_KEY })
      await tick()
    })

    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolveSecondFetch?.({
        data: TODO_B,
        meta: { id: '2', updatedAt: 2000 },
        hasLocalChanges: false,
        cacheKey: scopeKey('ck-todos-2'),
      })
      await tick()
    })

    expect(result.current.loading).toBe(false)
    expect(callCount).toBe(1)

    unmount()
  })

  it('surfaces errors on the error field', async () => {
    const { qm } = createMockQueryManager()

    const testError = new Error('Network failure')
    qm.getById = () => Promise.reject(testError)

    const { result, unmount } = renderHook(
      (props: HookProps) => useItemQuery<ServiceLink, Todo>(props),
      {
        initialProps: { collection: 'todos', id: '1', cacheKey: TODOS_CACHE_KEY },
        wrapper: wrapperFor(createMockClient(qm)),
      },
    )
    await act(async () => {
      await tick()
    })

    expect(result.current.error).toBe(testError)
    expect(result.current.loading).toBe(false)

    unmount()
  })

  it('holds cache key and releases on dispose', async () => {
    const { qm, setGetByIdResult, releaseSpy } = createMockQueryManager()

    setGetByIdResult({
      data: TODO_A,
      meta: { id: '1', updatedAt: 1000 },
      hasLocalChanges: false,
      cacheKey: scopeKey('ck-todos-1'),
    })

    const { unmount } = renderHook((props: HookProps) => useItemQuery<ServiceLink, Todo>(props), {
      initialProps: { collection: 'todos', id: '1', cacheKey: TODOS_CACHE_KEY },
      wrapper: wrapperFor(createMockClient(qm)),
    })
    await act(async () => {
      await tick()
    })

    expect(releaseSpy).not.toHaveBeenCalled()

    unmount()

    expect(releaseSpy).toHaveBeenCalledWith('ck-todos-1')
  })

  it('unsubscribes on dispose', async () => {
    const { qm, setGetByIdResult, collectionUpdate$ } = createMockQueryManager()

    setGetByIdResult({
      data: TODO_A,
      meta: { id: '1', updatedAt: 1000 },
      hasLocalChanges: false,
      cacheKey: scopeKey('ck-todos-1'),
    })

    const { unmount } = renderHook((props: HookProps) => useItemQuery<ServiceLink, Todo>(props), {
      initialProps: { collection: 'todos', id: '1', cacheKey: TODOS_CACHE_KEY },
      wrapper: wrapperFor(createMockClient(qm)),
    })
    await act(async () => {
      await tick()
    })

    expect(collectionUpdate$.observed).toBe(true)

    unmount()

    expect(collectionUpdate$.observed).toBe(false)
  })

  it('discards stale responses on concurrent ID changes', async () => {
    const { qm } = createMockQueryManager()

    const resolvers: Array<(result: QueryResult<ServiceLink, Todo>) => void> = []

    qm.getById = <T,>(): Promise<QueryResult<ServiceLink, T>> => {
      return new Promise<QueryResult<ServiceLink, T>>((resolve) => {
        resolvers.push(resolve as unknown as (result: QueryResult<ServiceLink, Todo>) => void)
      })
    }

    const { result, rerender, unmount } = renderHook(
      (props: HookProps) => useItemQuery<ServiceLink, Todo>(props),
      {
        initialProps: { collection: 'todos', id: '1', cacheKey: TODOS_CACHE_KEY },
        wrapper: wrapperFor(createMockClient(qm)),
      },
    )
    await act(async () => {
      await tick()
    })

    // Switch ID before first fetch resolves
    await act(async () => {
      rerender({ collection: 'todos', id: '2', cacheKey: TODOS_CACHE_KEY })
      await tick()
    })

    // Resolve first (stale) fetch
    await act(async () => {
      resolvers[0]?.({
        data: TODO_A,
        meta: { id: '1', updatedAt: 1000 },
        hasLocalChanges: false,
        cacheKey: scopeKey('ck-todos-1'),
      })
      await tick()
    })

    // Should be ignored
    expect(result.current.data).toBeUndefined()

    // Resolve second (current) fetch
    await act(async () => {
      resolvers[1]?.({
        data: TODO_B,
        meta: { id: '2', updatedAt: 2000 },
        hasLocalChanges: false,
        cacheKey: scopeKey('ck-todos-2'),
      })
      await tick()
    })

    expect(result.current.data?.id).toBe('2')

    unmount()
  })

  it('passes through query options with hold always true', async () => {
    const { qm, setGetByIdResult, getByIdSpy } = createMockQueryManager()

    setGetByIdResult({
      data: TODO_A,
      meta: { id: '1', updatedAt: 1000 },
      hasLocalChanges: false,
      cacheKey: scopeKey('ck-todos-1'),
    })

    const { unmount } = renderHook((props: HookProps) => useItemQuery<ServiceLink, Todo>(props), {
      initialProps: { collection: 'todos', id: '1', cacheKey: TODOS_CACHE_KEY },
      wrapper: wrapperFor(createMockClient(qm)),
    })
    await act(async () => {
      await tick()
    })

    expect(getByIdSpy).toHaveBeenCalledWith({
      collection: 'todos',
      id: '1',
      cacheKey: TODOS_CACHE_KEY,
      hold: true,
    })

    unmount()
  })
})
