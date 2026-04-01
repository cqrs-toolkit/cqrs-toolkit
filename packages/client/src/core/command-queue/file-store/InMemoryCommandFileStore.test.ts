import { describe, expect, it } from 'vitest'
import { InMemoryCommandFileStore } from './InMemoryCommandFileStore.js'

describe('InMemoryCommandFileStore', () => {
  describe('save and read', () => {
    it('stores and retrieves a blob', async () => {
      const store = new InMemoryCommandFileStore()
      const blob = new Blob(['hello world'], { type: 'text/plain' })

      await store.save('cmd-1', 'file-1', blob)
      const result = await store.read('cmd-1', 'file-1')

      expect(result).toBe(blob)
    })

    it('returns undefined for nonexistent file', async () => {
      const store = new InMemoryCommandFileStore()

      const result = await store.read('cmd-1', 'file-1')

      expect(result).toBeUndefined()
    })

    it('stores multiple files for the same command', async () => {
      const store = new InMemoryCommandFileStore()
      const blob1 = new Blob(['file 1'])
      const blob2 = new Blob(['file 2'])

      await store.save('cmd-1', 'file-a', blob1)
      await store.save('cmd-1', 'file-b', blob2)

      expect(await store.read('cmd-1', 'file-a')).toBe(blob1)
      expect(await store.read('cmd-1', 'file-b')).toBe(blob2)
    })

    it('stores files for different commands independently', async () => {
      const store = new InMemoryCommandFileStore()
      const blob1 = new Blob(['cmd1 file'])
      const blob2 = new Blob(['cmd2 file'])

      await store.save('cmd-1', 'file-1', blob1)
      await store.save('cmd-2', 'file-1', blob2)

      expect(await store.read('cmd-1', 'file-1')).toBe(blob1)
      expect(await store.read('cmd-2', 'file-1')).toBe(blob2)
    })
  })

  describe('deleteForCommand', () => {
    it('deletes all files for a command', async () => {
      const store = new InMemoryCommandFileStore()
      await store.save('cmd-1', 'file-a', new Blob(['a']))
      await store.save('cmd-1', 'file-b', new Blob(['b']))
      await store.save('cmd-2', 'file-c', new Blob(['c']))

      await store.deleteForCommand('cmd-1')

      expect(await store.read('cmd-1', 'file-a')).toBeUndefined()
      expect(await store.read('cmd-1', 'file-b')).toBeUndefined()
      expect(await store.read('cmd-2', 'file-c')).toBeDefined()
    })

    it('is a no-op when command has no files', async () => {
      const store = new InMemoryCommandFileStore()

      await store.deleteForCommand('nonexistent')
      // No error thrown
    })
  })

  describe('clear', () => {
    it('removes all stored files', async () => {
      const store = new InMemoryCommandFileStore()
      await store.save('cmd-1', 'file-1', new Blob(['a']))
      await store.save('cmd-2', 'file-2', new Blob(['b']))

      await store.clear()

      expect(await store.read('cmd-1', 'file-1')).toBeUndefined()
      expect(await store.read('cmd-2', 'file-2')).toBeUndefined()
    })
  })

  describe('cleanOrphans', () => {
    it('removes files for commands not in the existing set', async () => {
      const store = new InMemoryCommandFileStore()
      await store.save('cmd-1', 'file-1', new Blob(['keep']))
      await store.save('cmd-2', 'file-2', new Blob(['orphan']))
      await store.save('cmd-3', 'file-3', new Blob(['also orphan']))

      await store.cleanOrphans(new Set(['cmd-1']))

      expect(await store.read('cmd-1', 'file-1')).toBeDefined()
      expect(await store.read('cmd-2', 'file-2')).toBeUndefined()
      expect(await store.read('cmd-3', 'file-3')).toBeUndefined()
    })

    it('keeps all files when all commands exist', async () => {
      const store = new InMemoryCommandFileStore()
      await store.save('cmd-1', 'file-1', new Blob(['a']))
      await store.save('cmd-2', 'file-2', new Blob(['b']))

      await store.cleanOrphans(new Set(['cmd-1', 'cmd-2']))

      expect(await store.read('cmd-1', 'file-1')).toBeDefined()
      expect(await store.read('cmd-2', 'file-2')).toBeDefined()
    })

    it('is a no-op when store is empty', async () => {
      const store = new InMemoryCommandFileStore()

      await store.cleanOrphans(new Set(['cmd-1']))
      // No error thrown
    })
  })
})
