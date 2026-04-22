import { describe, expect, it } from 'vitest'
import { AggregateChainRegistry } from './AggregateChainRegistry.js'

const CLIENT_A = 'nb.Todo-temp-a'
const CLIENT_B = 'nb.Todo-temp-b'
const SERVER_A = 'nb.Todo-server-a'
const SERVER_B = 'nb.Todo-server-b'

describe('AggregateChainRegistry', () => {
  describe('create', () => {
    it('creates a chain with only clientStreamId', () => {
      const registry = new AggregateChainRegistry()
      const chain = registry.create({ clientStreamId: CLIENT_A })
      expect(chain.clientStreamId).toBe(CLIENT_A)
      expect(chain.serverStreamId).toBeUndefined()
      expect(registry.get(CLIENT_A)).toBe(chain)
    })

    it('creates a chain with only serverStreamId', () => {
      const registry = new AggregateChainRegistry()
      const chain = registry.create({ serverStreamId: SERVER_A })
      expect(chain.clientStreamId).toBeUndefined()
      expect(chain.serverStreamId).toBe(SERVER_A)
      expect(registry.get(SERVER_A)).toBe(chain)
    })

    it('creates a chain with both streamIds', () => {
      const registry = new AggregateChainRegistry()
      const chain = registry.create({ clientStreamId: CLIENT_A, serverStreamId: SERVER_A })
      expect(registry.get(CLIENT_A)).toBe(chain)
      expect(registry.get(SERVER_A)).toBe(chain)
    })

    it('initializes state fields from init', () => {
      const registry = new AggregateChainRegistry()
      const chain = registry.create({
        clientStreamId: CLIENT_A,
        createCommandId: 'cmd-1',
        createdEntityId: 'temp-a',
        latestCommandId: 'cmd-1',
        lastKnownRevision: 'rev-0',
      })
      expect(chain.createCommandId).toBe('cmd-1')
      expect(chain.createdEntityId).toBe('temp-a')
      expect(chain.latestCommandId).toBe('cmd-1')
      expect(chain.lastKnownRevision).toBe('rev-0')
    })

    it('asserts when neither streamId is provided', () => {
      const registry = new AggregateChainRegistry()
      expect(() => registry.create({})).toThrow()
    })

    it('asserts when clientStreamId is already bound', () => {
      const registry = new AggregateChainRegistry()
      registry.create({ clientStreamId: CLIENT_A })
      expect(() => registry.create({ clientStreamId: CLIENT_A })).toThrow()
    })

    it('asserts when serverStreamId is already bound', () => {
      const registry = new AggregateChainRegistry()
      registry.create({ serverStreamId: SERVER_A })
      expect(() => registry.create({ serverStreamId: SERVER_A })).toThrow()
    })
  })

  describe('attachServerStreamId', () => {
    it('adds server streamId to a client-only chain', () => {
      const registry = new AggregateChainRegistry()
      const chain = registry.create({ clientStreamId: CLIENT_A })
      registry.attachServerStreamId(chain, SERVER_A)
      expect(chain.serverStreamId).toBe(SERVER_A)
      expect(registry.get(CLIENT_A)).toBe(chain)
      expect(registry.get(SERVER_A)).toBe(chain)
    })

    it('mutations via either index are visible via the other', () => {
      const registry = new AggregateChainRegistry()
      const chain = registry.create({ clientStreamId: CLIENT_A })
      registry.attachServerStreamId(chain, SERVER_A)

      const viaClient = registry.get(CLIENT_A)
      expect(viaClient).toBeDefined()
      if (!viaClient) return
      viaClient.lastKnownRevision = 'rev-5'

      const viaServer = registry.get(SERVER_A)
      expect(viaServer?.lastKnownRevision).toBe('rev-5')
    })

    it('asserts when chain already has a serverStreamId', () => {
      const registry = new AggregateChainRegistry()
      const chain = registry.create({ clientStreamId: CLIENT_A, serverStreamId: SERVER_A })
      expect(() => registry.attachServerStreamId(chain, SERVER_B)).toThrow()
    })

    it('asserts when target serverStreamId already belongs to another chain', () => {
      const registry = new AggregateChainRegistry()
      const a = registry.create({ clientStreamId: CLIENT_A })
      registry.create({ serverStreamId: SERVER_A })
      expect(() => registry.attachServerStreamId(a, SERVER_A)).toThrow()
    })
  })

  describe('attachClientStreamId', () => {
    it('adds client streamId to a server-only chain', () => {
      const registry = new AggregateChainRegistry()
      const chain = registry.create({ serverStreamId: SERVER_A })
      registry.attachClientStreamId(chain, CLIENT_A)
      expect(chain.clientStreamId).toBe(CLIENT_A)
      expect(registry.get(CLIENT_A)).toBe(chain)
      expect(registry.get(SERVER_A)).toBe(chain)
    })

    it('asserts when chain already has a clientStreamId', () => {
      const registry = new AggregateChainRegistry()
      const chain = registry.create({ clientStreamId: CLIENT_A })
      expect(() => registry.attachClientStreamId(chain, CLIENT_B)).toThrow()
    })

    it('asserts when target clientStreamId already belongs to another chain', () => {
      const registry = new AggregateChainRegistry()
      registry.create({ clientStreamId: CLIENT_A })
      const b = registry.create({ serverStreamId: SERVER_B })
      expect(() => registry.attachClientStreamId(b, CLIENT_A)).toThrow()
    })
  })

  describe('remove', () => {
    it('removes a client-only chain', () => {
      const registry = new AggregateChainRegistry()
      const chain = registry.create({ clientStreamId: CLIENT_A })
      registry.remove(chain)
      expect(registry.has(CLIENT_A)).toBe(false)
      expect(registry.size).toBe(0)
    })

    it('removes a server-only chain', () => {
      const registry = new AggregateChainRegistry()
      const chain = registry.create({ serverStreamId: SERVER_A })
      registry.remove(chain)
      expect(registry.has(SERVER_A)).toBe(false)
    })

    it('removes both index entries for a dual-indexed chain', () => {
      const registry = new AggregateChainRegistry()
      const chain = registry.create({ clientStreamId: CLIENT_A, serverStreamId: SERVER_A })
      registry.remove(chain)
      expect(registry.has(CLIENT_A)).toBe(false)
      expect(registry.has(SERVER_A)).toBe(false)
    })

    it('leaves other chains untouched', () => {
      const registry = new AggregateChainRegistry()
      const a = registry.create({ clientStreamId: CLIENT_A })
      const b = registry.create({ serverStreamId: SERVER_B })
      registry.remove(a)
      expect(registry.has(CLIENT_A)).toBe(false)
      expect(registry.get(SERVER_B)).toBe(b)
    })
  })

  describe('find', () => {
    it('returns the chain matching a predicate', () => {
      const registry = new AggregateChainRegistry()
      const a = registry.create({ clientStreamId: CLIENT_A, createCommandId: 'cmd-A' })
      registry.create({ clientStreamId: CLIENT_B, createCommandId: 'cmd-B' })
      expect(registry.find((c) => c.createCommandId === 'cmd-A')).toBe(a)
    })

    it('returns undefined when nothing matches', () => {
      const registry = new AggregateChainRegistry()
      registry.create({ clientStreamId: CLIENT_A, createCommandId: 'cmd-A' })
      expect(registry.find((c) => c.createCommandId === 'cmd-X')).toBeUndefined()
    })

    it('visits dual-indexed chains only once', () => {
      const registry = new AggregateChainRegistry()
      registry.create({
        clientStreamId: CLIENT_A,
        serverStreamId: SERVER_A,
        createCommandId: 'cmd-A',
      })
      let visits = 0
      registry.find((c) => {
        if (c.createCommandId === 'cmd-A') visits++
        return false
      })
      expect(visits).toBe(1)
    })
  })

  describe('chains / size', () => {
    it('size counts distinct chains, not keys', () => {
      const registry = new AggregateChainRegistry()
      registry.create({ clientStreamId: CLIENT_A, serverStreamId: SERVER_A })
      registry.create({ serverStreamId: SERVER_B })
      expect(registry.size).toBe(2)
    })

    it('chains() yields each chain exactly once', () => {
      const registry = new AggregateChainRegistry()
      const a = registry.create({ clientStreamId: CLIENT_A, serverStreamId: SERVER_A })
      const b = registry.create({ serverStreamId: SERVER_B })
      const all = [...registry.chains()]
      expect(all).toHaveLength(2)
      expect(all).toContain(a)
      expect(all).toContain(b)
    })
  })

  describe('onCommandCleanup', () => {
    it('clears createCommandId and createdEntityId when matching', () => {
      const registry = new AggregateChainRegistry()
      const chain = registry.create({
        clientStreamId: CLIENT_A,
        createCommandId: 'cmd-1',
        createdEntityId: 'temp-a',
        latestCommandId: 'cmd-1',
      })
      registry.onCommandCleanup('cmd-1', [CLIENT_A])
      expect(chain.createCommandId).toBeUndefined()
      expect(chain.createdEntityId).toBeUndefined()
      expect(chain.latestCommandId).toBeUndefined()
    })

    it('preserves lastKnownRevision', () => {
      const registry = new AggregateChainRegistry()
      const chain = registry.create({
        clientStreamId: CLIENT_A,
        latestCommandId: 'cmd-1',
        lastKnownRevision: 'rev-5',
      })
      registry.onCommandCleanup('cmd-1', [CLIENT_A])
      expect(chain.lastKnownRevision).toBe('rev-5')
    })

    it('preserves fields set by other commands', () => {
      const registry = new AggregateChainRegistry()
      const chain = registry.create({
        clientStreamId: CLIENT_A,
        createCommandId: 'cmd-create',
        createdEntityId: 'temp-a',
        latestCommandId: 'cmd-update',
      })
      registry.onCommandCleanup('cmd-update', [CLIENT_A])
      expect(chain.createCommandId).toBe('cmd-create')
      expect(chain.createdEntityId).toBe('temp-a')
      expect(chain.latestCommandId).toBeUndefined()
    })

    it('leaves the chain in the registry (never removes)', () => {
      const registry = new AggregateChainRegistry()
      registry.create({
        clientStreamId: CLIENT_A,
        createCommandId: 'cmd-1',
        createdEntityId: 'temp-a',
        latestCommandId: 'cmd-1',
      })
      registry.onCommandCleanup('cmd-1', [CLIENT_A])
      expect(registry.has(CLIENT_A)).toBe(true)
      expect(registry.size).toBe(1)
    })

    it('is idempotent', () => {
      const registry = new AggregateChainRegistry()
      const chain = registry.create({
        clientStreamId: CLIENT_A,
        createCommandId: 'cmd-1',
        createdEntityId: 'temp-a',
        latestCommandId: 'cmd-1',
      })
      registry.onCommandCleanup('cmd-1', [CLIENT_A])
      registry.onCommandCleanup('cmd-1', [CLIENT_A])
      expect(chain.createCommandId).toBeUndefined()
      expect(chain.createdEntityId).toBeUndefined()
      expect(chain.latestCommandId).toBeUndefined()
    })

    it('reaches a dual-indexed chain via either streamId', () => {
      const registry = new AggregateChainRegistry()
      const chain = registry.create({
        clientStreamId: CLIENT_A,
        serverStreamId: SERVER_A,
        latestCommandId: 'cmd-1',
      })
      registry.onCommandCleanup('cmd-1', [SERVER_A])
      expect(chain.latestCommandId).toBeUndefined()
    })

    it('visits a dual-indexed chain only once when both streamIds are passed', () => {
      const registry = new AggregateChainRegistry()
      const chain = registry.create({
        clientStreamId: CLIENT_A,
        serverStreamId: SERVER_A,
        latestCommandId: 'cmd-1',
      })
      registry.onCommandCleanup('cmd-1', [CLIENT_A, SERVER_A])
      expect(chain.latestCommandId).toBeUndefined()
    })

    it('ignores streamIds with no chain', () => {
      const registry = new AggregateChainRegistry()
      expect(() => registry.onCommandCleanup('cmd-x', [CLIENT_A])).not.toThrow()
    })

    it('does not touch chains not referencing the command', () => {
      const registry = new AggregateChainRegistry()
      const a = registry.create({
        clientStreamId: CLIENT_A,
        latestCommandId: 'cmd-1',
      })
      const b = registry.create({
        serverStreamId: SERVER_B,
        latestCommandId: 'cmd-2',
      })
      registry.onCommandCleanup('cmd-1', [CLIENT_A])
      expect(a.latestCommandId).toBeUndefined()
      expect(b.latestCommandId).toBe('cmd-2')
    })
  })

  describe('clear', () => {
    it('removes every chain', () => {
      const registry = new AggregateChainRegistry()
      registry.create({ clientStreamId: CLIENT_A })
      registry.create({ serverStreamId: SERVER_B })
      registry.clear()
      expect(registry.size).toBe(0)
      expect(registry.has(CLIENT_A)).toBe(false)
      expect(registry.has(SERVER_B)).toBe(false)
    })
  })
})
