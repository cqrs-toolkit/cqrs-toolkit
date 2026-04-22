/**
 * Storage interface for the CQRS Client.
 * Provides an abstraction over different storage backends (in-memory, SQLite).
 */

import type { Link } from '@meticoeus/ddd-es'
import { CommandFilter, CommandRecord, CommandStatus, EnqueueCommand } from '../types/commands.js'
import { EntityId, EventPersistence } from '../types/index.js'

/**
 * Session record stored in the database.
 */
export interface SessionRecord {
  /** Always 1 - single session constraint */
  id: 1
  /** User identifier */
  userId: string
  /** Session creation timestamp */
  createdAt: number
  /** Last activity timestamp */
  lastSeenAt: number
}

/**
 * Cache key record — persisted metadata for a cache key identity.
 * Stores the full identifying tuple so the identity can be rehydrated on reload.
 */
export interface CacheKeyRecord {
  /** Cache key identifier (UUID v5 derived) */
  key: string
  /** Cache key kind */
  kind: 'entity' | 'scope'
  /** Entity: ServiceLink.service (null for plain Link or scope keys) */
  linkService: string | null
  /** Entity: Link.type (null for scope keys) */
  linkType: string | null
  /** Entity: Link.id (null for scope keys) */
  linkId: string | null
  /** Scope: optional service context (null for entity keys) */
  service: string | null
  /** Scope: scope type identifier (null for entity keys) */
  scopeType: string | null
  /** Scope: JSON-serialized scope params (null for entity keys or parameterless scopes) */
  scopeParams: string | null
  /** Parent cache key for hierarchical eviction (null if top-level) */
  parentKey: string | null
  /** Eviction policy — persistent keys can be frozen and survive restarts; ephemeral keys cannot */
  evictionPolicy: 'persistent' | 'ephemeral'
  /** Whether the cache key is frozen */
  frozen: boolean
  /** Timestamp when the key was frozen (null if not frozen) */
  frozenAt: number | null
  /** Whether the cache key inherits frozen state from an ancestor */
  inheritedFrozen: boolean
  /** Last access timestamp */
  lastAccessedAt: number
  /** TTL expiration timestamp (null = no expiration) */
  expiresAt: number | null
  /** Creation timestamp */
  createdAt: number
  /** Hold count (prevents eviction when > 0) */
  holdCount: number
  /** Estimated size in bytes for quota-aware eviction prioritization */
  estimatedSizeBytes: number | null
  /**
   * JSON-serialized array of pending ID mappings awaiting command resolution.
   * Each entry: `{ commandId: string; clientId: string; paramKey?: string }`.
   * Null when no IDs are pending (fully resolved or never had pending IDs).
   */
  pendingIdMappings: string | null
}

/**
 * Cached event record.
 */
export interface CachedEventRecord {
  /** Event ID */
  id: string
  /** Event type */
  type: string
  /** Stream ID */
  streamId: string
  /** Event persistence type */
  persistence: EventPersistence
  /** Event data (JSON serialized) */
  data: string
  /** Global position (for Permanent events) */
  position: string | null // BigInt as string
  /** Stream revision (for Permanent events) */
  revision: string | null // BigInt as string
  /** Command ID (for Anticipated events) */
  commandId: string | null
  /** Cache keys this event is associated with (junction table in SQL, array in memory) */
  cacheKeys: string[]
  /** Event creation timestamp */
  createdAt: number
  /** Timestamp when the event was processed into the read model. Null if not yet processed. */
  processedAt: number | null
}

/**
 * Client-side metadata for read model identity tracking.
 *
 * Persists the original client-generated temp ID through ID reconciliation
 * so the UI can maintain stable entity references (selection, URLs) when the
 * server assigns a different permanent ID.
 */
export interface ClientMetadata {
  /** Original client-generated temp ID, set at anticipated-event creation time. */
  clientId: string
  /** Timestamp when the server ID replaced the client ID. Undefined until reconciliation. */
  reconciledAt?: number
}

/**
 * Read model record.
 */
