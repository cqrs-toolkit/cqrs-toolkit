/**
 * Command queue internal types.
 */

import type { Link } from '@meticoeus/ddd-es'
import type { Observable } from 'rxjs'
import type {
  CommandCompletionResult,
  CommandEvent,
  CommandFilter,
  CommandRecord,
  EnqueueAndWaitParams,
  EnqueueAndWaitResult,
  EnqueueParams,
  EnqueueResult,
  WaitOptions,
} from '../../types/commands.js'

/**
 * Command queue interface.
 * Provides form-friendly async patterns for command handling.
 */
export interface ICommandQueue<TLink extends Link> {
  /**
   * Enqueue a command with local validation.
   * Returns immediately with either validation errors or the queued command.
   *
   * For forms: check result.ok to show validation errors immediately.
   *
   * @param command - Command to enqueue
   * @param options - Optional enqueue options
   * @returns Enqueue result with validation status
   */
  enqueue<TData, TEvent>(params: EnqueueParams<TLink, TData>): Promise<EnqueueResult<TEvent>>

  /**
   * Wait for a specific command to reach a terminal state.
   * Returns when command succeeds, fails, or is cancelled.
   *
   * For forms: await this after enqueue() to get server response/errors.
   *
   * @param commandId - ID of command to wait for
   * @param options - Optional wait options (timeout)
   * @returns Completion result
   */
  waitForCompletion(commandId: string, options?: WaitOptions): Promise<CommandCompletionResult>

  /**
   * Convenience: enqueue and wait for completion in one call.
   * Best for simple form submissions.
   *
   * @param command - Command to enqueue
   * @param options - Optional combined options
   * @returns Combined enqueue and completion result
   */
  enqueueAndWait<TData, TEvent, TResponse>(
    params: EnqueueAndWaitParams<TLink, TData>,
  ): Promise<EnqueueAndWaitResult<TResponse>>

  /**
   * Observable of command events for reactive consumers.
   * Emits for all command status changes.
   */
  readonly events$: Observable<CommandEvent>

  /**
   * Observable filtered to a specific command.
   * Useful for tracking a single command's lifecycle.
   *
   * @param commandId - Command ID to filter for
   * @returns Observable of events for that command
   */
  commandEvents$(commandId: string): Observable<CommandEvent>

  /**
   * Get a command by ID.
   *
   * @param commandId - Command ID
   * @returns Command record or undefined
   */
  getCommand(commandId: string): Promise<CommandRecord<TLink> | undefined>

  /**
   * List commands matching a filter.
   *
   * @param filter - Optional filter criteria
   * @returns Matching commands
   */
  listCommands(filter?: CommandFilter): Promise<CommandRecord<TLink>[]>

  /**
   * Cancel a pending command.
   * Cannot cancel commands that are already sending or completed.
   *
   * @param commandId - Command ID to cancel
   */
  cancelCommand(commandId: string): Promise<void>

  /**
   * Retry a failed command.
   *
   * @param commandId - Command ID to retry
   */
  retryCommand(commandId: string): Promise<void>

  /**
   * Process pending commands.
   * Called by the sync manager when network is available.
   */
  processPendingCommands(): Promise<void>

  /**
   * Pause command processing.
   */
  pause(): void

  /**
   * Resume command processing.
   */
  resume(): void

  /**
   * Check if command processing is paused.
   */
  isPaused(): boolean

  /**
   * Get entity IDs that were created or updated by a command's anticipated events.
   *
   * @param commandId - The command ID
   * @param collection - Optional collection filter
   * @returns Entity IDs, or empty if the command has no tracked entries
   */
  getCommandEntities(commandId: string, collection?: string): Promise<string[]>
}

/**
 * HTTP command sender interface.
 * Abstracted for testability and different transport implementations.
 */
export interface ICommandSender<TLink extends Link> {
  /**
   * Send a command to the server.
   *
   * @param command - Command record to send
   * @returns Server response
   * @throws CommandSendError on failure
   */
  send<TData, TResponse>(command: CommandRecord<TLink, TData>): Promise<TResponse>
}

/**
 * Error thrown when command sending fails.
 */
export class CommandSendError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly isRetryable: boolean,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'CommandSendError'
  }
}
