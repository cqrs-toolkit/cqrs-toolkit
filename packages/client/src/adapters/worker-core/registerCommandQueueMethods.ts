/**
 * Registers CommandQueue RPC methods on the worker message handler.
 *
 * Observable methods (events$, commandEvents$) and long-running methods
 * (waitForCompletion, enqueueAndWait) are NOT registered here — they are
 * reconstructed on the main thread from broadcast events.
 */

import type { Link } from '@meticoeus/ddd-es'
import type { IAnticipatedEvent } from '../../core/command-lifecycle/AnticipatedEventShape.js'
import type { CommandQueue } from '../../core/command-queue/CommandQueue.js'
import type { WorkerMessageHandler } from '../../protocol/MessageChannel.js'
import type { CommandFilter, EnqueueCommand, EnqueueOptions } from '../../types/commands.js'

export function registerCommandQueueMethods<
  TLink extends Link,
  TSchema,
  TEvent extends IAnticipatedEvent,
>(handler: WorkerMessageHandler, commandQueue: CommandQueue<TLink, TSchema, TEvent>): void {
  handler.registerMethod('commandQueue.enqueue', async (args) => {
    const command = args[0] as EnqueueCommand
    const options = args[1] as EnqueueOptions | undefined
    return commandQueue.enqueue(command, options)
  })

  handler.registerMethod('commandQueue.getCommand', async (args) => {
    return commandQueue.getCommand(args[0] as string)
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
    commandQueue.pause()
  })

  handler.registerMethod('commandQueue.resume', async () => {
    commandQueue.resume()
  })

  handler.registerMethod('commandQueue.isPaused', async () => {
    return commandQueue.isPaused()
  })

  handler.registerMethod('commandQueue.getCommandEntities', async (args) => {
    return commandQueue.getCommandEntities(args[0] as string, args[1] as string | undefined)
  })
}