export interface ReadModelRecord {
  /** Entity ID */
  id: string
  /** Collection name */
  collection: string
  /** Cache keys this record is associated with (junction table in SQL, array in memory) */
  cacheKeys: string[]
  /** Server baseline data (JSON serialized) */
  serverData: string | null
  /** Effective data including optimistic updates (JSON serialized) */
  effectiveData: string
  /** Whether this record has local modifications */
  hasLocalChanges: boolean
  /** Last update timestamp */
  updatedAt: number
  /**
   * Stream revision of the last event that updated this read model (bigint as string).
   * Null for locally-created entries.
   *
   * A scalar revision is sufficient because each {@link Collection} tracks exactly
   * one aggregate via its required `aggregate` field — the revision is that aggregate's
   * stream position. A future `CompositeCollection` type built from multiple aggregates
   * would need a per-aggregate revision map instead.
   */
  revision: string | null
  /** Global position of the last event that updated this read model (bigint as string). Null for locally-created entries. */
  position: string | null
  /**
   * Client-side identity tracking metadata.
   * Set when an anticipated event creates a read model entry from a command
   * with `creates.idStrategy === 'temporary'`. Persists through reconciliation
   * so the Solid query primitive can maintain stable references.
   * Null for server-seeded entries and non-create commands.
   */
  _clientMetadata: ClientMetadata | null
}

/**
 * Command ID mapping record.
 * Maps a client-generated temporary ID to its server-assigned replacement.
 * Used to silently correct stale client IDs in command payloads when the UI
 * hasn't re-rendered with the server-assigned data yet, and to stamp
 * `_clientMetadata.clientId` on reconciled read models so UI code can still
 * reference the tempId.
 */
export interface CommandIdMappingRecord {
  /** Client-generated temporary aggregate ID */
  clientId: string
  /** Server-assigned aggregate ID */
  serverId: string
  /** Timestamp when the mapping was created */
  createdAt: number
}

/**
 * Query options for list operations.
 */
export interface IStorageQueryOptions {
  limit?: number
  offset?: number
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
}

export interface MigrateReadModelIdParams {
  collection: string
  fromId: string
  toId: string
  effectiveData: string
  serverData: string | null
  hasLocalChanges: boolean
  updatedAt: number
}

export interface UpdateCommandsEntry<TLink extends Link, TCommand extends EnqueueCommand> {
  commandId: string
  updates: Partial<CommandRecord<TLink, TCommand>>
}

export interface AddCacheKeysToEventEntry {
  eventId: string
  cacheKeys: readonly string[]
}

export interface DeleteReadModelEntry {
  collection: string
  id: string
}

export interface AddCacheKeysToReadModelEntry {
  collection: string
  id: string
  cacheKeys: readonly string[]
}

/**
 * Storage interface.
 * All methods are async to support both sync (in-memory) and async (SQLite) backends.
 */
export interface IStorage<TLink extends Link, TCommand extends EnqueueCommand> {
  // Lifecycle
  /**
   * Initialize the storage backend.
   * For SQLite, this creates tables and runs migrations.
   */
  initialize(): Promise<void>

  /**
   * Close the storage backend and release resources.
   */
  close(): Promise<void>

  /**
   * Clear all data from storage.
   */
  clear(): Promise<void>

  // Session operations
  /**
   * Get the current session, if any.
   */
  getSession(): Promise<SessionRecord | undefined>

  /**
   * Save or update the session.
   */
  saveSession(session: SessionRecord): Promise<void>

  /**
   * Delete the current session and all associated data.
   */
  deleteSession(): Promise<void>

  /**
   * Update the last seen timestamp.
   */
  touchSession(): Promise<void>

  // Cache key operations
  /**
   * Get a cache key record.
   */
  getCacheKey(key: string): Promise<CacheKeyRecord | undefined>

  /**
   * Get all cache keys.
   */
  getAllCacheKeys(): Promise<CacheKeyRecord[]>

  /**
   * Save or update a cache key.
   */
  saveCacheKey(record: CacheKeyRecord): Promise<void>

