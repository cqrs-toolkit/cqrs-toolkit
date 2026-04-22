/**
 * Integration tests for WebSocket event processing, observed through
 * {@link CqrsClient}.
 *
 * Mirrors `ws-events.integration.test.ts` in concept but drives observation
 * through the public client surface (`client.queryManager`, `client.events$`,
 * `client.cacheManager`). Internals are used only for WS event injection
 * (scaffolding) and occasional introspection — consumers never have to do
 * either. No commands are involved in these tests; each exercises how
 * foreign events from other clients flow through the pipeline to the cached
 * read model.
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

describe.each(bootstrapVariants)('$name ws-events (client)', ({ bootstrap }) => {
  const run = createRun(bootstrap)

  describe('single event processing', () => {
    it(
      'foreign entity arrives via WS and creates a read model visible through the client',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor()],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          const cacheKey = await ctx.client.cacheManager.acquireKey(TODO_SCOPE_KEY)

          const event = ctx.createPersistedEvent('TodoCreated', 'nb.Todo-todo-1', {
            id: 'todo-1',
            title: 'From other client',
          })

          await ctx.injectWsEventsAndWait([{ event, topics: ['todos'] }], 'todo-1')

          const model = await ctx.client.queryManager.getById<{ title: string }>({
            collection: 'todos',
            id: 'todo-1',
            cacheKey,
          })
          expect(model.data?.title).toBe('From other client')
          expect(model.hasLocalChanges).toBe(false)
        },
      ),
    )

    it(
      'stateful event bypasses revision checks and becomes queryable',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor()],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          const cacheKey = await ctx.client.cacheManager.acquireKey(TODO_SCOPE_KEY)

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

          const model = await ctx.client.queryManager.getById<{ title: string }>({
            collection: 'todos',
            id: 'todo-1',
            cacheKey,
          })
          expect(model.data?.title).toBe('Snapshot')
          expect(model.hasLocalChanges).toBe(false)
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
          const cacheKey = await ctx.client.cacheManager.acquireKey(TODO_SCOPE_KEY)

          const event: IPersistedEvent = {
            ...ctx.createPersistedEvent('TodoCreated', 'nb.Todo-todo-1', {
              id: 'todo-1',
              title: 'Fanout',
            }),
            revision: 0n,
          }

          await ctx.injectWsEventsAndWait([{ event, topics: ['todos'] }], 'todo-1')

          const primary = await ctx.client.queryManager.getById<{ title: string }>({
            collection: 'todos',
            id: 'todo-1',
            cacheKey,
          })
          const mirror = await ctx.client.queryManager.getById<{ title: string }>({
            collection: 'todos',
            id: 'todo-1-mirror',
            cacheKey,
          })
          expect(primary.data?.title).toBe('Fanout')
          expect(mirror.data?.title).toBe('Mirror of Fanout')
        },
      ),
    )

    it(
      'delete-type processor result removes the row from the read model',
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
          const cacheKey = await ctx.client.cacheManager.acquireKey(TODO_SCOPE_KEY)

          const create: IPersistedEvent = {
            ...ctx.createPersistedEvent('TodoCreated', 'nb.Todo-todo-1', {
              id: 'todo-1',
              title: 'To be deleted',
            }),
            revision: 0n,
          }
          await ctx.injectWsEventsAndWait([{ event: create, topics: ['todos'] }], 'todo-1')

          const before = await ctx.client.queryManager.getById({
            collection: 'todos',
            id: 'todo-1',
            cacheKey,
          })
          expect(before.data).toBeDefined()

          const del: IPersistedEvent = {
            ...ctx.createPersistedEvent('TodoDeleted', 'nb.Todo-todo-1', { id: 'todo-1' }),
            revision: 1n,
          }
          await ctx.injectWsEventsAndWait([{ event: del, topics: ['todos'] }], 'todo-1')

          const after = await ctx.client.queryManager.getById({
            collection: 'todos',
            id: 'todo-1',
            cacheKey,
          })
          expect(after.data).toBeUndefined()
        },
      ),
    )
  })

  describe('dedup', () => {
    it(
      'duplicate event in a single batch produces only one read model row',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor()],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          const cacheKey = await ctx.client.cacheManager.acquireKey(TODO_SCOPE_KEY)

          const event = ctx.createPersistedEvent('TodoCreated', 'nb.Todo-todo-1', {
            id: 'todo-1',
            title: 'Only once',
          })

          await ctx.injectWsEventsAndWait(
            [
              { event, topics: ['todos'] },
              { event, topics: ['todos'] },
            ],
            'todo-1',
          )

          const list = await ctx.client.queryManager.list<{ id: string; title: string }>({
            collection: 'todos',
            cacheKey,
          })
          expect(list.data).toHaveLength(1)
          expect(list.data[0]).toMatchObject({ id: 'todo-1', title: 'Only once' })
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
          const cacheKey = await ctx.client.cacheManager.acquireKey(TODO_SCOPE_KEY)

          const event = ctx.createPersistedEvent('TodoCreated', 'nb.Todo-todo-1', {
            id: 'todo-1',
            title: 'From server',
          })

          await ctx.injectWsEventsAndWait([{ event, topics: ['todos'] }], 'todo-1')

          // Second delivery of the same event — dedup should drop it. No
          // readmodel:updated will fire, so we yield instead of awaiting a
          // specific event.
          const testSyncManager = ctx.syncManager as TestSyncManager
          testSyncManager.injectWsEvents([{ event, topics: ['todos'] }])
          await new Promise((resolve) => setTimeout(resolve, 50))

          const list = await ctx.client.queryManager.list({ collection: 'todos', cacheKey })
          expect(list.data).toHaveLength(1)
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
          const cacheKey = await ctx.client.cacheManager.acquireKey(TODO_SCOPE_KEY)

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

          await ctx.injectWsEventsAndWait(
            [
              { event: create, topics: ['todos'] },
              { event: update, topics: ['todos'] },
            ],
            'todo-1',
          )

          const model = await ctx.client.queryManager.getById<{ title: string }>({
            collection: 'todos',
            id: 'todo-1',
            cacheKey,
          })
          expect(model.data?.title).toBe('Updated')
          expect(model.hasLocalChanges).toBe(false)
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
          const cacheKey = await ctx.client.cacheManager.acquireKey(TODO_SCOPE_KEY)

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

          await ctx.injectWsEventsAndWait(
            [
              { event: eventA, topics: ['todos'] },
              { event: eventB, topics: ['todos'] },
            ],
            'todo-a',
          )

          const list = await ctx.client.queryManager.list<{ id: string; title: string }>({
            collection: 'todos',
            cacheKey,
          })
          expect(list.data).toHaveLength(2)
          const titles = list.data.map((d) => d.title).sort()
          expect(titles).toEqual(['Stream A', 'Stream B'])
        },
      ),
    )
  })

  describe('gap detection', () => {
    it(
      'out-of-order event is dropped when its revision skips ahead',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor(), todoUpdatedProcessor()],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          const cacheKey = await ctx.client.cacheManager.acquireKey(TODO_SCOPE_KEY)

          const create: IPersistedEvent = {
            ...ctx.createPersistedEvent('TodoCreated', 'nb.Todo-todo-1', {
              id: 'todo-1',
              title: 'Baseline',
            }),
            revision: 0n,
          }
          await ctx.injectWsEventsAndWait([{ event: create, topics: ['todos'] }], 'todo-1')

          // Push a revision that skips revision 1 — should be dropped.
          const outOfOrder: IPersistedEvent = {
            ...ctx.createPersistedEvent('TodoUpdated', 'nb.Todo-todo-1', {
              id: 'todo-1',
              title: 'Skipped ahead',
            }),
            revision: 5n,
          }
          const testSyncManager = ctx.syncManager as TestSyncManager
          testSyncManager.injectWsEvents([{ event: outOfOrder, topics: ['todos'] }])
          await new Promise((resolve) => setTimeout(resolve, 50))

          const model = await ctx.client.queryManager.getById<{ title: string }>({
            collection: 'todos',
            id: 'todo-1',
            cacheKey,
          })
          expect(model.data?.title).toBe('Baseline')
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
          const cacheKey = await ctx.client.cacheManager.acquireKey(TODO_SCOPE_KEY)

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

          // A: in-order (rev 1); B: out-of-order (rev 5 — gap). Only A applies.
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

          const a = await ctx.client.queryManager.getById<{ title: string }>({
            collection: 'todos',
            id: 'todo-a',
            cacheKey,
          })
          const b = await ctx.client.queryManager.getById<{ title: string }>({
            collection: 'todos',
            id: 'todo-b',
            cacheKey,
          })
          expect(a.data?.title).toBe('A updated')
          expect(b.data?.title).toBe('B baseline')
        },
      ),
    )
  })

  describe('multi-collection routing', () => {
    it(
      'event routed to multiple cache keys is visible in every queried key',
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

          const acquiredA = await ctx.client.cacheManager.acquireKey(keyA)
          const acquiredB = await ctx.client.cacheManager.acquireKey(keyB)
          await ctx.syncManager.seedForKey(acquiredA)
          await ctx.syncManager.seedForKey(acquiredB)

          const event = ctx.createPersistedEvent('NoteCreated', 'nb.Note-note-1', {
            id: 'note-1',
          })

          await ctx.injectWsEventsAndWait(
            [{ event, topics: ['Notebook:a', 'Notebook:b'] }],
            'note-1',
          )

          // Both cache keys see the same row — the event was associated with
          // both scopes at ingest time.
          const viaA = await ctx.client.queryManager.list<{ id: string }>({
            collection: 'notes',
            cacheKey: acquiredA,
          })
          const viaB = await ctx.client.queryManager.list<{ id: string }>({
            collection: 'notes',
            cacheKey: acquiredB,
          })
          expect(viaA.data).toHaveLength(1)
          expect(viaA.data[0]).toMatchObject({ id: 'note-1' })
          expect(viaB.data).toHaveLength(1)
          expect(viaB.data[0]).toMatchObject({ id: 'note-1' })
        },
      ),
    )
  })
})
