import { describe, expect, it } from 'vitest'
import { parseExpectedRevision } from './CommandQueue.js'

describe('parseExpectedRevision', () => {
  it('parses a decimal integer string as bigint', () => {
    expect(parseExpectedRevision('42')).toBe(42n)
  })

  it('parses zero', () => {
    expect(parseExpectedRevision('0')).toBe(0n)
  })

  it('parses large values beyond Number.MAX_SAFE_INTEGER', () => {
    expect(parseExpectedRevision('9007199254740993')).toBe(9007199254740993n)
  })

  it('returns undefined for undefined', () => {
    expect(parseExpectedRevision(undefined)).toBeUndefined()
  })

  it('returns undefined for null', () => {
    expect(parseExpectedRevision(null)).toBeUndefined()
  })

  it('returns undefined for non-string values', () => {
    expect(parseExpectedRevision(42)).toBeUndefined()
    expect(parseExpectedRevision(42n)).toBeUndefined()
    expect(parseExpectedRevision({})).toBeUndefined()
    expect(parseExpectedRevision(true)).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    expect(parseExpectedRevision('')).toBeUndefined()
  })

  it('returns undefined for non-numeric strings', () => {
    expect(parseExpectedRevision('not-a-number')).toBeUndefined()
    expect(parseExpectedRevision('1.5')).toBeUndefined()
    expect(parseExpectedRevision('1e10')).toBeUndefined()
    expect(parseExpectedRevision('abc123')).toBeUndefined()
  })
})
