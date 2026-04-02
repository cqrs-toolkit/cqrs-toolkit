/**
 * Integration tests for the CQRS client pipeline.
 *
 * Exercises the full component wiring: command -> domain execution ->
 * anticipated events -> event processing -> read model updates -> queries.
 *
 * Runs each scenario against both online-only and worker-side bootstrap
 * paths to verify identical behavior.
 */

import type { IPersistedEvent, ServiceLink } from '@meticoeus/ddd-es'
import { afterEach, describe, expect, it } from 'vitest'
import type { IAnticipatedEvent } from '../core/command-lifecycle/AnticipatedEventShape.js'
import { SyncManager } from '../core/sync-manager/SyncManager.js'
import type { EnqueueCommand } from '../types/commands.js'
import { type IntegrationContext, bootstrapOnlineOnly, bootstrapWorkerSide } from './bootstrap.js'
import {
  TODO_SCOPE_KEY,
  createTodoHandler,
  createTodosCollection,
  rejectingHandler,
  todoCreatedProcessor,
  todoUpdatedProcessor,
  updateTodoHandler,
} from './fixtures.js'

// ---------------------------------------------------------------------------
// TestSyncManager — exposes protected methods for testing
// ---------------------------------------------------------------------------

class TestSyncManager extends SyncManager<ServiceLink, EnqueueCommand, unknown, IAnticipatedEvent> {
  async testHandleWebSocketEvent(event: IPersistedEvent, topics: string[] = []): Promise<void> {
    const cacheKeys = this.resolveCacheKeysFromTopics(event.streamId, topics)
    return this.onApplyWsEventOp({ type: 'apply-ws-event', event, cacheKeys })
  }
}

// ---------------------------------------------------------------------------
// Test matrix — same scenarios against both bootstrap paths
// ---------------------------------------------------------------------------

