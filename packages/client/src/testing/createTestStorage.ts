/**
 * Test storage factory.
 * Creates pre-configured storage instances for testing.
 */

import { InMemoryStorage } from '../storage/InMemoryStorage.js'
import type {
  CacheKeyRecord,
  CachedEventRecord,
  IStorage,
  ReadModelRecord,
  SessionRecord,
} from '../storage/IStorage.js'
import type { CommandRecord } from '../types/commands.js'

/**
 * Options for creating test storage.
 */
export interface CreateTestStorageOptions {
  /** Pre-populate with a session */
  session?: SessionRecord
  /** Pre-populate with cache keys */
  cacheKeys?: CacheKeyRecord[]
  /** Pre-populate with commands */
  commands?: CommandRecord[]
  /** Pre-populate with cached events */
  cachedEvents?: CachedEventRecord[]
  /** Pre-populate with read models */
  readModels?: ReadModelRecord[]
}

/**
 * Create a test storage instance with optional pre-populated data.
 *
 * @param options - Data to pre-populate
 * @returns Initialized storage instance
 */
export async function createTestStorage(options: CreateTestStorageOptions = {}): Promise<IStorage> {
  const storage = new InMemoryStorage()
  await storage.initialize()

  // Pre-populate data
  if (options.session) {
    await storage.saveSession(options.session)
  }

  if (options.cacheKeys) {
    for (const cacheKey of options.cacheKeys) {
      await storage.saveCacheKey(cacheKey)
    }
  }

  if (options.commands) {
    for (const command of options.commands) {
      await storage.saveCommand(command)
    }
  }

  if (options.cachedEvents) {
    await storage.saveCachedEvents(options.cachedEvents)
  }

  if (options.readModels) {
    await storage.saveReadModels(options.readModels)
  }

  return storage
}
