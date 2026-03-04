/**
 * Storage proxy for SharedWorker communication.
 *
 * This implements IStorage but routes all operations through
 * the SharedWorker via the message channel.
 */

import type { WorkerMessageChannel } from '../../protocol/MessageChannel.js'
import type {
  CacheKeyRecord,
  CachedEventRecord,
  IStorage,
  QueryOptions,
  ReadModelRecord,
  SessionRecord,
} from '../../storage/IStorage.js'
import type { CommandFilter, CommandRecord, CommandStatus } from '../../types/commands.js'
import type { StorageConfig } from '../../types/config.js'

/**
 * Storage proxy that routes all operations through the SharedWorker.
 */
export class SharedWorkerStorageProxy implements IStorage {
  private readonly channel: WorkerMessageChannel
  private readonly localHolds: Set<string>
  private readonly storageConfig: StorageConfig

  constructor(
    channel: WorkerMessageChannel,
    localHolds: Set<string>,
    storageConfig: StorageConfig,
  ) {
    this.channel = channel
    this.localHolds = localHolds
    this.storageConfig = storageConfig
  }

  // Lifecycle
  async initialize(): Promise<void> {
    await this.channel.request<void>('storage.initialize', [this.storageConfig])
  }

  async close(): Promise<void> {
    // No-op: SharedWorker manages its own storage lifecycle.
  }

  async clear(): Promise<void> {
    await this.channel.request<void>('storage.clear', [])
  }

  // Session operations
  async getSession(): Promise<SessionRecord | undefined> {
    return this.channel.request<SessionRecord | undefined>('storage.getSession', [])
  }

  async saveSession(session: SessionRecord): Promise<void> {
    await this.channel.request<void>('storage.saveSession', [session])
  }

  async deleteSession(): Promise<void> {
    await this.channel.request<void>('storage.deleteSession', [])
  }

  async touchSession(): Promise<void> {
    await this.channel.request<void>('storage.touchSession', [])
  }

  // Cache key operations
  async getCacheKey(key: string): Promise<CacheKeyRecord | undefined> {
    return this.channel.request<CacheKeyRecord | undefined>('storage.getCacheKey', [key])
  }

  async getAllCacheKeys(): Promise<CacheKeyRecord[]> {
    return this.channel.request<CacheKeyRecord[]>('storage.getAllCacheKeys', [])
  }

  async saveCacheKey(record: CacheKeyRecord): Promise<void> {
    await this.channel.request<void>('storage.saveCacheKey', [record])
  }

  async deleteCacheKey(key: string): Promise<void> {
    await this.channel.request<void>('storage.deleteCacheKey', [key])
  }

  async holdCacheKey(key: string): Promise<void> {
    this.localHolds.add(key)
    await this.channel.request<void>('storage.holdCacheKey', [key])
  }

  async releaseCacheKey(key: string): Promise<void> {
    await this.channel.request<void>('storage.releaseCacheKey', [key])
    // Only remove from local holds if hold count is now 0
    const cacheKey = await this.getCacheKey(key)
    if (!cacheKey || cacheKey.holdCount === 0) {
      this.localHolds.delete(key)
    }
  }

  async touchCacheKey(key: string): Promise<void> {
    await this.channel.request<void>('storage.touchCacheKey', [key])
  }

  async getEvictableCacheKeys(limit: number): Promise<CacheKeyRecord[]> {
    return this.channel.request<CacheKeyRecord[]>('storage.getEvictableCacheKeys', [limit])
  }

  // Command operations
  async getCommand(commandId: string): Promise<CommandRecord | undefined> {
    return this.channel.request<CommandRecord | undefined>('storage.getCommand', [commandId])
  }

  async getCommands(filter?: CommandFilter): Promise<CommandRecord[]> {
    return this.channel.request<CommandRecord[]>('storage.getCommands', [filter])
  }

  async getCommandsByStatus(status: CommandStatus | CommandStatus[]): Promise<CommandRecord[]> {
    return this.channel.request<CommandRecord[]>('storage.getCommandsByStatus', [status])
  }

