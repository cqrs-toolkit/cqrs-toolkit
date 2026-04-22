/**
 * Command store interface — owns all CommandRecord lifecycle in memory.
 */

import type { Link } from '@meticoeus/ddd-es'
import type {
  CommandFilter,
  CommandRecord,
  CommandStatus,
  EnqueueCommand,
} from '../../types/commands.js'

export interface BatchUpdateEntry<TLink extends Link, TCommand extends EnqueueCommand> {
  commandId: string
  updates: Partial<CommandRecord<TLink, TCommand>>
}

export interface ICommandStore<TLink extends Link, TCommand extends EnqueueCommand> {
  /** Load active commands from storage into memory. Called once at startup. */
  initialize(): Promise<void>

  /** Get a command by ID. Returns in-memory reference if present, falls through to storage. */
  get(commandId: string): Promise<CommandRecord<TLink, TCommand> | undefined>

  /**
   * Batch variant of {@link get}. Returns a Map keyed by commandId; absent
   * keys mean the command is nowhere (memory, TTL cache, or storage).
   * Memory-first: in-memory hits resolve without touching storage; misses
   * are fetched in a single `IStorage.getCommandsByIds` call.
   */
  getByIds(commandIds: readonly string[]): Promise<Map<string, CommandRecord<TLink, TCommand>>>

  /** Get commands matching a filter. Merges in-memory with storage results when needed. */
  list(filter?: CommandFilter): Promise<CommandRecord<TLink, TCommand>[]>

  /** Get commands by status. In-memory filter for active statuses, storage for terminal. */
  getByStatus(status: CommandStatus | CommandStatus[]): Promise<CommandRecord<TLink, TCommand>[]>

  /** Get commands blocked by a specific command. Scans in-memory map only. */
  getBlockedBy(commandId: string): Promise<CommandRecord<TLink, TCommand>[]>

  /**
   * Save a new command. Assigns seq, writes to memory AND storage immediately
   * (must be durable before enqueue returns).
   */
  save(command: CommandRecord<TLink, TCommand>): Promise<void>

  /**
   * Update a command in place. Mutates the in-memory reference, marks dirty for flush.
   * Returns true if the command was found and updated, false if not in memory.
   * SyncManager treats false as a harmless no-op. CommandQueue callers decide
   * whether false indicates a bug.
   */
  update(commandId: string, updates: Partial<CommandRecord<TLink, TCommand>>): boolean

  /**
   * Batch update commands. Mutates in-memory references, marks dirty.
   * Returns the count of commands that were found and updated.
   */
  batchUpdate(updates: readonly BatchUpdateEntry<TLink, TCommand>[]): number

  /** Delete a command. Removes from memory, schedules storage delete via flush queue. */
  delete(commandId: string): void

  /** Delete all commands. Clears memory, delegates to storage. */
  deleteAll(): Promise<void>

  /** Flush all pending changes to storage. Awaits in-flight flush if any. */
  flush(): Promise<void>

  /** Destroy — flush remaining changes and release resources. */
  destroy(): Promise<void>
}
