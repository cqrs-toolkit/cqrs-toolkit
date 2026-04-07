import { describe, expect, it } from 'vitest'
import type { CollectionSyncStatus } from './SeedStatusIndex.js'
import { SeedStatusIndex } from './SeedStatusIndex.js'

function makeStatus(collection: string, cacheKey: string): CollectionSyncStatus {
  return { collection, cacheKey, seeded: false, syncing: false }
}

describe('SeedStatusIndex', () => {
  describe('set and get', () => {
    it('stores and retrieves by (collection, cacheKey)', () => {
      const index = new SeedStatusIndex()
      const status = makeStatus('notes', 'key-1')
      index.set('notes', 'key-1', status)

      expect(index.get('notes', 'key-1')).toBe(status)
    })

    it('returns undefined for missing entries', () => {
      const index = new SeedStatusIndex()
      expect(index.get('notes', 'key-1')).toBeUndefined()
    })
  })

  describe('dual-index consistency', () => {
    it('same object is reachable from both indexes', () => {
      const index = new SeedStatusIndex()
      const status = makeStatus('notes', 'key-1')
      index.set('notes', 'key-1', status)

      const fromCollection = index.getByCollection('notes')?.get('key-1')
      const fromCacheKey = index.getByCacheKey('key-1')?.get('notes')

      expect(fromCollection).toBe(status)
      expect(fromCacheKey).toBe(status)
    })

    it('handles multiple collections per cache key', () => {
      const index = new SeedStatusIndex()
      const notesStatus = makeStatus('notes', 'key-1')
      const todosStatus = makeStatus('todos', 'key-1')
      index.set('notes', 'key-1', notesStatus)
      index.set('todos', 'key-1', todosStatus)

      const byKey = index.getByCacheKey('key-1')
      expect(byKey?.size).toBe(2)
      expect(byKey?.get('notes')).toBe(notesStatus)
      expect(byKey?.get('todos')).toBe(todosStatus)
    })

    it('handles multiple cache keys per collection', () => {
      const index = new SeedStatusIndex()
      const status1 = makeStatus('notes', 'key-1')
      const status2 = makeStatus('notes', 'key-2')
      index.set('notes', 'key-1', status1)
      index.set('notes', 'key-2', status2)

      const byCol = index.getByCollection('notes')
      expect(byCol?.size).toBe(2)
      expect(byCol?.get('key-1')).toBe(status1)
      expect(byCol?.get('key-2')).toBe(status2)
    })
  })

  describe('update', () => {
    it('mutates the shared object in-place', () => {
      const index = new SeedStatusIndex()
      const status = makeStatus('notes', 'key-1')
      index.set('notes', 'key-1', status)

      index.update('notes', 'key-1', { seeded: true, syncing: false })

      expect(status.seeded).toBe(true)
      expect(index.get('notes', 'key-1')?.seeded).toBe(true)
      expect(index.getByCacheKey('key-1')?.get('notes')?.seeded).toBe(true)
    })

    it('is a no-op for missing entries', () => {
      const index = new SeedStatusIndex()
      index.update('notes', 'key-1', { seeded: true })
      expect(index.get('notes', 'key-1')).toBeUndefined()
    })
  })

  describe('has', () => {
    it('returns true for existing entries', () => {
      const index = new SeedStatusIndex()
      index.set('notes', 'key-1', makeStatus('notes', 'key-1'))
      expect(index.has('notes', 'key-1')).toBe(true)
    })

    it('returns false for missing entries', () => {
      const index = new SeedStatusIndex()
      expect(index.has('notes', 'key-1')).toBe(false)
    })
  })

  describe('delete', () => {
    it('removes from both indexes', () => {
      const index = new SeedStatusIndex()
      index.set('notes', 'key-1', makeStatus('notes', 'key-1'))
      index.delete('notes', 'key-1')

      expect(index.get('notes', 'key-1')).toBeUndefined()
      expect(index.getByCollection('notes')).toBeUndefined()
      expect(index.getByCacheKey('key-1')).toBeUndefined()
    })

    it('preserves other entries for the same collection', () => {
      const index = new SeedStatusIndex()
      index.set('notes', 'key-1', makeStatus('notes', 'key-1'))
      index.set('notes', 'key-2', makeStatus('notes', 'key-2'))
      index.delete('notes', 'key-1')

      expect(index.get('notes', 'key-1')).toBeUndefined()
      expect(index.get('notes', 'key-2')).toBeDefined()
      expect(index.getByCollection('notes')?.size).toBe(1)
    })

    it('preserves other entries for the same cache key', () => {
      const index = new SeedStatusIndex()
      index.set('notes', 'key-1', makeStatus('notes', 'key-1'))
      index.set('todos', 'key-1', makeStatus('todos', 'key-1'))
      index.delete('notes', 'key-1')

      expect(index.get('notes', 'key-1')).toBeUndefined()
      expect(index.get('todos', 'key-1')).toBeDefined()
      expect(index.getByCacheKey('key-1')?.size).toBe(1)
    })

    it('is a no-op for missing entries', () => {
      const index = new SeedStatusIndex()
      index.delete('notes', 'key-1')
      expect(index.getByCollection('notes')).toBeUndefined()
    })
  })

  describe('deleteAllForCacheKey', () => {
    it('removes all collections for a cache key', () => {
      const index = new SeedStatusIndex()
      index.set('notes', 'key-1', makeStatus('notes', 'key-1'))
      index.set('todos', 'key-1', makeStatus('todos', 'key-1'))
      index.set('notes', 'key-2', makeStatus('notes', 'key-2'))

      index.deleteAllForCacheKey('key-1')

      expect(index.getByCacheKey('key-1')).toBeUndefined()
      expect(index.get('notes', 'key-1')).toBeUndefined()
      expect(index.get('todos', 'key-1')).toBeUndefined()
      // key-2 entry for notes is preserved
      expect(index.get('notes', 'key-2')).toBeDefined()
    })

    it('cleans up empty collection inner maps', () => {
      const index = new SeedStatusIndex()
      index.set('todos', 'key-1', makeStatus('todos', 'key-1'))

      index.deleteAllForCacheKey('key-1')

      // todos inner map should be removed since it's now empty
      expect(index.getByCollection('todos')).toBeUndefined()
    })

    it('is a no-op for unknown cache keys', () => {
      const index = new SeedStatusIndex()
      index.set('notes', 'key-1', makeStatus('notes', 'key-1'))
      index.deleteAllForCacheKey('key-unknown')
      expect(index.get('notes', 'key-1')).toBeDefined()
    })
  })

  describe('clear', () => {
    it('removes all entries from both indexes', () => {
      const index = new SeedStatusIndex()
      index.set('notes', 'key-1', makeStatus('notes', 'key-1'))
      index.set('todos', 'key-2', makeStatus('todos', 'key-2'))

      index.clear()

      expect(index.getByCollection('notes')).toBeUndefined()
      expect(index.getByCollection('todos')).toBeUndefined()
      expect(index.getByCacheKey('key-1')).toBeUndefined()
      expect(index.getByCacheKey('key-2')).toBeUndefined()
    })
  })

  describe('values', () => {
    it('yields all status entries', () => {
      const index = new SeedStatusIndex()
      const s1 = makeStatus('notes', 'key-1')
      const s2 = makeStatus('todos', 'key-2')
      const s3 = makeStatus('notes', 'key-2')
      index.set('notes', 'key-1', s1)
      index.set('todos', 'key-2', s2)
      index.set('notes', 'key-2', s3)

      const all = Array.from(index.values())
      expect(all).toHaveLength(3)
      expect(all).toContain(s1)
      expect(all).toContain(s2)
      expect(all).toContain(s3)
    })

    it('yields nothing when empty', () => {
      const index = new SeedStatusIndex()
      expect(Array.from(index.values())).toHaveLength(0)
    })
  })
})
