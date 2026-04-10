/**
 * Build a Collection from representation surface data + app-specific callbacks.
 *
 * Wires fetchSeedEvents and fetchStreamEvents using the representation URLs
 * and the library's fetch helpers, so the consumer only provides app-specific
 * callbacks (topics, stream matching).
 */

import { AggregateConfig, Collection, IdReference } from '@cqrs-toolkit/client'
import type { Link } from '@meticoeus/ddd-es'
import { fetchEventPage, fetchStreamEvents } from './fetchHelpers.js'
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
 */
export function createCollection<TLink extends Link>(
  opts: CreateCollectionOptions<TLink>,
): Collection<TLink> {
  const { name, aggregate, idReferences, representation, cacheKeysFromTopics, matchesStream } = opts
  const extractId = opts.aggregateId ?? defaultAggregateId
  const aggregateEventsHref =
    representation.aggregateEvents.href ?? representation.aggregateEvents.template

  return {
    name,
    aggregate,
    idReferences,
    cacheKeysFromTopics,
    matchesStream,
    seedOnInit: opts.seedOnInit,
    seedOnDemand: opts.seedOnDemand,
    fetchSeedEvents: ({ ctx, cursor, limit }) =>
      fetchEventPage(ctx, aggregateEventsHref, cursor, limit),
    fetchStreamEvents: ({ ctx, streamId, afterRevision }) => {
      const id = extractId(streamId)
      const path = expandItemEventsPath(representation.itemEvents.template, id)
      return fetchStreamEvents(ctx, path, afterRevision)
    },
  }
}
