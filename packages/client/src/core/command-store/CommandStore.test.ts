/**
 * Unit tests for CommandStore.
 */

import type { ServiceLink } from '@meticoeus/ddd-es'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IStorage } from '../../storage/IStorage.js'
import { InMemoryStorage } from '../../storage/InMemoryStorage.js'
import { SQLiteStorage } from '../../storage/SQLiteStorage.js'
import { clientSchema } from '../../storage/schema/client-schema.js'
import { BetterSqliteDb } from '../../testing/BetterSqliteDb.js'
import { createTestCommand as createTestCommandUntyped } from '../../testing/fixtures/command.js'
import type { CommandRecord, EnqueueCommand } from '../../types/commands.js'
import type { SchemaMigration } from '../../types/config.js'
import { CommandStore } from './CommandStore.js'

type TLink = ServiceLink
type TCommand = EnqueueCommand

function createTestCommand(
  overrides: Partial<CommandRecord<TLink, TCommand>> = {},
): CommandRecord<TLink, TCommand> {
  return createTestCommandUntyped<TLink, TCommand>(overrides)
}

interface StorageFactory {
  name: string
  create: () => Promise<{ storage: IStorage<TLink, TCommand>; teardown: () => Promise<void> }>
}

const inMemoryFactory: StorageFactory = {
  name: 'InMemoryStorage',
  create: async () => {
    const storage = new InMemoryStorage<TLink, TCommand>()
    await storage.initialize()
    return { storage, teardown: async () => storage.close() }
  },
}

const sqliteFactory: StorageFactory = {
  name: 'SQLiteStorage',
  create: async () => {
    const migrations: [SchemaMigration, ...SchemaMigration[]] = [
      { version: 1, message: 'test schema', steps: [clientSchema.init] },
    ]
    const db = new BetterSqliteDb()
    const storage = new SQLiteStorage<TLink, TCommand>({ db, migrations })
    await storage.initialize()
    return {
      storage,
      teardown: async () => {
        await storage.close()
        await db.close()
      },
    }
  },
}

const storageFactories: StorageFactory[] = [inMemoryFactory, sqliteFactory]

