/**
 * Unit tests for CommandIdMappingStore.
 */

import type { ServiceLink } from '@meticoeus/ddd-es'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommandIdMappingRecord, IStorage } from '../../storage/IStorage.js'
import { InMemoryStorage } from '../../storage/InMemoryStorage.js'
import { SQLiteStorage } from '../../storage/SQLiteStorage.js'
import { clientSchema } from '../../storage/schema/client-schema.js'
import { BetterSqliteDb } from '../../testing/BetterSqliteDb.js'
import type { EnqueueCommand } from '../../types/commands.js'
import type { SchemaMigration } from '../../types/config.js'
import { CommandIdMappingStore } from './CommandIdMappingStore.js'

type TLink = ServiceLink
type TCommand = EnqueueCommand

const TTL_MS = 60_000

function makeRecord(overrides: Partial<CommandIdMappingRecord> = {}): CommandIdMappingRecord {
  return {
    clientId: 'client-1',
    serverId: 'server-1',
    createdAt: Date.now(),
    ...overrides,
  }
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

describe.each(storageFactories)('CommandIdMappingStore ($name)', ({ create }) => {
  let storage: IStorage<TLink, TCommand>
  let store: CommandIdMappingStore<TLink, TCommand>
  let teardown: () => Promise<void>

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const result = await create()
    storage = result.storage
    teardown = result.teardown
    store = new CommandIdMappingStore(storage, { ttlMs: TTL_MS, sweepIntervalMs: TTL_MS })
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
    it('loads non-expired records from storage into memory', async () => {
      const s = await create()
      const now = Date.now()
      await s.storage.saveCommandIdMappings([
        makeRecord({ clientId: 'c-a', serverId: 's-a', createdAt: now }),
        makeRecord({ clientId: 'c-b', serverId: 's-b', createdAt: now - 1000 }),
      ])

      const loaded = new CommandIdMappingStore(s.storage, { ttlMs: TTL_MS })
      await loaded.initialize()

      expect(loaded.get('c-a')?.serverId).toBe('s-a')
      expect(loaded.get('c-b')?.serverId).toBe('s-b')
      expect(loaded.size).toBe(2)

      await loaded.destroy()
      await s.teardown()
    })

    it('purges expired records from storage while loading', async () => {
      const s = await create()
      const now = Date.now()
      await s.storage.saveCommandIdMappings([
        makeRecord({ clientId: 'fresh', serverId: 's-fresh', createdAt: now }),
        makeRecord({ clientId: 'stale', serverId: 's-stale', createdAt: now - (TTL_MS + 1) }),
      ])

      const loaded = new CommandIdMappingStore(s.storage, { ttlMs: TTL_MS })
      await loaded.initialize()

      expect(loaded.get('fresh')).toBeDefined()
      expect(loaded.get('stale')).toBeUndefined()

      // Storage was also purged — reloading finds only the fresh row.
      const reloaded = new CommandIdMappingStore(s.storage, { ttlMs: TTL_MS })
      await reloaded.initialize()
      expect(reloaded.size).toBe(1)
      expect(reloaded.get('fresh')).toBeDefined()

      await loaded.destroy()
      await reloaded.destroy()
      await s.teardown()
    })

    it('asserts on double initialize', async () => {
      await expect(store.initialize()).rejects.toThrow(/must only be called once/)
    })
  })

  // ---------------------------------------------------------------------------
  // reads
  // ---------------------------------------------------------------------------

  describe('reads', () => {
    it('asserts when get() is called before initialize()', async () => {
      const s = await create()
      const uninit = new CommandIdMappingStore(s.storage, { ttlMs: TTL_MS })
      expect(() => uninit.get('any')).toThrow(/must be awaited/)
      await s.teardown()
    })

    it('get returns undefined for unknown client id', () => {
      expect(store.get('nope')).toBeUndefined()
    })

    it('get returns record after save', () => {
      const record = makeRecord()
      store.save(record)
      expect(store.get(record.clientId)).toEqual(record)
    })

    it('getByServerId returns the record', () => {
      const record = makeRecord()
      store.save(record)
      expect(store.getByServerId(record.serverId)).toEqual(record)
    })

    it('getMany returns only present records', () => {
      store.save(makeRecord({ clientId: 'c-1', serverId: 's-1' }))
      store.save(makeRecord({ clientId: 'c-2', serverId: 's-2' }))

      const result = store.getMany(['c-1', 'c-2', 'c-missing'])
      expect(result.size).toBe(2)
      expect(result.get('c-1')?.serverId).toBe('s-1')
      expect(result.get('c-2')?.serverId).toBe('s-2')
      expect(result.has('c-missing')).toBe(false)
    })

    it('getMany with empty input returns empty map', () => {
      expect(store.getMany([]).size).toBe(0)
    })
  })

  // ---------------------------------------------------------------------------
  // writes and flush
  // ---------------------------------------------------------------------------

  describe('writes', () => {
    it('save makes the record visible synchronously before flush completes', () => {
      const record = makeRecord()
      store.save(record)
      // Read happens before the microtask flush runs.
      expect(store.get(record.clientId)).toEqual(record)
    })

    it('save persists to storage after flush', async () => {
      const record = makeRecord()
      store.save(record)
      await store.flush()
      const persisted = await storage.getCommandIdMapping(record.clientId)
      expect(persisted).toEqual(record)
    })

    it('saveMany batches writes to a single storage call', async () => {
      const spy = vi.spyOn(storage, 'saveCommandIdMappings')
      store.saveMany([
        makeRecord({ clientId: 'c-1', serverId: 's-1' }),
        makeRecord({ clientId: 'c-2', serverId: 's-2' }),
        makeRecord({ clientId: 'c-3', serverId: 's-3' }),
      ])
      await store.flush()
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy.mock.calls[0]?.[0]).toHaveLength(3)
    })

    it('saveMany with empty input is a no-op', async () => {
      const spy = vi.spyOn(storage, 'saveCommandIdMappings')
      store.saveMany([])
      await store.flush()
      expect(spy).not.toHaveBeenCalled()
    })

    it('multiple synchronous saves coalesce into a single storage call', async () => {
      const spy = vi.spyOn(storage, 'saveCommandIdMappings')
      store.save(makeRecord({ clientId: 'c-1', serverId: 's-1' }))
      store.save(makeRecord({ clientId: 'c-2', serverId: 's-2' }))
      store.save(makeRecord({ clientId: 'c-3', serverId: 's-3' }))
      await store.flush()
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy.mock.calls[0]?.[0]).toHaveLength(3)
    })

    it('upsert under the same clientId keeps reverse index consistent', () => {
      store.save(makeRecord({ clientId: 'c-1', serverId: 's-1' }))
      store.save(makeRecord({ clientId: 'c-1', serverId: 's-2' }))
      expect(store.getByServerId('s-1')).toBeUndefined()
      expect(store.getByServerId('s-2')?.clientId).toBe('c-1')
      expect(store.size).toBe(1)
    })
  })

  // ---------------------------------------------------------------------------
  // deleteAll
  // ---------------------------------------------------------------------------

  describe('deleteAll', () => {
    it('clears memory and storage', async () => {
      store.save(makeRecord({ clientId: 'c-1', serverId: 's-1' }))
      store.save(makeRecord({ clientId: 'c-2', serverId: 's-2' }))
      await store.flush()

      await store.deleteAll()

      expect(store.size).toBe(0)
      expect(store.get('c-1')).toBeUndefined()
      expect(store.getByServerId('s-1')).toBeUndefined()
      expect(await storage.getCommandIdMapping('c-1')).toBeUndefined()
    })

    it('awaits any in-flight flush before clearing storage', async () => {
      store.save(makeRecord({ clientId: 'c-1', serverId: 's-1' }))
      // Do not await flush — let deleteAll coordinate with it.
      await store.deleteAll()
      expect(await storage.getCommandIdMapping('c-1')).toBeUndefined()
    })
  })

  // ---------------------------------------------------------------------------
  // sweep / TTL eviction
  // ---------------------------------------------------------------------------

  describe('sweep', () => {
    it('evicts expired records from memory and storage on the interval', async () => {
      const now = Date.now()
      vi.setSystemTime(now)

      store.save(makeRecord({ clientId: 'fresh', serverId: 's-fresh', createdAt: now }))
      store.save(
        makeRecord({ clientId: 'stale', serverId: 's-stale', createdAt: now - (TTL_MS + 1) }),
      )
      await store.flush()

      // Advance past the sweep interval to trigger the sweep.
      await vi.advanceTimersByTimeAsync(TTL_MS + 1)
      // Allow the async sweep body to resolve.
      await vi.runOnlyPendingTimersAsync()
      await Promise.resolve()
      await Promise.resolve()

      expect(store.get('fresh')).toBeDefined()
      expect(store.get('stale')).toBeUndefined()
      expect(store.getByServerId('s-stale')).toBeUndefined()
      expect(await storage.getCommandIdMapping('stale')).toBeUndefined()
      expect(await storage.getCommandIdMapping('fresh')).toBeDefined()
    })
  })

  // ---------------------------------------------------------------------------
  // destroy
  // ---------------------------------------------------------------------------

  describe('destroy', () => {
    it('flushes pending writes before returning', async () => {
      const localStore = new CommandIdMappingStore(storage, {
        ttlMs: TTL_MS,
        sweepIntervalMs: TTL_MS,
      })
      await localStore.initialize()

      const record = makeRecord({ clientId: 'unflushed', serverId: 'unflushed-s' })
      localStore.save(record)
      // Do not call flush — destroy must do it.
      await localStore.destroy()

      expect(await storage.getCommandIdMapping('unflushed')).toEqual(record)
    })
  })
})
