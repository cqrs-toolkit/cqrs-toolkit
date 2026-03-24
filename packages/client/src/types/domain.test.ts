import { Err, Ok, ValidationException } from '@meticoeus/ddd-es'
import { describe, expect, it } from 'vitest'
import type { IQueryManager } from '../core/query-manager/types.js'
import type { CommandHandlerRegistration, HandlerContext } from './domain.js'
import { createDomainExecutor, domainFailure, domainSuccess } from './domain.js'

const mockQueryManager = {} as unknown as IQueryManager

const INITIALIZING: HandlerContext = { phase: 'initializing' }

describe('createDomainExecutor', () => {
  const registrations: CommandHandlerRegistration[] = [
    {
      commandType: 'CreateTodo',
      handler(data) {
        return domainSuccess([{ type: 'TodoCreated', data, streamId: 'Todo-1' }])
      },
    },
    {
      commandType: 'DeleteTodo',
      handler() {
        return domainSuccess([])
      },
    },
  ]

  it('dispatches to the correct handler by command type', async () => {
    const executor = createDomainExecutor(registrations)

    const result = await executor.execute(
      { type: 'CreateTodo', data: { content: 'test' } },
      INITIALIZING,
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.anticipatedEvents).toEqual([
        { type: 'TodoCreated', data: { content: 'test' }, streamId: 'Todo-1' },
      ])
    }
  })

  it('passes data and context to handler', async () => {
    let receivedContext: HandlerContext | undefined
    const executor = createDomainExecutor([
      {
        commandType: 'Test',
        handler(data, context) {
          receivedContext = context
          return domainSuccess([{ received: data }])
        },
      },
    ])

    const result = await executor.execute({ type: 'Test', data: { field: 'value' } }, INITIALIZING)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.anticipatedEvents).toEqual([{ received: { field: 'value' } }])
    }
    expect(receivedContext).toEqual(INITIALIZING)
  })

  it('passes updating context with entityId to handler', async () => {
    let receivedContext: HandlerContext | undefined
    const executor = createDomainExecutor([
      {
        commandType: 'Test',
        handler(_data, context) {
          receivedContext = context
          return domainSuccess([])
        },
      },
    ])

    const updatingContext: HandlerContext = { phase: 'updating', entityId: 'entity-123' }
    await executor.execute({ type: 'Test', data: {} }, updatingContext)

    expect(receivedContext).toEqual({ phase: 'updating', entityId: 'entity-123' })
  })

  it('returns validation failure for unregistered command type', async () => {
    const executor = createDomainExecutor(registrations)

    const result = await executor.execute({ type: 'UnknownCommand', data: {} }, INITIALIZING)

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

  it('propagates handler validation failures', async () => {
    const executor = createDomainExecutor([
      {
        commandType: 'Validate',
        handler() {
          return domainFailure([{ path: 'name', message: 'name must not be empty' }])
        },
      },
    ])

    const result = await executor.execute({ type: 'Validate', data: {} }, INITIALIZING)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.details).toEqual([{ path: 'name', message: 'name must not be empty' }])
    }
  })

  it('skips validation phases on regeneration', async () => {
    let validateCalled = false
    let validateAsyncCalled = false
    const executor = createDomainExecutor([
      {
        commandType: 'Test',
        validate() {
          validateCalled = true
          return Ok({ validated: true })
        },
        async validateAsync() {
          validateAsyncCalled = true
          return Ok({ asyncValidated: true })
        },
        handler() {
          return domainSuccess([])
        },
      },
    ])

    const updatingContext: HandlerContext = { phase: 'updating', entityId: 'e-1' }
    await executor.execute({ type: 'Test', data: {} }, updatingContext)

    expect(validateCalled).toBe(false)
    expect(validateAsyncCalled).toBe(false)
  })

  it('runs validateAsync and rejects on failure', async () => {
    const executor = createDomainExecutor(
      [
        {
          commandType: 'Test',
          async validateAsync() {
            return Err(
              new ValidationException(undefined, [
                { path: 'name', message: 'Name already exists' },
              ]),
            )
          },
          handler() {
            return domainSuccess([])
          },
        },
      ],
      { queryManager: mockQueryManager },
    )

    const result = await executor.execute({ type: 'Test', data: {} }, INITIALIZING)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.details).toEqual([{ path: 'name', message: 'Name already exists' }])
    }
  })

  it('passes transformed data through validateAsync to handler', async () => {
    let handlerData: unknown
    const executor = createDomainExecutor(
      [
        {
          commandType: 'Test',
          async validateAsync(data) {
            return Ok({ ...(data as object), enriched: true })
          },
          handler(data) {
            handlerData = data
            return domainSuccess([])
          },
        },
      ],
      { queryManager: mockQueryManager },
    )

    await executor.execute({ type: 'Test', data: { original: true } }, INITIALIZING)

    expect(handlerData).toEqual({ original: true, enriched: true })
  })
})
