/**
 * Cache manager exports.
 */

export {
  CACHE_KEY_NAMESPACE,
  deriveScopeKey,
  hydrateCacheKeyIdentity,
  identityToRecord,
  matchesCacheKey,
  templateToIdentity,
} from './CacheKey.js'
export type {
  CacheKeyIdentity,
  CacheKeyMatcher,
  CacheKeyTemplate,
  EntityCacheKey,
  EntityCacheKeyTemplate,
  EntityKeyMatcher,
  ScopeCacheKey,
  ScopeCacheKeyTemplate,
  ScopeKeyMatcher,
} from './CacheKey.js'
export { CacheManager } from './CacheManager.js'
export type { CacheManagerConfig } from './CacheManager.js'
export { CacheManagerFacade } from './CacheManagerFacade.js'
export type { AcquireCacheKeyOptions, ICacheManager, ICacheManagerInternal } from './types.js'
