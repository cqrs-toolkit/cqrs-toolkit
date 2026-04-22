/**
 * Command store — owns all CommandRecord lifecycle in memory.
 *
 * All code that needs to load or save command records goes through this service
 * instead of hitting IStorage directly. Actively-needed commands live in an
 * active map; terminal commands move to a TTL cache for bounded memory retention.
 * Mutations are synchronous on the in-memory reference and flushed to storage
 * asynchronously via a single-in-flight write queue with batched coalescing.
 */

import { assert } from '#utils'
import type { Link } from '@meticoeus/ddd-es'
import type { IStorage } from '../../storage/IStorage.js'
import type {
  CommandFilter,
  CommandRecord,
  CommandStatus,
  EnqueueCommand,
} from '../../types/commands.js'
import { isTerminalStatus } from '../../types/commands.js'
import { BatchUpdateEntry, ICommandStore } from './ICommandStore.js'

/**
 * Statuses that are always kept in the active map. Commands in these statuses
 * are loaded on initialize and maintained in memory throughout their lifecycle.
 */
const IN_MEMORY_STATUSES: readonly CommandStatus[] = [
  'pending',
  'blocked',
  'sending',
  'succeeded',
] as const

function isInMemoryStatus(status: CommandStatus): boolean {
  return (IN_MEMORY_STATUSES as readonly string[]).includes(status)
}

/**
 * Classify a status array into in-memory and storage-only buckets.
 */
function classifyStatuses(statuses: readonly CommandStatus[]): {
  inMemory: CommandStatus[]
  storageOnly: CommandStatus[]
} {
  const inMemory: CommandStatus[] = []
  const storageOnly: CommandStatus[] = []
  for (const status of statuses) {
    if (isInMemoryStatus(status)) {
      inMemory.push(status)
    } else {
      storageOnly.push(status)
    }
  }
  return { inMemory, storageOnly }
}

interface TtlEntry<TLink extends Link, TCommand extends EnqueueCommand> {
  command: CommandRecord<TLink, TCommand>
  expiresAt: number
}

export interface CommandStoreConfig {
  /** TTL for terminal commands in the memory cache, in milliseconds. Default: 60000 (1 minute). */
  terminalTtlMs?: number
  /** Whether to retain terminal commands in storage. Not yet fully implemented — stored as config only. */
  retainTerminal?: boolean
}

const DEFAULT_TERMINAL_TTL_MS = 60_000

export class CommandStore<
  TLink extends Link,
  TCommand extends EnqueueCommand,
