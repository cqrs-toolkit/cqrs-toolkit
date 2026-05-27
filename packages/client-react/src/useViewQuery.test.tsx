/**
 * Unit tests for useViewQuery.
 *
 * Ported from `client-solid`'s `createViewQuery.test.ts`. One Solid-only
 * assertion (store-object identity preservation across emissions via
 * `reconcile`) is dropped — React replaces `items` with a fresh array on
 * each emission; consumers preserve identity by stable `key` props on the
 * consuming list.
 */

import type {
  CqrsClient,
  EnqueueCommand,
  GetViewParams,
  IQueryManager,
  LibraryEvent,
  PagedViewResult,
  ScopeCacheKey,
} from '@cqrs-toolkit/client'
import { ServiceLink } from '@meticoeus/ddd-es'
import { act, renderHook } from '@testing-library/react'
import { type ReactNode } from 'react'
import { Observable, Subject } from 'rxjs'
import { describe, expect, it, vi } from 'vitest'
import { CqrsContext } from './context.js'
import { useViewQuery } from './useViewQuery.js'

interface ProjectRow {
  id: string
  workspaceId: string
  title: string
}

function scopeKey(key: string): ScopeCacheKey {
  return { kind: 'scope', key, scopeType: 'test' }
}

interface MockViewBundle {
  qm: IQueryManager<ServiceLink>
  push(result: PagedViewResult<ServiceLink, ProjectRow>): void
  pushError(err: unknown): void
  subscriptionCount(): number
  holdSpy: ReturnType<typeof vi.fn<IQueryManager<ServiceLink>['hold']>>
  releaseSpy: ReturnType<typeof vi.fn<IQueryManager<ServiceLink>['release']>>
}