  /**
   * Delete a cache key and all associated data.
   */
  deleteCacheKey(key: string): Promise<void>

  /**
   * Delete multiple cache keys and their associated events/read models in a batch.
   */
  deleteCacheKeys(keys: string[]): Promise<void>

  /**
   * Save multiple cache key records in a batch.
   */
  saveCacheKeys(records: CacheKeyRecord[]): Promise<void>

  /**
   * Increment hold count for a cache key.
   */
  holdCacheKey(key: string): Promise<void>

  /**
   * Decrement hold count for a cache key.
   */
  releaseCacheKey(key: string): Promise<void>

  /**
   * Touch a cache key (update lastAccessedAt).
   */
  touchCacheKey(key: string): Promise<void>

  /**
   * Get child cache keys whose parentKey matches the given key.
   */
  getChildCacheKeys(parentKey: string): Promise<CacheKeyRecord[]>

  /**
   * Get cache keys eligible for eviction (leaf keys with holdCount = 0, not frozen or inheritedFrozen).
   */
  getEvictableCacheKeys(limit: number): Promise<CacheKeyRecord[]>

  /**
   * Filter an array of cache key strings to only those that exist in storage.
   */
  filterExistingCacheKeys(keys: string[]): Promise<string[]>

  // Command operations

  /**
   * Get the current command sequence number. Used by CommandStore to initialize
   * its local sequence counter so new commands get monotonically increasing seq values.
   *
   * - SQLiteStorage: reads MAX(seq) from the commands table (TODO: use sqlite_sequence for accuracy after deletes).
   * - InMemoryStorage: always returns 0 (nothing to load on startup).
   */
  getCommandSequence(): Promise<number>

  /**
   * Get a command by ID.
   */
  getCommand(commandId: string): Promise<CommandRecord<TLink, TCommand> | undefined>

  /**
   * Batch-fetch commands by ID. Returns a `Map` keyed by commandId; absent
   * keys mean the command is not in storage. Callers relying on batch
   * semantics (e.g. CommandStore's `getByIds`) must prefer this over
   * iterated {@link getCommand} calls — SQLite runs a single
   * `WHERE command_id IN (...)` query.
   */
  getCommandsByIds(
    commandIds: readonly string[],
  ): Promise<Map<string, CommandRecord<TLink, TCommand>>>

  /**
   * Get commands matching a filter.
   */
  getCommands(filter?: CommandFilter): Promise<CommandRecord<TLink, TCommand>[]>

  /**
   * Get commands by status.
   */
  getCommandsByStatus(
    status: CommandStatus | CommandStatus[],
  ): Promise<CommandRecord<TLink, TCommand>[]>

  /**
   * Get commands blocked by a specific command.
   */
  getCommandsBlockedBy(commandId: string): Promise<CommandRecord<TLink, TCommand>[]>

  /**
   * Save a new command.
   */
  saveCommand(command: CommandRecord<TLink, TCommand>): Promise<void>

  /**
   * Update an existing command.
   */
  updateCommand(commandId: string, updates: Partial<CommandRecord<TLink, TCommand>>): Promise<void>

  /**
   * Apply multiple command updates in a single call.
   * Each entry is applied independently — partial updates to `CommandRecord`
   * keyed by `commandId`. Used by reconcile workflows that need to save N
   * rewritten commands without N round-trips.
   */
  updateCommands(updates: readonly UpdateCommandsEntry<TLink, TCommand>[]): Promise<void>

  /**
   * Delete a command.
   */
  deleteCommand(commandId: string): Promise<void>

  /**
   * Delete all commands (e.g., on session clear).
   */
  deleteAllCommands(): Promise<void>

  // Event cache operations
  /**
   * Get a cached event by ID.
   */
  getCachedEvent(id: string): Promise<CachedEventRecord | undefined>

  /**
   * Partition a batch of event IDs by whether they already exist in the
   * cache. Returns the subset of ids that are already stored. Used by the
   * WS drain dedup pass to split a batch into "new" (continue processing)
   * and "already-seen" (just add cache-key associations and skip) without
   * hitting the store N times.
   */
  getExistingCachedEventIds(ids: readonly string[]): Promise<Set<string>>

