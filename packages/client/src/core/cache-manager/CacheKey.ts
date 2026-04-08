/**
 * Cache key identity types, derivation, and hydration.
 *
 * A cache key identity carries the full identifying tuple alongside the derived UUID v5 key.
 * Two kinds exist (spec §2.2.1):
 * - Entity: tied to a concrete domain entity via a Link
 * - Scope: a logical data scope with optional params
 */

import { stableStringify } from '#utils'
import type { Link } from '@meticoeus/ddd-es'
import { v5 as uuidv5 } from 'uuid'
import type { CacheKeyRecord } from '../../storage/IStorage.js'
import type { EntityId } from '../../types/entities.js'
import { entityIdToString } from '../../types/entities.js'

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
 * Derive an entity cache key from a Link.
 * Produces a deterministic UUID v5 from the link's identifying fields.
 */
export function deriveEntityKey<TLink extends Link>(
  link: TLink,
  parentKey?: string,
): EntityCacheKey<TLink> {
  const parts: string[] = []
  if ('service' in link && typeof link.service === 'string') {
    parts.push(link.service)
  }
  parts.push(link.type, link.id)
  const input = `entity:${parts.join(':')}`
  return {
    kind: 'entity',
    key: uuidv5(input, CACHE_KEY_NAMESPACE),
    link,
    parentKey,
  }
}

/**
 * Derive an entity cache key from a link template and an EntityId value.
 *
 * Resolves the EntityId to a plain string (extracting entityId from EntityRef
 * if needed), then delegates to {@link deriveEntityKey}.
 */
export function deriveEntityKeyFromRef<TLink extends Link>(
  linkTemplate: Omit<TLink, 'id'>,
  id: EntityId,
  parentKey?: string,
): EntityCacheKey<TLink> {
  const link = { ...linkTemplate, id: entityIdToString(id) } as TLink
  return deriveEntityKey(link, parentKey)
}

/**
 * Derive a scope cache key from scope identifiers and optional params.
 * Produces a deterministic UUID v5 from the scope's identifying fields.
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
