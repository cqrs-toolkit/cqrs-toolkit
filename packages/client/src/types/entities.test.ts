import { describe, expect, it } from 'vitest'
import {
  createEntityRef,
  entityIdEquals,
  entityIdMatches,
  entityIdToString,
  isEntityRef,
} from './entities.js'

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

describe('entityIdEquals', () => {
  it('returns true for identical strings', () => {
    expect(entityIdEquals('abc', 'abc')).toBe(true)
  })

  it('returns false for different strings', () => {
    expect(entityIdEquals('abc', 'def')).toBe(false)
  })

  it('returns true for EntityRefs with same entityId and commandId', () => {
    const a = createEntityRef('e1', 'cmd-1', 'temporary')
    const b = createEntityRef('e1', 'cmd-1', 'temporary')
    expect(entityIdEquals(a, b)).toBe(true)
  })

  it('returns false for EntityRefs with same entityId but different commandId', () => {
    const a = createEntityRef('e1', 'cmd-1', 'temporary')
    const b = createEntityRef('e1', 'cmd-2', 'temporary')
    expect(entityIdEquals(a, b)).toBe(false)
  })

  it('returns false for string vs EntityRef with same entityId', () => {
    const ref = createEntityRef('abc', 'cmd-1', 'temporary')
    expect(entityIdEquals('abc', ref)).toBe(false)
    expect(entityIdEquals(ref, 'abc')).toBe(false)
  })

  it('returns true for undefined vs undefined', () => {
    expect(entityIdEquals(undefined, undefined)).toBe(true)
  })

  it('returns false for undefined vs string', () => {
    expect(entityIdEquals(undefined, 'abc')).toBe(false)
    expect(entityIdEquals('abc', undefined)).toBe(false)
  })

  it('returns false for undefined vs EntityRef', () => {
    const ref = createEntityRef('e1', 'cmd-1', 'temporary')
    expect(entityIdEquals(undefined, ref)).toBe(false)
    expect(entityIdEquals(ref, undefined)).toBe(false)
  })
})

describe('entityIdMatches', () => {
  it('returns true for identical strings', () => {
    expect(entityIdMatches('abc', 'abc')).toBe(true)
  })

  it('returns false for different strings', () => {
    expect(entityIdMatches('abc', 'def')).toBe(false)
  })

  it('returns true for string and EntityRef with same entityId', () => {
    const ref = createEntityRef('abc', 'cmd-1', 'temporary')
    expect(entityIdMatches('abc', ref)).toBe(true)
    expect(entityIdMatches(ref, 'abc')).toBe(true)
  })

  it('returns true for EntityRefs with same entityId but different commandId', () => {
    const a = createEntityRef('e1', 'cmd-1', 'temporary')
    const b = createEntityRef('e1', 'cmd-2', 'temporary')
    expect(entityIdMatches(a, b)).toBe(true)
  })

  it('returns false for EntityRefs with different entityId', () => {
    const a = createEntityRef('e1', 'cmd-1', 'temporary')
    const b = createEntityRef('e2', 'cmd-1', 'temporary')
    expect(entityIdMatches(a, b)).toBe(false)
  })

  it('returns true for undefined vs undefined', () => {
    expect(entityIdMatches(undefined, undefined)).toBe(true)
  })

  it('returns false for undefined vs string', () => {
    expect(entityIdMatches(undefined, 'abc')).toBe(false)
    expect(entityIdMatches('abc', undefined)).toBe(false)
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
