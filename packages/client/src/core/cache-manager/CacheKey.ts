/**
 * Cache key identity types, derivation, and hydration.
 *
 * Two kinds of cache key identity exist (spec §2.2.1):
 * - Entity: tied to a concrete domain entity via a Link
 * - Scope: a logical data scope with optional params
 *
 * Cache keys with opaque UUIDs are created via {@link registerCacheKey} on the CacheManager.
 * UUID v5 derivation via {@link deriveScopeKey} is available for scope keys without EntityRef values.
 */

import { stableStringify } from '#utils'
import type { Link } from '@meticoeus/ddd-es'
import { v5 as uuidv5 } from 'uuid'
import type { CacheKeyRecord } from '../../storage/IStorage.js'

/**
 * Namespace UUID for cache key derivation.
 * This is a well-known UUID namespace for DNS names.
 */
export const CACHE_KEY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

// ---------------------------------------------------------------------------
// Cache key identity types
// ---------------------------------------------------------------------------

/**
 * Entity cache key — tied to a concrete domain entity via a Link.
 * The link carries `{ type, id }` (or `{ service, type, id }` for ServiceLink).
 */
export interface EntityCacheKey<TLink extends Link> {
  kind: 'entity'
  key: string
  link: TLink
  parentKey?: string
}

/**
 * Scope cache key — a logical data scope not tied to a single entity.
 * Examples: "home task list", "search results with filters X".
 */
export interface ScopeCacheKey {
  kind: 'scope'
  key: string
  service?: string
  scopeType: string
  scopeParams?: Record<string, unknown>
  parentKey?: string
}

/**
 * Discriminated union of all cache key kinds.
 * Parameterized on TLink so multi-service apps using ServiceLink
 * get `service` required on entity keys.
 */
export type CacheKeyIdentity<TLink extends Link> = EntityCacheKey<TLink> | ScopeCacheKey

export function isEntityCacheKey<TLink extends Link>(
  key: CacheKeyIdentity<TLink>,
): key is EntityCacheKey<TLink> {
  return key.kind === 'entity'
}

export function isScopeCacheKey<TLink extends Link>(
  key: CacheKeyIdentity<TLink>,
): key is ScopeCacheKey {
  return key.kind === 'scope'
}

// ---------------------------------------------------------------------------
// Cache key templates (identity without key — input to registerCacheKey)
// ---------------------------------------------------------------------------

/**
 * Entity cache key template — identity without a resolved `.key` UUID.
 * Consumers construct these as typed object literals and pass to `registerCacheKey`.
 *
 * `link.id` may be an `EntityId` (string or EntityRef). When it's an EntityRef,
 * `registerCacheKey` auto-wires reconciliation from the embedded metadata.
 */
export interface EntityCacheKeyTemplate<TLink extends Link> {
  kind: 'entity'
  link: TLink
  parentKey?: string
}

/**
 * Scope cache key template — identity without a resolved `.key` UUID.
 * Consumers construct these as typed object literals and pass to `registerCacheKey`.
 *
 * `scopeParams` values may contain EntityRef objects. Default extraction scans
 * top-level values. Declare `entityRefPaths` for deeper structures.
 *
 * **Warning:** Do not use `deriveScopeKey` when `scopeParams` contains EntityRef
 * values or temporary client-generated IDs — the UUID v5 derivation produces a
 * key that becomes orphaned when the ID resolves. Use `registerCacheKey` instead.
 */
export interface ScopeCacheKeyTemplate {
  kind: 'scope'
  service?: string
  scopeType: string
  scopeParams?: Record<string, unknown>
  parentKey?: string
  /**
   * JSONPath expressions (RFC 9535 subset) for EntityRef values in nested
   * scopeParams structures. Default extraction scans top-level scopeParams values.
   * Declare paths here for deeper structures. Paths are relative to scopeParams.
   * Uses `[*]` for array wildcard.
   *
   * @example ['$.filter.orgId', '$.items[*].parentId']
   */
  entityRefPaths?: string[]
}

/**
 * Discriminated union of cache key templates.
 * Input to `registerCacheKey` — the system assigns a stable opaque UUID.
 */
export type CacheKeyTemplate<TLink extends Link> =
  | EntityCacheKeyTemplate<TLink>
  | ScopeCacheKeyTemplate

/**
 * Build a CacheKeyIdentity from a template and a resolved key UUID.
 */
export function templateToIdentity<TLink extends Link>(
  template: CacheKeyTemplate<TLink>,
  key: string,
): CacheKeyIdentity<TLink> {
  if (template.kind === 'entity') {
    const identity: EntityCacheKey<TLink> = {
      kind: 'entity',
      key,
      link: template.link,
      parentKey: template.parentKey,
    }
    return identity
  }

  const identity: ScopeCacheKey = {
    kind: 'scope',
    key,
    service: template.service,
    scopeType: template.scopeType,
    scopeParams: template.scopeParams,
    parentKey: template.parentKey,
  }
  return identity
}

// ---------------------------------------------------------------------------
// Cache key matchers (for Collection.keyTypes)
// ---------------------------------------------------------------------------

/**
 * Entity key matcher — matches entity cache keys by the link's identifying fields
 * (type, and service if ServiceLink), ignoring the instance-specific id.
 */
export interface EntityKeyMatcher<TLink extends Link> {
  kind: 'entity'
  /** Link fields minus id — { type } for Link, { service, type } for ServiceLink */
  link: Omit<TLink, 'id'>
}

/**
 * Scope key matcher — matches scope cache keys by scopeType,
 * ignoring instance-specific scopeParams.
 */
