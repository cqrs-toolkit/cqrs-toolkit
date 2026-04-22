import { Err, Ok, ServiceLink } from '@meticoeus/ddd-es'
import { describe, expect, it } from 'vitest'
import type { IAnticipatedEvent } from '../core/command-lifecycle/AnticipatedEventShape.js'
import type { IQueryManager } from '../core/query-manager/types.js'
import { ItemAggregate, TodoAggregate } from '../testing/aggregates.js'
import type { EnqueueCommand } from './commands.js'
import type { CommandHandlerRegistration, HandlerContext } from './domain.js'
import {
  createDomainExecutor,
  createEntityId,
  domainFailure,
  domainSuccess,
  isUnknownCommand,
} from './domain.js'
import { isValidationException, ValidationException } from './validation.js'

// ---------------------------------------------------------------------------
// Test command types
// ---------------------------------------------------------------------------

type CreateTodo = EnqueueCommand<{ content: string }> & { type: 'CreateTodo' }
type DeleteTodo = EnqueueCommand & { type: 'DeleteTodo'; path: { id: string } }
type CreateNamed = EnqueueCommand<{ name: string }> & { type: 'CreateNamed' }
type UpdateEntity = EnqueueCommand & { type: 'UpdateEntity'; path: { id: string } }
type ValidateOnly = EnqueueCommand & { type: 'ValidateOnly' }
type EnrichData = EnqueueCommand<{ original: boolean }> & { type: 'EnrichData' }

type TestCommand = CreateTodo | DeleteTodo | CreateNamed | UpdateEntity | ValidateOnly | EnrichData

type TestRegistration = CommandHandlerRegistration<ServiceLink, TestCommand>

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const mockQueryManager = {} as unknown as IQueryManager<ServiceLink>

