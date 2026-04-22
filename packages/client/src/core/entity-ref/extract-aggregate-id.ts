/**
 * Aggregate id extraction guided by declared `commandIdReferences`.
 *
 * Walks a command's `{ data, path }` surfaces using the JSONPath expressions
 * declared on its registration to locate id values for a specific aggregate.
 * No fallback to `$.data.id` — commands must declare where their ids live.
 */

import { assert } from '#utils'
import type { Link } from '@meticoeus/ddd-es'
import type { AggregateConfig, IdReference } from '../../types/aggregates.js'
import { isEntityIdLink, matchesAggregate } from '../../types/aggregates.js'
import type { CommandHandlerRegistration } from '../../types/domain.js'
import type { EntityTLink } from '../../types/entities.js'
import { entityIdToString, isEntityId } from '../../types/entities.js'
import { findMatchingPaths } from './ref-path.js'

/**
 * Extract the id for `targetAggregate` from the command, using the supplied
 * `idReferences` as the authoritative map of id locations.
 *
 * For each `DirectIdReference` whose `aggregate` matches the target, the
 * matched value is the aggregate id itself (string or EntityRef).
 * For each `LinkIdReference` whose `aggregates` include the target, the
 * matched value is a Link object whose `id` field carries the aggregate id.
 *
 * Returns the first matching id as a plain string (via `entityIdToString`),
 * or `undefined` when no declared reference targets the aggregate or no
 * value is present at the resolved paths.
 */
export function extractAggregateId<TLink extends Link>(
  command: { data: unknown; path?: unknown },
  idReferences: readonly IdReference<TLink>[],
  targetAggregate: AggregateConfig<TLink>,
): string | undefined {
  const commandView = { data: command.data, path: command.path }
  for (const ref of idReferences) {
    if ('aggregate' in ref) {
      if (!matchesAggregate(ref.aggregate.getLinkMatcher(), targetAggregate)) continue
      const matches = findMatchingPaths(commandView, ref.path, isEntityId)
      const first = matches[0]
      if (first) return entityIdToString(first.value)
    } else {
      if (!ref.aggregates.some((a) => matchesAggregate(a.getLinkMatcher(), targetAggregate))) {
        continue
      }
      const matches = findMatchingPaths(commandView, ref.path, (v): v is EntityTLink<TLink> => {
        if (!isEntityIdLink(v)) return false
        // isEntityIdLink narrows to a concrete shape; matchesAggregate's first
        // param is the generic `Omit<TLink, 'id'>`. Structural compatibility
        // is fine but the generic can't be inferred from the narrowed shape.
        return matchesAggregate(v as unknown as Omit<TLink, 'id'>, targetAggregate)
      })
      const first = matches[0]
      if (first) return entityIdToString(first.value.id)
    }
  }
  return undefined
}

/**
 * Extract the id of the command's primary aggregate (`registration.aggregate`).
 *
 * Thin wrapper over {@link extractAggregateId} that targets the primary
 * aggregate. Both `aggregate` and `commandIdReferences` are required on the
 * registration — there is no `$.data.id` fallback. Commands that omit either
 * cannot be resolved and will assert at runtime.
 */
export function extractPrimaryAggregateId<TLink extends Link>(
  command: { data: unknown; path?: unknown },
  registration: Pick<
    CommandHandlerRegistration<TLink>,
    'commandType' | 'aggregate' | 'commandIdReferences'
  >,
): string | undefined {
  const primary = registration.aggregate
  assert(
    primary,
    `Command "${registration.commandType}" must declare an aggregate to extract a primary id.`,
  )
  return extractAggregateId(command, registration.commandIdReferences, primary)
}