  /**
   * Get cached events for a cache key.
   */
  getCachedEventsByCacheKey(cacheKey: string): Promise<CachedEventRecord[]>

  /**
   * Get cached events for a stream.
   */
  getCachedEventsByStream(streamId: string): Promise<CachedEventRecord[]>

  /**
   * Get anticipated events for a command.
   */
  getAnticipatedEventsByCommand(commandId: string): Promise<CachedEventRecord[]>

  /**
   * Get every cached event with `persistence === 'Anticipated'`. Used by
   * reconciliation to bulk-load all pending optimistic overlays in a single
   * query rather than N per-command queries.
   */
  getAllAnticipatedEvents(): Promise<CachedEventRecord[]>

  /**
   * Save a cached event.
   */
  saveCachedEvent(event: CachedEventRecord): Promise<void>

  /**
   * Save multiple cached events in a batch.
   */
  saveCachedEvents(events: CachedEventRecord[]): Promise<void>

  /**
   * Delete a cached event.
   */
  deleteCachedEvent(id: string): Promise<void>

  /**
   * Mark cached events as processed by setting processed_at timestamp.
   */
  markCachedEventsProcessed(ids: string[]): Promise<void>

  /**
   * Delete cached events that were processed before the given timestamp.
   * Cleans up both the events table and the junction table.
   * Returns the number of events deleted.
   */
  deleteProcessedCachedEvents(olderThan: number): Promise<number>

  /**
   * Delete all anticipated events for a command.
   */
  deleteAnticipatedEventsByCommand(commandId: string): Promise<void>

  /**
   * Delete all anticipated events for a set of commands in a single call.
   * Used by reconcile to clear stale overlays for every re-run command in
   * one storage round-trip.
   */
  deleteAnticipatedEventsByCommands(commandIds: readonly string[]): Promise<void>

  /**
   * Remove a cache key association from all events.
   * Deletes events that have no remaining cache key associations.
   * Returns the IDs of events that were fully deleted.
   */
  removeCacheKeyFromEvents(cacheKey: string): Promise<string[]>

  /**
   * Add cache-key associations to multiple existing events in a single
   * storage round-trip. Used when a WS drain batch contains events that
   * were already cached but under a different active cache-key set.
   */
  addCacheKeysToEvents(entries: readonly AddCacheKeysToEventEntry[]): Promise<void>

  // Read model operations
  /**
   * Get a read model record.
   */
  getReadModel(collection: string, id: string): Promise<ReadModelRecord | undefined>

  /**
   * Get all read model records for a collection.
   */
  getReadModelsByCollection(
    collection: string,
    options?: IStorageQueryOptions,
  ): Promise<ReadModelRecord[]>

  /**
   * Get read model records by cache key.
   */
  getReadModelsByCacheKey(cacheKey: string): Promise<ReadModelRecord[]>

  /**
   * Count read model records in a collection, optionally filtered by cache key.
   */
  countReadModels(collection: string, cacheKey?: string): Promise<number>

  /**
   * Batch-fetch read model records for a set of `(collection, id)` pairs.
   * Returns a `Map` keyed by `${collection}:${id}`; missing rows are absent
   * from the map. Callers relying on batch semantics (e.g. the sync pipeline
   * and the CommandQueue success path) must prefer this over iterated
   * {@link getReadModel} calls.
   *
   * TODO(batch): SQLite implementation should group by collection and run
   * one `WHERE id IN (...)` per collection. The in-memory implementation
   * remains a straight filter over its map.
   */
  getReadModels(
    pairs: Iterable<{ collection: string; id: string }>,
  ): Promise<Map<string, ReadModelRecord>>

  /**
   * Save a read model record.
   */
  saveReadModel(record: ReadModelRecord): Promise<void>

  /**
   * Save multiple read model records in a batch.
   */
  saveReadModels(records: ReadModelRecord[]): Promise<void>

