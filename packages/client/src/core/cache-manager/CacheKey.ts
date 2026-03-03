/**
 * Cache key utilities.
 * Cache keys are deterministic UUIDs derived from collection + query parameters.
 */

import { v5 as uuidv5 } from 'uuid'

/**
 * Namespace UUID for cache key derivation.
 * This is a well-known UUID namespace for DNS names.
 */
export const CACHE_KEY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

/**
 * Derive a deterministic cache key from collection and query parameters.
 *
 * @param collection - Collection name
 * @param params - Optional query parameters
 * @returns Deterministic UUID v5 cache key
 */
export function deriveCacheKey(collection: string, params?: Record<string, unknown>): string {
  const input =
    params && Object.keys(params).length > 0
      ? `${collection}:${stableStringify(params)}`
      : collection

  return uuidv5(input, CACHE_KEY_NAMESPACE)
}

/**
 * Derive a scope-based cache key.
 * Scopes allow sub-partitioning of cache data (e.g., per-user data).
 *
 * @param scope - Scope identifier (e.g., userId)
 * @param collection - Collection name
 * @param params - Optional query parameters
 * @returns Deterministic UUID v5 cache key
 */
export function deriveScopedCacheKey(
  scope: string,
  collection: string,
  params?: Record<string, unknown>,
): string {
  const scopedCollection = `${scope}/${collection}`
  return deriveCacheKey(scopedCollection, params)
}

/**
 * Parse a cache key to extract components.
 * Note: This is lossy - parameters cannot be recovered from the UUID.
 *
 * @param key - Cache key UUID
 * @returns Just the key itself (no parsing possible with UUID v5)
 */
export function parseCacheKey(key: string): { key: string } {
  return { key }
}

/**
 * Stable JSON stringify that produces consistent output.
 * Keys are sorted alphabetically for determinism.
 */
function stableStringify(obj: Record<string, unknown>): string {
  return JSON.stringify(sortObjectKeys(obj))
}

/**
 * Recursively sort object keys for stable serialization.
 */
function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys)
  }

  const sorted: Record<string, unknown> = {}
  const keys = Object.keys(obj as Record<string, unknown>).sort()
  for (const key of keys) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key])
  }
  return sorted
}
