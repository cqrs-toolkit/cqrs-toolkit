/**
 * SQLite storage implementation.
 *
 * Always receives an injected `ISqliteDb` — never loads WASM or opens
 * databases itself.  Two creation paths exist upstream:
 *
 * - **Mode C** (DedicatedWorker): `loadAndOpenDb()` → `LocalSqliteDb`
 * - **Mode B** (SharedWorker): `RemoteSqliteDb` proxying to a child worker
 */

import { assert } from '#utils'
import { Link } from '@meticoeus/ddd-es'
import { CommandFilter, CommandRecord, CommandStatus, EnqueueCommand } from '../types/commands.js'
import type { SchemaMigration } from '../types/config.js'
import { EntityId, entityIdToString } from '../types/index.js'
import { execStmt, ISqliteDb, queryStmt, SqliteBatchStatement } from './ISqliteDb.js'
import {
  AddCacheKeysToEventEntry,
  AddCacheKeysToReadModelEntry,
  CachedEventRecord,
  CacheKeyRecord,
  DeleteReadModelEntry,
  IStorage,
  IStorageQueryOptions,
  MigrateReadModelIdParams,
  ReadModelRecord,
  SessionRecord,
  UpdateCommandsEntry,
} from './IStorage.js'
import { getCollectionNames, getSqlForStep, validateSchemaMigrations } from './schema/rm-schema.js'

const MIGRATIONS_TABLE = `CREATE TABLE migrations (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
)`

/**
 * SQLite storage configuration.
 */
export interface SQLiteStorageConfig {
  /** Injected async SQLite database handle */
  db: ISqliteDb
  /** Schema migrations — validated at construction time */
  migrations: [SchemaMigration, ...SchemaMigration[]]
}

/**
 * SQLite storage implementation.
 */
export class SQLiteStorage<TLink extends Link, TCommand extends EnqueueCommand> implements IStorage<
  TLink,
  TCommand