function createMockViewQueryManager(): MockViewBundle {
  const subjects: Subject<PagedViewResult<ServiceLink, ProjectRow>>[] = []
  const holdSpy = vi.fn<IQueryManager<ServiceLink>['hold']>().mockResolvedValue(undefined)
  const releaseSpy = vi.fn<IQueryManager<ServiceLink>['release']>().mockResolvedValue(undefined)
  const qm: IQueryManager<ServiceLink> = {
    async list() {
      throw new Error('Not used in view tests')
    },
    async getById() {
      throw new Error('Not used in view tests')
    },
    async getByIds() {
      throw new Error('Not used in view tests')
    },
    watchCollection() {
      throw new Error('Not used in view tests')
    },
    watchById() {
      throw new Error('Not used in view tests')
    },
    watchList() {
      throw new Error('Not used in view tests')
    },
    async getView() {
      throw new Error('Not used in view tests')
    },
    watchView<T>(_params: GetViewParams) {
      return new Observable<PagedViewResult<ServiceLink, T>>((subscriber) => {
        const subject = new Subject<PagedViewResult<ServiceLink, ProjectRow>>()
        subjects.push(subject)
        const innerSub = subject.subscribe({
          next: (result) => subscriber.next(result as unknown as PagedViewResult<ServiceLink, T>),
          error: (e) => subscriber.error(e),
        })
        return () => {
          innerSub.unsubscribe()
          const i = subjects.indexOf(subject)
          if (i >= 0) subjects.splice(i, 1)
        }
      })
    },
    async getLocallyById() {
      return undefined
    },
    async exists() {
      return false
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
    push(result) {
      const subject = subjects[subjects.length - 1]
      subject?.next(result)
    },
    pushError(err) {
      const subject = subjects[subjects.length - 1]
      subject?.error(err)
    },
    subscriptionCount() {
      return subjects.length
    },
    holdSpy,
    releaseSpy,
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

interface HookProps {
  view: string
  params: { workspaceId: string } | undefined
}

describe('useViewQuery', () => {
  it('starts in loading state and transitions to ready on first emission', async () => {
    const bundle = createMockViewQueryManager()
    const { result, unmount } = renderHook(
      (props: HookProps) => useViewQuery<ServiceLink, ProjectRow, { workspaceId: string }>(props),
      {
        initialProps: { view: 'projects-in-workspace', params: { workspaceId: 'w1' } },
        wrapper: wrapperFor(createMockClient(bundle.qm)),
      },
    )

    expect(result.current.loading).toBe(true)
    expect(result.current.items).toHaveLength(0)
    expect(result.current.state.status).toBe('loading')

    await act(async () => {
      bundle.push({
        data: [
          { id: 'p1', workspaceId: 'w1', title: 'Alpha' },
          { id: 'p2', workspaceId: 'w1', title: 'Beta' },
        ],
        cacheKeys: [scopeKey('ck')],
      })
      await tick()
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.state.status).toBe('ready')
    expect(result.current.items).toHaveLength(2)
    expect(result.current.items.map((i) => i.title)).toEqual(['Alpha', 'Beta'])

    unmount()
  })

  it('reflects updated row data across emissions', async () => {
    const bundle = createMockViewQueryManager()
    const { result, unmount } = renderHook(
      (props: HookProps) => useViewQuery<ServiceLink, ProjectRow, { workspaceId: string }>(props),
      {
        initialProps: { view: 'projects-in-workspace', params: { workspaceId: 'w1' } },
        wrapper: wrapperFor(createMockClient(bundle.qm)),
      },
    )

    await act(async () => {
      bundle.push({
        data: [{ id: 'p1', workspaceId: 'w1', title: 'Alpha' }],
        cacheKeys: [scopeKey('ck')],
      })
      await tick()
    })

    await act(async () => {
      bundle.push({
        data: [{ id: 'p1', workspaceId: 'w1', title: 'Alpha v2' }],
        cacheKeys: [scopeKey('ck')],
      })
      await tick()
    })
    expect(result.current.items[0]?.title).toBe('Alpha v2')

    // Note: client-solid asserts the row reference is preserved across the
    // emission via `reconcile`. React replaces `items` wholesale; consumers
    // preserve identity by using a stable `key` prop (e.g., `row.id`) on the
    // consuming list element.

    unmount()
  })

  it('restarts the subscription when params change', async () => {
    const bundle = createMockViewQueryManager()
    const { rerender, unmount } = renderHook(
      (props: HookProps) => useViewQuery<ServiceLink, ProjectRow, { workspaceId: string }>(props),
      {
        initialProps: { view: 'projects-in-workspace', params: { workspaceId: 'w1' } },
        wrapper: wrapperFor(createMockClient(bundle.qm)),
      },
    )

    await act(async () => {
      await tick()
    })
    expect(bundle.subscriptionCount()).toBe(1)

    await act(async () => {
      rerender({ view: 'projects-in-workspace', params: { workspaceId: 'w2' } })
      await tick()
    })
    // Previous session torn down, new one started.
    expect(bundle.subscriptionCount()).toBe(1)

    unmount()
  })

  it('enters the inactive loading state when params is undefined', async () => {
    const bundle = createMockViewQueryManager()
    const initialProps: HookProps = {
      view: 'projects-in-workspace',
      params: { workspaceId: 'w1' },
    }
    const { result, rerender, unmount } = renderHook(
      (props: HookProps) => useViewQuery<ServiceLink, ProjectRow, { workspaceId: string }>(props),
      {
        initialProps,
        wrapper: wrapperFor(createMockClient(bundle.qm)),
      },
    )

    await act(async () => {
      bundle.push({
        data: [{ id: 'p1', workspaceId: 'w1', title: 'A' }],
        cacheKeys: [scopeKey('ck')],
      })
      await tick()
    })
    expect(result.current.items).toHaveLength(1)

    await act(async () => {
      rerender({ view: 'projects-in-workspace', params: undefined })
      await tick()
    })
    expect(result.current.items).toHaveLength(0)
    expect(result.current.loading).toBe(true)
    expect(result.current.state.status).toBe('loading')
    expect(bundle.subscriptionCount()).toBe(0)

    unmount()
  })

  it('exposes total when the underlying result carries it', async () => {
    const bundle = createMockViewQueryManager()
    const { result, unmount } = renderHook(
      (props: HookProps) => useViewQuery<ServiceLink, ProjectRow, { workspaceId: string }>(props),
      {
        initialProps: { view: 'projects-in-workspace', params: { workspaceId: 'w1' } },
        wrapper: wrapperFor(createMockClient(bundle.qm)),
      },
    )

    await act(async () => {
      bundle.push({
        data: [{ id: 'p1', workspaceId: 'w1', title: 'Alpha' }],
        cacheKeys: [scopeKey('ck')],
        total: 42,
      })
      await tick()
    })
    expect(result.current.total).toBe(42)

    await act(async () => {
      bundle.push({
        data: [{ id: 'p1', workspaceId: 'w1', title: 'Alpha' }],
        cacheKeys: [scopeKey('ck')],
      })
      await tick()
    })
    expect(result.current.total).toBeUndefined()

    unmount()
  })

  it('reports errors via the error state', async () => {
    const bundle = createMockViewQueryManager()
    const { result, unmount } = renderHook(
      (props: HookProps) => useViewQuery<ServiceLink, ProjectRow, { workspaceId: string }>(props),
      {
        initialProps: { view: 'projects-in-workspace', params: { workspaceId: 'w1' } },
        wrapper: wrapperFor(createMockClient(bundle.qm)),
      },
    )
    await act(async () => {
      bundle.pushError(new Error('view failed'))
      await tick()
    })
    expect(result.current.state.status).toBe('error')
    if (result.current.state.status === 'error') {
      expect(result.current.state.error).toBe('view failed')
    }
    expect(result.current.loading).toBe(false)

    unmount()
  })

  it('tears down the subscription on dispose', async () => {
    const bundle = createMockViewQueryManager()
    const { unmount } = renderHook(
      (props: HookProps) => useViewQuery<ServiceLink, ProjectRow, { workspaceId: string }>(props),
      {
        initialProps: { view: 'projects-in-workspace', params: { workspaceId: 'w1' } },
        wrapper: wrapperFor(createMockClient(bundle.qm)),
      },
    )
    await act(async () => {
      await tick()
    })
    expect(bundle.subscriptionCount()).toBe(1)
    unmount()
    await act(async () => {
      await tick()
    })
    expect(bundle.subscriptionCount()).toBe(0)
  })

  it('holds every resolved cache key on first emission', async () => {
    const bundle = createMockViewQueryManager()
    const { unmount } = renderHook(
      (props: HookProps) => useViewQuery<ServiceLink, ProjectRow, { workspaceId: string }>(props),
      {
        initialProps: { view: 'projects-in-workspace', params: { workspaceId: 'w1' } },
        wrapper: wrapperFor(createMockClient(bundle.qm)),
      },
    )

    await act(async () => {
      bundle.push({
        data: [{ id: 'p1', workspaceId: 'w1', title: 'Alpha' }],
        cacheKeys: [scopeKey('ck-a'), scopeKey('ck-b')],
      })
      await tick()
    })

    expect(bundle.holdSpy).toHaveBeenCalledTimes(2)
    expect(bundle.holdSpy).toHaveBeenCalledWith('ck-a')
    expect(bundle.holdSpy).toHaveBeenCalledWith('ck-b')
    expect(bundle.releaseSpy).not.toHaveBeenCalled()

    unmount()
  })

  it('releases every held key on dispose', async () => {
    const bundle = createMockViewQueryManager()
    const { unmount } = renderHook(
      (props: HookProps) => useViewQuery<ServiceLink, ProjectRow, { workspaceId: string }>(props),
      {
        initialProps: { view: 'projects-in-workspace', params: { workspaceId: 'w1' } },
        wrapper: wrapperFor(createMockClient(bundle.qm)),
      },
    )

    await act(async () => {
      bundle.push({
        data: [{ id: 'p1', workspaceId: 'w1', title: 'Alpha' }],
        cacheKeys: [scopeKey('ck-a'), scopeKey('ck-b')],
      })
      await tick()
    })
    bundle.releaseSpy.mockClear()

    unmount()
    await act(async () => {
      await tick()
    })

    expect(bundle.releaseSpy).toHaveBeenCalledTimes(2)
    expect(bundle.releaseSpy).toHaveBeenCalledWith('ck-a')
    expect(bundle.releaseSpy).toHaveBeenCalledWith('ck-b')
  })

  it('skips hold and release for the overlap when the resolved set is unchanged', async () => {
    const bundle = createMockViewQueryManager()
    const { rerender, unmount } = renderHook(
      (props: HookProps) => useViewQuery<ServiceLink, ProjectRow, { workspaceId: string }>(props),
      {
        initialProps: { view: 'projects-in-workspace', params: { workspaceId: 'w1' } },
        wrapper: wrapperFor(createMockClient(bundle.qm)),
      },
    )

    await act(async () => {
      bundle.push({
        data: [{ id: 'p1', workspaceId: 'w1', title: 'Alpha' }],
        cacheKeys: [scopeKey('ck-a'), scopeKey('ck-b')],
      })
      await tick()
    })

    bundle.holdSpy.mockClear()
    bundle.releaseSpy.mockClear()

    // Force a watchView resubscribe by flipping the params, then emit the
    // same cache-key set against the fresh subscription.
    await act(async () => {
      rerender({ view: 'projects-in-workspace', params: { workspaceId: 'w2' } })
      await tick()
    })
    await act(async () => {
      bundle.push({
        data: [{ id: 'p2', workspaceId: 'w2', title: 'Beta' }],
        cacheKeys: [scopeKey('ck-a'), scopeKey('ck-b')],
      })
      await tick()
    })

    // Same resolved set across the subscription boundary — holds persist
    // untouched, no churn.
    expect(bundle.holdSpy).not.toHaveBeenCalled()
    expect(bundle.releaseSpy).not.toHaveBeenCalled()

    unmount()
  })

  it('releases only the keys that left the resolved set on a partial overlap', async () => {
    const bundle = createMockViewQueryManager()
    const { unmount } = renderHook(
      (props: HookProps) => useViewQuery<ServiceLink, ProjectRow, { workspaceId: string }>(props),
      {
        initialProps: { view: 'projects-in-workspace', params: { workspaceId: 'w1' } },
        wrapper: wrapperFor(createMockClient(bundle.qm)),
      },
    )

    // Initial set: {ck-a, ck-b}
    await act(async () => {
      bundle.push({
        data: [{ id: 'p1', workspaceId: 'w1', title: 'Alpha' }],
        cacheKeys: [scopeKey('ck-a'), scopeKey('ck-b')],
      })
      await tick()
    })
    bundle.holdSpy.mockClear()
    bundle.releaseSpy.mockClear()

    // Next emission: {ck-b, ck-c} — drop ck-a, add ck-c, keep ck-b.
    await act(async () => {
      bundle.push({
        data: [{ id: 'p1', workspaceId: 'w1', title: 'Alpha' }],
        cacheKeys: [scopeKey('ck-b'), scopeKey('ck-c')],
      })
      await tick()
    })

    expect(bundle.releaseSpy).toHaveBeenCalledTimes(1)
    expect(bundle.releaseSpy).toHaveBeenCalledWith('ck-a')
    expect(bundle.holdSpy).toHaveBeenCalledTimes(1)
    expect(bundle.holdSpy).toHaveBeenCalledWith('ck-c')

    unmount()
  })
})
