/**
 * Command test factories.
 */

import { Link } from '@meticoeus/ddd-es'
import { deriveScopeKey } from '../../core/cache-manager/index.js'
import type { CommandRecord, CommandStatus } from '../../types/commands.js'
import { generateId } from '../../utils/uuid.js'

/**
 * Create a test command record.
 *
 * @param overrides - Optional field overrides
 * @returns Command record
 */
export function createTestCommand<TLink extends Link, TData = unknown, TResponse = unknown>(
  overrides: Partial<CommandRecord<TLink, TData, TResponse>> = {},
): CommandRecord<TLink, TData, TResponse> {
  const now = Date.now()
  return {
    commandId: generateId(),
    cacheKey: deriveScopeKey({ scopeType: 'tests' }),
    service: 'test-service',
    type: 'TestCommand',
    data: {} as TData,
    status: 'pending' as CommandStatus,
    dependsOn: [],
    blockedBy: [],
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

/**
 * Create a pending command.
 */
export function createPendingCommand<TLink extends Link, TData = unknown>(
  overrides: Partial<CommandRecord<TLink, TData>> = {},
): CommandRecord<TLink, TData> {
  return createTestCommand({ status: 'pending', ...overrides })
}

/**
 * Create a sending command.
 */
export function createSendingCommand<TLink extends Link, TData = unknown>(
  overrides: Partial<CommandRecord<TLink, TData>> = {},
): CommandRecord<TLink, TData> {
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
export function createSucceededCommand<TLink extends Link, TData = unknown, TResponse = unknown>(
  response: TResponse,
  overrides: Partial<CommandRecord<TLink, TData, TResponse>> = {},
): CommandRecord<TLink, TData, TResponse> {
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
export function createFailedCommand<TLink extends Link, TData = unknown>(
  error: CommandRecord<TLink>['error'],
  overrides: Partial<CommandRecord<TLink, TData>> = {},
): CommandRecord<TLink, TData> {
  return createTestCommand({
    status: 'failed',
    attempts: 1,
    lastAttemptAt: Date.now(),
    error,
    ...overrides,
  })
}
