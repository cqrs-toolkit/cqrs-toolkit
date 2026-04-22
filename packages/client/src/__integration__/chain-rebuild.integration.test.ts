/**
 * Integration tests for CommandQueue's chain rebuild on worker restart.
 *
 * Uses the bootstrap's `seedStorage` hook to pre-populate persisted state
 * (commands + id mappings) before any in-memory store initializes —
 * exactly the state a fresh worker sees when it takes over a live session.
 * After the components initialize, `commandQueue.resume()` runs
 * `rebuildChains`, and the tests observe the resulting behavior by
 * enqueueing fresh commands and inspecting the resulting records.
 *
 * Runs against both bootstrap variants (in-memory + SQLite) so the SQL
 * code path is exercised.
 */

import { Ok, type ServiceLink } from '@meticoeus/ddd-es'
import { describe, expect, it } from 'vitest'
import type { IAnticipatedEvent } from '../core/command-lifecycle/AnticipatedEventShape.js'
import {
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
  updateTodoHandler,
} from '../testing/index.js'
import type { CommandRecord, EnqueueCommand } from '../types/commands.js'
import type { CommandHandlerRegistration } from '../types/domain.js'
import { autoRevision } from '../types/domain.js'

function makeSeededCommand(
  overrides: Partial<CommandRecord<ServiceLink, EnqueueCommand>> & {
    commandId: string
    seq: number
  },
): CommandRecord<ServiceLink, EnqueueCommand> {
  const base: CommandRecord<ServiceLink, EnqueueCommand> = {
    commandId: overrides.commandId,
    cacheKey: TODO_SCOPE_KEY,
    service: 'nb',
    type: 'UpdateTodo',
    data: { id: 'todo-1', title: 'Seeded' },
    status: 'pending',
    dependsOn: [],
    blockedBy: [],
    attempts: 0,
    seq: overrides.seq,
    createdAt: 1,
    updatedAt: 1,
    affectedAggregates: [
      {
        streamId: 'nb.Todo-todo-1',
        link: { service: 'nb', type: 'Todo', id: 'todo-1' },
      },
    ],
  }
  return { ...base, ...overrides }
}

