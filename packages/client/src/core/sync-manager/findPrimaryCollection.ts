import type { Link } from '@meticoeus/ddd-es'
import { type AggregateConfig, matchesAggregate } from '../../types/aggregates.js'
import type { Collection } from '../../types/config.js'

/**
 * Find the collection whose primary aggregate matches the given aggregate config.
 *
 * Returns the first match. If multiple collections declare the same primary aggregate
 * (e.g., separate view projections of the same stream), the first declared wins.
 */
export function findPrimaryCollection<TLink extends Link>(
  collections: readonly Collection<TLink>[],
  aggregate: AggregateConfig<TLink>,
): Collection<TLink> | undefined {
  return collections.find((collection) =>
    matchesAggregate(collection.aggregate.getLinkMatcher(), aggregate),
  )
}
