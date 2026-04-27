/**
 * Integration tests for command reconciliation driven through {@link CqrsClient}.
 *
 * Mirrors the tests in `reconciliation.integration.test.ts` in concept but
 * exercises the public client surface (`client.submit`, `client.queryManager`,
 * `client.events$`) for dispatch and observation. Internals (`ctx.syncManager`,
 * `ctx.storage`, `ctx.readModelStore`) are used only for WS event injection
 * and introspection — scaffolding that real consumers never have to do.
 */

import {
  Ok,
  type IPersistedEvent,
  type ISerializedEvent,
  type ServiceLink,
} from '@meticoeus/ddd-es'
import { filter, firstValueFrom } from 'rxjs'
import { v4 as uuidv4 } from 'uuid'
import { describe, expect, it } from 'vitest'
import type { IAnticipatedEvent } from '../core/command-lifecycle/AnticipatedEventShape.js'
import type { ICommandSender } from '../core/command-queue/types.js'
import type { ProcessorRegistration } from '../core/event-processor/types.js'
import {
  NoteAggregate,
  TODO_SCOPE_KEY,
  TestSyncManager,
  TodoAggregate,
  bootstrapVariants,
  createRun,
  createTodoHandler,
  createTodosCollection,
  integrationTestOptions,
  todoCreatedProcessor,
  todoUpdatedProcessor,
} from '../testing/index.js'
import type { EnqueueCommand } from '../types/commands.js'
import type { Collection } from '../types/config.js'
import type { CommandHandlerRegistration } from '../types/domain.js'
import { createEntityId } from '../types/domain.js'
import { entityIdToString } from '../types/entities.js'
import type { LibraryEvent } from '../types/events.js'

type ReadmodelUpdatedEvent = LibraryEvent<ServiceLink, 'readmodel:updated'>
type IdReconciledEvent = LibraryEvent<ServiceLink, 'readmodel:id-reconciled'>

function createSerializedEvent(
  type: string,
  streamId: string,
  data: Record<string, unknown>,
  meta: { commandId?: string } = {},
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
    revision: '0',
    position: '1',
    created: new Date().toISOString(),
  }
}

