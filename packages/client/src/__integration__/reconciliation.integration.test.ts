/**
 * Integration tests for command reconciliation with server events.
 *
 * Tests the interaction between locally-enqueued commands and server events
 * arriving via WebSocket. Exercises dirty command re-run, temp ID resolution
 * via WS events, and multi-field overlay preservation. Uses the real WriteQueue
 * pipeline with only the network layer mocked.
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

describe.each(bootstrapVariants)('$name reconciliation', ({ bootstrap }) => {
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
          // 1) Create a todo locally via anticipated events
          await ctx.commandQueue.enqueue({
            command: { type: 'CreateTodo', data: { id: 'todo-1', title: 'Initial' } },
            cacheKey: TODO_SCOPE_KEY,
          })

          // 2) Enqueue a state-dependent AppendTodo. It reads 'Initial' and
          //    produces 'Initial v2'. Command stays pending (mock sender is slow).
          const initialState = await ctx.readModelStore.getById<{ title: string }>(
            'todos',
            'todo-1',
          )
          await ctx.commandQueue.enqueue({
            command: { type: 'AppendTodo', data: { id: 'todo-1', suffix: ' v2' } },
            cacheKey: TODO_SCOPE_KEY,
            modelState: initialState?.data,
          })

          const beforeReconcile = await ctx.readModelStore.getById<{ title: string }>(
            'todos',
            'todo-1',
          )
          expect(beforeReconcile?.data.title).toBe('Initial v2')

          // 3) Server event arrives via WS with a different title for the
          //    same entity. The reconcile re-runs AppendTodo against the new
          //    server baseline and produces 'From server v2'.
          const serverUpdate: IPersistedEvent = {
            ...ctx.createPersistedEvent('TodoUpdated', 'nb.Todo-todo-1', {
              id: 'todo-1',
              title: 'From server',
            }),
            revision: 0n,
          }

          await ctx.injectWsEventsAndWait([{ event: serverUpdate, topics: ['todos'] }], 'todo-1')

          const afterReconcile = await ctx.readModelStore.getById<{ title: string }>(
            'todos',
            'todo-1',
          )
          expect(afterReconcile?.data.title).toBe('From server v2')
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
            // Create a todo
            await ctx.commandQueue.enqueue({
              command: { type: 'CreateTodo', data: { id: 'todo-1', title: 'Initial' } },
              cacheKey: TODO_SCOPE_KEY,
            })

            // Clean command: TagTodo adds tags (won't be re-run)
            await ctx.commandQueue.enqueue({
              command: { type: 'TagTodo', data: { id: 'todo-1', tags: ['alpha', 'beta'] } },
              cacheKey: TODO_SCOPE_KEY,
            })

            // Dirty command: AppendTodo reads state.title
            const initialState = await ctx.readModelStore.getById<{
              title: string
              tags?: string[]
            }>('todos', 'todo-1')
            await ctx.commandQueue.enqueue({
              command: { type: 'AppendTodo', data: { id: 'todo-1', suffix: ' v2' } },
              cacheKey: TODO_SCOPE_KEY,
              modelState: initialState?.data,
            })

            const before = await ctx.readModelStore.getById<{ title: string; tags: string[] }>(
              'todos',
              'todo-1',
            )
            expect(before?.data.title).toBe('Initial v2')
            expect(before?.data.tags).toEqual(['alpha', 'beta'])

            // Server event changes the title baseline
            const serverUpdate: IPersistedEvent = {
              ...ctx.createPersistedEvent('TodoUpdated', 'nb.Todo-todo-1', {
                id: 'todo-1',
                title: 'From server',
              }),
              revision: 0n,
            }

            await ctx.injectWsEventsAndWait([{ event: serverUpdate, topics: ['todos'] }], 'todo-1')

            const after = await ctx.readModelStore.getById<{ title: string; tags: string[] }>(
              'todos',
              'todo-1',
            )
            // Title reflects the dirty re-run on top of server state
            expect(after?.data.title).toBe('From server v2')
            // Tags survive unchanged from the clean TagTodo command
            expect(after?.data.tags).toEqual(['alpha', 'beta'])

            // Server baseline is clean — no overlay contamination
            expect(after?.serverData?.title).toBe('From server')
            expect(after?.serverData?.tags).toBeUndefined()
            expect(after?.hasLocalChanges).toBe(true)
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
            // 1) Enqueue a temp-id create. Command stays pending.
            const enqueueResult = await ctx.commandQueue.enqueue({
              command: { type: 'CreateTempTodo', data: { title: 'Needs server id' } },
              cacheKey: TODO_SCOPE_KEY,
            })
            expect(enqueueResult.ok).toBe(true)
            if (!enqueueResult.ok) return
            const createCommandId = enqueueResult.value.commandId

            const models = await ctx.readModelStore.list<{ id: unknown; title: string }>('todos')
            expect(models).toHaveLength(1)
            const tempId = models[0]?.id
            expect(tempId).toBeDefined()
            if (!tempId) return
            expect(models[0]?.data.title).toBe('Needs server id')

            // 2) Server event arrives via WS with a server-assigned ID and
            //    metadata.commandId linking it back to the create command.
            const serverId = 'srv-todo-xyz'
            const serverEvent: IPersistedEvent = {
              id: 'srv-evt-1',
              type: 'TodoCreated',
              streamId: `nb.Todo-${serverId}`,
              data: { id: serverId, title: 'Needs server id' },
              metadata: { correlationId: 'corr-srv-1', commandId: createCommandId },
              revision: 0n,
              position: 1n,
              persistence: 'Permanent',
              created: new Date().toISOString(),
            }

            // Wait for the server ID to appear in readmodel:updated
            const updated = firstValueFrom(
              ctx.eventBus
                .on('readmodel:updated')
                .pipe(filter((e) => e.data.ids.includes(serverId))),
            )
            const testSyncManager = ctx.syncManager as TestSyncManager
            testSyncManager.injectWsEvents([{ event: serverEvent, topics: ['todos'] }])
            await updated

            // 3) Assertions
            const rawTempRecord = await ctx.storage.getReadModel('todos', tempId)
            expect(rawTempRecord).toBeUndefined()

            const rawServerRecord = await ctx.storage.getReadModel('todos', serverId)
            expect(rawServerRecord).toBeDefined()

            const mapping = ctx.mappingStore.get(tempId)
            expect(mapping).toBeDefined()
            expect(mapping?.serverId).toBe(serverId)

            // getById with tempId auto-reconciles to the server entry
            const reconciled = await ctx.readModelStore.getById<{
              id: string
              title: string
            }>('todos', tempId)
            expect(reconciled).toBeDefined()
            expect(reconciled?.id).toBe(serverId)
            expect(reconciled?.data.title).toBe('Needs server id')
            expect(reconciled?.hasLocalChanges).toBe(false)

            const serverEntry = await ctx.readModelStore.getById('todos', serverId)
            expect(serverEntry?._clientMetadata?.clientId).toBe(tempId)
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

        // Command sender that injects the WS event before returning the
        // HTTP response — reproduces the shared-worker race where WS
        // delivers the event before the command response arrives.
        let injectWsEvent: ((commandId: string) => void) | undefined
        const commandSender: ICommandSender<ServiceLink, EnqueueCommand> = {
          send: (async (command: { commandId: string; data: unknown }) => {
            await new Promise((resolve) => setTimeout(resolve, 10))
            // Simulate WS delivering the event before we return the response
            injectWsEvent?.(command.commandId)
            await new Promise((resolve) => setTimeout(resolve, 10))
            return Ok({
              id: serverId,
              nextExpectedRevision: '1',
              events: [
                createSerializedEvent(
                  'TodoCreated',
                  `nb.Todo-${serverId}`,
                  {
                    id: serverId,
                    title: (command.data as { title: string }).title,
                  },
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
            const testSyncManager = ctx.syncManager as TestSyncManager

            // Wire up WS injection to fire when the command sender is mid-flight
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

            const anticipatedWritten = firstValueFrom(
              ctx.eventBus
                .on('readmodel:updated')
                .pipe(filter((e) => e.data.collection === 'todos')),
            )

            const result = await ctx.commandQueue.enqueue({
              command: { type: 'CreateTempTodo', data: { title: 'WS race test' } },
              cacheKey: TODO_SCOPE_KEY,
            })
            expect(result.ok).toBe(true)
            if (!result.ok) return
            const commandId = result.value.commandId

            await anticipatedWritten

            const modelsBefore = await ctx.readModelStore.list<{ id: unknown }>('todos')
            expect(modelsBefore).toHaveLength(1)
            const tempId = modelsBefore[0]!.id

            // Subscribe to id-reconciled BEFORE resume to avoid missing the event
            const idReconciled = firstValueFrom(
              ctx.eventBus
                .on('readmodel:id-reconciled')
                .pipe(filter((e) => e.data.serverId === serverId)),
            )

            // Resume — sender injects WS event, then returns HTTP response
            await ctx.commandQueue.resume()
            await ctx.commandQueue.waitForCompletion(commandId)

            // Wait for the temp→server ID migration to complete
            await idReconciled

            // Temp entry should be gone, server entry should exist
            const rawTemp = await ctx.storage.getReadModel('todos', tempId)
            expect(rawTemp).toBeUndefined()

            const rawServer = await ctx.storage.getReadModel('todos', serverId)
            expect(rawServer).toBeDefined()

            // Only one entry in the collection
            const allModels = await ctx.readModelStore.list('todos')
            expect(allModels).toHaveLength(1)
            expect(allModels[0]?.id).toBe(serverId)
          },
        )()
      },
    )
  })

  describe('cross-aggregate EntityRef rewrite via commandIdReferences', () => {
    it(
      'child command enqueued with EntityRef parentId gets patched to server id',
      integrationTestOptions,
      () => {
        const serverNoteId = 'srv-note-abc'

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

        // Parent: CreateNote with temporary ID
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

        // Child: CreateItem that references its Note parent via commandIdReferences
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

        // Command sender: CreateNote returns the server id
        const commandSender: ICommandSender<ServiceLink, EnqueueCommand> = {
          send: (async (command: { commandId: string; type: string; data: unknown }) => {
            await new Promise((resolve) => setTimeout(resolve, 10))
            if (command.type === 'CreateNote') {
              return Ok({
                id: serverNoteId,
                nextExpectedRevision: '1',
                events: [
                  createSerializedEvent(
                    'NoteCreated',
                    `nb.Note-${serverNoteId}`,
                    {
                      id: serverNoteId,
                      title: (command.data as { title: string }).title,
                    },
                    { commandId: command.commandId },
                  ),
                ],
              })
            }
            // CreateItem — just return success
            return Ok({ id: 'srv-item-1', nextExpectedRevision: '1', events: [] })
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
            // 1) Create note — gets a temp id, command sends and succeeds
            const noteResult = await ctx.commandQueue.enqueue({
              command: { type: 'CreateNote', data: { title: 'Parent note' } },
              cacheKey: TODO_SCOPE_KEY,
            })
            expect(noteResult.ok).toBe(true)
            if (!noteResult.ok) return

            const createCommandId = noteResult.value.commandId
            const noteEntityRef = noteResult.value.entityRef
            expect(noteEntityRef).toBeDefined()
            if (!noteEntityRef) return

            // Resume and wait for the CreateNote command to complete
            await ctx.commandQueue.resume()
            await ctx.commandQueue.waitForCompletion(createCommandId)

            // Verify the mapping was persisted
            const tempNoteId = entityIdToString(noteEntityRef)
            const mapping = ctx.mappingStore.get(tempNoteId)
            expect(mapping).toBeDefined()
            expect(mapping?.serverId).toBe(serverNoteId)

            // 2) Enqueue child command with the EntityRef noteId
            //    (simulates UI passing unreconciled ref)
            const itemResult = await ctx.commandQueue.enqueue({
              command: {
                type: 'CreateItem',
                data: { noteId: noteEntityRef },
              },
              cacheKey: TODO_SCOPE_KEY,
            })
            expect(itemResult.ok).toBe(true)
            if (!itemResult.ok) return

            // 3) Verify the child command's stored data has the server id
            const itemCommand = await ctx.storage.getCommand(itemResult.value.commandId)
            expect(itemCommand).toBeDefined()
            const storedData = itemCommand?.data as { noteId: string }
            expect(storedData.noteId).toBe(serverNoteId)
          },
        )()
      },
    )
  })
})