const INITIALIZING: HandlerContext = { phase: 'initializing', commandId: 'test-cmd' }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createDomainExecutor', () => {
  const registrations: TestRegistration[] = [
    {
      commandType: 'CreateTodo',
      aggregate: TodoAggregate,
      commandIdReferences: [],
      handler(command, _state, context) {
        const id = createEntityId(context)
        return domainSuccess([
          {
            type: 'TodoCreated',
            data: { id, content: command.data.content },
            streamId: `Todo-${id}`,
          },
        ])
      },
    },
    {
      commandType: 'DeleteTodo',
      aggregate: TodoAggregate,
      commandIdReferences: [{ aggregate: TodoAggregate, path: '$.path.id' }],
      handler(command, _state, _context) {
        const { id } = command.path as { id: string }
        return domainSuccess([{ type: 'TodoDeleted', data: { id }, streamId: `Todo-${id}` }])
      },
    },
  ]

  it('dispatches to the correct handler by command type', () => {
    const executor = createDomainExecutor(registrations)

    const result = executor.handle(
      { type: 'CreateTodo', data: { content: 'test' } },
      undefined,
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

  it('passes data and context to handler', () => {
    let receivedContext: HandlerContext | undefined
    const executor = createDomainExecutor<ServiceLink, TestCommand, unknown, IAnticipatedEvent>([
      {
        commandType: 'CreateNamed',
        aggregate: ItemAggregate,
        commandIdReferences: [],
        handler(command, _state, context) {
          receivedContext = context
          const id = createEntityId(context)
          return domainSuccess([
            {
              type: 'NamedCreated',
              data: { id, name: command.data.name },
              streamId: `Named-${id}`,
            },
          ])
        },
      },
    ])

    const result = executor.handle(
      { type: 'CreateNamed', data: { name: 'value' } },
      undefined,
      INITIALIZING,
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.anticipatedEvents[0]).toMatchObject({
        type: 'NamedCreated',
        data: { name: 'value' },
      })
    }
    expect(receivedContext).toEqual(INITIALIZING)
  })

  it('passes updating context with entityId to handler', () => {
    let receivedContext: HandlerContext | undefined
    const executor = createDomainExecutor<ServiceLink, TestCommand, unknown, IAnticipatedEvent>([
      {
        commandType: 'UpdateEntity',
        aggregate: ItemAggregate,
        commandIdReferences: [{ aggregate: ItemAggregate, path: '$.data.id' }],
        handler(_command, _state, context) {
          receivedContext = context
          const id = createEntityId(context)
          return domainSuccess([{ type: 'EntityUpdated', data: { id }, streamId: `Entity-${id}` }])
        },
      },
    ])

    const updatingContext: HandlerContext = {
      phase: 'updating',
      entityId: 'entity-123',
      commandId: 'test-cmd',
    }
    executor.handle({ type: 'UpdateEntity', data: {} }, undefined, updatingContext)

    expect(receivedContext).toEqual({
      phase: 'updating',
      entityId: 'entity-123',
      commandId: 'test-cmd',
    })
  })

  it('returns UnknownCommandException for unregistered command type', async () => {
    const executor = createDomainExecutor(registrations)

    const result = await executor.validate({ type: 'UnknownCommand', data: {} }, undefined)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(isUnknownCommand(result.error)).toBe(true)
      expect(result.error.message).toBe('Unknown command type: UnknownCommand')
    }
  })

  it('asserts on duplicate command type registration', () => {
    const duplicates: TestRegistration[] = [
      {
        commandType: 'CreateTodo',
        aggregate: TodoAggregate,
        commandIdReferences: [],
        handler(_command, _state, context) {
          const id = createEntityId(context)
          return domainSuccess([{ type: 'TodoCreated', data: { id }, streamId: `Todo-${id}` }])
        },
      },
      {
        commandType: 'CreateTodo',
        aggregate: TodoAggregate,
        commandIdReferences: [],
        handler(_command, _state, context) {
          const id = createEntityId(context)
          return domainSuccess([{ type: 'TodoCreated', data: { id }, streamId: `Todo-${id}` }])
        },
      },
    ]

    expect(() => createDomainExecutor(duplicates)).toThrow(
      'Duplicate command handler registration for "CreateTodo"',
    )
  })

  it('propagates handler validation failures', () => {
    const executor = createDomainExecutor<ServiceLink, TestCommand, unknown, IAnticipatedEvent>([
      {
        commandType: 'ValidateOnly',
        aggregate: ItemAggregate,
        commandIdReferences: [],
        handler() {
          return domainFailure([
            { path: 'name', code: 'required', message: 'name must not be empty', params: {} },
          ])
        },
      },
    ])

    const result = executor.handle({ type: 'ValidateOnly', data: {} }, undefined, INITIALIZING)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(isValidationException(result.error)).toBe(true)
      if (!isValidationException(result.error)) return
      expect(result.error.details).toEqual([
        { path: 'name', code: 'required', message: 'name must not be empty', params: {} },
      ])
    }
  })

  it('skips validation phases when only handle() is called', () => {
    let validateCalled = false
    let validateAsyncCalled = false
    const executor = createDomainExecutor<ServiceLink, TestCommand, unknown, IAnticipatedEvent>(
      [
        {
          commandType: 'UpdateEntity',
          aggregate: ItemAggregate,
          commandIdReferences: [{ aggregate: ItemAggregate, path: '$.data.id' }],
          validate() {
            validateCalled = true
            return Ok({ validated: true })
          },
          async validateAsync() {
            validateAsyncCalled = true
            return Ok({ asyncValidated: true })
          },
          handler(_command, _state, context) {
            const id = createEntityId(context)
            return domainSuccess([
              { type: 'EntityUpdated', data: { id }, streamId: `Entity-${id}` },
            ])
          },
        },
      ],
      { queryManager: mockQueryManager },
    )

    const updatingContext: HandlerContext = {
      phase: 'updating',
      entityId: 'e-1',
      commandId: 'test-cmd',
    }
    executor.handle({ type: 'UpdateEntity', data: {} }, undefined, updatingContext)

    expect(validateCalled).toBe(false)
    expect(validateAsyncCalled).toBe(false)
  })

  it('runs validateAsync and rejects on failure', async () => {
    const executor = createDomainExecutor<ServiceLink, TestCommand, unknown, IAnticipatedEvent>(
      [
        {
          commandType: 'CreateNamed',
          aggregate: ItemAggregate,
          commandIdReferences: [],
          async validateAsync() {
            return Err(
              new ValidationException([
                { path: 'name', code: 'duplicate', message: 'Name already exists', params: {} },
              ]),
            )
          },
          handler(command, _state, context) {
            const id = createEntityId(context)
            return domainSuccess([
              {
                type: 'NamedCreated',
                data: { id, name: command.data.name },
                streamId: `Named-${id}`,
              },
            ])
          },
        },
      ],
      { queryManager: mockQueryManager },
    )

    const result = await executor.validate({ type: 'CreateNamed', data: { name: 'x' } }, undefined)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(isValidationException(result.error)).toBe(true)
      if (!isValidationException(result.error)) return
      expect(result.error.details).toEqual([
        { path: 'name', code: 'duplicate', message: 'Name already exists', params: {} },
      ])
    }
  })

  it('passes transformed data through validateAsync to handler', async () => {
    let handlerData: unknown
    const executor = createDomainExecutor<ServiceLink, TestCommand, unknown, IAnticipatedEvent>(
      [
        {
          commandType: 'EnrichData',
          aggregate: ItemAggregate,
          commandIdReferences: [],
          async validateAsync(command) {
            return Ok({ ...command.data, enriched: true })
          },
          handler(command, _state, context) {
            handlerData = command.data
            const id = createEntityId(context)
            return domainSuccess([
              {
                type: 'DataEnriched',
                data: { id, original: command.data.original },
                streamId: `Enrich-${id}`,
              },
            ])
          },
        },
      ],
      { queryManager: mockQueryManager },
    )

    const command = { type: 'EnrichData', data: { original: true } } as const
    const validateResult = await executor.validate(command, undefined)
    expect(validateResult.ok).toBe(true)
    if (!validateResult.ok) return

    executor.handle({ ...command, data: validateResult.value }, undefined, INITIALIZING)

    expect(handlerData).toEqual({ original: true, enriched: true })
  })

  it('passes command path to validateAsync context', async () => {
    let receivedPath: unknown
    const executor = createDomainExecutor<ServiceLink, TestCommand, unknown, IAnticipatedEvent>(
      [
        {
          commandType: 'UpdateEntity',
          aggregate: ItemAggregate,
          commandIdReferences: [{ aggregate: ItemAggregate, path: '$.path.id' }],
          async validateAsync(command) {
            receivedPath = command.path
            return Ok(command.data)
          },
          handler(command, _state, _context) {
            const { id } = command.path as { id: string }
            return domainSuccess([
              { type: 'EntityUpdated', data: { id }, streamId: `Entity-${id}` },
            ])
          },
        },
      ],
      { queryManager: mockQueryManager },
    )

    await executor.validate({ type: 'UpdateEntity', data: {}, path: { id: 'abc-123' } }, undefined)

    expect(receivedPath).toEqual({ id: 'abc-123' })
  })
})

