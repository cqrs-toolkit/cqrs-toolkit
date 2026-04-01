import { Err, Ok, ServiceLink, ValidationException } from '@meticoeus/ddd-es'
import { describe, expect, it } from 'vitest'
import { IAnticipatedEvent } from '../core/command-lifecycle/AnticipatedEventShape.js'
import type { IQueryManager } from '../core/query-manager/types.js'
import { EnqueueCommand } from './commands.js'
import type { CommandHandlerRegistration, HandlerContext } from './domain.js'
import { createDomainExecutor, createEntityId, domainFailure, domainSuccess } from './domain.js'

const mockQueryManager = {} as unknown as IQueryManager<ServiceLink>

const INITIALIZING: HandlerContext = { phase: 'initializing' }

describe('createDomainExecutor', () => {
  const registrations: CommandHandlerRegistration<ServiceLink>[] = [
    {
      commandType: 'CreateTodo',
      handler(data, context) {
        const { content } = data as { content: string }
        const id = createEntityId(context)
        return domainSuccess([
          { type: 'TodoCreated', data: { id, content }, streamId: `Todo-${id}` },
        ])
      },
    },
    {
      commandType: 'DeleteTodo',
      handler(_data, context) {
        const { id } = context.path as { id: string }
        return domainSuccess([{ type: 'TodoDeleted', data: { id }, streamId: `Todo-${id}` }])
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
      expect(result.value.anticipatedEvents).toHaveLength(1)
      expect(result.value.anticipatedEvents[0]).toMatchObject({
        type: 'TodoCreated',
        data: { content: 'test' },
      })
    }
  })

  it('passes data and context to handler', async () => {
    let receivedContext: HandlerContext | undefined
    const executor = createDomainExecutor<ServiceLink, EnqueueCommand, unknown, IAnticipatedEvent>([
      {
        commandType: 'Test',
        handler(data, context) {
          receivedContext = context
          const { name } = data as { name: string }
          const id = createEntityId(context)
          return domainSuccess([
            { type: 'TestCreated', data: { id, name }, streamId: `Test-${id}` },
          ])
        },
      },
    ])

    const result = await executor.execute({ type: 'Test', data: { name: 'value' } }, INITIALIZING)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.anticipatedEvents[0]).toMatchObject({
        type: 'TestCreated',
        data: { name: 'value' },
      })
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
          const id = createEntityId(context)
          return domainSuccess([{ type: 'TestUpdated', data: { id }, streamId: `Test-${id}` }])
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
    const duplicates: CommandHandlerRegistration<ServiceLink>[] = [
      {
        commandType: 'CreateTodo',
        handler(_data, context) {
          const id = createEntityId(context)
          return domainSuccess([{ type: 'TodoCreated', data: { id }, streamId: `Todo-${id}` }])
        },
      },
      {
        commandType: 'CreateTodo',
        handler(_data, context) {
          const id = createEntityId(context)
          return domainSuccess([{ type: 'TodoCreated', data: { id }, streamId: `Todo-${id}` }])
        },
      },
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
        handler(_data, context) {
          const id = createEntityId(context)
          return domainSuccess([{ type: 'TestUpdated', data: { id }, streamId: `Test-${id}` }])
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
          handler(_data, context) {
            const id = createEntityId(context)
            return domainSuccess([{ type: 'TestCreated', data: { id }, streamId: `Test-${id}` }])
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
          handler(data, context) {
            handlerData = data
            const id = createEntityId(context)
            return domainSuccess([{ type: 'TestCreated', data: { id }, streamId: `Test-${id}` }])
          },
        },
      ],
      { queryManager: mockQueryManager },
    )

    await executor.execute({ type: 'Test', data: { original: true } }, INITIALIZING)

    expect(handlerData).toEqual({ original: true, enriched: true })
  })

  it('passes command path to validateAsync context', async () => {
    let receivedPath: unknown
    const executor = createDomainExecutor(
      [
        {
          commandType: 'Test',
          async validateAsync(data, context) {
            receivedPath = context.path
            return Ok(data)
          },
          handler(_data, context) {
            const { id } = context.path as { id: string }
            return domainSuccess([{ type: 'TestUpdated', data: { id }, streamId: `Test-${id}` }])
          },
        },
      ],
      { queryManager: mockQueryManager },
    )

    const context: HandlerContext = { phase: 'initializing', path: { id: 'abc-123' } }
    await executor.execute({ type: 'Test', data: { name: 'x' }, path: { id: 'abc-123' } }, context)

    expect(receivedPath).toEqual({ id: 'abc-123' })
  })
})