describe.each([
  { name: 'online-only', bootstrap: bootstrapOnlineOnly },
  { name: 'worker-side', bootstrap: bootstrapWorkerSide },
])('$name integration', ({ bootstrap }) => {
  let ctx: IntegrationContext

  afterEach(async () => {
    if (ctx) {
      await ctx.destroy()
    }
  })

  // -----------------------------------------------------------------------
  // A: Command -> Anticipated Events -> Read Model
  // -----------------------------------------------------------------------

  describe('command pipeline', () => {
    it('enqueue with handler produces read model optimistically', async () => {
      ctx = await bootstrap({
        collections: [createTodosCollection()],
        processors: [todoCreatedProcessor()],
        commandHandlers: [createTodoHandler()],
      })

      const result = await ctx.commandQueue.enqueue({
        command: { type: 'CreateTodo', data: { id: 'todo-1', title: 'Buy milk' } },
        cacheKey: TODO_SCOPE_KEY,
      })

      expect(result.ok).toBe(true)

      const models = await ctx.readModelStore.list('todos')
      expect(models).toHaveLength(1)
      expect(models[0]?.data).toMatchObject({ id: 'todo-1', title: 'Buy milk' })
      expect(models[0]?.hasLocalChanges).toBe(true)
    })

    it('enqueue without handler stores command but no read model', async () => {
      ctx = await bootstrap({
        collections: [createTodosCollection()],
        processors: [todoCreatedProcessor()],
      })

      const result = await ctx.commandQueue.enqueue({
        command: { type: 'CreateTodo', data: { id: 'todo-1', title: 'Test' } },
        cacheKey: TODO_SCOPE_KEY,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return

      const stored = await ctx.storage.getCommand(result.value.commandId)
      expect(stored).toBeDefined()
      expect(stored?.status).toBe('pending')

      const models = await ctx.readModelStore.list('todos')
      expect(models).toHaveLength(0)
    })

    it('multiple commands produce separate read models', async () => {
      ctx = await bootstrap({
        collections: [createTodosCollection()],
        processors: [todoCreatedProcessor()],
        commandHandlers: [createTodoHandler()],
      })

      await ctx.commandQueue.enqueue({
        command: { type: 'CreateTodo', data: { id: 'todo-1', title: 'First' } },
        cacheKey: TODO_SCOPE_KEY,
      })
      await ctx.commandQueue.enqueue({
        command: { type: 'CreateTodo', data: { id: 'todo-2', title: 'Second' } },
        cacheKey: TODO_SCOPE_KEY,
      })

      const models = await ctx.readModelStore.list('todos')
      expect(models).toHaveLength(2)

      const titles = models.map((m) => (m.data as { title: string }).title).sort()
      expect(titles).toEqual(['First', 'Second'])
    })

    it('update command merges into existing read model', async () => {
      ctx = await bootstrap({
        collections: [createTodosCollection()],
        processors: [todoCreatedProcessor(), todoUpdatedProcessor()],
        commandHandlers: [createTodoHandler(), updateTodoHandler()],
      })

      await ctx.commandQueue.enqueue({
        command: { type: 'CreateTodo', data: { id: 'todo-1', title: 'Original' } },
        cacheKey: TODO_SCOPE_KEY,
      })
      await ctx.commandQueue.enqueue({
        command: { type: 'UpdateTodo', data: { id: 'todo-1', title: 'Updated' } },
        cacheKey: TODO_SCOPE_KEY,
      })

      const model = await ctx.readModelStore.getById<{ id: string; title: string }>(
        'todos',
        'todo-1',
      )
      expect(model).toBeDefined()
      expect(model?.data.title).toBe('Updated')
    })
  })

  // -----------------------------------------------------------------------
  // B: Server Event Processing
  // -----------------------------------------------------------------------

  describe('server event processing', () => {
    it('WebSocket event flows through to read model', async () => {
      ctx = await bootstrap({
        collections: [createTodosCollection()],
        processors: [todoCreatedProcessor()],
        SyncManagerClass: TestSyncManager,
      })
      const testSyncManager = ctx.syncManager as TestSyncManager

      // Acquire the cache key so events have somewhere to land
      await ctx.cacheManager.acquire(TODO_SCOPE_KEY)

      const event = createPersistedEvent('TodoCreated', 'Todo-todo-1', {
        id: 'todo-1',
        title: 'From server',
      })

      await testSyncManager.testHandleWebSocketEvent(event, ['todos'])

      const model = await ctx.readModelStore.getById<{ title: string }>('todos', 'todo-1')
      expect(model).toBeDefined()
      expect(model?.data.title).toBe('From server')
      expect(model?.hasLocalChanges).toBe(false)
    })

    it('duplicate event is idempotent', async () => {
      ctx = await bootstrap({
        collections: [createTodosCollection()],
        processors: [todoCreatedProcessor()],
        SyncManagerClass: TestSyncManager,
      })
      const testSyncManager = ctx.syncManager as TestSyncManager

      await ctx.cacheManager.acquire(TODO_SCOPE_KEY)

      const event = createPersistedEvent('TodoCreated', 'Todo-todo-1', {
        id: 'todo-1',
        title: 'From server',
      })

      await testSyncManager.testHandleWebSocketEvent(event, ['todos'])
      await testSyncManager.testHandleWebSocketEvent(event, ['todos'])

      const models = await ctx.readModelStore.list('todos')
      expect(models).toHaveLength(1)
    })
  })

  // -----------------------------------------------------------------------
  // C: Cache Key Lifecycle
  // -----------------------------------------------------------------------

  describe('cache key lifecycle', () => {
    it('acquire -> seed data -> query -> evict -> empty', async () => {
      ctx = await bootstrap({
        collections: [createTodosCollection()],
        processors: [todoCreatedProcessor()],
      })

      // Acquire and seed data directly
      const cacheKey = await ctx.cacheManager.acquire(TODO_SCOPE_KEY)
      await ctx.readModelStore.setServerData(
        'todos',
        'todo-1',
        { id: 'todo-1', title: 'Seeded' },
        cacheKey,
      )

      // Verify data is accessible
      const model = await ctx.readModelStore.getById<{ title: string }>('todos', 'todo-1')
      expect(model).toBeDefined()
      expect(model?.data.title).toBe('Seeded')

      // Evict the cache key — should clear associated read models
      await ctx.cacheManager.evict(cacheKey)

      const afterEvict = await ctx.readModelStore.getById('todos', 'todo-1')
      expect(afterEvict).toBeUndefined()
    })
  })

  // -----------------------------------------------------------------------
  // D: Session Lifecycle
  // -----------------------------------------------------------------------

  describe('session lifecycle', () => {
    it('session destroyed clears all state', async () => {
      ctx = await bootstrap({
        collections: [createTodosCollection()],
        processors: [todoCreatedProcessor()],
        commandHandlers: [createTodoHandler()],
      })

      // Populate state
      await ctx.cacheManager.acquire(TODO_SCOPE_KEY)
      await ctx.commandQueue.enqueue({
        command: { type: 'CreateTodo', data: { id: 'todo-1', title: 'Test' } },
        cacheKey: TODO_SCOPE_KEY,
      })

      // Verify state exists
      expect(await ctx.readModelStore.list('todos')).toHaveLength(1)
      expect(await ctx.cacheManager.getCount()).toBeGreaterThan(0)

      // Start sync manager so it subscribes to session:destroyed
      await ctx.syncManager.start()

      // Trigger session destroyed
      ctx.eventBus.emit('session:destroyed', { reason: 'explicit' })

      // Wait for async handler to process
      await new Promise((resolve) => setTimeout(resolve, 100))

      // All state should be cleared
      expect(await ctx.readModelStore.list('todos')).toHaveLength(0)
      expect(await ctx.cacheManager.getCount()).toBe(0)
    })
  })

  // -----------------------------------------------------------------------
  // E: Command Validation Pipeline
  // -----------------------------------------------------------------------

  describe('command validation', () => {
    it('validation failure returns error without side effects', async () => {
      ctx = await bootstrap({
        collections: [createTodosCollection()],
        processors: [todoCreatedProcessor()],
        commandHandlers: [rejectingHandler()],
      })

      const result = await ctx.commandQueue.enqueue({
        command: { type: 'InvalidCommand', data: { title: '' } },
        cacheKey: TODO_SCOPE_KEY,
      })

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: 'title' })]),
      )

      // No read models created
      const models = await ctx.readModelStore.list('todos')
      expect(models).toHaveLength(0)

      // No command persisted (validation failures are not stored)
      const allCommands = await ctx.storage.getCommands()
      expect(allCommands).toHaveLength(0)
    })
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let eventIdCounter = 0

function createPersistedEvent(
  type: string,
  streamId: string,
  data: Record<string, unknown>,
): IPersistedEvent {
  eventIdCounter++
  return {
    id: `evt-${eventIdCounter}`,
    type,
    streamId,
    data: { ...data } as Record<string, unknown> & { readonly id: string },
    metadata: { correlationId: `corr-${eventIdCounter}` },
    revision: 0n,
    position: BigInt(eventIdCounter),
    persistence: 'Permanent',
    created: new Date().toISOString(),
  }
}