// ---------------------------------------------------------------------------
// commandIdReferences path validation
// ---------------------------------------------------------------------------

function registrationWithPaths(
  ...paths: string[]
): CommandHandlerRegistration<ServiceLink, TestCommand> {
  return {
    commandType: 'CreateTodo',
    aggregate: TodoAggregate,
    handler: (_cmd, _state, ctx) => {
      const id = createEntityId(ctx)
      return domainSuccess([{ type: 'TodoCreated', data: { id }, streamId: `Todo-${id}` }])
    },
    commandIdReferences: paths.map((path) => ({ aggregate: TodoAggregate, path })),
  }
}

describe('commandIdReferences path validation', () => {
  it('accepts $.data.* paths', () => {
    expect(() =>
      createDomainExecutor<ServiceLink, TestCommand, unknown, IAnticipatedEvent>(
        [registrationWithPaths('$.data.notebookId')],
        { queryManager: mockQueryManager },
      ),
    ).not.toThrow()
  })

  it('accepts $.path.* paths', () => {
    expect(() =>
      createDomainExecutor<ServiceLink, TestCommand, unknown, IAnticipatedEvent>(
        [registrationWithPaths('$.path.id')],
        { queryManager: mockQueryManager },
      ),
    ).not.toThrow()
  })

  it('accepts bracket form $["data"].x', () => {
    expect(() =>
      createDomainExecutor<ServiceLink, TestCommand, unknown, IAnticipatedEvent>(
        [registrationWithPaths('$["data"].x')],
        { queryManager: mockQueryManager },
      ),
    ).not.toThrow()
  })

  it('accepts wildcard-after-root $.data[*].id', () => {
    expect(() =>
      createDomainExecutor<ServiceLink, TestCommand, unknown, IAnticipatedEvent>(
        [registrationWithPaths('$.data[*].id')],
        { queryManager: mockQueryManager },
      ),
    ).not.toThrow()
  })

  it('rejects unrooted $.notebookId', () => {
    expect(() =>
      createDomainExecutor<ServiceLink, TestCommand, unknown, IAnticipatedEvent>(
        [registrationWithPaths('$.notebookId')],
        { queryManager: mockQueryManager },
      ),
    ).toThrow(/root segment must be "data" or "path"/)
  })

  it('rejects unknown root $.foo.bar', () => {
    expect(() =>
      createDomainExecutor<ServiceLink, TestCommand, unknown, IAnticipatedEvent>(
        [registrationWithPaths('$.foo.bar')],
        { queryManager: mockQueryManager },
      ),
    ).toThrow(/root segment must be "data" or "path"/)
  })

  it('includes command type in error message', () => {
    expect(() =>
      createDomainExecutor<ServiceLink, TestCommand, unknown, IAnticipatedEvent>(
        [registrationWithPaths('$.notebookId')],
        { queryManager: mockQueryManager },
      ),
    ).toThrow(/Command "CreateTodo"/)
  })

  it('validates all paths in a registration', () => {
    expect(() =>
      createDomainExecutor<ServiceLink, TestCommand, unknown, IAnticipatedEvent>(
        [registrationWithPaths('$.data.ok', '$.bad')],
        { queryManager: mockQueryManager },
      ),
    ).toThrow(/root segment must be "data" or "path"/)
  })
})
