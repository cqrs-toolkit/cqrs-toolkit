import type { Link } from '@meticoeus/ddd-es'
import type { EnqueueCommand } from '../../types/commands.js'
import type { Collection } from '../../types/config.js'
import type { CommandHandlerRegistration } from '../../types/domain.js'
import type { IAnticipatedEvent } from '../command-lifecycle/AnticipatedEventShape.js'
import { findPrimaryCollection } from './findPrimaryCollection.js'

/**
 * Memoized lookup from command handler registration to the collection whose
 * primary aggregate matches the registration's aggregate config.
 *
 * Instantiate once (e.g., in SyncManager's constructor) and share across
 * reconciliation calls — the cache survives for the lifetime of the instance.
 */
export class PrimaryCollectionResolver<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TSchema,
  TEvent extends IAnticipatedEvent,
> {
  private readonly cache = new Map<
    CommandHandlerRegistration<TLink, TCommand, TSchema, TEvent>,
    Collection<TLink> | undefined
  >()

  constructor(private readonly collections: readonly Collection<TLink>[]) {}

  /**
   * Return the primary collection for the given registration's aggregate,
   * or `undefined` if the registration has no aggregate config or no matching
   * collection is configured.
   */
  resolve(
    registration: CommandHandlerRegistration<TLink, TCommand, TSchema, TEvent>,
  ): Collection<TLink> | undefined {
    if (this.cache.has(registration)) {
      return this.cache.get(registration)
    }
    const collection = registration.aggregate
      ? findPrimaryCollection(this.collections, registration.aggregate)
      : undefined
    this.cache.set(registration, collection)
    return collection
  }
}
