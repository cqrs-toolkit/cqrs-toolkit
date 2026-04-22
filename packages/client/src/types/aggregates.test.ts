import { describe, expect, it } from 'vitest'
import { isEntityIdLink } from './aggregates.js'
import { createEntityRef } from './entities.js'

describe('isEntityIdLink', () => {
  it('returns true for a plain Link (no service)', () => {
    expect(isEntityIdLink({ type: 'Note', id: 'note-1' })).toBe(true)
  })

  it('returns true for a ServiceLink', () => {
    expect(isEntityIdLink({ service: 'notes', type: 'Note', id: 'note-1' })).toBe(true)
  })

  it('returns true when id is an EntityRef', () => {
    const ref = createEntityRef('tmp-1', 'cmd-1', 'temporary')
    expect(isEntityIdLink({ type: 'Note', id: ref })).toBe(true)
  })

  it('returns true for ServiceLink with EntityRef id', () => {
    const ref = createEntityRef('tmp-1', 'cmd-1', 'temporary')
    expect(isEntityIdLink({ service: 'notes', type: 'Note', id: ref })).toBe(true)
  })

  it('returns false for a plain string', () => {
    expect(isEntityIdLink('note-1')).toBe(false)
  })

  it('returns false for null', () => {
    expect(isEntityIdLink(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isEntityIdLink(undefined)).toBe(false)
  })

  it('returns false for a number', () => {
    expect(isEntityIdLink(42)).toBe(false)
  })

  it('returns false for an object missing type', () => {
    expect(isEntityIdLink({ id: 'note-1' })).toBe(false)
  })

  it('returns false for an object with non-string type', () => {
    expect(isEntityIdLink({ type: 123, id: 'note-1' })).toBe(false)
  })

  it('returns false when id is a number', () => {
    expect(isEntityIdLink({ type: 'Note', id: 123 })).toBe(false)
  })

  it('returns false when id is missing', () => {
    expect(isEntityIdLink({ type: 'Note' })).toBe(false)
  })

  it('returns false when service is non-string', () => {
    expect(isEntityIdLink({ service: 123, type: 'Note', id: 'note-1' })).toBe(false)
  })

  it('returns true when service is undefined (optional field absent)', () => {
    expect(isEntityIdLink({ type: 'Note', id: 'note-1', service: undefined })).toBe(true)
  })
})