describe.each(bootstrapVariants)('$name reconciliation (client)', ({ bootstrap }) => {
  const run = createRun(bootstrap)

  describe('dirty command re-run', () => {
    it(
      'pending command re-executes against post-server-event state',
      integrationTestOptions,
      run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor(), todoUpdatedProcessor()],
          commandHandlers: [
            createTodoHandler(),
            {
              commandType: 'AppendTodo',
              aggregate: TodoAggregate,
              commandIdReferences: [{ aggregate: TodoAggregate, path: '$.data.id' }],
              handler(command, state, _context) {
                const { id, suffix } = command.data as { id: string; suffix: string }
                const currentTitle = (state as { title?: string } | undefined)?.title ?? ''
                return Ok({
                  anticipatedEvents: [
                    {
                      type: 'TodoUpdated',
                      data: { id, title: `${currentTitle}${suffix}` },
                      streamId: `nb.Todo-${id}`,
                    } as IAnticipatedEvent,
                  ],
                })
              },
            } satisfies CommandHandlerRegistration<ServiceLink>,
          ],
          SyncManagerClass: TestSyncManager,
        },
        async (ctx) => {
          const cacheKey = await ctx.client.cacheManager.acquireKey(TODO_SCOPE_KEY)

          // 1) Create a todo via the client — offline (default) so submit
          //    returns 'enqueued' and the anticipated read model is what the
          //    next command reads below.
          await ctx.client.submit({
            command: { type: 'CreateTodo', data: { id: 'todo-1', title: 'Initial' } },
            cacheKey: TODO_SCOPE_KEY,
          })

          // 2) Submit a state-dependent AppendTodo. It reads 'Initial' from
          //    the client-visible read model and produces 'Initial v2'.
          const initialState = await ctx.client.queryManager.getById<{ title: string }>({
            collection: 'todos',
            id: 'todo-1',
            cacheKey,
          })
          await ctx.client.submit({
            command: { type: 'AppendTodo', data: { id: 'todo-1', suffix: ' v2' } },
            cacheKey: TODO_SCOPE_KEY,
            modelState: initialState.data,
          })

          const beforeReconcile = await ctx.client.queryManager.getById<{ title: string }>({
            collection: 'todos',
            id: 'todo-1',
            cacheKey,
          })
          expect(beforeReconcile.data?.title).toBe('Initial v2')

          // 3) Server event arrives via WS with a different title. WS
          //    injection is test scaffolding (consumers receive these through
          //    the real WebSocket connection) — we use the internal
          //    TestSyncManager to simulate it. The reconcile re-runs the
          //    pending AppendTodo on top of the new server baseline.
          const serverUpdate: IPersistedEvent = {
            ...ctx.createPersistedEvent('TodoUpdated', 'nb.Todo-todo-1', {
              id: 'todo-1',
              title: 'From server',
            }),
            revision: 0n,
          }

          // Pre-subscribe, inject, wait for the read model to reflect the
          // reconciled state. The client observes via its own events$ stream;
          // no test-only server id is needed here because the entity id is
          // client-generated and known up front.
          const updated = firstValueFrom(
            ctx.client.events$.pipe(
              filter(
                (e): e is ReadmodelUpdatedEvent =>
                  e.type === 'readmodel:updated' && e.data.ids.includes('todo-1'),
              ),
            ),
          )
          const testSyncManager = ctx.syncManager as TestSyncManager
          testSyncManager.injectWsEvents([{ event: serverUpdate, topics: ['todos'] }])
          await updated

          const afterReconcile = await ctx.client.queryManager.getById<{ title: string }>({
            collection: 'todos',
            id: 'todo-1',
            cacheKey,
          })
          expect(afterReconcile.data?.title).toBe('From server v2')
        },
      ),
    )

    it(
      'dirty command re-run preserves clean-command contributions on other fields',
      integrationTestOptions,
      () => {
        interface TagsData {
          id: string
          tags: string[]
        }
        const todoTaggedProcessor: ProcessorRegistration<TagsData, TagsData> = {
          eventTypes: 'TodoTagged',
          processor: (data, _state, pctx) => ({
            collection: 'todos',
            id: data.id,
            update: { type: 'merge', data: { tags: data.tags } },
            isServerUpdate: pctx.persistence !== 'Anticipated',
          }),
        }

        const tagTodoHandler: CommandHandlerRegistration<
          ServiceLink,
          EnqueueCommand,
          unknown,
          IAnticipatedEvent
        > = {
          commandType: 'TagTodo',
          aggregate: TodoAggregate,
          commandIdReferences: [{ aggregate: TodoAggregate, path: '$.data.id' }],
          handler(command) {
            const { id, tags } = command.data as { id: string; tags: string[] }
            return Ok({
              anticipatedEvents: [
                {
                  type: 'TodoTagged',
                  data: { id, tags },
                  streamId: `nb.Todo-${id}`,
                } as IAnticipatedEvent,
              ],
            })
          },
        }

        const appendTodoHandler: CommandHandlerRegistration<
          ServiceLink,
          EnqueueCommand,
          unknown,
          IAnticipatedEvent
        > = {
          commandType: 'AppendTodo',
          aggregate: TodoAggregate,
          commandIdReferences: [{ aggregate: TodoAggregate, path: '$.data.id' }],
          handler(command, state, _context) {
            const { id, suffix } = command.data as { id: string; suffix: string }
            const currentTitle = (state as { title?: string } | undefined)?.title ?? ''
            return Ok({
              anticipatedEvents: [
                {
                  type: 'TodoUpdated',
                  data: { id, title: `${currentTitle}${suffix}` },
                  streamId: `nb.Todo-${id}`,
                } as IAnticipatedEvent,
              ],
            })
          },
        }

        return run(
          {
            collections: [createTodosCollection()],
            processors: [todoCreatedProcessor(), todoUpdatedProcessor(), todoTaggedProcessor],
            commandHandlers: [createTodoHandler(), tagTodoHandler, appendTodoHandler],
            SyncManagerClass: TestSyncManager,
          },
          async (ctx) => {
            const cacheKey = await ctx.client.cacheManager.acquireKey(TODO_SCOPE_KEY)

            await ctx.client.submit({
              command: { type: 'CreateTodo', data: { id: 'todo-1', title: 'Initial' } },
              cacheKey: TODO_SCOPE_KEY,
            })

            // Clean command: adds tags; not state-dependent, won't be re-run.
            await ctx.client.submit({
              command: { type: 'TagTodo', data: { id: 'todo-1', tags: ['alpha', 'beta'] } },
              cacheKey: TODO_SCOPE_KEY,
            })

            // Dirty command: reads state.title, so the reconcile will re-run
            // it against the new server baseline. Pass the current read model
            // as modelState so the optimistic pre-reconcile title is correct.
            const initialState = await ctx.client.queryManager.getById<{
              title: string
              tags?: string[]
            }>({ collection: 'todos', id: 'todo-1', cacheKey })
            await ctx.client.submit({
              command: { type: 'AppendTodo', data: { id: 'todo-1', suffix: ' v2' } },
              cacheKey: TODO_SCOPE_KEY,
              modelState: initialState.data,
            })

            const before = await ctx.client.queryManager.getById<{
              title: string
              tags: string[]
            }>({ collection: 'todos', id: 'todo-1', cacheKey })
            expect(before.data?.title).toBe('Initial v2')
            expect(before.data?.tags).toEqual(['alpha', 'beta'])

            // Server event: a new title baseline. Pre-subscribe for the
            // reconcile's read-model update, then inject via the internal
            // TestSyncManager (WS scaffolding).
            const updated = firstValueFrom(
              ctx.client.events$.pipe(
                filter(
                  (e): e is ReadmodelUpdatedEvent =>
                    e.type === 'readmodel:updated' && e.data.ids.includes('todo-1'),
                ),
              ),
            )
            const serverUpdate: IPersistedEvent = {
              ...ctx.createPersistedEvent('TodoUpdated', 'nb.Todo-todo-1', {
                id: 'todo-1',
                title: 'From server',
              }),
              revision: 0n,
            }
            const testSyncManager = ctx.syncManager as TestSyncManager
            testSyncManager.injectWsEvents([{ event: serverUpdate, topics: ['todos'] }])
            await updated

            const after = await ctx.client.queryManager.getById<{
              title: string
              tags: string[]
            }>({ collection: 'todos', id: 'todo-1', cacheKey })
            // Title reflects the dirty re-run on top of server state.
            expect(after.data?.title).toBe('From server v2')
            // Tags survive unchanged from the clean TagTodo command.
            expect(after.data?.tags).toEqual(['alpha', 'beta'])
            // Local overlay still present (tags haven't been confirmed by server).
            expect(after.hasLocalChanges).toBe(true)
          },
        )()
      },
    )
  })

  describe('temp ID resolution via WS events', () => {
    it(
      'server event resolves a pending temp-id create via metadata.commandId',
      integrationTestOptions,
      () => {
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

        return run(
          {
            collections: [createTodosCollection()],
            processors: [todoCreatedProcessor()],
            commandHandlers: [createTempTodoHandler],
            SyncManagerClass: TestSyncManager,
          },
          async (ctx) => {
            const cacheKey = await ctx.client.cacheManager.acquireKey(TODO_SCOPE_KEY)

            // 1) Submit a temp-id create. Queue is paused (offline submit),
            //    so command stays in 'pending' and the only ID the client
            //    knows is the temp id from the submit result's entityRef.
            const result = await ctx.client.submit({
              command: { type: 'CreateTempTodo', data: { title: 'Needs server id' } },
              cacheKey: TODO_SCOPE_KEY,
            })
            expect(result.ok).toBe(true)
            if (!result.ok) return
            expect(result.value.stage).toBe('enqueued')
            const tempId = result.value.entityRef?.entityId
            expect(tempId).toBeDefined()
            if (!tempId) return

            const optimistic = await ctx.client.queryManager.getById<{
              id: string
              title: string
            }>({ collection: 'todos', id: tempId, cacheKey })
            expect(optimistic.data?.title).toBe('Needs server id')

            // 2) Server event arrives via WS with a server-assigned ID and
            //    metadata.commandId linking it to the create command. Pre-
            //    subscribe to id-reconciled — the client learns the serverId
            //    from this event, not from test-only knowledge.
            const serverId = 'srv-todo-xyz'
            const serverEvent: IPersistedEvent = {
              id: 'srv-evt-1',
              type: 'TodoCreated',
              streamId: `nb.Todo-${serverId}`,
              data: { id: serverId, title: 'Needs server id' },
              metadata: {
                correlationId: 'corr-srv-1',
                commandId: result.value.commandId,
              },
              revision: 0n,
              position: 1n,
              persistence: 'Permanent',
              created: new Date().toISOString(),
            }

            const idReconciled = firstValueFrom(
              ctx.client.events$.pipe(
                filter(
                  (e): e is IdReconciledEvent =>
                    e.type === 'readmodel:id-reconciled' &&
                    e.data.collection === 'todos' &&
                    e.data.clientId === tempId,
                ),
              ),
            )
            const testSyncManager = ctx.syncManager as TestSyncManager
            testSyncManager.injectWsEvents([{ event: serverEvent, topics: ['todos'] }])

            const event = await idReconciled
            if (event.type !== 'readmodel:id-reconciled') return
            expect(event.data.serverId).toBe(serverId)

            // 3) getById with the original temp id auto-reconciles to the
            //    server entry (QueryResult.meta carries serverId + clientId
            //    so consumers can follow the migration).
            const reconciled = await ctx.client.queryManager.getById<{
              id: string
              title: string
            }>({ collection: 'todos', id: tempId, cacheKey })
            expect(reconciled.data?.title).toBe('Needs server id')
            expect(reconciled.meta?.id).toBe(serverId)
            expect(reconciled.meta?.clientId).toBe(tempId)
            expect(reconciled.hasLocalChanges).toBe(false)

            // Querying directly by serverId returns the same row with the
            // same metadata — the row was renamed in place.
            const byServerId = await ctx.client.queryManager.getById<{
              id: string
              title: string
            }>({ collection: 'todos', id: serverId, cacheKey })
            expect(byServerId.meta?.id).toBe(serverId)
            expect(byServerId.meta?.clientId).toBe(tempId)
          },
        )()
      },
    )
  })

  describe('temp create migration with concurrent WS event', () => {
    it(
      'temp entry is cleaned up when WS event arrives before command response',
      integrationTestOptions,
      () => {
        const serverId = 'srv-note-ws-race'
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

        // Command sender that injects the WS event BEFORE returning the
        // HTTP response — reproduces the shared-worker race where the WS
        // transport delivers an event before the command response arrives.
        let injectWsEvent: ((commandId: string) => void) | undefined
        const commandSender: ICommandSender<ServiceLink, EnqueueCommand> = {
          send: (async (command: { commandId: string; data: unknown }) => {
            await new Promise((resolve) => setTimeout(resolve, 10))
            injectWsEvent?.(command.commandId)
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
            const cacheKey = await ctx.client.cacheManager.acquireKey(TODO_SCOPE_KEY)
            const testSyncManager = ctx.syncManager as TestSyncManager

            // Wire the mid-flight WS injection before the command is sent.
            injectWsEvent = (commandId: string) => {
              const wsEvent: IPersistedEvent = {
                id: 'ws-evt-1',
                type: 'TodoCreated',
                streamId: `nb.Todo-${serverId}`,
                data: { id: serverId, title: 'WS race test' },
                metadata: { correlationId: 'corr-ws', commandId },
                revision: 0n,
                position: 1n,
                persistence: 'Permanent',
                created: new Date().toISOString(),
              }
              testSyncManager.injectWsEvents([{ event: wsEvent, topics: ['todos'] }])
            }

            ctx.syncManager.getConnectivity().reportContact()
            await ctx.client.commandQueue.resume()

            // Pre-subscribe for id-reconciled using only the clientId-side
            // filter — this is what client-solid's createItemQuery watches.
            // We capture the tempId from the submit's entityRef below and
            // filter on it here; the event tells us the serverId.
            let tempIdForFilter: string | undefined
            const idReconciled = firstValueFrom(
              ctx.client.events$.pipe(
                filter(
                  (e): e is IdReconciledEvent =>
                    e.type === 'readmodel:id-reconciled' &&
                    e.data.collection === 'todos' &&
                    (tempIdForFilter === undefined || e.data.clientId === tempIdForFilter),
                ),
              ),
            )

            const result = await ctx.client.submit({
              command: { type: 'CreateTempTodo', data: { title: 'WS race test' } },
              cacheKey: TODO_SCOPE_KEY,
            })
            expect(result.ok).toBe(true)
            if (!result.ok) return
            expect(result.value.stage).toBe('confirmed')
            const tempId = result.value.entityRef?.entityId
            expect(tempId).toBeDefined()
            if (!tempId) return
            tempIdForFilter = tempId

            const event = await idReconciled
            if (event.type !== 'readmodel:id-reconciled') return
            expect(event.data.clientId).toBe(tempId)
            expect(event.data.serverId).toBe(serverId)

            // One canonical row in the collection, under the serverId,
            // carrying the original clientId in its metadata.
            const list = await ctx.client.queryManager.list<{ id: string }>({
              collection: 'todos',
              cacheKey,
            })
            expect(list.data).toHaveLength(1)
            expect(list.meta[0]?.id).toBe(serverId)
            expect(list.meta[0]?.clientId).toBe(tempId)

            // getById still resolves from the temp id via the mapping cache.
            const viaTempId = await ctx.client.queryManager.getById<{ id: string }>({
              collection: 'todos',
              id: tempId,
              cacheKey,
            })
            expect(viaTempId.meta?.id).toBe(serverId)
          },
        )()
      },
    )
  })

  describe('cross-aggregate EntityRef rewrite via commandIdReferences', () => {
    it(
      'child command submitted with EntityRef parentId gets patched to the server id',
      integrationTestOptions,
      () => {
        const serverNoteId = 'srv-note-abc'

        const createNoteHandler: CommandHandlerRegistration<
          ServiceLink,
          EnqueueCommand,
          unknown,
          IAnticipatedEvent
        > = {
          commandType: 'CreateNote',
          aggregate: NoteAggregate,
          commandIdReferences: [],
          creates: { eventType: 'NoteCreated', idStrategy: 'temporary' },
          handler(command, _state, context) {
            const id = createEntityId(context)
            const { title } = command.data as { title: string }
            return Ok({
              anticipatedEvents: [
                {
                  type: 'NoteCreated',
                  data: { id, title },
                  streamId: `nb.Note-${entityIdToString(id)}`,
                } as IAnticipatedEvent,
              ],
            })
          },
        }

        const createItemHandler: CommandHandlerRegistration<
          ServiceLink,
          EnqueueCommand,
          unknown,
          IAnticipatedEvent
        > = {
          commandType: 'CreateItem',
          aggregate: TodoAggregate,
          commandIdReferences: [{ aggregate: NoteAggregate, path: '$.data.noteId' }],
          creates: { eventType: 'TodoCreated', idStrategy: 'temporary' },
          handler(command, _state, context) {
            const id = createEntityId(context)
            const { noteId } = command.data as { noteId: string }
            return Ok({
              anticipatedEvents: [
                {
                  type: 'TodoCreated',
                  data: { id, noteId },
                  streamId: `nb.Todo-${entityIdToString(id)}`,
                } as IAnticipatedEvent,
              ],
            })
          },
        }

        const noteCreatedProcessor: ProcessorRegistration = {
          eventTypes: 'NoteCreated',
          processor: (data: { id: string; title: string }, _state, ctx) => ({
            collection: 'notes',
            id: data.id,
            update: { type: 'set', data },
            isServerUpdate: ctx.persistence !== 'Anticipated',
          }),
        }

        const notesCollection: Collection<ServiceLink> = {
          name: 'notes',
          aggregate: NoteAggregate,
          matchesStream: (streamId) => streamId.startsWith('nb.Note-'),
          cacheKeysFromTopics: () => [TODO_SCOPE_KEY],
        }

        const commandSender: ICommandSender<ServiceLink, EnqueueCommand> = {
          send: (async (command: { commandId: string; type: string; data: unknown }) => {
            await new Promise((resolve) => setTimeout(resolve, 10))
            if (command.type === 'CreateNote') {
              return Ok({
                id: serverNoteId,
                nextExpectedRevision: '0',
                events: [
                  createSerializedEvent(
                    'NoteCreated',
                    `nb.Note-${serverNoteId}`,
                    { id: serverNoteId, title: (command.data as { title: string }).title },
                    { commandId: command.commandId },
                  ),
                ],
              })
            }
            const serverItemId = 'srv-item-1'
            return Ok({
              id: serverItemId,
              nextExpectedRevision: '0',
              events: [
                createSerializedEvent(
                  'TodoCreated',
                  `nb.Todo-${serverItemId}`,
                  { id: serverItemId, noteId: (command.data as { noteId: string }).noteId },
                  { commandId: command.commandId },
                ),
              ],
            })
          }) as ICommandSender<ServiceLink, EnqueueCommand>['send'],
        }

        return run(
          {
            collections: [createTodosCollection(), notesCollection],
            processors: [todoCreatedProcessor(), noteCreatedProcessor],
            commandHandlers: [createNoteHandler, createItemHandler],
            commandSender,
            SyncManagerClass: TestSyncManager,
          },
          async (ctx) => {
            await ctx.client.cacheManager.acquireKey(TODO_SCOPE_KEY)
            ctx.syncManager.getConnectivity().reportContact()
            await ctx.client.commandQueue.resume()

            // 1) Submit the parent Note — temp id up front, serverId after confirm
            const noteResult = await ctx.client.submit({
              command: { type: 'CreateNote', data: { title: 'Parent note' } },
              cacheKey: TODO_SCOPE_KEY,
            })
            expect(noteResult.ok).toBe(true)
            if (!noteResult.ok) return
            expect(noteResult.value.stage).toBe('confirmed')
            const noteEntityRef = noteResult.value.entityRef
            expect(noteEntityRef).toBeDefined()
            if (!noteEntityRef) return

            // 2) Submit the child Item referencing the parent via EntityRef.
            //    The library patches the stored data to the serverNoteId
            //    because the mapping cache already has the resolved id.
            const itemResult = await ctx.client.submit({
              command: { type: 'CreateItem', data: { noteId: noteEntityRef } },
              cacheKey: TODO_SCOPE_KEY,
            })
            expect(itemResult.ok).toBe(true)
            if (!itemResult.ok) return

            // 3) Assert the stored command data via the public command queue
            //    getter — the child's noteId now holds the server id.
            const itemCommand = await ctx.client.commandQueue.getCommand(itemResult.value.commandId)
            expect(itemCommand).toBeDefined()
            const storedData = itemCommand?.data as { noteId: string }
            expect(storedData.noteId).toBe(serverNoteId)
          },
        )()
      },
    )
  })
})
