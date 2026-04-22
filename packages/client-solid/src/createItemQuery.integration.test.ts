/**
 * Integration tests for {@link createItemQuery}.
 *
 * Wires the SolidJS item-query primitive against a real {@link CqrsClient}
 * using the shared bootstrappers from `@cqrs-toolkit/client/testing`. Runs
 * under both the in-memory and SQLite-backed wiring paths via `describe.each`.
 */

import {
  bootstrapVariants,
  createTodoHandler,
  integrationTestOptions,
  TestSyncManager,
  todoCreatedProcessor,
  todoUpdatedProcessor,
  updateTodoHandler,
  type TodoRow,
} from '@cqrs-toolkit/client/testing'
import { type ServiceLink } from '@meticoeus/ddd-es'
import { describe, expect, it } from 'vitest'
import { createItemQuery } from './createItemQuery.js'
import { createRun, todosCollection, waitFor } from './testing/index.js'

describe.each(bootstrapVariants)('$name createItemQuery (integration)', ({ bootstrap }) => {
  const run = createRun(bootstrap)

  it(
    'fetches an existing seeded entity through the live query manager',
    integrationTestOptions,
    run(
      {
        collections: [todosCollection()],
        processors: [todoCreatedProcessor()],
        SyncManagerClass: TestSyncManager,
      },
      async (ctx) => {
        // Pre-register the cacheKey and pre-seed under it. createItemQuery
        // captures cacheKey at session start (it isn't reactive to cacheKey
        // changes), so we pass the resolved identity directly.
        const cacheKey = await ctx.client.cacheManager.registerCacheKey({
          kind: 'scope',
          scopeType: 'todos',
        })
        await ctx.readModelStore.setServerData(
          'todos',
          'todo-1',
          { id: 'todo-1', title: 'Seeded item' },
          cacheKey.key,
        )

        // The awaits above lost the synchronous owner — re-enter so
        // createItemQuery's useClient() resolves.
        const state = ctx.runInOwner(() =>
          createItemQuery<ServiceLink, TodoRow>({
            collection: 'todos',
            id: 'todo-1',
            cacheKey,
          }),
        )

        expect(state.loading).toBe(true)
        expect(state.data).toBeUndefined()

        await waitFor(() => state.data !== undefined)

        expect(state.loading).toBe(false)
        expect(state.data?.id).toBe('todo-1')
        expect(state.data?.title).toBe('Seeded item')
        expect(state.error).toBeUndefined()
      },
    ),
  )

  it(
    'reflects a locally-submitted create and update in the reactive data',
    integrationTestOptions,
    run(
      {
        collections: [todosCollection()],
        processors: [todoCreatedProcessor(), todoUpdatedProcessor()],
        commandHandlers: [createTodoHandler(), updateTodoHandler()],
        SyncManagerClass: TestSyncManager,
      },
      async (ctx) => {
        const cacheKey = await ctx.client.cacheManager.registerCacheKey({
          kind: 'scope',
          scopeType: 'todos',
        })

        const state = ctx.runInOwner(() =>
          createItemQuery<ServiceLink, TodoRow>({
            collection: 'todos',
            id: 'todo-1',
            cacheKey,
          }),
        )

        // Initial fetch resolves: no row yet, loading flips false with
        // data === undefined.
        await waitFor(() => !state.loading)
        expect(state.data).toBeUndefined()

        const create = await ctx.client.submit({
          command: { type: 'CreateTodo', data: { id: 'todo-1', title: 'Original' } },
          cacheKey,
        })
        expect(create.ok).toBe(true)

        // The anticipated row arrival emits readmodel:updated → the
        // primitive's watchCollection subscription refetches.
        await waitFor(() => state.data?.title === 'Original')
        expect(state.hasLocalChanges).toBe(true)

        // Fetch current state to feed UpdateTodo's modelState requirement.
        const current = await ctx.client.queryManager.getById<TodoRow>({
          collection: 'todos',
          id: 'todo-1',
          cacheKey,
        })
        expect(current.data).toBeDefined()

        const update = await ctx.client.submit({
          command: { type: 'UpdateTodo', data: { id: 'todo-1', title: 'Updated' } },
          cacheKey,
          modelState: current.data,
        })
        expect(update.ok).toBe(true)

        await waitFor(() => state.data?.title === 'Updated')
        expect(state.data?.id).toBe('todo-1')
        expect(state.error).toBeUndefined()
      },
    ),
  )
})
