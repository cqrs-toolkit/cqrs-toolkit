/**
 * Unit tests for QueryManager.
 */

import { ServiceLink } from '@meticoeus/ddd-es'
import { firstValueFrom, timeout } from 'rxjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryStorage } from '../../storage/InMemoryStorage.js'
import { createTestWriteQueue } from '../../testing/createTestWriteQueue.js'
import { EnqueueCommand } from '../../types/index.js'
import { deriveScopeKey } from '../cache-manager/CacheKey.js'
import { CacheManager } from '../cache-manager/CacheManager.js'
import { CommandIdMappingStore } from '../command-id-mapping-store/CommandIdMappingStore.js'
import { EventBus } from '../events/EventBus.js'
import { ReadModelStore } from '../read-model-store/ReadModelStore.js'
import { ViewExecutor, createInMemoryDispatcher } from '../views/ViewExecutor.js'
import type { ViewLocalApi } from '../views/types.js'
import { QueryManager } from './QueryManager.js'
import { QueryManagerFacade } from './QueryManagerFacade.js'
import type { CollectionSignal } from './types.js'

const WINDOW_ID = 'test-window'

interface Todo {
  id: string
  title: string
  done: boolean
}

const TODOS_CACHE_KEY = deriveScopeKey({ scopeType: 'todos' })

