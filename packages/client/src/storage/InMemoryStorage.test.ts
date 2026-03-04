/**
 * Unit tests for InMemoryStorage.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import type { CommandRecord } from '../types/commands.js'
import { InMemoryStorage } from './InMemoryStorage.js'
import type {
  CacheKeyRecord,
  CachedEventRecord,
  ReadModelRecord,
  SessionRecord,
} from './IStorage.js'

describe('InMemoryStorage', () => {
  let storage: InMemoryStorage

  beforeEach(async () => {
    storage = new InMemoryStorage()
    await storage.initialize()
  })

  describe('lifecycle', () => {
    it('initializes successfully', async () => {
      const newStorage = new InMemoryStorage()
      await expect(newStorage.initialize()).resolves.toBeUndefined()
    })

    it('clears all data', async () => {
      const session: SessionRecord = { id: 1, userId: 'user-1', createdAt: 1000, lastSeenAt: 1000 }
      await storage.saveSession(session)

      await storage.clear()

      expect(await storage.getSession()).toBeUndefined()
    })
  })

  describe('session operations', () => {
    it('saves and retrieves session', async () => {
      const session: SessionRecord = { id: 1, userId: 'user-1', createdAt: 1000, lastSeenAt: 1000 }
      await storage.saveSession(session)

      const retrieved = await storage.getSession()
      expect(retrieved).toEqual(session)
    })

    it('returns undefined when no session exists', async () => {
      expect(await storage.getSession()).toBeUndefined()
    })

    it('deletes session and all associated data', async () => {
      const session: SessionRecord = { id: 1, userId: 'user-1', createdAt: 1000, lastSeenAt: 1000 }
      await storage.saveSession(session)

      const cacheKey: CacheKeyRecord = {
        key: 'cache-1',
        lastAccessedAt: 1000,
        holdCount: 0,
        frozen: false,
        expiresAt: null,
        createdAt: 1000,
        evictionPolicy: 'persistent',
      }
      await storage.saveCacheKey(cacheKey)

      await storage.deleteSession()

      expect(await storage.getSession()).toBeUndefined()
      expect(await storage.getAllCacheKeys()).toHaveLength(0)
    })

    it('updates lastSeenAt on touch', async () => {
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
    const baseCacheKey: CacheKeyRecord = {
      key: 'cache-1',
      lastAccessedAt: 1000,
      holdCount: 0,
      frozen: false,
      expiresAt: null,
      createdAt: 1000,
      evictionPolicy: 'persistent',
    }

    it('saves and retrieves cache key', async () => {
      await storage.saveCacheKey(baseCacheKey)

      const retrieved = await storage.getCacheKey('cache-1')
      expect(retrieved).toEqual(baseCacheKey)
    })

    it('returns undefined for non-existent cache key', async () => {
      expect(await storage.getCacheKey('non-existent')).toBeUndefined()
    })

    it('lists all cache keys', async () => {
      await storage.saveCacheKey(baseCacheKey)
      await storage.saveCacheKey({ ...baseCacheKey, key: 'cache-2' })

      const all = await storage.getAllCacheKeys()
      expect(all).toHaveLength(2)
    })

    it('increments hold count', async () => {
      await storage.saveCacheKey(baseCacheKey)
      await storage.holdCacheKey('cache-1')

      const retrieved = await storage.getCacheKey('cache-1')
      expect(retrieved?.holdCount).toBe(1)
    })

    it('decrements hold count', async () => {
      await storage.saveCacheKey({ ...baseCacheKey, holdCount: 2 })
      await storage.releaseCacheKey('cache-1')

      const retrieved = await storage.getCacheKey('cache-1')
      expect(retrieved?.holdCount).toBe(1)
    })

    it('does not decrement hold count below 0', async () => {
      await storage.saveCacheKey(baseCacheKey)
      await storage.releaseCacheKey('cache-1')

      const retrieved = await storage.getCacheKey('cache-1')
      expect(retrieved?.holdCount).toBe(0)
    })

    it('touches cache key', async () => {
      await storage.saveCacheKey(baseCacheKey)
      await new Promise((r) => setTimeout(r, 10))
      await storage.touchCacheKey('cache-1')

      const retrieved = await storage.getCacheKey('cache-1')
      expect(retrieved?.lastAccessedAt).toBeGreaterThan(1000)
    })

    it('deletes cache key and associated data', async () => {
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
        cacheKey: 'cache-1',
        createdAt: 1000,
      }
      await storage.saveCachedEvent(event)

      await storage.deleteCacheKey('cache-1')

      expect(await storage.getCacheKey('cache-1')).toBeUndefined()
      expect(await storage.getCachedEventsByCacheKey('cache-1')).toHaveLength(0)
    })

    it('gets evictable cache keys in LRU order', async () => {
      await storage.saveCacheKey({ ...baseCacheKey, key: 'cache-1', lastAccessedAt: 3000 })
      await storage.saveCacheKey({ ...baseCacheKey, key: 'cache-2', lastAccessedAt: 1000 })
      await storage.saveCacheKey({ ...baseCacheKey, key: 'cache-3', lastAccessedAt: 2000 })

      const evictable = await storage.getEvictableCacheKeys(3)

      expect(evictable.map((c) => c.key)).toEqual(['cache-2', 'cache-3', 'cache-1'])
    })

    it('excludes held cache keys from eviction', async () => {
      await storage.saveCacheKey({ ...baseCacheKey, key: 'cache-1', holdCount: 1 })
      await storage.saveCacheKey({ ...baseCacheKey, key: 'cache-2' })

      const evictable = await storage.getEvictableCacheKeys(10)

      expect(evictable.map((c) => c.key)).toEqual(['cache-2'])
    })

    it('excludes frozen cache keys from eviction', async () => {
      await storage.saveCacheKey({ ...baseCacheKey, key: 'cache-1', frozen: true })
      await storage.saveCacheKey({ ...baseCacheKey, key: 'cache-2' })

      const evictable = await storage.getEvictableCacheKeys(10)

      expect(evictable.map((c) => c.key)).toEqual(['cache-2'])
    })
  })

  describe('command operations', () => {
    const baseCommand: CommandRecord = {
      commandId: 'cmd-1',
      service: 'test-service',
      type: 'TestCommand',
      payload: { foo: 'bar' },
      status: 'pending',
      dependsOn: [],
      blockedBy: [],
      attempts: 0,
      createdAt: 1000,
      updatedAt: 1000,
    }

    it('saves and retrieves command', async () => {
      await storage.saveCommand(baseCommand)

      const retrieved = await storage.getCommand('cmd-1')
      expect(retrieved).toEqual(baseCommand)
    })

    it('returns undefined for non-existent command', async () => {
      expect(await storage.getCommand('non-existent')).toBeUndefined()
    })

    it('updates command', async () => {
      await storage.saveCommand(baseCommand)
      await storage.updateCommand('cmd-1', { status: 'sending', attempts: 1 })

      const retrieved = await storage.getCommand('cmd-1')
      expect(retrieved?.status).toBe('sending')
      expect(retrieved?.attempts).toBe(1)
    })

    it('filters commands by status', async () => {
      await storage.saveCommand(baseCommand)
      await storage.saveCommand({ ...baseCommand, commandId: 'cmd-2', status: 'sending' })
      await storage.saveCommand({ ...baseCommand, commandId: 'cmd-3', status: 'pending' })

      const pending = await storage.getCommandsByStatus('pending')
      expect(pending).toHaveLength(2)
      expect(pending.map((c) => c.commandId).sort()).toEqual(['cmd-1', 'cmd-3'])
    })

    it('filters commands by multiple statuses', async () => {
      await storage.saveCommand(baseCommand)
      await storage.saveCommand({ ...baseCommand, commandId: 'cmd-2', status: 'sending' })
      await storage.saveCommand({ ...baseCommand, commandId: 'cmd-3', status: 'succeeded' })

      const result = await storage.getCommandsByStatus(['pending', 'sending'])
      expect(result).toHaveLength(2)
    })

    it('gets commands blocked by a specific command', async () => {
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
        cacheKey: 'cache-1',
        createdAt: 1000,
      }
      await storage.saveCachedEvent(event)

      await storage.deleteCommand('cmd-1')

      expect(await storage.getCommand('cmd-1')).toBeUndefined()
      expect(await storage.getAnticipatedEventsByCommand('cmd-1')).toHaveLength(0)
    })

    it('applies filter with limit and offset', async () => {
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
      cacheKey: 'cache-1',
      createdAt: 1000,
    }

    it('saves and retrieves cached event', async () => {
      await storage.saveCachedEvent(baseEvent)

      const retrieved = await storage.getCachedEvent('event-1')
      expect(retrieved).toEqual(baseEvent)
    })

    it('saves multiple events in batch', async () => {
      const events = [baseEvent, { ...baseEvent, id: 'event-2' }]
      await storage.saveCachedEvents(events)

      expect(await storage.getCachedEvent('event-1')).toBeTruthy()
      expect(await storage.getCachedEvent('event-2')).toBeTruthy()
    })

    it('gets events by cache key', async () => {
      await storage.saveCachedEvent(baseEvent)
      await storage.saveCachedEvent({ ...baseEvent, id: 'event-2', cacheKey: 'cache-2' })

      const events = await storage.getCachedEventsByCacheKey('cache-1')
      expect(events).toHaveLength(1)
      expect(events[0]?.id).toBe('event-1')
    })

    it('gets events by stream sorted by position', async () => {
      await storage.saveCachedEvent({ ...baseEvent, id: 'event-1', position: '200' })
      await storage.saveCachedEvent({ ...baseEvent, id: 'event-2', position: '100' })
      await storage.saveCachedEvent({ ...baseEvent, id: 'event-3', position: '150' })

      const events = await storage.getCachedEventsByStream('stream-1')
      expect(events.map((e) => e.id)).toEqual(['event-2', 'event-3', 'event-1'])
    })

    it('gets anticipated events by command', async () => {
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
  })

  describe('read model operations', () => {
    const baseReadModel: ReadModelRecord = {
      id: 'entity-1',
      collection: 'todos',
      cacheKey: 'cache-1',
      serverData: '{"title":"Test"}',
      effectiveData: '{"title":"Test"}',
      hasLocalChanges: false,
      updatedAt: 1000,
    }

    it('saves and retrieves read model', async () => {
      await storage.saveReadModel(baseReadModel)

      const retrieved = await storage.getReadModel('todos', 'entity-1')
      expect(retrieved).toEqual(baseReadModel)
    })

    it('returns undefined for non-existent read model', async () => {
      expect(await storage.getReadModel('todos', 'non-existent')).toBeUndefined()
    })

    it('saves multiple read models in batch', async () => {
      const models = [baseReadModel, { ...baseReadModel, id: 'entity-2' }]
      await storage.saveReadModels(models)

      expect(await storage.getReadModel('todos', 'entity-1')).toBeTruthy()
      expect(await storage.getReadModel('todos', 'entity-2')).toBeTruthy()
    })

    it('gets read models by collection', async () => {
      await storage.saveReadModel(baseReadModel)
      await storage.saveReadModel({ ...baseReadModel, id: 'entity-2' })
      await storage.saveReadModel({ ...baseReadModel, id: 'entity-3', collection: 'users' })

      const todos = await storage.getReadModelsByCollection('todos')
      expect(todos).toHaveLength(2)
    })

    it('gets read models by cache key', async () => {
      await storage.saveReadModel(baseReadModel)
      await storage.saveReadModel({ ...baseReadModel, id: 'entity-2', cacheKey: 'cache-2' })

      const models = await storage.getReadModelsByCacheKey('cache-1')
      expect(models).toHaveLength(1)
    })

    it('applies pagination to collection query', async () => {
      for (let i = 1; i <= 5; i++) {
        await storage.saveReadModel({ ...baseReadModel, id: `entity-${i}` })
      }

      const result = await storage.getReadModelsByCollection('todos', { limit: 2, offset: 1 })
      expect(result).toHaveLength(2)
    })

    it('deletes read model', async () => {
      await storage.saveReadModel(baseReadModel)
      await storage.deleteReadModel('todos', 'entity-1')

      expect(await storage.getReadModel('todos', 'entity-1')).toBeUndefined()
    })

    it('deletes read models by cache key', async () => {
      await storage.saveReadModel(baseReadModel)
      await storage.saveReadModel({ ...baseReadModel, id: 'entity-2', cacheKey: 'cache-2' })

      await storage.deleteReadModelsByCacheKey('cache-1')

      expect(await storage.getReadModel('todos', 'entity-1')).toBeUndefined()
      expect(await storage.getReadModel('todos', 'entity-2')).toBeTruthy()
    })

    it('deletes read models by collection', async () => {
      await storage.saveReadModel(baseReadModel)
      await storage.saveReadModel({ ...baseReadModel, id: 'entity-2', collection: 'users' })

      await storage.deleteReadModelsByCollection('todos')

      expect(await storage.getReadModel('todos', 'entity-1')).toBeUndefined()
      expect(await storage.getReadModel('users', 'entity-2')).toBeTruthy()
    })
  })
})
