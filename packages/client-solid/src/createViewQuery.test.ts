/**
 * Unit tests for createViewQuery.
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
import { Observable, Subject } from 'rxjs'
import { createComponent, createRoot, createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { CqrsContext } from './context.js'
import { createViewQuery } from './createViewQuery.js'

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
  // Each subscription gets its own subject (mirrors per-subscription state
  // in the real watchView).
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
      // Emit to the most-recent live subscription (matches the per-call
      // session lifecycle of createViewQuery).
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

describe('createViewQuery', () => {
  it('starts in loading state and transitions to ready on first emission', async () => {
    const bundle = createMockViewQueryManager()
    await withContext(createMockClient(bundle.qm), async (dispose) => {
      const state = createViewQuery<ServiceLink, ProjectRow, { workspaceId: string }>({
        view: 'projects-in-workspace',
        params: { workspaceId: 'w1' },
      })

      expect(state.loading).toBe(true)
      expect(state.items).toHaveLength(0)
      expect(state.state.status).toBe('loading')

      bundle.push({
        data: [
          { id: 'p1', workspaceId: 'w1', title: 'Alpha' },
          { id: 'p2', workspaceId: 'w1', title: 'Beta' },
        ],
        cacheKeys: [scopeKey('ck')],
      })

      await tick()
      expect(state.loading).toBe(false)
      expect(state.state.status).toBe('ready')
      expect(state.items).toHaveLength(2)
      expect(state.items.map((i) => i.title)).toEqual(['Alpha', 'Beta'])

      dispose()
    })
  })

  it('reconciles rows by id across emissions for stable refs', async () => {
    const bundle = createMockViewQueryManager()
    await withContext(createMockClient(bundle.qm), async (dispose) => {
      const state = createViewQuery<ServiceLink, ProjectRow, { workspaceId: string }>({
        view: 'projects-in-workspace',
        params: { workspaceId: 'w1' },
      })

      const initial = { id: 'p1', workspaceId: 'w1', title: 'Alpha' }
      bundle.push({ data: [initial], cacheKeys: [scopeKey('ck')] })
      await tick()
      const firstRef = state.items[0]

      bundle.push({
        data: [{ id: 'p1', workspaceId: 'w1', title: 'Alpha v2' }],
        cacheKeys: [scopeKey('ck')],
      })
      await tick()
      expect(state.items[0]?.title).toBe('Alpha v2')
      // Reconcile { merge: true } keeps the same store-object proxy when the
      // key matches, even though the underlying title changed.
      expect(state.items[0]).toBe(firstRef)

      dispose()
    })
  })

  it('restarts the subscription when reactive params change', async () => {
    const bundle = createMockViewQueryManager()
    const [workspaceId, setWorkspaceId] = createSignal('w1')

    await withContext(createMockClient(bundle.qm), async (dispose) => {
      createViewQuery<ServiceLink, ProjectRow, { workspaceId: string }>({
        view: 'projects-in-workspace',
        params: () => ({ workspaceId: workspaceId() }),
      })
      await tick()
      expect(bundle.subscriptionCount()).toBe(1)

      setWorkspaceId('w2')
      await tick()
      // Previous session torn down, new one started.
      expect(bundle.subscriptionCount()).toBe(1)

      dispose()
    })
  })

  it('enters the inactive loading state when params accessor returns undefined', async () => {
    const bundle = createMockViewQueryManager()
    const [paramsOpt, setParamsOpt] = createSignal<{ workspaceId: string } | undefined>({
      workspaceId: 'w1',
    })

    await withContext(createMockClient(bundle.qm), async (dispose) => {
      const state = createViewQuery<ServiceLink, ProjectRow, { workspaceId: string }>({
        view: 'projects-in-workspace',
        params: paramsOpt,
      })

      bundle.push({
        data: [{ id: 'p1', workspaceId: 'w1', title: 'A' }],
        cacheKeys: [scopeKey('ck')],
      })
      await tick()
      expect(state.items).toHaveLength(1)

      setParamsOpt(undefined)
      await tick()
      // Subscription torn down; store reset to loading + empty.
      expect(state.items).toHaveLength(0)
      expect(state.loading).toBe(true)
      expect(state.state.status).toBe('loading')
      expect(bundle.subscriptionCount()).toBe(0)

      dispose()
    })
  })

  it('exposes total when the underlying result carries it', async () => {
    const bundle = createMockViewQueryManager()
    await withContext(createMockClient(bundle.qm), async (dispose) => {
      const state = createViewQuery<ServiceLink, ProjectRow, { workspaceId: string }>({
        view: 'projects-in-workspace',
        params: { workspaceId: 'w1' },
      })

      bundle.push({
        data: [{ id: 'p1', workspaceId: 'w1', title: 'Alpha' }],
        cacheKeys: [scopeKey('ck')],
        total: 42,
      })
      await tick()
      expect(state.total).toBe(42)

      // Subsequent emission without total resets to undefined.
      bundle.push({
        data: [{ id: 'p1', workspaceId: 'w1', title: 'Alpha' }],
        cacheKeys: [scopeKey('ck')],
      })
      await tick()
      expect(state.total).toBeUndefined()

      dispose()
    })
  })

  it('reports errors via the error state', async () => {
    const bundle = createMockViewQueryManager()
    await withContext(createMockClient(bundle.qm), async (dispose) => {
      const state = createViewQuery<ServiceLink, ProjectRow, { workspaceId: string }>({
        view: 'projects-in-workspace',
        params: { workspaceId: 'w1' },
      })
      bundle.pushError(new Error('view failed'))
      await tick()
      expect(state.state.status).toBe('error')
      if (state.state.status === 'error') {
        expect(state.state.error).toBe('view failed')
      }
      expect(state.loading).toBe(false)

      dispose()
    })
  })

  it('tears down the subscription on dispose', async () => {
    const bundle = createMockViewQueryManager()
    await withContext(createMockClient(bundle.qm), async (dispose) => {
      createViewQuery<ServiceLink, ProjectRow, { workspaceId: string }>({
        view: 'projects-in-workspace',
        params: { workspaceId: 'w1' },
      })
      await tick()
      expect(bundle.subscriptionCount()).toBe(1)
      dispose()
      await tick()
      expect(bundle.subscriptionCount()).toBe(0)
    })
  })

  it('holds every resolved cache key on first emission', async () => {
    const bundle = createMockViewQueryManager()
    await withContext(createMockClient(bundle.qm), async (dispose) => {
      createViewQuery<ServiceLink, ProjectRow, { workspaceId: string }>({
        view: 'projects-in-workspace',
        params: { workspaceId: 'w1' },
      })

      bundle.push({
        data: [{ id: 'p1', workspaceId: 'w1', title: 'Alpha' }],
        cacheKeys: [scopeKey('ck-a'), scopeKey('ck-b')],
      })
      await tick()

      expect(bundle.holdSpy).toHaveBeenCalledTimes(2)
      expect(bundle.holdSpy).toHaveBeenCalledWith('ck-a')
      expect(bundle.holdSpy).toHaveBeenCalledWith('ck-b')
      expect(bundle.releaseSpy).not.toHaveBeenCalled()

      dispose()
    })
  })

  it('releases every held key on dispose', async () => {
    const bundle = createMockViewQueryManager()
    await withContext(createMockClient(bundle.qm), async (dispose) => {
      createViewQuery<ServiceLink, ProjectRow, { workspaceId: string }>({
        view: 'projects-in-workspace',
        params: { workspaceId: 'w1' },
      })

      bundle.push({
        data: [{ id: 'p1', workspaceId: 'w1', title: 'Alpha' }],
        cacheKeys: [scopeKey('ck-a'), scopeKey('ck-b')],
      })
      await tick()
      bundle.releaseSpy.mockClear()

      dispose()
      await tick()

      expect(bundle.releaseSpy).toHaveBeenCalledTimes(2)
      expect(bundle.releaseSpy).toHaveBeenCalledWith('ck-a')
      expect(bundle.releaseSpy).toHaveBeenCalledWith('ck-b')
    })
  })

  it('skips hold and release for the overlap when the resolved set is unchanged', async () => {
    const bundle = createMockViewQueryManager()
    const [workspaceId, setWorkspaceId] = createSignal('w1')

    await withContext(createMockClient(bundle.qm), async (dispose) => {
      createViewQuery<ServiceLink, ProjectRow, { workspaceId: string }>({
        view: 'projects-in-workspace',
        params: () => ({ workspaceId: workspaceId() }),
      })

      bundle.push({
        data: [{ id: 'p1', workspaceId: 'w1', title: 'Alpha' }],
        cacheKeys: [scopeKey('ck-a'), scopeKey('ck-b')],
      })
      await tick()

      bundle.holdSpy.mockClear()
      bundle.releaseSpy.mockClear()

      // Force a watchView resubscribe by flipping the params signal, then
      // emit the *same* cache-key set against the fresh subscription.
      setWorkspaceId('w2')
      await tick()
      bundle.push({
        data: [{ id: 'p2', workspaceId: 'w2', title: 'Beta' }],
        cacheKeys: [scopeKey('ck-a'), scopeKey('ck-b')],
      })
      await tick()

      // Same resolved set across the subscription boundary — holds persist
      // untouched, no churn.
      expect(bundle.holdSpy).not.toHaveBeenCalled()
      expect(bundle.releaseSpy).not.toHaveBeenCalled()

      dispose()
    })
  })

  it('releases only the keys that left the resolved set on a partial overlap', async () => {
    const bundle = createMockViewQueryManager()
    await withContext(createMockClient(bundle.qm), async (dispose) => {
      createViewQuery<ServiceLink, ProjectRow, { workspaceId: string }>({
        view: 'projects-in-workspace',
        params: { workspaceId: 'w1' },
      })

      // Initial set: {ck-a, ck-b}
      bundle.push({
        data: [{ id: 'p1', workspaceId: 'w1', title: 'Alpha' }],
        cacheKeys: [scopeKey('ck-a'), scopeKey('ck-b')],
      })
      await tick()
      bundle.holdSpy.mockClear()
      bundle.releaseSpy.mockClear()

      // Next emission: {ck-b, ck-c} — drop ck-a, add ck-c, keep ck-b.
      bundle.push({
        data: [{ id: 'p1', workspaceId: 'w1', title: 'Alpha' }],
        cacheKeys: [scopeKey('ck-b'), scopeKey('ck-c')],
      })
      await tick()

      expect(bundle.releaseSpy).toHaveBeenCalledTimes(1)
      expect(bundle.releaseSpy).toHaveBeenCalledWith('ck-a')
      expect(bundle.holdSpy).toHaveBeenCalledTimes(1)
      expect(bundle.holdSpy).toHaveBeenCalledWith('ck-c')

      dispose()
    })
  })
})
