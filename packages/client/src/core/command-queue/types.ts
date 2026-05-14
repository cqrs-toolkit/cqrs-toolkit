/**
 * Command queue internal types.
 */

import { Exception, type Link, type Result } from '@meticoeus/ddd-es'
import type { Observable } from 'rxjs'
import {
  CommandCompletionError,
  CommandEvent,
  CommandFilter,
  CommandNotFoundException,
  CommandRecord,
  EnqueueAndWaitParams,
  EnqueueAndWaitResult,
  EnqueueCommand,
  EnqueueParams,
  EnqueueResult,
  InvalidCommandStatusException,
  type SendableCommandRecord,
  type ServerErrorResponse,
  WaitOptions,
} from '../../types/commands.js'
import { EntityId } from '../../types/index.js'
import type { IAnticipatedEvent } from '../command-lifecycle/AnticipatedEventShape.js'

/**
 * Command queue interface.
 * Provides form-friendly async patterns for command handling.
 */
export interface ICommandQueue<TLink extends Link, TCommand extends EnqueueCommand> {
  /**
   * Enqueue a command with local validation.
   * Returns immediately with either validation errors or the queued command.
   *
   * For forms: check result.ok to show validation errors immediately.
   *
   * @returns Enqueue result with validation status
   */
  enqueue<TData, TEvent extends IAnticipatedEvent>(
    params: EnqueueParams<TLink, TData>,
  ): Promise<EnqueueResult<TEvent>>

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
  waitForSucceeded(
    commandId: string,
    options?: WaitOptions,
  ): Promise<Result<unknown, CommandCompletionError>>

  /**
   * Wait for a command to reach {@link CommandStatus} `'applied'` — the
   * post-terminal state after the sync pipeline has reflected the command's
   * response events in the read model. Resolves early with the error result
   * if the command reaches `'failed'` / `'cancelled'` before `'applied'`.
   *
   * Use this when a caller needs "read model current for this command's
   * events" semantics (e.g. CRUD form save that unlocks only after the
   * effect is durably reflected).
   */
  waitForApplied(
    commandId: string,
    options?: WaitOptions,
  ): Promise<Result<unknown, CommandCompletionError>>

