/**
 * Storage interface for the CQRS Client.
 * Provides an abstraction over different storage backends (in-memory, SQLite).
 */

import type { Link } from '@meticoeus/ddd-es'
import { CommandFilter, CommandRecord, CommandStatus, EnqueueCommand } from '../types/commands.js'

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
  persistence: 'Permanent' | 'Stateful' | 'Anticipated'
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
   * @see {@link Collection.getStreamId} for the 1:1 aggregate assumption this relies on.
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
 * Maps a client-generated temporary ID to server reconciliation data.
 * Used to silently correct stale client IDs in command payloads when the UI
 * hasn't re-rendered with the server-assigned data yet.
 */
export interface CommandIdMappingRecord {
  /** Client-generated temporary aggregate ID */
  clientId: string
  /** Server-assigned aggregate ID */
  serverId: string
  /** JSON-serialized reconciliation data (revision, commandType, serverResponse) */
  data: string
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
   * Get a command by ID.
   */
  getCommand(commandId: string): Promise<CommandRecord<TLink, TCommand> | undefined>

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
   * Remove a cache key association from all events.
   * Deletes events that have no remaining cache key associations.
   * Returns the IDs of events that were fully deleted.
   */
  removeCacheKeyFromEvents(cacheKey: string): Promise<string[]>

  /**
   * Add cache key associations to an existing event.
   * Used when a WS event is relevant to additional active cache keys.
   */
  addCacheKeysToEvent(eventId: string, cacheKeys: string[]): Promise<void>

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
  getCommandIdMapping(clientId: string): Promise<CommandIdMappingRecord | undefined>

  /**
   * Get a command ID mapping by server ID.
   */
  getCommandIdMappingByServerId(serverId: string): Promise<CommandIdMappingRecord | undefined>

  /**
   * Save a command ID mapping.
   */
  saveCommandIdMapping(record: CommandIdMappingRecord): Promise<void>

  /**
   * Delete command ID mappings older than a timestamp.
   */
  deleteCommandIdMappingsOlderThan(timestamp: number): Promise<void>

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
