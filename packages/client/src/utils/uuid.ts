/**
 * UUID utilities.
 */

import { v4 as uuidv4, v5 as uuidv5 } from 'uuid'

/**
 * Namespace UUID for cache key derivation.
 * Using a fixed namespace ensures deterministic cache key generation.
 */
export const CACHE_KEY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8' // DNS namespace

/**
 * Generate a random UUID v4.
 */
export function generateId(): string {
  return uuidv4()
}

/**
 * Generate a deterministic UUID v5 from a name.
 *
 * @param name - The name to derive the UUID from
 * @param namespace - Optional namespace UUID (defaults to CACHE_KEY_NAMESPACE)
 * @returns Deterministic UUID v5
 */
export function deriveId(name: string, namespace: string = CACHE_KEY_NAMESPACE): string {
  return uuidv5(name, namespace)
}

/**
 * Derive a cache key from collection and query parameters.
 *
 * @param collection - Collection name
 * @param params - Query parameters
 * @returns Deterministic cache key
 */
export function deriveCacheKey(collection: string, params?: Record<string, unknown>): string {
  const input = params ? `${collection}:${JSON.stringify(params)}` : collection
  return deriveId(input)
}
