/**
 * Command id mapping store interface.
 *
 * Owns the clientId → serverId reconciliation records produced when a create
 * command with a temporary id succeeds. Callers read synchronously from an
 * in-memory index; writes mutate the index immediately and persist lazily via
 * the underlying storage.
 *
 * Durable backing: records are loaded from storage at `initialize()` (with TTL
 * purge applied in the same transaction) and persisted in batches by a flush
 * queue. A shared worker that dies and restarts rebuilds its in-memory state
 * from storage via `initialize()`.
 */

import type { CommandIdMappingRecord } from '../../storage/IStorage.js'

export interface ICommandIdMappingStore {
  /**
   * Load all non-expired mappings from storage into memory, purging expired
   * records in the same transaction. Must be awaited before any read or write.
   */
  initialize(): Promise<void>

  /**
   * Get a mapping by client id. Synchronous — reads from the in-memory index.
   * Returns `undefined` when no mapping exists or the record has expired locally.
   */
  get(clientId: string): CommandIdMappingRecord | undefined

  /**
   * Get a mapping by server id (reverse lookup). Synchronous.
   */
  getByServerId(serverId: string): CommandIdMappingRecord | undefined

  /**
   * Batch variant of {@link get}: resolve many client ids in one call.
   * Returns a Map keyed by the queried client id; absent entries mean no
   * mapping exists (or the record has expired locally).
   */
  getMany(clientIds: readonly string[]): Map<string, CommandIdMappingRecord>

  /**
   * Save a mapping. Mutates the in-memory index immediately and marks the
   * record dirty for asynchronous flush to storage. Returns once the dirty
   * mark has been recorded — it does NOT await the flush.
   */
  save(record: CommandIdMappingRecord): void

  /**
   * Batch variant of {@link save}.
   */
  saveMany(records: readonly CommandIdMappingRecord[]): void

  /**
   * Delete all mappings from both the in-memory index and durable storage.
   */
  deleteAll(): Promise<void>

  /**
   * Force any pending writes to storage. Awaits an in-flight flush if one is
   * already running, then issues another if new writes arrived in the meantime.
   */
  flush(): Promise<void>

  /**
   * Flush pending writes and release resources (stops the TTL sweep timer).
   */
  destroy(): Promise<void>

  /** Number of mappings currently in the in-memory index. */
  readonly size: number
}
