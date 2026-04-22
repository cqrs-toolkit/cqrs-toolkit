/**
 * Integration tests for WebSocket event processing.
 *
 * Tests foreign entity events arriving via WebSocket — entities created by
 * other clients, not this one. No local commands are involved. Exercises
 * the real WriteQueue pipeline with only the network layer mocked.
 */

import type { IPersistedEvent, ServiceLink } from '@meticoeus/ddd-es'
import { describe, expect, it } from 'vitest'
import { deriveScopeKey } from '../core/cache-manager/CacheKey.js'
import {
  NoteAggregate,
  TODO_SCOPE_KEY,
  TestSyncManager,
  bootstrapVariants,
  createRun,
  createTodosCollection,
  integrationTestOptions,
  todoCreatedProcessor,
  todoUpdatedProcessor,
} from '../testing/index.js'
import type { Collection } from '../types/config.js'

describe.each(bootstrapVariants)('$name ws-events', ({ bootstrap }) => {
  const run = createRun(bootstrap)

  describe('single event processing', () => {
    it(
      'foreign entity arrives via WS and creates a read model',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor()],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          await ctx.cacheManager.acquire(TODO_SCOPE_KEY)

          const event = ctx.createPersistedEvent('TodoCreated', 'nb.Todo-todo-1', {
            id: 'todo-1',
            title: 'From other client',
          })

          await ctx.injectWsEventsAndWait([{ event, topics: ['todos'] }], 'todo-1')

          const model = await ctx.readModelStore.getById<{ title: string }>('todos', 'todo-1')
          expect(model).toBeDefined()
          expect(model?.data.title).toBe('From other client')
          expect(model?.hasLocalChanges).toBe(false)
        },
      ),
    )

    it(
      'stateful event bypasses revision checks and writes to the store',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor()],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          await ctx.cacheManager.acquire(TODO_SCOPE_KEY)

          const snapshot: IPersistedEvent = {
            ...ctx.createPersistedEvent('TodoCreated', 'nb.Todo-todo-1', {
              id: 'todo-1',
              title: 'Snapshot',
            }),
            persistence: 'Stateful',
            revision: 0n,
            position: 0n,
          }

          await ctx.injectWsEventsAndWait([{ event: snapshot, topics: ['todos'] }], 'todo-1')

          const model = await ctx.readModelStore.getById<{ title: string }>('todos', 'todo-1')
          expect(model).toBeDefined()
          expect(model?.data.title).toBe('Snapshot')
          expect(model?.hasLocalChanges).toBe(false)
        },
      ),
    )

    it(
      'processor returning multiple results applies each independently',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [
            {
              eventTypes: 'TodoCreated',
              processor: (data, _state, pctx) => {
                const typed = data as { id: string; title: string }
                return [
                  {
                    collection: 'todos',
                    id: typed.id,
                    update: { type: 'set', data: typed },
                    isServerUpdate: pctx.persistence !== 'Anticipated',
                  },
                  {
                    collection: 'todos',
                    id: `${typed.id}-mirror`,
                    update: {
                      type: 'set',
                      data: { id: `${typed.id}-mirror`, title: `Mirror of ${typed.title}` },
                    },
                    isServerUpdate: pctx.persistence !== 'Anticipated',
                  },
                ]
              },
            },
          ],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          await ctx.cacheManager.acquire(TODO_SCOPE_KEY)

          const event: IPersistedEvent = {
            ...ctx.createPersistedEvent('TodoCreated', 'nb.Todo-todo-1', {
              id: 'todo-1',
              title: 'Fanout',
            }),
            revision: 0n,
          }

          await ctx.injectWsEventsAndWait([{ event, topics: ['todos'] }], 'todo-1')

          const primary = await ctx.readModelStore.getById<{ title: string }>('todos', 'todo-1')
          const mirror = await ctx.readModelStore.getById<{ title: string }>(
            'todos',
            'todo-1-mirror',
          )
          expect(primary?.data.title).toBe('Fanout')
          expect(mirror?.data.title).toBe('Mirror of Fanout')
        },
      ),
    )

    it(
      'delete-type processor result removes the row from the store',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [
            todoCreatedProcessor(),
            {
              eventTypes: 'TodoDeleted',
              processor: (data, _state, pctx) => ({
                collection: 'todos',
                id: (data as { id: string }).id,
                update: { type: 'delete' },
                isServerUpdate: pctx.persistence !== 'Anticipated',
              }),
            },
          ],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          await ctx.cacheManager.acquire(TODO_SCOPE_KEY)

          const create: IPersistedEvent = {
            ...ctx.createPersistedEvent('TodoCreated', 'nb.Todo-todo-1', {
              id: 'todo-1',
              title: 'To be deleted',
            }),
            revision: 0n,
          }
          await ctx.injectWsEventsAndWait([{ event: create, topics: ['todos'] }], 'todo-1')

          const before = await ctx.readModelStore.getById('todos', 'todo-1')
          expect(before).toBeDefined()

          const del: IPersistedEvent = {
            ...ctx.createPersistedEvent('TodoDeleted', 'nb.Todo-todo-1', { id: 'todo-1' }),
            revision: 1n,
          }
          await ctx.injectWsEventsAndWait([{ event: del, topics: ['todos'] }], 'todo-1')

          const after = await ctx.readModelStore.getById('todos', 'todo-1')
          expect(after).toBeUndefined()
        },
      ),
    )
  })

  describe('dedup', () => {
    it(
      'duplicate event in a single batch is deduped',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor()],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          await ctx.cacheManager.acquire(TODO_SCOPE_KEY)

          const event = ctx.createPersistedEvent('TodoCreated', 'nb.Todo-todo-1', {
            id: 'todo-1',
            title: 'Only once',
          })

          // Inject both copies at once — dedup should cache the first and
          // drop the second, producing only one read model entry.
          await ctx.injectWsEventsAndWait(
            [
              { event, topics: ['todos'] },
              { event, topics: ['todos'] },
            ],
            'todo-1',
          )

          const models = await ctx.readModelStore.list('todos')
          expect(models).toHaveLength(1)
          expect(models[0]?.data).toMatchObject({ id: 'todo-1', title: 'Only once' })
        },
      ),
    )

    it(
      'same event arriving in two separate batches is idempotent',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor()],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          await ctx.cacheManager.acquire(TODO_SCOPE_KEY)

          const event = ctx.createPersistedEvent('TodoCreated', 'nb.Todo-todo-1', {
            id: 'todo-1',
            title: 'From server',
          })

          await ctx.injectWsEventsAndWait([{ event, topics: ['todos'] }], 'todo-1')

          // Second injection of the same event — the dedup pass should
          // recognize it's already cached and skip processing. No second
          // readmodel:updated emission, so we just yield and check count.
          const testSyncManager = ctx.syncManager as TestSyncManager
          testSyncManager.injectWsEvents([{ event, topics: ['todos'] }])
          // Yield to let the WriteQueue drain the no-op reconcile
          await new Promise((resolve) => setTimeout(resolve, 50))

          const models = await ctx.readModelStore.list('todos')
          expect(models).toHaveLength(1)
        },
      ),
    )
  })

  describe('batching and ordering', () => {
    it(
      'two sequential events for the same stream apply in revision order',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor(), todoUpdatedProcessor()],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          await ctx.cacheManager.acquire(TODO_SCOPE_KEY)

          const create: IPersistedEvent = {
            ...ctx.createPersistedEvent('TodoCreated', 'nb.Todo-todo-1', {
              id: 'todo-1',
              title: 'Original',
            }),
            revision: 0n,
          }
          const update: IPersistedEvent = {
            ...ctx.createPersistedEvent('TodoUpdated', 'nb.Todo-todo-1', {
              id: 'todo-1',
              title: 'Updated',
            }),
            revision: 1n,
          }

          // Both events arrive in a single batch
          await ctx.injectWsEventsAndWait(
            [
              { event: create, topics: ['todos'] },
              { event: update, topics: ['todos'] },
            ],
            'todo-1',
          )

          const model = await ctx.readModelStore.getById<{ id: string; title: string }>(
            'todos',
            'todo-1',
          )
          expect(model).toBeDefined()
          expect(model?.data.title).toBe('Updated')
          expect(model?.hasLocalChanges).toBe(false)
        },
      ),
    )

    it(
      'events for multiple streams in one batch apply independently',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor()],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          await ctx.cacheManager.acquire(TODO_SCOPE_KEY)

          const eventA: IPersistedEvent = {
            ...ctx.createPersistedEvent('TodoCreated', 'nb.Todo-todo-a', {
              id: 'todo-a',
              title: 'Stream A',
            }),
            revision: 0n,
          }
          const eventB: IPersistedEvent = {
            ...ctx.createPersistedEvent('TodoCreated', 'nb.Todo-todo-b', {
              id: 'todo-b',
              title: 'Stream B',
            }),
            revision: 0n,
          }

          // Wait for todo-a — todo-b will also be in the same readmodel:updated batch
          await ctx.injectWsEventsAndWait(
            [
              { event: eventA, topics: ['todos'] },
              { event: eventB, topics: ['todos'] },
            ],
            'todo-a',
          )

          const models = await ctx.readModelStore.list<{ id: string; title: string }>('todos')
          expect(models).toHaveLength(2)
          const titles = models.map((m) => m.data.title).sort()
          expect(titles).toEqual(['Stream A', 'Stream B'])
        },
      ),
    )
  })

  describe('gap detection', () => {
    it(
      'out-of-order event is dropped (gap detected)',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor(), todoUpdatedProcessor()],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          await ctx.cacheManager.acquire(TODO_SCOPE_KEY)

          // Establish baseline at revision 0
          const create: IPersistedEvent = {
            ...ctx.createPersistedEvent('TodoCreated', 'nb.Todo-todo-1', {
              id: 'todo-1',
              title: 'Baseline',
            }),
            revision: 0n,
          }
          await ctx.injectWsEventsAndWait([{ event: create, topics: ['todos'] }], 'todo-1')

          // Push a future revision that skips revision 1 — should be dropped
          const outOfOrder: IPersistedEvent = {
            ...ctx.createPersistedEvent('TodoUpdated', 'nb.Todo-todo-1', {
              id: 'todo-1',
              title: 'Skipped ahead',
            }),
            revision: 5n,
          }
          const testSyncManager = ctx.syncManager as TestSyncManager
          testSyncManager.injectWsEvents([{ event: outOfOrder, topics: ['todos'] }])
          // Yield to let the WriteQueue drain — no readmodel:updated expected
          await new Promise((resolve) => setTimeout(resolve, 50))

          const model = await ctx.readModelStore.getById<{ title: string }>('todos', 'todo-1')
          expect(model).toBeDefined()
          expect(model?.data.title).toBe('Baseline')
        },
      ),
    )

    it(
      'gap in one stream does not block other streams in the same batch',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor(), todoUpdatedProcessor()],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          await ctx.cacheManager.acquire(TODO_SCOPE_KEY)

          // Establish baselines for both streams at revision 0
          const createA: IPersistedEvent = {
            ...ctx.createPersistedEvent('TodoCreated', 'nb.Todo-todo-a', {
              id: 'todo-a',
              title: 'A baseline',
            }),
            revision: 0n,
          }
          const createB: IPersistedEvent = {
            ...ctx.createPersistedEvent('TodoCreated', 'nb.Todo-todo-b', {
              id: 'todo-b',
              title: 'B baseline',
            }),
            revision: 0n,
          }
          await ctx.injectWsEventsAndWait(
            [
              { event: createA, topics: ['todos'] },
              { event: createB, topics: ['todos'] },
            ],
            'todo-a',
          )

          // A gets an in-order update (revision 1), B gets an out-of-order
          // update (revision 5 — gap). A should apply; B should be dropped.
          const updateA: IPersistedEvent = {
            ...ctx.createPersistedEvent('TodoUpdated', 'nb.Todo-todo-a', {
              id: 'todo-a',
              title: 'A updated',
            }),
            revision: 1n,
          }
          const gappedB: IPersistedEvent = {
            ...ctx.createPersistedEvent('TodoUpdated', 'nb.Todo-todo-b', {
              id: 'todo-b',
              title: 'B skipped ahead',
            }),
            revision: 5n,
          }
          await ctx.injectWsEventsAndWait(
            [
              { event: updateA, topics: ['todos'] },
              { event: gappedB, topics: ['todos'] },
            ],
            'todo-a',
          )

          const a = await ctx.readModelStore.getById<{ title: string }>('todos', 'todo-a')
          const b = await ctx.readModelStore.getById<{ title: string }>('todos', 'todo-b')
          expect(a?.data.title).toBe('A updated')
          expect(b?.data.title).toBe('B baseline')
        },
      ),
    )
  })

  describe('multi-collection routing', () => {
    it(
      'event routed to multiple cache keys is cached with all key associations',
      integrationTestOptions,
      run(
        {
          collections: [
            {
              name: 'notes',
              aggregate: NoteAggregate,
              cacheKeysFromTopics: (topics) =>
                topics
                  .filter((t) => t.startsWith('Notebook:'))
                  .map((t) =>
                    deriveScopeKey({
                      scopeType: 'notebook-notes',
                      scopeParams: { nb: t.split(':')[1] },
                    }),
                  ),
              seedOnDemand: {
                keyTypes: [{ kind: 'scope', scopeType: 'notebook-notes' }],
                subscribeTopics: () => [],
              },
              matchesStream: (s) => s.startsWith('nb.Note-'),
              fetchSeedRecords: async () => ({ records: [], nextCursor: null }),
            } satisfies Collection<ServiceLink>,
          ],
          processors: [
            {
              eventTypes: 'NoteCreated',
              processor: (data: { id: string }, _state: unknown, pctx) => ({
                collection: 'notes',
                id: data.id,
                update: { type: 'set' as const, data },
                isServerUpdate: pctx.persistence !== 'Anticipated',
              }),
            },
          ],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          const keyA = deriveScopeKey({ scopeType: 'notebook-notes', scopeParams: { nb: 'a' } })
          const keyB = deriveScopeKey({ scopeType: 'notebook-notes', scopeParams: { nb: 'b' } })
          await ctx.cacheManager.acquireKey(keyA)
          await ctx.cacheManager.acquireKey(keyB)
          await ctx.syncManager.seedForKey(keyA)
          await ctx.syncManager.seedForKey(keyB)

          const event = ctx.createPersistedEvent('NoteCreated', 'nb.Note-note-1', {
            id: 'note-1',
          })

          await ctx.injectWsEventsAndWait(
            [{ event, topics: ['Notebook:a', 'Notebook:b'] }],
            'note-1',
          )

          const cachedEvent = await ctx.storage.getCachedEvent(event.id)
          expect(cachedEvent?.cacheKeys).toContain(keyA.key)
          expect(cachedEvent?.cacheKeys).toContain(keyB.key)

          const models = await ctx.readModelStore.list('notes')
          expect(models).toHaveLength(1)
          expect(models[0]?.data).toMatchObject({ id: 'note-1' })
        },
      ),
    )
  })
})
