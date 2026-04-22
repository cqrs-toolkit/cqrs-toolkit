/**
 * Registers CommandQueue RPC methods on the worker message handler.
 *
 * Observable methods (events$, commandEvents$) and long-running methods
 * (waitForCompletion, enqueueAndWait) are NOT registered here — they are
 * reconstructed on the main thread from broadcast events.
 */

import { type Link, logProvider } from '@meticoeus/ddd-es'
import type { IAnticipatedEvent } from '../../core/command-lifecycle/AnticipatedEventShape.js'
import type { CommandQueue } from '../../core/command-queue/CommandQueue.js'
import type { EventBus } from '../../core/events/EventBus.js'
import type { WorkerMessageHandler } from '../../protocol/MessageChannel.js'
import { CommandFilter, EnqueueCommand, EnqueueParams } from '../../types/commands.js'

export function registerCommandQueueMethods<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TSchema,
  TEvent extends IAnticipatedEvent,
>(
  handler: WorkerMessageHandler,
  commandQueue: CommandQueue<TLink, TCommand, TSchema, TEvent>,
  eventBus: EventBus<TLink>,
): void {
  handler.registerMethod('commandQueue.enqueue', async (args) => {
    const params = args[0] as EnqueueParams<TLink>
    return commandQueue.enqueue(params)
  })

  handler.registerMethod('commandQueue.getCommand', async (args) => {
    const commandId = args[0] as string
    eventBus.emitDebug('debug:log', { label: 'rpc:getCommand:enter', commandId })
    const result = await commandQueue.getCommand(commandId)
    eventBus.emitDebug('debug:log', {
      label: 'rpc:getCommand:result',
      commandId,
      status: result?.status,
    })
    return result
  })

  handler.registerMethod('commandQueue.listCommands', async (args) => {
    return commandQueue.listCommands(args[0] as CommandFilter | undefined)
  })

  handler.registerMethod('commandQueue.cancelCommand', async (args) => {
    return commandQueue.cancelCommand(args[0] as string)
  })

  handler.registerMethod('commandQueue.retryCommand', async (args) => {
    return commandQueue.retryCommand(args[0] as string)
  })

  handler.registerMethod('commandQueue.processPendingCommands', async () => {
    return commandQueue.processPendingCommands()
  })

  handler.registerMethod('commandQueue.pause', async () => {
    // RPC acknowledges receipt immediately. Settlement is signalled via the
    // 'commandqueue:paused' broadcast; the proxy subscribes before sending
    // this request and awaits that event.
    commandQueue.pause().catch((err) => {
      logProvider.log.error({ err }, 'Command queue pause failed')
    })
  })

  handler.registerMethod('commandQueue.resume', async () => {
    // Same fire-and-forget pattern as pause — settlement arrives via
    // 'commandqueue:resumed' broadcast.
    commandQueue.resume().catch((err) => {
      logProvider.log.error({ err }, 'Command queue resume failed')
    })
  })

  handler.registerMethod('commandQueue.isPaused', async () => {
    return commandQueue.isPaused()
  })

  handler.registerMethod('commandQueue.getCommandEntities', async (args) => {
    return commandQueue.getCommandEntities(args[0] as string, args[1] as string | undefined)
  })
}
