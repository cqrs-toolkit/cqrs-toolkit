/**
 * Command test factories.
 */

import type { CommandRecord, CommandStatus } from '../../types/commands.js'
import { generateId } from '../../utils/uuid.js'

/**
 * Create a test command record.
 *
 * @param overrides - Optional field overrides
 * @returns Command record
 */
export function createTestCommand<TData = unknown, TResponse = unknown>(
  overrides: Partial<CommandRecord<TData, TResponse>> = {},
): CommandRecord<TData, TResponse> {
  const now = Date.now()
  return {
    commandId: generateId(),
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
export function createPendingCommand<TData = unknown>(
  overrides: Partial<CommandRecord<TData>> = {},
): CommandRecord<TData> {
  return createTestCommand({ status: 'pending', ...overrides })
}

/**
 * Create a sending command.
 */
export function createSendingCommand<TData = unknown>(
  overrides: Partial<CommandRecord<TData>> = {},
): CommandRecord<TData> {
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
export function createSucceededCommand<TData = unknown, TResponse = unknown>(
  response: TResponse,
  overrides: Partial<CommandRecord<TData, TResponse>> = {},
): CommandRecord<TData, TResponse> {
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
export function createFailedCommand<TData = unknown>(
  error: CommandRecord['error'],
  overrides: Partial<CommandRecord<TData>> = {},
): CommandRecord<TData> {
  return createTestCommand({
    status: 'failed',
    attempts: 1,
    lastAttemptAt: Date.now(),
    error,
    ...overrides,
  })
}
