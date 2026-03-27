/**
 * Registers CacheManager RPC methods on the worker message handler.
 */

import type { Link } from '@meticoeus/ddd-es'
import type { CacheKeyIdentity } from '../../core/cache-manager/CacheKey.js'
import type { CacheManager } from '../../core/cache-manager/CacheManager.js'
import type { AcquireCacheKeyOptions } from '../../core/cache-manager/types.js'
import type { WorkerMessageHandler } from '../../protocol/MessageChannel.js'

export function registerCacheManagerMethods<TLink extends Link>(
  handler: WorkerMessageHandler,
  cacheManager: CacheManager<TLink>,
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

  handler.registerMethod('cacheManager.hold', async (args) => {
    return cacheManager.hold(args[0] as string)
  })

  handler.registerMethod('cacheManager.release', async (args) => {
    return cacheManager.release(args[0] as string)
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
}
