/**
 * Integration tests for the command pipeline.
 *
 * Tests command enqueue, anticipated events, command responses from the server,
 * temp ID resolution, validation, cache key lifecycle, and session lifecycle.
 * Exercises the real WriteQueue pipeline with only the network layer mocked.
 */

import { Ok, type ISerializedEvent, type ServiceLink } from '@meticoeus/ddd-es'
import { filter, firstValueFrom } from 'rxjs'
import { v4 as uuidv4 } from 'uuid'
import { describe, expect, it } from 'vitest'
import type { IAnticipatedEvent } from '../core/command-lifecycle/AnticipatedEventShape.js'
import type { ICommandSender } from '../core/command-queue/types.js'
import {
  TODO_SCOPE_KEY,
  TestSyncManager,
  TodoAggregate,
  bootstrapVariants,
  createRun,
  createTodoHandler,
  createTodosCollection,
  integrationTestOptions,
  rejectingHandler,
  todoCreatedProcessor,
  todoUpdatedProcessor,
  updateTodoHandler,
} from '../testing/index.js'
import type { EnqueueCommand } from '../types/commands.js'
import type { CommandHandlerRegistration } from '../types/domain.js'
import { createEntityId } from '../types/domain.js'
import { entityIdToString } from '../types/entities.js'

function createSerializedEvent(
  type: string,
  streamId: string,
  data: Record<string, unknown>,
  meta: { commandId?: string; revision?: string; position?: string } = {},
): ISerializedEvent {
  return {
    id: `evt-${uuidv4()}`,
    type,
    streamId,
    data: data as ISerializedEvent['data'],
    metadata: {
      correlationId: `corr-${uuidv4()}`,
      ...(meta.commandId ? { commandId: meta.commandId } : {}),
    } as ISerializedEvent['metadata'],
    revision: meta.revision ?? '0',
    position: meta.position ?? '1',
    created: new Date().toISOString(),
  }
}

