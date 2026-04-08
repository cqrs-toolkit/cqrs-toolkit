/**
 * Cache manager exports.
 */

export {
  CACHE_KEY_NAMESPACE,
  deriveEntityKey,
  deriveEntityKeyFromRef,
  deriveScopeKey,
  hydrateCacheKeyIdentity,
  identityToRecord,
  matchesCacheKey,
} from './CacheKey.js'
export type {
  CacheKeyIdentity,
  CacheKeyMatcher,
  EntityCacheKey,
  EntityKeyMatcher,
  ScopeCacheKey,
  ScopeKeyMatcher,
} from './CacheKey.js'
export { CacheManager } from './CacheManager.js'
export type { CacheManagerConfig } from './CacheManager.js'
export type { AcquireCacheKeyOptions, ICacheManager } from './types.js'
