/**
 * Registers QueryManager RPC methods on the worker message handler.
 *
 * Observable methods (watchCollection, watchById) are NOT registered here —
 * they are reconstructed on the main thread from broadcast events.
 */

import type { Link } from '@meticoeus/ddd-es'
import type { CacheKeyIdentity } from '../../core/cache-manager/CacheKey.js'
import type { QueryManager } from '../../core/query-manager/QueryManager.js'
import type { GetByIdParams, GetByIdsParams, ListParams } from '../../core/query-manager/types.js'
import type { WorkerMessageHandler } from '../../protocol/MessageChannel.js'
import { EnqueueCommand } from '../../types/index.js'

export function registerQueryManagerMethods<TLink extends Link, TCommand extends EnqueueCommand>(
  handler: WorkerMessageHandler,
  queryManager: QueryManager<TLink, TCommand>,
): void {
  handler.registerMethod('queryManager.getById', async (args) => {
    return queryManager.getById(args[0] as GetByIdParams<TLink>)
  })

  handler.registerMethod('queryManager.getByIds', async (args) => {
    return queryManager.getByIds(args[0] as GetByIdsParams<TLink>)
  })

  handler.registerMethod('queryManager.list', async (args) => {
    return queryManager.list(args[0] as ListParams<TLink>)
  })

  handler.registerMethod('queryManager.exists', async (args) => {
    return queryManager.exists(args[0] as string, args[1] as string)
  })

  handler.registerMethod('queryManager.count', async (args) => {
    return queryManager.count(args[0] as string)
  })

  handler.registerMethod('queryManager.touch', async (args) => {
    return queryManager.touch(args[0] as CacheKeyIdentity<TLink>)
  })

  handler.registerMethod('queryManager.holdForWindow', async (args) => {
    return queryManager.holdForWindow(args[0] as string, args[1] as string)
  })

  handler.registerMethod('queryManager.releaseForWindow', async (args) => {
    return queryManager.releaseForWindow(args[0] as string, args[1] as string)
  })

  handler.registerMethod('queryManager.releaseAllForWindow', async (args) => {
    return queryManager.releaseAllForWindow(args[0] as string)
  })
}
