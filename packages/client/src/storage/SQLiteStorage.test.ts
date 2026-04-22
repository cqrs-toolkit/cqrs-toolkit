/**
 * SQLite-backed tests for SQLiteStorage, using better-sqlite3 via BetterSqliteDb.
 */

import type { ServiceLink } from '@meticoeus/ddd-es'
import { describe, expect, it } from 'vitest'
import { deriveScopeKey } from '../core/cache-manager/CacheKey.js'
import { BetterSqliteDb } from '../testing/BetterSqliteDb.js'
import { CommandRecord, EnqueueCommand } from '../types/commands.js'
import type { SchemaMigration } from '../types/config.js'
import { clientSchema } from './schema/client-schema.js'
import { SQLiteStorage } from './SQLiteStorage.js'

const TEST_CACHE_KEY = deriveScopeKey({ scopeType: 'test' })

const MIGRATIONS: [SchemaMigration, ...SchemaMigration[]] = [
  {
    version: 1,
    message: 'test schema',
    steps: [clientSchema.init],
  },
]

describe('SQLiteStorage', () => {
  async function bootstrap() {
    const db = new BetterSqliteDb()
    const storage = new SQLiteStorage<ServiceLink, EnqueueCommand>({ db, migrations: MIGRATIONS })
    await storage.initialize()
    return { storage, db }
  }

  function makeCommand(commandId: string): CommandRecord<ServiceLink, EnqueueCommand> {
    return {
      commandId,
      cacheKey: TEST_CACHE_KEY,
      service: 'test-service',
      type: 'TestCommand',
      data: { foo: commandId },
      status: 'pending',
      dependsOn: [],
      blockedBy: [],
      attempts: 0,
      seq: 0,
      createdAt: 1000,
      updatedAt: 1000,
    }
  }

  describe('getCommandSequence', () => {
    it('returns 0 when no commands have been inserted', async () => {
      const { storage } = await bootstrap()
      expect(await storage.getCommandSequence()).toBe(0)
    })

    it('returns the latest autoincrement value after seeding commands', async () => {
      const { storage } = await bootstrap()

      await storage.saveCommand(makeCommand('cmd-a'))
      await storage.saveCommand(makeCommand('cmd-b'))
      await storage.saveCommand(makeCommand('cmd-c'))

      expect(await storage.getCommandSequence()).toBe(3)
    })

    it('does not regress after deleting the tail command', async () => {
      const { storage } = await bootstrap()

      await storage.saveCommand(makeCommand('cmd-a'))
      await storage.saveCommand(makeCommand('cmd-b'))
      await storage.saveCommand(makeCommand('cmd-c'))
      await storage.deleteCommand('cmd-c')

      // The next seq must be strictly greater than any seq ever assigned — so
      // getCommandSequence() must still reflect the highest previously-issued
      // value (3) even after the tail row has been removed. Otherwise the
      // in-memory CommandStore would hand out a seq that collides with one
      // SQLite may later auto-assign when new rows arrive.
      expect(await storage.getCommandSequence()).toBe(3)
    })
  })
})
