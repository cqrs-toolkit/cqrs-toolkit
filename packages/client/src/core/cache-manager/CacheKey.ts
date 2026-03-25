/**
 * Cache key identity types, derivation, and hydration.
 *
 * A cache key identity carries the full identifying tuple alongside the derived UUID v5 key.
 * Two kinds exist (spec §2.2.1):
 * - Entity: tied to a concrete domain entity via a Link
 * - Scope: a logical data scope with optional params
 */

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
    const identity: EntityCacheKey<TLink> = {
      kind: 'entity',
      key: record.key,
      link: link as unknown as TLink,
      parentKey: record.parentKey ?? undefined,
    }
    return identity
  }

  const identity: ScopeCacheKey = {
    kind: 'scope',
    key: record.key,
    service: record.service ?? undefined,
    scopeType: record.scopeType ?? '',
    scopeParams: record.scopeParams
      ? (JSON.parse(record.scopeParams) as Record<string, unknown>)
      : undefined,
    parentKey: record.parentKey ?? undefined,
  }
  return identity
}

// ---------------------------------------------------------------------------
// Record conversion
// ---------------------------------------------------------------------------

/**
 * Convert a CacheKeyIdentity to a CacheKeyRecord for persistence.
 */
export function identityToRecord<TLink extends Link>(
  identity: CacheKeyIdentity<TLink>,
  opts: {
    evictionPolicy: 'persistent' | 'ephemeral'
    expiresAt: number | null
    now: number
  },
): CacheKeyRecord {
  const base: CacheKeyRecord = {
    key: identity.key,
    kind: identity.kind,
    linkService: null,
    linkType: null,
    linkId: null,
    service: null,
    scopeType: null,
    scopeParams: null,
    parentKey: identity.parentKey ?? null,
    evictionPolicy: opts.evictionPolicy,
    frozen: false,
    lastAccessedAt: opts.now,
    expiresAt: opts.expiresAt,
    createdAt: opts.now,
    holdCount: 0,
  }

  if (identity.kind === 'entity') {
    const link = identity.link
    base.linkType = link.type
    base.linkId = link.id
    if ('service' in link && typeof link.service === 'string') {
      base.linkService = link.service
    }
  } else {
    base.service = identity.service ?? null
    base.scopeType = identity.scopeType
    base.scopeParams =
      identity.scopeParams && Object.keys(identity.scopeParams).length > 0
        ? JSON.stringify(identity.scopeParams)
        : null
  }

  return base
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

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