  async getCommandsBlockedBy(commandId: string): Promise<CommandRecord[]> {
    return this.channel.request<CommandRecord[]>('storage.getCommandsBlockedBy', [commandId])
  }

  async saveCommand(command: CommandRecord): Promise<void> {
    await this.channel.request<void>('storage.saveCommand', [command])
  }

  async updateCommand(commandId: string, updates: Partial<CommandRecord>): Promise<void> {
    await this.channel.request<void>('storage.updateCommand', [commandId, updates])
  }

  async deleteCommand(commandId: string): Promise<void> {
    await this.channel.request<void>('storage.deleteCommand', [commandId])
  }

  async deleteAllCommands(): Promise<void> {
    await this.channel.request<void>('storage.deleteAllCommands', [])
  }

  // Event cache operations
  async getCachedEvent(id: string): Promise<CachedEventRecord | undefined> {
    return this.channel.request<CachedEventRecord | undefined>('storage.getCachedEvent', [id])
  }

  async getCachedEventsByCacheKey(cacheKey: string): Promise<CachedEventRecord[]> {
    return this.channel.request<CachedEventRecord[]>('storage.getCachedEventsByCacheKey', [
      cacheKey,
    ])
  }

  async getCachedEventsByStream(streamId: string): Promise<CachedEventRecord[]> {
    return this.channel.request<CachedEventRecord[]>('storage.getCachedEventsByStream', [streamId])
  }

  async getAnticipatedEventsByCommand(commandId: string): Promise<CachedEventRecord[]> {
    return this.channel.request<CachedEventRecord[]>('storage.getAnticipatedEventsByCommand', [
      commandId,
    ])
  }

  async saveCachedEvent(event: CachedEventRecord): Promise<void> {
    await this.channel.request<void>('storage.saveCachedEvent', [event])
  }

  async saveCachedEvents(events: CachedEventRecord[]): Promise<void> {
    await this.channel.request<void>('storage.saveCachedEvents', [events])
  }

  async deleteCachedEvent(id: string): Promise<void> {
    await this.channel.request<void>('storage.deleteCachedEvent', [id])
  }

  async deleteAnticipatedEventsByCommand(commandId: string): Promise<void> {
    await this.channel.request<void>('storage.deleteAnticipatedEventsByCommand', [commandId])
  }

  async deleteCachedEventsByCacheKey(cacheKey: string): Promise<void> {
    await this.channel.request<void>('storage.deleteCachedEventsByCacheKey', [cacheKey])
  }

  // Read model operations
  async getReadModel(collection: string, id: string): Promise<ReadModelRecord | undefined> {
    return this.channel.request<ReadModelRecord | undefined>('storage.getReadModel', [
      collection,
      id,
    ])
  }

  async getReadModelsByCollection(
    collection: string,
    options?: QueryOptions,
  ): Promise<ReadModelRecord[]> {
    return this.channel.request<ReadModelRecord[]>('storage.getReadModelsByCollection', [
      collection,
      options,
    ])
  }

  async getReadModelsByCacheKey(cacheKey: string): Promise<ReadModelRecord[]> {
    return this.channel.request<ReadModelRecord[]>('storage.getReadModelsByCacheKey', [cacheKey])
  }

  async saveReadModel(record: ReadModelRecord): Promise<void> {
    await this.channel.request<void>('storage.saveReadModel', [record])
  }

  async saveReadModels(records: ReadModelRecord[]): Promise<void> {
    await this.channel.request<void>('storage.saveReadModels', [records])
  }

  async deleteReadModel(collection: string, id: string): Promise<void> {
    await this.channel.request<void>('storage.deleteReadModel', [collection, id])
  }

  async deleteReadModelsByCacheKey(cacheKey: string): Promise<void> {
    await this.channel.request<void>('storage.deleteReadModelsByCacheKey', [cacheKey])
  }

  async deleteReadModelsByCollection(collection: string): Promise<void> {
    await this.channel.request<void>('storage.deleteReadModelsByCollection', [collection])
  }
}
