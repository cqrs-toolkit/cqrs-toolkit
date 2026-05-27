/**
 * Integration tests for {@link useListQuery}.
 *
 * Wires the React list-query hook against a real {@link CqrsClient} using
 * the shared bootstrappers from `@cqrs-toolkit/client/testing`. Runs under
 * both the in-memory and SQLite-backed wiring paths via `describe.each`.
 */

import {
  bootstrapVariants,
  createTodoHandler,
  integrationTestOptions,
  TestSyncManager,
  todoCreatedProcessor,
  type TodoRow,
} from '@cqrs-toolkit/client/testing'
import { type ServiceLink } from '@meticoeus/ddd-es'
import { act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createRun, tick, todosCollection, waitFor } from './testing/index.js'
import { useScopeCacheKey } from './useCacheKey.js'
import { useListQuery } from './useListQuery.js'

describe.each(bootstrapVariants)('$name useListQuery (integration)', ({ bootstrap }) => {
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
        // Seed two rows under the cache key the hook will register.
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

        const { result } = ctx.renderHook(() => {
          const cacheKey = useScopeCacheKey<ServiceLink>({ scopeType: 'todos' })
          return useListQuery<ServiceLink, TodoRow>({ collection: 'todos', cacheKey })
        })

        expect(result.current.loading).toBe(true)
        expect(result.current.items).toHaveLength(0)

        await waitFor(() => result.current.items.length === 2)

        expect(result.current.loading).toBe(false)
        expect(result.current.state.status).toBe('ready')
        const titles = result.current.items.map((i) => i.title).sort()
        expect(titles).toEqual(['First', 'Second'])
      },
    ),
  )

  it(
    'reflects a locally-submitted command in the snapshot items',
    integrationTestOptions,
    run(
      {
        collections: [todosCollection()],
        processors: [todoCreatedProcessor()],
        commandHandlers: [createTodoHandler()],
        SyncManagerClass: TestSyncManager,
      },
      async (ctx) => {
        const { result: hookResult } = ctx.renderHook(() => {
          const cacheKey = useScopeCacheKey<ServiceLink>({ scopeType: 'todos' })
          const state = useListQuery<ServiceLink, TodoRow>({ collection: 'todos', cacheKey })
          return { cacheKey, state }
        })

        // Wait for the cache key to register so we can drive the submit.
        // Don't wait for `!state.loading` — with no initial rows the list
        // query stays in `seeding` until a watchCollection signal arrives,
        // and the submit below is what produces that signal.
        await act(async () => {
          await tick()
        })
        await waitFor(() => !!hookResult.current.cacheKey)
        const identity = hookResult.current.cacheKey
        if (!identity) return

        // Submit through the public CqrsClient surface — this is what a
        // real consumer would do from a UI handler.
        const submit = await ctx.client.submit({
          command: {
            type: 'CreateTodo',
            data: { id: 'todo-1', title: 'Local create' },
          },
          cacheKey: identity,
        })
        expect(submit.ok).toBe(true)

        await waitFor(() => hookResult.current.state.items.length === 1)

        expect(hookResult.current.state.items[0]?.title).toBe('Local create')
        expect(hookResult.current.state.hasLocalChanges).toBe(true)
        expect(hookResult.current.state.state.status).toBe('ready')

        // A second submit appends to the same list — verifies the
        // watchCollection refetch path under repeated mutations.
        await ctx.client.submit({
          command: { type: 'CreateTodo', data: { id: 'todo-2', title: 'Second' } },
          cacheKey: identity,
        })
        await waitFor(() => hookResult.current.state.items.length === 2)

        const titles = hookResult.current.state.items.map((i) => i.title).sort()
        expect(titles).toEqual(['Local create', 'Second'])
      },
    ),
  )
})