  /**
   * Convenience: enqueue and wait for completion in one call.
   * Best for simple form submissions.
   *
   * Set `params.waitFor` to choose the terminal: `'applied'` (default — the
   * sync pipeline has reflected the command's events in the read model) or
   * `'succeeded'` (earlier resolve at server acknowledgement, before the
   * read-model drain completes).
   *
   * @returns Combined enqueue and completion result
   */
  enqueueAndWait<TData, TEvent extends IAnticipatedEvent, TResponse>(
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
  getCommand(commandId: string): Promise<CommandRecord<TLink, TCommand> | undefined>

  /**
   * List commands matching a filter.
   *
   * @param filter - Optional filter criteria
   * @returns Matching commands
   */
  listCommands(filter?: CommandFilter): Promise<CommandRecord<TLink, TCommand>[]>

  /**
   * Cancel a pending command.
   * Cannot cancel commands that are already sending or completed.
   *
   * @param commandId - Command ID to cancel
   */
  cancelCommand(
    commandId: string,
  ): Promise<Result<void, CommandNotFoundException | InvalidCommandStatusException>>

  /**
   * Retry a failed command.
   *
   * @param commandId - Command ID to retry
   */
  retryCommand(
    commandId: string,
  ): Promise<Result<void, CommandNotFoundException | InvalidCommandStatusException>>

  /**
   * Process pending commands.
   * Called by the sync manager when network is available.
   */
  processPendingCommands(): Promise<void>

  /**
   * Pause command processing.
   * Resolves after any in-flight command finishes; callers who only want
   * the flag flipped can simply not await.
   */
  pause(): Promise<void>

  /**
   * Resume command processing and drain any pending commands.
   * Resolves after the drain completes; callers who want fire-and-forget
   * can simply not await.
   */
  resume(): Promise<void>

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
 * Internal command queue interface.
 *
 * Extends the public {@link ICommandQueue} with lifecycle methods used by
 * internal callers (SyncManager, createCqrsClient) that run in the same
 * thread as the CommandQueue.
 *
 * Not exposed to consumers — the public API is always {@link ICommandQueue}.
 */
export interface ICommandQueueInternal<
  TLink extends Link,
  TCommand extends EnqueueCommand,
> extends ICommandQueue<TLink, TCommand> {
  /** Clear all command state for session destroy. Pauses processing, clears timers, deletes all commands. */
  clearAll(): Promise<void>

  /** Destroy the command queue and release resources. */
  destroy(): Promise<void>

  /**
   * Synchronous in-memory lookup for a client→server ID mapping.
   * Checks the aggregate chain for a completed create command.
   * Used by CacheManager to detect already-settled commands during registration.
   *
   * @returns The server ID if the client ID has been reconciled, undefined otherwise.
   */
  getIdMapping(clientId: EntityId): { serverId: string } | undefined

  /**
   * Derive the primary entity ID for a command — `data.id` for mutate commands,
   * the resolved create entity id (from the aggregate chain) for create commands.
   * Used by reconciliation to key commands against per-entity dirty sets.
   *
   * @returns The entity ID as a plain string, or undefined if it cannot be resolved.
   */
  getEntityIdForCommand(command: CommandRecord<TLink, TCommand>): string | undefined
}

/**
 * HTTP command sender interface.
 * Abstracted for testability and different transport implementations.
 *
 * Receives the wire-shaped {@link SendableCommandRecord}: identical to
 * {@link CommandRecord} except `headers` is `Record<string, string>` —
 * the library resolves declared {@link EntityRef} headers via the cascade
 * before invoking the sender, so transports never have to flatten.
 */
export interface ICommandSender<TLink extends Link, TCommand extends EnqueueCommand> {
  /**
   * Send a command to the server.
   *
   * @param command - Command record to send
   * @returns Result with server response or CommandSendException on expected failure
   */
  send<TResponse>(
    command: SendableCommandRecord<TLink, TCommand, TResponse>,
  ): Promise<Result<TResponse, CommandSendException>>
}

/**
 * Expected domain failure from command sending.
 * Returned via Result, never thrown.
 *
 * Carries the parsed {@link ServerErrorResponse} when the failure was a
 * server response (HTTP error status); absent for transport-level errors
 * where there is no response (network failure, fetch threw). The queue uses
 * `response` to drive its pluggable failure-mapping pipeline when present;
 * for transport errors it falls back to `isRetryable` (defaults to `false`).
 *
 * The exception itself does **not** carry a `FailureCategory` — categorization
 * happens at the queue, where per-command and global `mapFailure` overrides
 * compose with the library's default mappers (see `0004 §4.8.3`). Consumers
 * reading the persisted `error?: IException` on a `CommandRecord` get a
 * `CommandFailedException` with `category` populated.
 */
export class CommandSendException extends Exception<{
  errorCode?: string
  isRetryable: boolean
  response?: ServerErrorResponse
  details?: unknown
}> {
  readonly errorCode?: string
  readonly isRetryable: boolean
  readonly response?: ServerErrorResponse

  constructor(args: {
    message: string
    errorCode?: string
    /** Only consulted when `response` is undefined (transport-level errors). Defaults to false. */
    isRetryable?: boolean
    response?: ServerErrorResponse
    details?: unknown
  }) {
    super('CommandSendException', args.message)
    this.errorCode = args.errorCode
    this.isRetryable = args.isRetryable ?? false
    this.response = args.response
    this._details = {
      errorCode: args.errorCode,
      isRetryable: this.isRetryable,
      response: args.response,
      details: args.details,
    }
  }
}
