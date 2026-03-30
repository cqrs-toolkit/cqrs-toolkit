/**
 * In-memory storage implementation for Mode A (online-only).
 * All data is stored in memory and lost on page reload.
 */

import type { Link } from '@meticoeus/ddd-es'
import type { CommandFilter, CommandRecord, CommandStatus } from '../types/commands.js'
import type {
  CacheKeyRecord,
  CachedEventRecord,
  CommandIdMappingRecord,
  IStorage,
  IStorageQueryOptions,
  ReadModelRecord,
  SessionRecord,
} from './IStorage.js'

/**
 * In-memory storage implementation.
 * Thread-safe within a single JavaScript context.
 */
export class InMemoryStorage<TLink extends Link> implements IStorage<TLink> {
  private session?: SessionRecord
  private cacheKeys: Map<string, CacheKeyRecord> = new Map()
  private commands: Map<string, CommandRecord<TLink>> = new Map()
  private cachedEvents: Map<string, CachedEventRecord> = new Map()
  private readModels: Map<string, ReadModelRecord> = new Map()
  private commandIdMappingsByClientId: Map<string, CommandIdMappingRecord> = new Map()
  private commandIdMappingsByServerId: Map<string, CommandIdMappingRecord> = new Map()

  private initialized = false

  // Lifecycle

  async initialize(): Promise<void> {
    this.initialized = true
  }

  async close(): Promise<void> {
    this.initialized = false
  }

  async clear(): Promise<void> {
    this.session = undefined
    this.cacheKeys.clear()
    this.commands.clear()
    this.cachedEvents.clear()
    this.readModels.clear()
  }

  // Session operations

  async getSession(): Promise<SessionRecord | undefined> {
    return this.session
  }

  async saveSession(session: SessionRecord): Promise<void> {
    this.session = session
  }

  async deleteSession(): Promise<void> {
    this.session = undefined
    // Clear all associated data
    this.cacheKeys.clear()
    this.commands.clear()
    this.cachedEvents.clear()
    this.readModels.clear()
  }

  async touchSession(): Promise<void> {
    if (this.session) {
      this.session = { ...this.session, lastSeenAt: Date.now() }
    }
  }

  // Cache key operations

  async getCacheKey(key: string): Promise<CacheKeyRecord | undefined> {
    return this.cacheKeys.get(key)
  }

  async getAllCacheKeys(): Promise<CacheKeyRecord[]> {
    return Array.from(this.cacheKeys.values())
  }

  async saveCacheKey(record: CacheKeyRecord): Promise<void> {
    this.cacheKeys.set(record.key, record)
  }

  async deleteCacheKey(key: string): Promise<void> {
    this.cacheKeys.delete(key)
    // Remove cache key association from events, deleting orphans
    await this.removeCacheKeyFromEvents(key)
    // Remove cache key association from read models, deleting orphans
    await this.removeCacheKeyFromReadModels(key)
  }

  async holdCacheKey(key: string): Promise<void> {
    const record = this.cacheKeys.get(key)
    if (record) {
      this.cacheKeys.set(key, { ...record, holdCount: record.holdCount + 1 })
    }
  }

  async releaseCacheKey(key: string): Promise<void> {
    const record = this.cacheKeys.get(key)
    if (record && record.holdCount > 0) {
      this.cacheKeys.set(key, { ...record, holdCount: record.holdCount - 1 })
    }
  }

  async touchCacheKey(key: string): Promise<void> {
    const record = this.cacheKeys.get(key)
    if (record) {
      this.cacheKeys.set(key, { ...record, lastAccessedAt: Date.now() })
    }
  }

  async getChildCacheKeys(parentKey: string): Promise<CacheKeyRecord[]> {
    return Array.from(this.cacheKeys.values()).filter((record) => record.parentKey === parentKey)
  }

  async getEvictableCacheKeys(limit: number): Promise<CacheKeyRecord[]> {
    const evictable = Array.from(this.cacheKeys.values())
      .filter((record) => {
        if (record.holdCount > 0) return false
        if (record.frozen) return false
        if (record.inheritedFrozen) return false
        // Only leaf keys (no children) are evictable
        const hasChildren = Array.from(this.cacheKeys.values()).some(
          (r) => r.parentKey === record.key,
        )
        if (hasChildren) return false
        return true
      })
      .sort((a, b) => {
        // Ephemeral keys evicted before persistent
        if (a.evictionPolicy !== b.evictionPolicy) {
          return a.evictionPolicy === 'ephemeral' ? -1 : 1
        }
        return a.lastAccessedAt - b.lastAccessedAt // LRU order
      })

    return evictable.slice(0, limit)
  }

  async filterExistingCacheKeys(keys: string[]): Promise<string[]> {
    return keys.filter((key) => this.cacheKeys.has(key))
  }

  // Command operations

  async getCommand(commandId: string): Promise<CommandRecord<TLink> | undefined> {
    return this.commands.get(commandId)
  }

