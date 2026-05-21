/**
 * Integration tests for the command pipeline.
 *
 * Tests command enqueue, anticipated events, command responses from the server,
 * temp ID resolution, validation, cache key lifecycle, and session lifecycle.
 * Exercises the real WriteQueue pipeline with only the network layer mocked.
 */

import { Err, Ok, type ISerializedEvent, type ServiceLink } from '@meticoeus/ddd-es'
import { filter, firstValueFrom } from 'rxjs'
import { v4 as uuidv4 } from 'uuid'
import { describe, expect, it } from 'vitest'
import type { IAnticipatedEvent } from '../core/command-lifecycle/AnticipatedEventShape.js'
import type { ICommandSender } from '../core/command-queue/types.js'
import { CommandSendException } from '../core/command-queue/types.js'
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
  type TodoRow,
} from '../testing/index.js'
import type { EnqueueCommand } from '../types/commands.js'
import type { CommandHandlerRegistration } from '../types/domain.js'
import { createEntityId, domainSuccess } from '../types/domain.js'
import { entityIdToString, type EntityId } from '../types/entities.js'

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
              nextExpectedRevision: '0',
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
                .pipe(
                  filter(
                    (e) =>
                      e.data.created?.includes(serverId) === true ||
                      e.data.updated?.includes(serverId) === true ||
                      e.data.deleted?.includes(serverId) === true,
                  ),
                ),
            )

            const result = await ctx.commandQueue.enqueue({
              command: { type: 'CreateTodo', data: { id: serverId, title: 'Server confirmed' } },
              cacheKey: TODO_SCOPE_KEY,
            })
            expect(result.ok).toBe(true)
            if (!result.ok) return

            await ctx.commandQueue.waitForSucceeded(result.value.commandId)
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
            return domainSuccess([
              {
                type: 'TodoCreated',
                data: { id, title },
                streamId: `nb.Todo-${entityIdToString(id)}`,
              } as IAnticipatedEvent,
            ])
          },
        }

        const commandSender: ICommandSender<ServiceLink, EnqueueCommand> = {
          send: (async (command: { commandId: string; data: unknown }) => {
            await new Promise((resolve) => setTimeout(resolve, 10))
            return Ok({
              id: serverId,
              nextExpectedRevision: '0',
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
            // waitForSucceeded resolves after the reconcile op fully settles —
            // the response events have applied to the read model by then.
            await ctx.commandQueue.resume()
            await ctx.commandQueue.waitForSucceeded(commandId)

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
  // Envelope headers
  // -------------------------------------------------------------------------

  describe('envelope headers', () => {
    it(
      'plain headers persist on the command record and reach the sender',
      integrationTestOptions,
      () => {
        const seenHeaders: Array<Record<string, string> | undefined> = []
        const commandSender: ICommandSender<ServiceLink, EnqueueCommand> = {
          send: (async (command: { headers?: Record<string, string> }) => {
            seenHeaders.push(command.headers)
            return Ok({})
          }) as ICommandSender<ServiceLink, EnqueueCommand>['send'],
        }

        return run(
          {
            collections: [createTodosCollection()],
            processors: [todoCreatedProcessor()],
            commandHandlers: [createTodoHandler()],
            commandSender,
            SyncManagerClass: TestSyncManager,
          },
          async (ctx) => {
            await ctx.cacheManager.acquire(TODO_SCOPE_KEY)

            const result = await ctx.commandQueue.enqueue({
              command: {
                type: 'CreateTodo',
                data: { id: 'todo-1', title: 'with headers' },
                headers: { 'x-tenant-id': 'tenant-1', 'x-trace': 'abc' },
              },
              cacheKey: TODO_SCOPE_KEY,
            })
            expect(result.ok).toBe(true)
            if (!result.ok) return

            const stored = await ctx.storage.getCommand(result.value.commandId)
            expect(stored?.headers).toEqual({ 'x-tenant-id': 'tenant-1', 'x-trace': 'abc' })

            await ctx.commandQueue.resume()
            await ctx.commandQueue.waitForSucceeded(result.value.commandId)

            expect(seenHeaders).toHaveLength(1)
            expect(seenHeaders[0]).toEqual({ 'x-tenant-id': 'tenant-1', 'x-trace': 'abc' })
          },
        )()
      },
    )

    it(
      'EntityRef header is preserved on the record + handler view and rewritten by the cascade when the parent lands',
      integrationTestOptions,
      () => {
        const tenantServerId = 'srv-tenant-1'
        const handlerHeaderObservations: Array<Record<string, EntityId> | undefined> = []

        // Tenant creation surfaces an EntityRef the consumer can route into a
        // follower's headers. The handler is a CreateTempTodo-style create
        // with `idStrategy: 'temporary'` so the consumer receives an
        // EntityRef on the enqueue result.
        const createTenantHandler: CommandHandlerRegistration<ServiceLink> = {
          commandType: 'CreateTenant',
          aggregate: TodoAggregate,
          commandIdReferences: [],
          creates: { eventType: 'TodoCreated', idStrategy: 'temporary' },
          handler(_command, _state, context) {
            const id = createEntityId(context)
            return domainSuccess([
              {
                type: 'TodoCreated',
                data: { id, title: 'Tenant' },
                streamId: `nb.Todo-${entityIdToString(id)}`,
              } as IAnticipatedEvent,
            ])
          },
        }

        // Follower declares the tenant id lives in the header — required so
        // the queue can auto-wire `dependsOn` on the producing command and
        // rewrite the temp id once the parent lands. Without this
        // declaration the send-time assert in `assertWireHeaders` would
        // surface the wiring bug.
        const createTodoUnderTenantHandler: CommandHandlerRegistration<ServiceLink> = {
          commandType: 'CreateTodoUnderTenant',
          aggregate: TodoAggregate,
          commandIdReferences: [{ aggregate: TodoAggregate, path: "$.headers['x-tenant-id']" }],
          handler(command, _state, _context) {
            handlerHeaderObservations.push(command.headers)
            const { id, title } = command.data as TodoRow
            return domainSuccess([
              { type: 'TodoCreated', data: { id, title }, streamId: `nb.Todo-${id}` },
            ])
          },
        }

        const commandSender: ICommandSender<ServiceLink, EnqueueCommand> = {
          send: (async (command: { commandId: string; type: string; data: unknown }) => {
            await new Promise((resolve) => setTimeout(resolve, 5))
            if (command.type === 'CreateTenant') {
              return Ok({
                id: tenantServerId,
                nextExpectedRevision: '0',
                events: [
                  createSerializedEvent(
                    'TodoCreated',
                    `nb.Todo-${tenantServerId}`,
                    { id: tenantServerId, title: 'Tenant' },
                    { commandId: command.commandId },
                  ),
                ],
              })
            }
            return Ok({})
          }) as ICommandSender<ServiceLink, EnqueueCommand>['send'],
        }

        return run(
          {
            collections: [createTodosCollection()],
            processors: [todoCreatedProcessor()],
            commandHandlers: [createTenantHandler, createTodoUnderTenantHandler],
            commandSender,
            SyncManagerClass: TestSyncManager,
          },
          async (ctx) => {
            await ctx.cacheManager.acquire(TODO_SCOPE_KEY)

            const parent = await ctx.commandQueue.enqueue({
              command: { type: 'CreateTenant', data: {} },
              cacheKey: TODO_SCOPE_KEY,
            })
            expect(parent.ok).toBe(true)
            if (!parent.ok) return
            const tenantRef = parent.value.entityRef
            expect(tenantRef).toBeDefined()
            if (!tenantRef) return

            const follower = await ctx.commandQueue.enqueue({
              command: {
                type: 'CreateTodoUnderTenant',
                data: { id: 'todo-1', title: 'inside tenant' },
                headers: { 'x-tenant-id': tenantRef },
              },
              cacheKey: TODO_SCOPE_KEY,
            })
            expect(follower.ok).toBe(true)
            if (!follower.ok) return

            // The handler saw the EntityRef on the headers — not the bare
            // entityId — so it can reason about lifecycle (e.g. emit
            // anticipated events that carry the same EntityRef).
            expect(handlerHeaderObservations).toHaveLength(1)
            expect(handlerHeaderObservations[0]).toEqual({ 'x-tenant-id': tenantRef })

            // Follower is blocked on the parent. The persisted record holds
            // the EntityRef intact (no strip) and tracks the position in
            // `commandIdPaths` so the cascade can rewrite once the parent's
            // mapping lands.
            const blockedStored = await ctx.storage.getCommand(follower.value.commandId)
            expect(blockedStored?.headers).toEqual({ 'x-tenant-id': tenantRef })
            expect(blockedStored?.commandIdPaths).toEqual({
              "$.headers['x-tenant-id']": tenantRef,
            })
            expect(blockedStored?.blockedBy).toContain(parent.value.commandId)
            expect(blockedStored?.dependsOn).toContainEqual({
              commandId: parent.value.commandId,
              source: 'entity-ref',
            })

            await ctx.commandQueue.resume()
            await ctx.commandQueue.waitForSucceeded(parent.value.commandId)

            // After parent succeeds, the cascade has walked the follower's
            // declared header path and rewritten the EntityRef to the
            // server-id string — both on the stored record and in the
            // pruned commandIdPaths.
            const settledStored = await ctx.storage.getCommand(follower.value.commandId)
            expect(settledStored?.headers).toEqual({ 'x-tenant-id': tenantServerId })
            expect(settledStored?.commandIdPaths).toBeUndefined()
          },
        )()
      },
    )

    it(
      'EntityRef header resolved from the mapping cache hands the server id to the sender',
      integrationTestOptions,
      () => {
        const tenantServerId = 'srv-tenant-2'
        const seenHeadersByType = new Map<string, Record<string, string> | undefined>()

        const createTenantHandler: CommandHandlerRegistration<ServiceLink> = {
          commandType: 'CreateTenant',
          aggregate: TodoAggregate,
          commandIdReferences: [],
          creates: { eventType: 'TodoCreated', idStrategy: 'temporary' },
          handler(_command, _state, context) {
            const id = createEntityId(context)
            return domainSuccess([
              {
                type: 'TodoCreated',
                data: { id, title: 'Tenant' },
                streamId: `nb.Todo-${entityIdToString(id)}`,
              } as IAnticipatedEvent,
            ])
          },
        }

        const createTodoUnderTenantHandler: CommandHandlerRegistration<ServiceLink> = {
          commandType: 'CreateTodoUnderTenant',
          aggregate: TodoAggregate,
          commandIdReferences: [{ aggregate: TodoAggregate, path: "$.headers['x-tenant-id']" }],
          handler(command, _state, _context) {
            const { id, title } = command.data as TodoRow
            return domainSuccess([
              { type: 'TodoCreated', data: { id, title }, streamId: `nb.Todo-${id}` },
            ])
          },
        }

        const commandSender: ICommandSender<ServiceLink, EnqueueCommand> = {
          send: (async (command: {
            commandId: string
            type: string
            data: unknown
            headers?: Record<string, string>
          }) => {
            seenHeadersByType.set(command.type, command.headers)
            await new Promise((resolve) => setTimeout(resolve, 5))
            if (command.type === 'CreateTenant') {
              return Ok({
                id: tenantServerId,
                nextExpectedRevision: '0',
                events: [
                  createSerializedEvent(
                    'TodoCreated',
                    `nb.Todo-${tenantServerId}`,
                    { id: tenantServerId, title: 'Tenant' },
                    { commandId: command.commandId },
                  ),
                ],
              })
            }
            return Ok({})
          }) as ICommandSender<ServiceLink, EnqueueCommand>['send'],
        }

        return run(
          {
            collections: [createTodosCollection()],
            processors: [todoCreatedProcessor()],
            commandHandlers: [createTenantHandler, createTodoUnderTenantHandler],
            commandSender,
            SyncManagerClass: TestSyncManager,
          },
          async (ctx) => {
            await ctx.cacheManager.acquire(TODO_SCOPE_KEY)

            const parent = await ctx.commandQueue.enqueue({
              command: { type: 'CreateTenant', data: {} },
              cacheKey: TODO_SCOPE_KEY,
            })
            expect(parent.ok).toBe(true)
            if (!parent.ok) return
            const tenantRef = parent.value.entityRef
            expect(tenantRef).toBeDefined()
            if (!tenantRef) return

            await ctx.commandQueue.resume()
            await ctx.commandQueue.waitForSucceeded(parent.value.commandId)

            // Mapping cache now holds tenantRef.entityId → tenantServerId.
            // Submitting the follower in this state lets `resolveCommandIds`
            // patch the header at enqueue time — the record is created with
            // the server id already.
            const follower = await ctx.commandQueue.enqueue({
              command: {
                type: 'CreateTodoUnderTenant',
                data: { id: 'todo-2', title: 'after tenant' },
                headers: { 'x-tenant-id': tenantRef },
              },
              cacheKey: TODO_SCOPE_KEY,
            })
            expect(follower.ok).toBe(true)
            if (!follower.ok) return

            const storedAtSubmit = await ctx.storage.getCommand(follower.value.commandId)
            expect(storedAtSubmit?.headers).toEqual({ 'x-tenant-id': tenantServerId })
            expect(storedAtSubmit?.commandIdPaths).toBeUndefined()

            await ctx.commandQueue.waitForSucceeded(follower.value.commandId)

            // Sender receives the resolved server id — the library never
            // hands an EntityRef or a temp id to the transport layer.
            expect(seenHeadersByType.get('CreateTodoUnderTenant')).toEqual({
              'x-tenant-id': tenantServerId,
            })
          },
        )()
      },
    )

    it('EntityRef at an undeclared header path throws at submit', integrationTestOptions, () => {
      // CreateTenant declares no header paths. Routing an EntityRef into
      // a header position without a matching `commandIdReferences` entry
      // is a wiring bug — there would be nothing wiring up `dependsOn`
      // or driving a cascade rewrite, and the EntityRef would silently
      // leak to the sender as a non-string. The submit gate surfaces it.
      const createTenantHandler: CommandHandlerRegistration<ServiceLink> = {
        commandType: 'CreateTenant',
        aggregate: TodoAggregate,
        commandIdReferences: [],
        creates: { eventType: 'TodoCreated', idStrategy: 'temporary' },
        handler(_command, _state, context) {
          const id = createEntityId(context)
          return domainSuccess([
            {
              type: 'TodoCreated',
              data: { id, title: 'Tenant' },
              streamId: `nb.Todo-${entityIdToString(id)}`,
            } as IAnticipatedEvent,
          ])
        },
      }

      // No `commandIdReferences` declaration for the header path.
      const followerWithUndeclaredRef: CommandHandlerRegistration<ServiceLink> = {
        commandType: 'CreateTodoUnderTenant',
        aggregate: TodoAggregate,
        commandIdReferences: [],
        handler(command, _state, _context) {
          const { id, title } = command.data as TodoRow
          return domainSuccess([
            { type: 'TodoCreated', data: { id, title }, streamId: `nb.Todo-${id}` },
          ])
        },
      }

      return run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor()],
          commandHandlers: [createTenantHandler, followerWithUndeclaredRef],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          await ctx.cacheManager.acquire(TODO_SCOPE_KEY)

          const parent = await ctx.commandQueue.enqueue({
            command: { type: 'CreateTenant', data: {} },
            cacheKey: TODO_SCOPE_KEY,
          })
          expect(parent.ok).toBe(true)
          if (!parent.ok) return
          const tenantRef = parent.value.entityRef
          if (!tenantRef) return

          await expect(
            ctx.commandQueue.enqueue({
              command: {
                type: 'CreateTodoUnderTenant',
                data: { id: 'todo-undeclared', title: 'no header decl' },
                headers: { 'x-tenant-id': tenantRef },
              },
              cacheKey: TODO_SCOPE_KEY,
            }),
          ).rejects.toThrow(/\$\.headers\['x-tenant-id'\] is not declared/)
        },
      )()
    })
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

  // -------------------------------------------------------------------------
  // Soft cascade on chain-only dependency edge (Part 2)
  // -------------------------------------------------------------------------

  describe('soft cascade on aggregate-chain edge', () => {
    it(
      'failed first updateTodo does NOT cascade-cancel a chain-only second updateTodo',
      integrationTestOptions,
      () => {
        // Sender fails the FIRST UpdateTodo, succeeds anything else. With no
        // `classifyDependency` registered on UpdateTodo, the second update's
        // aggregate-chain edge to the first defaults to soft — so the second
        // command must NOT cascade-cancel; it should land on its own
        // independent attempt (which the sender lets succeed).
        const failingIds = new Set<string>()
        const commandSender: ICommandSender<ServiceLink, EnqueueCommand> = {
          send: (async (command: { commandId: string; type: string; data: unknown }) => {
            if (failingIds.has(command.commandId)) {
              return Err(
                new CommandSendException({
                  message: 'simulated server rejection',
                  isRetryable: false,
                  response: { status: 400, headers: new Headers(), body: undefined },
                }),
              )
            }
            await new Promise((r) => setTimeout(r, 5))
            return Ok({ id: 'todo-1', nextExpectedRevision: '0', events: [] })
          }) as ICommandSender<ServiceLink, EnqueueCommand>['send'],
        }

        return run(
          {
            collections: [createTodosCollection()],
            processors: [todoCreatedProcessor(), todoUpdatedProcessor()],
            commandHandlers: [createTodoHandler(), updateTodoHandler()],
            commandSender,
            SyncManagerClass: TestSyncManager,
          },
          async (ctx) => {
            const baselineState = { id: 'todo-1', title: 'Existing' }

            const first = await ctx.commandQueue.enqueue({
              command: { type: 'UpdateTodo', data: { id: 'todo-1', title: 'First update' } },
              cacheKey: TODO_SCOPE_KEY,
              modelState: baselineState,
            })
            expect(first.ok).toBe(true)
            if (!first.ok) return
            failingIds.add(first.value.commandId)

            const second = await ctx.commandQueue.enqueue({
              command: { type: 'UpdateTodo', data: { id: 'todo-1', title: 'Second update' } },
              cacheKey: TODO_SCOPE_KEY,
              modelState: baselineState,
            })
            expect(second.ok).toBe(true)
            if (!second.ok) return

            // The second update was wired behind the first via aggregate-chain
            // ordering at submit time.
            const initialSecond = await ctx.storage.getCommand(second.value.commandId)
            expect(initialSecond?.dependsOn).toContainEqual({
              commandId: first.value.commandId,
              source: 'aggregate-chain',
            })
            expect(initialSecond?.status).toBe('blocked')

            await ctx.commandQueue.resume()

            // First reaches a non-success terminal. Second must not be the
            // dependency-cascade target — it gets soft-unblocked and ultimately
            // succeeds on its own.
            await ctx.commandQueue.waitForSucceeded(second.value.commandId)

            const firstStored = await ctx.storage.getCommand(first.value.commandId)
            const secondStored = await ctx.storage.getCommand(second.value.commandId)
            expect(firstStored?.status).toBe('failed')
            // Reached terminal success — either `'succeeded'` or `'applied'`
            // depending on whether the pipeline's applied-at-success detection
            // races ahead. Both are post-terminal-success; the key assertion
            // is that the second is NOT `'cancelled'`.
            expect(['succeeded', 'applied']).toContain(secondStored?.status)
            // Soft cascade clears the parent's id from blockedBy; the second
            // proceeded under that unblock.
            expect(secondStored?.blockedBy).not.toContain(first.value.commandId)
          },
        )()
      },
    )
  })
})