> implements ICommandStore<TLink, TCommand> {
  /** Active (non-terminal) commands. */
  private readonly active = new Map<string, CommandRecord<TLink, TCommand>>()

  /** TTL cache for terminal commands — memory management only. */
  private readonly ttlCache = new Map<string, TtlEntry<TLink, TCommand>>()

  /** Dirty command IDs that need flushing (updates). */
  private readonly dirty = new Set<string>()

  /** Command IDs that need deleting from storage. */
  private readonly pendingDeletes = new Set<string>()

  /** Resolves when initialize() completes. All read/write methods await this. */
  private ready: Promise<void>
  private resolveReady!: () => void

  /** True once initialize() has been called and resolved. */
  private initialized = false

  /** In-flight flush promise — at most one at a time. */
  private flushInFlight: Promise<void> | undefined

  /** Next sequence number to assign. */
  private nextSeq = 1

  /** Timer for periodic TTL cache sweeps. */
  private ttlSweepTimer: ReturnType<typeof setInterval> | undefined

  private readonly terminalTtlMs: number
  readonly retainTerminal: boolean

  constructor(
    private readonly storage: IStorage<TLink, TCommand>,
    config: CommandStoreConfig = {},
  ) {
    this.terminalTtlMs = config.terminalTtlMs ?? DEFAULT_TERMINAL_TTL_MS
    this.retainTerminal = config.retainTerminal ?? false

    this.ready = new Promise<void>((resolve) => {
      this.resolveReady = resolve
    })
  }

  async initialize(): Promise<void> {
    assert(!this.initialized, 'CommandStore.initialize() must only be called once')

    const commands = await this.storage.getCommandsByStatus(
      IN_MEMORY_STATUSES as unknown as CommandStatus[],
    )
    for (const command of commands) {
      this.active.set(command.commandId, command)
    }

    // Initialize sequence counter from storage
    const currentSeq = await this.storage.getCommandSequence()
    this.nextSeq = currentSeq + 1

    this.initialized = true
    this.resolveReady()

    // Start periodic TTL sweep
    this.ttlSweepTimer = setInterval(() => this.sweepTtlCache(), this.terminalTtlMs)
  }

  async get(commandId: string): Promise<CommandRecord<TLink, TCommand> | undefined> {
    await this.ready

    // Check active map first
    const inActive = this.active.get(commandId)
    if (inActive) return inActive

    // Check TTL cache
    const inTtl = this.ttlCache.get(commandId)
    if (inTtl) {
      // Refresh TTL on access
      inTtl.expiresAt = Date.now() + this.terminalTtlMs
      return inTtl.command
    }

    // Fall through to storage
    const fromStorage = await this.storage.getCommand(commandId)
    if (fromStorage && isTerminalStatus(fromStorage.status)) {
      this.addToTtlCache(fromStorage)
    }
    return fromStorage
  }

  async getByIds(
    commandIds: readonly string[],
  ): Promise<Map<string, CommandRecord<TLink, TCommand>>> {
    await this.ready
    const result = new Map<string, CommandRecord<TLink, TCommand>>()
    const needStorage: string[] = []
    const now = Date.now()

    for (const id of commandIds) {
      const inActive = this.active.get(id)
      if (inActive) {
        result.set(id, inActive)
        continue
      }
      const inTtl = this.ttlCache.get(id)
      if (inTtl) {
        // Refresh TTL on access
        inTtl.expiresAt = now + this.terminalTtlMs
        result.set(id, inTtl.command)
        continue
      }
      needStorage.push(id)
    }

    if (needStorage.length > 0) {
      const fromStorage = await this.storage.getCommandsByIds(needStorage)
      for (const [id, command] of fromStorage) {
        if (isTerminalStatus(command.status)) {
          this.addToTtlCache(command)
        }
        result.set(id, command)
      }
    }

    return result
  }

  async getByStatus(
    status: CommandStatus | CommandStatus[],
  ): Promise<CommandRecord<TLink, TCommand>[]> {
    await this.ready
    const statuses = Array.isArray(status) ? status : [status]
    const { inMemory, storageOnly } = classifyStatuses(statuses)

    const results: CommandRecord<TLink, TCommand>[] = []

    if (inMemory.length > 0) {
      const statusSet = new Set(inMemory)
      for (const command of this.active.values()) {
        if (statusSet.has(command.status)) {
          results.push(command)
        }
      }
    }

    if (storageOnly.length > 0) {
      const storageResults = await this.storage.getCommandsByStatus(storageOnly)
      for (const command of storageResults) {
        results.push(command)
      }
    }

    results.sort((a, b) => a.seq - b.seq)
    return results
  }

  async list(filter?: CommandFilter): Promise<CommandRecord<TLink, TCommand>[]> {
    await this.ready

    const filterStatuses = filter?.status
      ? Array.isArray(filter.status)
        ? filter.status
        : [filter.status]
      : undefined

    let needsStorage = false
    if (filterStatuses === undefined) {
      // No status filter — need storage for terminal commands
      needsStorage = true
    } else {
      const { storageOnly } = classifyStatuses(filterStatuses)
      needsStorage = storageOnly.length > 0
    }

    // Collect in-memory matches
    let results = this.filterActive(filter)

    // Merge storage results if needed
    if (needsStorage) {
      const storageResults = await this.storage.getCommands(filter)
      const inMemoryIds = new Set(results.map((c) => c.commandId))
      for (const command of storageResults) {
        if (!inMemoryIds.has(command.commandId)) {
          results.push(command)
        }
      }
    }

    // Sort by seq
    results.sort((a, b) => a.seq - b.seq)

    // Apply limit/offset after merge and sort
    if (filter?.offset !== undefined || filter?.limit !== undefined) {
      const offset = filter.offset ?? 0
      const limit = filter.limit ?? results.length
      results = results.slice(offset, offset + limit)
    }

    return results
  }

  async getBlockedBy(commandId: string): Promise<CommandRecord<TLink, TCommand>[]> {
    await this.ready
    const results: CommandRecord<TLink, TCommand>[] = []
    for (const command of this.active.values()) {
      if (command.blockedBy.includes(commandId)) {
        results.push(command)
      }
    }
    return results
  }

  async save(command: CommandRecord<TLink, TCommand>): Promise<void> {
    await this.ready
    command.seq = this.nextSeq++
    this.active.set(command.commandId, command)
    await this.storage.saveCommand(command)
  }

  update(commandId: string, updates: Partial<CommandRecord<TLink, TCommand>>): boolean {
    const found = this.updateInPlace(commandId, updates)
    if (found) {
      this.scheduleFlush()
    }
    return found
  }

  /**
   * Mutate a command in-place and mark dirty, but do NOT schedule a flush.
   * Used by both `update()` (schedules after) and `batchUpdate()` (schedules once at end).
   */
  private updateInPlace(
    commandId: string,
    updates: Partial<CommandRecord<TLink, TCommand>>,
  ): boolean {
    // Check active map
    const inActive = this.active.get(commandId)
    if (inActive) {
      Object.assign(inActive, updates)
      this.dirty.add(commandId)

      // If transitioning out of active statuses, move to TTL cache
      if (!isInMemoryStatus(inActive.status)) {
        this.active.delete(commandId)
        this.addToTtlCache(inActive)
      }

      return true
    }

    // Check TTL cache
    const inTtl = this.ttlCache.get(commandId)
    if (inTtl) {
      Object.assign(inTtl.command, updates)
      inTtl.expiresAt = Date.now() + this.terminalTtlMs
      this.dirty.add(commandId)
      return true
    }

    return false
  }

  batchUpdate(updates: readonly BatchUpdateEntry<TLink, TCommand>[]): number {
    let count = 0
    for (const { commandId, updates: partial } of updates) {
      if (this.updateInPlace(commandId, partial)) {
        count++
      }
    }
    if (count > 0) {
      this.scheduleFlush()
    }
    return count
  }

  delete(commandId: string): void {
    this.active.delete(commandId)
    this.ttlCache.delete(commandId)
    this.dirty.delete(commandId)
    this.pendingDeletes.add(commandId)
    this.scheduleFlush()
  }

  async deleteAll(): Promise<void> {
    await this.ready
    this.active.clear()
    this.ttlCache.clear()
    this.dirty.clear()
    this.pendingDeletes.clear()
    if (this.flushInFlight) {
      await this.flushInFlight
    }
    await this.storage.deleteAllCommands()
    this.nextSeq = 1
  }

  async flush(): Promise<void> {
    if (this.flushInFlight) {
      await this.flushInFlight
    }
    if (this.dirty.size > 0 || this.pendingDeletes.size > 0) {
      await this.doFlush()
    }
  }

  async destroy(): Promise<void> {
    if (this.ttlSweepTimer) {
      clearInterval(this.ttlSweepTimer)
      this.ttlSweepTimer = undefined
    }
    await this.flush()
  }

  // ---------------------------------------------------------------------------
  // TTL cache internals
  // ---------------------------------------------------------------------------

  private addToTtlCache(command: CommandRecord<TLink, TCommand>): void {
    this.ttlCache.set(command.commandId, {
      command,
      expiresAt: Date.now() + this.terminalTtlMs,
    })
  }

  private sweepTtlCache(): void {
    const now = Date.now()
    for (const [commandId, entry] of this.ttlCache) {
      if (entry.expiresAt <= now) {
        this.ttlCache.delete(commandId)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Flush queue internals
  // ---------------------------------------------------------------------------

  private scheduleFlush(): void {
    if (this.flushInFlight) return
    // Defer to microtask so all synchronous mutations in the current tick
    // accumulate into the dirty/delete sets before the flush snapshots them.
    this.flushInFlight = Promise.resolve()
      .then(() => this.doFlush())
      .finally(() => {
        this.flushInFlight = undefined
        if (this.dirty.size > 0 || this.pendingDeletes.size > 0) {
          this.scheduleFlush()
        }
      })
  }

  private async doFlush(): Promise<void> {
    // Snapshot and clear
    const dirtySnapshot = new Set(this.dirty)
    const deleteSnapshot = new Set(this.pendingDeletes)
    this.dirty.clear()
    this.pendingDeletes.clear()

    // Batch update dirty commands
    if (dirtySnapshot.size > 0) {
      const updates: Array<{
        commandId: string
        updates: Partial<CommandRecord<TLink, TCommand>>
      }> = []
      for (const commandId of dirtySnapshot) {
        // Command may be in active map or TTL cache
        const command = this.active.get(commandId) ?? this.ttlCache.get(commandId)?.command
        if (!command) continue
        updates.push({ commandId, updates: { ...command } })
      }
      if (updates.length > 0) {
        await this.storage.updateCommands(updates)
      }
    }

    // Process deletes
    for (const commandId of deleteSnapshot) {
      await this.storage.deleteCommand(commandId)
    }
  }

  // ---------------------------------------------------------------------------
  // In-memory filtering
  // ---------------------------------------------------------------------------

  private filterActive(filter?: CommandFilter): CommandRecord<TLink, TCommand>[] {
    let results = Array.from(this.active.values())

    if (!filter) return results

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status]
      const statusSet = new Set(statuses)
      results = results.filter((cmd) => statusSet.has(cmd.status))
    }
    if (filter.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type]
      results = results.filter((cmd) => types.includes(cmd.type))
    }
    if (filter.service) {
      results = results.filter((cmd) => cmd.service === filter.service)
    }
    if (filter.createdAfter !== undefined) {
      const after = filter.createdAfter
      results = results.filter((cmd) => cmd.createdAt > after)
    }
    if (filter.createdBefore !== undefined) {
      const before = filter.createdBefore
      results = results.filter((cmd) => cmd.createdAt < before)
    }

    return results
  }
}
