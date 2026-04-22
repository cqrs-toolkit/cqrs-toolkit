/**
 * Integration test fixtures.
 *
 * Domain types, collections, processors, and command handlers for a minimal
 * "todo" domain used by integration tests.
 */

import type { ServiceLink } from '@meticoeus/ddd-es'
import { Err, Ok } from '@meticoeus/ddd-es'
import assert from 'node:assert'
import { deriveScopeKey } from '../../core/cache-manager/CacheKey.js'
import type { IAnticipatedEvent } from '../../core/command-lifecycle/AnticipatedEventShape.js'
import type { ProcessorRegistration } from '../../core/event-processor/types.js'
import type { EnqueueCommand } from '../../types/commands.js'
import type { Collection } from '../../types/config.js'
import type { CommandHandlerRegistration } from '../../types/domain.js'
import { ValidationException } from '../../types/validation.js'
import { TodoAggregate } from '../index.js'

export { createMockCommandSender, type MockCommandSender } from './mock-command-sender.js'

// ---------------------------------------------------------------------------
// Anticipated event types
// ---------------------------------------------------------------------------

export type TodoCreatedEvent = IAnticipatedEvent<
  'TodoCreated',
  { readonly id: string; readonly title: string }
>

export type TodoUpdatedEvent = IAnticipatedEvent<
  'TodoUpdated',
  { readonly id: string; readonly title: string }
>

// ---------------------------------------------------------------------------
// Cache key
// ---------------------------------------------------------------------------

export const TODO_SCOPE_KEY = deriveScopeKey({ scopeType: 'todos' })

// ---------------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------------

export function createTodosCollection(): Collection<ServiceLink> {
  return {
    name: 'todos',
    aggregate: TodoAggregate,
    matchesStream: (streamId) => streamId.startsWith('nb.Todo-'),
    cacheKeysFromTopics: () => [TODO_SCOPE_KEY],
    seedOnInit: { cacheKey: TODO_SCOPE_KEY, topics: ['todos'] },
  }
}

// ---------------------------------------------------------------------------
// Processors
// ---------------------------------------------------------------------------

export interface TodoRow {
  readonly id: string
  readonly title: string
}

export function todoCreatedProcessor(): ProcessorRegistration<TodoRow, TodoRow> {
  return {
    eventTypes: 'TodoCreated',
    processor: (data, _state, ctx) => ({
      collection: 'todos',
      id: data.id,
      update: { type: 'set', data },
      isServerUpdate: ctx.persistence !== 'Anticipated',
    }),
  }
}

export function todoUpdatedProcessor(): ProcessorRegistration<TodoRow, TodoRow> {
  return {
    eventTypes: 'TodoUpdated',
    processor: (data, _state, ctx) => ({
      collection: 'todos',
      id: data.id,
      update: { type: 'merge', data: { title: data.title } },
      isServerUpdate: ctx.persistence !== 'Anticipated',
    }),
  }
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

export function createTodoHandler(): CommandHandlerRegistration<
  ServiceLink,
  EnqueueCommand,
  unknown,
  TodoCreatedEvent
> {
  return {
    commandType: 'CreateTodo',
    aggregate: TodoAggregate,
    commandIdReferences: [{ aggregate: TodoAggregate, path: '$.data.id' }],
    handler(command, _context) {
      const { id, title } = command.data as TodoRow
      return Ok({
        anticipatedEvents: [
          { type: 'TodoCreated' as const, data: { id, title }, streamId: `nb.Todo-${id}` },
        ],
      })
    },
  }
}

export function updateTodoHandler(): CommandHandlerRegistration<
  ServiceLink,
  EnqueueCommand,
  unknown,
  TodoUpdatedEvent
> {
  return {
    commandType: 'UpdateTodo',
    aggregate: TodoAggregate,
    commandIdReferences: [{ aggregate: TodoAggregate, path: '$.data.id' }],
    handler(command, state, _context) {
      // UpdateTodo is a non-create mutation, so callers must pass the
      // current read-model snapshot via `modelState` on the enqueue params.
      // Assert so tests that forget this fail loudly instead of silently
      // producing anticipated events against an empty state.
      assert(state !== undefined, 'UpdateTodo handler requires modelState')
      const { id, title } = command.data as TodoRow
      return Ok({
        anticipatedEvents: [
          { type: 'TodoUpdated' as const, data: { id, title }, streamId: `nb.Todo-${id}` },
        ],
      })
    },
  }
}

export function rejectingHandler(): CommandHandlerRegistration<
  ServiceLink,
  EnqueueCommand,
  unknown,
  IAnticipatedEvent
> {
  return {
    commandType: 'InvalidCommand',
    aggregate: TodoAggregate,
    commandIdReferences: [],
    validate() {
      return Err(
        new ValidationException([
          { path: 'title', code: 'required', message: 'required', params: {} },
        ]),
      )
    },
    handler() {
      throw new Error('Should not reach handler')
    },
  }
}
