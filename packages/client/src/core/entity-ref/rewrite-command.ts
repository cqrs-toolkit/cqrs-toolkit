/**
 * Command-data rewriting via IdReference config.
 *
 * Walks `commandIdReferences` against the whole command (data + path),
 * replaces resolved tempIds with serverIds, and prunes the resolved
 * entries from `commandIdPaths`.
 */

import type { Link } from '@meticoeus/ddd-es'
import type { AggregateConfig, IdReference } from '../../types/aggregates.js'
import { isEntityIdLink, matchesAggregate } from '../../types/aggregates.js'
import type { EntityId, EntityRef } from '../../types/entities.js'
import { entityIdToString } from '../../types/entities.js'
import type { JSONPathExpression } from '../../types/json-path.js'
import { findMatchingPaths, setAtPath } from './ref-path.js'

export interface RewriteIdEntry<TLink extends Link> {
  clientId: string
  serverId: string
  aggregate: AggregateConfig<TLink>
}

export interface RewriteCommandResult {
  data: unknown
  path: unknown
  commandIdPaths: Record<JSONPathExpression, EntityRef> | undefined
  changed: boolean
}

/**
 * Rewrite a command's data and path fields using resolved id mappings,
 * guided by declared `commandIdReferences`.
 *
 * Walks each idReference path against a virtual `{ data, path }` root,
 * matching each `RewriteIdEntry`'s clientId against values at those paths.
 * DirectIdReference leaves are replaced with the serverId string.
 * LinkIdReference leaves have their `id` field replaced, preserving the
 * Link wrapper (service + type) for wire-format correctness.
 *
 * Also prunes resolved entries from `commandIdPaths`.
 */
export function rewriteCommandWithIdMap<TLink extends Link>(
  command: { data: unknown; path?: unknown },
  commandIdPaths: Record<JSONPathExpression, EntityRef> | undefined,
  entries: readonly RewriteIdEntry<TLink>[],
  idReferences: readonly IdReference<TLink>[],
): RewriteCommandResult {
  if (entries.length === 0 || idReferences.length === 0) {
    return {
      data: command.data,
      path: command.path,
      commandIdPaths,
      changed: false,
    }
  }

  let commandView: unknown = { data: command.data, path: command.path }
  let changed = false

  for (const entry of entries) {
    for (const ref of idReferences) {
      if ('aggregate' in ref) {
        if (!matchesAggregate(ref.aggregate.getLinkMatcher(), entry.aggregate)) continue
        const matches = findMatchingPaths(
          commandView,
          ref.path,
          (v) => entityIdToString(v as EntityId) === entry.clientId,
        )
        for (const { path } of matches) {
          commandView = setAtPath(commandView, path, entry.serverId)
          changed = true
        }
      } else {
        if (!ref.aggregates.some((a) => matchesAggregate(a.getLinkMatcher(), entry.aggregate))) {
          continue
        }
        const matches = findMatchingPaths(
          commandView,
          ref.path,
          (v) =>
            isEntityIdLink(v) &&
            matchesAggregate(v as unknown as Omit<TLink, 'id'>, entry.aggregate) &&
            entityIdToString(v.id) === entry.clientId,
        )
        for (const { path, value } of matches) {
          const link = value as { service?: string; type: string; id: EntityId }
          commandView = setAtPath(commandView, path, { ...link, id: entry.serverId })
          changed = true
        }
      }
    }
  }

  let prunedPaths = commandIdPaths
  if (prunedPaths && changed) {
    const resolvedIds = new Set(entries.map((e) => e.clientId))
    const kept: Record<JSONPathExpression, EntityRef> = {}
    for (const [p, ref] of Object.entries(prunedPaths)) {
      if (!resolvedIds.has(ref.entityId)) {
        kept[p] = ref
      }
    }
    prunedPaths = Object.keys(kept).length > 0 ? kept : undefined
  }

  const view = commandView as { data: unknown; path?: unknown }
  return {
    data: view.data,
    path: view.path,
    commandIdPaths: prunedPaths,
    changed,
  }
}
