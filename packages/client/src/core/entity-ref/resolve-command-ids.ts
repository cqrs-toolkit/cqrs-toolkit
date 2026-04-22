/**
 * Single-pass command-id resolution over declared `commandIdReferences`.
 *
 * Walks every declared id path on a command's `{ data, path }` surface and,
 * at each match:
 *   - If the value is a client id that `mappingStore` maps to a server id,
 *     writes the server id (DirectIdReference: plain string; LinkIdReference:
 *     preserves the Link wrapper, replaces `.id`).
 *   - Else if the value is an EntityRef that could not be resolved, records
 *     it in `commandIdPaths` — the downstream pipeline uses this for
 *     dependency auto-wiring and strip/restore of the EntityRef wrappers.
 *   - Else leaves the value unchanged (plain server-id string, no action).
 *
 * Produces both the patched command surface and the still-pending
 * `commandIdPaths` in one tree walk. The previous pipeline called
 * `patchFromIdMappingCache` and `extractCommandIdPaths` back-to-back,
 * walking the declared paths twice; this replaces both.
 */

import type { Link } from '@meticoeus/ddd-es'
import type { IdReference } from '../../types/aggregates.js'
import { isEntityIdLink, matchesAggregate } from '../../types/aggregates.js'
import type { EntityId, EntityRef, EntityTLink } from '../../types/entities.js'
import { entityIdToString, isEntityId, isEntityRef } from '../../types/entities.js'
import type { JSONPathExpression } from '../../types/json-path.js'
import type { ICommandIdMappingStore } from '../command-id-mapping-store/ICommandIdMappingStore.js'
import { findMatchingPaths, setAtPath } from './ref-path.js'

export interface ResolveCommandIdsResult {
  data: unknown
  path: unknown
  /**
   * Paths whose EntityRef values could not be resolved. The entries carry the
   * original EntityRef (with `commandId` linkage) so downstream dependency
   * wiring and strip/restore can operate on them.
   * `undefined` when every declared path resolved or held no EntityRef.
   */
  commandIdPaths: Record<JSONPathExpression, EntityRef> | undefined
  changed: boolean
}

export function resolveCommandIds<TLink extends Link>(
  command: { data: unknown; path?: unknown },
  idReferences: readonly IdReference<TLink>[],
  mappingStore: ICommandIdMappingStore,
): ResolveCommandIdsResult {
  let commandView: unknown = { data: command.data, path: command.path }
  const commandIdPaths: Record<JSONPathExpression, EntityRef> = {}
  let changed = false

  for (const ref of idReferences) {
    if ('aggregate' in ref) {
      // DirectIdReference: leaf value is an EntityId (string or EntityRef).
      const matches = findMatchingPaths(commandView, ref.path, isEntityId)
      for (const { path, value } of matches) {
        const clientId = entityIdToString(value)
        const serverId = mappingStore.get(clientId)?.serverId
        if (serverId !== undefined && serverId !== clientId) {
          commandView = setAtPath(commandView, path, serverId)
          changed = true
        } else if (isEntityRef(value)) {
          commandIdPaths[path] = value
        }
      }
    } else {
      // LinkIdReference: leaf value is a Link object whose `.id` is an EntityId.
      // `matchesAggregate`'s first param is the generic `Omit<TLink, 'id'>`; the
      // narrowed Link shape is structurally compatible but the generic can't be
      // inferred from it without a cast.
      const matches = findMatchingPaths(commandView, ref.path, (v): v is EntityTLink<TLink> => {
        if (!isEntityIdLink(v)) return false
        return ref.aggregates.some((agg) =>
          matchesAggregate(v as unknown as Omit<TLink, 'id'>, agg),
        )
      })
      for (const { path, value } of matches) {
        const link = value as { service?: string; type: string; id: EntityId }
        const clientId = entityIdToString(link.id)
        const serverId = mappingStore.get(clientId)?.serverId
        if (serverId !== undefined && serverId !== clientId) {
          commandView = setAtPath(commandView, path, { ...link, id: serverId })
          changed = true
        }
        // LinkIdReference EntityRef collection is intentionally omitted:
        // `commandIdPaths` entries target DirectIdReference leaves (strip/restore
        // replaces the EntityRef at the leaf with its `entityId` string). Link
        // wrappers can't be unwrapped that way without losing the wrapper.
        // Cross-aggregate dependency tracking via Link-nested EntityRefs is not
        // wired today; if it's needed later the dependency auto-wiring path has
        // to learn about nested EntityRefs too.
      }
    }
  }

  const view = commandView as { data: unknown; path?: unknown }
  return {
    data: view.data,
    path: view.path,
    commandIdPaths: Object.keys(commandIdPaths).length > 0 ? commandIdPaths : undefined,
    changed,
  }
}
