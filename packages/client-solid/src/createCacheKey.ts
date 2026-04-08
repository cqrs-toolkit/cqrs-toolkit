/**
 * SolidJS reactive primitives for EntityId-aware cache key derivation.
 */

import type { EntityCacheKey, EntityId, ScopeCacheKey } from '@cqrs-toolkit/client'
import { deriveEntityKeyFromRef, deriveScopeKey } from '@cqrs-toolkit/client'
import type { Link } from '@meticoeus/ddd-es'
import { createMemo } from 'solid-js'

/**
 * Create a reactive entity cache key that re-derives when the entity ID changes.
 *
 * Wraps {@link deriveEntityKeyFromRef} in a `createMemo`. Returns `undefined`
 * when the id accessor returns `undefined` (e.g., no entity selected).
 *
 * When a locally-created entity's ID transitions from EntityRef to string
 * (server confirmation), the memo re-runs and produces a new cache key derived
 * from the server-assigned ID. Consuming queries (e.g., `createListQuery`)
 * automatically re-subscribe to the new key.
 *
 * @param linkTemplate - Link fields without `id` (e.g., `{ service: 'nb', type: 'Notebook' }`)
 * @param id - Reactive accessor returning the entity ID or undefined
 * @param parentKey - Optional parent cache key for hierarchical eviction
 * @returns Accessor returning the derived entity cache key, or undefined
 */
export function createEntityCacheKey<TLink extends Link>(
  linkTemplate: Omit<TLink, 'id'>,
  id: () => EntityId | undefined,
  parentKey?: string,
): () => EntityCacheKey<TLink> | undefined {
  return createMemo(() => {
    const currentId = id()
    if (!currentId) return undefined
    return deriveEntityKeyFromRef<TLink>(linkTemplate, currentId, parentKey)
  })
}

/**
 * Scope cache key options for the reactive primitive.
 * `scopeParams` can be a reactive accessor for dynamic scope parameters.
 */
interface ScopeCacheKeyOptions {
  service?: string
  scopeType: string
  scopeParams?: () => Record<string, unknown> | undefined
  parentKey?: string
}

/**
 * Create a reactive scope cache key that re-derives when scope parameters change.
 *
 * Wraps {@link deriveScopeKey} in a `createMemo`. When `scopeParams` is an
 * accessor, the memo re-runs when the params change.
 *
 * Returns `undefined` when `scopeParams` returns `undefined` (if provided as an accessor).
 *
 * @param options - Scope key options with optional reactive scopeParams
 * @returns Accessor returning the derived scope cache key, or undefined
 */
export function createScopeCacheKey(
  options: ScopeCacheKeyOptions,
): () => ScopeCacheKey | undefined {
  return createMemo(() => {
    const params = options.scopeParams?.()
    if (options.scopeParams && typeof params === 'undefined') return undefined
    return deriveScopeKey({
      service: options.service,
      scopeType: options.scopeType,
      scopeParams: params,
      parentKey: options.parentKey,
    })
  })
}
