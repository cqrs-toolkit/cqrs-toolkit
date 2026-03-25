/**
 * Cache manager exports.
 */

export {
  CACHE_KEY_NAMESPACE,
  deriveEntityKey,
  deriveScopeKey,
  hydrateCacheKeyIdentity,
  identityToRecord,
} from './CacheKey.js'
export type { CacheKeyIdentity, EntityCacheKey, ScopeCacheKey } from './CacheKey.js'
export { CacheManager } from './CacheManager.js'
export type { CacheManagerConfig } from './CacheManager.js'
export type { AcquireCacheKeyOptions, ICacheManager } from './types.js'