  /**
   * Delete a read model record.
   */
  deleteReadModel(collection: string, id: string): Promise<void>

  /**
   * Delete multiple read model records in a single storage round-trip.
   * Entries may span different collections; each collection's data table
   * and cache-key junction table are deleted together.
   */
  deleteReadModels(entries: readonly DeleteReadModelEntry[]): Promise<void>

  /**
   * Rewrite a read-model row's primary key from `fromId` to `toId` and
   * update its data columns in the same operation. Also remaps any cache-key
   * junction entries so associations survive the id change.
   *
   * The library's source of truth for "where data lives" is `(collection, id)`,
   * so an id migration is a primary-key change — not an insert-new + delete-old.
   * Implementations should perform the update in place (single `UPDATE` per
   * backing table) rather than copy + delete, to avoid transient missing rows
   * and to keep the round-trip count minimal.
   *
   * No-op when no row exists at `(collection, fromId)`.
   */
  migrateReadModelIds(batch: MigrateReadModelIdParams[]): Promise<void>

  /**
   * Remove a cache key association from all read models.
   * Deletes read models that have no remaining cache key associations.
   */
  removeCacheKeyFromReadModels(cacheKey: string): Promise<void>

  /**
   * Add cache key associations to an existing read model.
   * Used when a read model is relevant to additional active cache keys.
   */
  addCacheKeysToReadModel(collection: string, id: string, cacheKeys: string[]): Promise<void>

  /**
   * Add cache-key associations to multiple existing read models in a single
   * storage round-trip. Entries may span different collections; each
   * collection's junction table is written with its subset of rows.
   */
  addCacheKeysToReadModels(entries: readonly AddCacheKeysToReadModelEntry[]): Promise<void>

  /**
   * Delete all read model records for a collection.
   */
  deleteReadModelsByCollection(collection: string): Promise<void>

  /**
   * Get the total count of read model records.
   */
  getReadModelCount(): Promise<number>

  /**
   * Get all (id, revision) pairs for read models in a collection that have a non-null revision.
   * Used by SyncManager to restore knownRevisions on startup.
   */
  getReadModelRevisions(collection: string): Promise<Array<{ id: string; revision: string }>>

  // Command ID mapping operations (create reconciliation)

  /**
   * Get a command ID mapping by client ID.
   */
  getCommandIdMapping(clientId: EntityId): Promise<CommandIdMappingRecord | undefined>

  /**
   * Get a command ID mapping by server ID.
   */
  getCommandIdMappingByServerId(serverId: string): Promise<CommandIdMappingRecord | undefined>

  /**
   * Save a command ID mapping.
   */
  saveCommandIdMapping(record: CommandIdMappingRecord): Promise<void>

  /**
   * Save multiple command ID mappings in a single call.
   * Used by reconcile to persist the full idMap from a single WS batch.
   */
  saveCommandIdMappings(records: readonly CommandIdMappingRecord[]): Promise<void>

  /**
   * Delete command ID mappings older than a timestamp.
   */
  deleteCommandIdMappingsOlderThan(timestamp: number): Promise<void>

  /**
   * Purge expired mappings and return all remaining mappings in a single
   * transaction. Used by `CommandIdMappingStore.initialize()` to hydrate its
   * in-memory state while also enforcing the TTL, without a second round trip.
   *
   * Implementations execute (in order): delete WHERE created_at < `purgeOlderThan`,
   * then select all remaining records.
   */
  loadAndPurgeCommandIdMappings(purgeOlderThan: number): Promise<CommandIdMappingRecord[]>

  /**
   * Delete all command ID mappings (e.g., on session clear).
   */
  deleteAllCommandIdMappings(): Promise<void>

  // Transaction support (optional)
  /**
   * Begin a transaction.
   * Returns a transaction handle that can be passed to other methods.
   */
  beginTransaction?(): Promise<unknown>

  /**
   * Commit a transaction.
   */
  commitTransaction?(tx: unknown): Promise<void>

  /**
   * Rollback a transaction.
   */
  rollbackTransaction?(tx: unknown): Promise<void>
}
