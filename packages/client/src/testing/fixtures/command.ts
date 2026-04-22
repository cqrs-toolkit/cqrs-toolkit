/**
 * Command test fixtures.
 */

import { generateId } from '#utils'
import { Link } from '@meticoeus/ddd-es'
import { deriveScopeKey } from '../../core/cache-manager/index.js'
import { CommandRecord, CommandStatus, EnqueueCommand } from '../../types/commands.js'

/**
 * Create a test command record.
 *
 * @param overrides - Optional field overrides
 * @returns Command record
 */
export function createTestCommand<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TResponse = unknown,
>(
  overrides: Partial<CommandRecord<TLink, TCommand, TResponse>> = {},
): CommandRecord<TLink, TCommand, TResponse> {
  const now = Date.now()
  return {
    commandId: generateId(),
    cacheKey: deriveScopeKey({ scopeType: 'tests' }),
    service: 'test-service',
    type: 'TestCommand',
    data: {} as TCommand['data'],
    status: 'pending' as CommandStatus,
    dependsOn: [],
    blockedBy: [],
    attempts: 0,
    seq: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

/**
 * Create a pending command.
 */
export function createPendingCommand<TLink extends Link, TCommand extends EnqueueCommand>(
  overrides: Partial<CommandRecord<TLink, TCommand>> = {},
): CommandRecord<TLink, TCommand> {
  return createTestCommand({ status: 'pending', ...overrides })
}

/**
 * Create a sending command.
 */
export function createSendingCommand<TLink extends Link, TCommand extends EnqueueCommand>(
  overrides: Partial<CommandRecord<TLink, TCommand>> = {},
): CommandRecord<TLink, TCommand> {
  return createTestCommand({
    status: 'sending',
    attempts: 1,
    lastAttemptAt: Date.now(),
    ...overrides,
  })
}

/**
 * Create a succeeded command.
 */
export function createSucceededCommand<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TResponse = unknown,
>(
  response: TResponse,
  overrides: Partial<CommandRecord<TLink, TCommand, TResponse>> = {},
): CommandRecord<TLink, TCommand, TResponse> {
  return createTestCommand({
    status: 'succeeded',
    attempts: 1,
    lastAttemptAt: Date.now(),
    serverResponse: response,
    ...overrides,
  })
}

/**
 * Create a failed command.
 */
export function createFailedCommand<TLink extends Link, TCommand extends EnqueueCommand>(
  error: CommandRecord<TLink, TCommand>['error'],
  overrides: Partial<CommandRecord<TLink, TCommand>> = {},
): CommandRecord<TLink, TCommand> {
  return createTestCommand({
    status: 'failed',
    attempts: 1,
    lastAttemptAt: Date.now(),
    error,
    ...overrides,
  })
}