describe.each(storageFactories)('CommandStore ($name)', ({ create }) => {
  let storage: IStorage<TLink, TCommand>
  let store: CommandStore<TLink, TCommand>
  let teardown: () => Promise<void>

  beforeEach(async () => {
    vi.useFakeTimers()
    const result = await create()
    storage = result.storage
    teardown = result.teardown
    store = new CommandStore(storage, { terminalTtlMs: 5000 })
    await store.initialize()
  })

  afterEach(async () => {
    await store.destroy()
    await teardown()
    vi.useRealTimers()
  })

  // ---------------------------------------------------------------------------
  // initialize
  // ---------------------------------------------------------------------------

  describe('initialize', () => {
    it('loads active commands from storage into memory', async () => {
      const s = await create()
      const pending = createTestCommand({ commandId: 'cmd-1', status: 'pending', seq: 1 })
      const blocked = createTestCommand({ commandId: 'cmd-2', status: 'blocked', seq: 2 })
      const sending = createTestCommand({ commandId: 'cmd-3', status: 'sending', seq: 3 })
      const succeeded = createTestCommand({ commandId: 'cmd-4', status: 'succeeded', seq: 4 })
      const failed = createTestCommand({ commandId: 'cmd-5', status: 'failed', seq: 5 })
      const applied = createTestCommand({ commandId: 'cmd-6', status: 'applied', seq: 6 })

      for (const cmd of [pending, blocked, sending, succeeded, failed, applied]) {
        await s.storage.saveCommand(cmd)
      }

      const cs = new CommandStore(s.storage, { terminalTtlMs: 5000 })
      await cs.initialize()

      // Active statuses loaded in memory — no storage hit
      expect(await cs.get('cmd-1')).toBeDefined()
      expect(await cs.get('cmd-2')).toBeDefined()
      expect(await cs.get('cmd-3')).toBeDefined()
      expect(await cs.get('cmd-4')).toBeDefined()

      // Terminal statuses require storage fallback
      expect(await cs.get('cmd-5')).toBeDefined()
      expect(await cs.get('cmd-6')).toBeDefined()

      await cs.destroy()
      await s.teardown()
    })

    it('throws if called twice', async () => {
      const s = await create()
      const cs = new CommandStore(s.storage)
      await cs.initialize()
      await expect(cs.initialize()).rejects.toThrow()
      await cs.destroy()
      await s.teardown()
    })
  })

  // ---------------------------------------------------------------------------
  // initialization gate
  // ---------------------------------------------------------------------------

  describe('initialization gate', () => {
    it('delays reads until initialize resolves', async () => {
      const s = await create()
      const cs = new CommandStore(s.storage)

      // Start a get before initialize — it should hang until initialize completes
      let resolved = false
      const getPromise = cs.get('nonexistent').then((r) => {
        resolved = true
        return r
      })

      // Ensure the promise hasn't resolved yet
      await vi.advanceTimersByTimeAsync(0)
      expect(resolved).toBe(false)

      // Now initialize
      await cs.initialize()
      const result = await getPromise
      expect(resolved).toBe(true)
      expect(result).toBeUndefined()

      await cs.destroy()
      await s.teardown()
    })
  })

  // ---------------------------------------------------------------------------
  // save
  // ---------------------------------------------------------------------------

  describe('save', () => {
    it('assigns seq and writes to both memory and storage', async () => {
      const cmd = createTestCommand({ commandId: 'cmd-1' })
      await store.save(cmd)

      expect(cmd.seq).toBe(1)

      // In memory
      const fromStore = await store.get('cmd-1')
      expect(fromStore).toBe(cmd) // Same reference

      // In storage
      const fromStorage = await storage.getCommand('cmd-1')
      expect(fromStorage).toBeDefined()
      expect(fromStorage!.commandId).toBe('cmd-1')
    })

    it('assigns monotonically increasing seq numbers', async () => {
      const cmd1 = createTestCommand({ commandId: 'cmd-1' })
      const cmd2 = createTestCommand({ commandId: 'cmd-2' })
      const cmd3 = createTestCommand({ commandId: 'cmd-3' })

      await store.save(cmd1)
      await store.save(cmd2)
      await store.save(cmd3)

      expect(cmd1.seq).toBe(1)
      expect(cmd2.seq).toBe(2)
      expect(cmd3.seq).toBe(3)
    })

    it('initializes seq from storage on startup', async () => {
      // Save some commands to bump the seq
      await store.save(createTestCommand({ commandId: 'cmd-1' }))
      await store.save(createTestCommand({ commandId: 'cmd-2' }))
      await store.save(createTestCommand({ commandId: 'cmd-3' }))

      // Create a new CommandStore against the same storage
      const store2 = new CommandStore(storage)
      await store2.initialize()

      const cmd4 = createTestCommand({ commandId: 'cmd-4' })
      await store2.save(cmd4)

      // Should continue from where the previous store left off
      expect(cmd4.seq).toBeGreaterThan(3)

      await store2.destroy()
    })
  })

  // ---------------------------------------------------------------------------
  // get
  // ---------------------------------------------------------------------------

  describe('get', () => {
    it('returns command from active map', async () => {
      const cmd = createTestCommand({ commandId: 'cmd-1' })
      await store.save(cmd)

      const result = await store.get('cmd-1')
      expect(result).toBe(cmd) // Same reference
    })

    it('returns undefined for nonexistent command', async () => {
      expect(await store.get('nonexistent')).toBeUndefined()
    })

    it('falls through to storage for terminal commands', async () => {
      const failed = createTestCommand({ commandId: 'cmd-failed', status: 'failed', seq: 1 })
      await storage.saveCommand(failed)

      const result = await store.get('cmd-failed')
      expect(result).toBeDefined()
      expect(result!.commandId).toBe('cmd-failed')
    })

    it('caches terminal commands in TTL cache on load from storage', async () => {
      const failed = createTestCommand({ commandId: 'cmd-failed', status: 'failed', seq: 1 })
      await storage.saveCommand(failed)

      // First load — from storage
      const first = await store.get('cmd-failed')
      expect(first).toBeDefined()

      // Second load — should be from TTL cache (same reference)
      const second = await store.get('cmd-failed')
      expect(second).toBe(first)
    })

    it('returns command from TTL cache after terminal transition', async () => {
      const cmd = createTestCommand({ commandId: 'cmd-1' })
      await store.save(cmd)

      // Transition to terminal
      store.update('cmd-1', { status: 'failed' })

      // Should be in TTL cache now
      const result = await store.get('cmd-1')
      expect(result).toBe(cmd) // Same reference
      expect(result!.status).toBe('failed')
    })
  })

  // ---------------------------------------------------------------------------
  // getByStatus
  // ---------------------------------------------------------------------------

  describe('getByStatus', () => {
    it('returns in-memory commands for active statuses without storage call', async () => {
      await store.save(createTestCommand({ commandId: 'cmd-1', status: 'pending' }))
      await store.save(createTestCommand({ commandId: 'cmd-2', status: 'blocked' }))
      await store.save(createTestCommand({ commandId: 'cmd-3', status: 'sending' }))

      const spy = vi.spyOn(storage, 'getCommandsByStatus')
      const results = await store.getByStatus('pending')

      expect(results).toHaveLength(1)
      expect(results[0]!.commandId).toBe('cmd-1')
      expect(spy).not.toHaveBeenCalled()
    })

    it('queries storage for terminal statuses', async () => {
      const failed = createTestCommand({ commandId: 'cmd-failed', status: 'failed', seq: 1 })
      await storage.saveCommand(failed)

      const results = await store.getByStatus('failed')
      expect(results).toHaveLength(1)
      expect(results[0]!.commandId).toBe('cmd-failed')
    })

    it('merges in-memory and storage for mixed statuses', async () => {
      await store.save(createTestCommand({ commandId: 'cmd-pending' }))
      const failed = createTestCommand({ commandId: 'cmd-failed', status: 'failed', seq: 10 })
      await storage.saveCommand(failed)

      const results = await store.getByStatus(['pending', 'failed'])
      expect(results).toHaveLength(2)
    })

    it('returns results sorted by seq', async () => {
      await store.save(createTestCommand({ commandId: 'cmd-3' }))
      await store.save(createTestCommand({ commandId: 'cmd-1' }))
      await store.save(createTestCommand({ commandId: 'cmd-2' }))

      const results = await store.getByStatus('pending')
      expect(results.map((c) => c.commandId)).toEqual(['cmd-3', 'cmd-1', 'cmd-2'])
      expect(results[0]!.seq).toBeLessThan(results[1]!.seq)
      expect(results[1]!.seq).toBeLessThan(results[2]!.seq)
    })

    it('does not hit storage for all-active status query', async () => {
      await store.save(createTestCommand({ commandId: 'cmd-1', status: 'pending' }))
      await store.save(createTestCommand({ commandId: 'cmd-2', status: 'succeeded' }))

      const spy = vi.spyOn(storage, 'getCommandsByStatus')
      await store.getByStatus(['pending', 'blocked', 'sending', 'succeeded'])
      expect(spy).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------

  describe('list', () => {
    it('returns all commands sorted by seq', async () => {
      await store.save(createTestCommand({ commandId: 'cmd-2' }))
      await store.save(createTestCommand({ commandId: 'cmd-1' }))

      const results = await store.list()
      expect(results).toHaveLength(2)
      expect(results[0]!.seq).toBeLessThan(results[1]!.seq)
    })

    it('filters by status', async () => {
      await store.save(createTestCommand({ commandId: 'cmd-1', status: 'pending' }))
      await store.save(createTestCommand({ commandId: 'cmd-2', status: 'sending' }))

      const results = await store.list({ status: 'pending' })
      expect(results).toHaveLength(1)
      expect(results[0]!.commandId).toBe('cmd-1')
    })

    it('does not hit storage when filtering by active-only statuses', async () => {
      await store.save(createTestCommand({ commandId: 'cmd-1', status: 'pending' }))

      const spy = vi.spyOn(storage, 'getCommands')
      await store.list({ status: 'pending' })
      expect(spy).not.toHaveBeenCalled()
    })

    it('applies limit and offset after merge and sort', async () => {
      await store.save(createTestCommand({ commandId: 'cmd-1' }))
      await store.save(createTestCommand({ commandId: 'cmd-2' }))
      await store.save(createTestCommand({ commandId: 'cmd-3' }))

      const results = await store.list({ limit: 2, offset: 1 })
      expect(results).toHaveLength(2)
      expect(results[0]!.commandId).toBe('cmd-2')
      expect(results[1]!.commandId).toBe('cmd-3')
    })
  })

  // ---------------------------------------------------------------------------
  // getBlockedBy
  // ---------------------------------------------------------------------------

  describe('getBlockedBy', () => {
    it('returns commands blocked by the given command', async () => {
      await store.save(createTestCommand({ commandId: 'cmd-1' }))
      await store.save(
        createTestCommand({ commandId: 'cmd-2', status: 'blocked', blockedBy: ['cmd-1'] }),
      )
      await store.save(
        createTestCommand({ commandId: 'cmd-3', status: 'blocked', blockedBy: ['cmd-1'] }),
      )
      await store.save(createTestCommand({ commandId: 'cmd-4' }))

      const results = await store.getBlockedBy('cmd-1')
      expect(results).toHaveLength(2)
      expect(results.map((c) => c.commandId).sort()).toEqual(['cmd-2', 'cmd-3'])
    })

    it('returns empty for no blocked commands', async () => {
      await store.save(createTestCommand({ commandId: 'cmd-1' }))
      expect(await store.getBlockedBy('cmd-1')).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe('update', () => {
    it('mutates the in-memory reference and returns true', async () => {
      const cmd = createTestCommand({ commandId: 'cmd-1' })
      await store.save(cmd)

      const result = store.update('cmd-1', { status: 'sending', attempts: 1 })
      expect(result).toBe(true)

      // Same reference is mutated
      expect(cmd.status).toBe('sending')
      expect(cmd.attempts).toBe(1)
    })

    it('returns false for nonexistent command', () => {
      expect(store.update('nonexistent', { status: 'sending' })).toBe(false)
    })

    it('moves command to TTL cache on terminal transition', async () => {
      const cmd = createTestCommand({ commandId: 'cmd-1' })
      await store.save(cmd)

      store.update('cmd-1', { status: 'failed' })

      // No longer in active statuses
      const activeResults = await store.getByStatus('pending')
      expect(activeResults).toHaveLength(0)

      // Still accessible via get (from TTL cache)
      const fromGet = await store.get('cmd-1')
      expect(fromGet).toBe(cmd)
      expect(fromGet!.status).toBe('failed')
    })

    it('can update commands in TTL cache and returns true', async () => {
      const cmd = createTestCommand({ commandId: 'cmd-1' })
      await store.save(cmd)

      // Move to TTL cache
      store.update('cmd-1', { status: 'failed' })

      // Update in TTL cache
      const result = store.update('cmd-1', { attempts: 5 })
      expect(result).toBe(true)
      expect(cmd.attempts).toBe(5)
    })

    it('flushes updates to storage', async () => {
      const cmd = createTestCommand({ commandId: 'cmd-1' })
      await store.save(cmd)

      store.update('cmd-1', { status: 'sending', attempts: 1 })
      await store.flush()

      const fromStorage = await storage.getCommand('cmd-1')
      expect(fromStorage!.status).toBe('sending')
      expect(fromStorage!.attempts).toBe(1)
    })
  })

  // ---------------------------------------------------------------------------
  // batchUpdate
  // ---------------------------------------------------------------------------

  describe('batchUpdate', () => {
    it('updates multiple commands and returns count', async () => {
      await store.save(createTestCommand({ commandId: 'cmd-1' }))
      await store.save(createTestCommand({ commandId: 'cmd-2' }))

      const count = store.batchUpdate([
        { commandId: 'cmd-1', updates: { status: 'sending' } },
        { commandId: 'cmd-2', updates: { status: 'sending' } },
        { commandId: 'cmd-nonexistent', updates: { status: 'sending' } },
      ])

      expect(count).toBe(2)
    })

    it('flushes all updates in one batch', async () => {
      await store.save(createTestCommand({ commandId: 'cmd-1' }))
      await store.save(createTestCommand({ commandId: 'cmd-2' }))

      const spy = vi.spyOn(storage, 'updateCommands')

      store.batchUpdate([
        { commandId: 'cmd-1', updates: { status: 'sending' } },
        { commandId: 'cmd-2', updates: { attempts: 3 } },
      ])

      await store.flush()
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    it('removes from memory immediately', async () => {
      await store.save(createTestCommand({ commandId: 'cmd-1' }))
      store.delete('cmd-1')

      // Not in active commands
      const active = await store.getByStatus('pending')
      expect(active).toHaveLength(0)
    })

    it('deletes from storage on flush', async () => {
      await store.save(createTestCommand({ commandId: 'cmd-1' }))
      store.delete('cmd-1')
      await store.flush()

      const fromStorage = await storage.getCommand('cmd-1')
      expect(fromStorage).toBeUndefined()
    })

    it('removes from TTL cache', async () => {
      const cmd = createTestCommand({ commandId: 'cmd-1' })
      await store.save(cmd)
      store.update('cmd-1', { status: 'failed' }) // Move to TTL cache
      store.delete('cmd-1')

      // Not in TTL cache
      // After flush completes, storage is also cleaned
      await store.flush()
      expect(await storage.getCommand('cmd-1')).toBeUndefined()
    })
  })

  // ---------------------------------------------------------------------------
  // deleteAll
  // ---------------------------------------------------------------------------

  describe('deleteAll', () => {
    it('clears memory and storage', async () => {
      await store.save(createTestCommand({ commandId: 'cmd-1' }))
      await store.save(createTestCommand({ commandId: 'cmd-2' }))

      await store.deleteAll()

      expect(await store.getByStatus('pending')).toHaveLength(0)
      expect(await storage.getCommand('cmd-1')).toBeUndefined()
      expect(await storage.getCommand('cmd-2')).toBeUndefined()
    })

    it('resets seq counter', async () => {
      await store.save(createTestCommand({ commandId: 'cmd-1' }))
      await store.save(createTestCommand({ commandId: 'cmd-2' }))
      await store.deleteAll()

      const cmd = createTestCommand({ commandId: 'cmd-new' })
      await store.save(cmd)
      expect(cmd.seq).toBe(1)
    })
  })

  // ---------------------------------------------------------------------------
  // flush coalescing
  // ---------------------------------------------------------------------------

  describe('flush coalescing', () => {
    it('batches concurrent dirty marks into a single storage call', async () => {
      await store.save(createTestCommand({ commandId: 'cmd-1' }))
      await store.save(createTestCommand({ commandId: 'cmd-2' }))
      await store.save(createTestCommand({ commandId: 'cmd-3' }))

      const spy = vi.spyOn(storage, 'updateCommands')

      // Multiple synchronous updates — all dirty before flush runs
      store.update('cmd-1', { attempts: 1 })
      store.update('cmd-2', { attempts: 2 })
      store.update('cmd-3', { attempts: 3 })

      await store.flush()

      // All three should be in a single updateCommands call
      expect(spy).toHaveBeenCalledTimes(1)
      const updates = spy.mock.calls[0]![0]
      expect(updates).toHaveLength(3)
    })

    it('does not lose updates made during an in-flight flush', async () => {
      await store.save(createTestCommand({ commandId: 'cmd-1' }))
      await store.save(createTestCommand({ commandId: 'cmd-2' }))

      // First update triggers flush
      store.update('cmd-1', { attempts: 1 })

      // Wait for the flush to start but add another update during it
      store.update('cmd-2', { attempts: 2 })

      // Flush everything
      await store.flush()

      // Both should be persisted
      const cmd1 = await storage.getCommand('cmd-1')
      const cmd2 = await storage.getCommand('cmd-2')
      expect(cmd1!.attempts).toBe(1)
      expect(cmd2!.attempts).toBe(2)
    })
  })

  // ---------------------------------------------------------------------------
  // TTL cache
  // ---------------------------------------------------------------------------

  describe('TTL cache', () => {
    it('evicts terminal commands after TTL expires', async () => {
      const cmd = createTestCommand({ commandId: 'cmd-1' })
      await store.save(cmd)
      store.update('cmd-1', { status: 'failed' })

      // Command is in TTL cache
      expect(await store.get('cmd-1')).toBe(cmd)

      // Advance past TTL
      vi.advanceTimersByTime(6000)

      // TTL cache swept — command no longer in memory
      // But still loadable from storage (fallback)
      await store.flush() // Ensure update is persisted first
      const reloaded = await store.get('cmd-1')
      expect(reloaded).toBeDefined()
      expect(reloaded).not.toBe(cmd) // Different reference — reloaded from storage
    })

    it('refreshes TTL on access', async () => {
      const failed = createTestCommand({ commandId: 'cmd-1', status: 'failed', seq: 1 })
      await storage.saveCommand(failed)

      // Load into TTL cache
      const first = await store.get('cmd-1')
      expect(first).toBeDefined()

      // Advance close to expiry
      vi.advanceTimersByTime(4000)

      // Access again — refreshes TTL
      const second = await store.get('cmd-1')
      expect(second).toBe(first) // Same reference

      // Advance another 4s — would have expired without refresh, but shouldn't now
      vi.advanceTimersByTime(4000)

      // Should still be the same reference (TTL was refreshed)
      const third = await store.get('cmd-1')
      expect(third).toBe(first)
    })

    it('re-caches evicted commands on reload from storage', async () => {
      const cmd = createTestCommand({ commandId: 'cmd-1' })
      await store.save(cmd)
      store.update('cmd-1', { status: 'applied' })
      await store.flush()

      // Evict from TTL
      vi.advanceTimersByTime(6000)

      // Reload — goes back into TTL cache
      const first = await store.get('cmd-1')
      expect(first).toBeDefined()

      // Second access — from TTL cache
      const second = await store.get('cmd-1')
      expect(second).toBe(first)
    })
  })

  // ---------------------------------------------------------------------------
  // storage consultation rules
  // ---------------------------------------------------------------------------

  describe('storage consultation rules', () => {
    it('getByStatus with only active statuses does not call storage', async () => {
      await store.save(createTestCommand({ commandId: 'cmd-1', status: 'pending' }))

      const spy = vi.spyOn(storage, 'getCommandsByStatus')
      await store.getByStatus(['pending', 'blocked', 'sending', 'succeeded'])
      expect(spy).not.toHaveBeenCalled()
    })

    it('getByStatus with terminal statuses calls storage', async () => {
      const spy = vi.spyOn(storage, 'getCommandsByStatus')
      await store.getByStatus(['pending', 'failed'])
      expect(spy).toHaveBeenCalledWith(['failed'])
    })

    it('list with active-only status filter does not call storage', async () => {
      const spy = vi.spyOn(storage, 'getCommands')
      await store.list({ status: 'pending' })
      expect(spy).not.toHaveBeenCalled()
    })

    it('list without status filter calls storage', async () => {
      const spy = vi.spyOn(storage, 'getCommands')
      await store.list()
      expect(spy).toHaveBeenCalled()
    })

    it('getBlockedBy never calls storage', async () => {
      await store.save(
        createTestCommand({ commandId: 'cmd-1', status: 'blocked', blockedBy: ['dep'] }),
      )

      const cmdSpy = vi.spyOn(storage, 'getCommandsBlockedBy')
      const statusSpy = vi.spyOn(storage, 'getCommandsByStatus')
      await store.getBlockedBy('dep')
      expect(cmdSpy).not.toHaveBeenCalled()
      expect(statusSpy).not.toHaveBeenCalled()
    })
  })
})
