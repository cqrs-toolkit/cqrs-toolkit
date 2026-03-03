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
export function createTestCommand<TPayload = unknown, TResponse = unknown>(
  overrides: Partial<CommandRecord<TPayload, TResponse>> = {},
): CommandRecord<TPayload, TResponse> {
  const now = Date.now()
  return {
    commandId: generateId(),
    service: 'test-service',
    type: 'TestCommand',
    payload: {} as TPayload,
    status: 'pending' as CommandStatus,
    dependsOn: [],
    blockedBy: [],
    attempts: 0,
    anticipatedEventIds: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

/**
 * Create a pending command.
 */
export function createPendingCommand<TPayload = unknown>(
  overrides: Partial<CommandRecord<TPayload>> = {},
): CommandRecord<TPayload> {
  return createTestCommand({ status: 'pending', ...overrides })
}

/**
 * Create a sending command.
 */
export function createSendingCommand<TPayload = unknown>(
  overrides: Partial<CommandRecord<TPayload>> = {},
): CommandRecord<TPayload> {
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
export function createSucceededCommand<TPayload = unknown, TResponse = unknown>(
  response: TResponse,
  overrides: Partial<CommandRecord<TPayload, TResponse>> = {},
): CommandRecord<TPayload, TResponse> {
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
export function createFailedCommand<TPayload = unknown>(
  error: CommandRecord['error'],
  overrides: Partial<CommandRecord<TPayload>> = {},
): CommandRecord<TPayload> {
  return createTestCommand({
    status: 'failed',
    attempts: 1,
    lastAttemptAt: Date.now(),
    error,
    ...overrides,
  })
}