  async getCommands(filter?: CommandFilter): Promise<CommandRecord<TLink>[]> {
    let commands = Array.from(this.commands.values())

    if (filter) {
      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status]
        commands = commands.filter((cmd) => statuses.includes(cmd.status))
      }
      if (filter.type) {
        const types = Array.isArray(filter.type) ? filter.type : [filter.type]
        commands = commands.filter((cmd) => types.includes(cmd.type))
      }
      if (filter.service) {
        commands = commands.filter((cmd) => cmd.service === filter.service)
      }
      if (filter.createdAfter !== undefined) {
        commands = commands.filter((cmd) => cmd.createdAt > filter.createdAfter!)
      }
      if (filter.createdBefore !== undefined) {
        commands = commands.filter((cmd) => cmd.createdAt < filter.createdBefore!)
      }

      // Sort by createdAt ascending
      commands.sort((a, b) => a.createdAt - b.createdAt)

      if (filter.offset !== undefined) {
        commands = commands.slice(filter.offset)
      }
      if (filter.limit !== undefined) {
        commands = commands.slice(0, filter.limit)
      }
    }

    return commands
  }

  async getCommandsByStatus(
    status: CommandStatus | CommandStatus[],
  ): Promise<CommandRecord<TLink>[]> {
    return this.getCommands({ status })
  }

  async getCommandsBlockedBy(commandId: string): Promise<CommandRecord<TLink>[]> {
    return Array.from(this.commands.values()).filter((cmd) => cmd.blockedBy.includes(commandId))
  }

  async saveCommand(command: CommandRecord<TLink>): Promise<void> {
    this.commands.set(command.commandId, command)
  }

  async updateCommand(commandId: string, updates: Partial<CommandRecord<TLink>>): Promise<void> {
    const existing = this.commands.get(commandId)
    if (existing) {
      this.commands.set(commandId, { ...existing, ...updates, updatedAt: Date.now() })
    }
  }

  async deleteCommand(commandId: string): Promise<void> {
    this.commands.delete(commandId)
    // Delete associated anticipated events
    await this.deleteAnticipatedEventsByCommand(commandId)
  }

  async deleteAllCommands(): Promise<void> {
    this.commands.clear()
    // Delete all anticipated events
    for (const event of this.cachedEvents.values()) {
      if (event.persistence === 'Anticipated') {
        this.cachedEvents.delete(event.id)
      }
    }
  }

  // Event cache operations

  async getCachedEvent(id: string): Promise<CachedEventRecord | undefined> {
    return this.cachedEvents.get(id)
  }

  async getCachedEventsByCacheKey(cacheKey: string): Promise<CachedEventRecord[]> {
    return Array.from(this.cachedEvents.values()).filter((event) =>
      event.cacheKeys.includes(cacheKey),
    )
  }

  async getCachedEventsByStream(streamId: string): Promise<CachedEventRecord[]> {
    return Array.from(this.cachedEvents.values())
      .filter((event) => event.streamId === streamId)
      .sort((a, b) => {
        // Sort by position for permanent events, createdAt for others
        if (a.position && b.position) {
          return BigInt(a.position) < BigInt(b.position) ? -1 : 1
        }
        return a.createdAt - b.createdAt
      })
  }

  async getAnticipatedEventsByCommand(commandId: string): Promise<CachedEventRecord[]> {
    return Array.from(this.cachedEvents.values()).filter(
      (event) => event.persistence === 'Anticipated' && event.commandId === commandId,
    )
  }

  async saveCachedEvent(event: CachedEventRecord): Promise<void> {
    this.cachedEvents.set(event.id, event)
  }

  async saveCachedEvents(events: CachedEventRecord[]): Promise<void> {
    for (const event of events) {
      this.cachedEvents.set(event.id, event)
    }
  }

  async deleteCachedEvent(id: string): Promise<void> {
    this.cachedEvents.delete(id)
  }

  async deleteAnticipatedEventsByCommand(commandId: string): Promise<void> {
    for (const event of this.cachedEvents.values()) {
      if (event.persistence === 'Anticipated' && event.commandId === commandId) {
        this.cachedEvents.delete(event.id)
      }
    }
  }

  async removeCacheKeyFromEvents(cacheKey: string): Promise<string[]> {
    const deletedIds: string[] = []
    for (const event of this.cachedEvents.values()) {
      if (!event.cacheKeys.includes(cacheKey)) continue
      const remaining = event.cacheKeys.filter((k) => k !== cacheKey)
      if (remaining.length === 0) {
        deletedIds.push(event.id)
        this.cachedEvents.delete(event.id)
      } else {
        this.cachedEvents.set(event.id, { ...event, cacheKeys: remaining })
      }
    }
    return deletedIds
  }

  async addCacheKeysToEvent(eventId: string, cacheKeys: string[]): Promise<void> {
    const event = this.cachedEvents.get(eventId)
    if (!event) return
    const merged = new Set(event.cacheKeys)
    for (const key of cacheKeys) {
      merged.add(key)
    }
    this.cachedEvents.set(eventId, { ...event, cacheKeys: Array.from(merged) })
  }

  // Read model operations

  private getReadModelKey(collection: string, id: string): string {
    return `${collection}:${id}`
  }

  async getReadModel(collection: string, id: string): Promise<ReadModelRecord | undefined> {
    return this.readModels.get(this.getReadModelKey(collection, id))
  }

  async getReadModelsByCollection(
    collection: string,
    options?: IStorageQueryOptions,
  ): Promise<ReadModelRecord[]> {
    let records = Array.from(this.readModels.values()).filter(
      (record) => record.collection === collection,
    )

    // Apply ordering
    if (options?.orderBy) {
      const direction = options.orderDirection === 'desc' ? -1 : 1
      records.sort((a, b) => {
        const aData = JSON.parse(a.effectiveData)
        const bData = JSON.parse(b.effectiveData)
        const aVal = aData[options.orderBy!]
        const bVal = bData[options.orderBy!]
        if (aVal < bVal) return -1 * direction
        if (aVal > bVal) return 1 * direction
        return 0
      })
    }

    // Apply pagination
    if (options?.offset !== undefined) {
      records = records.slice(options.offset)
    }
    if (options?.limit !== undefined) {
      records = records.slice(0, options.limit)
    }

    return records
  }

  async getReadModelsByCacheKey(cacheKey: string): Promise<ReadModelRecord[]> {
    const records: ReadModelRecord[] = []
    for (const record of this.readModels.values()) {
      if (record.cacheKeys.includes(cacheKey)) records.push(record)
    }
    records.sort((a, b) => a.updatedAt - b.updatedAt)
    return records
  }

  async countReadModels(collection: string, cacheKey?: string): Promise<number> {
    let count = 0
    for (const record of this.readModels.values()) {
      if (record.collection !== collection) continue
      if (cacheKey && !record.cacheKeys.includes(cacheKey)) continue
      count++
    }
    return count
  }

  async saveReadModel(record: ReadModelRecord): Promise<void> {
    this.readModels.set(this.getReadModelKey(record.collection, record.id), record)
  }

  async saveReadModels(records: ReadModelRecord[]): Promise<void> {
    for (const record of records) {
      this.readModels.set(this.getReadModelKey(record.collection, record.id), record)
    }
  }

  async deleteReadModel(collection: string, id: string): Promise<void> {
    this.readModels.delete(this.getReadModelKey(collection, id))
  }

  async removeCacheKeyFromReadModels(cacheKey: string): Promise<void> {
    for (const [key, record] of this.readModels.entries()) {
      if (!record.cacheKeys.includes(cacheKey)) continue
      const remaining = record.cacheKeys.filter((k) => k !== cacheKey)
      if (remaining.length === 0) {
        this.readModels.delete(key)
      } else {
        this.readModels.set(key, { ...record, cacheKeys: remaining })
      }
    }
  }

  async addCacheKeysToReadModel(
    collection: string,
    id: string,
    cacheKeys: string[],
  ): Promise<void> {
    const record = this.readModels.get(this.getReadModelKey(collection, id))
    if (!record) return
    const merged = new Set(record.cacheKeys)
    for (const key of cacheKeys) {
      merged.add(key)
    }
    this.readModels.set(this.getReadModelKey(collection, id), {
      ...record,
      cacheKeys: Array.from(merged),
    })
  }

  async deleteReadModelsByCollection(collection: string): Promise<void> {
    for (const [key, record] of this.readModels.entries()) {
      if (record.collection === collection) {
        this.readModels.delete(key)
      }
    }
  }

  async getReadModelCount(): Promise<number> {
    return this.readModels.size
  }

  async getReadModelRevisions(
    collection: string,
  ): Promise<Array<{ id: string; revision: string }>> {
    const results: Array<{ id: string; revision: string }> = []
    for (const record of this.readModels.values()) {
      if (record.collection === collection && record.revision !== null) {
        results.push({ id: record.id, revision: record.revision })
      }
    }
    return results
  }

  // Command ID mapping operations

  async getCommandIdMapping(clientId: string): Promise<CommandIdMappingRecord | undefined> {
    return this.commandIdMappingsByClientId.get(clientId)
  }

  async getCommandIdMappingByServerId(
    serverId: string,
  ): Promise<CommandIdMappingRecord | undefined> {
    return this.commandIdMappingsByServerId.get(serverId)
  }

  async saveCommandIdMapping(record: CommandIdMappingRecord): Promise<void> {
    this.commandIdMappingsByClientId.set(record.clientId, record)
    this.commandIdMappingsByServerId.set(record.serverId, record)
  }

  async deleteCommandIdMappingsOlderThan(timestamp: number): Promise<void> {
    for (const [key, record] of this.commandIdMappingsByClientId) {
      if (record.createdAt < timestamp) {
        this.commandIdMappingsByClientId.delete(key)
        this.commandIdMappingsByServerId.delete(record.serverId)
      }
    }
  }

  async deleteAllCommandIdMappings(): Promise<void> {
    this.commandIdMappingsByClientId.clear()
    this.commandIdMappingsByServerId.clear()
  }
}
