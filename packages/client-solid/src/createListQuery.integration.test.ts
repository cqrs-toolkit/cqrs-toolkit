/**
 * Integration tests for {@link createListQuery}.
 *
 * Wires the SolidJS list-query primitive against a real {@link CqrsClient}
 * using the shared bootstrappers from `@cqrs-toolkit/client/testing`. Runs
 * under both the in-memory and SQLite-backed wiring paths via `describe.each`.
 */

import {
  TestSyncManager,
  type TodoRow,
  bootstrapVariants,
  createTodoHandler,
  integrationTestOptions,
  todoCreatedProcessor,
} from '@cqrs-toolkit/client/testing'
import { type ServiceLink } from '@meticoeus/ddd-es'
import { describe, expect, it } from 'vitest'
import { createScopeCacheKey } from './createCacheKey.js'
import { createListQuery } from './createListQuery.js'
import { createRun, todosCollection, waitFor } from './testing/index.js'

describe.each(bootstrapVariants)('$name createListQuery (integration)', ({ bootstrap }) => {
  const run = createRun(bootstrap)

  it(
    'queries existing seeded data through the live query manager',
    integrationTestOptions,
    run(
      {
        collections: [todosCollection()],
        processors: [todoCreatedProcessor()],
        SyncManagerClass: TestSyncManager,
      },
      async (ctx) => {
        // Seed two rows under the cache key the Solid primitive will register.
        const registered = await ctx.client.cacheManager.registerCacheKey({
          kind: 'scope',
          scopeType: 'todos',
        })
        await ctx.readModelStore.setServerData(
          'todos',
          'todo-1',
          { id: 'todo-1', title: 'First' },
          registered.key,
        )
        await ctx.readModelStore.setServerData(
          'todos',
          'todo-2',
          { id: 'todo-2', title: 'Second' },
          registered.key,
        )

        // Re-enter the Solid owner — the awaits above lost the synchronous
        // owner the harness set up.
        const state = ctx.runInOwner(() => {
          const cacheKey = createScopeCacheKey<ServiceLink>({ scopeType: 'todos' })
          return createListQuery<ServiceLink, TodoRow>({
            collection: 'todos',
            cacheKey,
          })
        })

        expect(state.loading).toBe(true)
        expect(state.items).toHaveLength(0)

        await waitFor(() => state.items.length === 2)

        expect(state.loading).toBe(false)
        expect(state.state.status).toBe('ready')
        const titles = state.items.map((i) => i.title).sort()
        expect(titles).toEqual(['First', 'Second'])
      },
    ),
  )

  it(
    'reflects a locally-submitted command in the reactive items',
    integrationTestOptions,
    run(
      {
        collections: [todosCollection()],
        processors: [todoCreatedProcessor()],
        commandHandlers: [createTodoHandler()],
        SyncManagerClass: TestSyncManager,
      },
      async (ctx) => {
        const { cacheKey, state } = ctx.runInOwner(() => {
          const cacheKey = createScopeCacheKey<ServiceLink>({ scopeType: 'todos' })
          const state = createListQuery<ServiceLink, TodoRow>({
            collection: 'todos',
            cacheKey,
          })
          return { cacheKey, state }
        })

        // Wait for the cache key to register so we can drive the submit.
        // Don't wait for `!state.loading` — with no initial rows the list
        // query stays in `seeding` until a watchCollection signal arrives,
        // and the submit below is what produces that signal.
        await waitFor(() => !!cacheKey())
        const identity = cacheKey()
        if (!identity) return

        // Submit through the public CqrsClient surface — this is what a
        // real consumer would do from a UI handler.
        const result = await ctx.client.submit({
          command: {
            type: 'CreateTodo',
            data: { id: 'todo-1', title: 'Local create' },
          },
          cacheKey: identity,
        })
        expect(result.ok).toBe(true)

        await waitFor(() => state.items.length === 1)

        expect(state.items[0]?.title).toBe('Local create')
        expect(state.hasLocalChanges).toBe(true)
        expect(state.state.status).toBe('ready')

        // A second submit appends to the same list — verifies the
        // watchCollection refetch path under repeated mutations.
        await ctx.client.submit({
          command: { type: 'CreateTodo', data: { id: 'todo-2', title: 'Second' } },
          cacheKey: identity,
        })
        await waitFor(() => state.items.length === 2)

        const titles = state.items.map((i) => i.title).sort()
        expect(titles).toEqual(['Local create', 'Second'])
      },
    ),
  )
})