describe.each(bootstrapVariants)('$name chain rebuild', ({ bootstrap }) => {
  const run = createRun(bootstrap)

  it(
    'new command auto-deps on a seeded pending command after restart',
    integrationTestOptions,
    run(
      {
        collections: [createTodosCollection()],
        processors: [todoCreatedProcessor(), todoUpdatedProcessor()],
        commandHandlers: [createTodoHandler(), updateTodoHandler()],
        SyncManagerClass: TestSyncManager,
        seedStorage: async (storage) => {
          await storage.saveCommand(makeSeededCommand({ commandId: 'seeded-update', seq: 1 }))
        },
      },
      async (ctx) => {
        // resume() triggers rebuildChains — after this, the in-memory chain
        // registry reflects the seeded pending command's streamId.
        // Queue stays paused. rebuildChains already ran as part of
        // bootstrap's `commandQueue.initialize()`, so the chain registry
        // reflects the seeded state. If we resumed here, the mock sender
        // would drain the seeded pending command into a terminal status
        // before we could observe its effect on a fresh enqueue.

        // Enqueue a fresh UpdateTodo against the same entity. Its anticipated
        // events share the same streamId, so detectAggregateDependencies
        // should look up the chain and add the seeded command to dependsOn.
        const result = await ctx.client.commandQueue.enqueue({
          command: { type: 'UpdateTodo', data: { id: 'todo-1', title: 'Fresh' } },
          cacheKey: TODO_SCOPE_KEY,
          modelState: { id: 'todo-1', title: 'Seeded' },
        })
        expect(result.ok).toBe(true)
        if (!result.ok) return

        const stored = await ctx.client.commandQueue.getCommand(result.value.commandId)
        expect(stored?.dependsOn).toContain('seeded-update')
        expect(stored?.blockedBy).toContain('seeded-update')
      },
    ),
  )

  it(
    'new command keyed by server id auto-deps on a pending command keyed by client id (dual-index)',
    integrationTestOptions,
    run(
      {
        collections: [createTodosCollection()],
        processors: [todoCreatedProcessor(), todoUpdatedProcessor()],
        commandHandlers: [createTodoHandler(), updateTodoHandler()],
        SyncManagerClass: TestSyncManager,
        seedStorage: async (storage) => {
          const tempId = 'temp-todo-1'
          // Prior-session artifact: an in-flight update on the aggregate
          // BEFORE the create was reconciled (streamId keyed by tempId),
          // plus the mapping that tells us tempId has since resolved to
          // srv-todo-1. A fresh worker must dual-index the chain so a new
          // command whose payload references the server id finds the same
          // chain object.
          await storage.saveCommand(
            makeSeededCommand({
              commandId: 'seeded-update',
              seq: 1,
              data: { id: tempId, title: 'Stale' },
              affectedAggregates: [
                {
                  streamId: `nb.Todo-${tempId}`,
                  link: { service: 'nb', type: 'Todo', id: tempId },
                },
              ],
            }),
          )
          await storage.saveCommandIdMapping({
            clientId: tempId,
            serverId: 'srv-todo-1',
            createdAt: Date.now(),
          })
        },
      },
      async (ctx) => {
        // Queue stays paused. rebuildChains already ran as part of
        // bootstrap's `commandQueue.initialize()`, so the chain registry
        // reflects the seeded state. If we resumed here, the mock sender
        // would drain the seeded pending command into a terminal status
        // before we could observe its effect on a fresh enqueue.

        // New command against the SERVER id. With dual-index rehydration,
        // `nb.Todo-srv-todo-1` resolves to the same chain as
        // `nb.Todo-temp-todo-1` and picks up the seeded command as a dep.
        // Without it, the new command would create a disjoint chain and
        // miss the dep — a potential out-of-order risk.
        const result = await ctx.client.commandQueue.enqueue({
          command: { type: 'UpdateTodo', data: { id: 'srv-todo-1', title: 'Fresh' } },
          cacheKey: TODO_SCOPE_KEY,
          modelState: { id: 'srv-todo-1', title: 'Seeded' },
        })
        expect(result.ok).toBe(true)
        if (!result.ok) return

        const stored = await ctx.client.commandQueue.getCommand(result.value.commandId)
        expect(stored?.dependsOn).toContain('seeded-update')
        expect(stored?.blockedBy).toContain('seeded-update')
      },
    ),
  )

  it(
    'new AutoRevision command picks up lastKnownRevision from a seeded succeeded command',
    integrationTestOptions,
    () => {
      // UpdateTodo with explicit responseIdReferences so the rebuild can
      // extract the revision from the seeded command's serverResponse.
      const updateTodoWithRevision: CommandHandlerRegistration<
        ServiceLink,
        EnqueueCommand,
        unknown,
        IAnticipatedEvent
      > = {
        commandType: 'UpdateTodo',
        aggregate: TodoAggregate,
        commandIdReferences: [{ aggregate: TodoAggregate, path: '$.data.id' }],
        responseIdReferences: [
          {
            aggregate: TodoAggregate,
            path: '$.id',
            revisionPath: '$.nextExpectedRevision',
          },
        ],
        handler(command) {
          const { id, title } = command.data as { id: string; title: string }
          return Ok({
            anticipatedEvents: [
              {
                type: 'TodoUpdated' as const,
                data: { id, title },
                streamId: `nb.Todo-${id}`,
              } as IAnticipatedEvent,
            ],
          })
        },
      }

      return run(
        {
          collections: [createTodosCollection()],
          processors: [todoCreatedProcessor(), todoUpdatedProcessor()],
          commandHandlers: [createTodoHandler(), updateTodoWithRevision],
          SyncManagerClass: TestSyncManager,
          seedStorage: async (storage) => {
            await storage.saveCommand(
              makeSeededCommand({
                commandId: 'seeded-succeeded',
                seq: 1,
                status: 'succeeded',
                serverResponse: { id: 'todo-1', nextExpectedRevision: '7' },
              }),
            )
          },
        },
        async (ctx) => {
          // Queue stays paused. rebuildChains already ran as part of
          // bootstrap's `commandQueue.initialize()`, so the chain registry
          // reflects the seeded state. If we resumed here, the mock sender
          // would drain the seeded pending command into a terminal status
          // before we could observe its effect on a fresh enqueue.

          // Fresh command with AutoRevision and no consumer-provided fallback.
          // patchFromIdMappingCache should fill the fallback from the chain's
          // rehydrated `lastKnownRevision`.
          const result = await ctx.client.commandQueue.enqueue({
            command: {
              type: 'UpdateTodo',
              data: { id: 'todo-1', title: 'Fresh' },
              revision: autoRevision(),
            },
            cacheKey: TODO_SCOPE_KEY,
            modelState: { id: 'todo-1', title: 'Seeded' },
          })
          expect(result.ok).toBe(true)
          if (!result.ok) return

          const stored = await ctx.client.commandQueue.getCommand(result.value.commandId)
          expect(stored?.revision).toMatchObject({ __autoRevision: true, fallback: '7' })
        },
      )()
    },
  )
})