> {
  private readonly db: ISqliteDb
  private readonly migrations: [SchemaMigration, ...SchemaMigration[]]
  private readonly collections: Set<string>
  private initialized = false

  constructor(config: SQLiteStorageConfig) {
    validateSchemaMigrations(config.migrations)
    this.db = config.db
    this.migrations = config.migrations
    this.collections = new Set(getCollectionNames(config.migrations))
  }

  // Lifecycle

  async initialize(): Promise<void> {
    if (this.initialized) return

    await this.runMigrations()

    this.initialized = true
  }

  async close(): Promise<void> {
    await this.db.close()
    this.initialized = false
  }

  async clear(): Promise<void> {
    this.assertInitialized()
    // Delete all data but keep schema
    await this.exec('DELETE FROM session')
    await this.exec('DELETE FROM cache_keys')
    await this.exec('DELETE FROM commands')
    await this.exec('DELETE FROM cached_event_cache_keys')
    await this.exec('DELETE FROM cached_events')
    for (const name of this.collections) {
      await this.exec(`DELETE FROM rm_${name}_cache_keys`)
      await this.exec(`DELETE FROM ${this.rmTable(name)}`)
    }
  }

  // Session operations

  async getSession(): Promise<SessionRecord | undefined> {
    this.assertInitialized()
    const row = await this.queryOne<{
      id: number
      user_id: string
      created_at: number
      last_seen_at: number
    }>('SELECT * FROM session WHERE id = 1')

    if (!row) return undefined

    return {
      id: 1,
      userId: row.user_id,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
    }
  }

  async saveSession(session: SessionRecord): Promise<void> {
    this.assertInitialized()
    await this.exec(
      `INSERT INTO session (id, user_id, created_at, last_seen_at)
VALUES (1, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  user_id=excluded.user_id,
  created_at=excluded.created_at,
  last_seen_at=excluded.last_seen_at`,
      [session.userId, session.createdAt, session.lastSeenAt],
    )
  }

  async deleteSession(): Promise<void> {
    this.assertInitialized()
    const statements: SqliteBatchStatement[] = [
      { sql: 'DELETE FROM session' },
      { sql: 'DELETE FROM cache_keys' },
      { sql: 'DELETE FROM commands' },
      { sql: 'DELETE FROM command_id_mappings' },
      { sql: 'DELETE FROM cached_event_cache_keys' },
      { sql: 'DELETE FROM cached_events' },
    ]
    for (const name of this.collections) {
      statements.push({ sql: `DELETE FROM rm_${name}_cache_keys` })
      statements.push({ sql: `DELETE FROM ${this.rmTable(name)}` })
    }
    await this.db.execBatch(statements)
  }

  async touchSession(): Promise<void> {
    this.assertInitialized()
    await this.exec('UPDATE session SET last_seen_at = ? WHERE id = 1', [Date.now()])
  }

  // Cache key operations

  async getCacheKey(key: string): Promise<CacheKeyRecord | undefined> {
    this.assertInitialized()
    const row = await this.queryOne<CacheKeyRow>('SELECT * FROM cache_keys WHERE key = ?', [key])

    if (!row) return undefined

    return this.rowToCacheKey(row)
  }

  async getAllCacheKeys(): Promise<CacheKeyRecord[]> {
    this.assertInitialized()
    const rows = await this.query<CacheKeyRow>('SELECT * FROM cache_keys')
    return rows.map((row) => this.rowToCacheKey(row))
  }

  async saveCacheKey(record: CacheKeyRecord): Promise<void> {
    this.assertInitialized()
    await this.exec(
      `INSERT INTO cache_keys
(key, kind, link_service, link_type, link_id, service, scope_type, scope_params, parent_key, eviction_policy, frozen, frozen_at, inherited_frozen, last_accessed_at, expires_at, created_at, hold_count, estimated_size_bytes, pending_id_mappings)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(key) DO UPDATE SET
  kind=excluded.kind,
  link_service=excluded.link_service,
  link_type=excluded.link_type,
  link_id=excluded.link_id,
  service=excluded.service,
  scope_type=excluded.scope_type,
  scope_params=excluded.scope_params,
  parent_key=excluded.parent_key,
  eviction_policy=excluded.eviction_policy,
  frozen=excluded.frozen,
  frozen_at=excluded.frozen_at,
  inherited_frozen=excluded.inherited_frozen,
  last_accessed_at=excluded.last_accessed_at,
  expires_at=excluded.expires_at,
  created_at=excluded.created_at,
  hold_count=excluded.hold_count,
  estimated_size_bytes=excluded.estimated_size_bytes,
  pending_id_mappings=excluded.pending_id_mappings`,
      [
        record.key,
        record.kind,
        record.linkService,
        record.linkType,
        record.linkId,
        record.service,
        record.scopeType,
        record.scopeParams,
        record.parentKey,
        record.evictionPolicy,
        record.frozen ? 1 : 0,
        record.frozenAt,
        record.inheritedFrozen ? 1 : 0,
        record.lastAccessedAt,
        record.expiresAt,
        record.createdAt,
        record.holdCount,
        record.estimatedSizeBytes,
        record.pendingIdMappings,
      ],
    )
  }

  async deleteCacheKey(key: string): Promise<void> {
    this.assertInitialized()
    const statements: SqliteBatchStatement[] = [
      { sql: 'DELETE FROM cache_keys WHERE key = ?', bind: [key] },
      ...this.buildRemoveCacheKeyFromEvents(key),
      ...this.buildRemoveCacheKeyFromReadModels(key),
    ]
    await this.db.execBatch(statements)
  }

  async deleteCacheKeys(keys: string[]): Promise<void> {
    if (keys.length === 0) return
    this.assertInitialized()
    const statements: SqliteBatchStatement[] = []
    for (const key of keys) {
      statements.push({ sql: 'DELETE FROM cache_keys WHERE key = ?', bind: [key] })
      statements.push(...this.buildRemoveCacheKeyFromEvents(key))
      statements.push(...this.buildRemoveCacheKeyFromReadModels(key))
    }
    await this.db.execBatch(statements)
  }

  async saveCacheKeys(records: CacheKeyRecord[]): Promise<void> {
    if (records.length === 0) return
    this.assertInitialized()
    const statements: SqliteBatchStatement[] = records.map((record) => ({
      sql: `INSERT INTO cache_keys
(key, kind, link_service, link_type, link_id, service, scope_type, scope_params, parent_key, eviction_policy, frozen, frozen_at, inherited_frozen, last_accessed_at, expires_at, created_at, hold_count, estimated_size_bytes, pending_id_mappings)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(key) DO UPDATE SET
  kind=excluded.kind,
  link_service=excluded.link_service,
  link_type=excluded.link_type,
  link_id=excluded.link_id,
  service=excluded.service,
  scope_type=excluded.scope_type,
  scope_params=excluded.scope_params,
  parent_key=excluded.parent_key,
  eviction_policy=excluded.eviction_policy,
  frozen=excluded.frozen,
  frozen_at=excluded.frozen_at,
  inherited_frozen=excluded.inherited_frozen,
  last_accessed_at=excluded.last_accessed_at,
  expires_at=excluded.expires_at,
  created_at=excluded.created_at,
  hold_count=excluded.hold_count,
  estimated_size_bytes=excluded.estimated_size_bytes,
  pending_id_mappings=excluded.pending_id_mappings`,
      bind: [
        record.key,
        record.kind,
        record.linkService,
        record.linkType,
        record.linkId,
        record.service,
        record.scopeType,
        record.scopeParams,
        record.parentKey,
        record.evictionPolicy,
        record.frozen ? 1 : 0,
        record.frozenAt,
        record.inheritedFrozen ? 1 : 0,
        record.lastAccessedAt,
        record.expiresAt,
        record.createdAt,
        record.holdCount,
        record.estimatedSizeBytes,
        record.pendingIdMappings,
      ],
    }))
    await this.db.execBatch(statements)
  }

  async holdCacheKey(key: string): Promise<void> {
    this.assertInitialized()
    await this.exec('UPDATE cache_keys SET hold_count = hold_count + 1 WHERE key = ?', [key])
  }

  async releaseCacheKey(key: string): Promise<void> {
    this.assertInitialized()
    await this.exec('UPDATE cache_keys SET hold_count = MAX(0, hold_count - 1) WHERE key = ?', [
      key,
    ])
  }

  async touchCacheKey(key: string): Promise<void> {
    this.assertInitialized()
    await this.exec('UPDATE cache_keys SET last_accessed_at = ? WHERE key = ?', [Date.now(), key])
  }

  async getChildCacheKeys(parentKey: string): Promise<CacheKeyRecord[]> {
    this.assertInitialized()
    const rows = await this.query<CacheKeyRow>('SELECT * FROM cache_keys WHERE parent_key = ?', [
      parentKey,
    ])
    return rows.map((row) => this.rowToCacheKey(row))
  }

  async getEvictableCacheKeys(limit: number): Promise<CacheKeyRecord[]> {
    this.assertInitialized()
    const rows = await this.query<CacheKeyRow>(
      `SELECT * FROM cache_keys
       WHERE hold_count = 0 AND frozen = 0 AND inherited_frozen = 0
         AND NOT EXISTS (SELECT 1 FROM cache_keys c2 WHERE c2.parent_key = cache_keys.key)
       ORDER BY CASE eviction_policy WHEN 'ephemeral' THEN 0 ELSE 1 END,
                last_accessed_at ASC
       LIMIT ?`,
      [limit],
    )

    return rows.map((row) => this.rowToCacheKey(row))
  }

  async filterExistingCacheKeys(keys: string[]): Promise<string[]> {
    this.assertInitialized()
    if (keys.length === 0) return []
    const placeholders = keys.map(() => '?').join(',')
    const rows = await this.query<{ key: string }>(
      `SELECT key FROM cache_keys WHERE key IN (${placeholders})`,
      keys,
    )
    return rows.map((row) => row.key)
  }

  // Command operations

  async getCommandSequence(): Promise<number> {
    this.assertInitialized()
    // Read from sqlite_sequence so deleted tail rows don't cause the counter
    // to regress. sqlite_sequence only has a row for `commands` once at least
    // one row has been inserted; before that we fall back to 0.
    const row = await this.queryOne<{ seq: number }>(
      "SELECT seq FROM sqlite_sequence WHERE name = 'commands'",
    )
    return row?.seq ?? 0
  }

  async getCommand(commandId: string): Promise<CommandRecord<TLink, TCommand> | undefined> {
    this.assertInitialized()
    const row = await this.queryOne<CommandRow>('SELECT * FROM commands WHERE command_id = ?', [
      commandId,
    ])

    if (!row) return undefined

    return this.rowToCommand(row)
  }

  async getCommandsByIds(
    commandIds: readonly string[],
  ): Promise<Map<string, CommandRecord<TLink, TCommand>>> {
    this.assertInitialized()
    const result = new Map<string, CommandRecord<TLink, TCommand>>()
    if (commandIds.length === 0) return result
    const placeholders = commandIds.map(() => '?').join(',')
    const rows = await this.query<CommandRow>(
      `SELECT * FROM commands WHERE command_id IN (${placeholders})`,
      [...commandIds],
    )
    for (const row of rows) {
      const command = this.rowToCommand(row)
      result.set(command.commandId, command)
    }
    return result
  }

  async getCommands(filter?: CommandFilter): Promise<CommandRecord<TLink, TCommand>[]> {
    this.assertInitialized()
    let sql = 'SELECT * FROM commands WHERE 1=1'
    const params: unknown[] = []

    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status]
      sql += ` AND status IN (${statuses.map(() => '?').join(',')})`
      params.push(...statuses)
    }

    if (filter?.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type]
      sql += ` AND type IN (${types.map(() => '?').join(',')})`
      params.push(...types)
    }

    if (filter?.service) {
      sql += ' AND service = ?'
      params.push(filter.service)
    }

    if (filter?.createdAfter !== undefined) {
      sql += ' AND created_at > ?'
      params.push(filter.createdAfter)
    }

    if (filter?.createdBefore !== undefined) {
      sql += ' AND created_at < ?'
      params.push(filter.createdBefore)
    }

    sql += ' ORDER BY seq ASC'

    if (filter?.limit !== undefined) {
      sql += ' LIMIT ?'
      params.push(filter.limit)

      if (filter?.offset !== undefined) {
        sql += ' OFFSET ?'
        params.push(filter.offset)
      }
    }

    const rows = await this.query<CommandRow>(sql, params)
    return rows.map((row) => this.rowToCommand(row))
  }

  async getCommandsByStatus(
    status: CommandStatus | CommandStatus[],
  ): Promise<CommandRecord<TLink, TCommand>[]> {
    return this.getCommands({ status })
  }

  async getCommandsBlockedBy(commandId: string): Promise<CommandRecord<TLink, TCommand>[]> {
    this.assertInitialized()
    const rows = await this.query<CommandRow>(
      `SELECT * FROM commands WHERE EXISTS (SELECT 1 FROM json_each(blocked_by) WHERE value = ?)`,
      [commandId],
    )
    return rows.map((row) => this.rowToCommand(row))
  }

  async saveCommand(command: CommandRecord<TLink, TCommand>): Promise<void> {
    this.assertInitialized()
    const stmt = this.buildSaveCommandStatement(command)
    await this.exec(stmt.sql, stmt.bind)
  }

  async updateCommand(
    commandId: string,
    updates: Partial<CommandRecord<TLink, TCommand>>,
  ): Promise<void> {
    this.assertInitialized()
    const current = await this.getCommand(commandId)
    if (!current) return

    const updated = { ...current, ...updates, updatedAt: Date.now() }
    await this.saveCommand(updated)
  }

  async updateCommands(updates: readonly UpdateCommandsEntry<TLink, TCommand>[]): Promise<void> {
    this.assertInitialized()
    if (updates.length === 0) return

    // Two round-trips regardless of batch size: one bulk read, one bulk write.
    // Patches carry different column subsets per row, so the write can't be
    // a single multi-row UPDATE. Instead we issue N per-row upsert statements
    // inside one `execBatch` round-trip — each statement's SQL is identical
    // (reused from `saveCommand`), only the bindings differ.
    const ids = updates.map(({ commandId }) => commandId)
    const current = await this.getCommandsByIds(ids)
    const now = Date.now()

    const statements: SqliteBatchStatement[] = []
    for (const { commandId, updates: patch } of updates) {
      const existing = current.get(commandId)
      if (!existing) continue
      statements.push(this.buildSaveCommandStatement({ ...existing, ...patch, updatedAt: now }))
    }
    if (statements.length === 0) return
    await this.db.execBatch(statements)
  }

  async deleteCommand(commandId: string): Promise<void> {
    this.assertInitialized()
    await this.exec('DELETE FROM commands WHERE command_id = ?', [commandId])
    await this.exec(
      'DELETE FROM cached_event_cache_keys WHERE event_id IN (SELECT id FROM cached_events WHERE command_id = ?)',
      [commandId],
    )
    await this.exec('DELETE FROM cached_events WHERE command_id = ?', [commandId])
  }

  async deleteAllCommands(): Promise<void> {
    this.assertInitialized()
    await this.exec('DELETE FROM commands')
    await this.exec(
      "DELETE FROM cached_event_cache_keys WHERE event_id IN (SELECT id FROM cached_events WHERE persistence = 'Anticipated')",
    )
    await this.exec("DELETE FROM cached_events WHERE persistence = 'Anticipated'")
  }

  // Event cache operations

  async getCachedEvent(id: string): Promise<CachedEventRecord | undefined> {
    this.assertInitialized()
    const ck = joinCacheKeys({
      srcAlias: 'ce',
      junctionTable: 'cached_event_cache_keys',
      fk: 'event_id',
    })
    const row = await this.queryOne<EventRowWithCacheKeys>(
      `SELECT ce.*, ${ck.column} FROM cached_events ce ${ck.join} WHERE ce.id = ? ${ck.groupBy}`,
      [id],
    )

    if (!row) return undefined

    return this.rowToEvent(row)
  }

  async getExistingCachedEventIds(ids: readonly string[]): Promise<Set<string>> {
    this.assertInitialized()
    if (ids.length === 0) return new Set()
    const placeholders = ids.map(() => '?').join(', ')
    const rows = await this.query<{ id: string }>(
      `SELECT id FROM cached_events WHERE id IN (${placeholders})`,
      [...ids],
    )
    return new Set(rows.map((row) => row.id))
  }

  async getCachedEventsByCacheKey(cacheKey: string): Promise<CachedEventRecord[]> {
    this.assertInitialized()
    const ck = joinCacheKeys({
      srcAlias: 'ce',
      junctionTable: 'cached_event_cache_keys',
      fk: 'event_id',
    })
    const rows = await this.query<EventRowWithCacheKeys>(
      `SELECT ce.*, ${ck.column} FROM cached_events ce
       INNER JOIN cached_event_cache_keys filter_ck ON filter_ck.event_id = ce.id
       ${ck.join}
       WHERE filter_ck.cache_key = ?
       ${ck.groupBy}`,
      [cacheKey],
    )
    return rows.map((row) => this.rowToEvent(row))
  }

  async getCachedEventsByStream(streamId: string): Promise<CachedEventRecord[]> {
    this.assertInitialized()
    const ck = joinCacheKeys({
      srcAlias: 'ce',
      junctionTable: 'cached_event_cache_keys',
      fk: 'event_id',
    })
    const rows = await this.query<EventRowWithCacheKeys>(
      `SELECT ce.*, ${ck.column} FROM cached_events ce
       ${ck.join}
       WHERE ce.stream_id = ?
       ${ck.groupBy}
       ORDER BY CASE WHEN ce.position IS NOT NULL THEN CAST(ce.position AS INTEGER) END ASC,
                ce.created_at ASC`,
      [streamId],
    )
    return rows.map((row) => this.rowToEvent(row))
  }

  async getAnticipatedEventsByCommand(commandId: string): Promise<CachedEventRecord[]> {
    this.assertInitialized()
    const ck = joinCacheKeys({
      srcAlias: 'ce',
      junctionTable: 'cached_event_cache_keys',
      fk: 'event_id',
    })
    const rows = await this.query<EventRowWithCacheKeys>(
      `SELECT ce.*, ${ck.column} FROM cached_events ce
       ${ck.join}
       WHERE ce.persistence = 'Anticipated' AND ce.command_id = ?
       ${ck.groupBy}`,
      [commandId],
    )
    return rows.map((row) => this.rowToEvent(row))
  }

  async getAllAnticipatedEvents(): Promise<CachedEventRecord[]> {
    this.assertInitialized()
    const ck = joinCacheKeys({
      srcAlias: 'ce',
      junctionTable: 'cached_event_cache_keys',
      fk: 'event_id',
    })
    const rows = await this.query<EventRowWithCacheKeys>(
      `SELECT ce.*, ${ck.column} FROM cached_events ce
       ${ck.join}
       WHERE ce.persistence = 'Anticipated'
       ${ck.groupBy}`,
    )
    return rows.map((row) => this.rowToEvent(row))
  }

  async saveCachedEvent(event: CachedEventRecord): Promise<void> {
    this.assertInitialized()
    const statements: SqliteBatchStatement[] = [
      {
        sql: `INSERT INTO cached_events
(id, type, stream_id, persistence, data, position, revision, command_id, created_at, processed_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  type=excluded.type,
  stream_id=excluded.stream_id,
  persistence=excluded.persistence,
  data=excluded.data,
  position=excluded.position,
  revision=excluded.revision,
  command_id=excluded.command_id,
  created_at=excluded.created_at,
  processed_at=excluded.processed_at`,
        bind: [
          event.id,
          event.type,
          event.streamId,
          event.persistence,
          event.data,
          event.position,
          event.revision,
          event.commandId,
          event.createdAt,
          event.processedAt,
        ],
      },
    ]
    const junction = this.buildJunctionInsert(
      'cached_event_cache_keys',
      '(event_id, cache_key)',
      event.cacheKeys.map((cacheKey) => [event.id, cacheKey]),
    )
    if (junction) statements.push(junction)
    await this.db.execBatch(statements)
  }

  async saveCachedEvents(events: CachedEventRecord[]): Promise<void> {
    this.assertInitialized()
    if (events.length === 0) return

    const columns =
      '(id, type, stream_id, persistence, data, position, revision, command_id, created_at, processed_at)'
    const placeholder = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    const placeholders = events.map(() => placeholder).join(', ')
    const params: unknown[] = []

    for (const event of events) {
      params.push(
        event.id,
        event.type,
        event.streamId,
        event.persistence,
        event.data,
        event.position,
        event.revision,
        event.commandId,
        event.createdAt,
        event.processedAt,
      )
    }

    const junctionRows: unknown[][] = []
    for (const event of events) {
      for (const cacheKey of event.cacheKeys) {
        junctionRows.push([event.id, cacheKey])
      }
    }

    const statements: SqliteBatchStatement[] = [
      {
        sql: `INSERT OR IGNORE INTO cached_events ${columns} VALUES ${placeholders}`,
        bind: params,
      },
    ]
    const junction = this.buildJunctionInsert(
      'cached_event_cache_keys',
      '(event_id, cache_key)',
      junctionRows,
    )
    if (junction) statements.push(junction)
    await this.db.execBatch(statements)
  }

  async deleteCachedEvent(id: string): Promise<void> {
    this.assertInitialized()
    await this.db.execBatch([
      { sql: 'DELETE FROM cached_event_cache_keys WHERE event_id = ?', bind: [id] },
      { sql: 'DELETE FROM cached_events WHERE id = ?', bind: [id] },
    ])
  }

  async markCachedEventsProcessed(ids: string[]): Promise<void> {
    this.assertInitialized()
    if (ids.length === 0) return
    const placeholders = ids.map(() => '?').join(', ')
    await this.exec(`UPDATE cached_events SET processed_at = ? WHERE id IN (${placeholders})`, [
      Date.now(),
      ...ids,
    ])
  }

  async deleteProcessedCachedEvents(olderThan: number): Promise<number> {
    this.assertInitialized()
    const results = await this.db.execBatch([
      queryStmt<{ count: number }>(
        'SELECT COUNT(*) as count FROM cached_events WHERE processed_at IS NOT NULL AND processed_at < ?',
        [olderThan],
      ),
      execStmt(
        'DELETE FROM cached_event_cache_keys WHERE event_id IN (SELECT id FROM cached_events WHERE processed_at IS NOT NULL AND processed_at < ?)',
        [olderThan],
      ),
      execStmt('DELETE FROM cached_events WHERE processed_at IS NOT NULL AND processed_at < ?', [
        olderThan,
      ]),
    ])
    const rows = results[0] ?? []
    return rows[0]?.count ?? 0
  }

  async deleteAnticipatedEventsByCommand(commandId: string): Promise<void> {
    this.assertInitialized()
    await this.db.execBatch([
      {
        sql: "DELETE FROM cached_event_cache_keys WHERE event_id IN (SELECT id FROM cached_events WHERE persistence = 'Anticipated' AND command_id = ?)",
        bind: [commandId],
      },
      {
        sql: "DELETE FROM cached_events WHERE persistence = 'Anticipated' AND command_id = ?",
        bind: [commandId],
      },
    ])
  }

  async deleteAnticipatedEventsByCommands(commandIds: readonly string[]): Promise<void> {
    this.assertInitialized()
    if (commandIds.length === 0) return
    const placeholders = commandIds.map(() => '?').join(', ')
    await this.db.execBatch([
      {
        sql: `DELETE FROM cached_event_cache_keys WHERE event_id IN (SELECT id FROM cached_events WHERE persistence = 'Anticipated' AND command_id IN (${placeholders}))`,
        bind: [...commandIds],
      },
      {
        sql: `DELETE FROM cached_events WHERE persistence = 'Anticipated' AND command_id IN (${placeholders})`,
        bind: [...commandIds],
      },
    ])
  }

  async removeCacheKeyFromEvents(cacheKey: string): Promise<string[]> {
    this.assertInitialized()
    const statements = this.buildRemoveCacheKeyFromEvents(cacheKey, true)
    const results = await this.db.execBatch(statements)
    const orphanRows = results[1] ?? []
    return orphanRows.map((row) => row.id)
  }

  private buildRemoveCacheKeyFromEvents(
    cacheKey: string,
    returnDeleted = false,
  ): [SqliteBatchStatement, SqliteBatchStatement<{ id: string }>, SqliteBatchStatement] {
    return [
      { sql: 'DELETE FROM cached_event_cache_keys WHERE cache_key = ?', bind: [cacheKey] },
      {
        sql: 'SELECT id FROM cached_events WHERE id NOT IN (SELECT event_id FROM cached_event_cache_keys)',
        returnRows: returnDeleted,
      },
      {
        sql: 'DELETE FROM cached_events WHERE id NOT IN (SELECT event_id FROM cached_event_cache_keys)',
      },
    ]
  }

  async addCacheKeysToEvents(entries: readonly AddCacheKeysToEventEntry[]): Promise<void> {
    this.assertInitialized()
    const rows: unknown[][] = []
    for (const { eventId, cacheKeys } of entries) {
      for (const cacheKey of cacheKeys) {
        rows.push([eventId, cacheKey])
      }
    }
    await this.insertJunctionRows('cached_event_cache_keys', '(event_id, cache_key)', rows)
  }

  // Read model operations

  async getReadModel(collection: string, id: string): Promise<ReadModelRecord | undefined> {
    this.assertInitialized()
    const table = this.rmTable(collection)
    const ck = joinCacheKeys({
      srcAlias: 'rm',
      junctionTable: this.rmCacheKeyTable(collection),
      fk: 'entity_id',
    })
    const row = await this.queryOne<ReadModelRowWithCacheKeys>(
      `SELECT rm.*, '${collection}' as collection, ${ck.column} FROM ${table} rm
       ${ck.join}
       WHERE rm.id = ?
       ${ck.groupBy}`,
      [id],
    )

    if (!row) return undefined

    return this.rowToReadModel(row)
  }

  async getReadModels(
    pairs: Iterable<{ collection: string; id: string }>,
  ): Promise<Map<string, ReadModelRecord>> {
    this.assertInitialized()
    // Group the requested ids by collection so we can run one
    // `WHERE id IN (...)` per collection rather than one SELECT per pair.
    const idsByCollection = new Map<string, Set<string>>()
    for (const { collection, id } of pairs) {
      let set = idsByCollection.get(collection)
      if (!set) {
        set = new Set<string>()
        idsByCollection.set(collection, set)
      }
      set.add(id)
    }

    const result = new Map<string, ReadModelRecord>()
    for (const [collection, ids] of idsByCollection) {
      if (ids.size === 0) continue
      const table = this.rmTable(collection)
      const ck = joinCacheKeys({
        srcAlias: 'rm',
        junctionTable: this.rmCacheKeyTable(collection),
        fk: 'entity_id',
      })
      const idList = Array.from(ids)
      const placeholders = idList.map(() => '?').join(', ')
      const rows = await this.query<ReadModelRowWithCacheKeys>(
        `SELECT rm.*, '${collection}' as collection, ${ck.column} FROM ${table} rm
         ${ck.join}
         WHERE rm.id IN (${placeholders})
         ${ck.groupBy}`,
        idList,
      )
      for (const row of rows) {
        const record = this.rowToReadModel(row)
        result.set(`${collection}:${record.id}`, record)
      }
    }
    return result
  }

  async getReadModelsByCollection(
    collection: string,
    options?: IStorageQueryOptions,
  ): Promise<ReadModelRecord[]> {
    this.assertInitialized()
    const table = this.rmTable(collection)
    const ck = joinCacheKeys({
      srcAlias: 'rm',
      junctionTable: this.rmCacheKeyTable(collection),
      fk: 'entity_id',
    })
    let sql = `SELECT rm.*, '${collection}' as collection, ${ck.column} FROM ${table} rm ${ck.join}`
    const params: unknown[] = []

    sql += ` ${ck.groupBy}`

    if (options?.orderBy) {
      const dir = options.orderDirection === 'desc' ? 'DESC' : 'ASC'
      sql += ` ORDER BY rm.updated_at ${dir}`
    }

    if (options?.limit !== undefined) {
      sql += ' LIMIT ?'
      params.push(options.limit)

      if (options?.offset !== undefined) {
        sql += ' OFFSET ?'
        params.push(options.offset)
      }
    }

    const rows = await this.query<ReadModelRowWithCacheKeys>(sql, params)
    return rows.map((row) => this.rowToReadModel(row))
  }

  async getReadModelsByCacheKey(cacheKey: string): Promise<ReadModelRecord[]> {
    this.assertInitialized()
    if (this.collections.size === 0) return []

    const allRecords: ReadModelRecord[] = []
    for (const collection of this.collections) {
      const table = this.rmTable(collection)
      const cachKeyTable = this.rmCacheKeyTable(collection)
      const ck = joinCacheKeys({
        srcAlias: 'rm',
        junctionTable: cachKeyTable,
        fk: 'entity_id',
      })
      const rows = await this.query<ReadModelRowWithCacheKeys>(
        `SELECT rm.*, '${collection}' as collection, ${ck.column} FROM ${table} rm
         INNER JOIN ${cachKeyTable} filter_ck ON filter_ck.entity_id = rm.id
         ${ck.join}
         WHERE filter_ck.cache_key = ?
         ${ck.groupBy}
         ORDER BY rm.updated_at ASC, rm.id ASC`,
        [cacheKey],
      )
      allRecords.push(...rows.map((row) => this.rowToReadModel(row)))
    }
    allRecords.sort((a, b) => a.updatedAt - b.updatedAt || a.id.localeCompare(b.id))
    return allRecords
  }

  async countReadModels(collection: string, cacheKey?: string): Promise<number> {
    this.assertInitialized()
    const table = this.rmTable(collection)
    const cacheKeyTable = this.rmCacheKeyTable(collection)
    if (cacheKey) {
      const rows = await this.query<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM ${table} rm JOIN ${cacheKeyTable} j ON rm.id = j.entity_id WHERE j.cache_key = ?`,
        [cacheKey],
      )
      return rows[0]?.cnt ?? 0
    }
    const rows = await this.query<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM ${table}`)
    return rows[0]?.cnt ?? 0
  }

  async saveReadModel(record: ReadModelRecord): Promise<void> {
    this.assertInitialized()
    const table = this.rmTable(record.collection)
    const statements: SqliteBatchStatement[] = [
      {
        sql: `INSERT INTO ${table}
(id, _server_data, _effective_data, _has_local_changes, _revision, _position, updated_at, __client_id, __reconciled_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  _server_data=excluded._server_data,
  _effective_data=excluded._effective_data,
  _has_local_changes=excluded._has_local_changes,
  _revision=excluded._revision,
  _position=excluded._position,
  updated_at=excluded.updated_at,
  __client_id=excluded.__client_id,
  __reconciled_at=excluded.__reconciled_at`,
        bind: [
          record.id,
          record.serverData,
          record.effectiveData,
          record.hasLocalChanges ? 1 : 0,
          record.revision,
          record.position,
          record.updatedAt,
          record._clientMetadata?.clientId ?? null,
          record._clientMetadata?.reconciledAt ?? null,
        ],
      },
    ]
    const junction = this.buildJunctionInsert(
      this.rmCacheKeyTable(record.collection),
      '(entity_id, cache_key)',
      record.cacheKeys.map((cacheKey) => [record.id, cacheKey]),
    )
    if (junction) statements.push(junction)
    await this.db.execBatch(statements)
  }

  async saveReadModels(records: ReadModelRecord[]): Promise<void> {
    this.assertInitialized()
    if (records.length === 0) return

    // Group by collection for per-table batch inserts
    const byCollection = new Map<string, ReadModelRecord[]>()
    for (const record of records) {
      let group = byCollection.get(record.collection)
      if (!group) {
        group = []
        byCollection.set(record.collection, group)
      }
      group.push(record)
    }

    const statements: SqliteBatchStatement[] = []
    for (const [collection, group] of byCollection) {
      const table = this.rmTable(collection)
      const columns =
        '(id, _server_data, _effective_data, _has_local_changes, _revision, _position, updated_at, __client_id, __reconciled_at)'
      const placeholder = '(?, ?, ?, ?, ?, ?, ?, ?, ?)'
      const placeholders = group.map(() => placeholder).join(', ')
      const params: unknown[] = []

      for (const record of group) {
        params.push(
          record.id,
          record.serverData,
          record.effectiveData,
          record.hasLocalChanges ? 1 : 0,
          record.revision,
          record.position,
          record.updatedAt,
          record._clientMetadata?.clientId ?? null,
          record._clientMetadata?.reconciledAt ?? null,
        )
      }

      statements.push({
        sql: `INSERT INTO ${table} ${columns} VALUES ${placeholders}
ON CONFLICT(id) DO UPDATE SET
  _server_data=excluded._server_data,
  _effective_data=excluded._effective_data,
  _has_local_changes=excluded._has_local_changes,
  _revision=excluded._revision,
  _position=excluded._position,
  updated_at=excluded.updated_at,
  __client_id=excluded.__client_id,
  __reconciled_at=excluded.__reconciled_at`,
        bind: params,
      })

      const junctionRows: unknown[][] = []
      for (const record of group) {
        for (const cacheKey of record.cacheKeys) {
          junctionRows.push([record.id, cacheKey])
        }
      }
      const junction = this.buildJunctionInsert(
        this.rmCacheKeyTable(collection),
        '(entity_id, cache_key)',
        junctionRows,
      )
      if (junction) statements.push(junction)
    }
    await this.db.execBatch(statements)
  }

  async deleteReadModel(collection: string, id: string): Promise<void> {
    this.assertInitialized()
    const table = this.rmTable(collection)
    const cacheKeyTable = this.rmCacheKeyTable(collection)
    await this.db.execBatch([
      { sql: `DELETE FROM ${cacheKeyTable} WHERE entity_id = ?`, bind: [id] },
      { sql: `DELETE FROM ${table} WHERE id = ?`, bind: [id] },
    ])
  }

  async deleteReadModels(entries: readonly DeleteReadModelEntry[]): Promise<void> {
    this.assertInitialized()
    if (entries.length === 0) return

    const idsByCollection = new Map<string, string[]>()
    for (const { collection, id } of entries) {
      this.rmTable(collection) // validates collection name
      let ids = idsByCollection.get(collection)
      if (!ids) {
        ids = []
        idsByCollection.set(collection, ids)
      }
      ids.push(id)
    }

    const statements: SqliteBatchStatement[] = []
    for (const [collection, ids] of idsByCollection) {
      const placeholders = ids.map(() => '?').join(', ')
      const table = this.rmTable(collection)
      const cacheKeyTable = this.rmCacheKeyTable(collection)
      statements.push({
        sql: `DELETE FROM ${cacheKeyTable} WHERE entity_id IN (${placeholders})`,
        bind: [...ids],
      })
      statements.push({
        sql: `DELETE FROM ${table} WHERE id IN (${placeholders})`,
        bind: [...ids],
      })
    }
    await this.db.execBatch(statements)
  }

  async migrateReadModelIds(batch: MigrateReadModelIdParams[]): Promise<void> {
    this.assertInitialized()
    if (batch.length === 0) return

    // Group by collection so each backing table takes exactly two statements
    // (one for the data row, one for the cache-key junction) regardless of
    // how many id migrations fall into that collection. Entries where
    // `fromId === toId` are still included — the SET clause rewrites the
    // other columns and the `id = new.new_id` assignment is a self-no-op.
    const byCollection = new Map<string, MigrateReadModelIdParams[]>()
    for (const params of batch) {
      this.rmTable(params.collection)
      let group = byCollection.get(params.collection)
      if (!group) {
        group = []
        byCollection.set(params.collection, group)
      }
      group.push(params)
    }
    if (byCollection.size === 0) return

    const statements: SqliteBatchStatement[] = []
    for (const [collection, entries] of byCollection) {
      const table = `rm_${collection}`
      const junctionTable = `rm_${collection}_cache_keys`

      // One JSON-driven UPDATE per backing table per collection. The batch is
      // passed as a single JSON array parameter and unpacked via json_each() +
      // json_extract(), avoiding dynamic placeholder generation.
      const rowJson = JSON.stringify(
        entries.map((e) => ({
          oldId: e.fromId,
          newId: e.toId,
          serverData: e.serverData,
          effectiveData: e.effectiveData,
          hasLocalChanges: e.hasLocalChanges ? 1 : 0,
          updatedAt: e.updatedAt,
        })),
      )
      statements.push({
        sql: `WITH new AS (
                SELECT
                  json_extract(value, '$.oldId') AS old_id,
                  json_extract(value, '$.newId') AS new_id,
                  json_extract(value, '$.serverData') AS server_data,
                  json_extract(value, '$.effectiveData') AS effective_data,
                  json_extract(value, '$.hasLocalChanges') AS has_local_changes,
                  json_extract(value, '$.updatedAt') AS updated_at
                FROM json_each(?)
              )
              UPDATE ${table}
              SET id = new.new_id,
                  _server_data = new.server_data,
                  _effective_data = new.effective_data,
                  _has_local_changes = new.has_local_changes,
                  updated_at = new.updated_at
              FROM new
              WHERE ${table}.id = new.old_id`,
        bind: [rowJson],
      })

      const junctionJson = JSON.stringify(entries.map((e) => ({ oldId: e.fromId, newId: e.toId })))
      statements.push({
        sql: `WITH new AS (
                SELECT
                  json_extract(value, '$.oldId') AS old_id,
                  json_extract(value, '$.newId') AS new_id
                FROM json_each(?)
              )
              UPDATE ${junctionTable}
              SET entity_id = new.new_id
              FROM new
              WHERE ${junctionTable}.entity_id = new.old_id`,
        bind: [junctionJson],
      })
    }

    await this.db.execBatch(statements)
  }

  async removeCacheKeyFromReadModels(cacheKey: string): Promise<void> {
    this.assertInitialized()
    const statements = this.buildRemoveCacheKeyFromReadModels(cacheKey)
    if (statements.length > 0) {
      await this.db.execBatch(statements)
    }
  }

  private buildRemoveCacheKeyFromReadModels(cacheKey: string): SqliteBatchStatement[] {
    const statements: SqliteBatchStatement[] = []
    for (const collection of this.collections) {
      const table = this.rmTable(collection)
      const cacheKeyTable = this.rmCacheKeyTable(collection)
      statements.push({
        sql: `DELETE FROM ${cacheKeyTable} WHERE cache_key = ?`,
        bind: [cacheKey],
      })
      statements.push({
        sql: `DELETE FROM ${table} WHERE id NOT IN (SELECT entity_id FROM ${cacheKeyTable})`,
      })
    }
    return statements
  }

  async addCacheKeysToReadModel(
    collection: string,
    id: string,
    cacheKeys: string[],
  ): Promise<void> {
    this.assertInitialized()
    await this.insertJunctionRows(
      this.rmCacheKeyTable(collection),
      '(entity_id, cache_key)',
      cacheKeys.map((cacheKey) => [id, cacheKey]),
    )
  }

  async addCacheKeysToReadModels(entries: readonly AddCacheKeysToReadModelEntry[]): Promise<void> {
    this.assertInitialized()
    if (entries.length === 0) return

    const rowsByCollection = new Map<string, unknown[][]>()
    for (const { collection, id, cacheKeys } of entries) {
      let rows = rowsByCollection.get(collection)
      if (!rows) {
        rows = []
        rowsByCollection.set(collection, rows)
      }
      for (const cacheKey of cacheKeys) {
        rows.push([id, cacheKey])
      }
    }

    const statements: SqliteBatchStatement[] = []
    for (const [collection, rows] of rowsByCollection) {
      const stmt = this.buildJunctionInsert(
        this.rmCacheKeyTable(collection),
        '(entity_id, cache_key)',
        rows,
      )
      if (stmt) statements.push(stmt)
    }
    if (statements.length > 0) {
      await this.db.execBatch(statements)
    }
  }

  async deleteReadModelsByCollection(collection: string): Promise<void> {
    this.assertInitialized()
    const table = this.rmTable(collection)
    const cacheKeyTable = this.rmCacheKeyTable(collection)
    await this.db.execBatch([
      { sql: `DELETE FROM ${cacheKeyTable}` },
      { sql: `DELETE FROM ${table}` },
    ])
  }

  async getReadModelCount(): Promise<number> {
    this.assertInitialized()
    if (this.collections.size === 0) return 0

    const unions = Array.from(this.collections)
      .map((name) => `SELECT COUNT(*) as count FROM ${this.rmTable(name)}`)
      .join(' UNION ALL ')

    const rows = await this.query<{ count: number }>(unions)
    let total = 0
    for (const row of rows) {
      total += row.count
    }
    return total
  }

  async getReadModelRevisions(
    collection: string,
  ): Promise<Array<{ id: string; revision: string }>> {
    this.assertInitialized()
    const table = this.rmTable(collection)
    const rows = await this.query<{ id: string; _revision: string }>(
      `SELECT id, _revision FROM ${table} WHERE _revision IS NOT NULL`,
    )
    return rows.map((row) => ({ id: row.id, revision: row._revision }))
  }

  // Command ID mapping operations

  async getCommandIdMapping(
    clientId: EntityId,
  ): Promise<import('./IStorage.js').CommandIdMappingRecord | undefined> {
    this.assertInitialized()
    const row = await this.queryOne<CommandIdMappingRow>(
      'SELECT * FROM command_id_mappings WHERE client_id = ?',
      [entityIdToString(clientId)],
    )
    if (!row) return undefined
    return {
      clientId: row.client_id,
      serverId: row.server_id,
      createdAt: row.created_at,
    }
  }

  async getCommandIdMappingByServerId(
    serverId: string,
  ): Promise<import('./IStorage.js').CommandIdMappingRecord | undefined> {
    this.assertInitialized()
    const row = await this.queryOne<CommandIdMappingRow>(
      'SELECT * FROM command_id_mappings WHERE server_id = ?',
      [serverId],
    )
    if (!row) return undefined
    return {
      clientId: row.client_id,
      serverId: row.server_id,
      createdAt: row.created_at,
    }
  }

  async saveCommandIdMapping(
    record: import('./IStorage.js').CommandIdMappingRecord,
  ): Promise<void> {
    this.assertInitialized()
    await this.exec(
      `INSERT INTO command_id_mappings (client_id, server_id, created_at)
VALUES (?, ?, ?)
ON CONFLICT(client_id) DO UPDATE SET
  server_id=excluded.server_id,
  created_at=excluded.created_at`,
      [record.clientId, record.serverId, record.createdAt],
    )
  }

  async saveCommandIdMappings(
    records: readonly import('./IStorage.js').CommandIdMappingRecord[],
  ): Promise<void> {
    this.assertInitialized()
    if (records.length === 0) return
    const statements = records.map((record) => ({
      sql: `INSERT INTO command_id_mappings (client_id, server_id, created_at)
VALUES (?, ?, ?)
ON CONFLICT(client_id) DO UPDATE SET
  server_id=excluded.server_id,
  created_at=excluded.created_at`,
      bind: [record.clientId, record.serverId, record.createdAt] as unknown[],
    }))
    await this.db.execBatch(statements)
  }

  async deleteCommandIdMappingsOlderThan(timestamp: number): Promise<void> {
    this.assertInitialized()
    await this.exec('DELETE FROM command_id_mappings WHERE created_at < ?', [timestamp])
  }

  async loadAndPurgeCommandIdMappings(
    purgeOlderThan: number,
  ): Promise<import('./IStorage.js').CommandIdMappingRecord[]> {
    this.assertInitialized()
    const results = await this.db.execBatch([
      execStmt('DELETE FROM command_id_mappings WHERE created_at < ?', [purgeOlderThan]),
      queryStmt<CommandIdMappingRow>('SELECT * FROM command_id_mappings'),
    ])
    const rows = results[1]
    return rows.map((row) => ({
      clientId: row.client_id,
      serverId: row.server_id,
      createdAt: row.created_at,
    }))
  }

  async deleteAllCommandIdMappings(): Promise<void> {
    this.assertInitialized()
    await this.exec('DELETE FROM command_id_mappings')
  }

  // Private helpers

  private rmTable(collection: string): string {
    assert(this.collections.has(collection), `Unknown collection '${collection}'`)
    return `rm_${collection}`
  }

  private rmCacheKeyTable(collection: string): string {
    assert(this.collections.has(collection), `Unknown collection '${collection}'`)
    return `rm_${collection}_cache_keys`
  }

  private async runMigrations(): Promise<void> {
    const tables = await this.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'migrations'",
    )

    let currentVersion: number
    if (tables.length === 0) {
      await this.exec(MIGRATIONS_TABLE)
      currentVersion = 0
    } else {
      const rows = await this.query<{ version: number | null }>(
        'SELECT MAX(version) as version FROM migrations',
      )
      currentVersion = rows[0]?.version ?? 0
    }

    for (const migration of this.migrations) {
      if (migration.version <= currentVersion) continue

      const statements: SqliteBatchStatement[] = []
      for (const step of migration.steps) {
        for (const sql of getSqlForStep(step)) {
          statements.push({ sql })
        }
      }
      statements.push({
        sql: 'INSERT INTO migrations (version, applied_at) VALUES (?, ?)',
        bind: [migration.version, Date.now()],
      })
      await this.db.execBatch(statements)
    }
  }

  private async exec(sql: string, params?: unknown[]): Promise<void> {
    await this.db.exec(sql, { bind: params })
  }

  private buildSaveCommandStatement(command: CommandRecord<TLink, TCommand>): SqliteBatchStatement {
    return {
      sql: `INSERT INTO commands
(command_id, cache_key, service, type, data, status, depends_on, blocked_by, attempts,
  last_attempt_at, error, server_response, post_process, creates, revision,
  path, file_refs, command_id_paths, affected_aggregates, pending_aggregate_coverage, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(command_id) DO UPDATE SET
  cache_key=excluded.cache_key,
  service=excluded.service,
  type=excluded.type,
  data=excluded.data,
  status=excluded.status,
  depends_on=excluded.depends_on,
  blocked_by=excluded.blocked_by,
  attempts=excluded.attempts,
  last_attempt_at=excluded.last_attempt_at,
  error=excluded.error,
  server_response=excluded.server_response,
  post_process=excluded.post_process,
  creates=excluded.creates,
  revision=excluded.revision,
  path=excluded.path,
  file_refs=excluded.file_refs,
  command_id_paths=excluded.command_id_paths,
  affected_aggregates=excluded.affected_aggregates,
  pending_aggregate_coverage=excluded.pending_aggregate_coverage,
  created_at=excluded.created_at,
  updated_at=excluded.updated_at`,
      bind: [
        command.commandId,
        JSON.stringify(command.cacheKey),
        command.service,
        command.type,
        JSON.stringify(command.data),
        command.status,
        JSON.stringify(command.dependsOn),
        JSON.stringify(command.blockedBy),
        command.attempts,
        command.lastAttemptAt ?? null,
        command.error ? JSON.stringify(command.error) : null,
        command.serverResponse !== undefined ? JSON.stringify(command.serverResponse) : null,
        command.postProcess ? JSON.stringify(command.postProcess) : null,
        command.creates ? JSON.stringify(command.creates) : null,
        command.revision !== undefined ? JSON.stringify(command.revision) : null,
        command.path !== undefined ? JSON.stringify(command.path) : null,
        command.fileRefs ? JSON.stringify(command.fileRefs) : null,
        command.commandIdPaths ? JSON.stringify(command.commandIdPaths) : null,
        command.affectedAggregates ? JSON.stringify(command.affectedAggregates) : null,
        command.pendingAggregateCoverage ?? null,
        command.createdAt,
        command.updatedAt,
      ],
    }
  }

  private buildJunctionInsert(
    table: string,
    columns: string,
    rows: unknown[][],
  ): SqliteBatchStatement | undefined {
    if (rows.length === 0) return undefined
    const placeholders = rows.map((row) => `(${row.map(() => '?').join(', ')})`).join(', ')
    return {
      sql: `INSERT OR IGNORE INTO ${table} ${columns} VALUES ${placeholders}`,
      bind: rows.flat(),
    }
  }

  private async insertJunctionRows(
    table: string,
    columns: string,
    rows: unknown[][],
  ): Promise<void> {
    const stmt = this.buildJunctionInsert(table, columns, rows)
    if (stmt) await this.exec(stmt.sql, stmt.bind)
  }

  private async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    return this.db.exec<T>(sql, {
      bind: params,
      rowMode: 'object',
      returnValue: 'resultRows',
    })
  }

  private async queryOne<T>(sql: string, params?: unknown[]): Promise<T | undefined> {
    const rows = await this.query<T>(sql, params)
    return rows[0]
  }

  private assertInitialized(): void {
    if (!this.initialized) {
      throw new Error('Storage not initialized. Call initialize() first.')
    }
  }

  // Row type converters

  private rowToCommand(row: CommandRow): CommandRecord<TLink, TCommand> {
    return {
      commandId: row.command_id,
      seq: row.seq,
      cacheKey: JSON.parse(row.cache_key),
      service: row.service,
      type: row.type,
      data: JSON.parse(row.data),
      status: row.status as CommandStatus,
      dependsOn: JSON.parse(row.depends_on),
      blockedBy: JSON.parse(row.blocked_by),
      attempts: row.attempts,
      lastAttemptAt: row.last_attempt_at ?? undefined,
      error: row.error ? JSON.parse(row.error) : undefined,
      serverResponse: row.server_response ? JSON.parse(row.server_response) : undefined,
      postProcess: row.post_process ? JSON.parse(row.post_process) : undefined,
      creates: row.creates ? JSON.parse(row.creates) : undefined,
      revision: row.revision ? JSON.parse(row.revision) : undefined,
      path: row.path ? JSON.parse(row.path) : undefined,
      fileRefs: row.file_refs ? JSON.parse(row.file_refs) : undefined,
      commandIdPaths: row.command_id_paths ? JSON.parse(row.command_id_paths) : undefined,
      affectedAggregates: row.affected_aggregates ? JSON.parse(row.affected_aggregates) : undefined,
      pendingAggregateCoverage: row.pending_aggregate_coverage ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  private rowToEvent(row: EventRowWithCacheKeys): CachedEventRecord {
    return {
      id: row.id,
      type: row.type,
      streamId: row.stream_id,
      persistence: row.persistence as CachedEventRecord['persistence'],
      data: row.data,
      position: row.position,
      revision: row.revision,
      commandId: row.command_id,
      cacheKeys: JSON.parse(row.cache_keys) as string[],
      createdAt: row.created_at,
      processedAt: row.processed_at,
    }
  }

  private rowToCacheKey(row: CacheKeyRow): CacheKeyRecord {
    return {
      key: row.key,
      kind: row.kind as CacheKeyRecord['kind'],
      linkService: row.link_service,
      linkType: row.link_type,
      linkId: row.link_id,
      service: row.service,
      scopeType: row.scope_type,
      scopeParams: row.scope_params,
      parentKey: row.parent_key,
      evictionPolicy: row.eviction_policy as CacheKeyRecord['evictionPolicy'],
      frozen: row.frozen === 1,
      frozenAt: row.frozen_at,
      inheritedFrozen: row.inherited_frozen === 1,
      lastAccessedAt: row.last_accessed_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      holdCount: row.hold_count,
      estimatedSizeBytes: row.estimated_size_bytes,
      pendingIdMappings: row.pending_id_mappings,
    }
  }

  private rowToReadModel(row: ReadModelRowWithCacheKeys): ReadModelRecord {
    return {
      id: row.id,
      collection: row.collection,
      cacheKeys: JSON.parse(row.cache_keys) as string[],
      serverData: row._server_data,
      effectiveData: row._effective_data,
      hasLocalChanges: row._has_local_changes === 1,
      updatedAt: row.updated_at,
      revision: row._revision,
      position: row._position,
      _clientMetadata: row.__client_id
        ? { clientId: row.__client_id, reconciledAt: row.__reconciled_at ?? undefined }
        : null,
    }
  }
}

// Row types for SQLite results

interface CacheKeyRow {
  key: string
  kind: string
  link_service: string | null
  link_type: string | null
  link_id: string | null
  service: string | null
  scope_type: string | null
  scope_params: string | null
  parent_key: string | null
  eviction_policy: string
  frozen: number
  frozen_at: number | null
  inherited_frozen: number
  last_accessed_at: number
  expires_at: number | null
  created_at: number
  hold_count: number
  estimated_size_bytes: number | null
  pending_id_mappings: string | null
}

interface CommandRow {
  seq: number
  command_id: string
  cache_key: string
  service: string
  type: string
  data: string
  status: string
  depends_on: string
  blocked_by: string
  attempts: number
  last_attempt_at: number | null
  error: string | null
  server_response: string | null
  post_process: string | null
  creates: string | null
  revision: string | null
  path: string | null
  file_refs: string | null
  command_id_paths: string | null
  affected_aggregates: string | null
  pending_aggregate_coverage: string | null
  created_at: number
  updated_at: number
}

interface EventRow {
  id: string
  type: string
  stream_id: string
  persistence: string
  data: string
  position: string | null
  revision: string | null
  command_id: string | null
  created_at: number
  processed_at: number | null
}

interface CommandIdMappingRow {
  client_id: string
  server_id: string
  created_at: number
}

interface ReadModelRow {
  id: string
  collection: string
  _server_data: string | null
  _effective_data: string
  _has_local_changes: number
  _revision: string | null
  _position: string | null
  updated_at: number
  __client_id: string | null
  __reconciled_at: number | null
}

interface EventRowWithCacheKeys extends EventRow {
  cache_keys: string
}

interface ReadModelRowWithCacheKeys extends ReadModelRow {
  cache_keys: string
}

// Query helper — returns SQL fragments for LEFT JOINing a junction table
// and aggregating cache keys into a JSON array column.

interface JoinCacheKeysOptions {
  srcAlias: string
  junctionTable: string
  pk?: string
  fk: string
  junctionAlias?: string
}

function joinCacheKeys({
  srcAlias,
  junctionTable,
  fk,
  pk = 'id',
  junctionAlias = 'agg_ck',
}: JoinCacheKeysOptions) {
  return {
    column: `COALESCE(json_group_array(${junctionAlias}.cache_key) FILTER (WHERE ${junctionAlias}.cache_key IS NOT NULL), '[]') AS cache_keys`,
    join: `LEFT JOIN ${junctionTable} ${junctionAlias} ON ${junctionAlias}.${fk} = ${srcAlias}.${pk}`,
    groupBy: `GROUP BY ${srcAlias}.${pk}`,
  }
}
