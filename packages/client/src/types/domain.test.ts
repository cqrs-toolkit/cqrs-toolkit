import { describe, expect, it } from 'vitest'
import type { CommandHandlerRegistration } from './domain.js'
import { createDomainExecutor, domainFailure, domainSuccess } from './domain.js'

describe('createDomainExecutor', () => {
  const registrations: CommandHandlerRegistration[] = [
    {
      commandType: 'CreateTodo',
      handler(payload) {
        return domainSuccess([{ type: 'TodoCreated', data: payload, streamId: 'Todo-1' }])
      },
    },
    {
      commandType: 'DeleteTodo',
      handler() {
        return domainSuccess([])
      },
    },
  ]

  it('dispatches to the correct handler by command type', () => {
    const executor = createDomainExecutor(registrations)

    const result = executor.execute({ type: 'CreateTodo', payload: { content: 'test' } })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.anticipatedEvents).toEqual([
        { type: 'TodoCreated', data: { content: 'test' }, streamId: 'Todo-1' },
      ])
    }
  })

  it('passes payload to handler, not the full command', () => {
    const executor = createDomainExecutor([
      {
        commandType: 'Test',
        handler(payload) {
          // If the full command were passed, payload would have `type` and `payload` keys
          return domainSuccess([{ received: payload }])
        },
      },
    ])

    const result = executor.execute({ type: 'Test', payload: { field: 'value' } })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.anticipatedEvents).toEqual([{ received: { field: 'value' } }])
    }
  })

  it('returns validation failure for unregistered command type', () => {
    const executor = createDomainExecutor(registrations)

    const result = executor.execute({ type: 'UnknownCommand', payload: {} })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.details).toEqual([
        { path: 'type', message: 'Unknown command type: UnknownCommand' },
      ])
    }
  })

  it('asserts on duplicate command type registration', () => {
    const duplicates: CommandHandlerRegistration[] = [
      { commandType: 'CreateTodo', handler: () => domainSuccess([]) },
      { commandType: 'CreateTodo', handler: () => domainSuccess([]) },
    ]

    expect(() => createDomainExecutor(duplicates)).toThrow(
      'Duplicate command handler registration for "CreateTodo"',
    )
  })

  it('propagates handler validation failures', () => {
    const executor = createDomainExecutor([
      {
        commandType: 'Validate',
        handler() {
          return domainFailure([{ path: 'name', message: 'name must not be empty' }])
        },
      },
    ])

    const result = executor.execute({ type: 'Validate', payload: {} })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.details).toEqual([{ path: 'name', message: 'name must not be empty' }])
    }
  })
})
