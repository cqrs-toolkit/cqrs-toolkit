import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FsCommandFileStore } from './FsCommandFileStore.js'

describe('FsCommandFileStore', () => {
  let basePath: string
  let store: FsCommandFileStore

  beforeEach(async () => {
    basePath = await mkdtemp(join(tmpdir(), 'cqrs-fs-store-'))
    store = new FsCommandFileStore(basePath)
  })

  afterEach(async () => {
    await rm(basePath, { recursive: true, force: true })
  })

  it('saves and reads a file', async () => {
    const data = new Blob(['hello world'], { type: 'text/plain' })
    await store.save('cmd-1', 'file-a', data)

    const result = await store.read('cmd-1', 'file-a')
    expect(result).toBeInstanceOf(Blob)
    expect(await result?.text()).toBe('hello world')
  })

  it('returns undefined for missing files', async () => {
    const result = await store.read('nonexistent', 'file-a')
    expect(result).toBeUndefined()
  })

  it('deletes all files for a command', async () => {
    await store.save('cmd-1', 'file-a', new Blob(['a']))
    await store.save('cmd-1', 'file-b', new Blob(['b']))
    await store.save('cmd-2', 'file-c', new Blob(['c']))

    await store.deleteForCommand('cmd-1')

    expect(await store.read('cmd-1', 'file-a')).toBeUndefined()
    expect(await store.read('cmd-1', 'file-b')).toBeUndefined()
    expect(await store.read('cmd-2', 'file-c')).toBeInstanceOf(Blob)
  })

  it('clears all uploaded files', async () => {
    await store.save('cmd-1', 'file-a', new Blob(['a']))
    await store.save('cmd-2', 'file-b', new Blob(['b']))

    await store.clear()

    expect(await store.read('cmd-1', 'file-a')).toBeUndefined()
    expect(await store.read('cmd-2', 'file-b')).toBeUndefined()
    expect(existsSync(join(basePath, 'uploads'))).toBe(false)
  })

  it('cleans orphaned command directories', async () => {
    await store.save('cmd-1', 'file-a', new Blob(['a']))
    await store.save('cmd-2', 'file-b', new Blob(['b']))
    await store.save('cmd-3', 'file-c', new Blob(['c']))

    await store.cleanOrphans(new Set(['cmd-2']))

    expect(await store.read('cmd-1', 'file-a')).toBeUndefined()
    expect(await store.read('cmd-2', 'file-b')).toBeInstanceOf(Blob)
    expect(await store.read('cmd-3', 'file-c')).toBeUndefined()
  })

  it('handles cleanOrphans when no uploads directory exists', async () => {
    // Should not throw
    await store.cleanOrphans(new Set(['cmd-1']))
  })

  it('handles deleteForCommand when directory does not exist', async () => {
    // Should not throw
    await store.deleteForCommand('nonexistent')
  })

  it('handles clear when uploads directory does not exist', async () => {
    // Should not throw
    await store.clear()
  })
})
