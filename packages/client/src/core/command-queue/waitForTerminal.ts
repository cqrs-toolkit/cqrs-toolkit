/**
 * Shared terminal-wait helpers for CommandQueue and CommandQueueProxy.
 *
 * Both sides expose `getCommand` and `commandEvents$` on {@link ICommandQueue};
 * the wait logic (race + timeout + terminal filter + result mapping) is
 * otherwise identical. Extracting it here collapses what was triple-duplicated
 * scaffolding into one implementation that both sides invoke as a one-liner.
 *
 * Events are treated as signals only — when a terminal event fires, the
 * helper looks up the command record via {@link CommandEventSource.getCommand}
 * and derives the result from authoritative state. Core-side the lookup is a
 * Map read; proxy-side it is an RPC. This keeps response payloads off the
 * broadcast envelope and avoids inconsistencies between the pre-subscription
 * early-state check and the post-event race path.
 */

import { assert } from '#utils'
import { Err, type Link, Ok, type Result } from '@meticoeus/ddd-es'
import { filter, from, map, type Observable, race, switchMap, timer } from 'rxjs'
import {
  CommandCancelledException,
  type CommandCompletionError,
  type CommandEvent,
  CommandFailedException,
  type CommandRecord,
  CommandTimeoutException,
  type EnqueueCommand,
  isCommandFailed,
  isTerminalCommandEvent,
  type WaitOptions,
} from '../../types/commands.js'

const DEFAULT_WAIT_TIMEOUT = 30000

/**
 * Narrow view of {@link ICommandQueue} needed by the wait helpers.
 * Both `CommandQueue` and `CommandQueueProxy` satisfy this structurally — the
 * helpers accept `this` from either side without wrapping.
 */
export interface CommandEventSource<TLink extends Link, TCommand extends EnqueueCommand> {
  getCommand(commandId: string): Promise<CommandRecord<TLink, TCommand> | undefined>
  commandEvents$(commandId: string): Observable<CommandEvent>
}

/**
 * Translate a command record in a terminal state into a completion result.
 * `succeeded` / `applied` → {@link Ok} with the server response;
 * `failed` / `cancelled` → {@link Err} with the relevant exception.
 * Asserts on any non-terminal status.
 */
export function toCompletionResult<TLink extends Link, TCommand extends EnqueueCommand>(
  command: CommandRecord<TLink, TCommand>,
): Result<unknown, CommandCompletionError> {
  switch (command.status) {
    case 'succeeded':
    case 'applied':
      return Ok(command.serverResponse)
    case 'failed': {
      const error = command.error
      if (isCommandFailed(error)) return Err(error)
      return Err(new CommandFailedException('server', error?.message ?? 'Unknown error'))
    }
    case 'cancelled':
      return Err(new CommandCancelledException())
    default:
      assert(false, `Unexpected terminal status: ${command.status}`)
  }
}

/**
 * Wait for a command to reach a terminal state, with timeout.
 *
 * - `'succeeded'` — resolves at the first `completed` / `failed` / `cancelled`
 *   {@link CommandEvent} (server acknowledgement).
 * - `'applied'` — resolves when the pipeline flips the command to
 *   `'applied'` (read model has reflected the command's events), OR early
 *   with the error result if the command hits a non-success terminal state
 *   (`failed` / `cancelled`) before reaching applied.
 *
 * Subscribes eagerly before the async state check so no event is missed
 * between the caller's enqueue and the subscription opening.
 */
export async function waitForTerminal<TLink extends Link, TCommand extends EnqueueCommand>(
  source: CommandEventSource<TLink, TCommand>,
  commandId: string,
  terminal: 'succeeded' | 'applied',
  options?: WaitOptions,
): Promise<Result<unknown, CommandCompletionError>> {
  const timeout = options?.timeout ?? DEFAULT_WAIT_TIMEOUT

  let resolveCompletion: (value: Result<unknown, CommandCompletionError>) => void
  const completionPromise = new Promise<Result<unknown, CommandCompletionError>>((resolve) => {
    resolveCompletion = resolve
  })

  const eventFilter =
    terminal === 'succeeded'
      ? isTerminalCommandEvent
      : (event: CommandEvent): boolean => {
          if (event.eventType === 'status-changed' && event.status === 'applied') return true
          if (event.eventType === 'failed' || event.eventType === 'cancelled') return true
          return false
        }

  const subscription = race(
    source.commandEvents$(commandId).pipe(
      filter(eventFilter),
      switchMap(() => from(source.getCommand(commandId))),
      map(
        (command): Result<unknown, CommandCompletionError> =>
          command
            ? toCompletionResult(command)
            : Err(new CommandFailedException('local', `Command not found: ${commandId}`)),
      ),
    ),
    timer(timeout).pipe(
      map((): Result<unknown, CommandCompletionError> => Err(new CommandTimeoutException())),
    ),
  ).subscribe((result) => {
    resolveCompletion(result)
  })

  const command = await source.getCommand(commandId)
  if (!command) {
    subscription.unsubscribe()
    return Err(new CommandFailedException('local', `Command not found: ${commandId}`))
  }

  if (terminal === 'succeeded') {
    if (
      command.status === 'succeeded' ||
      command.status === 'applied' ||
      command.status === 'failed' ||
      command.status === 'cancelled'
    ) {
      subscription.unsubscribe()
      return toCompletionResult(command)
    }
  } else {
    if (
      command.status === 'applied' ||
      command.status === 'failed' ||
      command.status === 'cancelled'
    ) {
      subscription.unsubscribe()
      return toCompletionResult(command)
    }
  }

  const result = await completionPromise
  subscription.unsubscribe()
  return result
}
