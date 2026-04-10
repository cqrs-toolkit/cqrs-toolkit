/**
 * Registers CacheManager RPC methods on the worker message handler.
 */

import type { Link } from '@meticoeus/ddd-es'
import type { CacheKeyIdentity, CacheKeyTemplate } from '../../core/cache-manager/CacheKey.js'
import type { CacheManager } from '../../core/cache-manager/CacheManager.js'
import type { AcquireCacheKeyOptions } from '../../core/cache-manager/types.js'
import type { WorkerMessageHandler } from '../../protocol/MessageChannel.js'
import { EnqueueCommand } from '../../types/index.js'

export function registerCacheManagerMethods<TLink extends Link, TCommand extends EnqueueCommand>(
  handler: WorkerMessageHandler,
  cacheManager: CacheManager<TLink, TCommand>,
): void {
  handler.registerMethod('cacheManager.acquireKey', async (args) => {
    const cacheKey = args[0] as CacheKeyIdentity<TLink>
    const options = args[1] as AcquireCacheKeyOptions | undefined
    return cacheManager.acquireKey(cacheKey, options)
  })

  handler.registerMethod('cacheManager.acquire', async (args) => {
    const cacheKey = args[0] as CacheKeyIdentity<TLink>
    const options = args[1] as AcquireCacheKeyOptions | undefined
    return cacheManager.acquire(cacheKey, options)
  })

  handler.registerMethod('cacheManager.exists', async (args) => {
    return cacheManager.exists(args[0] as string)
  })

  handler.registerMethod('cacheManager.get', async (args) => {
    return cacheManager.get(args[0] as string)
  })

  handler.registerMethod('cacheManager.touch', async (args) => {
    return cacheManager.touch(args[0] as CacheKeyIdentity<TLink>)
  })

  handler.registerMethod('cacheManager.holdForWindow', async (args) => {
    return cacheManager.holdForWindow(args[0] as string, args[1] as string)
  })

  handler.registerMethod('cacheManager.releaseForWindow', async (args) => {
    return cacheManager.releaseForWindow(args[0] as string, args[1] as string)
  })

  handler.registerMethod('cacheManager.freeze', async (args) => {
    return cacheManager.freeze(args[0] as string)
  })

  handler.registerMethod('cacheManager.unfreeze', async (args) => {
    return cacheManager.unfreeze(args[0] as string)
  })

  handler.registerMethod('cacheManager.isFrozen', async (args) => {
    return cacheManager.isFrozen(args[0] as string)
  })

  handler.registerMethod('cacheManager.evict', async (args) => {
    return cacheManager.evict(args[0] as string)
  })

  handler.registerMethod('cacheManager.evictAll', async () => {
    return cacheManager.evictAll()
  })

  handler.registerMethod('cacheManager.evictExpired', async () => {
    return cacheManager.evictExpired()
  })

  handler.registerMethod('cacheManager.getCount', async () => {
    return cacheManager.getCount()
  })

  handler.registerMethod('cacheManager.filterExistingCacheKeys', async (args) => {
    return cacheManager.filterExistingCacheKeys(args[0] as string[])
  })

  handler.registerMethod('cacheManager.registerCacheKey', async (args) => {
    const template = args[0] as CacheKeyTemplate<TLink>
    const options = args[1] as AcquireCacheKeyOptions | undefined
    return cacheManager.registerCacheKey(template, options)
  })
}