export interface ScopeKeyMatcher {
  kind: 'scope'
  scopeType: string
}

/**
 * Discriminated union of cache key matchers.
 * Used by Collection.keyTypes to declare which cache key shapes activate a collection.
 */
export type CacheKeyMatcher<TLink extends Link> = EntityKeyMatcher<TLink> | ScopeKeyMatcher

/**
 * Test whether a cache key identity matches a cache key matcher.
 * Compares the structural shape (kind + type/scopeType) without instance-specific data (id, scopeParams).
 */
export function matchesCacheKey<TLink extends Link>(
  cacheKey: CacheKeyIdentity<TLink>,
  matcher: CacheKeyMatcher<TLink>,
): boolean {
  if (cacheKey.kind !== matcher.kind) return false

  if (cacheKey.kind === 'entity' && matcher.kind === 'entity') {
    if (cacheKey.link.type !== matcher.link.type) return false
    if ('service' in matcher.link) {
      if (!('service' in cacheKey.link)) return false
      if (cacheKey.link.service !== matcher.link.service) return false
    }
    return true
  }

  if (cacheKey.kind === 'scope' && matcher.kind === 'scope') {
    return cacheKey.scopeType === matcher.scopeType
  }

  return false
}

// ---------------------------------------------------------------------------
// Derivation functions
// ---------------------------------------------------------------------------

/**
 * Derive a scope cache key from scope identifiers and optional params.
 * Produces a deterministic UUID v5 from the scope's identifying fields.
 *
 * **Warning:** Do not use when `scopeParams` contains EntityRef values or
 * temporary client-generated IDs. The UUID v5 derivation produces a key that
 * becomes orphaned when the ID resolves. Use `registerCacheKey` with a
 * `ScopeCacheKeyTemplate` instead.
 */
export function deriveScopeKey(opts: {
  service?: string
  scopeType: string
  scopeParams?: Record<string, unknown>
  parentKey?: string
}): ScopeCacheKey {
  const parts: string[] = []
  if (opts.service) {
    parts.push(opts.service)
  }
  parts.push(opts.scopeType)
  if (opts.scopeParams && Object.keys(opts.scopeParams).length > 0) {
    parts.push(stableStringify(opts.scopeParams))
  }
  const input = `scope:${parts.join(':')}`
  return {
    kind: 'scope',
    key: uuidv5(input, CACHE_KEY_NAMESPACE),
    service: opts.service,
    scopeType: opts.scopeType,
    scopeParams: opts.scopeParams,
    parentKey: opts.parentKey,
  }
}

// ---------------------------------------------------------------------------
// Hydration
// ---------------------------------------------------------------------------

/**
 * Reconstitute a CacheKeyIdentity from a persisted CacheKeyRecord.
 * Used on startup to restore full identity data from storage.
 */
export function hydrateCacheKeyIdentity<TLink extends Link>(
  record: CacheKeyRecord,
): CacheKeyIdentity<TLink> {
  if (record.kind === 'entity') {
    // Reconstruct the Link from persisted columns.
    // The cast through unknown is necessary because we're building a Link
    // from individual columns — the type system can't verify the shape
    // matches the generic TLink at this point.
    const link: Record<string, string> = {
      type: record.linkType ?? '',
      id: record.linkId ?? '',
    }
    if (record.linkService) {
      link['service'] = record.linkService
    }
    const cacheKey: EntityCacheKey<TLink> = {
      kind: 'entity',
      key: record.key,
      link: link as unknown as TLink,
      parentKey: record.parentKey ?? undefined,
    }
    return cacheKey
  }

  const cacheKey: ScopeCacheKey = {
    kind: 'scope',
    key: record.key,
    service: record.service ?? undefined,
    scopeType: record.scopeType ?? '',
    scopeParams: record.scopeParams
      ? (JSON.parse(record.scopeParams) as Record<string, unknown>)
      : undefined,
    parentKey: record.parentKey ?? undefined,
  }
  return cacheKey
}

// ---------------------------------------------------------------------------
// Record conversion
// ---------------------------------------------------------------------------

/**
 * Convert a CacheKeyIdentity to a CacheKeyRecord for persistence.
 */
export function identityToRecord<TLink extends Link>(
  cacheKey: CacheKeyIdentity<TLink>,
  opts: {
    evictionPolicy: 'persistent' | 'ephemeral'
    expiresAt: number | null
    now: number
    pendingIdMappings?: string | null
  },
): CacheKeyRecord {
  const base: CacheKeyRecord = {
    key: cacheKey.key,
    kind: cacheKey.kind,
    linkService: null,
    linkType: null,
    linkId: null,
    service: null,
    scopeType: null,
    scopeParams: null,
    parentKey: cacheKey.parentKey ?? null,
    evictionPolicy: opts.evictionPolicy,
    frozen: false,
    frozenAt: null,
    inheritedFrozen: false,
    lastAccessedAt: opts.now,
    expiresAt: opts.expiresAt,
    createdAt: opts.now,
    holdCount: 0,
    estimatedSizeBytes: null,
    pendingIdMappings: opts.pendingIdMappings ?? null,
  }

  if (cacheKey.kind === 'entity') {
    const link = cacheKey.link
    base.linkType = link.type
    base.linkId = link.id
    if ('service' in link && typeof link.service === 'string') {
      base.linkService = link.service
    }
  } else {
    base.service = cacheKey.service ?? null
    base.scopeType = cacheKey.scopeType
    base.scopeParams =
      cacheKey.scopeParams && Object.keys(cacheKey.scopeParams).length > 0
        ? JSON.stringify(cacheKey.scopeParams)
        : null
  }

  return base
}
