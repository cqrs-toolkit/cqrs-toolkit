/**
 * Build a Collection from representation surface data + app-specific callbacks.
 *
 * Wires fetchSeedEvents, fetchStreamEvents, and (when fetchTemplateVariables
 * is provided) fetchSeedRecords using the representation URLs and the
 * library's fetch helpers, so the consumer only provides app-specific
 * callbacks (topics, stream matching, scope variables).
 */

import {
  AggregateConfig,
  CacheKeyIdentity,
  Collection,
  FetchContext,
  IdReference,
  type JSONPathExpression,
} from '@cqrs-toolkit/client'
import type { Link } from '@meticoeus/ddd-es'
import { fetchEventPage, fetchSeedRecordPage, fetchStreamEvents } from './fetchHelpers.js'
import type { RepresentationSurfaces } from './types.js'

/**
 * Options for creating a collection from a representation.
 */
export interface CreateCollectionOptions<TLink extends Link> {
  /** Collection name (e.g. 'todos') */
  name: string
  /** Forwarded to {@link Collection.aggregate}. */
  aggregate: AggregateConfig<TLink>
  /** Forwarded to {@link Collection.idReferences}. */
  readonly idReferences?: IdReference<TLink>[]
  /**
   * Forwarded to {@link Collection.revisionPath}. Also used by the
   * library-wired `fetchSeedRecords` to extract `SeedRecord.revision`
   * from each member.
   */
  readonly revisionPath?: JSONPathExpression
  /** Derive cache key identities from WS event topics. Forwarded to {@link Collection.cacheKeysFromTopics}. */
  cacheKeysFromTopics: Collection<TLink>['cacheKeysFromTopics']
  /** Representation surface data from generated representations.ts */
  representation: RepresentationSurfaces
  /** App-specific: test whether a streamId belongs to this collection */
  matchesStream: (streamId: string) => boolean
  /**
   * Extract aggregate ID from streamId for item event URL expansion.
   * Default: splits on first '-' (convention: 'Todo-{uuid}' → '{uuid}')
   */
  aggregateId?: (streamId: string) => string
  /** Auto-seed config. Forwarded to {@link Collection.seedOnInit} */
  seedOnInit?: Collection<TLink>['seedOnInit']
  /** On-demand config. Forwarded to {@link Collection.seedOnDemand} */
  seedOnDemand?: Collection<TLink>['seedOnDemand']
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
 * Create a `Collection` from representation surface data.
 *
 * The returned collection has `fetchSeedEvents` and `fetchStreamEvents`
 * pre-wired using the representation's aggregate events and item events URLs.
 * `fetchSeedRecords` is wired against `representation.collection.template`
 * when `fetchTemplateVariables` is provided; without it, `SyncManager` falls
 * back to `fetchSeedEvents` for seeding.
 *
 * `opts.revisionPath` is forwarded unconditionally onto
 * `Collection.revisionPath` — independent of records wiring — so consumers
 * declaring a revision path on `appCreateCollection = createCollection<TLink>`
 * always carry it through to `AggregateChain.lastKnownRevision` advancement.
 */
export function createCollection<TLink extends Link>(
  opts: CreateCollectionOptions<TLink>,
): Collection<TLink> {
  const { name, aggregate, idReferences, representation, cacheKeysFromTopics, matchesStream } = opts
  const extractId = opts.aggregateId ?? defaultAggregateId
  const aggregateEventsHref =
    representation.aggregateEvents.href ?? representation.aggregateEvents.template

  const collection: Collection<TLink> = {
    name,
    aggregate,
    idReferences,
    revisionPath: opts.revisionPath,
    cacheKeysFromTopics,
    matchesStream,
    seedOnInit: opts.seedOnInit,
    seedOnDemand: opts.seedOnDemand,
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
      ...collection,
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

  return collection
}
