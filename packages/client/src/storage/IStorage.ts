/**
 * Storage interface for the CQRS Client.
 * Provides an abstraction over different storage backends (in-memory, SQLite).
 */

import type { CommandFilter, CommandRecord, CommandStatus } from '../types/commands.js'

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
 * Cache key record.
 */
export interface CacheKeyRecord {
  /** Cache key identifier (UUID v5 derived) */
  key: string
  /** Last access timestamp */
  lastAccessedAt: number
  /** Hold count (prevents eviction when > 0) */
  holdCount: number
  /** Whether the cache key is frozen */
  frozen: boolean
  /** TTL expiration timestamp (null = no expiration) */
  expiresAt: number | null
  /** Creation timestamp */
  createdAt: number
  /** Eviction policy — persistent keys can be frozen and survive restarts; ephemeral keys cannot */
  evictionPolicy: 'persistent' | 'ephemeral'
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
  /** Cache key this event belongs to */
  cacheKey: string
  /** Event creation timestamp */
  createdAt: number
}

/**
 * Read model record.
 */
export interface ReadModelRecord {
  /** Entity ID */
  id: string
  /** Collection name */
  collection: string
  /** Cache key this record belongs to */
  cacheKey: string
  /** Server baseline data (JSON serialized) */
  serverData: string | null
  /** Effective data including optimistic updates (JSON serialized) */
  effectiveData: string
  /** Whether this record has local modifications */
  hasLocalChanges: boolean
  /** Last update timestamp */
  updatedAt: number
}

/**
 * Query options for list operations.
 */
export interface QueryOptions {
  limit?: number
  offset?: number
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
}

/**
 * Storage interface.
 * All methods are async to support both sync (in-memory) and async (SQLite) backends.
 */
export interface IStorage {
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
   * Get cache keys eligible for eviction (holdCount = 0, not frozen).
   */
  getEvictableCacheKeys(limit: number): Promise<CacheKeyRecord[]>

  // Command operations
  /**
   * Get a command by ID.
   */
  getCommand(commandId: string): Promise<CommandRecord | undefined>

  /**
   * Get commands matching a filter.
   */
  getCommands(filter?: CommandFilter): Promise<CommandRecord[]>

  /**
   * Get commands by status.
   */
  getCommandsByStatus(status: CommandStatus | CommandStatus[]): Promise<CommandRecord[]>

  /**
   * Get commands blocked by a specific command.
   */
  getCommandsBlockedBy(commandId: string): Promise<CommandRecord[]>

  /**
   * Save a new command.
   */
  saveCommand(command: CommandRecord): Promise<void>

  /**
   * Update an existing command.
   */
  updateCommand(commandId: string, updates: Partial<CommandRecord>): Promise<void>

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
   * Delete all anticipated events for a command.
   */
  deleteAnticipatedEventsByCommand(commandId: string): Promise<void>

  /**
   * Delete all cached events for a cache key.
   */
  deleteCachedEventsByCacheKey(cacheKey: string): Promise<void>

  // Read model operations
  /**
   * Get a read model record.
   */
  getReadModel(collection: string, id: string): Promise<ReadModelRecord | undefined>

  /**
   * Get all read model records for a collection.
   */
  getReadModelsByCollection(collection: string, options?: QueryOptions): Promise<ReadModelRecord[]>

  /**
   * Get read model records by cache key.
   */
  getReadModelsByCacheKey(cacheKey: string): Promise<ReadModelRecord[]>

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
   * Delete all read model records for a cache key.
   */
  deleteReadModelsByCacheKey(cacheKey: string): Promise<void>

  /**
   * Delete all read model records for a collection.
   */
  deleteReadModelsByCollection(collection: string): Promise<void>

  /**
   * Get the total count of read model records.
   */
  getReadModelCount(): Promise<number>

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
