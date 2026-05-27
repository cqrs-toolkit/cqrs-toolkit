/**
 * Integration tests for {@link useItemQuery}.
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
import { createRun, todosCollection, waitFor } from './testing/index.js'
import { useItemQuery } from './useItemQuery.js'

describe.each(bootstrapVariants)('$name useItemQuery (integration)', ({ bootstrap }) => {
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

        const { result } = ctx.renderHook(() =>
          useItemQuery<ServiceLink, TodoRow>({
            collection: 'todos',
            id: 'todo-1',
            cacheKey,
          }),
        )

        expect(result.current.loading).toBe(true)
        expect(result.current.data).toBeUndefined()

        await waitFor(() => result.current.data !== undefined)

        expect(result.current.loading).toBe(false)
        expect(result.current.data?.id).toBe('todo-1')
        expect(result.current.data?.title).toBe('Seeded item')
        expect(result.current.error).toBeUndefined()
      },
    ),
  )

  it(
    'reflects a locally-submitted create and update in the snapshot data',
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

        const { result } = ctx.renderHook(() =>
          useItemQuery<ServiceLink, TodoRow>({
            collection: 'todos',
            id: 'todo-1',
            cacheKey,
          }),
        )

        // Initial fetch resolves: no row yet, loading flips false with
        // data === undefined.
        await waitFor(() => !result.current.loading)
        expect(result.current.data).toBeUndefined()

        const create = await ctx.client.submit({
          command: { type: 'CreateTodo', data: { id: 'todo-1', title: 'Original' } },
          cacheKey,
        })
        expect(create.ok).toBe(true)

        await waitFor(() => result.current.data?.title === 'Original')
        expect(result.current.hasLocalChanges).toBe(true)

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

        await waitFor(() => result.current.data?.title === 'Updated')
        expect(result.current.data?.id).toBe('todo-1')
        expect(result.current.error).toBeUndefined()
      },
    ),
  )
})
