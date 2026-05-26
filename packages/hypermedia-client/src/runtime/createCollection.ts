/**
 * Build the representation-driven wiring slice of a Collection.
 *
 * `createCollection` is a **contributor**, not a whole-Collection factory. It
 * accepts only the inputs it needs to wire the representation surfaces
 * (`representation` + scope/header callbacks + `revisionPath`) and returns only
 * the fields it owns: `fetchSeedEvents`, `fetchStreamEvents`, `fetchSeedRecords`
 * (when wired), and the forwarded `revisionPath`. Consumers spread the result
 * into their own `Collection` literal, owning every other field (`name`,
 * `aggregate`, `idReferences`, `cacheKeysFromTopics`, `matchesStream`,
 * `seedOnInit`, `seedOnDemand`, `list`, ...) directly.
 *
 * This contributor shape decouples the helper from `Collection`'s evolution:
 * new `Collection` fields land on the consumer literal without forcing a
 * pass-through option here.
 */

import {
  CacheKeyIdentity,
  Collection,
  FetchContext,
  type JSONPathExpression,
} from '@cqrs-toolkit/client'
import type { Link } from '@meticoeus/ddd-es'
import { fetchEventPage, fetchSeedRecordPage, fetchStreamEvents } from './fetchHelpers.js'
import type { RepresentationSurfaces } from './types.js'

/**
 * Inputs to {@link createCollection}.
 *
 * Only the fields the helper actually consumes — every other `Collection`
 * field is set by the consumer on its own literal.
 */
export interface CreateCollectionOptions<TLink extends Link> {
  /** Representation surface data from generated representations.ts */
  representation: RepresentationSurfaces
  /**
   * Forwarded onto the returned wiring's `revisionPath`. Used by the records
   * parser to extract `SeedRecord.revision` from each item, and downstream by
   * `AggregateChain.lastKnownRevision` advancement.
   */
  readonly revisionPath?: JSONPathExpression
  /**
   * Extract aggregate ID from streamId for item event URL expansion.
   * Default: splits on first '-' (convention: 'Todo-{uuid}' → '{uuid}')
   */
  aggregateId?: (streamId: string) => string
  /**
   * Derive extra headers from the cache key and fetch context.
   * Merged into the FetchContext headers for seed event and seed record fetches.
   * Use for context-dependent headers (e.g., x-tenant-id).
   */
  fetchHeaders?(cacheKey: CacheKeyIdentity<TLink>, ctx: FetchContext): Record<string, string>
  /**
   * Derive cacheKey-scoped values for the variables declared in
   * `representation.collection.template`.
   *
   * The returned map supplies values for both path placeholders (`{var}`) and
   * form-style query parameters (`{?var,var,...}`); the template authoritatively
   * declares which entries the endpoint accepts. Missing path variables throw;
   * missing query variables are omitted from the URL.
   *
   * Library-supplied `cursor` and `limit` are merged into the same map and
   * flow through the same expansion. Library values win on collision.
   *
   * When present, `fetchSeedRecords` is wired against the representation's
   * collection surface. Without it, only `fetchSeedEvents` is wired and
   * `SyncManager` falls back to event-based seeding.
   */
  fetchTemplateVariables?(
    cacheKey: CacheKeyIdentity<TLink>,
    ctx: FetchContext,
  ): Record<string, string>
}

/**
 * The slice of `Collection<TLink>` that {@link createCollection} contributes:
 * `revisionPath` plus the three representation-derived fetch functions.
 * Consumers spread this into their own `Collection` literal.
 */
export type CreateCollectionResult<TLink extends Link> = Pick<
  Collection<TLink>,
  'revisionPath' | 'fetchSeedEvents' | 'fetchStreamEvents' | 'fetchSeedRecords'
>

/**
 * Default aggregate ID extraction: split on first '-'.
 * Convention: stream IDs follow '{AggregateType}-{uuid}' format.
 */
function defaultAggregateId(streamId: string): string {
  return streamId.slice(streamId.indexOf('-') + 1)
}

/**
 * Expand a URI template by replacing `{id}` with the actual aggregate ID.
 * Strips query expansion (everything from `{?` onwards).
 */
function expandItemEventsPath(template: string, aggregateId: string): string {
  const queryIndex = template.indexOf('{?')
  const pathPart = queryIndex !== -1 ? template.slice(0, queryIndex) : template
  return pathPart.replace('{id}', aggregateId)
}

/**
 * Build the representation-driven wiring slice of a `Collection<TLink>`.
 *
 * Returns `fetchSeedEvents`, `fetchStreamEvents`, and `revisionPath`
 * unconditionally; `fetchSeedRecords` is wired against
 * `representation.collection.template` when `fetchTemplateVariables` is
 * provided. Without it, `SyncManager` falls back to `fetchSeedEvents`-based
 * seeding.
 *
 * The result is intended to be spread into a consumer-owned `Collection`
 * literal — see the module docstring for the contributor rationale.
 */
export function createCollection<TLink extends Link>(
  opts: CreateCollectionOptions<TLink>,
): CreateCollectionResult<TLink> {
  const { representation } = opts
  const extractId = opts.aggregateId ?? defaultAggregateId
  const aggregateEventsHref =
    representation.aggregateEvents.href ?? representation.aggregateEvents.template

  const base: CreateCollectionResult<TLink> = {
    revisionPath: opts.revisionPath,
    fetchSeedEvents: ({ ctx, cursor, limit, cacheKey }) => {
      const mergedCtx = opts.fetchHeaders
        ? { ...ctx, headers: { ...ctx.headers, ...opts.fetchHeaders(cacheKey, ctx) } }
        : ctx
      return fetchEventPage(mergedCtx, aggregateEventsHref, cursor, limit)
    },
    fetchStreamEvents: ({ ctx, streamId, afterRevision }) => {
      const id = extractId(streamId)
      const path = expandItemEventsPath(representation.itemEvents.template, id)
      return fetchStreamEvents(ctx, path, afterRevision)
    },
  }

  if (opts.fetchTemplateVariables) {
    const fetchTemplateVariables = opts.fetchTemplateVariables
    return {
      ...base,
      fetchSeedRecords: ({ ctx, cursor, limit, cacheKey }) =>
        fetchSeedRecordPage({
          ctx,
          template: representation.collection.template,
          variables: fetchTemplateVariables(cacheKey, ctx),
          cursor,
          limit,
          headers: opts.fetchHeaders?.(cacheKey, ctx),
          revisionPath: opts.revisionPath,
        }),
    }
  }

  return base
}
