/**
 * Unit tests for InMemoryStorage.
 */

import type { ServiceLink } from '@meticoeus/ddd-es'
import { describe, expect, it } from 'vitest'
import { deriveScopeKey } from '../core/cache-manager/CacheKey.js'
import { createTestCacheKey } from '../testing/factories/cacheKey.js'
import { CommandRecord, EnqueueCommand } from '../types/commands.js'
import { InMemoryStorage } from './InMemoryStorage.js'
import type { CachedEventRecord, ReadModelRecord, SessionRecord } from './IStorage.js'

describe('InMemoryStorage', () => {
  async function bootstrap() {
    const storage = new InMemoryStorage<ServiceLink, EnqueueCommand>()
    await storage.initialize()
    return { storage }
  }

  describe('lifecycle', () => {
    it('initializes successfully', async () => {
      const storage = new InMemoryStorage()
      await expect(storage.initialize()).resolves.toBeUndefined()
    })

    it('clears all data', async () => {
      const { storage } = await bootstrap()
      const session: SessionRecord = { id: 1, userId: 'user-1', createdAt: 1000, lastSeenAt: 1000 }
      await storage.saveSession(session)

      await storage.clear()

      expect(await storage.getSession()).toBeUndefined()
    })
  })

  describe('session operations', () => {
    it('saves and retrieves session', async () => {
      const { storage } = await bootstrap()
      const session: SessionRecord = { id: 1, userId: 'user-1', createdAt: 1000, lastSeenAt: 1000 }
      await storage.saveSession(session)

      const retrieved = await storage.getSession()
      expect(retrieved).toEqual(session)
    })

    it('returns undefined when no session exists', async () => {
      const { storage } = await bootstrap()
      expect(await storage.getSession()).toBeUndefined()
    })

    it('deletes session and all associated data', async () => {
      const { storage } = await bootstrap()
      const session: SessionRecord = { id: 1, userId: 'user-1', createdAt: 1000, lastSeenAt: 1000 }
      await storage.saveSession(session)

      const cacheKey = createTestCacheKey({ key: 'cache-1' })
      await storage.saveCacheKey(cacheKey)

      await storage.deleteSession()

      expect(await storage.getSession()).toBeUndefined()
      expect(await storage.getAllCacheKeys()).toHaveLength(0)
    })

    it('updates lastSeenAt on touch', async () => {
      const { storage } = await bootstrap()
      const session: SessionRecord = { id: 1, userId: 'user-1', createdAt: 1000, lastSeenAt: 1000 }
      await storage.saveSession(session)

      // Wait a tiny bit to ensure different timestamp
      await new Promise((r) => setTimeout(r, 10))
      await storage.touchSession()

      const retrieved = await storage.getSession()
      expect(retrieved?.lastSeenAt).toBeGreaterThan(1000)
    })
  })

  describe('cache key operations', () => {
    const baseCacheKey = createTestCacheKey({ key: 'cache-1' })

    it('saves and retrieves cache key', async () => {
      const { storage } = await bootstrap()
      await storage.saveCacheKey(baseCacheKey)

      const retrieved = await storage.getCacheKey('cache-1')
      expect(retrieved).toEqual(baseCacheKey)
    })

    it('returns undefined for non-existent cache key', async () => {
      const { storage } = await bootstrap()
      expect(await storage.getCacheKey('non-existent')).toBeUndefined()
    })

    it('lists all cache keys', async () => {
      const { storage } = await bootstrap()
      await storage.saveCacheKey(baseCacheKey)
      await storage.saveCacheKey({ ...baseCacheKey, key: 'cache-2' })

      const all = await storage.getAllCacheKeys()
      expect(all).toHaveLength(2)
    })

    it('increments hold count', async () => {
      const { storage } = await bootstrap()
      await storage.saveCacheKey(baseCacheKey)
      await storage.holdCacheKey('cache-1')

      const retrieved = await storage.getCacheKey('cache-1')
      expect(retrieved?.holdCount).toBe(1)
    })

    it('decrements hold count', async () => {
      const { storage } = await bootstrap()
      await storage.saveCacheKey({ ...baseCacheKey, holdCount: 2 })
      await storage.releaseCacheKey('cache-1')

      const retrieved = await storage.getCacheKey('cache-1')
      expect(retrieved?.holdCount).toBe(1)
    })

    it('does not decrement hold count below 0', async () => {
      const { storage } = await bootstrap()
      await storage.saveCacheKey(baseCacheKey)
      await storage.releaseCacheKey('cache-1')

      const retrieved = await storage.getCacheKey('cache-1')
      expect(retrieved?.holdCount).toBe(0)
    })

    it('touches cache key', async () => {
      const { storage } = await bootstrap()
      await storage.saveCacheKey(baseCacheKey)
      await new Promise((r) => setTimeout(r, 10))
      await storage.touchCacheKey('cache-1')

      const retrieved = await storage.getCacheKey('cache-1')
      expect(retrieved?.lastAccessedAt).toBeGreaterThan(1000)
    })

    it('deletes cache key and associated data', async () => {
      const { storage } = await bootstrap()
      await storage.saveCacheKey(baseCacheKey)

      const event: CachedEventRecord = {
        id: 'event-1',
        type: 'TestEvent',
        streamId: 'stream-1',
        persistence: 'Permanent',
        data: '{}',
        position: null,
        revision: null,
        commandId: null,
        cacheKeys: ['cache-1'],
        createdAt: 1000,
        processedAt: null,
      }
      await storage.saveCachedEvent(event)

      await storage.deleteCacheKey('cache-1')

      expect(await storage.getCacheKey('cache-1')).toBeUndefined()
      expect(await storage.getCachedEventsByCacheKey('cache-1')).toHaveLength(0)
    })

    it('gets evictable cache keys in LRU order', async () => {
      const { storage } = await bootstrap()
      await storage.saveCacheKey({ ...baseCacheKey, key: 'cache-1', lastAccessedAt: 3000 })
      await storage.saveCacheKey({ ...baseCacheKey, key: 'cache-2', lastAccessedAt: 1000 })
      await storage.saveCacheKey({ ...baseCacheKey, key: 'cache-3', lastAccessedAt: 2000 })

      const evictable = await storage.getEvictableCacheKeys(3)

      expect(evictable.map((c) => c.key)).toEqual(['cache-2', 'cache-3', 'cache-1'])
    })

    it('excludes held cache keys from eviction', async () => {
      const { storage } = await bootstrap()
      await storage.saveCacheKey({ ...baseCacheKey, key: 'cache-1', holdCount: 1 })
      await storage.saveCacheKey({ ...baseCacheKey, key: 'cache-2' })

      const evictable = await storage.getEvictableCacheKeys(10)

      expect(evictable.map((c) => c.key)).toEqual(['cache-2'])
    })

    it('excludes frozen cache keys from eviction', async () => {
      const { storage } = await bootstrap()
      await storage.saveCacheKey({ ...baseCacheKey, key: 'cache-1', frozen: true })
      await storage.saveCacheKey({ ...baseCacheKey, key: 'cache-2' })

      const evictable = await storage.getEvictableCacheKeys(10)

      expect(evictable.map((c) => c.key)).toEqual(['cache-2'])
    })
  })

  describe('command operations', () => {
    const TEST_CACHE_KEY = deriveScopeKey({ scopeType: 'test' })

    const baseCommand: CommandRecord<ServiceLink, EnqueueCommand> = {
      commandId: 'cmd-1',
      cacheKey: TEST_CACHE_KEY,
      service: 'test-service',
      type: 'TestCommand',
      data: { foo: 'bar' },
      status: 'pending',
      dependsOn: [],
      blockedBy: [],
      attempts: 0,
      createdAt: 1000,
      updatedAt: 1000,
    }

    it('saves and retrieves command', async () => {
      const { storage } = await bootstrap()
      await storage.saveCommand(baseCommand)

      const retrieved = await storage.getCommand('cmd-1')
      expect(retrieved).toEqual(baseCommand)
    })

    it('returns undefined for non-existent command', async () => {
      const { storage } = await bootstrap()
      expect(await storage.getCommand('non-existent')).toBeUndefined()
    })

    it('updates command', async () => {
      const { storage } = await bootstrap()
      await storage.saveCommand(baseCommand)
      await storage.updateCommand('cmd-1', { status: 'sending', attempts: 1 })

      const retrieved = await storage.getCommand('cmd-1')
      expect(retrieved?.status).toBe('sending')
      expect(retrieved?.attempts).toBe(1)
    })

    it('filters commands by status', async () => {
      const { storage } = await bootstrap()
      await storage.saveCommand(baseCommand)
      await storage.saveCommand({ ...baseCommand, commandId: 'cmd-2', status: 'sending' })
      await storage.saveCommand({ ...baseCommand, commandId: 'cmd-3', status: 'pending' })

      const pending = await storage.getCommandsByStatus('pending')
      expect(pending).toHaveLength(2)
      expect(pending.map((c) => c.commandId).sort()).toEqual(['cmd-1', 'cmd-3'])
    })

    it('filters commands by multiple statuses', async () => {
      const { storage } = await bootstrap()
      await storage.saveCommand(baseCommand)
      await storage.saveCommand({ ...baseCommand, commandId: 'cmd-2', status: 'sending' })
      await storage.saveCommand({ ...baseCommand, commandId: 'cmd-3', status: 'succeeded' })

      const result = await storage.getCommandsByStatus(['pending', 'sending'])
      expect(result).toHaveLength(2)
    })

    it('gets commands blocked by a specific command', async () => {
      const { storage } = await bootstrap()
      await storage.saveCommand(baseCommand)
      await storage.saveCommand({ ...baseCommand, commandId: 'cmd-2', blockedBy: ['cmd-1'] })
      await storage.saveCommand({
        ...baseCommand,
        commandId: 'cmd-3',
        blockedBy: ['cmd-1', 'cmd-2'],
      })

      const blocked = await storage.getCommandsBlockedBy('cmd-1')
      expect(blocked).toHaveLength(2)
    })

    it('deletes command and associated anticipated events', async () => {
      const { storage } = await bootstrap()
      await storage.saveCommand(baseCommand)

      const event: CachedEventRecord = {
        id: 'event-1',
        type: 'TestEvent',
        streamId: 'stream-1',
        persistence: 'Anticipated',
        data: '{}',
        position: null,
        revision: null,
        commandId: 'cmd-1',
        cacheKeys: ['cache-1'],
        createdAt: 1000,
        processedAt: null,
      }
      await storage.saveCachedEvent(event)

      await storage.deleteCommand('cmd-1')

      expect(await storage.getCommand('cmd-1')).toBeUndefined()
      expect(await storage.getAnticipatedEventsByCommand('cmd-1')).toHaveLength(0)
    })

    it('applies filter with limit and offset', async () => {
      const { storage } = await bootstrap()
      for (let i = 1; i <= 5; i++) {
        await storage.saveCommand({ ...baseCommand, commandId: `cmd-${i}`, createdAt: i * 1000 })
      }

      const result = await storage.getCommands({ limit: 2, offset: 1 })
      expect(result).toHaveLength(2)
      expect(result.map((c) => c.commandId)).toEqual(['cmd-2', 'cmd-3'])
    })
  })

  describe('cached event operations', () => {
    const baseEvent: CachedEventRecord = {
      id: 'event-1',
      type: 'TestEvent',
      streamId: 'stream-1',
      persistence: 'Permanent',
      data: '{}',
      position: '100',
      revision: '1',
      commandId: null,
      cacheKeys: ['cache-1'],
      createdAt: 1000,
      processedAt: null,
    }

    it('saves and retrieves cached event', async () => {
      const { storage } = await bootstrap()
      await storage.saveCachedEvent(baseEvent)

      const retrieved = await storage.getCachedEvent('event-1')
      expect(retrieved).toEqual(baseEvent)
    })

    it('saves multiple events in batch', async () => {
      const { storage } = await bootstrap()
      const events = [baseEvent, { ...baseEvent, id: 'event-2' }]
      await storage.saveCachedEvents(events)

      expect(await storage.getCachedEvent('event-1')).toBeTruthy()
      expect(await storage.getCachedEvent('event-2')).toBeTruthy()
    })

    it('gets events by cache key', async () => {
      const { storage } = await bootstrap()
      await storage.saveCachedEvent(baseEvent)
      await storage.saveCachedEvent({ ...baseEvent, id: 'event-2', cacheKeys: ['cache-2'] })

      const events = await storage.getCachedEventsByCacheKey('cache-1')
      expect(events).toHaveLength(1)
      expect(events[0]?.id).toBe('event-1')
    })

    it('gets events by stream sorted by position', async () => {
      const { storage } = await bootstrap()
      await storage.saveCachedEvent({ ...baseEvent, id: 'event-1', position: '200' })
      await storage.saveCachedEvent({ ...baseEvent, id: 'event-2', position: '100' })
      await storage.saveCachedEvent({ ...baseEvent, id: 'event-3', position: '150' })

      const events = await storage.getCachedEventsByStream('stream-1')
      expect(events.map((e) => e.id)).toEqual(['event-2', 'event-3', 'event-1'])
    })

    it('gets anticipated events by command', async () => {
      const { storage } = await bootstrap()
      await storage.saveCachedEvent(baseEvent)
      await storage.saveCachedEvent({
        ...baseEvent,
        id: 'event-2',
        persistence: 'Anticipated',
        commandId: 'cmd-1',
      })

      const events = await storage.getAnticipatedEventsByCommand('cmd-1')
      expect(events).toHaveLength(1)
      expect(events[0]?.id).toBe('event-2')
    })

    it('deletes anticipated events by command', async () => {
      const { storage } = await bootstrap()
      await storage.saveCachedEvent({
        ...baseEvent,
        persistence: 'Anticipated',
        commandId: 'cmd-1',
      })
      await storage.saveCachedEvent({
        ...baseEvent,
        id: 'event-2',
        persistence: 'Anticipated',
        commandId: 'cmd-1',
      })

      await storage.deleteAnticipatedEventsByCommand('cmd-1')

      expect(await storage.getAnticipatedEventsByCommand('cmd-1')).toHaveLength(0)
    })

    it('stores event with multiple cache keys', async () => {
      const { storage } = await bootstrap()
      await storage.saveCachedEvent({ ...baseEvent, cacheKeys: ['key-a', 'key-b'] })

      const byA = await storage.getCachedEventsByCacheKey('key-a')
      const byB = await storage.getCachedEventsByCacheKey('key-b')
      expect(byA).toHaveLength(1)
      expect(byB).toHaveLength(1)
      expect(byA[0]?.id).toBe('event-1')
    })

    it('adds cache key associations to existing event', async () => {
      const { storage } = await bootstrap()
      await storage.saveCachedEvent(baseEvent) // cacheKeys: ['cache-1']
      await storage.addCacheKeysToEvent('event-1', ['cache-2', 'cache-3'])

      const event = await storage.getCachedEvent('event-1')
      expect(event?.cacheKeys).toContain('cache-1')
      expect(event?.cacheKeys).toContain('cache-2')
      expect(event?.cacheKeys).toContain('cache-3')
    })

    it('removeCacheKeyFromEvents keeps event if other keys remain', async () => {
      const { storage } = await bootstrap()
      await storage.saveCachedEvent({ ...baseEvent, cacheKeys: ['key-a', 'key-b'] })

      const deleted = await storage.removeCacheKeyFromEvents('key-a')
      expect(deleted).toHaveLength(0) // event still has key-b

      const event = await storage.getCachedEvent('event-1')
      expect(event?.cacheKeys).toEqual(['key-b'])
    })

    it('removeCacheKeyFromEvents deletes event when no keys remain', async () => {
      const { storage } = await bootstrap()
      await storage.saveCachedEvent({ ...baseEvent, cacheKeys: ['key-a'] })

      const deleted = await storage.removeCacheKeyFromEvents('key-a')
      expect(deleted).toEqual(['event-1'])

      expect(await storage.getCachedEvent('event-1')).toBeUndefined()
    })
  })

  describe('read model operations', () => {
    const baseReadModel: ReadModelRecord = {
      id: 'entity-1',
      collection: 'todos',
      cacheKeys: ['cache-1'],
      serverData: '{"title":"Test"}',
      effectiveData: '{"title":"Test"}',
      hasLocalChanges: false,
      updatedAt: 1000,
      revision: null,
      position: null,
      _clientMetadata: null,
    }

    it('saves and retrieves read model', async () => {
      const { storage } = await bootstrap()
      await storage.saveReadModel(baseReadModel)

      const retrieved = await storage.getReadModel('todos', 'entity-1')
      expect(retrieved).toEqual(baseReadModel)
    })

    it('returns undefined for non-existent read model', async () => {
      const { storage } = await bootstrap()
      expect(await storage.getReadModel('todos', 'non-existent')).toBeUndefined()
    })

    it('saves multiple read models in batch', async () => {
      const { storage } = await bootstrap()
      const models = [baseReadModel, { ...baseReadModel, id: 'entity-2' }]
      await storage.saveReadModels(models)

      expect(await storage.getReadModel('todos', 'entity-1')).toBeTruthy()
      expect(await storage.getReadModel('todos', 'entity-2')).toBeTruthy()
    })

    it('gets read models by collection', async () => {
      const { storage } = await bootstrap()
      await storage.saveReadModel(baseReadModel)
      await storage.saveReadModel({ ...baseReadModel, id: 'entity-2' })
      await storage.saveReadModel({ ...baseReadModel, id: 'entity-3', collection: 'users' })

      const todos = await storage.getReadModelsByCollection('todos')
      expect(todos).toHaveLength(2)
    })

    it('gets read models by cache key', async () => {
      const { storage } = await bootstrap()
      await storage.saveReadModel(baseReadModel)
      await storage.saveReadModel({ ...baseReadModel, id: 'entity-2', cacheKeys: ['cache-2'] })

      const models = await storage.getReadModelsByCacheKey('cache-1')
      expect(models).toHaveLength(1)
    })

    it('applies pagination to collection query', async () => {
      const { storage } = await bootstrap()
      for (let i = 1; i <= 5; i++) {
        await storage.saveReadModel({ ...baseReadModel, id: `entity-${i}` })
      }

      const result = await storage.getReadModelsByCollection('todos', { limit: 2, offset: 1 })
      expect(result).toHaveLength(2)
    })

    it('deletes read model', async () => {
      const { storage } = await bootstrap()
      await storage.saveReadModel(baseReadModel)
      await storage.deleteReadModel('todos', 'entity-1')

      expect(await storage.getReadModel('todos', 'entity-1')).toBeUndefined()
    })

    it('removes cache key from read models and deletes orphans', async () => {
      const { storage } = await bootstrap()
      await storage.saveReadModel(baseReadModel)
      await storage.saveReadModel({ ...baseReadModel, id: 'entity-2', cacheKeys: ['cache-2'] })

      await storage.removeCacheKeyFromReadModels('cache-1')

      expect(await storage.getReadModel('todos', 'entity-1')).toBeUndefined()
      expect(await storage.getReadModel('todos', 'entity-2')).toBeTruthy()
    })

    it('keeps read model when other cache keys remain', async () => {
      const { storage } = await bootstrap()
      await storage.saveReadModel({
        ...baseReadModel,
        cacheKeys: ['cache-1', 'cache-2'],
      })

      await storage.removeCacheKeyFromReadModels('cache-1')

      const record = await storage.getReadModel('todos', 'entity-1')
      expect(record).toBeTruthy()
      expect(record?.cacheKeys).toEqual(['cache-2'])
    })

    it('adds cache key associations to existing read model', async () => {
      const { storage } = await bootstrap()
      await storage.saveReadModel(baseReadModel)
      await storage.addCacheKeysToReadModel('todos', 'entity-1', ['cache-2', 'cache-3'])

      const record = await storage.getReadModel('todos', 'entity-1')
      expect(record?.cacheKeys).toContain('cache-1')
      expect(record?.cacheKeys).toContain('cache-2')
      expect(record?.cacheKeys).toContain('cache-3')
    })

    it('deletes read models by collection', async () => {
      const { storage } = await bootstrap()
      await storage.saveReadModel(baseReadModel)
      await storage.saveReadModel({ ...baseReadModel, id: 'entity-2', collection: 'users' })

      await storage.deleteReadModelsByCollection('todos')

      expect(await storage.getReadModel('todos', 'entity-1')).toBeUndefined()
      expect(await storage.getReadModel('users', 'entity-2')).toBeTruthy()
    })
  })
})
