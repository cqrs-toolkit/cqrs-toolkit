/**
 * Integration tests for cache invalidation behavior, observed through
 * {@link CqrsClient}.
 *
 * Mirrors `invalidation.integration.test.ts` but queries the post-event read
 * model state through `client.queryManager` instead of the internal read
 * model store. WS event injection remains internal scaffolding (consumers
 * receive these through the real WebSocket transport).
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

describe.each(bootstrapVariants)('$name invalidation (client)', ({ bootstrap }) => {
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
        const cacheKey = await ctx.client.cacheManager.acquireKey(TODO_SCOPE_KEY)

        const event = ctx.createPersistedEvent('TodoCreated', 'nb.Todo-todo-1', {
          id: 'todo-1',
          title: 'Invalidated',
        })

        // Inject the event. The processor signals invalidation, so no
        // readmodel:updated fires for this entity. The invalidation scheduler
        // will schedule a refetch, but without a network mock it won't
        // populate the store — the client sees nothing.
        const testSyncManager = ctx.syncManager as TestSyncManager
        testSyncManager.injectWsEvents([{ event, topics: ['todos'] }])

        // Yield to let the WriteQueue drain the reconcile op.
        await new Promise((resolve) => setTimeout(resolve, 50))

        const model = await ctx.client.queryManager.getById({
          collection: 'todos',
          id: 'todo-1',
          cacheKey,
        })
        expect(model.data).toBeUndefined()
      },
    ),
  )
})
