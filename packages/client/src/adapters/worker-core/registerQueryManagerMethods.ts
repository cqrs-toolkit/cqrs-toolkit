/**
 * Registers QueryManager RPC methods on the worker message handler.
 *
 * Observable methods (watchCollection, watchById) are NOT registered here —
 * they are reconstructed on the main thread from broadcast events.
 */

import type { QueryManager } from '../../core/query-manager/QueryManager.js'
import type { QueryOptions } from '../../core/query-manager/types.js'
import type { WorkerMessageHandler } from '../../protocol/MessageChannel.js'

export function registerQueryManagerMethods(
  handler: WorkerMessageHandler,
  queryManager: QueryManager,
): void {
  handler.registerMethod('queryManager.getById', async (args) => {
    const collection = args[0] as string
    const id = args[1] as string
    const options = args[2] as QueryOptions | undefined
    return queryManager.getById(collection, id, options)
  })

  handler.registerMethod('queryManager.getByIds', async (args) => {
    const collection = args[0] as string
    const ids = args[1] as string[]
    const options = args[2] as QueryOptions | undefined
    return queryManager.getByIds(collection, ids, options)
  })

  handler.registerMethod('queryManager.list', async (args) => {
    const collection = args[0] as string
    const options = args[1] as QueryOptions | undefined
    return queryManager.list(collection, options)
  })

  handler.registerMethod('queryManager.exists', async (args) => {
    return queryManager.exists(args[0] as string, args[1] as string)
  })

  handler.registerMethod('queryManager.count', async (args) => {
    return queryManager.count(args[0] as string)
  })

  handler.registerMethod('queryManager.touch', async (args) => {
    return queryManager.touch(args[0] as string)
  })

  handler.registerMethod('queryManager.hold', async (args) => {
    return queryManager.hold(args[0] as string)
  })

  handler.registerMethod('queryManager.release', async (args) => {
    return queryManager.release(args[0] as string)
  })

  handler.registerMethod('queryManager.releaseAll', async () => {
    return queryManager.releaseAll()
  })
}
