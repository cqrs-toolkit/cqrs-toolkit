/**
 * In-memory mock implementation of `ICommandIdMappingStore` for unit tests.
 *
 * Backed by a plain `Map` the test constructs up front. No flush queue, no TTL
 * sweep, no storage round-trips. Lifecycle methods are no-ops.
 */

import type { CommandIdMappingRecord } from '../../storage/IStorage.js'
import type { ICommandIdMappingStore } from './ICommandIdMappingStore.js'

export class MockCommandIdMappingStore implements ICommandIdMappingStore {
  private readonly byClientId: Map<string, CommandIdMappingRecord>
  private readonly byServerId: Map<string, CommandIdMappingRecord>

  constructor(records: readonly CommandIdMappingRecord[] = []) {
    this.byClientId = new Map(records.map((r) => [r.clientId, r]))
    this.byServerId = new Map(records.map((r) => [r.serverId, r]))
  }

  async initialize(): Promise<void> {}

  get(clientId: string): CommandIdMappingRecord | undefined {
    return this.byClientId.get(clientId)
  }

  getByServerId(serverId: string): CommandIdMappingRecord | undefined {
    return this.byServerId.get(serverId)
  }

  getMany(clientIds: readonly string[]): Map<string, CommandIdMappingRecord> {
    const result = new Map<string, CommandIdMappingRecord>()
    for (const id of clientIds) {
      const record = this.byClientId.get(id)
      if (record) result.set(id, record)
    }
    return result
  }

  save(record: CommandIdMappingRecord): void {
    const existing = this.byClientId.get(record.clientId)
    if (existing && existing.serverId !== record.serverId) {
      this.byServerId.delete(existing.serverId)
    }
    this.byClientId.set(record.clientId, record)
    this.byServerId.set(record.serverId, record)
  }

  saveMany(records: readonly CommandIdMappingRecord[]): void {
    for (const record of records) {
      this.save(record)
    }
  }

  async deleteAll(): Promise<void> {
    this.byClientId.clear()
    this.byServerId.clear()
  }

  async flush(): Promise<void> {}

  async destroy(): Promise<void> {}

  get size(): number {
    return this.byClientId.size
  }
}
