import { describe, expect, it } from 'vitest'
import { createEntityRef, entityIdToString, isEntityRef } from './entities.js'

describe('isEntityRef', () => {
  it('returns true for a valid EntityRef', () => {
    const ref = createEntityRef('entity-1', 'cmd-1', 'temporary')
    expect(isEntityRef(ref)).toBe(true)
  })

  it('returns false for a plain string', () => {
    expect(isEntityRef('entity-1')).toBe(false)
  })

  it('returns false for null', () => {
    expect(isEntityRef(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isEntityRef(undefined)).toBe(false)
  })

  it('returns false for a number', () => {
    expect(isEntityRef(42)).toBe(false)
  })

  it('returns false for an object without __entityRef', () => {
    expect(isEntityRef({ entityId: 'e1', commandId: 'c1' })).toBe(false)
  })

  it('returns false when __entityRef is false', () => {
    expect(isEntityRef({ __entityRef: false, entityId: 'e1', commandId: 'c1' })).toBe(false)
  })

  it('returns true when __entityRef is true (brand check is sufficient)', () => {
    expect(isEntityRef({ __entityRef: true })).toBe(true)
  })
})

describe('entityIdToString', () => {
  it('returns a plain string as-is', () => {
    expect(entityIdToString('server-id-123')).toBe('server-id-123')
  })

  it('extracts entityId from an EntityRef', () => {
    const ref = createEntityRef('temp-id-456', 'cmd-2', 'temporary')
    expect(entityIdToString(ref)).toBe('temp-id-456')
  })

  it('extracts entityId from a permanent EntityRef', () => {
    const ref = createEntityRef('perm-id-789', 'cmd-3', 'permanent')
    expect(entityIdToString(ref)).toBe('perm-id-789')
  })
})

describe('createEntityRef', () => {
  it('creates an EntityRef with correct fields', () => {
    const ref = createEntityRef('entity-1', 'cmd-1', 'temporary')
    expect(ref).toEqual({
      __entityRef: true,
      entityId: 'entity-1',
      commandId: 'cmd-1',
      idStrategy: 'temporary',
    })
  })

  it('creates a permanent EntityRef', () => {
    const ref = createEntityRef('entity-2', 'cmd-2', 'permanent')
    expect(ref.idStrategy).toBe('permanent')
  })

  it('passes isEntityRef type guard', () => {
    const ref = createEntityRef('entity-3', 'cmd-3', 'temporary')
    expect(isEntityRef(ref)).toBe(true)
  })
})

describe('serialization boundaries', () => {
  it('survives JSON round-trip (storage boundary)', () => {
    const ref = createEntityRef('entity-1', 'cmd-1', 'temporary')
    const serialized = JSON.stringify(ref)
    const deserialized: unknown = JSON.parse(serialized)

    expect(isEntityRef(deserialized)).toBe(true)
    expect(deserialized).toEqual(ref)
  })

  it('survives structuredClone (worker boundary)', () => {
    const ref = createEntityRef('entity-1', 'cmd-1', 'permanent')
    const cloned: unknown = structuredClone(ref)

    expect(isEntityRef(cloned)).toBe(true)
    expect(cloned).toEqual(ref)
  })
})
