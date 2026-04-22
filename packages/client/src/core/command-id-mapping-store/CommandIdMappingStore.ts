/**
 * Command id mapping store — owns the clientId→serverId reconciliation
 * records produced when a create command with a temporary id succeeds.
 *
 * Memory-first: reads are synchronous against two in-memory indices
 * (`byClientId`, `byServerId`). Writes mutate the indices immediately and
 * mark the record dirty for asynchronous batched flush to storage.
 *
 * Durable backing survives shared-worker restarts: `initialize()` loads
 * all non-expired records from storage in a single transaction that also
 * purges expired rows, via `IStorage.loadAndPurgeCommandIdMappings`.
 *
 * TTL eviction runs in-memory on a coarse periodic timer (default every
 * 5 minutes). A matching storage-side delete sweeps expired rows on the
 * same cadence.
 */

import { assert } from '#utils'
import { type Link, logProvider } from '@meticoeus/ddd-es'
import type { CommandIdMappingRecord, IStorage } from '../../storage/IStorage.js'
import type { EnqueueCommand } from '../../types/commands.js'
import type { ICommandIdMappingStore } from './ICommandIdMappingStore.js'

/** Default TTL for mappings: 5 minutes. */
const DEFAULT_MAPPING_TTL_MS = 5 * 60 * 1000

/** Default sweep cadence matches the TTL so records evict within one TTL window. */
const DEFAULT_SWEEP_INTERVAL_MS = 5 * 60 * 1000

export interface CommandIdMappingStoreConfig {
  /** TTL for mappings in milliseconds. Default: 5 minutes. */
  ttlMs?: number
  /** Sweep cadence in milliseconds. Default: 5 minutes. */
  sweepIntervalMs?: number
}

export class CommandIdMappingStore<
  TLink extends Link,
  TCommand extends EnqueueCommand,
> implements ICommandIdMappingStore {
  private readonly byClientId = new Map<string, CommandIdMappingRecord>()
  private readonly byServerId = new Map<string, CommandIdMappingRecord>()
  private readonly dirty = new Set<string>()

  private ready: Promise<void>
  private resolveReady!: () => void
  private initialized = false

  private flushInFlight: Promise<void> | undefined
  private sweepTimer: ReturnType<typeof setInterval> | undefined

  private readonly ttlMs: number
  private readonly sweepIntervalMs: number

  constructor(
    private readonly storage: IStorage<TLink, TCommand>,
    config: CommandIdMappingStoreConfig = {},
  ) {
    this.ttlMs = config.ttlMs ?? DEFAULT_MAPPING_TTL_MS
    this.sweepIntervalMs = config.sweepIntervalMs ?? DEFAULT_SWEEP_INTERVAL_MS
    this.ready = new Promise<void>((resolve) => {
      this.resolveReady = resolve
    })
  }

  async initialize(): Promise<void> {
    assert(!this.initialized, 'CommandIdMappingStore.initialize() must only be called once')
    const cutoff = Date.now() - this.ttlMs
    const records = await this.storage.loadAndPurgeCommandIdMappings(cutoff)
    for (const record of records) {
      this.byClientId.set(record.clientId, record)
      this.byServerId.set(record.serverId, record)
    }
    this.initialized = true
    this.resolveReady()
    this.sweepTimer = setInterval(() => {
      this.sweep().catch((err) => {
        logProvider.log.error({ err }, 'CommandIdMappingStore sweep failed')
      })
    }, this.sweepIntervalMs)
  }

  get(clientId: string): CommandIdMappingRecord | undefined {
    this.assertInitialized()
    return this.byClientId.get(clientId)
  }

  getByServerId(serverId: string): CommandIdMappingRecord | undefined {
    this.assertInitialized()
    return this.byServerId.get(serverId)
  }

  getMany(clientIds: readonly string[]): Map<string, CommandIdMappingRecord> {
    this.assertInitialized()
    const result = new Map<string, CommandIdMappingRecord>()
    for (const id of clientIds) {
      const record = this.byClientId.get(id)
      if (record) result.set(id, record)
    }
    return result
  }

  save(record: CommandIdMappingRecord): void {
    this.assertInitialized()
    this.writeInPlace(record)
    this.scheduleFlush()
  }

  saveMany(records: readonly CommandIdMappingRecord[]): void {
    this.assertInitialized()
    if (records.length === 0) return
    for (const record of records) {
      this.writeInPlace(record)
    }
    this.scheduleFlush()
  }

  async deleteAll(): Promise<void> {
    await this.ready
    this.byClientId.clear()
    this.byServerId.clear()
    this.dirty.clear()
    if (this.flushInFlight) {
      await this.flushInFlight
    }
    await this.storage.deleteAllCommandIdMappings()
  }

  async flush(): Promise<void> {
    if (this.flushInFlight) {
      await this.flushInFlight
    }
    if (this.dirty.size > 0) {
      await this.doFlush()
    }
  }

  async destroy(): Promise<void> {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer)
      this.sweepTimer = undefined
    }
    await this.flush()
  }

  get size(): number {
    return this.byClientId.size
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private assertInitialized(): void {
    assert(
      this.initialized,
      'CommandIdMappingStore.initialize() must be awaited before reading or writing',
    )
  }

  private writeInPlace(record: CommandIdMappingRecord): void {
    // Upsert: replace any existing entry under the same clientId; keep the
    // reverse index consistent by removing the old serverId pointer first.
    const existing = this.byClientId.get(record.clientId)
    if (existing && existing.serverId !== record.serverId) {
      this.byServerId.delete(existing.serverId)
    }
    this.byClientId.set(record.clientId, record)
    this.byServerId.set(record.serverId, record)
    this.dirty.add(record.clientId)
  }

  private scheduleFlush(): void {
    if (this.flushInFlight) return
    // Defer to microtask so all synchronous writes in the current tick
    // accumulate into `dirty` before the flush snapshots it.
    this.flushInFlight = Promise.resolve()
      .then(() => this.doFlush())
      .finally(() => {
        this.flushInFlight = undefined
        if (this.dirty.size > 0) {
          this.scheduleFlush()
        }
      })
  }

  private async doFlush(): Promise<void> {
    const snapshot = new Set(this.dirty)
    this.dirty.clear()

    const records: CommandIdMappingRecord[] = []
    for (const clientId of snapshot) {
      const record = this.byClientId.get(clientId)
      if (record) records.push(record)
    }
    if (records.length > 0) {
      await this.storage.saveCommandIdMappings(records)
    }
  }

  /**
   * Evict expired records from the in-memory indices and purge them from
   * durable storage. Runs on the periodic sweep timer.
   */
  private async sweep(): Promise<void> {
    const cutoff = Date.now() - this.ttlMs
    for (const [clientId, record] of this.byClientId) {
      if (record.createdAt < cutoff) {
        this.byClientId.delete(clientId)
        this.byServerId.delete(record.serverId)
        this.dirty.delete(clientId)
      }
    }
    await this.storage.deleteCommandIdMappingsOlderThan(cutoff)
  }
}
