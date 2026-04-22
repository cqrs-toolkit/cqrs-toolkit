/**
 * Aggregate chain registry with built-in dual-indexing.
 *
 * Aggregate chains track the in-flight commands on a single aggregate stream.
 * A chain may be reachable by up to two streamIds: the client-time streamId
 * (temp-id creates) and the server-time streamId (after reconciliation). This
 * registry keeps both index entries in sync and records the streamId identity
 * on the chain object itself so callers never have to walk the map to find the
 * "other" index.
 *
 * Chains are mutable structs. Callers read via `get()` and mutate state fields
 * (`latestCommandId`, `lastKnownRevision`, etc.) in place. The registry only
 * manages the binding between streamId keys and chain objects.
 */

import { assert } from '#utils'

export interface AggregateChain {
  /** Client-time streamId, present for temp-id creates until/unless the chain
   *  is removed. May coexist with `serverStreamId` after reconciliation. */
  clientStreamId?: string
  /** Server-time streamId. Present for chains rooted at an existing server
   *  entity and for reconciled temp-id creates. May coexist with `clientStreamId`. */
  serverStreamId?: string
  /** Command id of the pending create, while the temp-id mapping is unresolved. */
  createCommandId?: string
  /** Client entity id of the pending create (the id string from inside the
   *  EntityRef). Cleared when the chain reconciles or the create terminates. */
  createdEntityId?: string
  /** Command id of the most recent non-terminal command to touch this chain. */
  latestCommandId?: string
  /** Last revision confirmed by a successful command on this aggregate. Drives
   *  AutoRevision resolution for subsequent commands. */
  lastKnownRevision?: string
}

export interface AggregateChainInit {
  clientStreamId?: string
  serverStreamId?: string
  createCommandId?: string
  createdEntityId?: string
  latestCommandId?: string
  lastKnownRevision?: string
}

export class AggregateChainRegistry {
  private readonly byStreamId = new Map<string, AggregateChain>()

  get(streamId: string): AggregateChain | undefined {
    return this.byStreamId.get(streamId)
  }

  has(streamId: string): boolean {
    return this.byStreamId.has(streamId)
  }

  /**
   * Create a new chain. At least one of `clientStreamId` / `serverStreamId`
   * must be provided. Neither streamId may already be bound — the caller is
   * expected to check with `get()` first and mutate the existing chain when
   * present.
   */
  create(init: AggregateChainInit): AggregateChain {
    assert(
      init.clientStreamId !== undefined || init.serverStreamId !== undefined,
      'AggregateChain must be created with at least one of clientStreamId or serverStreamId',
    )
    if (init.clientStreamId !== undefined) {
      assert(
        !this.byStreamId.has(init.clientStreamId),
        `clientStreamId already bound: ${init.clientStreamId}`,
      )
    }
    if (init.serverStreamId !== undefined) {
      assert(
        !this.byStreamId.has(init.serverStreamId),
        `serverStreamId already bound: ${init.serverStreamId}`,
      )
    }

    const chain: AggregateChain = {
      clientStreamId: init.clientStreamId,
      serverStreamId: init.serverStreamId,
      createCommandId: init.createCommandId,
      createdEntityId: init.createdEntityId,
      latestCommandId: init.latestCommandId,
      lastKnownRevision: init.lastKnownRevision,
    }

    if (chain.clientStreamId !== undefined) {
      this.byStreamId.set(chain.clientStreamId, chain)
    }
    if (chain.serverStreamId !== undefined) {
      this.byStreamId.set(chain.serverStreamId, chain)
    }
    return chain
  }

  /**
   * Attach a server streamId to a chain that currently lacks one (typically
   * the reconciliation step for a temp-id create). Asserts the chain has no
   * existing server streamId and the new streamId is not bound to another chain.
   */
  attachServerStreamId(chain: AggregateChain, serverStreamId: string): void {
    assert(
      chain.serverStreamId === undefined,
      `chain already has serverStreamId=${chain.serverStreamId}`,
    )
    assert(!this.byStreamId.has(serverStreamId), `serverStreamId already bound: ${serverStreamId}`)
    chain.serverStreamId = serverStreamId
    this.byStreamId.set(serverStreamId, chain)
  }

  /**
   * Symmetric attach for the rare case a server-initiated chain later gains a
   * client streamId. Asserts the chain has no existing client streamId and the
   * new streamId is not bound to another chain.
   */
  attachClientStreamId(chain: AggregateChain, clientStreamId: string): void {
    assert(
      chain.clientStreamId === undefined,
      `chain already has clientStreamId=${chain.clientStreamId}`,
    )
    assert(!this.byStreamId.has(clientStreamId), `clientStreamId already bound: ${clientStreamId}`)
    chain.clientStreamId = clientStreamId
    this.byStreamId.set(clientStreamId, chain)
  }

  /**
   * Remove both index entries for the chain. The chain object becomes orphaned
   * and should not be used by callers after this call.
   */
  remove(chain: AggregateChain): void {
    if (chain.clientStreamId !== undefined) {
      this.byStreamId.delete(chain.clientStreamId)
    }
    if (chain.serverStreamId !== undefined) {
      this.byStreamId.delete(chain.serverStreamId)
    }
  }

  find(predicate: (chain: AggregateChain) => boolean): AggregateChain | undefined {
    for (const chain of this.chains()) {
      if (predicate(chain)) return chain
    }
    return undefined
  }

  /**
   * Detach a command from any chains that still reference it. Clears
   * `createCommandId`/`createdEntityId` and `latestCommandId` on matching chains.
   * Preserves `lastKnownRevision` (valid server state from a prior success).
   * Chain objects remain in the registry. Idempotent.
   *
   * Caller passes the streamIds the command touched (typically
   * `command.affectedAggregates.map(a => a.streamId)`). Dual-indexing means only
   * one side of any pair needs to be in the iterable — the chain object is the
   * same via either key.
   */
  onCommandCleanup(commandId: string, streamIds: Iterable<string>): void {
    const seen = new Set<AggregateChain>()
    for (const streamId of streamIds) {
      const chain = this.byStreamId.get(streamId)
      if (!chain || seen.has(chain)) continue
      seen.add(chain)
      if (chain.createCommandId === commandId) {
        chain.createCommandId = undefined
        chain.createdEntityId = undefined
      }
      if (chain.latestCommandId === commandId) {
        chain.latestCommandId = undefined
      }
    }
  }

  /** Iterate distinct chains (dual-indexed chains appear once). */
  *chains(): IterableIterator<AggregateChain> {
    const seen = new Set<AggregateChain>()
    for (const chain of this.byStreamId.values()) {
      if (seen.has(chain)) continue
      seen.add(chain)
      yield chain
    }
  }

  clear(): void {
    this.byStreamId.clear()
  }

  /** Number of distinct chains (dual-indexed chains count once). */
  get size(): number {
    return new Set(this.byStreamId.values()).size
  }
}
