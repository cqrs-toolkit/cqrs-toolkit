/**
 * Integration tests for cache invalidation behavior.
 *
 * Tests processor invalidation signals that short-circuit event processing
 * and schedule refetches. Uses the real WriteQueue pipeline with only the
 * network layer mocked.
 */

import { describe, expect, it } from 'vitest'
import {
  TODO_SCOPE_KEY,
  TestSyncManager,
  bootstrapVariants,
  createRun,
  createTodosCollection,
  integrationTestOptions,
} from '../testing/index.js'

describe.each(bootstrapVariants)('$name invalidation', ({ bootstrap }) => {
  const run = createRun(bootstrap)

  it(
    'processor invalidate signal short-circuits the event without writing',
    integrationTestOptions,
    run(
      {
        collections: [createTodosCollection()],
        processors: [
          {
            eventTypes: 'TodoCreated',
            processor: () => ({ invalidate: true }),
          },
        ],
        SyncManagerClass: TestSyncManager,
      },
      async (ctx) => {
        await ctx.cacheManager.acquire(TODO_SCOPE_KEY)

        const event = ctx.createPersistedEvent('TodoCreated', 'nb.Todo-todo-1', {
          id: 'todo-1',
          title: 'Invalidated',
        })

        // Inject the event. The processor signals invalidation, so no
        // readmodel:updated will fire for this entity. The invalidation
        // scheduler will schedule a refetch, but without a network mock
        // it won't populate the store.
        const testSyncManager = ctx.syncManager as TestSyncManager
        testSyncManager.injectWsEvents([{ event, topics: ['todos'] }])

        // Yield to let the WriteQueue drain the reconcile op
        await new Promise((resolve) => setTimeout(resolve, 50))

        const model = await ctx.readModelStore.getById('todos', 'todo-1')
        expect(model).toBeUndefined()
      },
    ),
  )
})