describe('QueryManager', () => {
  let cleanup: (() => void)[] = []

  afterEach(() => {
    for (const fn of cleanup) fn()
    cleanup = []
  })

  let storage: InMemoryStorage<ServiceLink, EnqueueCommand>
  let eventBus: EventBus<ServiceLink>
  let cacheManager: CacheManager<ServiceLink, EnqueueCommand>
  let readModelStore: ReadModelStore<ServiceLink, EnqueueCommand>
  let queryManager: QueryManager<ServiceLink, EnqueueCommand>
  let facade: QueryManagerFacade<ServiceLink>
  beforeEach(async () => {
    storage = new InMemoryStorage()
    await storage.initialize()
    eventBus = new EventBus()
    const writeQueue = createTestWriteQueue(eventBus, cleanup, ['flush-cache-keys'])
    cacheManager = new CacheManager(eventBus, storage)
    cacheManager.setWriteQueue(writeQueue)
    const mappingStore = new CommandIdMappingStore(storage)
    await mappingStore.initialize()
    readModelStore = new ReadModelStore(eventBus, storage, mappingStore)
    queryManager = new QueryManager(eventBus, cacheManager, readModelStore)
    cleanup.push(() => queryManager.destroy())
    facade = new QueryManagerFacade(queryManager, WINDOW_ID)

    // Add some test data — cacheKey must match what QueryManager derives for 'todos'
    const todosCacheKey = deriveScopeKey({ scopeType: 'todos' }).key
    await storage.saveReadModel({
      id: 'todo-1',
      collection: 'todos',
      cacheKeys: [todosCacheKey],
      serverData: JSON.stringify({ id: 'todo-1', title: 'First', done: false }),
      effectiveData: JSON.stringify({ id: 'todo-1', title: 'First', done: false }),
      hasLocalChanges: false,
      updatedAt: 1000,
      revision: null,
      position: null,
      _clientMetadata: null,
    })
    await storage.saveReadModel({
      id: 'todo-2',
      collection: 'todos',
      cacheKeys: [todosCacheKey],
      serverData: JSON.stringify({ id: 'todo-2', title: 'Second', done: true }),
      effectiveData: JSON.stringify({ id: 'todo-2', title: 'Second Modified', done: true }),
      hasLocalChanges: true,
      updatedAt: 2000,
      revision: null,
      position: null,
      _clientMetadata: null,
    })
  })

  describe('getById', () => {
    it('returns entity with data', async () => {
      const result = await queryManager.getById<Todo>({
        collection: 'todos',
        id: 'todo-1',
        cacheKey: TODOS_CACHE_KEY,
      })

      expect(result.data).toMatchObject({ id: 'todo-1', title: 'First' })
      expect(result.hasLocalChanges).toBe(false)
      expect(result.cacheKey).toBeDefined()
    })

    it('returns null for non-existent entity', async () => {
      const result = await queryManager.getById<Todo>({
        collection: 'todos',
        id: 'non-existent',
        cacheKey: TODOS_CACHE_KEY,
      })

      expect(result.data).toBeUndefined()
      expect(result.hasLocalChanges).toBe(false)
    })

    it('creates cache key on access', async () => {
      const result = await queryManager.getById<Todo>({
        collection: 'todos',
        id: 'todo-1',
        cacheKey: TODOS_CACHE_KEY,
      })

      const cacheKeyExists = await cacheManager.exists(result.cacheKey.key)
      expect(cacheKeyExists).toBe(true)
    })
  })

  describe('getByIds', () => {
    it('returns map of found entities', async () => {
      const results = await queryManager.getByIds<Todo>({
        collection: 'todos',
        ids: ['todo-1', 'todo-2', 'todo-3'],
        cacheKey: TODOS_CACHE_KEY,
      })

      expect(results.size).toBe(3)
      expect(results.get('todo-1')?.data?.title).toBe('First')
      expect(results.get('todo-2')?.data?.title).toBe('Second Modified')
      expect(results.get('todo-3')?.data).toBeUndefined()
    })
  })

  describe('list', () => {
    it('returns all entities in collection; total is undefined without collection.list.total', async () => {
      const result = await queryManager.list<Todo>({
        collection: 'todos',
        cacheKey: TODOS_CACHE_KEY,
      })

      expect(result.data).toHaveLength(2)
      expect(result.total).toBeUndefined()
      expect(result.hasLocalChanges).toBe(true) // todo-2 has local changes
    })

    it('applies pagination', async () => {
      const result = await queryManager.list<Todo>({
        collection: 'todos',
        cacheKey: TODOS_CACHE_KEY,
        limit: 1,
        offset: 1,
      })

      expect(result.data).toHaveLength(1)
      expect(result.total).toBeUndefined()
    })

    it('returns total when collection.list.total is true', async () => {
      const qm = new QueryManager<ServiceLink, EnqueueCommand>(
        eventBus,
        cacheManager,
        readModelStore,
        [
          {
            name: 'todos',
            aggregate: { service: 'nb', type: 'Todo' } as never,
            matchesStream: () => false,
            cacheKeysFromTopics: () => [],
            list: { total: true },
          } as never,
        ],
      )
      const result = await qm.list<Todo>({
        collection: 'todos',
        cacheKey: TODOS_CACHE_KEY,
      })
      expect(result.data).toHaveLength(2)
      expect(result.total).toBe(2)
    })

    it('filters by cacheKey when provided', async () => {
      // Add a record under a different cache key
      const otherKey = deriveScopeKey({ scopeType: 'todos', scopeParams: { filter: 'done' } })
      await storage.saveReadModel({
        id: 'todo-done',
        collection: 'todos',
        cacheKeys: [otherKey.key],
        serverData: JSON.stringify({ id: 'todo-done', title: 'Done', done: true }),
        effectiveData: JSON.stringify({ id: 'todo-done', title: 'Done', done: true }),
        hasLocalChanges: false,
        updatedAt: 3000,
        revision: null,
        position: null,
        _clientMetadata: null,
      })

      // List with the other cache key — should only return its record
      const result = await queryManager.list<Todo>({
        collection: 'todos',
        cacheKey: otherKey,
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0]?.id).toBe('todo-done')
    })
  })

  describe('getLocallyById', () => {
    it('returns the data for an existing entity', async () => {
      const data = await queryManager.getLocallyById<Todo>('todos', 'todo-1')
      expect(data).toMatchObject({ id: 'todo-1', title: 'First' })
    })

    it('returns the effective (local-change) data when present', async () => {
      const data = await queryManager.getLocallyById<Todo>('todos', 'todo-2')
      expect(data).toMatchObject({ id: 'todo-2', title: 'Second Modified' })
    })

    it('returns undefined for a missing entity', async () => {
      const data = await queryManager.getLocallyById<Todo>('todos', 'non-existent')
      expect(data).toBeUndefined()
    })

    it('does not create a cache key', async () => {
      await queryManager.getLocallyById<Todo>('todos', 'todo-1')
      const cacheKeyExists = await cacheManager.exists(TODOS_CACHE_KEY.key)
      expect(cacheKeyExists).toBe(false)
    })
  })

  describe('exists', () => {
    it('returns true for existing entity', async () => {
      expect(await queryManager.exists('todos', 'todo-1')).toBe(true)
    })

    it('returns false for non-existing entity', async () => {
      expect(await queryManager.exists('todos', 'non-existent')).toBe(false)
    })
  })

  describe('count', () => {
    it('returns correct count', async () => {
      expect(await queryManager.count('todos')).toBe(2)
      expect(await queryManager.count('users')).toBe(0)
    })
  })

  describe('watchCollection', () => {
    it('emits updated signal when collection is updated', async () => {
      const signals: CollectionSignal[] = []

      queryManager.watchCollection('todos').subscribe((signal) => {
        signals.push(signal)
      })

      eventBus.emit('readmodel:updated', {
        collection: 'todos',
        updated: ['todo-1'],
        cacheKeys: [],
        commandIds: ['cmd-1'],
      })

      await new Promise((r) => setTimeout(r, 10))

      expect(signals).toHaveLength(1)
      expect(signals[0]).toEqual({ type: 'updated', ids: ['todo-1'], commandIds: ['cmd-1'] })
    })

    it('filters to specific collection', async () => {
      const signals: CollectionSignal[] = []

      queryManager.watchCollection('todos').subscribe((signal) => {
        signals.push(signal)
      })

      eventBus.emit('readmodel:updated', {
        collection: 'users',
        updated: ['user-1'],
        cacheKeys: [],
        commandIds: [],
      })
      eventBus.emit('readmodel:updated', {
        collection: 'todos',
        updated: ['todo-1'],
        cacheKeys: [],
        commandIds: [],
      })

      await new Promise((r) => setTimeout(r, 10))

      expect(signals).toHaveLength(1)
    })

    it('emits seed-completed signal', async () => {
      const signals: CollectionSignal[] = []

      queryManager.watchCollection('todos').subscribe((signal) => {
        signals.push(signal)
      })

      eventBus.emit('sync:seed-completed', {
        collection: 'todos',
        cacheKey: deriveScopeKey({ scopeType: 'todos' }),
        recordCount: 5,
      })

      await new Promise((r) => setTimeout(r, 10))

      expect(signals).toHaveLength(1)
      expect(signals[0]).toEqual({ type: 'seed-completed', recordCount: 5 })
    })

    it('emits sync-failed signal', async () => {
      const signals: CollectionSignal[] = []

      queryManager.watchCollection('todos').subscribe((signal) => {
        signals.push(signal)
      })

      eventBus.emit('sync:failed', { collection: 'todos', error: 'Network error' })

      await new Promise((r) => setTimeout(r, 10))

      expect(signals).toHaveLength(1)
      expect(signals[0]).toEqual({ type: 'sync-failed', error: 'Network error' })
    })
  })

  describe('watchById', () => {
    it('emits initial value', async () => {
      const observable = queryManager.watchById<Todo>({
        collection: 'todos',
        id: 'todo-1',
        cacheKey: TODOS_CACHE_KEY,
      })
      const value = await firstValueFrom(observable.pipe(timeout(100)))

      expect(value).toMatchObject({ id: 'todo-1', title: 'First' })
    })

    it('emits updated value when entity changes', async () => {
      const values: (Todo | undefined)[] = []

      queryManager
        .watchById<Todo>({
          collection: 'todos',
          id: 'todo-1',
          cacheKey: TODOS_CACHE_KEY,
        })
        .subscribe((v) => {
          values.push(v)
        })

      // Wait for initial value
      await new Promise((r) => setTimeout(r, 10))

      // Update the entity
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKeys: ['cache-1'],
        serverData: JSON.stringify({ id: 'todo-1', title: 'Updated', done: false }),
        effectiveData: JSON.stringify({ id: 'todo-1', title: 'Updated', done: false }),
        hasLocalChanges: false,
        updatedAt: 3000,
        revision: null,
        position: null,
        _clientMetadata: null,
      })

      // Emit update notification
      eventBus.emit('readmodel:updated', {
        collection: 'todos',
        updated: ['todo-1'],
        cacheKeys: [],
        commandIds: [],
      })

      await new Promise((r) => setTimeout(r, 10))

      expect(values.length).toBeGreaterThanOrEqual(2)
      expect(values[values.length - 1]?.title).toBe('Updated')
    })

    it('delivers the latest read when rapid updates cause out-of-order resolution', async () => {
      const values: (Todo | undefined)[] = []

      // Control resolution order of getById calls.
      // We'll make the first update's read resolve AFTER the second update's read,
      // simulating the stale-read race.
      let callCount = 0
      const originalGetById = readModelStore.getById.bind(readModelStore)
      let resolveSlowCall: (() => void) | undefined

      vi.spyOn(readModelStore, 'getById').mockImplementation(async (collection, id) => {
        callCount++
        const currentCall = callCount
        const result = await originalGetById(collection, id)

        // Make the 2nd call (first update read) slow — it resolves after the 3rd call
        if (currentCall === 2) {
          await new Promise<void>((resolve) => {
            resolveSlowCall = resolve
          })
        }

        return result
      })

      queryManager
        .watchById<Todo>({
          collection: 'todos',
          id: 'todo-1',
          cacheKey: TODOS_CACHE_KEY,
        })
        .subscribe((v) => {
          values.push(v)
        })

      // Wait for initial load (call 1)
      await new Promise((r) => setTimeout(r, 10))
      expect(values).toHaveLength(1)

      // First update — will trigger call 2 (slow)
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKeys: ['cache-1'],
        serverData: JSON.stringify({ id: 'todo-1', title: 'Stale', done: false }),
        effectiveData: JSON.stringify({ id: 'todo-1', title: 'Stale', done: false }),
        hasLocalChanges: false,
        updatedAt: 3000,
        revision: null,
        position: null,
        _clientMetadata: null,
      })
      eventBus.emit('readmodel:updated', {
        collection: 'todos',
        updated: ['todo-1'],
        cacheKeys: [],
        commandIds: [],
      })

      // Second update — triggers call 3 (fast, resolves before call 2)
      await storage.saveReadModel({
        id: 'todo-1',
        collection: 'todos',
        cacheKeys: ['cache-1'],
        serverData: JSON.stringify({ id: 'todo-1', title: 'Latest', done: false }),
        effectiveData: JSON.stringify({ id: 'todo-1', title: 'Latest', done: false }),
        hasLocalChanges: false,
        updatedAt: 4000,
        revision: null,
        position: null,
        _clientMetadata: null,
      })
      eventBus.emit('readmodel:updated', {
        collection: 'todos',
        updated: ['todo-1'],
        cacheKeys: [],
        commandIds: [],
      })

      // Let the fast call (3) resolve
      await new Promise((r) => setTimeout(r, 10))

      // Now let the slow call (2) resolve — switchMap should have cancelled it
      resolveSlowCall!()
      await new Promise((r) => setTimeout(r, 10))

      // The final value must be "Latest", not "Stale"
      const lastValue = values[values.length - 1]
      expect(lastValue?.title).toBe('Latest')

      // "Stale" should never appear in the emitted values
      expect(values.every((v) => v?.title !== 'Stale')).toBe(true)
    })

    it('does not call getById after unsubscribe', async () => {
      const getByIdSpy = vi.spyOn(readModelStore, 'getById')

      const sub = queryManager
        .watchById<Todo>({
          collection: 'todos',
          id: 'todo-1',
          cacheKey: TODOS_CACHE_KEY,
        })
        .subscribe(() => {})

      // Wait for initial load
      await new Promise((r) => setTimeout(r, 10))

      const callCountBeforeUnsub = getByIdSpy.mock.calls.length

      // Unsubscribe
      sub.unsubscribe()

      // Emit update after unsubscribe
      eventBus.emit('readmodel:updated', {
        collection: 'todos',
        updated: ['todo-1'],
        cacheKeys: [],
        commandIds: [],
      })

      await new Promise((r) => setTimeout(r, 10))

      // getById should NOT have been called again after unsubscribe
      expect(getByIdSpy.mock.calls.length).toBe(callCountBeforeUnsub)
    })
  })

  describe('watchList', () => {
    it('emits the initial list result on subscribe', async () => {
      const emissions: { ids: string[] }[] = []
      const sub = queryManager
        .watchList<Todo>({ collection: 'todos', cacheKey: TODOS_CACHE_KEY })
        .subscribe((result) => {
          emissions.push({ ids: result.meta.map((m) => m.id) })
        })
      cleanup.push(() => sub.unsubscribe())

      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(1)
      expect(emissions[0]?.ids.sort()).toEqual(['todo-1', 'todo-2'])
    })

    it('tracked-id update re-emits even when cacheKeys do not include the watched key', async () => {
      // A row visible on the page is part of what's being rendered. An update
      // to it is unconditionally relevant — cache-key attribution doesn't
      // gate the data re-fetch.
      const emissions: number[] = []
      const sub = queryManager
        .watchList<Todo>({ collection: 'todos', cacheKey: TODOS_CACHE_KEY })
        .subscribe((result) => emissions.push(result.meta.length))
      cleanup.push(() => sub.unsubscribe())

      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(1)

      eventBus.emit('readmodel:updated', {
        collection: 'todos',
        updated: ['todo-1'],
        cacheKeys: ['some-other-workspace-key'],
        commandIds: [],
      })

      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(2)
    })

    it('tracked-id update re-emits when cacheKeys include the watched key', async () => {
      const emissions: number[] = []
      const sub = queryManager
        .watchList<Todo>({ collection: 'todos', cacheKey: TODOS_CACHE_KEY })
        .subscribe((result) => emissions.push(result.meta.length))
      cleanup.push(() => sub.unsubscribe())

      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(1)

      eventBus.emit('readmodel:updated', {
        collection: 'todos',
        updated: ['todo-1'],
        cacheKeys: [TODOS_CACHE_KEY.key],
        commandIds: [],
      })

      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(2)
    })

    it('off-page update is dropped — visible page is left stable', async () => {
      const emissions: number[] = []
      const sub = queryManager
        .watchList<Todo>({ collection: 'todos', cacheKey: TODOS_CACHE_KEY })
        .subscribe((result) => emissions.push(result.meta.length))
      cleanup.push(() => sub.unsubscribe())

      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(1)

      // Off-page id, watched cache key, no create/delete — pure update to a
      // row we don't render. Both data and count branches drop it.
      eventBus.emit('readmodel:updated', {
        collection: 'todos',
        updated: ['off-page-id'],
        cacheKeys: [TODOS_CACHE_KEY.key],
        commandIds: [],
      })

      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(1)
    })

    it('off-page create is dropped when collection.list.total is false (default)', async () => {
      // Default collection has no list.total — the count branch is dead, and
      // the create isn't on the page, so nothing re-runs. Visible page stays.
      const emissions: number[] = []
      const sub = queryManager
        .watchList<Todo>({ collection: 'todos', cacheKey: TODOS_CACHE_KEY })
        .subscribe((result) => emissions.push(result.meta.length))
      cleanup.push(() => sub.unsubscribe())

      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(1)

      eventBus.emit('readmodel:updated', {
        collection: 'todos',
        created: ['todo-new'],
        cacheKeys: [TODOS_CACHE_KEY.key],
        commandIds: [],
      })

      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(1)
    })

    it('off-page create emits a count-only re-fetch when collection.list.total is true', async () => {
      const qm = new QueryManager<ServiceLink, EnqueueCommand>(
        eventBus,
        cacheManager,
        readModelStore,
        [
          {
            name: 'todos',
            aggregate: { service: 'nb', type: 'Todo' } as never,
            matchesStream: () => false,
            cacheKeysFromTopics: () => [],
            list: { total: true },
          } as never,
        ],
      )

      const totals: (number | undefined)[] = []
      const sub = qm
        .watchList<Todo>({ collection: 'todos', cacheKey: TODOS_CACHE_KEY })
        .subscribe((result) => totals.push(result.total))
      cleanup.push(() => sub.unsubscribe())

      await new Promise((r) => setTimeout(r, 20))
      expect(totals).toEqual([2])

      // Seed another row to bump count, then emit a create event so the
      // count branch fires.
      const todosCacheKey = TODOS_CACHE_KEY.key
      await storage.saveReadModel({
        id: 'todo-3',
        collection: 'todos',
        cacheKeys: [todosCacheKey],
        serverData: JSON.stringify({ id: 'todo-3', title: 'Third', done: false }),
        effectiveData: JSON.stringify({ id: 'todo-3', title: 'Third', done: false }),
        hasLocalChanges: false,
        updatedAt: 3000,
        revision: null,
        position: null,
        _clientMetadata: null,
      })

      eventBus.emit('readmodel:updated', {
        collection: 'todos',
        created: ['todo-3'],
        cacheKeys: [todosCacheKey],
        commandIds: [],
      })

      await new Promise((r) => setTimeout(r, 20))
      expect(totals.length).toBeGreaterThanOrEqual(2)
      expect(totals[totals.length - 1]).toBe(3)
    })

    it('tracked-id delete re-emits (and updates total when configured)', async () => {
      const emissions: number[] = []
      const sub = queryManager
        .watchList<Todo>({ collection: 'todos', cacheKey: TODOS_CACHE_KEY })
        .subscribe((result) => emissions.push(result.meta.length))
      cleanup.push(() => sub.unsubscribe())

      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(1)

      eventBus.emit('readmodel:updated', {
        collection: 'todos',
        deleted: ['todo-2'],
        cacheKeys: [TODOS_CACHE_KEY.key],
        commandIds: [],
      })

      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(2)
    })

    it('ignores events for other collections', async () => {
      const emissions: number[] = []
      const sub = queryManager
        .watchList<Todo>({ collection: 'todos', cacheKey: TODOS_CACHE_KEY })
        .subscribe((result) => emissions.push(result.meta.length))
      cleanup.push(() => sub.unsubscribe())

      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(1)

      eventBus.emit('readmodel:updated', {
        collection: 'users',
        updated: ['todo-1'],
        cacheKeys: [TODOS_CACHE_KEY.key],
        commandIds: [],
      })

      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(1)
    })

    it('force re-runs on sync:seed-completed for the watched collection', async () => {
      const emissions: number[] = []
      const sub = queryManager
        .watchList<Todo>({ collection: 'todos', cacheKey: TODOS_CACHE_KEY })
        .subscribe((result) => emissions.push(result.meta.length))
      cleanup.push(() => sub.unsubscribe())

      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(1)

      eventBus.emit('sync:seed-completed', {
        collection: 'todos',
        cacheKey: TODOS_CACHE_KEY,
        recordCount: 2,
      })

      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(2)
    })

    it('force re-runs on session:destroyed', async () => {
      const emissions: number[] = []
      const sub = queryManager
        .watchList<Todo>({ collection: 'todos', cacheKey: TODOS_CACHE_KEY })
        .subscribe((result) => emissions.push(result.meta.length))
      cleanup.push(() => sub.unsubscribe())

      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(1)

      eventBus.emit('session:destroyed', { reason: 'user-changed' })

      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(2)
    })

    it('does not re-run after unsubscribe', async () => {
      const listSpy = vi.spyOn(queryManager, 'list')
      const sub = queryManager
        .watchList<Todo>({ collection: 'todos', cacheKey: TODOS_CACHE_KEY })
        .subscribe(() => {})
      await new Promise((r) => setTimeout(r, 20))
      const callsBeforeUnsub = listSpy.mock.calls.length
      sub.unsubscribe()

      eventBus.emit('readmodel:updated', {
        collection: 'todos',
        updated: ['todo-1'],
        cacheKeys: [TODOS_CACHE_KEY.key],
        commandIds: [],
      })
      await new Promise((r) => setTimeout(r, 20))
      expect(listSpy.mock.calls.length).toBe(callsBeforeUnsub)
    })
  })

  describe('getView', () => {
    it('throws when no views are registered', async () => {
      await expect(queryManager.getView({ view: 'anything', params: {} })).rejects.toThrow(
        /no views are registered/,
      )
    })

    it('throws on unknown view when executor is configured', async () => {
      const viewExecutor = new ViewExecutor<ServiceLink>(
        [
          {
            name: 'known',
            primarySource: 'todos',
            joinSources: [],
            cacheKeys: () => [],
            memory: () => [],
            sql: { query: () => ({ sql: 'SELECT 1', bindings: [] }) },
          },
        ],
        createInMemoryDispatcher({
          *iterate() {
            // empty
          },
        }),
      )
      const qm = new QueryManager<ServiceLink, EnqueueCommand>(
        eventBus,
        cacheManager,
        readModelStore,
        [],
        viewExecutor,
      )
      await expect(qm.getView({ view: 'missing', params: {} })).rejects.toThrow(/Unknown view/)
    })

    it('dispatches a memory view and resolves declared cache keys', async () => {
      const viewExecutor = new ViewExecutor<ServiceLink>(
        [
          {
            name: 'todos-by-done',
            primarySource: 'todos',
            joinSources: [],
            cacheKeys: () => [{ kind: 'scope' as const, scopeType: 'todos' }],
            memory: (api: ViewLocalApi, params: unknown) => {
              const out: Todo[] = []
              for (const row of api.iterate<Todo>('todos')) {
                if (row.data.done === (params as { done: boolean }).done) {
                  out.push(row.data)
                }
              }
              return out
            },
            sql: { query: () => ({ sql: 'SELECT 1', bindings: [] }) },
          },
        ],
        createInMemoryDispatcher({
          iterate<T>(collection: string) {
            return storage.iterateReadModels<T>(collection)
          },
        }),
      )
      const qm = new QueryManager<ServiceLink, EnqueueCommand>(
        eventBus,
        cacheManager,
        readModelStore,
        [],
        viewExecutor,
      )

      const result = await qm.getView<Todo>({
        view: 'todos-by-done',
        params: { done: true },
      })

      expect(result.data.map((d) => d.id)).toEqual(['todo-2'])
      expect(result.cacheKeys).toHaveLength(1)
      // The cache-key template gets a freshly-assigned opaque UUID via
      // registerCacheKey — it's not the deterministic UUID v5 from
      // deriveScopeKey. Just verify the resolved identity carries the
      // declared scope.
      expect(result.cacheKeys[0]).toMatchObject({ kind: 'scope', scopeType: 'todos' })
    })
  })

  describe('watchView', () => {
    interface ProjectRow {
      id: string
      assetId: string
      _embedded: { asset: { id: string; name: string } | null }
    }

    /** Sets up a project-with-asset view + storage state for gate tests. */
    async function setupProjectView() {
      // Pre-existing project + asset rows so iterate has data.
      await storage.saveReadModel({
        id: 'asset-a',
        collection: 'assets',
        cacheKeys: ['ck-assets'],
        serverData: '{"id":"asset-a","name":"A"}',
        effectiveData: '{"id":"asset-a","name":"A"}',
        hasLocalChanges: false,
        updatedAt: 1000,
        revision: null,
        position: null,
        _clientMetadata: null,
      })
      await storage.saveReadModel({
        id: 'project-1',
        collection: 'projects',
        cacheKeys: ['ck-projects'],
        serverData: '{"id":"project-1","assetId":"asset-a"}',
        effectiveData: '{"id":"project-1","assetId":"asset-a"}',
        hasLocalChanges: false,
        updatedAt: 1000,
        revision: null,
        position: null,
        _clientMetadata: null,
      })

      const viewExecutor = new ViewExecutor<ServiceLink>(
        [
          {
            name: 'projects-with-assets',
            primarySource: 'projects',
            joinSources: [{ collection: 'assets', referencedIdPath: '$.assetId' }],
            cacheKeys: () => [
              { kind: 'scope' as const, scopeType: 'projects' },
              { kind: 'scope' as const, scopeType: 'assets' },
            ],
            memory: (api: ViewLocalApi) => {
              const assets = new Map<string, { id: string; name: string }>()
              for (const a of api.iterate<{ id: string; name: string }>('assets')) {
                assets.set(a.id, a.data)
              }
              const out: ProjectRow[] = []
              for (const p of api.iterate<{ id: string; assetId: string }>('projects')) {
                out.push({
                  ...p.data,
                  _embedded: { asset: assets.get(p.data.assetId) ?? null },
                })
              }
              return out
            },
            sql: { query: () => ({ sql: 'SELECT 1', bindings: [] }) },
          },
        ],
        createInMemoryDispatcher({
          iterate<T>(collection: string) {
            return storage.iterateReadModels<T>(collection)
          },
        }),
      )
      const qm = new QueryManager<ServiceLink, EnqueueCommand>(
        eventBus,
        cacheManager,
        readModelStore,
        [],
        viewExecutor,
      )

      // Pre-resolve the cache keys so we can refer to them by .key in events.
      const result = await qm.getView<ProjectRow>({
        view: 'projects-with-assets',
        params: {},
      })
      return { qm, result }
    }

    it('emits the initial view result on subscribe', async () => {
      const { qm } = await setupProjectView()
      const emissions: number[] = []
      const sub = qm
        .watchView<ProjectRow>({ view: 'projects-with-assets', params: {} })
        .subscribe((r) => emissions.push(r.data.length))
      cleanup.push(() => sub.unsubscribe())
      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(1)
      expect(emissions[0]).toBe(1)
    })

    it('tracked-id update re-emits even when cacheKeys do not include any watched key', async () => {
      // project-1 is on the page; an update to it re-fetches regardless of
      // which cache key the event reports. The visible row is changing.
      const { qm } = await setupProjectView()
      const emissions: number[] = []
      const sub = qm
        .watchView<ProjectRow>({ view: 'projects-with-assets', params: {} })
        .subscribe((r) => emissions.push(r.data.length))
      cleanup.push(() => sub.unsubscribe())
      await new Promise((r) => setTimeout(r, 20))

      eventBus.emit('readmodel:updated', {
        collection: 'projects',
        updated: ['project-1'],
        cacheKeys: ['ck-other-workspace'],
        commandIds: [],
      })
      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(2)
    })

    it('untracked-id update with unwatched cacheKey is dropped', async () => {
      const { qm } = await setupProjectView()
      const emissions: number[] = []
      const sub = qm
        .watchView<ProjectRow>({ view: 'projects-with-assets', params: {} })
        .subscribe((r) => emissions.push(r.data.length))
      cleanup.push(() => sub.unsubscribe())
      await new Promise((r) => setTimeout(r, 20))

      eventBus.emit('readmodel:updated', {
        collection: 'projects',
        updated: ['off-page-project'],
        cacheKeys: ['ck-other-workspace'],
        commandIds: [],
      })
      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(1)
    })

    it('Gate 2 (primary): re-emits on update of a row on the page', async () => {
      const { qm, result } = await setupProjectView()
      const emissions: number[] = []
      const sub = qm
        .watchView<ProjectRow>({ view: 'projects-with-assets', params: {} })
        .subscribe((r) => emissions.push(r.data.length))
      cleanup.push(() => sub.unsubscribe())
      await new Promise((r) => setTimeout(r, 20))

      eventBus.emit('readmodel:updated', {
        collection: 'projects',
        updated: ['project-1'],
        cacheKeys: result.cacheKeys.map((k) => k.key),
        commandIds: [],
      })
      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(2)
    })

    it('Gate 2 (primary): ignores updates of rows not on the page', async () => {
      const { qm, result } = await setupProjectView()
      const emissions: number[] = []
      const sub = qm
        .watchView<ProjectRow>({ view: 'projects-with-assets', params: {} })
        .subscribe((r) => emissions.push(r.data.length))
      cleanup.push(() => sub.unsubscribe())
      await new Promise((r) => setTimeout(r, 20))

      eventBus.emit('readmodel:updated', {
        collection: 'projects',
        updated: ['off-page-project'],
        cacheKeys: result.cacheKeys.map((k) => k.key),
        commandIds: [],
      })
      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(1)
    })

    it('Gate 2 (join): re-emits on update of an embedded asset', async () => {
      const { qm, result } = await setupProjectView()
      const emissions: number[] = []
      const sub = qm
        .watchView<ProjectRow>({ view: 'projects-with-assets', params: {} })
        .subscribe((r) => emissions.push(r.data.length))
      cleanup.push(() => sub.unsubscribe())
      await new Promise((r) => setTimeout(r, 20))

      eventBus.emit('readmodel:updated', {
        collection: 'assets',
        updated: ['asset-a'],
        cacheKeys: result.cacheKeys.map((k) => k.key),
        commandIds: [],
      })
      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(2)
    })

    it('Gate 2 (join): ignores updates of assets not embedded in the page', async () => {
      const { qm, result } = await setupProjectView()
      const emissions: number[] = []
      const sub = qm
        .watchView<ProjectRow>({ view: 'projects-with-assets', params: {} })
        .subscribe((r) => emissions.push(r.data.length))
      cleanup.push(() => sub.unsubscribe())
      await new Promise((r) => setTimeout(r, 20))

      eventBus.emit('readmodel:updated', {
        collection: 'assets',
        updated: ['asset-zzz-not-referenced'],
        cacheKeys: result.cacheKeys.map((k) => k.key),
        commandIds: [],
      })
      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(1)
    })

    it('off-page primary-source create is dropped when view has no count callback', async () => {
      // The view in setupProjectView has no `memoryCount` / `sql.count`, so
      // the count branch is dead. Off-page creates don't affect the visible
      // page; they drop.
      const { qm, result } = await setupProjectView()
      const emissions: number[] = []
      const sub = qm
        .watchView<ProjectRow>({ view: 'projects-with-assets', params: {} })
        .subscribe((r) => emissions.push(r.data.length))
      cleanup.push(() => sub.unsubscribe())
      await new Promise((r) => setTimeout(r, 20))

      eventBus.emit('readmodel:updated', {
        collection: 'projects',
        created: ['project-2'],
        cacheKeys: result.cacheKeys.map((k) => k.key),
        commandIds: [],
      })
      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(1)
    })

    it('off-page join-source create is dropped', async () => {
      // A brand-new asset not referenced by any visible project — neither
      // tracked-id nor count branch fires.
      const { qm, result } = await setupProjectView()
      const emissions: number[] = []
      const sub = qm
        .watchView<ProjectRow>({ view: 'projects-with-assets', params: {} })
        .subscribe((r) => emissions.push(r.data.length))
      cleanup.push(() => sub.unsubscribe())
      await new Promise((r) => setTimeout(r, 20))

      eventBus.emit('readmodel:updated', {
        collection: 'assets',
        created: ['asset-z'],
        cacheKeys: result.cacheKeys.map((k) => k.key),
        commandIds: [],
      })
      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(1)
    })

    it('wanted-id gate: re-emits when a previously-missing join id arrives', async () => {
      // project-1 references asset-b, which is NOT yet in storage. The
      // initial view emits with a null embed. When asset-b's create event
      // fires, the referencingIds gate (driven by joinSources[].referencingIdPath)
      // should trigger a re-fetch even though referencedIds doesn't contain
      // asset-b yet.
      await storage.saveReadModel({
        id: 'project-1',
        collection: 'projects',
        cacheKeys: ['ck-projects'],
        serverData: '{"id":"project-1","assetId":"asset-b"}',
        effectiveData: '{"id":"project-1","assetId":"asset-b"}',
        hasLocalChanges: false,
        updatedAt: 1000,
        revision: null,
        position: null,
        _clientMetadata: null,
      })

      const viewExecutor = new ViewExecutor<ServiceLink>(
        [
          {
            name: 'projects-with-assets',
            primarySource: 'projects',
            joinSources: [
              {
                collection: 'assets',
                referencedIdPath: '$._embedded.asset.id',
                referencingIdPath: '$.assetId',
              },
            ],
            cacheKeys: () => [
              { kind: 'scope' as const, scopeType: 'projects' },
              { kind: 'scope' as const, scopeType: 'assets' },
            ],
            memory: (api: ViewLocalApi) => {
              const assets = new Map<string, { id: string; name: string }>()
              for (const a of api.iterate<{ id: string; name: string }>('assets')) {
                assets.set(a.id, a.data)
              }
              const out: ProjectRow[] = []
              for (const p of api.iterate<{ id: string; assetId: string }>('projects')) {
                out.push({
                  ...p.data,
                  _embedded: { asset: assets.get(p.data.assetId) ?? null },
                })
              }
              return out
            },
            sql: { query: () => ({ sql: 'SELECT 1', bindings: [] }) },
          },
        ],
        createInMemoryDispatcher({
          iterate<T>(collection: string) {
            return storage.iterateReadModels<T>(collection)
          },
        }),
      )
      const qm = new QueryManager<ServiceLink, EnqueueCommand>(
        eventBus,
        cacheManager,
        readModelStore,
        [],
        viewExecutor,
      )
      const initial = await qm.getView<ProjectRow>({
        view: 'projects-with-assets',
        params: {},
      })
      expect(initial.data[0]?._embedded.asset).toBeNull()

      const emissions: (ProjectRow[] | undefined)[] = []
      const sub = qm
        .watchView<ProjectRow>({ view: 'projects-with-assets', params: {} })
        .subscribe((r) => emissions.push(r.data))
      cleanup.push(() => sub.unsubscribe())
      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(1)
      expect(emissions[0]?.[0]?._embedded.asset).toBeNull()

      await storage.saveReadModel({
        id: 'asset-b',
        collection: 'assets',
        cacheKeys: ['ck-assets'],
        serverData: '{"id":"asset-b","name":"B"}',
        effectiveData: '{"id":"asset-b","name":"B"}',
        hasLocalChanges: false,
        updatedAt: 2000,
        revision: null,
        position: null,
        _clientMetadata: null,
      })
      eventBus.emit('readmodel:updated', {
        collection: 'assets',
        created: ['asset-b'],
        cacheKeys: initial.cacheKeys.map((k) => k.key),
        commandIds: [],
      })
      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(2)
      expect(emissions[1]?.[0]?._embedded.asset).toEqual({ id: 'asset-b', name: 'B' })
    })

    it('force re-runs on session:destroyed', async () => {
      const { qm } = await setupProjectView()
      const emissions: number[] = []
      const sub = qm
        .watchView<ProjectRow>({ view: 'projects-with-assets', params: {} })
        .subscribe((r) => emissions.push(r.data.length))
      cleanup.push(() => sub.unsubscribe())
      await new Promise((r) => setTimeout(r, 20))

      eventBus.emit('session:destroyed', { reason: 'user-changed' })
      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(2)
    })

    it('does not re-run after unsubscribe', async () => {
      const { qm, result } = await setupProjectView()
      const getViewSpy = vi.spyOn(qm, 'getView')
      const sub = qm
        .watchView<ProjectRow>({ view: 'projects-with-assets', params: {} })
        .subscribe(() => {})
      await new Promise((r) => setTimeout(r, 20))
      const callsBeforeUnsub = getViewSpy.mock.calls.length
      sub.unsubscribe()

      eventBus.emit('readmodel:updated', {
        collection: 'projects',
        updated: ['project-1'],
        cacheKeys: result.cacheKeys.map((k) => k.key),
        commandIds: [],
      })
      await new Promise((r) => setTimeout(r, 20))
      expect(getViewSpy.mock.calls.length).toBe(callsBeforeUnsub)
    })

    it('extracts referencedIds via bracket-with-dot referencedIdPath (canonical _embedded shape)', async () => {
      // Canonical HAL-style embed path: `$._embedded['pms.Asset'].id`. Verifies
      // the join-source FK extraction handles a bracket member whose key
      // contains a literal dot — the on-the-wire shape mirrors what
      // hypermedia projections emit.
      interface EmbedRow {
        id: string
        _embedded: { 'pms.Asset': { id: string; name: string } | null }
      }
      await storage.saveReadModel({
        id: 'asset-x',
        collection: 'assets',
        cacheKeys: ['ck-assets'],
        serverData: '{"id":"asset-x","name":"X"}',
        effectiveData: '{"id":"asset-x","name":"X"}',
        hasLocalChanges: false,
        updatedAt: 1000,
        revision: null,
        position: null,
        _clientMetadata: null,
      })
      await storage.saveReadModel({
        id: 'project-x',
        collection: 'projects',
        cacheKeys: ['ck-projects'],
        serverData: '{"id":"project-x","_embedded":{"pms.Asset":{"id":"asset-x"}}}',
        effectiveData: '{"id":"project-x","_embedded":{"pms.Asset":{"id":"asset-x"}}}',
        hasLocalChanges: false,
        updatedAt: 1000,
        revision: null,
        position: null,
        _clientMetadata: null,
      })

      const viewExecutor = new ViewExecutor<ServiceLink>(
        [
          {
            name: 'projects-with-hal-embeds',
            primarySource: 'projects',
            joinSources: [
              { collection: 'assets', referencedIdPath: "$._embedded['pms.Asset'].id" },
            ],
            cacheKeys: () => [
              { kind: 'scope' as const, scopeType: 'projects' },
              { kind: 'scope' as const, scopeType: 'assets' },
            ],
            memory: (api: ViewLocalApi) => {
              const out: EmbedRow[] = []
              for (const p of api.iterate<EmbedRow>('projects')) out.push(p.data)
              return out
            },
            sql: { query: () => ({ sql: 'SELECT 1', bindings: [] }) },
          },
        ],
        createInMemoryDispatcher({
          iterate<T>(collection: string) {
            return storage.iterateReadModels<T>(collection)
          },
        }),
      )
      const qm = new QueryManager<ServiceLink, EnqueueCommand>(
        eventBus,
        cacheManager,
        readModelStore,
        [],
        viewExecutor,
      )

      const initial = await qm.getView<EmbedRow>({
        view: 'projects-with-hal-embeds',
        params: {},
      })
      expect(initial.data).toHaveLength(1)

      const emissions: number[] = []
      const sub = qm
        .watchView<EmbedRow>({ view: 'projects-with-hal-embeds', params: {} })
        .subscribe((r) => emissions.push(r.data.length))
      cleanup.push(() => sub.unsubscribe())
      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(1)

      // Asset update on a row tracked via the bracket-with-dot path must
      // fire the join-source gate.
      eventBus.emit('readmodel:updated', {
        collection: 'assets',
        updated: ['asset-x'],
        cacheKeys: initial.cacheKeys.map((k) => k.key),
        commandIds: [],
      })
      await new Promise((r) => setTimeout(r, 20))
      expect(emissions).toHaveLength(2)
    })
  })

  describe('hold/release', () => {
    it('holds a cache key', async () => {
      const result = await queryManager.getById<Todo>({
        collection: 'todos',
        id: 'todo-1',
        cacheKey: TODOS_CACHE_KEY,
      })
      await facade.hold(result.cacheKey.key)

      const cacheKey = await cacheManager.get(result.cacheKey.key)
      expect(cacheKey?.holdCount).toBe(1)
    })

    it('releases a cache key', async () => {
      const result = await queryManager.getById<Todo>({
        collection: 'todos',
        id: 'todo-1',
        cacheKey: TODOS_CACHE_KEY,
      })
      await facade.hold(result.cacheKey.key)
      await facade.release(result.cacheKey.key)

      const cacheKey = await cacheManager.get(result.cacheKey.key)
      expect(cacheKey?.holdCount).toBe(0)
    })

    it('tracks multiple holds', async () => {
      const result = await queryManager.getById<Todo>({
        collection: 'todos',
        id: 'todo-1',
        cacheKey: TODOS_CACHE_KEY,
      })
      await facade.hold(result.cacheKey.key)
      await facade.hold(result.cacheKey.key)
      await facade.release(result.cacheKey.key)

      const cacheKey = await cacheManager.get(result.cacheKey.key)
      expect(cacheKey?.holdCount).toBe(1)
    })

    it('releases all holds on destroy', async () => {
      const result = await queryManager.getById<Todo>({
        collection: 'todos',
        id: 'todo-1',
        cacheKey: TODOS_CACHE_KEY,
      })
      await facade.hold(result.cacheKey.key)
      await facade.hold(result.cacheKey.key)

      await facade.releaseAll()

      const cacheKey = await cacheManager.get(result.cacheKey.key)
      expect(cacheKey?.holdCount).toBe(0)
    })
  })

  describe('onSessionDestroyed', () => {
    it('clears all active holds without calling cacheManager.release()', async () => {
      const result = await queryManager.getById<Todo>({
        collection: 'todos',
        id: 'todo-1',
        cacheKey: TODOS_CACHE_KEY,
      })
      await facade.hold(result.cacheKey.key)
      await facade.hold(result.cacheKey.key) // refcount = 2 internally

      queryManager.onSessionDestroyed()

      // Internal tracking was cleared — release should be a no-op (no error, no call to cacheManager)
      await facade.release(result.cacheKey.key) // no-op since activeHolds was cleared

      // Hold count in storage should still be 1 (we didn't call cacheManager.release)
      const cacheKey = await cacheManager.get(result.cacheKey.key)
      expect(cacheKey?.holdCount).toBe(1)
    })
  })

  describe('releaseForCacheKey', () => {
    it('removes hold tracking for an evicted cache key', async () => {
      const result = await queryManager.getById<Todo>({
        collection: 'todos',
        id: 'todo-1',
        cacheKey: TODOS_CACHE_KEY,
      })
      await facade.hold(result.cacheKey.key)
      await facade.hold(result.cacheKey.key)

      queryManager.releaseForCacheKey(result.cacheKey.key)

      // Hold count in storage is unchanged (key was evicted, no release call)
      const cacheKey = await cacheManager.get(result.cacheKey.key)
      expect(cacheKey?.holdCount).toBe(1)
    })
  })
})
