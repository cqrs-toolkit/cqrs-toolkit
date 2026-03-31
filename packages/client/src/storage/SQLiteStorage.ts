/**
 * SQLite storage implementation.
 *
 * Always receives an injected `ISqliteDb` — never loads WASM or opens
 * databases itself.  Two creation paths exist upstream:
 *
 * - **Mode C** (DedicatedWorker): `loadAndOpenDb()` → `LocalSqliteDb`
 * - **Mode B** (SharedWorker): `RemoteSqliteDb` proxying to a child worker
 */

import { Link } from '@meticoeus/ddd-es'
import type { CommandFilter, CommandRecord, CommandStatus } from '../types/commands.js'
import type { SchemaMigration } from '../types/config.js'
import { assert } from '../utils/assert.js'
import type { ISqliteDb, SqliteBatchStatement } from './ISqliteDb.js'
import type {
  CacheKeyRecord,
  CachedEventRecord,
  IStorage,
  IStorageQueryOptions,
  ReadModelRecord,
  SessionRecord,
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
export class SQLiteStorage<TLink extends Link> implements IStorage<TLink> {
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
      `INSERT OR REPLACE INTO session (id, user_id, created_at, last_seen_at)
       VALUES (1, ?, ?, ?)`,
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
      `INSERT OR REPLACE INTO cache_keys
       (key, kind, link_service, link_type, link_id, service, scope_type, scope_params, parent_key, eviction_policy, frozen, frozen_at, inherited_frozen, last_accessed_at, expires_at, created_at, hold_count, estimated_size_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

  async getCommand(commandId: string): Promise<CommandRecord<TLink> | undefined> {
    this.assertInitialized()
    const row = await this.queryOne<CommandRow>('SELECT * FROM commands WHERE command_id = ?', [
      commandId,
    ])

    if (!row) return undefined

    return this.rowToCommand(row)
  }

  async getCommands(filter?: CommandFilter): Promise<CommandRecord<TLink>[]> {
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

    sql += ' ORDER BY created_at ASC'

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
  ): Promise<CommandRecord<TLink>[]> {
    return this.getCommands({ status })
  }

  async getCommandsBlockedBy(commandId: string): Promise<CommandRecord<TLink>[]> {
    this.assertInitialized()
    const rows = await this.query<CommandRow>(
      `SELECT * FROM commands WHERE EXISTS (SELECT 1 FROM json_each(blocked_by) WHERE value = ?)`,
      [commandId],
    )
    return rows.map((row) => this.rowToCommand(row))
  }

  async saveCommand(command: CommandRecord<TLink>): Promise<void> {
    this.assertInitialized()
    await this.exec(
      `INSERT OR REPLACE INTO commands
       (command_id, cache_key, service, type, data, status, depends_on, blocked_by, attempts,
        last_attempt_at, error, server_response, post_process, creates, revision,
        path, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
        command.createdAt,
        command.updatedAt,
      ],
    )
  }

  async updateCommand(commandId: string, updates: Partial<CommandRecord<TLink>>): Promise<void> {
    this.assertInitialized()
    const current = await this.getCommand(commandId)
    if (!current) return

    const updated = { ...current, ...updates, updatedAt: Date.now() }
    await this.saveCommand(updated)
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

  async saveCachedEvent(event: CachedEventRecord): Promise<void> {
    this.assertInitialized()
    const statements: SqliteBatchStatement[] = [
      {
        sql: `INSERT OR REPLACE INTO cached_events
         (id, type, stream_id, persistence, data, position, revision, command_id, created_at, processed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      {
        sql: 'SELECT COUNT(*) as count FROM cached_events WHERE processed_at IS NOT NULL AND processed_at < ?',
        bind: [olderThan],
        returnRows: true,
      },
      {
        sql: 'DELETE FROM cached_event_cache_keys WHERE event_id IN (SELECT id FROM cached_events WHERE processed_at IS NOT NULL AND processed_at < ?)',
        bind: [olderThan],
      },
      {
        sql: 'DELETE FROM cached_events WHERE processed_at IS NOT NULL AND processed_at < ?',
        bind: [olderThan],
      },
    ])
    const rows = (results[0] ?? []) as Array<{ count: number }>
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

  async removeCacheKeyFromEvents(cacheKey: string): Promise<string[]> {
    this.assertInitialized()
    const statements = this.buildRemoveCacheKeyFromEvents(cacheKey, true)
    const results = await this.db.execBatch(statements)
    const orphanRows = (results[1] ?? []) as Array<{ id: string }>
    return orphanRows.map((row) => row.id)
  }

  private buildRemoveCacheKeyFromEvents(
    cacheKey: string,
    returnDeleted = false,
  ): SqliteBatchStatement[] {
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

  async addCacheKeysToEvent(eventId: string, cacheKeys: string[]): Promise<void> {
    this.assertInitialized()
    await this.insertJunctionRows(
      'cached_event_cache_keys',
      '(event_id, cache_key)',
      cacheKeys.map((cacheKey) => [eventId, cacheKey]),
    )
  }

  // Read model operations

  async getReadModel(collection: string, id: string): Promise<ReadModelRecord | undefined> {
    this.assertInitialized()
    const table = this.rmTable(collection)
    const ck = joinCacheKeys({
      srcAlias: 'rm',
      junctionTable: `rm_${collection}_cache_keys`,
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

  async getReadModelsByCollection(
    collection: string,
    options?: IStorageQueryOptions,
  ): Promise<ReadModelRecord[]> {
    this.assertInitialized()
    const table = this.rmTable(collection)
    const ck = joinCacheKeys({
      srcAlias: 'rm',
      junctionTable: `rm_${collection}_cache_keys`,
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
    for (const name of this.collections) {
      const table = this.rmTable(name)
      const ck = joinCacheKeys({
        srcAlias: 'rm',
        junctionTable: `rm_${name}_cache_keys`,
        fk: 'entity_id',
      })
      const rows = await this.query<ReadModelRowWithCacheKeys>(
        `SELECT rm.*, '${name}' as collection, ${ck.column} FROM ${table} rm
         INNER JOIN rm_${name}_cache_keys filter_ck ON filter_ck.entity_id = rm.id
         ${ck.join}
         WHERE filter_ck.cache_key = ?
         ${ck.groupBy}
         ORDER BY rm.updated_at ASC`,
        [cacheKey],
      )
      allRecords.push(...rows.map((row) => this.rowToReadModel(row)))
    }
    return allRecords
  }

  async countReadModels(collection: string, cacheKey?: string): Promise<number> {
    this.assertInitialized()
    const table = this.rmTable(collection)
    if (cacheKey) {
      const rows = await this.query<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM ${table} rm JOIN rm_${collection}_cache_keys j ON rm.id = j.entity_id WHERE j.cache_key = ?`,
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
        sql: `INSERT OR REPLACE INTO ${table}
         (id, _server_data, _effective_data, _has_local_changes, _revision, _position, updated_at, __client_id, __reconciled_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      `rm_${record.collection}_cache_keys`,
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
        sql: `INSERT OR REPLACE INTO ${table} ${columns} VALUES ${placeholders}`,
        bind: params,
      })

      const junctionRows: unknown[][] = []
      for (const record of group) {
        for (const cacheKey of record.cacheKeys) {
          junctionRows.push([record.id, cacheKey])
        }
      }
      const junction = this.buildJunctionInsert(
        `rm_${collection}_cache_keys`,
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
    await this.db.execBatch([
      { sql: `DELETE FROM rm_${collection}_cache_keys WHERE entity_id = ?`, bind: [id] },
      { sql: `DELETE FROM ${table} WHERE id = ?`, bind: [id] },
    ])
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
    for (const name of this.collections) {
      statements.push({
        sql: `DELETE FROM rm_${name}_cache_keys WHERE cache_key = ?`,
        bind: [cacheKey],
      })
      statements.push({
        sql: `DELETE FROM ${this.rmTable(name)} WHERE id NOT IN (SELECT entity_id FROM rm_${name}_cache_keys)`,
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
    this.rmTable(collection) // validate collection name
    await this.insertJunctionRows(
      `rm_${collection}_cache_keys`,
      '(entity_id, cache_key)',
      cacheKeys.map((cacheKey) => [id, cacheKey]),
    )
  }

  async deleteReadModelsByCollection(collection: string): Promise<void> {
    this.assertInitialized()
    const table = this.rmTable(collection)
    await this.db.execBatch([
      { sql: `DELETE FROM rm_${collection}_cache_keys` },
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
    clientId: string,
  ): Promise<import('./IStorage.js').CommandIdMappingRecord | undefined> {
    this.assertInitialized()
    const row = await this.queryOne<CommandIdMappingRow>(
      'SELECT * FROM command_id_mappings WHERE client_id = ?',
      [clientId],
    )
    if (!row) return undefined
    return {
      clientId: row.client_id,
      serverId: row.server_id,
      data: row.data,
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
      data: row.data,
      createdAt: row.created_at,
    }
  }

  async saveCommandIdMapping(
    record: import('./IStorage.js').CommandIdMappingRecord,
  ): Promise<void> {
    this.assertInitialized()
    await this.exec(
      `INSERT OR REPLACE INTO command_id_mappings (client_id, server_id, data, created_at)
       VALUES (?, ?, ?, ?)`,
      [record.clientId, record.serverId, record.data, record.createdAt],
    )
  }

  async deleteCommandIdMappingsOlderThan(timestamp: number): Promise<void> {
    this.assertInitialized()
    await this.exec('DELETE FROM command_id_mappings WHERE created_at < ?', [timestamp])
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

  private rowToCommand(row: CommandRow): CommandRecord<TLink> {
    return {
      commandId: row.command_id,
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
}

interface CommandRow {
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
  data: string
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