describe.each(bootstrapVariants)('$name commands', ({ bootstrap }) => {
  const run = createRun(bootstrap)

  // -------------------------------------------------------------------------
  // Anticipated events (optimistic updates)
  // -------------------------------------------------------------------------

  describe('anticipated events', () => {
    it(
      'enqueue with handler produces read model optimistically',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor()],
          commandHandlers: [createTodoHandler()],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          const result = await ctx.commandQueue.enqueue({
            command: { type: 'CreateTodo', data: { id: 'todo-1', title: 'Buy milk' } },
            cacheKey: TODO_SCOPE_KEY,
          })

          expect(result.ok).toBe(true)

          const models = await ctx.readModelStore.list('todos')
          expect(models).toHaveLength(1)
          expect(models[0]?.data).toMatchObject({ id: 'todo-1', title: 'Buy milk' })
          expect(models[0]?.hasLocalChanges).toBe(true)
        },
      ),
    )

    it(
      'enqueue without handler stores command but no read model',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor()],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
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
        },
      ),
    )

    it(
      'multiple commands produce separate read models',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor()],
          commandHandlers: [createTodoHandler()],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
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
        },
      ),
    )

    it(
      'update command merges into existing read model',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor(), todoUpdatedProcessor()],
          commandHandlers: [createTodoHandler(), updateTodoHandler()],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          await ctx.commandQueue.enqueue({
            command: { type: 'CreateTodo', data: { id: 'todo-1', title: 'Original' } },
            cacheKey: TODO_SCOPE_KEY,
          })
          const current = await ctx.readModelStore.getById<{ title: string }>('todos', 'todo-1')
          await ctx.commandQueue.enqueue({
            command: { type: 'UpdateTodo', data: { id: 'todo-1', title: 'Updated' } },
            cacheKey: TODO_SCOPE_KEY,
            modelState: current?.data,
          })

          const model = await ctx.readModelStore.getById<{ id: string; title: string }>(
            'todos',
            'todo-1',
          )
          expect(model).toBeDefined()
          expect(model?.data.title).toBe('Updated')
        },
      ),
    )
  })

  // -------------------------------------------------------------------------
  // Command response events (server confirms command)
  // -------------------------------------------------------------------------

  describe('command response events', () => {
    it(
      'response events flow through the drain and update the read model',
      integrationTestOptions,
      () => {
        const serverId = 'srv-todo-1'

        const commandSender: ICommandSender<ServiceLink, EnqueueCommand> = {
          send: (async (command: { commandId: string }) => {
            await new Promise((resolve) => setTimeout(resolve, 10))
            return Ok({
              id: serverId,
              nextExpectedRevision: '1',
              events: [
                createSerializedEvent(
                  'TodoCreated',
                  `nb.Todo-${serverId}`,
                  { id: serverId, title: 'Server confirmed' },
                  { commandId: command.commandId },
                ),
              ],
            })
          }) as ICommandSender<ServiceLink, EnqueueCommand>['send'],
        }

        return run(
          {
            collections: [createTodosCollection()],
            processors: [todoCreatedProcessor()],
            commandSender,
            SyncManagerClass: TestSyncManager,
          },
          async (ctx) => {
            await ctx.cacheManager.acquire(TODO_SCOPE_KEY)
            await ctx.commandQueue.resume()

            const updated = firstValueFrom(
              ctx.eventBus
                .on('readmodel:updated')
                .pipe(filter((e) => e.data.ids.includes(serverId))),
            )

            const result = await ctx.commandQueue.enqueue({
              command: { type: 'CreateTodo', data: { id: serverId, title: 'Server confirmed' } },
              cacheKey: TODO_SCOPE_KEY,
            })
            expect(result.ok).toBe(true)
            if (!result.ok) return

            await ctx.commandQueue.waitForCompletion(result.value.commandId)
            await updated

            const model = await ctx.readModelStore.getById<{ id: string; title: string }>(
              'todos',
              serverId,
            )
            expect(model).toBeDefined()
            expect(model?.data.title).toBe('Server confirmed')
            expect(model?.serverData?.title).toBe('Server confirmed')
            expect(model?.hasLocalChanges).toBe(false)
          },
        )()
      },
    )

    it(
      'response events resolve temp-id creates via metadata.commandId',
      integrationTestOptions,
      () => {
        const serverId = 'srv-todo-resolved'

        const createTempTodoHandler: CommandHandlerRegistration<ServiceLink> = {
          commandType: 'CreateTempTodo',
          aggregate: TodoAggregate,
          commandIdReferences: [],
          creates: { eventType: 'TodoCreated', idStrategy: 'temporary' },
          handler(command, _state, context) {
            const id = createEntityId(context)
            const { title } = command.data as { title: string }
            return Ok({
              anticipatedEvents: [
                {
                  type: 'TodoCreated',
                  data: { id, title },
                  streamId: `nb.Todo-${entityIdToString(id)}`,
                } as IAnticipatedEvent,
              ],
            })
          },
        }

        const commandSender: ICommandSender<ServiceLink, EnqueueCommand> = {
          send: (async (command: { commandId: string; data: unknown }) => {
            await new Promise((resolve) => setTimeout(resolve, 10))
            return Ok({
              id: serverId,
              nextExpectedRevision: '1',
              events: [
                createSerializedEvent(
                  'TodoCreated',
                  `nb.Todo-${serverId}`,
                  { id: serverId, title: (command.data as { title: string }).title },
                  { commandId: command.commandId },
                ),
              ],
            })
          }) as ICommandSender<ServiceLink, EnqueueCommand>['send'],
        }

        return run(
          {
            collections: [createTodosCollection()],
            processors: [todoCreatedProcessor()],
            commandHandlers: [createTempTodoHandler],
            commandSender,
            SyncManagerClass: TestSyncManager,
          },
          async (ctx) => {
            await ctx.cacheManager.acquire(TODO_SCOPE_KEY)

            const anticipatedWritten = firstValueFrom(
              ctx.eventBus
                .on('readmodel:updated')
                .pipe(filter((e) => e.data.collection === 'todos')),
            )

            const result = await ctx.commandQueue.enqueue({
              command: { type: 'CreateTempTodo', data: { title: 'Temp to server' } },
              cacheKey: TODO_SCOPE_KEY,
            })
            expect(result.ok).toBe(true)
            if (!result.ok) return
            const commandId = result.value.commandId

            await anticipatedWritten

            const modelsBefore = await ctx.readModelStore.list<{ id: unknown }>('todos')
            expect(modelsBefore).toHaveLength(1)
            const tempId = modelsBefore[0]!.id

            // Resume to send the command and receive the response.
            // waitForCompletion resolves after the reconcile op fully settles —
            // the response events have applied to the read model by then.
            await ctx.commandQueue.resume()
            await ctx.commandQueue.waitForCompletion(commandId)

            // Raw storage: tempId entry deleted, serverId entry created
            const rawTemp = await ctx.storage.getReadModel('todos', tempId)
            expect(rawTemp).toBeUndefined()

            const rawServer = await ctx.storage.getReadModel('todos', serverId)
            expect(rawServer).toBeDefined()

            // CommandIdMappingRecord persisted
            const mapping = ctx.mappingStore.get(tempId)
            expect(mapping).toBeDefined()
            expect(mapping?.serverId).toBe(serverId)

            // Read model via getById with tempId auto-reconciles
            const reconciled = await ctx.readModelStore.getById<{ id: string; title: string }>(
              'todos',
              tempId,
            )
            expect(reconciled).toBeDefined()
            expect(reconciled?.id).toBe(serverId)
            expect(reconciled?.data.title).toBe('Temp to server')
            expect(reconciled?.hasLocalChanges).toBe(false)

            // _clientMetadata preserved across the tempId→serverId transition
            const serverModel = await ctx.readModelStore.getById('todos', serverId)
            expect(serverModel?._clientMetadata?.clientId).toBe(tempId)
          },
        )()
      },
    )
  })

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  describe('validation', () => {
    it(
      'validation failure returns error without side effects',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor()],
          commandHandlers: [rejectingHandler()],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          const result = await ctx.commandQueue.enqueue({
            command: { type: 'InvalidCommand', data: { title: '' } },
            cacheKey: TODO_SCOPE_KEY,
          })

          expect(result.ok).toBe(false)
          if (result.ok) return

          expect(result.error.details).toEqual(
            expect.arrayContaining([expect.objectContaining({ path: 'title' })]),
          )

          const models = await ctx.readModelStore.list('todos')
          expect(models).toHaveLength(0)

          const allCommands = await ctx.storage.getCommands()
          expect(allCommands).toHaveLength(0)
        },
      ),
    )
  })

  // -------------------------------------------------------------------------
  // Cache key lifecycle
  // -------------------------------------------------------------------------

  describe('cache key lifecycle', () => {
    it(
      'acquire -> seed data -> query -> evict -> empty',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor()],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          const cacheKey = await ctx.cacheManager.acquire(TODO_SCOPE_KEY)
          await ctx.readModelStore.setServerData(
            'todos',
            'todo-1',
            { id: 'todo-1', title: 'Seeded' },
            cacheKey,
          )

          const model = await ctx.readModelStore.getById<{ title: string }>('todos', 'todo-1')
          expect(model).toBeDefined()
          expect(model?.data.title).toBe('Seeded')

          await ctx.cacheManager.evict(cacheKey)

          const afterEvict = await ctx.readModelStore.getById('todos', 'todo-1')
          expect(afterEvict).toBeUndefined()
        },
      ),
    )
  })

  // -------------------------------------------------------------------------
  // Session lifecycle
  // -------------------------------------------------------------------------

  describe('session lifecycle', () => {
    it(
      'session destroyed clears all state',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor()],
          commandHandlers: [createTodoHandler()],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          await ctx.cacheManager.acquire(TODO_SCOPE_KEY)
          await ctx.commandQueue.enqueue({
            command: { type: 'CreateTodo', data: { id: 'todo-1', title: 'Test' } },
            cacheKey: TODO_SCOPE_KEY,
          })

          expect(await ctx.readModelStore.list('todos')).toHaveLength(1)
          expect(await ctx.cacheManager.getCount()).toBeGreaterThan(0)

          await ctx.syncManager.start()

          ctx.eventBus.emit('session:destroyed', { reason: 'explicit' })

          // Wait for async handler to process
          await new Promise((resolve) => setTimeout(resolve, 100))

          expect(await ctx.readModelStore.list('todos')).toHaveLength(0)
          expect(await ctx.cacheManager.getCount()).toBe(0)
        },
      ),
    )
  })
})
