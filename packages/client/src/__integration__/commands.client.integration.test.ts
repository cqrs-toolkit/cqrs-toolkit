/**
 * Integration tests for the command pipeline driven through {@link CqrsClient}.
 *
 * Mirrors the tests in `commands.integration.test.ts` in concept, but exercises
 * the public client surface (`client.submit`, `client.queryManager`,
 * `client.commandQueue.getCommand`, etc.) so we cover what real consumers do.
 * Internals are read only for introspection — dispatch goes through the client.
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
import type { LibraryEvent } from '../types/events.js'
import { isValidationException } from '../types/validation.js'

type ReadmodelUpdatedEvent = LibraryEvent<ServiceLink, 'readmodel:updated'>
type IdReconciledEvent = LibraryEvent<ServiceLink, 'readmodel:id-reconciled'>

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

describe.each(bootstrapVariants)('$name commands (client)', ({ bootstrap }) => {
  const run = createRun(bootstrap)

  describe('anticipated events (optimistic)', () => {
    it(
      'submit returns enqueued when offline and applies the anticipated read model',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor()],
          commandHandlers: [createTodoHandler()],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          // Default connectivity: network online (jsdom reports navigator.onLine = true)
          // but serverReachable = 'unknown', so submit takes the offline branch and
          // returns stage: 'enqueued' without waiting for a server response.
          const cacheKey = await ctx.client.cacheManager.acquireKey(TODO_SCOPE_KEY)

          const result = await ctx.client.submit({
            command: { type: 'CreateTodo', data: { id: 'todo-1', title: 'Buy milk' } },
            cacheKey: TODO_SCOPE_KEY,
          })

          expect(result.ok).toBe(true)
          if (!result.ok) return
          expect(result.value.stage).toBe('enqueued')

          const query = await ctx.client.queryManager.list<{ id: string; title: string }>({
            collection: 'todos',
            cacheKey,
          })
          expect(query.data).toHaveLength(1)
          expect(query.data[0]).toMatchObject({ id: 'todo-1', title: 'Buy milk' })
          expect(query.hasLocalChanges).toBe(true)
        },
      ),
    )

    it(
      'submit without handler enqueues the command but writes no read model',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor()],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          const cacheKey = await ctx.client.cacheManager.acquireKey(TODO_SCOPE_KEY)

          const result = await ctx.client.submit({
            command: { type: 'CreateTodo', data: { id: 'todo-1', title: 'Test' } },
            cacheKey: TODO_SCOPE_KEY,
          })

          expect(result.ok).toBe(true)
          if (!result.ok) return
          expect(result.value.stage).toBe('enqueued')

          // Command is persisted and pending (queue is paused by default in tests).
          const stored = await ctx.client.commandQueue.getCommand(result.value.commandId)
          expect(stored).toBeDefined()
          expect(stored?.status).toBe('pending')

          // No handler ⇒ no anticipated events ⇒ no optimistic read model row.
          const query = await ctx.client.queryManager.list<{ id: string }>({
            collection: 'todos',
            cacheKey,
          })
          expect(query.data).toHaveLength(0)
        },
      ),
    )

    it(
      'multiple submits produce separate read model rows optimistically',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor()],
          commandHandlers: [createTodoHandler()],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          const cacheKey = await ctx.client.cacheManager.acquireKey(TODO_SCOPE_KEY)

          await ctx.client.submit({
            command: { type: 'CreateTodo', data: { id: 'todo-1', title: 'First' } },
            cacheKey: TODO_SCOPE_KEY,
          })
          await ctx.client.submit({
            command: { type: 'CreateTodo', data: { id: 'todo-2', title: 'Second' } },
            cacheKey: TODO_SCOPE_KEY,
          })

          const query = await ctx.client.queryManager.list<{ id: string; title: string }>({
            collection: 'todos',
            cacheKey,
          })
          expect(query.data).toHaveLength(2)
          const titles = query.data.map((d) => d.title).sort()
          expect(titles).toEqual(['First', 'Second'])
        },
      ),
    )

    it(
      'update submit merges into the existing optimistic read model',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor(), todoUpdatedProcessor()],
          commandHandlers: [createTodoHandler(), updateTodoHandler()],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          const cacheKey = await ctx.client.cacheManager.acquireKey(TODO_SCOPE_KEY)

          await ctx.client.submit({
            command: { type: 'CreateTodo', data: { id: 'todo-1', title: 'Original' } },
            cacheKey: TODO_SCOPE_KEY,
          })
          const current = await ctx.client.queryManager.getById<{ title: string }>({
            collection: 'todos',
            id: 'todo-1',
            cacheKey,
          })
          await ctx.client.submit({
            command: { type: 'UpdateTodo', data: { id: 'todo-1', title: 'Updated' } },
            cacheKey: TODO_SCOPE_KEY,
            modelState: current.data,
          })

          const query = await ctx.client.queryManager.getById<{ id: string; title: string }>({
            collection: 'todos',
            id: 'todo-1',
            cacheKey,
          })
          expect(query.data).toBeDefined()
          expect(query.data?.title).toBe('Updated')
        },
      ),
    )
  })

  describe('server-confirmed submit', () => {
    it(
      'submit returns confirmed when online and the read model reflects server data',
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
            const cacheKey = await ctx.client.cacheManager.acquireKey(TODO_SCOPE_KEY)

            // Force connectivity online so submit takes the confirmed-wait branch.
            // The health-check URL is a dummy; we can't round-trip a real probe
            // in a unit test. Using the internal reportContact is test-only setup
            // — dispatch still goes through client.submit below.
            ctx.syncManager.getConnectivity().reportContact()
            await ctx.client.commandQueue.resume()

            // Subscribe BEFORE submit. Read model updates are deliberately
            // untethered from the command lifecycle, so submit resolving on
            // command:completed does not guarantee the sync pipeline has
            // written the server response events to the read model yet.
            // Filtering by serverId uses test-only knowledge; it's valid here
            // because this test scenario uses serverId as the command payload.
            const serverWritten = firstValueFrom(
              ctx.client.events$.pipe(
                filter(
                  (e): e is ReadmodelUpdatedEvent =>
                    e.type === 'readmodel:updated' && e.data.ids.includes(serverId),
                ),
              ),
            )

            const result = await ctx.client.submit({
              command: { type: 'CreateTodo', data: { id: serverId, title: 'Server confirmed' } },
              cacheKey: TODO_SCOPE_KEY,
            })

            expect(result.ok).toBe(true)
            if (!result.ok) return
            expect(result.value.stage).toBe('confirmed')

            await serverWritten

            const query = await ctx.client.queryManager.getById<{ id: string; title: string }>({
              collection: 'todos',
              id: serverId,
              cacheKey,
            })
            expect(query.data?.title).toBe('Server confirmed')
            // After confirmation with response events applied, the read model
            // is no longer local-only — serverData now backs the merged view.
            expect(query.hasLocalChanges).toBe(false)

            // Introspection via internals: command reached terminal success.
            const stored = await ctx.client.commandQueue.getCommand(result.value.commandId)
            expect(stored?.status === 'succeeded' || stored?.status === 'applied').toBe(true)
          },
        )()
      },
    )

    it(
      'submit resolves a temp-id create via the server response events',
      integrationTestOptions,
      () => {
        const serverId = 'srv-todo-resolved'
        const createTempTodoHandler: CommandHandlerRegistration<
          ServiceLink,
          EnqueueCommand,
          unknown,
          IAnticipatedEvent
        > = {
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
            const cacheKey = await ctx.client.cacheManager.acquireKey(TODO_SCOPE_KEY)
            ctx.syncManager.getConnectivity().reportContact()
            await ctx.client.commandQueue.resume()

            // Pre-subscribe for the eventual server read model update. The
            // client itself does not know `serverId`; this serverId filter
            // is test-only knowledge to make the assertion deterministic.
            const serverWritten = firstValueFrom(
              ctx.client.events$.pipe(
                filter(
                  (e): e is ReadmodelUpdatedEvent =>
                    e.type === 'readmodel:updated' && e.data.ids.includes(serverId),
                ),
              ),
            )

            const result = await ctx.client.submit({
              command: { type: 'CreateTempTodo', data: { title: 'Temp to server' } },
              cacheKey: TODO_SCOPE_KEY,
            })

            expect(result.ok).toBe(true)
            if (!result.ok) return
            expect(result.value.stage).toBe('confirmed')

            // The client learned its temp entityId from the submit result —
            // this is the only id the consumer knows pre-reconciliation.
            const entityRef = result.value.entityRef
            expect(entityRef).toBeDefined()
            if (!entityRef) return
            const tempId = entityRef.entityId

            await serverWritten

            // Querying via the temp id auto-reconciles through the command-id
            // mapping: QueryResult.meta.id is the serverId, and meta.clientId
            // preserves the original temp id for consumers that need the link.
            const reconciled = await ctx.client.queryManager.getById<{
              id: string
              title: string
            }>({
              collection: 'todos',
              id: tempId,
              cacheKey,
            })
            expect(reconciled.data?.title).toBe('Temp to server')
            expect(reconciled.meta?.id).toBe(serverId)
            expect(reconciled.meta?.clientId).toBe(tempId)
            expect(reconciled.hasLocalChanges).toBe(false)
          },
        )()
      },
    )

    it(
      'submit temp-id create discovers the serverId via readmodel:id-reconciled',
      integrationTestOptions,
      () => {
        // Same flow as above, but this variant uses only the events the
        // client itself observes (`readmodel:id-reconciled` carries the
        // clientId → serverId mapping), mirroring how client-solid's
        // createItemQuery follows temp-ID → server-ID transitions without
        // ever being told the serverId by the consumer.
        const serverId = 'srv-todo-via-event'
        const createTempTodoHandler: CommandHandlerRegistration<
          ServiceLink,
          EnqueueCommand,
          unknown,
          IAnticipatedEvent
        > = {
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
            const cacheKey = await ctx.client.cacheManager.acquireKey(TODO_SCOPE_KEY)
            ctx.syncManager.getConnectivity().reportContact()
            await ctx.client.commandQueue.resume()

            // Pre-submit: pick up the first id-reconciled event for this
            // collection. No serverId filter — the event itself carries the
            // clientId → serverId mapping the consumer doesn't know yet.
            const idReconciled = firstValueFrom(
              ctx.client.events$.pipe(
                filter(
                  (e): e is IdReconciledEvent =>
                    e.type === 'readmodel:id-reconciled' && e.data.collection === 'todos',
                ),
              ),
            )

            const result = await ctx.client.submit({
              command: { type: 'CreateTempTodo', data: { title: 'Follow the event' } },
              cacheKey: TODO_SCOPE_KEY,
            })
            expect(result.ok).toBe(true)
            if (!result.ok) return
            const tempId = result.value.entityRef?.entityId
            expect(tempId).toBeDefined()
            if (!tempId) return

            const event = await idReconciled
            expect(event.data.clientId).toBe(tempId)
            expect(event.data.serverId).toBe(serverId)

            // Now the consumer can query by the learned serverId — exactly
            // what client-solid's createItemQuery does when it updates its
            // trackingId on an id-reconciled event.
            const query = await ctx.client.queryManager.getById<{ id: string; title: string }>({
              collection: 'todos',
              id: event.data.serverId,
              cacheKey,
            })
            expect(query.data?.title).toBe('Follow the event')
            expect(query.hasLocalChanges).toBe(false)
          },
        )()
      },
    )
  })

  describe('validation', () => {
    it(
      'submit returns validation error without writing anything',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor()],
          commandHandlers: [rejectingHandler()],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          const cacheKey = await ctx.client.cacheManager.acquireKey(TODO_SCOPE_KEY)

          const result = await ctx.client.submit({
            command: { type: 'InvalidCommand', data: { title: '' } },
            cacheKey: TODO_SCOPE_KEY,
          })

          expect(result.ok).toBe(false)
          if (result.ok) return
          expect(isValidationException(result.error)).toBe(true)
          if (!isValidationException(result.error)) return
          expect(result.error.details?.[0]).toMatchObject({ path: 'title' })

          // No optimistic read model row created.
          const query = await ctx.client.queryManager.list<{ id: string }>({
            collection: 'todos',
            cacheKey,
          })
          expect(query.data).toHaveLength(0)

          // Introspection: the command was never persisted — validation runs
          // before the queue saves the record.
          const all = await ctx.storage.getCommands()
          expect(all).toHaveLength(0)
        },
      ),
    )
  })

  describe('cache key lifecycle', () => {
    it(
      'acquire → seed data → query → evict → empty — driven through the client',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor()],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          const cacheKey = await ctx.client.cacheManager.acquireKey(TODO_SCOPE_KEY)

          // Seed a row directly into storage under this cacheKey — using the
          // internal readModelStore because seeding a row is a test-scaffold
          // concern, not something real consumers do through the client.
          await ctx.readModelStore.setServerData(
            'todos',
            'todo-1',
            { id: 'todo-1', title: 'Seeded' },
            cacheKey.key,
          )

          const query = await ctx.client.queryManager.getById<{ id: string; title: string }>({
            collection: 'todos',
            id: 'todo-1',
            cacheKey,
          })
          expect(query.data?.title).toBe('Seeded')

          await ctx.client.cacheManager.evict(cacheKey.key)

          const afterEvict = await ctx.client.queryManager.getById<{ title: string }>({
            collection: 'todos',
            id: 'todo-1',
            cacheKey,
          })
          expect(afterEvict.data).toBeUndefined()
        },
      ),
    )
  })
})
