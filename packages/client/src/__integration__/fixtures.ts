/**
 * Integration test fixtures.
 *
 * Domain types, collections, processors, and command handlers for a minimal
 * "todo" domain used by integration tests.
 */

import type { ServiceLink } from '@meticoeus/ddd-es'
import { Err, Ok } from '@meticoeus/ddd-es'
import { vi } from 'vitest'
import { deriveScopeKey } from '../core/cache-manager/CacheKey.js'
import type { IAnticipatedEvent } from '../core/command-lifecycle/AnticipatedEventShape.js'
import type { ICommandSender } from '../core/command-queue/types.js'
import type { ProcessorRegistration } from '../core/event-processor/types.js'
import { TodoAggregate } from '../testing/index.js'
import type { EnqueueCommand } from '../types/commands.js'
import type { Collection } from '../types/config.js'
import type { CommandHandlerRegistration } from '../types/domain.js'
import { ValidationException } from '../types/validation.js'

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
    matchesStream: (streamId) => streamId.startsWith('Todo-'),
    cacheKeysFromTopics: () => [TODO_SCOPE_KEY],
    seedOnInit: { cacheKey: TODO_SCOPE_KEY, topics: ['todos'] },
  }
}

// ---------------------------------------------------------------------------
// Processors
// ---------------------------------------------------------------------------

export function todoCreatedProcessor(): ProcessorRegistration<
  { id: string; title: string },
  { id: string; title: string }
> {
  return {
    eventTypes: 'TodoCreated',
    processor: (data, ctx) => ({
      collection: 'todos',
      id: data.id,
      update: { type: 'set', data },
      isServerUpdate: ctx.persistence !== 'Anticipated',
    }),
  }
}

export function todoUpdatedProcessor(): ProcessorRegistration<
  { id: string; title: string },
  { id: string; title: string }
> {
  return {
    eventTypes: 'TodoUpdated',
    processor: (data, ctx) => ({
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
    handler(command, _context) {
      const { id, title } = command.data as { id: string; title: string }
      return Ok({
        anticipatedEvents: [
          { type: 'TodoCreated' as const, data: { id, title }, streamId: `Todo-${id}` },
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
    handler(command, _context) {
      const { id, title } = command.data as { id: string; title: string }
      return Ok({
        anticipatedEvents: [
          { type: 'TodoUpdated' as const, data: { id, title }, streamId: `Todo-${id}` },
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

// ---------------------------------------------------------------------------
// Mock command sender
// ---------------------------------------------------------------------------

export interface MockCommandSender extends ICommandSender<ServiceLink, EnqueueCommand> {
  sent: Array<{ type: string; data: unknown }>
}

export function createMockCommandSender(): MockCommandSender {
  const sent: Array<{ type: string; data: unknown }> = []
  const sender: MockCommandSender = {
    sent,
    send: vi.fn(async (command) => {
      sent.push({ type: command.type, data: command.data })
      return Ok({})
    }) as MockCommandSender['send'],
  }
  return sender
}
